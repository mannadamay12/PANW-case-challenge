use rusqlite::Connection;

use crate::error::AppError;

/// Embedding dimension for all-MiniLM-L6-v2 model
pub const EMBEDDING_DIM: usize = 384;

/// Current embedding model version for tracking
pub const EMBEDDING_MODEL_VERSION: &str = "all-MiniLM-L6-v2";

/// Store an embedding for a journal entry with model version tracking.
/// Uses INSERT OR REPLACE to handle updates.
pub fn store_embedding(
    conn: &Connection,
    journal_id: &str,
    embedding: &[f32],
) -> Result<(), AppError> {
    store_embedding_with_version(conn, journal_id, embedding, EMBEDDING_MODEL_VERSION)
}

/// Store an embedding for a journal entry with explicit model version.
pub fn store_embedding_with_version(
    conn: &Connection,
    journal_id: &str,
    embedding: &[f32],
    model_version: &str,
) -> Result<(), AppError> {
    if embedding.len() != EMBEDDING_DIM {
        return Err(AppError::InvalidInput(format!(
            "Expected embedding of dimension {}, got {}",
            EMBEDDING_DIM,
            embedding.len()
        )));
    }

    let embedding_blob = embedding_to_blob(embedding);

    conn.execute(
        "INSERT OR REPLACE INTO journal_embeddings(journal_id, embedding) VALUES (?, ?)",
        rusqlite::params![journal_id, embedding_blob],
    )?;

    // Store metadata with model version
    conn.execute(
        "INSERT OR REPLACE INTO embedding_metadata(journal_id, model_version, created_at) VALUES (?, ?, datetime('now'))",
        rusqlite::params![journal_id, model_version],
    )?;

    Ok(())
}

/// Get the model version used to generate an embedding.
#[allow(dead_code)]
pub fn get_embedding_version(
    conn: &Connection,
    journal_id: &str,
) -> Result<Option<String>, AppError> {
    let mut stmt =
        conn.prepare("SELECT model_version FROM embedding_metadata WHERE journal_id = ?")?;

    match stmt.query_row([journal_id], |row| row.get(0)) {
        Ok(version) => Ok(Some(version)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Get all embeddings that need re-generation (different model version).
#[allow(dead_code)]
pub fn get_outdated_embeddings(conn: &Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        r#"
        SELECT je.journal_id
        FROM journal_embeddings je
        LEFT JOIN embedding_metadata em ON je.journal_id = em.journal_id
        WHERE em.model_version IS NULL OR em.model_version != ?
        "#,
    )?;

    let results = stmt
        .query_map([EMBEDDING_MODEL_VERSION], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;

    Ok(results)
}

/// Search for similar journal entries by vector similarity.
/// Returns journal IDs ordered by similarity (closest first).
pub fn search_similar(
    conn: &Connection,
    query_embedding: &[f32],
    limit: usize,
) -> Result<Vec<(String, f64)>, AppError> {
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(AppError::InvalidInput(format!(
            "Expected query embedding of dimension {}, got {}",
            EMBEDDING_DIM,
            query_embedding.len()
        )));
    }

    let query_blob = embedding_to_blob(query_embedding);

    let mut stmt = conn.prepare(
        r#"
        SELECT journal_id, distance
        FROM journal_embeddings
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
        "#,
    )?;

    let results = stmt
        .query_map(rusqlite::params![query_blob, limit as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(results)
}

/// Check if an embedding exists for a journal entry.
pub fn has_embedding(conn: &Connection, journal_id: &str) -> Result<bool, AppError> {
    let mut stmt = conn.prepare("SELECT 1 FROM journal_embeddings WHERE journal_id = ? LIMIT 1")?;

    let exists = stmt.exists([journal_id])?;
    Ok(exists)
}

// --- Chunk Embedding Functions ---

/// A chunk with its embedding for storage.
pub struct ChunkData {
    pub chunk_index: usize,
    pub chunk_text: String,
    pub embedding: Vec<f32>,
}

/// Store multiple chunk embeddings for a journal entry.
/// Replaces any existing chunks for the entry.
pub fn store_chunk_embeddings(
    conn: &Connection,
    journal_id: &str,
    chunks: &[ChunkData],
) -> Result<(), AppError> {
    // Delete existing chunks for this entry
    conn.execute(
        "DELETE FROM embedding_chunks WHERE journal_id = ?",
        [journal_id],
    )?;

    // Also delete from chunk_embeddings (need to find chunk IDs first)
    let existing_chunk_ids: Vec<String> = conn
        .prepare("SELECT id FROM embedding_chunks WHERE journal_id = ?")?
        .query_map([journal_id], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    for chunk_id in existing_chunk_ids {
        // vec0 tables use DELETE with journal_id match
        let _ = conn.execute(
            "DELETE FROM chunk_embeddings WHERE chunk_id = ?",
            [&chunk_id],
        );
    }

    // Insert new chunks
    for chunk in chunks {
        if chunk.embedding.len() != EMBEDDING_DIM {
            return Err(AppError::InvalidInput(format!(
                "Expected embedding of dimension {}, got {}",
                EMBEDDING_DIM,
                chunk.embedding.len()
            )));
        }

        let chunk_id = uuid::Uuid::new_v4().to_string();

        // Insert chunk metadata
        conn.execute(
            "INSERT INTO embedding_chunks (id, journal_id, chunk_index, chunk_text, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
            rusqlite::params![chunk_id, journal_id, chunk.chunk_index as i64, chunk.chunk_text],
        )?;

        // Insert chunk embedding
        let embedding_blob = embedding_to_blob(&chunk.embedding);
        conn.execute(
            "INSERT INTO chunk_embeddings (chunk_id, embedding) VALUES (?, ?)",
            rusqlite::params![chunk_id, embedding_blob],
        )?;
    }

    Ok(())
}

/// Search result including chunk information.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ChunkSearchResult {
    pub journal_id: String,
    pub chunk_id: String,
    pub chunk_text: String,
    pub distance: f64,
}

/// Search for similar chunks by vector similarity.
/// Returns chunk results ordered by similarity (closest first).
pub fn search_similar_chunks(
    conn: &Connection,
    query_embedding: &[f32],
    limit: usize,
) -> Result<Vec<ChunkSearchResult>, AppError> {
    if query_embedding.len() != EMBEDDING_DIM {
        return Err(AppError::InvalidInput(format!(
            "Expected query embedding of dimension {}, got {}",
            EMBEDDING_DIM,
            query_embedding.len()
        )));
    }

    let query_blob = embedding_to_blob(query_embedding);

    let mut stmt = conn.prepare(
        r#"
        SELECT ce.chunk_id, ce.distance, ec.journal_id, ec.chunk_text
        FROM chunk_embeddings ce
        JOIN embedding_chunks ec ON ec.id = ce.chunk_id
        WHERE ce.embedding MATCH ?
        ORDER BY ce.distance
        LIMIT ?
        "#,
    )?;

    let results = stmt
        .query_map(rusqlite::params![query_blob, limit as i64], |row| {
            Ok(ChunkSearchResult {
                chunk_id: row.get(0)?,
                distance: row.get(1)?,
                journal_id: row.get(2)?,
                chunk_text: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Check if chunks exist for a journal entry.
#[allow(dead_code)]
pub fn has_chunks(conn: &Connection, journal_id: &str) -> Result<bool, AppError> {
    let mut stmt = conn.prepare("SELECT 1 FROM embedding_chunks WHERE journal_id = ? LIMIT 1")?;
    let exists = stmt.exists([journal_id])?;
    Ok(exists)
}

/// Convert a float vector to a byte blob for storage.
fn embedding_to_blob(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        // Register sqlite-vec extension as auto_extension
        #[allow(clippy::missing_transmute_annotations)]
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }

        let conn = Connection::open_in_memory().unwrap();

        // Create tables matching schema.rs
        conn.execute_batch(
            r#"
            CREATE VIRTUAL TABLE journal_embeddings USING vec0(
                journal_id TEXT PRIMARY KEY,
                embedding FLOAT[384]
            );

            CREATE TABLE embedding_metadata (
                journal_id TEXT PRIMARY KEY,
                model_version TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE embedding_chunks (
                id TEXT PRIMARY KEY,
                journal_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE VIRTUAL TABLE chunk_embeddings USING vec0(
                chunk_id TEXT PRIMARY KEY,
                embedding FLOAT[384]
            );
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_store_and_has_embedding() {
        let conn = setup_test_db();
        let embedding: Vec<f32> = (0..384).map(|i| i as f32 / 384.0).collect();

        assert!(!has_embedding(&conn, "test-id").unwrap());
        store_embedding(&conn, "test-id", &embedding).unwrap();
        assert!(has_embedding(&conn, "test-id").unwrap());
    }

    #[test]
    fn test_invalid_dimension() {
        let conn = setup_test_db();
        let bad_embedding: Vec<f32> = vec![1.0, 2.0, 3.0]; // Wrong dimension

        let result = store_embedding(&conn, "test-id", &bad_embedding);
        assert!(result.is_err());
    }

    #[test]
    fn test_search_similar() {
        let conn = setup_test_db();

        // Store several embeddings
        for i in 0..5 {
            let embedding: Vec<f32> = (0..384).map(|j| (i * 100 + j) as f32 / 1000.0).collect();
            store_embedding(&conn, &format!("entry-{}", i), &embedding).unwrap();
        }

        // Search with a query similar to entry-0
        let query: Vec<f32> = (0..384).map(|j| j as f32 / 1000.0 + 0.001).collect();
        let results = search_similar(&conn, &query, 3).unwrap();

        assert_eq!(results.len(), 3);
        // First result should be closest to entry-0
        assert_eq!(results[0].0, "entry-0");
    }
}
