use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Emotion classification result from sentiment analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEmotion {
    pub id: i64,
    pub journal_id: String,
    pub emotion_label: String,
    pub confidence_score: f64,
}

/// Store emotion classification results for a journal entry.
pub fn store_emotions(
    conn: &Connection,
    journal_id: &str,
    emotions: &[(String, f64)],
) -> Result<(), AppError> {
    for (label, score) in emotions {
        conn.execute(
            "INSERT INTO journal_emotions (journal_id, emotion_label, confidence_score) VALUES (?1, ?2, ?3)",
            params![journal_id, label, score],
        )?;
    }

    log::info!(
        "Stored {} emotions for entry: id={}",
        emotions.len(),
        journal_id
    );

    Ok(())
}

/// Get emotions for a journal entry.
pub fn get_emotions(conn: &Connection, journal_id: &str) -> Result<Vec<JournalEmotion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, journal_id, emotion_label, confidence_score FROM journal_emotions WHERE journal_id = ?1 ORDER BY confidence_score DESC",
    )?;

    let emotions = stmt
        .query_map(params![journal_id], |row| {
            Ok(JournalEmotion {
                id: row.get(0)?,
                journal_id: row.get(1)?,
                emotion_label: row.get(2)?,
                confidence_score: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(emotions)
}

/// Delete emotions for a journal entry.
/// Called automatically via CASCADE when journal is deleted.
pub fn delete_emotions(conn: &Connection, journal_id: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM journal_emotions WHERE journal_id = ?1",
        params![journal_id],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::run_migrations;

    fn setup_test_db() -> Connection {
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

        let emotions = vec![
            ("Joy".to_string(), 0.85),
            ("Gratitude".to_string(), 0.72),
            ("Optimism".to_string(), 0.65),
        ];

        store_emotions(&conn, "test-id", &emotions).unwrap();

        let retrieved = get_emotions(&conn, "test-id").unwrap();
        assert_eq!(retrieved.len(), 3);
        assert_eq!(retrieved[0].emotion_label, "Joy");
        assert!((retrieved[0].confidence_score - 0.85).abs() < 0.001);
    }

    #[test]
    fn test_delete_emotions() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO journals (id, content) VALUES ('test-id', 'Test content')",
            [],
        )
        .unwrap();

        let emotions = vec![("Sadness".to_string(), 0.9)];
        store_emotions(&conn, "test-id", &emotions).unwrap();

        delete_emotions(&conn, "test-id").unwrap();

        let retrieved = get_emotions(&conn, "test-id").unwrap();
        assert!(retrieved.is_empty());
    }
}
