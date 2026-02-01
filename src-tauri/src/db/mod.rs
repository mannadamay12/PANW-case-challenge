pub mod emotions;
pub mod journals;
pub mod schema;
pub mod search;
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
    encrypted: bool,
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

    /// Returns whether this database is encrypted.
    pub fn is_encrypted(&self) -> bool {
        self.encrypted
    }
}

/// Register sqlite-vec extension (must be called before opening any connection).
fn register_vec_extension() {
    #[allow(clippy::missing_transmute_annotations)]
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }
    log::info!("sqlite-vec extension registered");
}

/// Initialize an unencrypted database at the given path.
/// Creates the file if it doesn't exist and runs migrations.
pub fn init(db_path: &Path) -> Result<DbPool, AppError> {
    log::info!(
        "Initializing unencrypted database at: {}",
        db_path.display()
    );

    register_vec_extension();

    let conn = Connection::open(db_path)?;

    // Enable WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Run schema migrations
    schema::run_migrations(&conn)?;

    log::info!("Database initialized successfully");

    Ok(DbPool {
        conn: Arc::new(Mutex::new(conn)),
        encrypted: false,
    })
}

/// Initialize an encrypted database using SQLCipher.
/// The key should be a 32-byte (256-bit) encryption key.
pub fn init_encrypted(db_path: &Path, key: &[u8]) -> Result<DbPool, AppError> {
    log::info!("Initializing encrypted database at: {}", db_path.display());

    register_vec_extension();

    let conn = Connection::open(db_path)?;

    // Set encryption key (hex-encoded for SQLCipher)
    let key_hex = hex::encode(key);
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;

    // Enable WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    // Run schema migrations
    schema::run_migrations(&conn)?;

    log::info!("Encrypted database initialized successfully");

    Ok(DbPool {
        conn: Arc::new(Mutex::new(conn)),
        encrypted: true,
    })
}

/// Encrypt an existing unencrypted database.
/// Creates a new encrypted copy and returns the path to it.
pub fn encrypt_database(
    unencrypted_path: &Path,
    encrypted_path: &Path,
    key: &[u8],
) -> Result<(), AppError> {
    log::info!(
        "Encrypting database from {} to {}",
        unencrypted_path.display(),
        encrypted_path.display()
    );

    register_vec_extension();

    // Open the unencrypted database
    let conn = Connection::open(unencrypted_path)?;

    // Export to encrypted database using SQLCipher's sqlcipher_export
    let key_hex = hex::encode(key);
    conn.execute_batch(&format!(
        r#"
        ATTACH DATABASE '{}' AS encrypted KEY "x'{}'";
        SELECT sqlcipher_export('encrypted');
        DETACH DATABASE encrypted;
        "#,
        encrypted_path.display(),
        key_hex
    ))?;

    log::info!("Database encryption completed");
    Ok(())
}

/// Decrypt an encrypted database to a new unencrypted file.
pub fn decrypt_database(
    encrypted_path: &Path,
    unencrypted_path: &Path,
    key: &[u8],
) -> Result<(), AppError> {
    log::info!(
        "Decrypting database from {} to {}",
        encrypted_path.display(),
        unencrypted_path.display()
    );

    register_vec_extension();

    // Open the encrypted database with the key
    let conn = Connection::open(encrypted_path)?;
    let key_hex = hex::encode(key);
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;

    // Export to unencrypted database
    conn.execute_batch(&format!(
        r#"
        ATTACH DATABASE '{}' AS plaintext KEY '';
        SELECT sqlcipher_export('plaintext');
        DETACH DATABASE plaintext;
        "#,
        unencrypted_path.display()
    ))?;

    log::info!("Database decryption completed");
    Ok(())
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
