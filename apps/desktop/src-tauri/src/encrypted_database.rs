use anyhow::{anyhow, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};
use ring::pbkdf2;
use std::num::NonZeroU32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: JsonValue,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: i64,
    pub timestamp: String,
    pub user_id: Option<String>,
    pub action: String,
    pub resource: String,
    pub details: JsonValue,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub id: String,
    pub name: String,
    pub context_type: String,
    pub data: JsonValue,
    pub created_at: String,
    pub updated_at: String,
}

pub struct EncryptedDatabase {
    conn: Arc<Mutex<Connection>>,
}

impl EncryptedDatabase {
    pub async fn new(app_data_dir: PathBuf) -> Result<Self> {
        // Ensure the directory exists
        std::fs::create_dir_all(&app_data_dir)?;
        
        let db_path = app_data_dir.join("localbrain_encrypted.db");
        
        // Open connection
        let conn = Connection::open(&db_path)?;
        
        // Get or create encryption key
        let key = Self::get_or_create_key(&app_data_dir)?;
        
        // Set encryption key using SQLCipher
        conn.execute(&format!("PRAGMA key = '{}'", key), [])?;
        
        // Verify the key is correct by trying a simple query
        match conn.execute("SELECT count(*) FROM sqlite_master", []) {
            Ok(_) => {},
            Err(_) => {
                // Wrong key or corrupted database
                return Err(anyhow!("Failed to decrypt database - invalid key or corrupted data"));
            }
        }
        
        // Set SQLCipher configuration for better security
        conn.execute("PRAGMA cipher_page_size = 4096", [])?;
        conn.execute("PRAGMA kdf_iter = 256000", [])?;
        conn.execute("PRAGMA cipher_hmac_algorithm = HMAC_SHA512", [])?;
        conn.execute("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512", [])?;
        
        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        // Create tables
        Self::create_tables(&conn)?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }
    
    /// Get or create the encryption key for the database
    fn get_or_create_key(app_data_dir: &PathBuf) -> Result<String> {
        let key_path = app_data_dir.join(".localbrain_key");
        
        if key_path.exists() {
            // Read existing key
            let encoded_key = std::fs::read_to_string(&key_path)?;
            Ok(encoded_key.trim().to_string())
        } else {
            // Generate new key
            let mut key_data = [0u8; 32];
            ring::rand::SecureRandom::fill(&ring::rand::SystemRandom::new(), &mut key_data)
                .map_err(|_| anyhow!("Failed to generate random key"))?;
            
            // Encode as hex string for SQLCipher
            let key = hex::encode(&key_data);
            
            // Save key with restricted permissions
            std::fs::write(&key_path, &key)?;
            
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&key_path)?.permissions();
                perms.set_mode(0o600); // Read/write for owner only
                std::fs::set_permissions(&key_path, perms)?;
            }
            
            Ok(key)
        }
    }
    
    /// Re-encrypt the database with a new key
    pub async fn rekey(&self, new_password: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().await;
        
        if let Some(password) = new_password {
            // Derive key from password using PBKDF2
            let salt = b"localbrain_salt_v1"; // In production, use a random salt
            let iterations = NonZeroU32::new(100_000).unwrap();
            let mut key = [0u8; 32];
            
            pbkdf2::derive(
                pbkdf2::PBKDF2_HMAC_SHA256,
                iterations,
                salt,
                password.as_bytes(),
                &mut key,
            );
            
            let hex_key = hex::encode(&key);
            conn.execute(&format!("PRAGMA rekey = '{}'", hex_key), [])?;
        } else {
            // Generate new random key
            let mut key_data = [0u8; 32];
            ring::rand::SecureRandom::fill(&ring::rand::SystemRandom::new(), &mut key_data)
                .map_err(|_| anyhow!("Failed to generate random key"))?;
            
            let hex_key = hex::encode(&key_data);
            conn.execute(&format!("PRAGMA rekey = '{}'", hex_key), [])?;
        }
        
        Ok(())
    }
    
    /// Export database to unencrypted format (for backups)
    pub async fn export_unencrypted(&self, export_path: PathBuf) -> Result<()> {
        let conn = self.conn.lock().await;
        
        // Attach the export database
        conn.execute(
            &format!("ATTACH DATABASE '{}' AS export KEY ''", export_path.display()),
            [],
        )?;
        
        // Export schema and data
        conn.execute("SELECT sqlcipher_export('export')", [])?;
        
        // Detach the export database
        conn.execute("DETACH DATABASE export", [])?;
        
        Ok(())
    }
    
    fn create_tables(conn: &Connection) -> Result<()> {
        // Settings table with encryption for sensitive values
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                is_sensitive BOOLEAN NOT NULL DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        
        // Audit log table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id TEXT,
                action TEXT NOT NULL,
                resource TEXT NOT NULL,
                details TEXT,
                success BOOLEAN NOT NULL DEFAULT 1,
                error_message TEXT
            )",
            [],
        )?;
        
        // Context storage table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS context_storage (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                context_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        
        // Plugin registry table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                manifest TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 0,
                installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        
        // API keys table (stores encrypted keys)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                key_name TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME,
                expires_at DATETIME
            )",
            [],
        )?;
        
        // Create indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_context_type ON context_storage(context_type)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider)",
            [],
        )?;
        
        Ok(())
    }
    
    // Settings operations with encryption for sensitive values
    pub async fn save_setting(&self, key: &str, value: JsonValue, is_sensitive: bool) -> Result<()> {
        let conn = self.conn.lock().await;
        
        let value_str = if is_sensitive {
            // Additional encryption layer for sensitive settings
            let encrypted = self.encrypt_value(&serde_json::to_string(&value)?)?;
            encrypted
        } else {
            serde_json::to_string(&value)?
        };
        
        conn.execute(
            "INSERT INTO settings (key, value, is_sensitive, updated_at) 
             VALUES (?1, ?2, ?3, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value,
                is_sensitive = excluded.is_sensitive,
                updated_at = excluded.updated_at",
            params![key, value_str, is_sensitive],
        )?;
        
        Ok(())
    }
    
    pub async fn get_setting(&self, key: &str) -> Result<Option<Setting>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT key, value, is_sensitive, updated_at FROM settings WHERE key = ?1"
        )?;
        
        let result = stmt.query_row(params![key], |row| {
            let is_sensitive: bool = row.get(2)?;
            let value_str: String = row.get(1)?;
            
            let value = if is_sensitive {
                // Decrypt sensitive values
                match self.decrypt_value(&value_str) {
                    Ok(decrypted) => serde_json::from_str(&decrypted).unwrap_or(JsonValue::Null),
                    Err(_) => JsonValue::Null,
                }
            } else {
                serde_json::from_str(&value_str).unwrap_or(JsonValue::Null)
            };
            
            Ok(Setting {
                key: row.get(0)?,
                value,
                updated_at: row.get(3)?,
            })
        }).optional()?;
        
        Ok(result)
    }
    
    // API Key management with encryption
    pub async fn save_api_key(&self, provider: &str, key_name: &str, api_key: &str) -> Result<()> {
        let conn = self.conn.lock().await;
        let encrypted_key = self.encrypt_value(api_key)?;
        let id = uuid::Uuid::new_v4().to_string();
        
        conn.execute(
            "INSERT INTO api_keys (id, provider, key_name, encrypted_key, created_at) 
             VALUES (?1, ?2, ?3, ?4, datetime('now'))",
            params![id, provider, key_name, encrypted_key],
        )?;
        
        Ok(())
    }
    
    pub async fn get_api_key(&self, provider: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT encrypted_key FROM api_keys WHERE provider = ?1 ORDER BY created_at DESC LIMIT 1"
        )?;
        
        let result = stmt.query_row(params![provider], |row| {
            let encrypted: String = row.get(0)?;
            Ok(encrypted)
        }).optional()?;
        
        match result {
            Some(encrypted) => Ok(Some(self.decrypt_value(&encrypted)?)),
            None => Ok(None),
        }
    }
    
    // Audit log operations
    pub async fn add_audit_log(&self, entry: AuditLogEntry) -> Result<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT INTO audit_log (timestamp, user_id, action, resource, details, success, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                entry.timestamp,
                entry.user_id,
                entry.action,
                entry.resource,
                serde_json::to_string(&entry.details)?,
                entry.success,
                entry.error_message,
            ],
        )?;
        
        Ok(())
    }
    
    pub async fn cleanup_old_audit_logs(&self, days_to_keep: i64) -> Result<usize> {
        let conn = self.conn.lock().await;
        let cutoff_date = Utc::now() - chrono::Duration::days(days_to_keep);
        
        let count = conn.execute(
            "DELETE FROM audit_log WHERE timestamp < ?1",
            params![cutoff_date.to_rfc3339()],
        )?;
        
        Ok(count)
    }
    
    // Additional encryption layer for ultra-sensitive data
    fn encrypt_value(&self, value: &str) -> Result<String> {
        // In production, use a proper encryption library like sodiumoxide
        // This is a placeholder that just base64 encodes
        Ok(general_purpose::STANDARD.encode(value))
    }
    
    fn decrypt_value(&self, encrypted: &str) -> Result<String> {
        // In production, use a proper encryption library like sodiumoxide
        // This is a placeholder that just base64 decodes
        let decoded = general_purpose::STANDARD.decode(encrypted)?;
        Ok(String::from_utf8(decoded)?)
    }
}