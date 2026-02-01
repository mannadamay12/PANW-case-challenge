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
            title TEXT,
            entry_type TEXT DEFAULT 'reflection',
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

        -- Embedding metadata for version tracking (vec0 tables don't support extra columns)
        CREATE TABLE IF NOT EXISTS embedding_metadata (
            journal_id TEXT PRIMARY KEY,
            model_version TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
        );

        -- Chunk embeddings for better RAG on long entries
        CREATE TABLE IF NOT EXISTS embedding_chunks (
            id TEXT PRIMARY KEY,
            journal_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_journal ON embedding_chunks(journal_id);

        -- Vector embeddings for chunks (384-dim all-MiniLM-L6-v2)
        CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(
            chunk_id TEXT PRIMARY KEY,
            embedding FLOAT[384]
        );

        -- Journal templates table
        CREATE TABLE IF NOT EXISTS journal_templates (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            template_text TEXT NOT NULL,
            icon TEXT,
            category TEXT NOT NULL DEFAULT 'reflection',
            is_default BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_templates_is_default ON journal_templates(is_default);
        CREATE INDEX IF NOT EXISTS idx_templates_category ON journal_templates(category);

        -- Entry images table for inline image attachments
        CREATE TABLE IF NOT EXISTS entry_images (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            mime_type TEXT,
            file_size INTEGER,
            width INTEGER,
            height INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entry_id) REFERENCES journals(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_entry_images_entry_id ON entry_images(entry_id);

        -- Chat messages for AI companion (per-entry conversation history)
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            journal_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            FOREIGN KEY(journal_id) REFERENCES journals(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_journal ON chat_messages(journal_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
        "#,
    )?;

    // Create triggers separately (can't use IF NOT EXISTS with triggers in batch)
    create_fts_triggers(conn)?;

    // Add new columns to existing tables (for upgrades from older schema)
    add_journal_columns_if_missing(conn)?;

    // Seed default templates
    seed_default_templates(conn)?;

    log::info!("Database migrations completed");
    Ok(())
}

/// Add title and entry_type columns to journals table if they don't exist.
/// This handles upgrading from older database schemas.
fn add_journal_columns_if_missing(conn: &Connection) -> Result<(), AppError> {
    // Check if columns exist by querying table info
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(journals)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    // Add title column if missing
    if !columns.contains(&"title".to_string()) {
        log::info!("Adding 'title' column to journals table");
        conn.execute("ALTER TABLE journals ADD COLUMN title TEXT", [])?;
    }

    // Add entry_type column if missing
    if !columns.contains(&"entry_type".to_string()) {
        log::info!("Adding 'entry_type' column to journals table");
        conn.execute(
            "ALTER TABLE journals ADD COLUMN entry_type TEXT DEFAULT 'reflection'",
            [],
        )?;
    }

    Ok(())
}

/// Seed default templates if the table is empty.
fn seed_default_templates(conn: &Connection) -> Result<(), AppError> {
    // Check if default templates already exist
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM journal_templates WHERE is_default = 1",
        [],
        |row| row.get(0),
    )?;

    if count > 0 {
        log::info!("Default templates already seeded");
        return Ok(());
    }

    log::info!("Seeding default templates");

    let now = chrono::Utc::now().to_rfc3339();

    // Default templates data: (title, prompt, template_text, icon, category)
    let defaults = [
        // Growth
        (
            "Fear Setting",
            "What fears are holding you back?",
            "I am afraid of",
            "accessibility",
            "growth",
        ),
        (
            "Dream Big",
            "What would you do if nothing was holding you back?",
            "If nothing was holding me back, I would",
            "target",
            "growth",
        ),
        // Mindfulness
        (
            "Daily Gratitude",
            "What are three things I'm grateful for?",
            "Today I am grateful for",
            "heart",
            "mindfulness",
        ),
        (
            "Check-In",
            "How are you feeling right now?",
            "Right now, I feel",
            "check-circle",
            "mindfulness",
        ),
        // Morning
        (
            "Morning Intention",
            "What do I want to focus on today?",
            "Today I want to focus on",
            "sun",
            "morning",
        ),
        (
            "Dream Log",
            "What did I dream about last night?",
            "Last night, I dreamed",
            "moon",
            "morning",
        ),
        // Reflection
        (
            "One Win Today",
            "What's something you're proud of today?",
            "Something I'm proud of today is",
            "trophy",
            "reflection",
        ),
        (
            "Today I Learned",
            "What did you learn today?",
            "Today I learned",
            "lightbulb",
            "reflection",
        ),
    ];

    for (title, prompt, template_text, icon, category) in defaults {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO journal_templates (id, title, prompt, template_text, icon, category, is_default, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
            rusqlite::params![id, title, prompt, template_text, icon, category, now, now],
        )?;
    }

    log::info!("Seeded {} default templates", defaults.len());
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
