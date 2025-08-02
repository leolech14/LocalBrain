use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use reqwest;
use std::collections::HashMap;
use base64::Engine as _;
use base64::engine::general_purpose;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub voice_enabled: bool,
    pub offline_mode: bool,
    pub allowed_roots: Vec<String>,
    pub openai_api_key: Option<String>,
    pub openai_organization_id: Option<String>,
    pub openai_model: String,
    pub tts_provider: String,
    pub stt_provider: String,
    pub theme: String,
    pub window_bounds: WindowBounds,
    pub terminal_settings: TerminalSettings,
    pub voice_settings: VoiceSettings,
    pub security_settings: SecuritySettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalSettings {
    pub shell: String,
    pub font_family: String,
    pub font_size: u32,
    pub cursor_style: String,
    pub theme: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceSettings {
    pub wake_word: String,
    pub voice_model: String,
    pub response_voice: String,
    pub auto_speak_responses: bool,
    pub noise_suppression: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecuritySettings {
    pub audit_retention_days: u32,
    pub require_confirmation: bool,
    pub sandbox_plugins: bool,
    pub max_file_size_mb: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppState {
    pub settings: AppSettings,
}

pub struct AppStateManager {
    pub state: Mutex<AppState>,
}

impl Default for AppStateManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(AppState {
                settings: AppSettings {
                    voice_enabled: true,
                    offline_mode: false,
                    allowed_roots: vec!["/Users".to_string(), "/tmp".to_string()],
                    openai_api_key: None,
                    openai_organization_id: Some("org-kMMJiRlBzjmaoZSsnapWMOrx".to_string()),
                    openai_model: crate::config::CONFIG.default_openai_chat_model.clone(),
                    tts_provider: "openai".to_string(),
                    stt_provider: "openai".to_string(),
                    theme: "dark".to_string(),
                    window_bounds: WindowBounds {
                        x: 100,
                        y: 100,
                        width: 1200,
                        height: 800,
                    },
                    terminal_settings: TerminalSettings {
                        shell: "/bin/zsh".to_string(),
                        font_family: "JetBrains Mono".to_string(),
                        font_size: 14,
                        cursor_style: "block".to_string(),
                        theme: "dark".to_string(),
                    },
                    voice_settings: VoiceSettings {
                        wake_word: crate::config::CONFIG.default_wake_word.clone(),
                        voice_model: "whisper-1".to_string(),
                        response_voice: crate::config::CONFIG.default_tts_voice.clone(),
                        auto_speak_responses: true,
                        noise_suppression: true,
                    },
                    security_settings: SecuritySettings {
                        audit_retention_days: 90,
                        require_confirmation: true,
                        sandbox_plugins: true,
                        max_file_size_mb: 100,
                    },
                },
            }),
        }
    }
}

// Get app state
#[tauri::command]
pub async fn get_app_state(state: State<'_, AppStateManager>) -> Result<ApiResponse<AppState>, String> {
    match state.state.lock() {
        Ok(app_state) => Ok(ApiResponse::success(AppState {
            settings: app_state.settings.clone(),
        })),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get app state: {}", e))),
    }
}

// Update settings
#[tauri::command]
pub async fn update_settings(
    settings: AppSettings, 
    state: State<'_, AppStateManager>,
) -> Result<ApiResponse<()>, String> {
    // Update in-memory state
    {
        match state.state.lock() {
            Ok(mut app_state) => {
                app_state.settings = settings.clone();
            }
            Err(e) => return Ok(ApiResponse::error(format!("Failed to update settings: {}", e))),
        }
    } // Lock is released here
    
    // Save individual settings to database
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.set_setting("voice_enabled", serde_json::json!(settings.voice_enabled)).await?;
            db.set_setting("offline_mode", serde_json::json!(settings.offline_mode)).await?;
            db.set_setting("allowed_roots", serde_json::json!(settings.allowed_roots)).await?;
            db.set_setting("openai_api_key", serde_json::json!(settings.openai_api_key)).await?;
            db.set_setting("openai_model", serde_json::json!(settings.openai_model)).await?;
            db.set_setting("tts_provider", serde_json::json!(settings.tts_provider)).await?;
            db.set_setting("stt_provider", serde_json::json!(settings.stt_provider)).await?;
            db.set_setting("theme", serde_json::json!(settings.theme)).await?;
            
            // Log the action
            let audit_entry = crate::database::AuditLogEntry {
                id: 0,
                timestamp: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                user_id: None,
                action: "update_settings".to_string(),
                resource: "settings".to_string(),
                details: serde_json::json!({}),
                success: true,
                error_message: None,
            };
            db.log_action(audit_entry).await?;
            Ok(())
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to save settings: {}", e))),
    }
}

// Send chat message
#[tauri::command]
pub async fn send_chat_message(
    message: String,
    context: Option<String>,
    state: State<'_, AppStateManager>,
) -> Result<ApiResponse<String>, String> {
    println!("send_chat_message called with message: {}", message);
    
    // Add debug output at the start
    if let Ok(env_key) = std::env::var("OPENAI_API_KEY") {
        println!("Environment API key present: {}", !env_key.is_empty());
    } else {
        println!("No environment API key found");
    }
    
    let settings = match state.state.lock() {
        Ok(app_state) => app_state.settings.clone(),
        Err(e) => return Ok(ApiResponse::error(format!("Failed to get settings: {}", e))),
    };

    println!("Settings retrieved. Offline mode: {}, API key present: {}", 
             settings.offline_mode, 
             settings.openai_api_key.is_some());

    if settings.offline_mode {
        // Use Ollama for offline mode
        let ollama = crate::ollama::OllamaClient::new(None);
        
        // Check if Ollama is available
        if !ollama.is_available().await {
            return Ok(ApiResponse::error(
                "Ollama is not running. Please start Ollama to use offline mode.".to_string()
            ));
        }
        
        // Use llama3 model by default, but this should be configurable
        match ollama.generate(&crate::config::CONFIG.default_ollama_model, &message, 0.7).await {
            Ok(response) => {
                // Log audit (removed old database call)
                return Ok(ApiResponse::success(response));
            }
            Err(e) => {
                return Ok(ApiResponse::error(format!("Ollama error: {}", e)));
            }
        }
    }

    // Check if API key is set (first from settings, then from environment)
    let api_key = match settings.openai_api_key {
        Some(key) => key,
        None => {
            // Try to get from environment
            match crate::config::get_openai_api_key() {
                Some(key) => key,
                None => return Ok(ApiResponse::error(
                    "OpenAI API key not configured. Please add it in Settings or set OPENAI_API_KEY environment variable.".to_string()
                )),
            }
        }
    };

    // Call OpenAI API
    let client = reqwest::Client::new();
    let mut messages = vec![
        serde_json::json!({
            "role": "system",
            "content": "You are LocalBrain, an AI-powered local environment command center. You help users with coding, system administration, and productivity tasks."
        }),
    ];

    if let Some(ctx) = context {
        messages.push(serde_json::json!({
            "role": "system",
            "content": ctx
        }));
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": message
    }));

    let url = format!("{}{}", crate::config::CONFIG.api.openai_base_url, crate::config::CONFIG.api.openai_chat_endpoint);
    let mut req = client.post(&url)
        .header("Authorization", format!("Bearer {}", api_key));
    
    // Add organization ID if present
    if let Some(org_id) = &settings.openai_organization_id {
        req = req.header("OpenAI-Organization", org_id);
    }
    
    let response = req
        .json(&serde_json::json!({
            "model": if settings.openai_model == "o3" { "gpt-4" } else { &settings.openai_model },
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2000,
        }))
        .send()
        .await;

    match response {
        Ok(res) => {
            let status = res.status();
            println!("OpenAI API response status: {}", status);
            
            if status.is_success() {
                match res.json::<serde_json::Value>().await {
                    Ok(data) => {
                        println!("OpenAI API response data: {:?}", data);
                        
                        if let Some(content) = data["choices"][0]["message"]["content"].as_str() {
                            // Log successful chat interaction (removed old database call)
                            Ok(ApiResponse::success(content.to_string()))
                        } else {
                            Ok(ApiResponse::error("Invalid response format".to_string()))
                        }
                    }
                    Err(e) => Ok(ApiResponse::error(format!("Failed to parse response: {}", e))),
                }
            } else {
                let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                println!("OpenAI API error response: {}", error_text);
                Ok(ApiResponse::error(format!("API error: {} - {}", status, error_text)))
            }
        }
        Err(e) => {
            println!("Network error calling OpenAI: {}", e);
            Ok(ApiResponse::error(format!("Network error: {}", e)))
        },
    }
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppStateManager>) -> Result<serde_json::Value, String> {
    let settings = state.state.lock()
        .map_err(|e| format!("Failed to get settings: {}", e))?
        .settings.clone();
    
    Ok(serde_json::json!({
        "voice_enabled": settings.voice_enabled,
        "offline_mode": settings.offline_mode,
        "allowed_roots": settings.allowed_roots,
        "openai_api_key": settings.openai_api_key,
        "openai_organization_id": settings.openai_organization_id,
        "openai_model": settings.openai_model,
        "tts_provider": settings.tts_provider,
        "stt_provider": settings.stt_provider,
        "theme": settings.theme,
        "window_bounds": settings.window_bounds,
        "terminal_settings": settings.terminal_settings,
        "voice_settings": settings.voice_settings,
        "security_settings": settings.security_settings,
    }))
}

// Chat completion command that matches frontend expectations
#[tauri::command]
pub async fn chat_completion(
    request: serde_json::Value,
    state: State<'_, AppStateManager>,
) -> Result<serde_json::Value, String> {
    let settings = state.state.lock()
        .map_err(|e| format!("Failed to get settings: {}", e))?
        .settings.clone();

    if settings.offline_mode {
        // Use Ollama for offline mode
        // TODO: Implement Ollama chat completion
        return Err("Offline mode chat not yet implemented".to_string());
    }

    let api_key = settings.openai_api_key
        .ok_or_else(|| "OpenAI API key not configured".to_string())?;

    let messages = request["messages"].clone();
    let model = request["model"].as_str().unwrap_or(&settings.openai_model);
    let temperature = request["temperature"].as_f64().unwrap_or(0.7);
    let max_tokens = request["max_tokens"].as_u64().unwrap_or(4000);

    // Use gpt-4 if o3 is requested (since o3 requires org verification)
    let actual_model = if model == "o3" { "gpt-4" } else { model };

    println!("Chat completion request with model: {} (actual: {})", model, actual_model);

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", api_key).parse().unwrap());
    headers.insert("Content-Type", "application/json".parse().unwrap());
    
    // Add organization ID if present
    if let Some(org_id) = &settings.openai_organization_id {
        headers.insert("OpenAI-Organization", org_id.parse().unwrap());
    }
    
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .headers(headers)
        .json(&serde_json::json!({
            "model": actual_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = res.status();
    if status.is_success() {
        let response_text = res.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        
        let data: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if let Some(content) = data["choices"][0]["message"]["content"].as_str() {
            let usage = data["usage"].clone();
            
            Ok(serde_json::json!({
                "content": content,
                "model": actual_model,
                "usage": usage,
                "provider": "openai"
            }))
        } else {
            Err("Invalid response format".to_string())
        }
    } else {
        let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("API error: {} - {}", status, error_text))
    }
}

// File system operations
#[tauri::command]
pub fn read_directory(path: String, state: State<AppStateManager>) -> ApiResponse<Vec<FileInfo>> {
    use std::fs;
    
    let settings = match state.state.lock() {
        Ok(app_state) => app_state.settings.clone(),
        Err(e) => return ApiResponse::error(format!("Failed to get settings: {}", e)),
    };
    
    // Check if path is allowed
    let is_allowed = settings.allowed_roots.iter().any(|root| path.starts_with(root));
    if !is_allowed {
        return ApiResponse::error("Access denied: Path not in allowed roots".to_string());
    }
    
    match fs::read_dir(&path) {
        Ok(entries) => {
            let mut files = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        files.push(FileInfo {
                            name: entry.file_name().to_string_lossy().to_string(),
                            path: entry.path().to_string_lossy().to_string(),
                            is_dir: metadata.is_dir(),
                            size: metadata.len(),
                        });
                    }
                }
            }
            ApiResponse::success(files)
        }
        Err(e) => ApiResponse::error(format!("Failed to read directory: {}", e)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

// Read file content
#[tauri::command]
pub fn read_file(path: String, state: State<AppStateManager>) -> ApiResponse<String> {
    use std::fs;
    
    let settings = match state.state.lock() {
        Ok(app_state) => app_state.settings.clone(),
        Err(e) => return ApiResponse::error(format!("Failed to get settings: {}", e)),
    };
    
    // Check if path is allowed
    let is_allowed = settings.allowed_roots.iter().any(|root| path.starts_with(root));
    if !is_allowed {
        return ApiResponse::error("Access denied: Path not in allowed roots".to_string());
    }
    
    match fs::read_to_string(&path) {
        Ok(content) => ApiResponse::success(content),
        Err(e) => ApiResponse::error(format!("Failed to read file: {}", e)),
    }
}

// Write file content
#[tauri::command]
pub fn write_file(path: String, content: String, state: State<AppStateManager>) -> ApiResponse<()> {
    use std::fs;
    
    let settings = match state.state.lock() {
        Ok(app_state) => app_state.settings.clone(),
        Err(e) => return ApiResponse::error(format!("Failed to get settings: {}", e)),
    };
    
    // Check if path is allowed
    let is_allowed = settings.allowed_roots.iter().any(|root| path.starts_with(root));
    if !is_allowed {
        return ApiResponse::error("Access denied: Path not in allowed roots".to_string());
    }
    
    match fs::write(&path, content) {
        Ok(_) => ApiResponse::success(()),
        Err(e) => ApiResponse::error(format!("Failed to write file: {}", e)),
    }
}

// Delete file or directory
#[tauri::command]
pub fn delete_file(path: String, state: State<AppStateManager>) -> ApiResponse<()> {
    use std::fs;

    let settings = match state.state.lock() {
        Ok(app_state) => app_state.settings.clone(),
        Err(e) => return ApiResponse::error(format!("Failed to get settings: {}", e)),
    };

    // Check if path is allowed
    let is_allowed = settings.allowed_roots.iter().any(|root| path.starts_with(root));
    if !is_allowed {
        return ApiResponse::error("Access denied: Path not in allowed roots".to_string());
    }

    // Determine if path is a directory
    let result = match fs::metadata(&path) {
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(&path),
        Ok(_) => fs::remove_file(&path),
        Err(e) => return ApiResponse::error(format!("Failed to access path: {}", e)),
    };

    match result {
        Ok(_) => ApiResponse::success(()),
        Err(e) => ApiResponse::error(format!("Failed to delete file: {}", e)),
    }
}

// Terminal commands
#[tauri::command]
pub async fn create_terminal(config: HashMap<String, String>) -> ApiResponse<String> {
    let _shell = config.get("shell").cloned().unwrap_or_else(|| {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    });
    let _working_dir = config.get("workingDir").cloned().unwrap_or_else(|| {
        std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
    });
    
    match crate::terminal::with_terminal_manager(|manager| {
        Box::pin(async move {
            manager.create_session(config).await
        })
    }).await {
        Ok(session_id) => {
            // Log audit (removed old database call)
            ApiResponse::success(session_id)
        }
        Err(e) => ApiResponse::error(format!("Terminal manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn close_terminal(terminalId: String) -> ApiResponse<()> {
    match crate::terminal::with_terminal_manager(|manager| {
        let terminal_id = terminalId.clone();
        Box::pin(async move {
            manager.close_session(&terminal_id).await
        })
    }).await {
        Ok(_) => {
            // Log audit (removed old database call)
            ApiResponse::success(())
        }
        Err(e) => ApiResponse::error(format!("Terminal manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn terminal_send_input(sessionId: String, input: String) -> ApiResponse<()> {
    match crate::terminal::with_terminal_manager(|manager| {
        let session_id = sessionId.clone();
        let input = input.clone();
        Box::pin(async move {
            manager.write_to_session(&session_id, &input).await
        })
    }).await {
        Ok(_) => ApiResponse::success(()),
        Err(e) => ApiResponse::error(format!("Terminal manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn terminal_resize(sessionId: String, cols: u16, rows: u16) -> ApiResponse<()> {
    match crate::terminal::with_terminal_manager(|manager| {
        let session_id = sessionId.clone();
        Box::pin(async move {
            manager.resize_session(&session_id, cols, rows).await
        })
    }).await {
        Ok(_) => ApiResponse::success(()),
        Err(e) => ApiResponse::error(format!("Terminal manager error: {}", e)),
    }
}

// Voice commands
#[tauri::command]
pub async fn start_voice_session(config: HashMap<String, String>) -> ApiResponse<String> {
    let voice_config = crate::voice::VoiceSessionConfig {
        mode: config.get("mode").cloned().unwrap_or_else(|| "chain".to_string()),
        stt_provider: config.get("stt_provider").cloned().unwrap_or_else(|| "openai".to_string()),
        tts_provider: config.get("tts_provider").cloned().unwrap_or_else(|| "openai".to_string()),
        voice_model: config.get("voice_model").cloned().unwrap_or_else(|| "whisper-1".to_string()),
        response_voice: config.get("response_voice").cloned().unwrap_or_else(|| "maple".to_string()),
    };
    
    match crate::voice::with_voice_manager(|manager| {
        Box::pin(async move {
            manager.create_session(voice_config).await
        })
    }).await {
        Ok(session_id) => {
            // Log audit (removed old database call)
            ApiResponse::success(session_id)
        }
        Err(e) => ApiResponse::error(format!("Voice manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn stop_voice_session(session_id: String) -> ApiResponse<()> {
    match crate::voice::with_voice_manager(|manager| {
        let session_id = session_id.clone();
        Box::pin(async move {
            manager.stop_session(&session_id).await
        })
    }).await {
        Ok(_) => {
            // Log audit (removed old database call)
            ApiResponse::success(())
        }
        Err(e) => ApiResponse::error(format!("Voice manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn speak_text(text: String, options: HashMap<String, String>) -> ApiResponse<Vec<u8>> {
    match crate::voice::with_voice_manager(|manager| {
        let text = text.clone();
        let options = options.clone();
        Box::pin(async move {
            manager.speak_text(&text, &options).await
        })
    }).await {
        Ok(audio_data) => {
            // Log audit (removed old database call)
            ApiResponse::success(audio_data)
        }
        Err(e) => ApiResponse::error(format!("Voice manager error: {}", e)),
    }
}

#[tauri::command]
pub async fn voice_add_audio_chunk(session_id: String, audio_data: Vec<u8>) -> ApiResponse<()> {
    match crate::voice::with_voice_manager(|manager| {
        let session_id = session_id.clone();
        Box::pin(async move {
            manager.add_audio_chunk(&session_id, audio_data).await
        })
    }).await {
        Ok(_) => ApiResponse::success(()),
        Err(e) => ApiResponse::error(format!("Voice manager error: {}", e)),
    }
}

// Context management commands
#[tauri::command]
pub async fn save_context(id: String, name: String, content: String, context_type: String) -> Result<ApiResponse<()>, String> {
    let context = crate::database::ChatContext {
        id: id.clone(),
        name: name.clone(),
        context_type: context_type.clone(),
        data: serde_json::json!({
            "content": content
        }),
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        updated_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };
    
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.save_context(context).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to save context: {}", e))),
    }
}

#[tauri::command]
pub async fn load_context(id: String) -> Result<ApiResponse<crate::database::ChatContext>, String> {
    let id_clone = id.clone();
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.get_context(&id_clone).await
        })
    }).await {
        Ok(Some(context)) => Ok(ApiResponse::success(context)),
        Ok(None) => Ok(ApiResponse::error(format!("Context not found: {}", id))),
        Err(e) => Ok(ApiResponse::error(format!("Failed to load context: {}", e))),
    }
}

#[tauri::command]
pub async fn list_contexts(context_type: Option<String>) -> Result<ApiResponse<Vec<crate::database::ChatContext>>, String> {
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.list_contexts(context_type.as_deref()).await
        })
    }).await {
        Ok(contexts) => Ok(ApiResponse::success(contexts)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to list contexts: {}", e))),
    }
}

#[tauri::command]
pub async fn delete_context(id: String) -> Result<ApiResponse<()>, String> {
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.delete_context(&id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to delete context: {}", e))),
    }
}

#[tauri::command]
pub async fn get_audit_logs(limit: i32) -> Result<ApiResponse<Vec<crate::database::AuditLogEntry>>, String> {
    match crate::database::with_database(|db| {
        Box::pin(async move {
            db.get_audit_logs(Some(limit as usize)).await
        })
    }).await {
        Ok(logs) => Ok(ApiResponse::success(logs)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get audit logs: {}", e))),
    }
}

// Git commands
#[tauri::command]
pub fn get_git_file_status(file_path: String) -> ApiResponse<Option<crate::git::GitFileStatus>> {
    match crate::git::with_git_manager(|manager| {
        manager.get_file_status(std::path::Path::new(&file_path))
    }) {
        Ok(status) => ApiResponse::success(status),
        Err(e) => ApiResponse::error(format!("Failed to get git status: {}", e)),
    }
}

#[tauri::command]
pub fn get_git_directory_status(dir_path: String) -> ApiResponse<Vec<crate::git::GitFileStatus>> {
    match crate::git::with_git_manager(|manager| {
        manager.get_directory_status(std::path::Path::new(&dir_path))
    }) {
        Ok(statuses) => ApiResponse::success(statuses),
        Err(e) => ApiResponse::error(format!("Failed to get git directory status: {}", e)),
    }
}

#[tauri::command]
pub fn get_git_repository_info(path: String) -> ApiResponse<crate::git::GitRepositoryInfo> {
    match crate::git::with_git_manager(|manager| {
        manager.get_repository_info(std::path::Path::new(&path))
    }) {
        Ok(info) => ApiResponse::success(info),
        Err(e) => ApiResponse::error(format!("Failed to get git repository info: {}", e)),
    }
}

// Plugin commands
#[tauri::command]
pub async fn load_plugin(plugin_path: String) -> Result<ApiResponse<String>, String> {
    match crate::plugin_system::with_plugin_system(|system| {
        Box::pin(async move {
            system.load_plugin(std::path::Path::new(&plugin_path)).await
        })
    }).await {
        Ok(plugin_id) => Ok(ApiResponse::success(plugin_id)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to load plugin: {}", e))),
    }
}

#[tauri::command]
pub async fn unload_plugin(plugin_id: String) -> Result<ApiResponse<()>, String> {
    match crate::plugin_system::with_plugin_system(|system| {
        Box::pin(async move {
            system.unload_plugin(&plugin_id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to unload plugin: {}", e))),
    }
}

#[tauri::command]
pub async fn execute_plugin(plugin_id: String, action: String, params: serde_json::Value) -> Result<ApiResponse<serde_json::Value>, String> {
    match crate::plugin_system::with_plugin_system(|system| {
        Box::pin(async move {
            system.execute_plugin(&plugin_id, &action, params).await
        })
    }).await {
        Ok(result) => Ok(ApiResponse::success(result)),
        Err(e) => Ok(ApiResponse::error(format!("Plugin execution failed: {}", e))),
    }
}

#[tauri::command]
pub async fn list_plugins() -> Result<ApiResponse<Vec<crate::plugin_system::PluginManifest>>, String> {
    match crate::plugin_system::with_plugin_system(|system| {
        Box::pin(async move {
            Ok(system.list_plugins().await)
        })
    }).await {
        Ok(plugins) => Ok(ApiResponse::success(plugins)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to list plugins: {}", e))),
    }
}

// Agent commands
#[tauri::command]
pub async fn create_agent_workflow(name: String, description: String) -> Result<ApiResponse<String>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            system.create_workflow(name, description).await
        })
    }).await {
        Ok(workflow_id) => Ok(ApiResponse::success(workflow_id)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to create workflow: {}", e))),
    }
}

#[tauri::command]
pub async fn get_agent_workflow(workflow_id: String) -> Result<ApiResponse<crate::agents::AgentWorkflow>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            system.get_workflow(&workflow_id).await
        })
    }).await {
        Ok(workflow) => Ok(ApiResponse::success(workflow)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get workflow: {}", e))),
    }
}

#[tauri::command]
pub async fn update_agent_workflow(workflow: crate::agents::AgentWorkflow) -> Result<ApiResponse<()>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            system.update_workflow(workflow).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to update workflow: {}", e))),
    }
}

#[tauri::command]
pub async fn list_agent_workflows() -> Result<ApiResponse<Vec<crate::agents::AgentWorkflow>>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            Ok(system.list_workflows().await)
        })
    }).await {
        Ok(workflows) => Ok(ApiResponse::success(workflows)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to list workflows: {}", e))),
    }
}

#[tauri::command]
pub async fn execute_agent_workflow(workflow_id: String, input: serde_json::Value) -> Result<ApiResponse<serde_json::Value>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            system.execute_workflow(&workflow_id, input).await
        })
    }).await {
        Ok(result) => Ok(ApiResponse::success(result)),
        Err(e) => Ok(ApiResponse::error(format!("Workflow execution failed: {}", e))),
    }
}

#[tauri::command]
pub async fn get_available_agents() -> Result<ApiResponse<Vec<(String, String, crate::agents::AgentType)>>, String> {
    match crate::agents::with_agent_system(|system| {
        Box::pin(async move {
            Ok(system.get_available_agents())
        })
    }).await {
        Ok(agents) => Ok(ApiResponse::success(agents)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get available agents: {}", e))),
    }
}

// Tool commands
#[tauri::command]
pub async fn list_tools(category: Option<String>) -> Result<ApiResponse<Vec<crate::tools::Tool>>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            Ok(manager.list_tools(category.as_deref()).await)
        })
    }).await {
        Ok(tools) => Ok(ApiResponse::success(tools)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to list tools: {}", e))),
    }
}

#[tauri::command]
pub async fn get_tool(tool_id: String) -> Result<ApiResponse<crate::tools::Tool>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            manager.get_tool(&tool_id).await
                .ok_or_else(|| anyhow::anyhow!("Tool not found"))
        })
    }).await {
        Ok(tool) => Ok(ApiResponse::success(tool)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get tool: {}", e))),
    }
}

#[tauri::command]
pub async fn install_tool(tool_id: String) -> Result<ApiResponse<()>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            manager.install_tool(&tool_id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to install tool: {}", e))),
    }
}

#[tauri::command]
pub async fn uninstall_tool(tool_id: String) -> Result<ApiResponse<()>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            manager.uninstall_tool(&tool_id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to uninstall tool: {}", e))),
    }
}

#[tauri::command]
pub async fn execute_tool(tool_id: String, command: String, args: Vec<String>, options: HashMap<String, String>) -> Result<ApiResponse<crate::tools::ToolResult>, String> {
    let execution = crate::tools::ToolExecution {
        tool_id,
        command,
        args,
        working_dir: options.get("workingDir").cloned(),
        env_vars: options.get("envVars")
            .and_then(|v| serde_json::from_str::<HashMap<String, String>>(v).ok())
            .unwrap_or_default(),
        timeout: options.get("timeout")
            .and_then(|v| v.parse::<u64>().ok()),
    };
    
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            manager.execute_tool(execution).await
        })
    }).await {
        Ok(result) => Ok(ApiResponse::success(result)),
        Err(e) => Ok(ApiResponse::error(format!("Tool execution failed: {}", e))),
    }
}

#[tauri::command]
pub async fn get_tool_categories() -> Result<ApiResponse<Vec<(String, usize)>>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            Ok(manager.get_categories().await)
        })
    }).await {
        Ok(categories) => Ok(ApiResponse::success(categories)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get categories: {}", e))),
    }
}

#[tauri::command]
pub async fn search_tools(query: String) -> Result<ApiResponse<Vec<crate::tools::Tool>>, String> {
    match crate::tools::with_tools_manager(|manager| {
        Box::pin(async move {
            Ok(manager.search_tools(&query).await)
        })
    }).await {
        Ok(tools) => Ok(ApiResponse::success(tools)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to search tools: {}", e))),
    }
}

// Knowledge commands
#[tauri::command]
pub async fn get_knowledge_items() -> Result<ApiResponse<Vec<crate::knowledge::KnowledgeItem>>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.get_items().await
        })
    }).await {
        Ok(items) => Ok(ApiResponse::success(items)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get knowledge items: {}", e))),
    }
}

#[tauri::command]
pub async fn get_knowledge_item(item_id: String) -> Result<ApiResponse<crate::knowledge::KnowledgeItem>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.get_item(&item_id).await
                .ok_or_else(|| anyhow::anyhow!("Item not found"))
        })
    }).await {
        Ok(item) => Ok(ApiResponse::success(item)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get knowledge item: {}", e))),
    }
}

#[tauri::command]
pub async fn read_knowledge_content(item_id: String) -> Result<ApiResponse<String>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.read_item_content(&item_id).await
        })
    }).await {
        Ok(content) => Ok(ApiResponse::success(content)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to read content: {}", e))),
    }
}

#[tauri::command]
pub async fn create_knowledge_folder(name: String, parent_path: Option<String>) -> Result<ApiResponse<crate::knowledge::KnowledgeItem>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            let parent = parent_path.as_ref().map(|p| std::path::Path::new(p));
            manager.create_folder(parent, &name).await
        })
    }).await {
        Ok(folder) => Ok(ApiResponse::success(folder)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to create folder: {}", e))),
    }
}

#[tauri::command]
pub async fn upload_knowledge_file(file_name: String, content: Vec<u8>, parent_path: Option<String>) -> Result<ApiResponse<crate::knowledge::KnowledgeItem>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            let parent = parent_path.as_ref().map(|p| std::path::Path::new(p));
            manager.upload_file(parent, &file_name, content).await
        })
    }).await {
        Ok(file) => Ok(ApiResponse::success(file)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to upload file: {}", e))),
    }
}

#[tauri::command]
pub async fn delete_knowledge_item(item_id: String) -> Result<ApiResponse<()>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.delete_item(&item_id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to delete item: {}", e))),
    }
}

#[tauri::command]
pub async fn update_knowledge_tags(item_id: String, tags: Vec<String>) -> Result<ApiResponse<()>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.update_item_tags(&item_id, tags).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to update tags: {}", e))),
    }
}

#[tauri::command]
pub async fn toggle_knowledge_star(item_id: String) -> Result<ApiResponse<bool>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.toggle_star(&item_id).await
        })
    }).await {
        Ok(starred) => Ok(ApiResponse::success(starred)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to toggle star: {}", e))),
    }
}

#[tauri::command]
pub async fn toggle_knowledge_private(item_id: String) -> Result<ApiResponse<bool>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.toggle_private(&item_id).await
        })
    }).await {
        Ok(private) => Ok(ApiResponse::success(private)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to toggle private: {}", e))),
    }
}

#[tauri::command]
pub async fn vectorize_knowledge_item(item_id: String) -> Result<ApiResponse<()>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.vectorize_item(&item_id).await
        })
    }).await {
        Ok(_) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(format!("Failed to vectorize item: {}", e))),
    }
}

#[tauri::command]
pub async fn search_similar_knowledge(item_id: String, limit: usize) -> Result<ApiResponse<Vec<(String, f32)>>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.search_similar(&item_id, limit).await
        })
    }).await {
        Ok(similar) => Ok(ApiResponse::success(similar)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to search similar: {}", e))),
    }
}

#[tauri::command]
pub async fn get_knowledge_storage_info() -> Result<ApiResponse<crate::knowledge::StorageInfo>, String> {
    match crate::knowledge::with_knowledge_manager(|manager| {
        Box::pin(async move {
            manager.get_storage_info().await
        })
    }).await {
        Ok(info) => Ok(ApiResponse::success(info)),
        Err(e) => Ok(ApiResponse::error(format!("Failed to get storage info: {}", e))),
    }
}

// Transcribe audio command
#[tauri::command]
pub async fn transcribe_audio(audio_data: String, state: State<'_, AppStateManager>) -> Result<String, String> {
    // Decode base64 audio data
    let audio_bytes = match general_purpose::STANDARD.decode(&audio_data) {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to decode audio data: {}", e)),
    };
    
    // Get settings for voice configuration
    let settings = state.state.lock()
        .map_err(|e| format!("Failed to get settings: {}", e))?
        .settings.clone();
    
    // Create voice session config
    let voice_config = crate::voice::VoiceSessionConfig {
        mode: "chain".to_string(),
        stt_provider: settings.stt_provider.clone(),
        tts_provider: settings.tts_provider.clone(),
        voice_model: settings.voice_settings.voice_model.clone(),
        response_voice: settings.voice_settings.response_voice.clone(),
    };
    
    // Transcribe using voice manager
    match crate::voice::with_voice_manager(|manager| {
        Box::pin(async move {
            // Set API key if available
            if let Some(api_key) = &settings.openai_api_key {
                manager.set_api_key(Some(api_key.clone()));
            }
            
            // Set organization ID if available
            if let Some(org_id) = &settings.openai_organization_id {
                manager.set_organization_id(Some(org_id.clone()));
            }
            
            // Use the transcribe_with_api method (we'll need to make it public)
            let transcript = manager.transcribe_audio(&audio_bytes, &voice_config).await?;
            Ok(transcript)
        })
    }).await {
        Ok(transcript) => Ok(transcript),
        Err(e) => Err(format!("Failed to transcribe audio: {}", e)),
    }
}

// Simple greet command
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to LocalBrain.", name)
}

// Realtime Voice Commands
#[tauri::command]
pub async fn create_realtime_session(
    config: crate::realtime_voice::RealtimeConfig,
) -> Result<ApiResponse<String>, String> {
    let result = crate::realtime_voice::with_realtime_manager(|manager| {
        let config = config.clone();
        Box::pin(async move {
            manager.create_session(config).await
        })
    }).await;
    
    match result {
        Ok(session_id) => Ok(ApiResponse::success(session_id)),
        Err(e) => Ok(ApiResponse::error(e.to_string())),
    }
}

#[tauri::command]
pub async fn send_realtime_audio(
    session_id: String,
    audio_data: Vec<u8>,
) -> Result<ApiResponse<()>, String> {
    let result = crate::realtime_voice::with_realtime_manager(|manager| {
        let session_id = session_id.clone();
        let audio_data = audio_data.clone();
        Box::pin(async move {
            manager.send_audio(&session_id, audio_data).await
        })
    }).await;
    
    match result {
        Ok(()) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(e.to_string())),
    }
}

#[tauri::command]
pub async fn wake_up_realtime_session(
    session_id: String,
) -> Result<ApiResponse<()>, String> {
    let result = crate::realtime_voice::with_realtime_manager(|manager| {
        let session_id = session_id.clone();
        Box::pin(async move {
            manager.wake_up(&session_id).await
        })
    }).await;
    
    match result {
        Ok(()) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(e.to_string())),
    }
}

#[tauri::command]
pub async fn close_realtime_session(
    session_id: String,
) -> Result<ApiResponse<()>, String> {
    let result = crate::realtime_voice::with_realtime_manager(|manager| {
        let session_id = session_id.clone();
        Box::pin(async move {
            manager.close_session(&session_id).await
        })
    }).await;
    
    match result {
        Ok(()) => Ok(ApiResponse::success(())),
        Err(e) => Ok(ApiResponse::error(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_available_tools() -> Result<ApiResponse<Vec<serde_json::Value>>, String> {
    let result = crate::realtime_voice::with_realtime_manager(|manager| {
        let registry = manager.tool_registry.clone();
        Box::pin(async move {
            Ok(registry.get_tool_definitions().await)
        })
    }).await;
    
    match result {
        Ok(tools) => Ok(ApiResponse::success(tools)),
        Err(e) => Ok(ApiResponse::error(e.to_string())),
    }
}