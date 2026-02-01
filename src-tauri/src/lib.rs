mod db;
mod error;
pub mod llm;
pub mod ml;

use db::journals::{CreateEntryResponse, DeleteResponse, Journal};
use db::search::HybridSearchResult;
use db::DbPool;
use error::AppError;
use futures::StreamExt;
use llm::safety::SafetyResult;
use llm::{ChatChunkEvent, ChatErrorEvent, LlmState, OllamaStatus};
use ml::sentiment::EmotionPrediction;
use ml::{MlState, ModelStatus};
use tauri::{AppHandle, Emitter, Manager, State};

// Re-export for external use
pub use db::journals;
pub use error::AppError as Error;

/// Create a new journal entry.
#[tauri::command]
fn create_entry(
    pool: State<'_, DbPool>,
    content: String,
    title: Option<String>,
    entry_type: Option<String>,
) -> Result<CreateEntryResponse, AppError> {
    let conn = pool.get()?;
    journals::create(&conn, &content, title.as_deref(), entry_type.as_deref())
}

/// Get a single journal entry by ID.
#[tauri::command]
fn get_entry(pool: State<'_, DbPool>, id: String) -> Result<Journal, AppError> {
    let conn = pool.get()?;
    journals::get(&conn, &id)
}

/// List journal entries with optional pagination and filtering.
#[tauri::command]
fn list_entries(
    pool: State<'_, DbPool>,
    limit: Option<i64>,
    offset: Option<i64>,
    archived: Option<bool>,
) -> Result<Vec<Journal>, AppError> {
    let conn = pool.get()?;
    journals::list(&conn, limit, offset, archived)
}

/// Update a journal entry's content, title, or entry type.
#[tauri::command]
fn update_entry(
    pool: State<'_, DbPool>,
    id: String,
    content: Option<String>,
    title: Option<String>,
    entry_type: Option<String>,
) -> Result<Journal, AppError> {
    let conn = pool.get()?;
    journals::update(
        &conn,
        &id,
        content.as_deref(),
        title.as_deref(),
        entry_type.as_deref(),
    )
}

/// Delete a journal entry.
#[tauri::command]
fn delete_entry(pool: State<'_, DbPool>, id: String) -> Result<DeleteResponse, AppError> {
    let conn = pool.get()?;
    journals::delete(&conn, &id)
}

/// Archive a journal entry.
#[tauri::command]
fn archive_entry(pool: State<'_, DbPool>, id: String) -> Result<Journal, AppError> {
    let conn = pool.get()?;
    journals::archive(&conn, &id)
}

/// Search journal entries using full-text search.
#[tauri::command]
fn search_entries(
    pool: State<'_, DbPool>,
    query: String,
    include_archived: Option<bool>,
) -> Result<Vec<Journal>, AppError> {
    let conn = pool.get()?;
    journals::search(&conn, &query, include_archived.unwrap_or(false))
}

// ML Commands

/// Check if ML models are downloaded and ready.
#[tauri::command]
async fn get_model_status(ml: State<'_, MlState>) -> Result<ModelStatus, AppError> {
    Ok(ml.models_ready().await)
}

/// Initialize ML models (download if needed, load into memory).
#[tauri::command]
async fn initialize_models(ml: State<'_, MlState>) -> Result<(), AppError> {
    ml.initialize(|_progress| {
        // Progress can be sent via events if needed
    })
    .await
}

/// Get emotions for a journal entry.
/// If not cached, generates and stores them.
#[tauri::command]
async fn get_entry_emotions(
    pool: State<'_, DbPool>,
    ml: State<'_, MlState>,
    id: String,
) -> Result<Vec<EmotionPrediction>, AppError> {
    // Check if emotions are already cached
    {
        let conn = pool.get()?;
        let cached = db::emotions::get(&conn, &id)?;
        if !cached.is_empty() {
            return Ok(cached
                .into_iter()
                .map(|(label, score)| EmotionPrediction { label, score })
                .collect());
        }
    }

    // Get the journal content
    let content = {
        let conn = pool.get()?;
        let entry = journals::get(&conn, &id)?;
        entry.content
    };

    // Generate emotions using ML model
    let model = ml.get_sentiment_model().await?;
    let predictions = model.predict(&content, 0.1, 5)?;

    // Cache the results
    {
        let conn = pool.get()?;
        for pred in &predictions {
            db::emotions::store(&conn, &id, &pred.label, pred.score)?;
        }
    }

    Ok(predictions)
}

/// Perform hybrid search combining FTS5 and vector similarity.
#[tauri::command]
async fn hybrid_search(
    pool: State<'_, DbPool>,
    ml: State<'_, MlState>,
    query: String,
    limit: Option<usize>,
    include_archived: Option<bool>,
) -> Result<Vec<HybridSearchResult>, AppError> {
    let limit = limit.unwrap_or(20);
    let include_archived = include_archived.unwrap_or(false);

    // Try to get embedding for semantic search
    let embedding = if ml.models_ready().await.embedding_downloaded {
        match ml.get_embedding_model().await {
            Ok(model) => model.embed(&query).ok(),
            Err(_) => None,
        }
    } else {
        None
    };

    let conn = pool.get()?;

    if let Some(ref emb) = embedding {
        db::search::hybrid_search(&conn, &query, Some(emb), limit, include_archived)
    } else {
        // Fall back to FTS-only search
        db::search::fts_only_search(&conn, &query, limit, include_archived)
    }
}

/// Generate embedding for a journal entry in the background.
/// Returns immediately; embedding is generated asynchronously.
#[tauri::command]
async fn generate_entry_embedding(
    pool: State<'_, DbPool>,
    ml: State<'_, MlState>,
    id: String,
) -> Result<(), AppError> {
    // Clone for the background task
    let pool_clone = pool.inner().clone();
    let ml_clone = ml.inner().clone();

    // Spawn as non-blocking background task
    tauri::async_runtime::spawn(async move {
        if let Err(e) = generate_embedding_inner(&pool_clone, &ml_clone, &id).await {
            log::error!("Failed to generate embedding for {}: {}", id, e);
        }
    });

    Ok(())
}

async fn generate_embedding_inner(pool: &DbPool, ml: &MlState, id: &str) -> Result<(), AppError> {
    // Check if embedding already exists
    {
        let conn = pool.get()?;
        if db::vectors::has_embedding(&conn, id)? {
            return Ok(());
        }
    }

    // Get journal content
    let content = {
        let conn = pool.get()?;
        let entry = journals::get(&conn, id)?;
        entry.content
    };

    // Generate embedding
    let model = ml.get_embedding_model().await?;
    let embedding = model.embed(&content)?;

    // Store embedding
    let conn = pool.get()?;
    db::vectors::store_embedding(&conn, id, &embedding)?;

    log::info!("Generated embedding for entry {}", id);
    Ok(())
}

// LLM/Chat Commands

/// Check if Ollama is running and the required model is available.
#[tauri::command]
async fn check_ollama_status(llm: State<'_, LlmState>) -> Result<OllamaStatus, AppError> {
    Ok(llm.check_status().await)
}

/// Check a message for safety concerns before sending to the LLM.
#[tauri::command]
fn check_message_safety(llm: State<'_, LlmState>, text: String) -> SafetyResult {
    llm.safety.check(&text)
}

/// Generate a title for a journal entry using the LLM.
#[tauri::command]
async fn generate_title(llm: State<'_, LlmState>, content: String) -> Result<String, AppError> {
    llm.ollama.generate_title(&content).await
}

/// Generate titles for all entries that don't have one.
/// Returns the number of titles generated.
#[tauri::command]
async fn generate_missing_titles(
    pool: State<'_, DbPool>,
    llm: State<'_, LlmState>,
) -> Result<u32, AppError> {
    // Get entries without titles
    let entries = {
        let conn = pool.get()?;
        journals::list_without_titles(&conn, Some(50))?
    };

    if entries.is_empty() {
        return Ok(0);
    }

    log::info!("Generating titles for {} entries", entries.len());
    let mut count = 0u32;

    for entry in entries {
        // Skip very short entries
        if entry.content.trim().len() < 20 {
            continue;
        }

        match llm.ollama.generate_title(&entry.content).await {
            Ok(title) if !title.is_empty() => {
                let conn = pool.get()?;
                if journals::update_title(&conn, &entry.id, &title).is_ok() {
                    log::info!("Generated title for entry {}: {}", entry.id, title);
                    count += 1;
                }
            }
            Ok(_) => {
                log::warn!("Empty title generated for entry {}", entry.id);
            }
            Err(e) => {
                log::error!("Failed to generate title for entry {}: {}", entry.id, e);
                // Continue with other entries even if one fails
            }
        }
    }

    Ok(count)
}

/// Stream a chat response from the LLM with optional RAG context.
/// Emits 'chat-chunk' events for each token and 'chat-done' or 'chat-error' on completion.
#[tauri::command]
async fn chat_stream(
    app: AppHandle,
    pool: State<'_, DbPool>,
    ml: State<'_, MlState>,
    llm: State<'_, LlmState>,
    message: String,
    context_limit: Option<usize>,
) -> Result<(), AppError> {
    let context_limit = context_limit.unwrap_or(5);

    // Check safety first
    let safety_result = llm.safety.check(&message);
    if !safety_result.safe {
        // Emit the intervention message as a "response"
        if let Some(intervention) = &safety_result.intervention {
            let _ = app.emit(
                "chat-chunk",
                ChatChunkEvent {
                    chunk: intervention.clone(),
                    done: false,
                },
            );
        }
        let _ = app.emit("chat-done", ());
        return Ok(());
    }

    // Get RAG context from journal entries
    let context = llm::chat::get_rag_context(pool.inner(), ml.inner(), &message, context_limit)
        .await
        .ok();

    // Build the prompt with context
    let chat_service = llm::ChatService::new(llm.ollama.clone(), llm.safety.clone());
    let messages = chat_service.build_prompt(&message, context.as_deref());

    // Stream the response
    match chat_service.chat_stream(messages).await {
        Ok(stream) => {
            let mut stream = Box::pin(stream);
            let mut full_response = String::new();

            while let Some(result) = stream.next().await {
                match result {
                    Ok(chunk) => {
                        if let Some(content) = &chunk.message {
                            full_response.push_str(content);
                            let _ = app.emit(
                                "chat-chunk",
                                ChatChunkEvent {
                                    chunk: content.clone(),
                                    done: false,
                                },
                            );
                        }

                        if chunk.done {
                            // Augment with safety resources if distress was detected
                            let augmented =
                                chat_service.augment_with_safety(&full_response, &safety_result);
                            if augmented != full_response {
                                let suffix = augmented.strip_prefix(&full_response).unwrap_or("");
                                let _ = app.emit(
                                    "chat-chunk",
                                    ChatChunkEvent {
                                        chunk: suffix.to_string(),
                                        done: false,
                                    },
                                );
                            }
                            let _ = app.emit("chat-done", ());
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("Chat stream error: {}", e);
                        let _ = app.emit(
                            "chat-error",
                            ChatErrorEvent {
                                message: e.to_string(),
                            },
                        );
                        break;
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Failed to start chat stream: {}", e);
            let _ = app.emit(
                "chat-error",
                ChatErrorEvent {
                    message: e.to_string(),
                },
            );
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get app data directory
            let app_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?;

            std::fs::create_dir_all(&app_dir)?;

            // Initialize database
            let db_path = app_dir.join("mindscribe.db");
            let pool =
                db::init(&db_path).map_err(|e| format!("Failed to initialize database: {}", e))?;

            // Initialize ML state
            let models_dir = app_dir.join("models");
            std::fs::create_dir_all(&models_dir)?;
            let ml_state = MlState::new(models_dir);

            // Initialize LLM state
            let llm_state = LlmState::new();

            // Store in Tauri state
            app.manage(pool);
            app.manage(ml_state);
            app.manage(llm_state);

            log::info!("MindScribe initialized successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_entry,
            get_entry,
            list_entries,
            update_entry,
            delete_entry,
            archive_entry,
            search_entries,
            get_model_status,
            initialize_models,
            get_entry_emotions,
            hybrid_search,
            generate_entry_embedding,
            check_ollama_status,
            check_message_safety,
            generate_title,
            generate_missing_titles,
            chat_stream,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("Fatal error running Tauri application: {}", e);
            std::process::exit(1);
        });
}
