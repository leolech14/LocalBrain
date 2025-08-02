use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub openai_base_url: String,
    pub openai_chat_endpoint: String,
    pub openai_stt_endpoint: String,
    pub openai_tts_endpoint: String,
    pub ollama_base_url: String,
    pub localbrain_docs_base_url: String,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            openai_base_url: env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com".to_string()),
            openai_chat_endpoint: env::var("OPENAI_CHAT_ENDPOINT")
                .unwrap_or_else(|_| "/v1/chat/completions".to_string()),
            openai_stt_endpoint: env::var("OPENAI_STT_ENDPOINT")
                .unwrap_or_else(|_| "/v1/audio/transcriptions".to_string()),
            openai_tts_endpoint: env::var("OPENAI_TTS_ENDPOINT")
                .unwrap_or_else(|_| "/v1/audio/speech".to_string()),
            ollama_base_url: env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            localbrain_docs_base_url: env::var("LOCALBRAIN_DOCS_URL")
                .unwrap_or_else(|_| "https://docs.localbrain.ai".to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api: ApiConfig,
    pub default_openai_model: String,
    pub default_openai_chat_model: String,
    pub default_ollama_model: String,
    pub default_tts_voice: String,
    pub default_wake_word: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api: ApiConfig::default(),
            default_openai_model: env::var("DEFAULT_OPENAI_MODEL")
                .unwrap_or_else(|_| "gpt-4o".to_string()),
            default_openai_chat_model: env::var("DEFAULT_OPENAI_CHAT_MODEL")
                .unwrap_or_else(|_| "gpt-4o".to_string()), // Use gpt-4o for chat
            default_ollama_model: env::var("DEFAULT_OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama3:8b".to_string()),
            default_tts_voice: env::var("DEFAULT_TTS_VOICE")
                .unwrap_or_else(|_| "maple".to_string()),
            default_wake_word: env::var("DEFAULT_WAKE_WORD")
                .unwrap_or_else(|_| "Hey Brain".to_string()),
        }
    }
}

// Global configuration instance
use once_cell::sync::Lazy;

pub static CONFIG: Lazy<Config> = Lazy::new(Config::default);

// Helper function to get OpenAI API key from environment
pub fn get_openai_api_key() -> Option<String> {
    env::var("OPENAI_API_KEY").ok()
}