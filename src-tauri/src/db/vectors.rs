use rusqlite::Connection;

use crate::error::AppError;

/// Embedding dimension for all-MiniLM-L6-v2 model
pub const EMBEDDING_DIM: usize = 384;

/// Store an embedding for a journal entry.
/// Uses INSERT OR REPLACE to handle updates.
pub fn store_embedding(
    conn: &Connection,
    journal_id: &str,
    embedding: &[f32],
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

    Ok(())
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

/// Convert a float vector to a byte blob for storage.
fn embedding_to_blob(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        // Register sqlite-vec extension as auto_extension
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }

        let conn = Connection::open_in_memory().unwrap();

        // Create vector table
        conn.execute_batch(
            r#"
            CREATE VIRTUAL TABLE journal_embeddings USING vec0(
                journal_id TEXT PRIMARY KEY,
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
