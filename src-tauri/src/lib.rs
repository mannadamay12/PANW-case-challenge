mod db;
mod error;
pub mod ml;

use db::journals::{CreateEntryResponse, DeleteResponse, Journal};
use db::search::HybridSearchResult;
use ml::sentiment::EmotionPrediction;
use ml::{MlState, ModelStatus};
use tauri::Manager;
use db::DbPool;
use error::AppError;
use tauri::State;

// Re-export for external use
pub use db::journals;
pub use error::AppError as Error;

/// Create a new journal entry.
#[tauri::command]
fn create_entry(
    pool: State<'_, DbPool>,
    content: String,
) -> Result<CreateEntryResponse, AppError> {
    let conn = pool.get()?;
    journals::create(&conn, &content)
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

/// Update a journal entry's content.
#[tauri::command]
fn update_entry(
    pool: State<'_, DbPool>,
    id: String,
    content: String,
) -> Result<Journal, AppError> {
    let conn = pool.get()?;
    journals::update(&conn, &id, &content)
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
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_dir)?;

            // Initialize database
            let db_path = app_dir.join("mindscribe.db");
            let pool = db::init(&db_path).expect("Failed to initialize database");

            // Initialize ML state
            let models_dir = app_dir.join("models");
            std::fs::create_dir_all(&models_dir)?;
            let ml_state = MlState::new(models_dir);

            // Store in Tauri state
            app.manage(pool);
            app.manage(ml_state);

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
