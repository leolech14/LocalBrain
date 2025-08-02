use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use async_trait::async_trait;
use tokio::process::Command;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::security::SecurityManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters_schema(&self) -> Value;
    async fn execute(&self, args: Value) -> Result<ToolResult>;
}

// File System Tool
pub struct FileSystemTool {
    allowed_roots: Vec<String>,
}

impl FileSystemTool {
    pub fn new(allowed_roots: Vec<String>) -> Self {
        Self { allowed_roots }
    }
    
    async fn read_file(&self, args: &Value) -> Result<ToolResult> {
        let path = args["path"].as_str()
            .ok_or_else(|| anyhow!("Missing 'path' parameter"))?;
        
        // Check allowed roots
        let allowed = self.allowed_roots.iter()
            .any(|root| path.starts_with(root));
        
        if !allowed {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Path not in allowed roots".to_string()),
            });
        }
        
        match tokio::fs::read_to_string(path).await {
            Ok(content) => Ok(ToolResult {
                success: true,
                output: content,
                error: None,
            }),
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }
    
    async fn write_file(&self, args: &Value) -> Result<ToolResult> {
        let path = args["path"].as_str()
            .ok_or_else(|| anyhow!("Missing 'path' parameter"))?;
        let content = args["content"].as_str()
            .ok_or_else(|| anyhow!("Missing 'content' parameter"))?;
        
        // Check allowed roots
        let allowed = self.allowed_roots.iter()
            .any(|root| path.starts_with(root));
        
        if !allowed {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Path not in allowed roots".to_string()),
            });
        }
        
        match tokio::fs::write(path, content).await {
            Ok(_) => Ok(ToolResult {
                success: true,
                output: format!("File written: {}", path),
                error: None,
            }),
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }
    
    async fn list_directory(&self, args: &Value) -> Result<ToolResult> {
        let path = args["path"].as_str()
            .ok_or_else(|| anyhow!("Missing 'path' parameter"))?;
        
        // Check allowed roots
        let allowed = self.allowed_roots.iter()
            .any(|root| path.starts_with(root));
        
        if !allowed {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Path not in allowed roots".to_string()),
            });
        }
        
        let mut entries = Vec::new();
        let mut dir = tokio::fs::read_dir(path).await?;
        
        while let Some(entry) = dir.next_entry().await? {
            let metadata = entry.metadata().await?;
            let file_type = if metadata.is_dir() { "dir" } else { "file" };
            entries.push(serde_json::json!({
                "name": entry.file_name().to_string_lossy(),
                "type": file_type,
                "size": metadata.len(),
            }));
        }
        
        Ok(ToolResult {
            success: true,
            output: serde_json::to_string_pretty(&entries)?,
            error: None,
        })
    }
}

#[async_trait]
impl Tool for FileSystemTool {
    fn name(&self) -> &str {
        "filesystem"
    }
    
    fn description(&self) -> &str {
        "Read, write, and list files in allowed directories"
    }
    
    fn parameters_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "write", "list"],
                    "description": "The file operation to perform"
                },
                "path": {
                    "type": "string",
                    "description": "The file or directory path"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write (only for write action)"
                }
            },
            "required": ["action", "path"]
        })
    }
    
    async fn execute(&self, args: Value) -> Result<ToolResult> {
        match args["action"].as_str() {
            Some("read") => self.read_file(&args).await,
            Some("write") => self.write_file(&args).await,
            Some("list") => self.list_directory(&args).await,
            _ => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Invalid action".to_string()),
            }),
        }
    }
}

// Terminal Command Tool
pub struct TerminalTool {
    security_manager: Arc<SecurityManager>,
}

impl TerminalTool {
    pub fn new(security_manager: Arc<SecurityManager>) -> Self {
        Self { security_manager }
    }
    
    fn is_command_allowed(&self, command: &str) -> bool {
        // Whitelist of safe commands
        let safe_commands = [
            "ls", "pwd", "echo", "cat", "grep", "find", "which",
            "git", "npm", "node", "python", "pip", "cargo",
            "date", "whoami", "df", "du", "ps", "top"
        ];
        
        let cmd_parts: Vec<&str> = command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return false;
        }
        
        let base_cmd = cmd_parts[0];
        safe_commands.contains(&base_cmd)
    }
}

#[async_trait]
impl Tool for TerminalTool {
    fn name(&self) -> &str {
        "terminal"
    }
    
    fn description(&self) -> &str {
        "Execute safe terminal commands"
    }
    
    fn parameters_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The terminal command to execute"
                },
                "working_dir": {
                    "type": "string",
                    "description": "Working directory for the command (optional)"
                }
            },
            "required": ["command"]
        })
    }
    
    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let command = args["command"].as_str()
            .ok_or_else(|| anyhow!("Missing 'command' parameter"))?;
        
        if !self.is_command_allowed(command) {
            return Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some("Command not allowed".to_string()),
            });
        }
        
        let mut cmd = Command::new("sh");
        cmd.arg("-c").arg(command);
        
        if let Some(cwd) = args["working_dir"].as_str() {
            cmd.current_dir(cwd);
        }
        
        match cmd.output().await {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                Ok(ToolResult {
                    success: output.status.success(),
                    output: format!("{}{}", stdout, stderr),
                    error: if output.status.success() { None } else { Some(stderr.to_string()) },
                })
            }
            Err(e) => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }
}

// MCP Bridge Tool
pub struct MCPBridgeTool {
    mcp_servers: Arc<RwLock<HashMap<String, String>>>, // server_name -> server_url
}

impl MCPBridgeTool {
    pub fn new() -> Self {
        Self {
            mcp_servers: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn register_server(&self, name: String, url: String) {
        self.mcp_servers.write().await.insert(name, url);
    }
}

#[async_trait]
impl Tool for MCPBridgeTool {
    fn name(&self) -> &str {
        "mcp"
    }
    
    fn description(&self) -> &str {
        "Execute tools from Model Context Protocol servers"
    }
    
    fn parameters_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "MCP server name"
                },
                "tool": {
                    "type": "string",
                    "description": "Tool name on the MCP server"
                },
                "arguments": {
                    "type": "object",
                    "description": "Arguments for the tool"
                }
            },
            "required": ["server", "tool", "arguments"]
        })
    }
    
    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let server = args["server"].as_str()
            .ok_or_else(|| anyhow!("Missing 'server' parameter"))?;
        let tool = args["tool"].as_str()
            .ok_or_else(|| anyhow!("Missing 'tool' parameter"))?;
        let tool_args = &args["arguments"];
        
        let servers = self.mcp_servers.read().await;
        let server_url = servers.get(server)
            .ok_or_else(|| anyhow!("MCP server not found: {}", server))?;
        
        // TODO: Implement actual MCP protocol communication
        // For now, return a placeholder
        Ok(ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("MCP bridge not fully implemented. Would call {} on {} with args: {}", 
                tool, server_url, tool_args)),
        })
    }
}

// Tool Registry
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, Arc<dyn Tool>>>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub async fn register(&self, tool: Arc<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.write().await.insert(name, tool);
    }
    
    pub async fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.read().await.get(name).cloned()
    }
    
    pub async fn list(&self) -> Vec<(String, String)> {
        self.tools.read().await
            .iter()
            .map(|(name, tool)| (name.clone(), tool.description().to_string()))
            .collect()
    }
    
    pub async fn execute(&self, tool_name: &str, args: Value) -> Result<ToolResult> {
        let tool = self.get(tool_name).await
            .ok_or_else(|| anyhow!("Tool not found: {}", tool_name))?;
        
        tool.execute(args).await
    }
    
    pub async fn get_tool_definitions(&self) -> Vec<Value> {
        let tools = self.tools.read().await;
        tools.iter().map(|(_, tool)| {
            serde_json::json!({
                "name": tool.name(),
                "description": tool.description(),
                "parameters": tool.parameters_schema()
            })
        }).collect()
    }
}