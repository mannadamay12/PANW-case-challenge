use crate::db::chat::ChatMessage as DbChatMessage;
use crate::db::search::HybridSearchResult;
use crate::db::DbPool;
use crate::error::AppError;
use crate::ml::MlState;

use super::ollama::{ChatMessage, OllamaClient};
use super::safety::{SafetyFilter, SafetyResult};

/// Service for handling chat completions with RAG context.
pub struct ChatService {
    ollama: OllamaClient,
    safety: SafetyFilter,
}

impl ChatService {
    pub fn new(ollama: OllamaClient, safety: SafetyFilter) -> Self {
        Self { ollama, safety }
    }

    /// Check the safety of a user message before processing.
    pub fn check_safety(&self, message: &str) -> SafetyResult {
        self.safety.check(message)
    }

    /// Get augmented response with safety resources if needed.
    pub fn augment_with_safety(&self, response: &str, safety: &SafetyResult) -> String {
        self.safety.augment_response(response, safety)
    }

    /// Build the chat prompt with system context and RAG results.
    pub fn build_prompt(
        &self,
        user_message: &str,
        context: Option<&[HybridSearchResult]>,
    ) -> Vec<ChatMessage> {
        self.build_prompt_with_history(user_message, context, None)
    }

    /// Build the chat prompt with system context, RAG results, and chat history.
    pub fn build_prompt_with_history(
        &self,
        user_message: &str,
        context: Option<&[HybridSearchResult]>,
        chat_history: Option<&[DbChatMessage]>,
    ) -> Vec<ChatMessage> {
        let mut messages = Vec::new();

        // System prompt with guidelines
        let mut system_content = SYSTEM_PROMPT.to_string();

        // Add RAG context if available
        if let Some(results) = context {
            if !results.is_empty() {
                system_content.push_str("\n\nRELEVANT PAST ENTRIES:\n");
                for result in results.iter().take(5) {
                    let snippet = truncate_snippet(&result.journal.content, 200);
                    let date = &result.journal.created_at;
                    system_content.push_str(&format!("[{}]: {}\n", date, snippet));
                }
            }
        }

        messages.push(ChatMessage {
            role: "system".to_string(),
            content: system_content,
        });

        // Add chat history if available
        if let Some(history) = chat_history {
            for msg in history {
                messages.push(ChatMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                });
            }
        }

        messages.push(ChatMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        });

        messages
    }

    /// Get streaming chat completion from Ollama.
    pub async fn chat_stream(
        &self,
        messages: Vec<ChatMessage>,
    ) -> Result<
        impl futures::Stream<Item = Result<super::ollama::ChatStreamChunk, AppError>>,
        AppError,
    > {
        self.ollama.chat_stream(messages).await
    }
}

/// Retrieve relevant journal context for RAG.
/// When current_entry_id is provided, that entry is always included first in the results.
pub async fn get_rag_context(
    pool: &DbPool,
    ml: &MlState,
    query: &str,
    current_entry_id: Option<&str>,
    limit: usize,
) -> Result<Vec<HybridSearchResult>, AppError> {
    let mut results = Vec::new();

    // If we have a current entry, fetch it first and include it prominently
    if let Some(entry_id) = current_entry_id {
        let conn = pool.get()?;
        if let Ok(entry) = crate::db::journals::get(&conn, entry_id) {
            results.push(HybridSearchResult {
                journal: entry,
                score: 1.0, // Highest priority
                fts_rank: Some(1),
                vec_rank: Some(1),
            });
        }
    }

    // Try to get embedding for semantic search
    let embedding = if ml.models_ready().await.embedding_downloaded {
        match ml.get_embedding_model().await {
            Ok(model) => model.embed(query).ok(),
            Err(_) => None,
        }
    } else {
        None
    };

    let conn = pool.get()?;

    // Search for related entries (excluding current if already added)
    let search_results = if let Some(ref emb) = embedding {
        crate::db::search::hybrid_search(&conn, query, Some(emb), limit, false)?
    } else {
        crate::db::search::fts_only_search(&conn, query, limit, false)?
    };

    // Add search results, excluding the current entry to avoid duplication
    for result in search_results {
        if current_entry_id.is_none() || result.journal.id != current_entry_id.unwrap() {
            results.push(result);
        }
    }

    // Limit total results
    results.truncate(limit);

    Ok(results)
}

/// Truncate content to a maximum length, breaking at word boundaries.
fn truncate_snippet(content: &str, max_len: usize) -> String {
    if content.len() <= max_len {
        return content.to_string();
    }

    // Find the last space before max_len
    let truncated: String = content.chars().take(max_len).collect();
    if let Some(last_space) = truncated.rfind(' ') {
        format!("{}...", &truncated[..last_space])
    } else {
        format!("{}...", truncated)
    }
}

/// System prompt for MindScribe's chat personality.
const SYSTEM_PROMPT: &str = r#"You are MindScribe, a private journaling companion. You help users reflect on their thoughts and feelings through gentle, thoughtful conversation.

GUIDELINES:
- Acknowledge feelings before responding
- Ask guiding questions instead of giving advice
- Reference past entries naturally when relevant
- Keep responses concise and warm (2-4 sentences typically)
- Never be judgmental or dismissive
- Respect user privacy - everything shared stays private
- If the user seems distressed, respond with empathy first

You are NOT a therapist or mental health professional. For serious concerns, gently suggest speaking with a professional."#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_snippet() {
        let short = "Hello world";
        assert_eq!(truncate_snippet(short, 50), "Hello world");

        let long = "This is a longer piece of text that should be truncated at a word boundary";
        let truncated = truncate_snippet(long, 30);
        assert!(truncated.len() <= 33); // 30 + "..."
        assert!(truncated.ends_with("..."));
    }

    #[test]
    fn test_build_prompt() {
        let ollama = OllamaClient::new();
        let safety = SafetyFilter::new();
        let service = ChatService::new(ollama, safety);

        let messages = service.build_prompt("How am I feeling?", None);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
        assert_eq!(messages[1].content, "How am I feeling?");
    }
}
