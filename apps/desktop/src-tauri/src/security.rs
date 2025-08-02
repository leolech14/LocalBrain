// FILE: apps/desktop/src-tauri/src/security.rs
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use uuid::Uuid;

// Security settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    pub require_confirmation: bool,
    pub audit_retention_days: i32,
    pub max_file_size_mb: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityManager {
    pub settings: Option<SecuritySettings>,
    pub allowed_paths: HashSet<String>,
    pub blocked_commands: HashSet<String>,
    pub audit_logger: AuditLogger,
    pub permission_checker: PermissionChecker,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogger {
    pub database: Option<()>, // Placeholder for database connection
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionChecker {
    pub strict_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub action: String,
    pub resource: String,
    pub user_id: Option<String>,
    pub success: bool,
    pub details: serde_json::Value,
}

impl SecurityManager {
    pub fn new() -> Self {
        Self {
            settings: None,
            allowed_paths: HashSet::new(),
            blocked_commands: HashSet::new(),
            audit_logger: AuditLogger::new(),
            permission_checker: PermissionChecker::new(),
        }
    }
    
    pub async fn initialize(&mut self, settings: &SecuritySettings) -> Result<(), Box<dyn std::error::Error>> {
        self.settings = Some(settings.clone());
        
        // Initialize default allowed paths
        self.setup_default_permissions().await?;
        
        // Setup audit logging
        self.audit_logger.enabled = true;
        
        // Setup permission checker
        self.permission_checker.strict_mode = settings.require_confirmation;
        
        Ok(())
    }
    
    pub async fn update_settings(&mut self, settings: &SecuritySettings) -> Result<(), Box<dyn std::error::Error>> {
        self.settings = Some(settings.clone());
        
        // Update permission checker
        self.permission_checker.strict_mode = settings.require_confirmation;
        
        // Clean up old audit logs based on retention policy
        // TODO: Implement database cleanup when database is connected
        
        Ok(())
    }
    
    async fn setup_default_permissions(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Add default safe paths
        self.allowed_paths.insert("/Users".to_string());
        self.allowed_paths.insert("/tmp".to_string());
        self.allowed_paths.insert("/var/tmp".to_string());
        
        // Add blocked dangerous commands
        self.blocked_commands.insert("rm".to_string());
        self.blocked_commands.insert("sudo".to_string());
        self.blocked_commands.insert("su".to_string());
        self.blocked_commands.insert("chmod".to_string());
        self.blocked_commands.insert("chown".to_string());
        
        Ok(())
    }
    
    pub fn check_file_access(&self, path: &str, operation: &str) -> bool {
        // Normalize path
        let normalized_path = self.normalize_path(path);
        
        // Check if path is in allowed roots
        let is_allowed = self.allowed_paths.iter().any(|allowed_path| {
            normalized_path.starts_with(allowed_path)
        });
        
        if !is_allowed {
            self.audit_logger.log_security_event(
                "file_access_denied",
                &format!("path: {}, operation: {}", path, operation),
                None,
            );
            return false;
        }
        
        // Additional checks based on operation
        match operation {
            "read" => self.check_read_permission(&normalized_path),
            "write" => self.check_write_permission(&normalized_path),
            "execute" => self.check_execute_permission(&normalized_path),
            "delete" => self.check_delete_permission(&normalized_path),
            _ => false,
        }
    }
    
    fn normalize_path(&self, path: &str) -> String {
        // Expand ~ to home directory
        if path.starts_with("~") {
            if let Some(home_dir) = dirs::home_dir() {
                return path.replacen("~", &home_dir.to_string_lossy(), 1);
            }
        }
        
        // Resolve relative paths
        if let Ok(canonical) = Path::new(path).canonicalize() {
            canonical.to_string_lossy().to_string()
        } else {
            path.to_string()
        }
    }
    
    fn check_read_permission(&self, _path: &str) -> bool {
        // Check if file read is allowed
        // For now, allow all reads in allowed paths
        true
    }
    
    fn check_write_permission(&self, path: &str) -> bool {
        // Check if file write is allowed
        
        // Block writes to system directories
        let system_paths = [
            "/System",
            "/usr",
            "/bin",
            "/sbin",
            "/etc",
            "/var/log",
        ];
        
        for system_path in &system_paths {
            if path.starts_with(system_path) {
                return false;
            }
        }
        
        // Check file size limits if it's a new file
        if let Some(_settings) = &self.settings {
            // This would check file size against settings.max_file_size_mb
            // For now, just return true
        }
        
        true
    }
    
    fn check_execute_permission(&self, _path: &str) -> bool {
        // Check if file execution is allowed
        // This would typically be more restrictive
        false // Default deny for execution
    }
    
    fn check_delete_permission(&self, path: &str) -> bool {
        // Check if file deletion is allowed
        
        // Block deletion of important files
        let protected_patterns = [
            ".git",
            "package.json",
            "Cargo.toml",
            ".env",
        ];
        
        for pattern in &protected_patterns {
            if path.contains(pattern) {
                return false;
            }
        }
        
        true
    }
    
    pub fn check_command_permission(&self, command: &str) -> bool {
        // Check if command execution is allowed
        
        if self.blocked_commands.contains(command) {
            self.audit_logger.log_security_event(
                "command_blocked",
                &format!("command: {}", command),
                None,
            );
            return false;
        }
        
        // Additional command validation
        self.validate_command_safety(command)
    }
    
    fn validate_command_safety(&self, command: &str) -> bool {
        // Check for dangerous command patterns
        let dangerous_patterns = [
            "rm -rf /",
            ":(){ :|:& };:",  // Fork bomb
            "dd if=/dev/zero",
            "mkfs",
            "fdisk",
        ];
        
        for pattern in &dangerous_patterns {
            if command.contains(pattern) {
                self.audit_logger.log_security_event(
                    "dangerous_command_blocked",
                    &format!("command: {}, pattern: {}", command, pattern),
                    None,
                );
                return false;
            }
        }
        
        true
    }
    
    pub fn add_allowed_path(&mut self, path: String) {
        let normalized_path = self.normalize_path(&path);
        self.allowed_paths.insert(normalized_path);
        
        self.audit_logger.log_security_event(
            "allowed_path_added",
            &format!("path: {}", path),
            None,
        );
    }
    
    pub fn remove_allowed_path(&mut self, path: &str) {
        let normalized_path = self.normalize_path(path);
        self.allowed_paths.remove(&normalized_path);
        
        self.audit_logger.log_security_event(
            "allowed_path_removed",
            &format!("path: {}", path),
            None,
        );
    }
    
    pub fn get_allowed_paths(&self) -> Vec<String> {
        self.allowed_paths.iter().cloned().collect()
    }
    
    pub async fn scan_for_threats(&self, path: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut threats = Vec::new();
        
        // Check for malicious files
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let file_path = entry.path();
                    
                    if let Some(extension) = file_path.extension() {
                        // Check for suspicious file extensions
                        let suspicious_extensions = ["exe", "bat", "cmd", "scr", "pif"];
                        if suspicious_extensions.contains(&extension.to_str().unwrap_or("")) {
                            threats.push(format!("Suspicious file: {:?}", file_path));
                        }
                    }
                    
                    // Check file size
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.len() > 100 * 1024 * 1024 { // 100MB
                            threats.push(format!("Large file: {:?} ({}MB)", file_path, metadata.len() / 1024 / 1024));
                        }
                    }
                }
            }
        }
        
        Ok(threats)
    }
    
    pub async fn quarantine_file(&self, path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let quarantine_dir = self.get_quarantine_directory();
        std::fs::create_dir_all(&quarantine_dir)?;
        
        let file_name = Path::new(path).file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        let quarantine_path = quarantine_dir.join(format!("{}_{}", 
            chrono::Utc::now().timestamp(), 
            file_name
        ));
        
        std::fs::rename(path, &quarantine_path)?;
        
        self.audit_logger.log_security_event(
            "file_quarantined",
            &format!("original: {}, quarantine: {:?}", path, quarantine_path),
            None,
        );
        
        Ok(())
    }
    
    fn get_quarantine_directory(&self) -> std::path::PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| std::path::Path::new("./data").to_path_buf())
            .join("LocalBrain")
            .join("quarantine")
    }
}

impl AuditLogger {
    pub fn new() -> Self {
        Self {
            database: None,
            enabled: true,
        }
    }
    
    pub fn set_database(&mut self, database: ()) {
        self.database = Some(database);
    }
    
    pub async fn log_action(&self, action: &str, details: &str) {
        if !self.enabled {
            return;
        }
        
        let _event = AuditEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            action: action.to_string(),
            resource: "system".to_string(),
            user_id: None,
            success: true,
            details: serde_json::json!({ "details": details }),
        };
        
        // TODO: Log to database when connected
        
        // Also log to console in debug mode
        #[cfg(debug_assertions)]
        println!("AUDIT: {} - {}", action, details);
    }
    
    pub fn log_security_event(&self, action: &str, details: &str, user_id: Option<String>) {
        if !self.enabled {
            return;
        }
        
        let _event = AuditEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            action: action.to_string(),
            resource: "security".to_string(),
            user_id,
            success: false, // Security events are typically failures/blocks
            details: serde_json::json!({ "details": details }),
        };
        
        // Log security events synchronously for immediate visibility
        println!("SECURITY: {} - {}", action, details);
    }
    
    pub async fn get_audit_log(&self, _limit: Option<i64>) -> Result<Vec<AuditEvent>, Box<dyn std::error::Error>> {
        // TODO: Implement when database is connected
        Ok(vec![])
    }
}

impl PermissionChecker {
    pub fn new() -> Self {
        Self {
            strict_mode: true,
        }
    }
    
    pub fn check_resource_access(&self, resource: &str, operation: &str) -> bool {
        // Implement resource-specific permission checks
        match resource {
            "filesystem" => self.check_filesystem_permission(operation),
            "network" => self.check_network_permission(operation),
            "process" => self.check_process_permission(operation),
            "system" => self.check_system_permission(operation),
            _ => false,
        }
    }
    
    fn check_filesystem_permission(&self, operation: &str) -> bool {
        match operation {
            "read" => true,
            "write" => !self.strict_mode, // Require confirmation in strict mode
            "delete" => false, // Always require explicit permission
            _ => false,
        }
    }
    
    fn check_network_permission(&self, operation: &str) -> bool {
        match operation {
            "http_get" => true,
            "http_post" => !self.strict_mode,
            "socket" => false, // Require explicit permission
            _ => false,
        }
    }
    
    fn check_process_permission(&self, operation: &str) -> bool {
        match operation {
            "list" => true,
            "spawn" => !self.strict_mode,
            "kill" => false, // Require explicit permission
            _ => false,
        }
    }
    
    fn check_system_permission(&self, operation: &str) -> bool {
        match operation {
            "info" => true,
            "env_read" => true,
            "env_write" => false, // Require explicit permission
            _ => false,
        }
    }
}