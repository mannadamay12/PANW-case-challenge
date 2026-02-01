pub mod emotions;
pub mod journals;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::error::AppError;

/// Thread-safe database connection wrapper.
/// Uses a Mutex to ensure single-writer access per SQLite requirements.
pub struct DbPool {
    conn: Mutex<Connection>,
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

    let conn = Connection::open(db_path)?;

    // Enable WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Run schema migrations
    schema::run_migrations(&conn)?;

    log::info!("Database initialized successfully");

    Ok(DbPool {
        conn: Mutex::new(conn),
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
