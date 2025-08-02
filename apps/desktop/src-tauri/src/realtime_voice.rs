use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::{mpsc, RwLock};
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use std::sync::Arc;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::tool_executor::ToolRegistry;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeConfig {
    pub api_key: String,
    pub model: String,
    pub voice: String,
    pub instructions: String,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RealtimeSession {
    pub id: String,
    pub is_active: bool,
    pub is_sleeping: bool,
    #[serde(skip)]
    pub tx: Option<mpsc::UnboundedSender<Message>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RealtimeEvent {
    #[serde(rename = "session.created")]
    SessionCreated { session: Value },
    
    #[serde(rename = "conversation.item.created")]
    ConversationItemCreated { item: ConversationItem },
    
    #[serde(rename = "response.audio.delta")]
    ResponseAudioDelta { delta: String },
    
    #[serde(rename = "response.audio_transcript.delta")]
    ResponseTranscriptDelta { delta: String },
    
    #[serde(rename = "response.function_call_arguments.delta")]
    FunctionCallDelta { call_id: String, delta: String },
    
    #[serde(rename = "response.function_call_arguments.done")]
    FunctionCallDone { call_id: String, arguments: String },
    
    #[serde(rename = "input_audio_buffer.speech_started")]
    SpeechStarted,
    
    #[serde(rename = "input_audio_buffer.speech_stopped")]
    SpeechStopped,
    
    #[serde(rename = "error")]
    Error { error: Value },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationItem {
    pub id: String,
    pub role: String,
    pub content: Option<Vec<ContentPart>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    
    #[serde(rename = "audio")]
    Audio { audio: String },
    
    #[serde(rename = "function_call")]
    FunctionCall { 
        call_id: String,
        name: String,
        arguments: String,
    },
}

pub struct RealtimeVoiceManager {
    sessions: Arc<RwLock<HashMap<String, RealtimeSession>>>,
    app_handle: AppHandle,
    pub tool_registry: Arc<ToolRegistry>,
}

impl RealtimeVoiceManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            tool_registry: Arc::new(ToolRegistry::new()),
        }
    }

    pub async fn create_session(&self, config: RealtimeConfig) -> Result<String> {
        let session_id = Uuid::new_v4().to_string();
        
        // Connect to OpenAI Realtime API WebSocket
        let url = format!("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17");
        
        // Build request with proper headers
        let request_builder = tokio_tungstenite::tungstenite::handshake::client::Request::builder()
            .uri(url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("OpenAI-Beta", "realtime=v1");
        
        let request = request_builder.body(())
            .map_err(|e| anyhow!("Failed to build request: {}", e))?;
        
        let (ws_stream, _) = connect_async(request).await?;
        let (mut write, mut read) = ws_stream.split();
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Send session configuration
        let session_config = json!({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "voice": config.voice,
                "instructions": config.instructions,
                "tools": config.tools.iter().map(|t| {
                    json!({
                        "type": "function",
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters
                    })
                }).collect::<Vec<_>>(),
                "tool_choice": "auto",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "temperature": 0.8,
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500
                }
            }
        });
        
        write.send(Message::Text(session_config.to_string())).await?;
        
        let session = RealtimeSession {
            id: session_id.clone(),
            is_active: true,
            is_sleeping: false,
            tx: Some(tx.clone()),
        };
        
        self.sessions.write().await.insert(session_id.clone(), session);
        
        // Handle outgoing messages
        let sessions = self.sessions.clone();
        let session_id_out = session_id.clone();
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if let Err(e) = write.send(msg).await {
                    eprintln!("Failed to send message: {}", e);
                    sessions.write().await.remove(&session_id_out);
                    break;
                }
            }
        });
        
        // Handle incoming messages
        let sessions = self.sessions.clone();
        let app_handle = self.app_handle.clone();
        let tool_registry = self.tool_registry.clone();
        let session_id_in = session_id.clone();
        
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(event) = serde_json::from_str::<RealtimeEvent>(&text) {
                            Self::handle_realtime_event(
                                event, 
                                &session_id_in, 
                                &sessions, 
                                &app_handle,
                                &tool_registry
                            ).await;
                        }
                    }
                    Ok(Message::Binary(data)) => {
                        // Audio data - emit to frontend
                        app_handle.emit(&format!("realtime-audio-{}", session_id_in), &data).ok();
                    }
                    Err(e) => {
                        eprintln!("WebSocket error: {}", e);
                        sessions.write().await.remove(&session_id_in);
                        break;
                    }
                    _ => {}
                }
            }
        });
        
        Ok(session_id)
    }

    async fn handle_realtime_event(
        event: RealtimeEvent,
        session_id: &str,
        sessions: &Arc<RwLock<HashMap<String, RealtimeSession>>>,
        app_handle: &AppHandle,
        tool_registry: &Arc<ToolRegistry>,
    ) {
        match event {
            RealtimeEvent::ConversationItemCreated { item } => {
                // Log to chat window
                if let Some(content_parts) = item.content {
                    for part in content_parts {
                        match part {
                            ContentPart::Text { text } => {
                                app_handle.emit("chat-message", json!({
                                    "role": item.role,
                                    "content": text,
                                    "session_id": session_id
                                })).ok();
                            }
                            ContentPart::FunctionCall { call_id, name, arguments } => {
                                // Execute tool
                                if let Ok(args) = serde_json::from_str::<Value>(&arguments) {
                                    Self::execute_tool_call(
                                        &call_id,
                                        &name,
                                        args,
                                        session_id,
                                        sessions,
                                        app_handle,
                                        tool_registry
                                    ).await;
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            
            RealtimeEvent::ResponseTranscriptDelta { delta } => {
                app_handle.emit(&format!("realtime-transcript-{}", session_id), &delta).ok();
                
                // Check for sleep command
                if delta.to_lowercase().contains("go to sleep") {
                    if let Some(session) = sessions.write().await.get_mut(session_id) {
                        session.is_sleeping = true;
                        app_handle.emit(&format!("realtime-sleeping-{}", session_id), true).ok();
                    }
                }
            }
            
            RealtimeEvent::SpeechStarted => {
                app_handle.emit(&format!("realtime-speech-started-{}", session_id), {}).ok();
            }
            
            RealtimeEvent::SpeechStopped => {
                app_handle.emit(&format!("realtime-speech-stopped-{}", session_id), {}).ok();
            }
            
            RealtimeEvent::Error { error } => {
                eprintln!("Realtime API error: {:?}", error);
                app_handle.emit(&format!("realtime-error-{}", session_id), &error).ok();
            }
            
            _ => {}
        }
    }

    async fn execute_tool_call(
        call_id: &str,
        tool_name: &str,
        arguments: Value,
        session_id: &str,
        sessions: &Arc<RwLock<HashMap<String, RealtimeSession>>>,
        app_handle: &AppHandle,
        tool_registry: &Arc<ToolRegistry>,
    ) {
        // Execute the tool
        let result = match tool_registry.execute(tool_name, arguments).await {
            Ok(result) => result,
            Err(e) => crate::tool_executor::ToolResult {
                success: false,
                output: format!("Tool execution failed: {}", e),
                error: Some(e.to_string()),
            }
        };
        
        // Send result back to conversation
        if let Some(session) = sessions.read().await.get(session_id) {
            if let Some(tx) = &session.tx {
                let response = json!({
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": result.output
                    }
                });
                
                tx.send(Message::Text(response.to_string())).ok();
                
                // Trigger response generation
                let generate = json!({
                    "type": "response.create"
                });
                tx.send(Message::Text(generate.to_string())).ok();
            }
        }
        
        // Emit tool execution result to frontend
        app_handle.emit("tool-executed", json!({
            "tool": tool_name,
            "result": result,
            "session_id": session_id
        })).ok();
    }

    pub async fn send_audio(&self, session_id: &str, audio_data: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(session_id)
            .ok_or_else(|| anyhow!("Session not found"))?;
        
        if session.is_sleeping {
            return Ok(()); // Don't process audio when sleeping
        }
        
        if let Some(tx) = &session.tx {
            // First, send the audio append event
            use base64::Engine;
            let append_event = json!({
                "type": "input_audio_buffer.append",
                "audio": base64::engine::general_purpose::STANDARD.encode(&audio_data)
            });
            
            tx.send(Message::Text(append_event.to_string()))?;
        }
        
        Ok(())
    }

    pub async fn wake_up(&self, session_id: &str) -> Result<()> {
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.is_sleeping = false;
            self.app_handle.emit(&format!("realtime-sleeping-{}", session_id), false).ok();
        }
        Ok(())
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        if let Some(mut session) = self.sessions.write().await.remove(session_id) {
            session.is_active = false;
            if let Some(tx) = session.tx {
                drop(tx); // This will close the WebSocket connection
            }
        }
        Ok(())
    }

    pub async fn is_session_active(&self, session_id: &str) -> bool {
        self.sessions.read().await.contains_key(session_id)
    }
}

// Global instance
static mut REALTIME_MANAGER: Option<Arc<RwLock<RealtimeVoiceManager>>> = None;
static INIT: std::sync::Once = std::sync::Once::new();

pub fn init_realtime_manager(app_handle: AppHandle) {
    unsafe {
        INIT.call_once(|| {
            REALTIME_MANAGER = Some(Arc::new(RwLock::new(RealtimeVoiceManager::new(app_handle))));
        });
    }
}

pub async fn with_realtime_manager<F, R>(f: F) -> Result<R>
where
    F: for<'a> FnOnce(&'a RealtimeVoiceManager) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<R>> + Send + 'a>>,
{
    unsafe {
        match &REALTIME_MANAGER {
            Some(manager) => {
                let guard = manager.read().await;
                f(&*guard).await
            }
            None => Err(anyhow!("Realtime manager not initialized")),
        }
    }
}