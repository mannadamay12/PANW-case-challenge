pub mod chat;
pub mod emotions;
pub mod images;
pub mod journals;
pub mod schema;
pub mod search;
pub mod templates;
pub mod vectors;

use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::error::AppError;

/// Thread-safe database connection wrapper.
/// Uses Arc<Mutex> to allow cloning for async tasks while ensuring single-writer access.
#[derive(Clone)]
pub struct DbPool {
    conn: Arc<Mutex<Connection>>,
}

impl DbPool {
    /// Get a lock on the database connection.
    pub fn get(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.conn.lock().map_err(|_| {
            AppError::Database(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
                Some("Failed to acquire database lock".to_string()),
            ))
        })
    }
}

/// Initialize the database at the given path.
/// Creates the file if it doesn't exist and runs migrations.
pub fn init(db_path: &Path) -> Result<DbPool, AppError> {
    log::info!("Initializing database at: {}", db_path.display());

    // Register sqlite-vec extension as auto_extension BEFORE opening connection.
    // This makes the vec0 virtual table module available for CREATE VIRTUAL TABLE statements.
    #[allow(clippy::missing_transmute_annotations)]
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }
    log::info!("sqlite-vec extension registered");

    let conn = Connection::open(db_path)?;

    // Enable WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Run schema migrations
    schema::run_migrations(&conn)?;

    log::info!("Database initialized successfully");

    Ok(DbPool {
        conn: Arc::new(Mutex::new(conn)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_init_creates_database() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let pool = init(&db_path).unwrap();
        assert!(db_path.exists());

        // Verify we can get a connection
        let _conn = pool.get().unwrap();
    }
}
