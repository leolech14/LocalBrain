use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use regex::Regex;
use once_cell::sync::Lazy;
use chrono::Utc;

// Precompiled regex patterns for security checks
static PATH_TRAVERSAL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(\.\.[\\/])|([^/\\]\.\.)|(\.\.[^/\\])").unwrap()
});

static DANGEROUS_CHARS_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[\x00-\x1f\x7f-\x9f]").unwrap()
});

static COMMAND_INJECTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[;&|`$<>]").unwrap()
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedSecurityManager {
    allowed_roots: Vec<PathBuf>,
    blocked_paths: Vec<String>,
    command_whitelist: HashMap<String, CommandPolicy>,
    path_permissions: HashMap<String, PathPermissions>,
    audit_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandPolicy {
    pub allowed_args: Option<Vec<String>>,
    pub blocked_args: Vec<String>,
    pub requires_confirmation: bool,
    pub max_execution_time_ms: u64,
    pub allowed_env_vars: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathPermissions {
    pub read: bool,
    pub write: bool,
    pub execute: bool,
    pub delete: bool,
    pub list: bool,
}

impl Default for PathPermissions {
    fn default() -> Self {
        Self {
            read: true,
            write: false,
            execute: false,
            delete: false,
            list: true,
        }
    }
}

impl EnhancedSecurityManager {
    pub fn new() -> Self {
        let mut manager = Self {
            allowed_roots: Vec::new(),
            blocked_paths: Vec::new(),
            command_whitelist: HashMap::new(),
            path_permissions: HashMap::new(),
            audit_enabled: true,
        };
        
        manager.initialize_defaults();
        manager
    }
    
    fn initialize_defaults(&mut self) {
        // Default allowed roots
        if let Some(home_dir) = dirs::home_dir() {
            self.allowed_roots.push(home_dir);
        }
        self.allowed_roots.push(PathBuf::from("/tmp"));
        self.allowed_roots.push(PathBuf::from("/var/tmp"));
        
        // Blocked paths (even within allowed roots)
        self.blocked_paths = vec![
            "/.ssh".to_string(),
            "/.gnupg".to_string(),
            "/.aws".to_string(),
            "/.config/gcloud".to_string(),
            "/Library/Keychains".to_string(),
            "/.localbrain_key".to_string(), // Our own encryption key
        ];
        
        // Command whitelist with policies
        self.setup_command_whitelist();
        
        // Path-specific permissions
        self.setup_path_permissions();
    }
    
    fn setup_command_whitelist(&mut self) {
        // File operations
        self.command_whitelist.insert("ls".to_string(), CommandPolicy {
            allowed_args: None, // Allow all args
            blocked_args: vec![],
            requires_confirmation: false,
            max_execution_time_ms: 5000,
            allowed_env_vars: vec![],
        });
        
        self.command_whitelist.insert("cat".to_string(), CommandPolicy {
            allowed_args: None,
            blocked_args: vec![],
            requires_confirmation: false,
            max_execution_time_ms: 10000,
            allowed_env_vars: vec![],
        });
        
        self.command_whitelist.insert("grep".to_string(), CommandPolicy {
            allowed_args: None,
            blocked_args: vec![],
            requires_confirmation: false,
            max_execution_time_ms: 30000,
            allowed_env_vars: vec![],
        });
        
        // Git operations (safe subset)
        self.command_whitelist.insert("git".to_string(), CommandPolicy {
            allowed_args: Some(vec![
                "status".to_string(),
                "log".to_string(),
                "diff".to_string(),
                "branch".to_string(),
                "show".to_string(),
            ]),
            blocked_args: vec![
                "push".to_string(),
                "credential".to_string(),
                "config".to_string(),
            ],
            requires_confirmation: false,
            max_execution_time_ms: 15000,
            allowed_env_vars: vec![],
        });
        
        // Python (restricted)
        self.command_whitelist.insert("python3".to_string(), CommandPolicy {
            allowed_args: None,
            blocked_args: vec![
                "-c".to_string(), // No inline code
                "--command".to_string(),
            ],
            requires_confirmation: true,
            max_execution_time_ms: 60000,
            allowed_env_vars: vec!["PYTHONPATH".to_string()],
        });
        
        // Node.js (restricted)
        self.command_whitelist.insert("node".to_string(), CommandPolicy {
            allowed_args: None,
            blocked_args: vec![
                "-e".to_string(), // No inline code
                "--eval".to_string(),
                "-p".to_string(),
                "--print".to_string(),
            ],
            requires_confirmation: true,
            max_execution_time_ms: 60000,
            allowed_env_vars: vec!["NODE_ENV".to_string()],
        });
    }
    
    fn setup_path_permissions(&mut self) {
        // Desktop folder - read/write allowed
        if let Some(desktop) = dirs::desktop_dir() {
            self.path_permissions.insert(
                desktop.to_string_lossy().to_string(),
                PathPermissions {
                    read: true,
                    write: true,
                    execute: false,
                    delete: true,
                    list: true,
                },
            );
        }
        
        // Downloads folder - read/write allowed
        if let Some(downloads) = dirs::download_dir() {
            self.path_permissions.insert(
                downloads.to_string_lossy().to_string(),
                PathPermissions {
                    read: true,
                    write: true,
                    execute: false,
                    delete: true,
                    list: true,
                },
            );
        }
        
        // Documents folder - read only by default
        if let Some(documents) = dirs::document_dir() {
            self.path_permissions.insert(
                documents.to_string_lossy().to_string(),
                PathPermissions {
                    read: true,
                    write: false,
                    execute: false,
                    delete: false,
                    list: true,
                },
            );
        }
    }
    
    /// Validate and normalize a file path
    pub fn validate_path(&self, path: &str) -> Result<PathBuf> {
        // Check for null bytes or control characters
        if DANGEROUS_CHARS_REGEX.is_match(path) {
            return Err(anyhow!("Path contains invalid characters"));
        }
        
        // Check for path traversal attempts
        if PATH_TRAVERSAL_REGEX.is_match(path) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        // Normalize the path
        let normalized = self.normalize_path(path)?;
        
        // Check if path is within allowed roots
        let is_allowed = self.allowed_roots.iter().any(|root| {
            normalized.starts_with(root)
        });
        
        if !is_allowed {
            return Err(anyhow!("Path is outside allowed directories"));
        }
        
        // Check against blocked paths
        let path_str = normalized.to_string_lossy();
        for blocked in &self.blocked_paths {
            if path_str.contains(blocked) {
                return Err(anyhow!("Access to this path is blocked"));
            }
        }
        
        Ok(normalized)
    }
    
    /// Normalize a path safely
    fn normalize_path(&self, path: &str) -> Result<PathBuf> {
        let mut normalized = PathBuf::new();
        
        // Handle home directory expansion
        if path.starts_with("~") {
            if let Some(home) = dirs::home_dir() {
                normalized.push(home);
                normalized.push(&path[2..]); // Skip "~/"
            } else {
                return Err(anyhow!("Cannot resolve home directory"));
            }
        } else if path.starts_with("/") {
            normalized = PathBuf::from(path);
        } else {
            // Relative paths are resolved from a safe working directory
            if let Ok(cwd) = std::env::current_dir() {
                // Only allow relative paths from within allowed roots
                let is_cwd_allowed = self.allowed_roots.iter().any(|root| {
                    cwd.starts_with(root)
                });
                
                if !is_cwd_allowed {
                    return Err(anyhow!("Relative paths not allowed from current directory"));
                }
                
                normalized = cwd.join(path);
            } else {
                return Err(anyhow!("Cannot resolve relative path"));
            }
        }
        
        // Canonicalize to resolve symlinks and ".."
        match normalized.canonicalize() {
            Ok(canonical) => Ok(canonical),
            Err(_) => {
                // Path doesn't exist yet, validate parent
                if let Some(parent) = normalized.parent() {
                    if parent.exists() {
                        parent.canonicalize()?;
                        Ok(normalized)
                    } else {
                        Err(anyhow!("Parent directory does not exist"))
                    }
                } else {
                    Err(anyhow!("Invalid path"))
                }
            }
        }
    }
    
    /// Check if a command is allowed to execute
    pub fn validate_command(&self, command: &str, args: &[String]) -> Result<()> {
        // Check for command injection attempts
        if COMMAND_INJECTION_REGEX.is_match(command) {
            return Err(anyhow!("Command contains dangerous characters"));
        }
        
        // Extract base command (handle full paths)
        let base_command = Path::new(command)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(command);
        
        // Check whitelist
        match self.command_whitelist.get(base_command) {
            Some(policy) => {
                // Check allowed args
                if let Some(allowed_args) = &policy.allowed_args {
                    if !args.is_empty() && !allowed_args.contains(&args[0]) {
                        return Err(anyhow!(
                            "Command '{}' with argument '{}' is not allowed",
                            base_command,
                            args[0]
                        ));
                    }
                }
                
                // Check blocked args
                for arg in args {
                    if policy.blocked_args.contains(arg) {
                        return Err(anyhow!(
                            "Argument '{}' is blocked for command '{}'",
                            arg,
                            base_command
                        ));
                    }
                    
                    // Also check for command injection in args
                    if COMMAND_INJECTION_REGEX.is_match(arg) {
                        return Err(anyhow!("Argument contains dangerous characters"));
                    }
                }
                
                Ok(())
            }
            None => Err(anyhow!("Command '{}' is not whitelisted", base_command)),
        }
    }
    
    /// Check file operation permissions
    pub fn check_file_permission(&self, path: &PathBuf, operation: FileOperation) -> Result<()> {
        let path_str = path.to_string_lossy().to_string();
        
        // Check specific path permissions first
        for (perm_path, permissions) in &self.path_permissions {
            if path_str.starts_with(perm_path) {
                match operation {
                    FileOperation::Read if !permissions.read => {
                        return Err(anyhow!("Read permission denied"));
                    }
                    FileOperation::Write if !permissions.write => {
                        return Err(anyhow!("Write permission denied"));
                    }
                    FileOperation::Execute if !permissions.execute => {
                        return Err(anyhow!("Execute permission denied"));
                    }
                    FileOperation::Delete if !permissions.delete => {
                        return Err(anyhow!("Delete permission denied"));
                    }
                    FileOperation::List if !permissions.list => {
                        return Err(anyhow!("List permission denied"));
                    }
                    _ => {}
                }
            }
        }
        
        // Additional checks for specific operations
        match operation {
            FileOperation::Execute => {
                // Never allow execution of certain file types
                let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                let blocked_extensions = ["sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"];
                
                if blocked_extensions.contains(&extension) {
                    return Err(anyhow!("Execution of {} files is not allowed", extension));
                }
            }
            FileOperation::Write | FileOperation::Delete => {
                // Protect important files
                let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let protected_files = [
                    ".gitignore", ".env", "package.json", "Cargo.toml",
                    "yarn.lock", "package-lock.json", "Cargo.lock",
                ];
                
                if protected_files.contains(&filename) {
                    return Err(anyhow!("Operation not allowed on protected file"));
                }
            }
            _ => {}
        }
        
        Ok(())
    }
    
    /// Log security event
    pub fn log_security_event(&self, event_type: &str, details: &str, allowed: bool) {
        if self.audit_enabled {
            let event = SecurityEvent {
                timestamp: Utc::now(),
                event_type: event_type.to_string(),
                details: details.to_string(),
                allowed,
                user_id: None, // Would be populated from session
            };
            
            // In production, this would write to the encrypted database
            println!("SECURITY: {:?}", event);
        }
    }
}

#[derive(Debug, Clone)]
pub enum FileOperation {
    Read,
    Write,
    Execute,
    Delete,
    List,
}

#[derive(Debug, Serialize)]
struct SecurityEvent {
    timestamp: chrono::DateTime<chrono::Utc>,
    event_type: String,
    details: String,
    allowed: bool,
    user_id: Option<String>,
}