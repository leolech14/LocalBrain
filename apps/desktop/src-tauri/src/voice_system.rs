use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use crate::whisper::WhisperCpp;
use crate::piper::PiperTts;
use crate::config;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub stt_provider: String, // "openai" or "whisper-cpp"
    pub tts_provider: String, // "openai" or "piper"
    pub voice_model: String, // "whisper-1" for OpenAI, "base" for whisper-cpp
    pub tts_voice: String, // "alloy" for OpenAI, "en_US-amy-low" for Piper
    pub language: String, // "en", "es", etc.
    pub wake_word: String, // "hey brain"
    pub audio_format: String, // "webm", "wav", "mp3"
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            stt_provider: "openai".to_string(),
            tts_provider: "openai".to_string(),
            voice_model: "whisper-1".to_string(),
            tts_voice: "alloy".to_string(),
            language: "en".to_string(),
            wake_word: "hey brain".to_string(),
            audio_format: "webm".to_string(),
        }
    }
}

#[derive(Debug)]
pub struct VoiceSession {
    pub id: String,
    pub config: VoiceConfig,
    pub is_active: bool,
    pub audio_buffer: Vec<u8>,
    pub wake_word_detected: bool,
    pub conversation_active: bool,
}

pub struct EnhancedVoiceManager {
    sessions: Arc<RwLock<HashMap<String, Arc<Mutex<VoiceSession>>>>>,
    app_handle: AppHandle,
    whisper_cpp: Option<WhisperCpp>,
    piper_tts: Option<PiperTts>,
    api_key: Option<String>,
    organization_id: Option<String>,
    models_dir: PathBuf,
}

impl EnhancedVoiceManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let models_dir = dirs::data_dir()
            .map(|d| d.join("LocalBrain").join("models"))
            .unwrap_or_else(|| PathBuf::from("./models"));
        
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            whisper_cpp: None,
            piper_tts: None,
            api_key: None,
            organization_id: None,
            models_dir,
        }
    }
    
    pub fn set_api_credentials(&mut self, api_key: Option<String>, organization_id: Option<String>) {
        self.api_key = api_key;
        self.organization_id = organization_id;
    }
    
    pub async fn initialize_local_models(&mut self) -> Result<()> {
        // Create models directory if it doesn't exist
        std::fs::create_dir_all(&self.models_dir)?;
        
        // Initialize Whisper.cpp if available
        let whisper_model_path = self.models_dir.join("ggml-base.bin");
        if !whisper_model_path.exists() {
            println!("Downloading Whisper model...");
            WhisperCpp::download_model("base", &self.models_dir).await?;
        }
        
        match WhisperCpp::new(whisper_model_path) {
            Ok(whisper) => {
                self.whisper_cpp = Some(whisper);
                println!("Whisper.cpp initialized successfully");
            }
            Err(e) => {
                println!("Warning: Whisper.cpp not available: {}", e);
            }
        }
        
        // Initialize Piper TTS if available
        let piper_model_path = self.models_dir.join("en_US-amy-low.onnx");
        let piper_config_path = self.models_dir.join("en_US-amy-low.onnx.json");
        
        if !piper_model_path.exists() || !piper_config_path.exists() {
            println!("Downloading Piper voice model...");
            PiperTts::download_voice("en_US-amy-low", &self.models_dir).await?;
        }
        
        match PiperTts::new(piper_model_path, piper_config_path) {
            Ok(piper) => {
                self.piper_tts = Some(piper);
                println!("Piper TTS initialized successfully");
            }
            Err(e) => {
                println!("Warning: Piper TTS not available: {}", e);
            }
        }
        
        Ok(())
    }
    
    pub async fn create_session(&self, config: VoiceConfig) -> Result<String> {
        let session_id = format!("voice_{}", chrono::Utc::now().timestamp_millis());
        
        let session = Arc::new(Mutex::new(VoiceSession {
            id: session_id.clone(),
            config,
            is_active: true,
            audio_buffer: Vec::new(),
            wake_word_detected: false,
            conversation_active: false,
        }));

        self.sessions.write().await.insert(session_id.clone(), session.clone());
        
        // Emit session started event
        self.app_handle.emit("voice-session-started", serde_json::json!({
            "session_id": session_id,
            "config": session.lock().await.config.clone()
        }))?;
        
        Ok(session_id)
    }
    
    pub async fn stop_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        if let Some(session) = sessions.get(session_id) {
            let mut session_lock = session.lock().await;
            session_lock.is_active = false;
            
            // Process any remaining audio
            if !session_lock.audio_buffer.is_empty() {
                let config = session_lock.config.clone();
                let audio_data = session_lock.audio_buffer.clone();
                drop(session_lock);
                
                // Transcribe the buffered audio
                if let Ok(transcript) = self.transcribe_audio(&audio_data, &config).await {
                    self.app_handle.emit("voice-transcript", serde_json::json!({
                        "session_id": session_id,
                        "transcript": transcript,
                        "is_final": true
                    }))?;
                }
            }
        }
        
        sessions.remove(session_id);
        
        // Emit session stopped event
        self.app_handle.emit("voice-session-stopped", &session_id)?;
        
        Ok(())
    }
    
    pub async fn add_audio_chunk(&self, session_id: &str, audio_data: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            let mut session_lock = session.lock().await;
            
            if !session_lock.is_active {
                return Err(anyhow!("Session is not active"));
            }
            
            // Add to buffer
            session_lock.audio_buffer.extend_from_slice(&audio_data);
            
            // Process based on buffer size (approximately 1 second of audio)
            let buffer_threshold = match session_lock.config.audio_format.as_str() {
                "webm" => 16000, // Approximate for webm
                "wav" => 32000,  // 16kHz * 2 bytes per sample
                _ => 16000,
            };
            
            if session_lock.audio_buffer.len() >= buffer_threshold {
                let config = session_lock.config.clone();
                let audio_to_process = session_lock.audio_buffer.clone();
                let wake_word = config.wake_word.clone();
                let wake_word_detected = session_lock.wake_word_detected;
                let conversation_active = session_lock.conversation_active;
                session_lock.audio_buffer.clear();
                
                drop(session_lock);
                
                // Process audio in background
                let app_handle = self.app_handle.clone();
                let session_id_clone = session_id.to_string();
                let manager = self.clone_for_task();
                
                tokio::spawn(async move {
                    match manager.transcribe_audio(&audio_to_process, &config).await {
                        Ok(transcript) => {
                            let transcript_lower = transcript.to_lowercase();
                            
                            // Check for wake word if not already in conversation
                            if !conversation_active && !wake_word_detected {
                                if transcript_lower.contains(&wake_word.to_lowercase()) {
                                    // Wake word detected!
                                    let _ = app_handle.emit("wake-word-detected", serde_json::json!({
                                        "session_id": session_id_clone,
                                        "wake_word": wake_word
                                    }));
                                    
                                    // Update session state
                                    if let Some(session) = manager.sessions.read().await.get(&session_id_clone) {
                                        let mut session_lock = session.lock().await;
                                        session_lock.wake_word_detected = true;
                                        session_lock.conversation_active = true;
                                    }
                                    
                                    // Extract command after wake word
                                    let command = transcript_lower
                                        .split(&wake_word.to_lowercase())
                                        .nth(1)
                                        .unwrap_or("")
                                        .trim();
                                    
                                    if !command.is_empty() {
                                        let _ = app_handle.emit("voice-command", serde_json::json!({
                                            "session_id": session_id_clone,
                                            "command": command,
                                            "full_transcript": transcript
                                        }));
                                    }
                                }
                            } else if conversation_active {
                                // In active conversation, all transcripts are commands
                                let _ = app_handle.emit("voice-command", serde_json::json!({
                                    "session_id": session_id_clone,
                                    "command": transcript.trim(),
                                    "full_transcript": transcript
                                }));
                            }
                            
                            // Always emit transcript for debugging
                            let _ = app_handle.emit("voice-transcript", serde_json::json!({
                                "session_id": session_id_clone,
                                "transcript": transcript,
                                "is_final": false
                            }));
                        }
                        Err(e) => {
                            let _ = app_handle.emit("voice-error", serde_json::json!({
                                "session_id": session_id_clone,
                                "error": e.to_string()
                            }));
                        }
                    }
                });
            }
            
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }
    
    pub async fn end_conversation(&self, session_id: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            let mut session_lock = session.lock().await;
            session_lock.conversation_active = false;
            session_lock.wake_word_detected = false;
            
            self.app_handle.emit("conversation-ended", serde_json::json!({
                "session_id": session_id
            }))?;
            
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }
    
    pub async fn transcribe_audio(&self, audio_data: &[u8], config: &VoiceConfig) -> Result<String> {
        match config.stt_provider.as_str() {
            "openai" => self.transcribe_with_openai(audio_data, config).await,
            "whisper-cpp" => self.transcribe_with_whisper_cpp(audio_data, config).await,
            _ => Err(anyhow!("Unknown STT provider: {}", config.stt_provider)),
        }
    }
    
    async fn transcribe_with_openai(&self, audio_data: &[u8], config: &VoiceConfig) -> Result<String> {
        let api_key = self.api_key.clone()
            .or_else(|| config::get_openai_api_key())
            .ok_or_else(|| anyhow!("OpenAI API key not configured"))?;
        
        // Create form data
        let form = reqwest::multipart::Form::new()
            .text("model", config.voice_model.clone())
            .text("response_format", "json")
            .text("language", config.language.clone())
            .part("file", reqwest::multipart::Part::bytes(audio_data.to_vec())
                .file_name(format!("audio.{}", config.audio_format))
                .mime_str(&format!("audio/{}", config.audio_format))?);
        
        let client = reqwest::Client::new();
        let url = "https://api.openai.com/v1/audio/transcriptions";
        
        let mut req = client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key));
        
        if let Some(org_id) = &self.organization_id {
            req = req.header("OpenAI-Organization", org_id);
        }
        
        let response = req.multipart(form).send().await?;
        
        if response.status().is_success() {
            let result: serde_json::Value = response.json().await?;
            if let Some(text) = result["text"].as_str() {
                Ok(text.to_string())
            } else {
                Err(anyhow!("Invalid response format from Whisper API"))
            }
        } else {
            let error_text = response.text().await?;
            Err(anyhow!("Whisper API error: {}", error_text))
        }
    }
    
    async fn transcribe_with_whisper_cpp(&self, audio_data: &[u8], config: &VoiceConfig) -> Result<String> {
        let whisper = self.whisper_cpp.as_ref()
            .ok_or_else(|| anyhow!("Whisper.cpp not initialized"))?;
        
        let result = whisper.transcribe(audio_data, Some(&config.language)).await?;
        Ok(result.text)
    }
    
    pub async fn synthesize_speech(&self, text: &str, config: &VoiceConfig) -> Result<Vec<u8>> {
        match config.tts_provider.as_str() {
            "openai" => self.synthesize_with_openai(text, config).await,
            "piper" => self.synthesize_with_piper(text, config).await,
            _ => Err(anyhow!("Unknown TTS provider: {}", config.tts_provider)),
        }
    }
    
    async fn synthesize_with_openai(&self, text: &str, config: &VoiceConfig) -> Result<Vec<u8>> {
        let api_key = self.api_key.clone()
            .or_else(|| config::get_openai_api_key())
            .ok_or_else(|| anyhow!("OpenAI API key not configured"))?;
        
        let client = reqwest::Client::new();
        let url = "https://api.openai.com/v1/audio/speech";
        
        let mut req = client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json");
        
        if let Some(org_id) = &self.organization_id {
            req = req.header("OpenAI-Organization", org_id);
        }
        
        let body = serde_json::json!({
            "model": "tts-1",
            "input": text,
            "voice": config.tts_voice,
            "response_format": "mp3"
        });
        
        let response = req.json(&body).send().await?;
        
        if response.status().is_success() {
            let audio_data = response.bytes().await?;
            Ok(audio_data.to_vec())
        } else {
            let error_text = response.text().await?;
            Err(anyhow!("OpenAI TTS error: {}", error_text))
        }
    }
    
    async fn synthesize_with_piper(&self, text: &str, config: &VoiceConfig) -> Result<Vec<u8>> {
        let _piper = self.piper_tts.as_ref()
            .ok_or_else(|| anyhow!("Piper TTS not initialized"))?;
        
        // Map voice name if needed
        let voice_name = match config.tts_voice.as_str() {
            "amy" => "en_US-amy-low",
            "danny" => "en_US-danny-low",
            "alan" => "en_GB-alan-low",
            _ => &config.tts_voice,
        };
        
        // Check if we need to download a different voice
        let (model_path, config_path) = PiperTts::download_voice(voice_name, &self.models_dir).await?;
        let piper = PiperTts::new(model_path, config_path)?;
        
        piper.synthesize(text, "mp3").await
    }
    
    pub async fn speak_text(&self, session_id: &str, text: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            let config = session.lock().await.config.clone();
            
            // Synthesize speech
            let audio_data = self.synthesize_speech(text, &config).await?;
            
            // Convert to base64 for frontend playback
            let audio_base64 = general_purpose::STANDARD.encode(&audio_data);
            
            // Emit audio data for playback
            self.app_handle.emit("voice-response", serde_json::json!({
                "session_id": session_id,
                "text": text,
                "audio_data": audio_base64,
                "audio_format": "mp3"
            }))?;
            
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }
    
    fn clone_for_task(&self) -> Self {
        Self {
            sessions: self.sessions.clone(),
            app_handle: self.app_handle.clone(),
            whisper_cpp: self.whisper_cpp.clone(),
            piper_tts: self.piper_tts.clone(),
            api_key: self.api_key.clone(),
            organization_id: self.organization_id.clone(),
            models_dir: self.models_dir.clone(),
        }
    }
}

// Commands for Tauri
pub mod commands {
    use super::*;
    use tauri::State;
    
    #[tauri::command]
    pub async fn voice_create_session(
        config: VoiceConfig,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<String, String> {
        let manager = voice_manager.lock().await;
        manager.create_session(config).await
            .map_err(|e| e.to_string())
    }
    
    #[tauri::command]
    pub async fn voice_stop_session(
        session_id: String,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<(), String> {
        let manager = voice_manager.lock().await;
        manager.stop_session(&session_id).await
            .map_err(|e| e.to_string())
    }
    
    #[tauri::command]
    pub async fn enhanced_voice_add_audio_chunk(
        session_id: String,
        audio_data: Vec<u8>,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<(), String> {
        let manager = voice_manager.lock().await;
        manager.add_audio_chunk(&session_id, audio_data).await
            .map_err(|e| e.to_string())
    }
    
    #[tauri::command]
    pub async fn voice_speak_text(
        session_id: String,
        text: String,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<(), String> {
        let manager = voice_manager.lock().await;
        manager.speak_text(&session_id, &text).await
            .map_err(|e| e.to_string())
    }
    
    #[tauri::command]
    pub async fn voice_end_conversation(
        session_id: String,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<(), String> {
        let manager = voice_manager.lock().await;
        manager.end_conversation(&session_id).await
            .map_err(|e| e.to_string())
    }
    
    #[tauri::command]
    pub async fn enhanced_transcribe_audio(
        audio_data: Vec<u8>,
        voice_manager: State<'_, Arc<Mutex<EnhancedVoiceManager>>>,
    ) -> Result<serde_json::Value, String> {
        let manager = voice_manager.lock().await;
        let config = VoiceConfig::default();
        
        match manager.transcribe_audio(&audio_data, &config).await {
            Ok(text) => Ok(serde_json::json!({ "text": text })),
            Err(e) => Err(e.to_string())
        }
    }
}