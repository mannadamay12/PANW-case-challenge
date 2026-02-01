use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::error::AppError;

/// Default Ollama API endpoint.
const OLLAMA_BASE_URL: &str = "http://localhost:11434";

/// The model we use for chat completions.
pub const CHAT_MODEL: &str = "gemma3:4b";

/// Client for interacting with Ollama's HTTP API.
#[derive(Clone)]
pub struct OllamaClient {
    client: Client,
    base_url: String,
}

impl OllamaClient {
    pub fn new() -> Self {
        Self::with_base_url(OLLAMA_BASE_URL.to_string())
    }

    pub fn with_base_url(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    /// Check if Ollama is running and if the required model is available.
    pub async fn check_status(&self) -> OllamaStatus {
        // Check if Ollama is reachable
        let is_running = match self.client.get(&self.base_url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        };

        if !is_running {
            return OllamaStatus {
                is_running: false,
                model_available: false,
                model_name: CHAT_MODEL.to_string(),
                error: Some("Ollama is not running. Start it with 'ollama serve'.".to_string()),
            };
        }

        // Check if the model is available
        let model_available = match self.list_models().await {
            Ok(models) => models.iter().any(|m| {
                m.name
                    .starts_with(CHAT_MODEL.split(':').next().unwrap_or(CHAT_MODEL))
            }),
            Err(_) => false,
        };

        let error = if !model_available {
            Some(format!(
                "Model '{}' not found. Run 'ollama pull {}'.",
                CHAT_MODEL, CHAT_MODEL
            ))
        } else {
            None
        };

        OllamaStatus {
            is_running,
            model_available,
            model_name: CHAT_MODEL.to_string(),
            error,
        }
    }

    /// List available models in Ollama.
    async fn list_models(&self) -> Result<Vec<OllamaModel>, AppError> {
        let url = format!("{}/api/tags", self.base_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to list models: {}", e)))?;

        let tags: TagsResponse = resp
            .json()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to parse models response: {}", e)))?;

        Ok(tags.models)
    }

    /// Send a chat completion request and stream the response.
    /// Returns an async stream of response chunks.
    pub async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<impl futures::Stream<Item = Result<ChatStreamChunk, AppError>>, AppError> {
        let url = format!("{}/api/chat", self.base_url);

        let request = ChatRequest {
            model: CHAT_MODEL.to_string(),
            messages,
            stream: true,
            options: Some(ChatOptions {
                temperature: 0.7,
                top_p: 0.9,
                num_predict: 512,
            }),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to start chat: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Llm(format!(
                "Ollama returned error {}: {}",
                status, body
            )));
        }

        let stream = response.bytes_stream().map(|result| {
            result
                .map_err(|e| AppError::Llm(format!("Stream error: {}", e)))
                .map(|bytes| {
                    let text = String::from_utf8_lossy(&bytes);
                    // Ollama streams newline-delimited JSON
                    let mut last_chunk = ChatStreamChunk {
                        message: None,
                        done: false,
                    };

                    for line in text.lines() {
                        if line.is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<ChatStreamResponse>(line) {
                            Ok(resp) => {
                                last_chunk = ChatStreamChunk {
                                    message: resp.message.map(|m| m.content),
                                    done: resp.done,
                                };
                            }
                            Err(e) => {
                                log::warn!("Failed to parse stream chunk: {} (line: {})", e, line);
                            }
                        }
                    }

                    last_chunk
                })
        });

        Ok(stream)
    }

    /// Generate a summary using a non-streaming request with larger output budget.
    pub async fn generate_summary(&self, prompt: &str) -> Result<String, AppError> {
        let url = format!("{}/api/chat", self.base_url);

        let messages = vec![ChatMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }];

        let request = ChatRequest {
            model: CHAT_MODEL.to_string(),
            messages,
            stream: false,
            options: Some(ChatOptions {
                temperature: 0.7,
                top_p: 0.9,
                num_predict: 512,
            }),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to generate summary: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Llm(format!(
                "Ollama returned error {}: {}",
                status, body
            )));
        }

        let resp: NonStreamResponse = response
            .json()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to parse summary response: {}", e)))?;

        let summary = resp
            .message
            .map(|m| m.content.trim().to_string())
            .unwrap_or_default();

        Ok(summary)
    }

    /// Generate a title for a journal entry using a single non-streaming request.
    pub async fn generate_title(&self, content: &str) -> Result<String, AppError> {
        let url = format!("{}/api/chat", self.base_url);

        let system_prompt = "You are a helpful assistant that generates concise titles for journal entries. Generate a 2-5 word title that captures the essence of the entry. Respond with ONLY the title, no quotes or extra text.";
        let user_prompt = format!("Generate a title for this journal entry:\n\n{}", content);

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ];

        let request = ChatRequest {
            model: CHAT_MODEL.to_string(),
            messages,
            stream: false,
            options: Some(ChatOptions {
                temperature: 0.3,
                top_p: 0.9,
                num_predict: 20,
            }),
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to generate title: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Llm(format!(
                "Ollama returned error {}: {}",
                status, body
            )));
        }

        let resp: NonStreamResponse = response
            .json()
            .await
            .map_err(|e| AppError::Llm(format!("Failed to parse title response: {}", e)))?;

        let title = resp
            .message
            .map(|m| m.content.trim().to_string())
            .unwrap_or_default();

        Ok(title)
    }
}

/// Non-streaming response from /api/chat.
#[derive(Debug, Deserialize)]
struct NonStreamResponse {
    message: Option<ChatMessageContent>,
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Status of Ollama availability.
#[derive(Debug, Clone, Serialize)]
pub struct OllamaStatus {
    pub is_running: bool,
    pub model_available: bool,
    pub model_name: String,
    pub error: Option<String>,
}

/// A model available in Ollama.
#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

/// Response from /api/tags endpoint.
#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Vec<OllamaModel>,
}

/// Request body for /api/chat.
#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<ChatOptions>,
}

/// Chat options for the model.
#[derive(Debug, Serialize)]
struct ChatOptions {
    temperature: f32,
    top_p: f32,
    num_predict: i32,
}

/// Message in Ollama chat format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Streaming response chunk from /api/chat.
#[derive(Debug, Deserialize)]
struct ChatStreamResponse {
    message: Option<ChatMessageContent>,
    done: bool,
}

#[derive(Debug, Deserialize)]
struct ChatMessageContent {
    content: String,
}

/// Processed stream chunk.
#[derive(Debug, Clone)]
pub struct ChatStreamChunk {
    pub message: Option<String>,
    pub done: bool,
}
