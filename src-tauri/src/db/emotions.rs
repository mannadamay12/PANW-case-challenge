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

/// Get the dominant emotion for entries on each date within a date range.
/// Returns a list of (date, dominant_emotion, entry_count) tuples.
pub fn get_daily_emotions(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<(String, Option<String>, u32)>, AppError> {
    // Get all entries with their dates in the range
    let mut stmt = conn.prepare(
        "SELECT j.id, date(j.created_at) as entry_date
         FROM journals j
         WHERE j.is_archived = 0
         AND date(j.created_at) >= ?1
         AND date(j.created_at) <= ?2
         ORDER BY entry_date",
    )?;

    let entries: Vec<(String, String)> = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Group entries by date
    let mut date_entries: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for (entry_id, date) in entries {
        date_entries.entry(date).or_default().push(entry_id);
    }

    // For each date, find the dominant emotion across all entries
    let mut results: Vec<(String, Option<String>, u32)> = Vec::new();

    for (date, entry_ids) in date_entries {
        let entry_count = entry_ids.len() as u32;

        // Guard against empty entry_ids (would produce malformed SQL)
        if entry_ids.is_empty() {
            results.push((date, None, 0));
            continue;
        }

        // Aggregate emotions across all entries for this date
        let placeholders: String = entry_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT emotion_label, SUM(confidence_score) as total_score
             FROM journal_emotions
             WHERE journal_id IN ({})
             GROUP BY emotion_label
             ORDER BY total_score DESC
             LIMIT 1",
            placeholders
        );

        let mut emotion_stmt = conn.prepare(&sql)?;
        let dominant: Option<String> = emotion_stmt
            .query_row(rusqlite::params_from_iter(entry_ids.iter()), |row| {
                row.get(0)
            })
            .ok();

        results.push((date, dominant, entry_count));
    }

    // Sort by date
    results.sort_by(|a, b| a.0.cmp(&b.0));

    Ok(results)
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
