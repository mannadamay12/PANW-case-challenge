mod db;
mod error;
pub mod llm;
pub mod ml;

use db::chat::{ChatMessage, CreateMessageParams};
use db::images::{EntryImage, InsertImageParams};
use db::journals::{
    CreateEntryResponse, DayEmotions, DeleteResponse, Journal, JournalStats, StreakInfo,
};
use db::search::HybridSearchResult;
use db::templates::{CreateTemplateResponse, DeleteTemplateResponse, Template};
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
pub use db::templates;
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

/// Delete a journal entry and its associated images.
#[tauri::command]
fn delete_entry(
    app: AppHandle,
    pool: State<'_, DbPool>,
    id: String,
) -> Result<DeleteResponse, AppError> {
    let conn = pool.get()?;

    // Get images before deletion (CASCADE will remove DB records)
    let images = db::images::get_images_for_entry(&conn, &id)?;

    // Delete the journal entry (CASCADE handles DB cleanup)
    let result = journals::delete(&conn, &id)?;

    // Clean up image files from disk
    if let Ok(app_dir) = app.path().app_data_dir() {
        for image in images {
            let file_path = app_dir.join(&image.relative_path);
            if file_path.exists() {
                let _ = std::fs::remove_file(&file_path);
            }
        }
        // Try to remove the entry's image directory if empty
        let entry_images_dir = app_dir.join("images").join(&id);
        let _ = std::fs::remove_dir(&entry_images_dir);
    }

    Ok(result)
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

/// Get journal statistics for the dashboard.
#[tauri::command]
fn get_journal_stats(pool: State<'_, DbPool>) -> Result<JournalStats, AppError> {
    let conn = pool.get()?;
    journals::get_stats(&conn)
}

/// Get extended streak information for the dashboard.
#[tauri::command]
fn get_streak_info(pool: State<'_, DbPool>) -> Result<StreakInfo, AppError> {
    let conn = pool.get()?;
    journals::get_streak_info(&conn)
}

/// Get emotion trends for a date range.
#[tauri::command]
fn get_emotion_trends(
    pool: State<'_, DbPool>,
    start_date: String,
    end_date: String,
) -> Result<Vec<DayEmotions>, AppError> {
    let conn = pool.get()?;
    let daily_emotions = db::emotions::get_daily_emotions(&conn, &start_date, &end_date)?;

    Ok(daily_emotions
        .into_iter()
        .map(|(date, dominant_emotion, entry_count)| DayEmotions {
            date,
            dominant_emotion,
            entry_count,
        })
        .collect())
}

/// Get entries from the same date in previous years ("On This Day").
#[tauri::command]
fn get_on_this_day(pool: State<'_, DbPool>) -> Result<Vec<Journal>, AppError> {
    let conn = pool.get()?;
    journals::get_on_this_day(&conn)
}

// Template Commands

/// Create a new journal template.
#[tauri::command]
fn create_template(
    pool: State<'_, DbPool>,
    title: String,
    prompt: String,
    template_text: String,
    icon: Option<String>,
    category: String,
) -> Result<CreateTemplateResponse, AppError> {
    let conn = pool.get()?;
    templates::create(
        &conn,
        &title,
        &prompt,
        &template_text,
        icon.as_deref(),
        &category,
    )
}

/// Get a single template by ID.
#[tauri::command]
fn get_template(pool: State<'_, DbPool>, id: String) -> Result<Template, AppError> {
    let conn = pool.get()?;
    templates::get(&conn, &id)
}

/// List all templates.
#[tauri::command]
fn list_templates(pool: State<'_, DbPool>) -> Result<Vec<Template>, AppError> {
    let conn = pool.get()?;
    templates::list(&conn)
}

/// List templates by category.
#[tauri::command]
fn list_templates_by_category(
    pool: State<'_, DbPool>,
    category: String,
) -> Result<Vec<Template>, AppError> {
    let conn = pool.get()?;
    templates::list_by_category(&conn, &category)
}

/// Update a template.
#[tauri::command]
fn update_template(
    pool: State<'_, DbPool>,
    id: String,
    title: Option<String>,
    prompt: Option<String>,
    template_text: Option<String>,
    icon: Option<String>,
    category: Option<String>,
) -> Result<Template, AppError> {
    let conn = pool.get()?;
    templates::update(
        &conn,
        &id,
        title.as_deref(),
        prompt.as_deref(),
        template_text.as_deref(),
        icon.as_deref(),
        category.as_deref(),
    )
}

/// Delete a template.
#[tauri::command]
fn delete_template(
    pool: State<'_, DbPool>,
    id: String,
) -> Result<DeleteTemplateResponse, AppError> {
    let conn = pool.get()?;
    templates::delete(&conn, &id)
}

// Image Commands

/// Upload an image for a journal entry.
/// Saves the file to images/{entry_id}/ and records metadata in the database.
#[tauri::command]
fn upload_entry_image(
    app: AppHandle,
    pool: State<'_, DbPool>,
    entry_id: String,
    image_data: Vec<u8>,
    filename: String,
) -> Result<EntryImage, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Storage(format!("Failed to get app data directory: {}", e)))?;

    let images_dir = app_dir.join("images").join(&entry_id);
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| AppError::Storage(format!("Failed to create images directory: {}", e)))?;

    // Generate unique filename to avoid conflicts
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let unique_filename = format!(
        "{}_{}.{}",
        uuid::Uuid::new_v4(),
        sanitize_filename(&filename),
        ext
    );
    let file_path = images_dir.join(&unique_filename);

    // Write file
    std::fs::write(&file_path, &image_data)
        .map_err(|e| AppError::Storage(format!("Failed to write image file: {}", e)))?;

    // Get image dimensions if possible
    let (width, height) = get_image_dimensions(&image_data);

    // Detect MIME type from extension
    let mime_type = match ext.to_lowercase().as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        _ => None,
    };

    let relative_path = format!("images/{}/{}", entry_id, unique_filename);

    let conn = pool.get()?;
    db::images::insert_image(
        &conn,
        InsertImageParams {
            entry_id,
            filename: unique_filename,
            relative_path,
            mime_type,
            file_size: Some(image_data.len() as i64),
            width,
            height,
        },
    )
}

/// Get all images for a journal entry.
#[tauri::command]
fn get_entry_images(
    pool: State<'_, DbPool>,
    entry_id: String,
) -> Result<Vec<EntryImage>, AppError> {
    let conn = pool.get()?;
    db::images::get_images_for_entry(&conn, &entry_id)
}

/// Delete an image by ID.
/// Removes both the file and database record.
#[tauri::command]
fn delete_entry_image(
    app: AppHandle,
    pool: State<'_, DbPool>,
    image_id: String,
) -> Result<(), AppError> {
    let conn = pool.get()?;

    // Get image info before deleting
    let image = db::images::get_image(&conn, &image_id)?;

    // Delete from database
    db::images::delete_image(&conn, &image_id)?;

    // Delete the file
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Storage(format!("Failed to get app data directory: {}", e)))?;

    let file_path = app_dir.join(&image.relative_path);
    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| AppError::Storage(format!("Failed to delete image file: {}", e)))?;
    }

    Ok(())
}

/// Get image data as base64 for display in the frontend.
#[tauri::command]
fn get_image_data(app: AppHandle, relative_path: String) -> Result<String, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Storage(format!("Failed to get app data directory: {}", e)))?;

    let file_path = app_dir.join(&relative_path);
    if !file_path.exists() {
        return Err(AppError::NotFound(format!(
            "Image not found: {}",
            relative_path
        )));
    }

    let data = std::fs::read(&file_path)
        .map_err(|e| AppError::Storage(format!("Failed to read image file: {}", e)))?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

/// Sanitize a filename to remove problematic characters.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .take(50)
        .collect()
}

/// Try to get image dimensions from raw bytes.
/// Returns (Some(width), Some(height)) if successful, (None, None) otherwise.
fn get_image_dimensions(data: &[u8]) -> (Option<i32>, Option<i32>) {
    // Try to parse PNG dimensions (simple check)
    if data.len() > 24 && &data[0..8] == b"\x89PNG\r\n\x1a\n" {
        let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
        return (Some(width as i32), Some(height as i32));
    }

    // Try to parse JPEG dimensions (more complex, skip for now)
    // For production, consider using the image crate

    (None, None)
}

// Chat Message Commands

/// List all chat messages for a journal entry.
#[tauri::command]
fn list_entry_messages(
    pool: State<'_, DbPool>,
    journal_id: String,
) -> Result<Vec<ChatMessage>, AppError> {
    let conn = pool.get()?;
    db::chat::list_for_entry(&conn, &journal_id)
}

/// Create a new chat message for a journal entry.
#[tauri::command]
fn create_chat_message(
    pool: State<'_, DbPool>,
    journal_id: String,
    role: String,
    content: String,
    metadata: Option<String>,
) -> Result<ChatMessage, AppError> {
    let conn = pool.get()?;
    db::chat::create(
        &conn,
        CreateMessageParams {
            journal_id,
            role,
            content,
            metadata,
        },
    )
}

/// Delete all chat messages for a journal entry.
#[tauri::command]
fn delete_entry_messages(pool: State<'_, DbPool>, journal_id: String) -> Result<usize, AppError> {
    let conn = pool.get()?;
    db::chat::delete_for_entry(&conn, &journal_id)
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

/// Minimum character count to trigger chunking (roughly 100+ words)
const CHUNK_THRESHOLD_CHARS: usize = 500;
/// Target chunk size in characters (roughly 100-125 words)
const CHUNK_SIZE_CHARS: usize = 500;
/// Overlap between chunks for context continuity
const CHUNK_OVERLAP_CHARS: usize = 100;

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

    let model = ml.get_embedding_model().await?;

    // Generate full-entry embedding
    let embedding = model.embed(&content)?;

    // Store entry-level embedding
    {
        let conn = pool.get()?;
        db::vectors::store_embedding(&conn, id, &embedding)?;
    }

    // For longer entries, also generate chunk embeddings for better RAG precision
    if content.len() > CHUNK_THRESHOLD_CHARS {
        let chunks = ml::embeddings::chunk_text(&content, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);

        if chunks.len() > 1 {
            let mut chunk_data = Vec::with_capacity(chunks.len());

            for (index, chunk_text) in chunks.into_iter().enumerate() {
                match model.embed(&chunk_text) {
                    Ok(chunk_embedding) => {
                        chunk_data.push(db::vectors::ChunkData {
                            chunk_index: index,
                            chunk_text,
                            embedding: chunk_embedding,
                        });
                    }
                    Err(e) => {
                        log::warn!("Failed to embed chunk {} for entry {}: {}", index, id, e);
                    }
                }
            }

            if !chunk_data.is_empty() {
                let conn = pool.get()?;
                db::vectors::store_chunk_embeddings(&conn, id, &chunk_data)?;
                log::info!(
                    "Generated {} chunk embeddings for entry {}",
                    chunk_data.len(),
                    id
                );
            }
        }
    }

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
/// When journal_id is provided, the conversation is scoped to that entry and messages are persisted.
#[tauri::command]
async fn chat_stream(
    app: AppHandle,
    pool: State<'_, DbPool>,
    ml: State<'_, MlState>,
    llm: State<'_, LlmState>,
    message: String,
    journal_id: Option<String>,
    context_limit: Option<usize>,
) -> Result<(), AppError> {
    let context_limit = context_limit.unwrap_or(5);

    // Get emotions for current entry if available (for enhanced safety check)
    let emotions: Option<Vec<EmotionPrediction>> = if let Some(ref jid) = journal_id {
        let conn = pool.get()?;
        db::emotions::get(&conn, jid).ok().map(|e| {
            e.into_iter()
                .map(|(label, score)| EmotionPrediction { label, score })
                .collect()
        })
    } else {
        None
    };

    // Check safety with emotion context
    let safety_result = llm
        .safety
        .check_with_emotions(&message, emotions.as_deref());
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

    // Get RAG context from journal entries, prioritizing current entry if provided
    let context = llm::chat::get_rag_context(
        pool.inner(),
        ml.inner(),
        &message,
        journal_id.as_deref(),
        context_limit,
    )
    .await
    .map_err(|e| log::warn!("RAG context retrieval failed: {}", e))
    .ok();

    // Get recent chat history for this entry if journal_id is provided
    let chat_history = if let Some(ref jid) = journal_id {
        let conn = pool.get()?;
        db::chat::get_recent_for_entry(&conn, jid, 10)
            .map_err(|e| log::warn!("Chat history retrieval failed: {}", e))
            .ok()
    } else {
        None
    };

    // Build the prompt with context and source tracking
    let chat_service = llm::ChatService::new(llm.ollama.clone(), llm.safety.clone());
    let prompt_with_sources = chat_service.build_prompt_with_sources(
        &message,
        context.as_deref(),
        chat_history.as_deref(),
    );
    let messages = prompt_with_sources.messages;
    let sources = prompt_with_sources.sources;

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
                                // Safety augmentation should append to the response, preserving the prefix
                                let suffix = if augmented.starts_with(&full_response) {
                                    &augmented[full_response.len()..]
                                } else {
                                    // Augmentation didn't preserve prefix - log warning and emit full augmented text
                                    log::warn!(
                                        "Safety augmentation did not preserve response prefix"
                                    );
                                    augmented.as_str()
                                };
                                if !suffix.is_empty() {
                                    let _ = app.emit(
                                        "chat-chunk",
                                        ChatChunkEvent {
                                            chunk: suffix.to_string(),
                                            done: false,
                                        },
                                    );
                                }
                                full_response = augmented;
                            }

                            // Persist the assistant's response if journal_id was provided
                            if let Some(ref jid) = journal_id {
                                // Serialize sources to JSON for metadata
                                let metadata = if !sources.is_empty() {
                                    serde_json::to_string(&sources).ok()
                                } else {
                                    None
                                };

                                let conn = pool.get()?;
                                let _ = db::chat::create(
                                    &conn,
                                    CreateMessageParams {
                                        journal_id: jid.clone(),
                                        role: "assistant".to_string(),
                                        content: full_response.clone(),
                                        metadata,
                                    },
                                );
                            }

                            // Emit sources with the done event
                            let _ = app.emit(
                                "chat-done",
                                serde_json::json!({
                                    "sources": sources
                                }),
                            );
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

            // Initialize images directory
            let images_dir = app_dir.join("images");
            std::fs::create_dir_all(&images_dir)?;

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
            get_journal_stats,
            get_streak_info,
            get_emotion_trends,
            get_on_this_day,
            create_template,
            get_template,
            list_templates,
            list_templates_by_category,
            update_template,
            delete_template,
            upload_entry_image,
            get_entry_images,
            delete_entry_image,
            get_image_data,
            list_entry_messages,
            create_chat_message,
            delete_entry_messages,
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
