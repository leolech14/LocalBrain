use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub icon: String,
    pub version: String,
    pub author: String,
    pub stars: u32,
    pub installs: u32,
    pub tags: Vec<String>,
    pub documentation: String,
    pub examples: Vec<String>,
    pub requirements: Vec<String>,
    pub installed: bool,
    pub plugin_id: Option<String>, // Links to plugin system
    pub executable_path: Option<String>,
    pub config_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecution {
    pub tool_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: Option<String>,
    pub env_vars: HashMap<String, String>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub exit_code: Option<i32>,
    pub execution_time: f64,
}

pub struct ToolsManager {
    tools: Arc<RwLock<HashMap<String, Tool>>>,
    tools_dir: PathBuf,
}

impl ToolsManager {
    pub fn new(tools_dir: PathBuf) -> Result<Self> {
        // Create tools directory if it doesn't exist
        std::fs::create_dir_all(&tools_dir)?;
        
        let manager = Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            tools_dir,
        };
        
        // Don't load built-in tools here - let the caller do it asynchronously
        // This avoids the "Cannot start a runtime from within a runtime" error
        
        Ok(manager)
    }
    
    pub async fn load_builtin_tools(&mut self) -> Result<()> {
        let builtin_tools = vec![
            Tool {
                id: "git-auto-commit".to_string(),
                name: "Git Auto Commit".to_string(),
                description: "Automatically commit changes with AI-generated commit messages".to_string(),
                category: "Git".to_string(),
                icon: "GitBranch".to_string(),
                version: "1.2.0".to_string(),
                author: "LocalBrain Team".to_string(),
                stars: 245,
                installs: 1420,
                tags: vec!["git".to_string(), "automation".to_string(), "ai".to_string()],
                documentation: format!("{}/tools/git-auto-commit", crate::config::CONFIG.api.localbrain_docs_base_url),
                examples: vec![
                    "git-auto-commit --all".to_string(),
                    "git-auto-commit --scope src/".to_string()
                ],
                requirements: vec!["git >= 2.0".to_string(), "OpenAI API key".to_string()],
                installed: false,
                plugin_id: None,
                executable_path: Some("git-auto-commit".to_string()),
                config_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "scope": { "type": "string" },
                        "all": { "type": "boolean" }
                    }
                })),
            },
            Tool {
                id: "code-analyzer".to_string(),
                name: "Code Analyzer".to_string(),
                description: "Deep code analysis with complexity metrics and suggestions".to_string(),
                category: "Code Quality".to_string(),
                icon: "Code".to_string(),
                version: "2.1.0".to_string(),
                author: "LocalBrain Team".to_string(),
                stars: 532,
                installs: 3200,
                tags: vec!["analysis".to_string(), "metrics".to_string(), "quality".to_string()],
                documentation: format!("{}/tools/code-analyzer", crate::config::CONFIG.api.localbrain_docs_base_url),
                examples: vec![
                    "analyze --file main.ts".to_string(),
                    "analyze --project ./".to_string()
                ],
                requirements: vec!["Node.js >= 16".to_string()],
                installed: false,
                plugin_id: None,
                executable_path: Some("code-analyzer".to_string()),
                config_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "file": { "type": "string" },
                        "project": { "type": "string" }
                    }
                })),
            },
            Tool {
                id: "security-scanner".to_string(),
                name: "Security Scanner".to_string(),
                description: "Comprehensive security vulnerability scanner".to_string(),
                category: "Security".to_string(),
                icon: "Shield".to_string(),
                version: "2.5.1".to_string(),
                author: "Security Team".to_string(),
                stars: 892,
                installs: 4500,
                tags: vec!["security".to_string(), "vulnerabilities".to_string(), "scan".to_string()],
                documentation: format!("{}/tools/security-scanner", crate::config::CONFIG.api.localbrain_docs_base_url),
                examples: vec![
                    "sec-scan --deep".to_string(),
                    "sec-scan --target ./src".to_string()
                ],
                requirements: vec!["Python >= 3.8".to_string()],
                installed: false,
                plugin_id: None,
                executable_path: Some("sec-scan".to_string()),
                config_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "deep": { "type": "boolean" },
                        "target": { "type": "string" }
                    }
                })),
            },
        ];
        
        let mut tools = self.tools.write().await;
        for tool in builtin_tools {
            tools.insert(tool.id.clone(), tool);
        }
        
        Ok(())
    }
    
    pub async fn list_tools(&self, category: Option<&str>) -> Vec<Tool> {
        let tools = self.tools.read().await;
        let mut result: Vec<Tool> = if let Some(cat) = category {
            tools.values()
                .filter(|t| t.category == cat)
                .cloned()
                .collect()
        } else {
            tools.values().cloned().collect()
        };
        
        // Sort by stars by default
        result.sort_by(|a, b| b.stars.cmp(&a.stars));
        result
    }
    
    pub async fn get_tool(&self, tool_id: &str) -> Option<Tool> {
        let tools = self.tools.read().await;
        tools.get(tool_id).cloned()
    }
    
    pub async fn install_tool(&self, tool_id: &str) -> Result<()> {
        let mut tools = self.tools.write().await;
        let tool = tools.get_mut(tool_id)
            .ok_or_else(|| anyhow!("Tool not found"))?;
        
        if tool.installed {
            return Err(anyhow!("Tool already installed"));
        }
        
        // Check if it's a plugin-based tool
        if let Some(plugin_id) = &tool.plugin_id {
            // Verify plugin is loaded
            match crate::plugin_system::with_plugin_system(|system| {
                let plugin_id = plugin_id.clone();
                Box::pin(async move {
                    // Check if plugin exists by trying to list all plugins
                    let plugins = system.list_plugins().await;
                    if plugins.iter().any(|p| p.id == plugin_id) {
                        Ok(())
                    } else {
                        Err(anyhow::anyhow!("Plugin not found"))
                    }
                })
            }).await {
                Ok(_) => {
                    tool.installed = true;
                    tool.installs += 1;
                }
                Err(_) => {
                    return Err(anyhow!("Plugin {} not loaded", plugin_id));
                }
            }
        } else if let Some(executable) = &tool.executable_path {
            // For executable-based tools, check if the executable exists
            // In a real implementation, this would download/install the tool
            let tool_path = self.tools_dir.join(executable);
            if !tool_path.exists() {
                // Simulate tool installation
                std::fs::write(&tool_path, "#!/bin/bash\necho 'Tool executed'")?;
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = std::fs::metadata(&tool_path)?.permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&tool_path, perms)?;
                }
            }
            
            tool.installed = true;
            tool.installs += 1;
        }
        
        Ok(())
    }
    
    pub async fn uninstall_tool(&self, tool_id: &str) -> Result<()> {
        let mut tools = self.tools.write().await;
        let tool = tools.get_mut(tool_id)
            .ok_or_else(|| anyhow!("Tool not found"))?;
        
        if !tool.installed {
            return Err(anyhow!("Tool not installed"));
        }
        
        // For executable-based tools, remove the executable
        if let Some(executable) = &tool.executable_path {
            let tool_path = self.tools_dir.join(executable);
            if tool_path.exists() {
                std::fs::remove_file(tool_path)?;
            }
        }
        
        tool.installed = false;
        Ok(())
    }
    
    pub async fn execute_tool(&self, execution: ToolExecution) -> Result<ToolResult> {
        let tools = self.tools.read().await;
        let tool = tools.get(&execution.tool_id)
            .ok_or_else(|| anyhow!("Tool not found"))?;
        
        if !tool.installed {
            return Err(anyhow!("Tool not installed"));
        }
        
        let start_time = std::time::Instant::now();
        
        // Check if it's a plugin-based tool
        if let Some(plugin_id) = &tool.plugin_id {
            // Execute via plugin system
            let params = serde_json::json!({
                "command": execution.command,
                "args": execution.args,
                "workingDir": execution.working_dir,
                "envVars": execution.env_vars,
            });
            
            match crate::plugin_system::with_plugin_system(|system| {
                let plugin_id = plugin_id.clone();
                Box::pin(async move {
                    system.execute_plugin(&plugin_id, "execute", params).await
                })
            }).await {
                Ok(result) => {
                    Ok(ToolResult {
                        success: true,
                        output: result.to_string(),
                        error: None,
                        exit_code: Some(0),
                        execution_time: start_time.elapsed().as_secs_f64(),
                    })
                }
                Err(e) => {
                    Ok(ToolResult {
                        success: false,
                        output: String::new(),
                        error: Some(e.to_string()),
                        exit_code: Some(1),
                        execution_time: start_time.elapsed().as_secs_f64(),
                    })
                }
            }
        } else if let Some(executable) = &tool.executable_path {
            // Execute as subprocess
            let tool_path = self.tools_dir.join(executable);
            
            let mut cmd = tokio::process::Command::new(&tool_path);
            cmd.args(&execution.args);
            
            if let Some(working_dir) = &execution.working_dir {
                cmd.current_dir(working_dir);
            }
            
            for (key, value) in &execution.env_vars {
                cmd.env(key, value);
            }
            
            let output = if let Some(timeout) = execution.timeout {
                tokio::time::timeout(
                    std::time::Duration::from_millis(timeout),
                    cmd.output()
                ).await??
            } else {
                cmd.output().await?
            };
            
            Ok(ToolResult {
                success: output.status.success(),
                output: String::from_utf8_lossy(&output.stdout).to_string(),
                error: if output.status.success() {
                    None
                } else {
                    Some(String::from_utf8_lossy(&output.stderr).to_string())
                },
                exit_code: output.status.code(),
                execution_time: start_time.elapsed().as_secs_f64(),
            })
        } else {
            Err(anyhow!("Tool has no executable or plugin"))
        }
    }
    
    pub async fn get_categories(&self) -> Vec<(String, usize)> {
        let tools = self.tools.read().await;
        let mut categories: HashMap<String, usize> = HashMap::new();
        
        for tool in tools.values() {
            *categories.entry(tool.category.clone()).or_insert(0) += 1;
        }
        
        let mut result: Vec<(String, usize)> = categories.into_iter().collect();
        result.sort_by(|a, b| a.0.cmp(&b.0));
        result
    }
    
    pub async fn search_tools(&self, query: &str) -> Vec<Tool> {
        let tools = self.tools.read().await;
        let query_lower = query.to_lowercase();
        
        let mut results: Vec<Tool> = tools.values()
            .filter(|tool| {
                tool.name.to_lowercase().contains(&query_lower) ||
                tool.description.to_lowercase().contains(&query_lower) ||
                tool.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            })
            .cloned()
            .collect();
        
        // Sort by relevance (simple scoring based on name match priority)
        results.sort_by(|a, b| {
            let a_name_match = a.name.to_lowercase().contains(&query_lower);
            let b_name_match = b.name.to_lowercase().contains(&query_lower);
            
            match (a_name_match, b_name_match) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => b.stars.cmp(&a.stars),
            }
        });
        
        results
    }
    
    pub async fn add_custom_tool(&self, tool: Tool) -> Result<()> {
        let mut tools = self.tools.write().await;
        if tools.contains_key(&tool.id) {
            return Err(anyhow!("Tool with this ID already exists"));
        }
        tools.insert(tool.id.clone(), tool);
        Ok(())
    }
}

// Global tools manager instance
use once_cell::sync::Lazy;

static TOOLS_MANAGER: Lazy<Arc<tokio::sync::Mutex<Option<ToolsManager>>>> = 
    Lazy::new(|| Arc::new(tokio::sync::Mutex::new(None)));

pub async fn initialize_tools_manager(tools_dir: PathBuf) -> Result<()> {
    let mut manager = ToolsManager::new(tools_dir)?;
    manager.load_builtin_tools().await?;
    *TOOLS_MANAGER.lock().await = Some(manager);
    Ok(())
}

pub async fn with_tools_manager<F, R>(f: F) -> Result<R>
where
    F: FnOnce(&ToolsManager) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R>> + Send + '_>>,
{
    let guard = TOOLS_MANAGER.lock().await;
    match guard.as_ref() {
        Some(manager) => f(manager).await,
        None => Err(anyhow!("Tools manager not initialized")),
    }
}