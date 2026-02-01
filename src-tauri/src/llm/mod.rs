pub mod chat;
pub mod ollama;
pub mod safety;

use serde::Serialize;

pub use chat::ChatService;
pub use ollama::{OllamaClient, OllamaStatus};
pub use safety::{SafetyFilter, SafetyResult};

/// State for managing LLM interactions.
/// Uses Ollama as the backend for local LLM inference.
#[derive(Clone)]
pub struct LlmState {
    pub ollama: OllamaClient,
    pub safety: SafetyFilter,
}

impl LlmState {
    pub fn new() -> Result<Self, crate::error::AppError> {
        Ok(Self {
            ollama: OllamaClient::new()?,
            safety: SafetyFilter::new(),
        })
    }

    /// Check if Ollama is available and the required model is ready.
    pub async fn check_status(&self) -> OllamaStatus {
        self.ollama.check_status().await
    }
}

/// Chat message sent from or to the LLM.
#[derive(Debug, Clone, Serialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    User,
    Assistant,
    System,
}

/// Event payload for streaming chat chunks.
#[derive(Debug, Clone, Serialize)]
pub struct ChatChunkEvent {
    pub chunk: String,
    pub done: bool,
}

/// Event payload for chat errors.
#[derive(Debug, Clone, Serialize)]
pub struct ChatErrorEvent {
    pub message: String,
}
