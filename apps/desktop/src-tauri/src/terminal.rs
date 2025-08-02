use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::Read;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub pid: Option<u32>,
    pub status: String,
    pub working_directory: String,
}

#[derive(Debug)]
pub enum TerminalCommand {
    Write(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

pub struct TerminalHandle {
    pub session: TerminalSession,
    pub command_sender: mpsc::UnboundedSender<TerminalCommand>,
}

pub struct TerminalManager {
    sessions: Arc<RwLock<HashMap<String, TerminalHandle>>>,
    app_handle: AppHandle,
}

impl TerminalManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
        }
    }

    pub async fn create_session(&self, config: HashMap<String, String>) -> Result<String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let shell = config.get("shell").cloned()
            .unwrap_or_else(|| std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string()));
        let working_dir = config.get("workingDir").cloned()
            .unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()));
        
        println!("Creating terminal session {} with shell: {} in dir: {}", session_id, shell, working_dir);
        
        // Create PTY
        let pty_system = native_pty_system();
        let pty_pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        
        // Create command channel
        let (tx, mut rx) = mpsc::unbounded_channel::<TerminalCommand>();
        
        // Create session
        let session = TerminalSession {
            id: session_id.clone(),
            pid: None,
            status: "running".to_string(),
            working_directory: working_dir.clone(),
        };
        
        // Spawn shell process
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&working_dir);
        let child = pty_pair.slave.spawn_command(cmd)?;
        
        println!("Successfully spawned shell process");
        
        // Get process ID if available
        let pid = child.process_id();
        let mut session_with_pid = session.clone();
        session_with_pid.pid = pid;
        
        // Create handle
        let handle = TerminalHandle {
            session: session_with_pid.clone(),
            command_sender: tx.clone(),
        };
        
        // Store session
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), handle);
        }
        
        // Spawn PTY handler task
        let app_handle = self.app_handle.clone();
        let session_id_clone = session_id.clone();
        let sessions = self.sessions.clone();
        
        tokio::spawn(async move {
            let master = pty_pair.master;
            
            // Get writer before spawning tasks
            let mut writer = master.take_writer()?;
            
            // Spawn reader task
            let app_handle_reader = app_handle.clone();
            let session_id_reader = session_id_clone.clone();
            let mut master_reader = master.try_clone_reader()?;
            
            tokio::task::spawn_blocking(move || {
                let mut buffer = [0u8; 4096];
                loop {
                    match master_reader.read(&mut buffer) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            let data = buffer[..n].to_vec();
                            let output = String::from_utf8_lossy(&data).to_string();
                            println!("Terminal output for {}: {:?}", session_id_reader, output);
                            let _ = app_handle_reader.emit(
                                &format!("terminal-output-{}", session_id_reader),
                                output
                            );
                        }
                        Err(e) => {
                            eprintln!("Terminal read error: {}", e);
                            break;
                        }
                    }
                }
            });
            
            // Handle commands
            while let Some(cmd) = rx.recv().await {
                match cmd {
                    TerminalCommand::Write(data) => {
                        use std::io::Write;
                        if let Err(e) = writer.write_all(&data) {
                            eprintln!("Failed to write to terminal: {}", e);
                        }
                    }
                    TerminalCommand::Resize { cols, rows } => {
                        let size = PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        };
                        if let Err(e) = master.resize(size) {
                            eprintln!("Failed to resize terminal: {}", e);
                        }
                    }
                    TerminalCommand::Close => {
                        break;
                    }
                }
            }
            
            // Clean up session
            let mut sessions = sessions.write().await;
            sessions.remove(&session_id_clone);
            
            Ok::<(), anyhow::Error>(())
        });
        
        Ok(session_id)
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(handle) = sessions.get(session_id) {
            handle.command_sender.send(TerminalCommand::Close)?;
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }

    pub async fn write_to_session(&self, session_id: &str, data: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(handle) = sessions.get(session_id) {
            handle.command_sender.send(TerminalCommand::Write(data.as_bytes().to_vec()))?;
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }

    pub async fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        let sessions = self.sessions.read().await;
        if let Some(handle) = sessions.get(session_id) {
            handle.command_sender.send(TerminalCommand::Resize { cols, rows })?;
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }

    pub async fn get_session(&self, session_id: &str) -> Result<TerminalSession> {
        let sessions = self.sessions.read().await;
        if let Some(handle) = sessions.get(session_id) {
            Ok(handle.session.clone())
        } else {
            Err(anyhow!("Session not found"))
        }
    }

    pub async fn list_sessions(&self) -> Result<Vec<TerminalSession>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.values().map(|h| h.session.clone()).collect())
    }
}

// Global terminal manager instance
use once_cell::sync::Lazy;

static TERMINAL_MANAGER: Lazy<Arc<Mutex<Option<TerminalManager>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

pub async fn initialize_terminal_manager(app_handle: AppHandle) -> Result<()> {
    let manager = TerminalManager::new(app_handle);
    *TERMINAL_MANAGER.lock().await = Some(manager);
    Ok(())
}

pub async fn with_terminal_manager<F, R>(f: F) -> Result<R>
where
    F: FnOnce(&TerminalManager) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R>> + Send + '_>>,
{
    let guard = TERMINAL_MANAGER.lock().await;
    match guard.as_ref() {
        Some(manager) => f(manager).await,
        None => Err(anyhow!("Terminal manager not initialized")),
    }
}