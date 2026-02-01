use rusqlite::{params, Connection};

use crate::error::AppError;

/// Get emotions for a journal entry as (label, score) pairs.
pub fn get(conn: &Connection, journal_id: &str) -> Result<Vec<(String, f32)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT emotion_label, confidence_score FROM journal_emotions WHERE journal_id = ?1 ORDER BY confidence_score DESC",
    )?;

    let emotions = stmt
        .query_map(params![journal_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)? as f32))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(emotions)
}

/// Store a single emotion for a journal entry.
pub fn store(conn: &Connection, journal_id: &str, label: &str, score: f32) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO journal_emotions (journal_id, emotion_label, confidence_score) VALUES (?1, ?2, ?3)",
        params![journal_id, label, score as f64],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::run_migrations;

    fn setup_test_db() -> Connection {
        // Register sqlite-vec extension before opening connection
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_store_and_get_emotions() {
        let conn = setup_test_db();

        // Create a journal entry first
        conn.execute(
            "INSERT INTO journals (id, content) VALUES ('test-id', 'Test content')",
            [],
        )
        .unwrap();

        store(&conn, "test-id", "Joy", 0.85).unwrap();
        store(&conn, "test-id", "Gratitude", 0.72).unwrap();
        store(&conn, "test-id", "Optimism", 0.65).unwrap();

        let retrieved = get(&conn, "test-id").unwrap();
        assert_eq!(retrieved.len(), 3);
        assert_eq!(retrieved[0].0, "Joy");
        assert!((retrieved[0].1 - 0.85).abs() < 0.01);
    }
}
