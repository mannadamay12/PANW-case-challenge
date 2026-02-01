mod db;
mod error;

use db::journals::{CreateEntryResponse, DeleteResponse, Journal};
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

            // Store in Tauri state
            app.manage(pool);

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
