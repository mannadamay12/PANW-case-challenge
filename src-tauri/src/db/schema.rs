use rusqlite::Connection;

use crate::error::AppError;

/// Run all database migrations.
/// Migrations are idempotent (uses IF NOT EXISTS).
pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    log::info!("Running database migrations");

    conn.execute_batch(
        r#"
        -- Core journal entries table
        CREATE TABLE IF NOT EXISTS journals (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_archived BOOLEAN DEFAULT 0
        );

        -- Sentiment analysis results (GoEmotions taxonomy)
        CREATE TABLE IF NOT EXISTS journal_emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_id TEXT NOT NULL,
            emotion_label TEXT NOT NULL,
            confidence_score REAL NOT NULL,
            FOREIGN KEY(journal_id) REFERENCES journals(id) ON DELETE CASCADE
        );

        -- Index for archived queries
        CREATE INDEX IF NOT EXISTS idx_journals_archived ON journals(is_archived);
        CREATE INDEX IF NOT EXISTS idx_journals_created ON journals(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_journal_emotions_journal_id ON journal_emotions(journal_id);

        -- Full-text search for hybrid retrieval
        CREATE VIRTUAL TABLE IF NOT EXISTS journals_fts USING fts5(
            content,
            content='journals',
            content_rowid='rowid'
        );

        -- Vector embeddings for semantic search (384-dim all-MiniLM-L6-v2)
        CREATE VIRTUAL TABLE IF NOT EXISTS journal_embeddings USING vec0(
            journal_id TEXT PRIMARY KEY,
            embedding FLOAT[384]
        );
        "#,
    )?;

    // Create triggers separately (can't use IF NOT EXISTS with triggers in batch)
    create_fts_triggers(conn)?;

    log::info!("Database migrations completed");
    Ok(())
}

/// Create FTS triggers for keeping journals_fts in sync.
/// Drops and recreates to ensure they're up to date.
fn create_fts_triggers(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        r#"
        DROP TRIGGER IF EXISTS journals_ai;
        DROP TRIGGER IF EXISTS journals_ad;
        DROP TRIGGER IF EXISTS journals_au;

        CREATE TRIGGER journals_ai AFTER INSERT ON journals BEGIN
            INSERT INTO journals_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
        END;

        CREATE TRIGGER journals_ad AFTER DELETE ON journals BEGIN
            INSERT INTO journals_fts(journals_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
        END;

        CREATE TRIGGER journals_au AFTER UPDATE ON journals BEGIN
            INSERT INTO journals_fts(journals_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
            INSERT INTO journals_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
        END;
        "#,
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        // Register sqlite-vec extension before opening connection
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn test_migrations_idempotent() {
        let conn = setup_test_db();

        // Run migrations twice - should not error
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"journals".to_string()));
        assert!(tables.contains(&"journal_emotions".to_string()));
    }
}
