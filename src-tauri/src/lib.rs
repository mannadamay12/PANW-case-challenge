mod db;
mod error;
pub mod llm;
pub mod ml;
mod security;

use db::journals::{CreateEntryResponse, DeleteResponse, Journal};
use db::search::HybridSearchResult;
use db::DbPool;
use error::AppError;
use futures::StreamExt;
use llm::safety::SafetyResult;
use llm::{ChatChunkEvent, ChatErrorEvent, LlmState, OllamaStatus};
use ml::sentiment::EmotionPrediction;
use ml::{MlState, ModelStatus};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager, State};

// Re-export for external use
pub use db::journals;
pub use error::AppError as Error;

/// Protection status returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct ProtectionStatus {
    /// Whether protection is enabled (key exists in Keychain).
    pub is_enabled: bool,
    /// Whether the database is currently unlocked.
    pub is_unlocked: bool,
    /// Whether this is the first launch (no existing database).
    pub is_first_launch: bool,
}

/// Manages the database connection state, allowing for locked/unlocked transitions.
pub struct AppState {
    /// Path to the app data directory.
    app_dir: PathBuf,
    /// Current database connection (None when locked).
    db_pool: RwLock<Option<DbPool>>,
    /// Whether the user has completed the protection setup.
    setup_completed: AtomicBool,
}

impl AppState {
    fn new(app_dir: PathBuf) -> Self {
        Self {
            app_dir,
            db_pool: RwLock::new(None),
            setup_completed: AtomicBool::new(false),
        }
    }

    fn db_path(&self) -> PathBuf {
        self.app_dir.join("mindscribe.db")
    }

    fn encrypted_db_path(&self) -> PathBuf {
        self.app_dir.join("mindscribe_encrypted.db")
    }

    fn get_pool(&self) -> Result<DbPool, AppError> {
        self.db_pool
            .read()
            .map_err(|_| AppError::Internal("Failed to acquire read lock".to_string()))?
            .clone()
            .ok_or_else(|| AppError::Internal("Database is locked".to_string()))
    }

    fn set_pool(&self, pool: Option<DbPool>) -> Result<(), AppError> {
        let mut guard = self
            .db_pool
            .write()
            .map_err(|_| AppError::Internal("Failed to acquire write lock".to_string()))?;
        *guard = pool;
        Ok(())
    }

    fn is_unlocked(&self) -> bool {
        self.db_pool
            .read()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    fn mark_setup_completed(&self) {
        self.setup_completed.store(true, Ordering::SeqCst);
    }
}

/// Check the current protection status.
/// Uses file existence checks instead of Keychain queries to avoid triggering auth dialogs.
#[tauri::command]
fn check_protection_status(state: State<'_, AppState>) -> ProtectionStatus {
    // Check if encrypted DB exists (doesn't trigger Keychain prompt)
    let is_enabled = state.encrypted_db_path().exists();
    let is_unlocked = state.is_unlocked();
    let is_first_launch = !state.db_path().exists() && !state.encrypted_db_path().exists();

    ProtectionStatus {
        is_enabled,
        is_unlocked,
        is_first_launch,
    }
}

/// Enable protection: generate encryption key, encrypt existing DB if any, and unlock.
#[tauri::command]
fn enable_protection(state: State<'_, AppState>) -> Result<(), AppError> {
    // Check file existence instead of Keychain to avoid triggering auth dialog
    if state.encrypted_db_path().exists() {
        return Err(AppError::InvalidInput(
            "Protection is already enabled".to_string(),
        ));
    }

    // Generate and store encryption key in Keychain
    let key = security::store_encryption_key()
        .map_err(|e| AppError::Internal(format!("Keychain error: {}", e)))?;

    let unencrypted_path = state.db_path();
    let encrypted_path = state.encrypted_db_path();

    if unencrypted_path.exists() {
        // Encrypt existing database
        db::encrypt_database(&unencrypted_path, &encrypted_path, &key)?;

        // Remove unencrypted database after successful encryption
        std::fs::remove_file(&unencrypted_path)
            .map_err(|e| AppError::Internal(format!("Failed to remove unencrypted DB: {}", e)))?;
    }

    // Initialize encrypted database
    let pool = db::init_encrypted(&encrypted_path, &key)?;
    state.set_pool(Some(pool))?;
    state.mark_setup_completed();

    log::info!("Protection enabled successfully");
    Ok(())
}

/// Unlock the protected database (triggers Touch ID / system auth).
/// This is the ONLY place we trigger the Keychain auth dialog.
#[tauri::command]
fn unlock(state: State<'_, AppState>) -> Result<(), AppError> {
    if state.is_unlocked() {
        return Ok(()); // Already unlocked
    }

    // Check file existence instead of Keychain to avoid triggering auth dialog
    if !state.encrypted_db_path().exists() {
        return Err(AppError::InvalidInput(
            "No encrypted database found".to_string(),
        ));
    }

    // Get key from Keychain (this is the ONLY place we trigger auth)
    let key = security::get_encryption_key()
        .map_err(|e| AppError::Internal(format!("Authentication failed: {}", e)))?;

    let encrypted_path = state.encrypted_db_path();
    let pool = db::init_encrypted(&encrypted_path, &key)?;
    state.set_pool(Some(pool))?;

    log::info!("Database unlocked successfully");
    Ok(())
}

/// Skip protection setup (use unencrypted database).
#[tauri::command]
fn skip_protection(state: State<'_, AppState>) -> Result<(), AppError> {
    if state.is_unlocked() {
        return Ok(()); // Already initialized
    }

    let db_path = state.db_path();
    let pool = db::init(&db_path)?;
    state.set_pool(Some(pool))?;
    state.mark_setup_completed();

    log::info!("Protection skipped, using unencrypted database");
    Ok(())
}

/// Disable protection: decrypt database and remove key from Keychain.
#[tauri::command]
fn disable_protection(state: State<'_, AppState>) -> Result<(), AppError> {
    // Check file existence instead of Keychain to avoid triggering auth dialog
    if !state.encrypted_db_path().exists() {
        return Err(AppError::InvalidInput(
            "Protection is not enabled".to_string(),
        ));
    }

    // Get key from Keychain (triggers auth)
    let key = security::get_encryption_key()
        .map_err(|e| AppError::Internal(format!("Authentication failed: {}", e)))?;

    let encrypted_path = state.encrypted_db_path();
    let unencrypted_path = state.db_path();

    // Decrypt database
    if encrypted_path.exists() {
        db::decrypt_database(&encrypted_path, &unencrypted_path, &key)?;

        // Close current connection
        state.set_pool(None)?;

        // Remove encrypted database
        std::fs::remove_file(&encrypted_path)
            .map_err(|e| AppError::Internal(format!("Failed to remove encrypted DB: {}", e)))?;
    }

    // Delete key from Keychain
    security::delete_encryption_key()
        .map_err(|e| AppError::Internal(format!("Failed to delete key: {}", e)))?;

    // Reopen with unencrypted database
    let pool = db::init(&unencrypted_path)?;
    state.set_pool(Some(pool))?;

    log::info!("Protection disabled successfully");
    Ok(())
}

/// Create a new journal entry.
#[tauri::command]
fn create_entry(
    state: State<'_, AppState>,
    content: String,
    title: Option<String>,
    entry_type: Option<String>,
) -> Result<CreateEntryResponse, AppError> {
    let pool = state.get_pool()?;
    let conn = pool.get()?;
    journals::create(&conn, &content, title.as_deref(), entry_type.as_deref())
}

/// Get a single journal entry by ID.
#[tauri::command]
fn get_entry(state: State<'_, AppState>, id: String) -> Result<Journal, AppError> {
    let pool = state.get_pool()?;
    let conn = pool.get()?;
    journals::get(&conn, &id)
}

/// List journal entries with optional pagination and filtering.
#[tauri::command]
fn list_entries(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
    archived: Option<bool>,
) -> Result<Vec<Journal>, AppError> {
    let pool = state.get_pool()?;
    let conn = pool.get()?;
    journals::list(&conn, limit, offset, archived)
}

/// Update a journal entry's content, title, or entry type.
#[tauri::command]
fn update_entry(
    state: State<'_, AppState>,
    id: String,
    content: Option<String>,
    title: Option<String>,
    entry_type: Option<String>,
) -> Result<Journal, AppError> {
    let pool = state.get_pool()?;
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
fn delete_entry(state: State<'_, AppState>, id: String) -> Result<DeleteResponse, AppError> {
    let pool = state.get_pool()?;
    let conn = pool.get()?;
    journals::delete(&conn, &id)
}

/// Archive a journal entry.
#[tauri::command]
fn archive_entry(state: State<'_, AppState>, id: String) -> Result<Journal, AppError> {
    let pool = state.get_pool()?;
    let conn = pool.get()?;
    journals::archive(&conn, &id)
}

/// Maximum length for search queries.
const MAX_QUERY_LENGTH: usize = 1000;

/// Maximum length for chat messages.
const MAX_MESSAGE_LENGTH: usize = 10000;

/// Search journal entries using full-text search.
#[tauri::command]
fn search_entries(
    state: State<'_, AppState>,
    query: String,
    include_archived: Option<bool>,
) -> Result<Vec<Journal>, AppError> {
    if query.len() > MAX_QUERY_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "Query exceeds maximum length of {} characters",
            MAX_QUERY_LENGTH
        )));
    }
    let pool = state.get_pool()?;
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
    state: State<'_, AppState>,
    ml: State<'_, MlState>,
    id: String,
) -> Result<Vec<EmotionPrediction>, AppError> {
    let pool = state.get_pool()?;

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
    state: State<'_, AppState>,
    ml: State<'_, MlState>,
    query: String,
    limit: Option<usize>,
    include_archived: Option<bool>,
) -> Result<Vec<HybridSearchResult>, AppError> {
    let limit = limit.unwrap_or(20);
    let include_archived = include_archived.unwrap_or(false);
    let pool = state.get_pool()?;

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
    state: State<'_, AppState>,
    ml: State<'_, MlState>,
    id: String,
) -> Result<(), AppError> {
    // Clone for the background task
    let pool_clone = state.get_pool()?;
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
    state: State<'_, AppState>,
    llm: State<'_, LlmState>,
) -> Result<u32, AppError> {
    let pool = state.get_pool()?;

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
    state: State<'_, AppState>,
    ml: State<'_, MlState>,
    llm: State<'_, LlmState>,
    message: String,
    context_limit: Option<usize>,
) -> Result<(), AppError> {
    if message.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "Message cannot be empty".to_string(),
        ));
    }
    if message.len() > MAX_MESSAGE_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "Message exceeds maximum length of {} characters",
            MAX_MESSAGE_LENGTH
        )));
    }
    let context_limit = context_limit.unwrap_or(5);
    let pool = state.get_pool()?;

    // Check safety first
    let safety_result = llm.safety.check(&message);
    if !safety_result.safe {
        // Emit the intervention message as a "response"
        if let Some(intervention) = &safety_result.intervention {
            if let Err(e) = app.emit(
                "chat-chunk",
                ChatChunkEvent {
                    chunk: intervention.clone(),
                    done: false,
                },
            ) {
                log::warn!("Failed to emit chat-chunk event: {}", e);
            }
        }
        if let Err(e) = app.emit("chat-done", ()) {
            log::warn!("Failed to emit chat-done event: {}", e);
        }
        return Ok(());
    }

    // Get RAG context from journal entries
    let context = llm::chat::get_rag_context(&pool, ml.inner(), &message, context_limit)
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
                            if let Err(e) = app.emit(
                                "chat-chunk",
                                ChatChunkEvent {
                                    chunk: content.clone(),
                                    done: false,
                                },
                            ) {
                                log::warn!("Failed to emit chat-chunk event: {}", e);
                            }
                        }

                        if chunk.done {
                            // Augment with safety resources if distress was detected
                            let augmented =
                                chat_service.augment_with_safety(&full_response, &safety_result);
                            if augmented != full_response {
                                let suffix = augmented.strip_prefix(&full_response).unwrap_or("");
                                if let Err(e) = app.emit(
                                    "chat-chunk",
                                    ChatChunkEvent {
                                        chunk: suffix.to_string(),
                                        done: false,
                                    },
                                ) {
                                    log::warn!("Failed to emit chat-chunk event: {}", e);
                                }
                            }
                            if let Err(e) = app.emit("chat-done", ()) {
                                log::warn!("Failed to emit chat-done event: {}", e);
                            }
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("Chat stream error: {}", e);
                        if let Err(emit_err) = app.emit(
                            "chat-error",
                            ChatErrorEvent {
                                message: e.to_string(),
                            },
                        ) {
                            log::warn!("Failed to emit chat-error event: {}", emit_err);
                        }
                        break;
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Failed to start chat stream: {}", e);
            if let Err(emit_err) = app.emit(
                "chat-error",
                ChatErrorEvent {
                    message: e.to_string(),
                },
            ) {
                log::warn!("Failed to emit chat-error event: {}", emit_err);
            }
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

            // Initialize app state (database will be initialized after auth)
            let app_state = AppState::new(app_dir.clone());

            // Initialize ML state
            let models_dir = app_dir.join("models");
            std::fs::create_dir_all(&models_dir)?;
            let ml_state = MlState::new(models_dir);

            // Initialize LLM state
            let llm_state =
                LlmState::new().map_err(|e| format!("Failed to initialize LLM: {}", e))?;

            // Store in Tauri state
            app.manage(app_state);
            app.manage(ml_state);
            app.manage(llm_state);

            log::info!("MindScribe initialized (database pending auth)");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Protection/auth commands
            check_protection_status,
            enable_protection,
            unlock,
            skip_protection,
            disable_protection,
            // Journal commands
            create_entry,
            get_entry,
            list_entries,
            update_entry,
            delete_entry,
            archive_entry,
            search_entries,
            // ML commands
            get_model_status,
            initialize_models,
            get_entry_emotions,
            hybrid_search,
            generate_entry_embedding,
            // LLM/Chat commands
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
