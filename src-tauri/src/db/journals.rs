use std::str::FromStr;

use chrono::{DateTime, Datelike, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Entry types for different journaling modes.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EntryType {
    Morning,
    Evening,
    Gratitude,
    #[default]
    Reflection,
}

impl EntryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntryType::Morning => "morning",
            EntryType::Evening => "evening",
            EntryType::Gratitude => "gratitude",
            EntryType::Reflection => "reflection",
        }
    }
}

impl FromStr for EntryType {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            "morning" => EntryType::Morning,
            "evening" => EntryType::Evening,
            "gratitude" => EntryType::Gratitude,
            _ => EntryType::Reflection,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Journal {
    pub id: String,
    pub content: String,
    pub title: Option<String>,
    pub entry_type: EntryType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_archived: bool,
}

#[derive(Debug, Serialize)]
pub struct CreateEntryResponse {
    pub status: String,
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct DeleteResponse {
    pub success: bool,
}

/// Create a new journal entry.
pub fn create(
    conn: &Connection,
    content: &str,
    title: Option<&str>,
    entry_type: Option<&str>,
) -> Result<CreateEntryResponse, AppError> {
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "Content cannot be empty".to_string(),
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    let entry_type_str = entry_type.unwrap_or("reflection");

    conn.execute(
        "INSERT INTO journals (id, content, title, entry_type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, content, title, entry_type_str, now.to_rfc3339(), now.to_rfc3339()],
    )?;

    log::info!("Entry created: id={}", id);

    Ok(CreateEntryResponse {
        status: "success".to_string(),
        id,
    })
}

/// Get a single journal entry by ID.
pub fn get(conn: &Connection, id: &str) -> Result<Journal, AppError> {
    let journal = conn
        .query_row(
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals WHERE id = ?1",
            params![id],
            |row| {
                let entry_type_str: Option<String> = row.get(3)?;
                Ok(Journal {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    title: row.get(2)?,
                    entry_type: entry_type_str.as_deref().unwrap_or_default().parse().unwrap_or_default(),
                    created_at: parse_datetime(row.get::<_, String>(4)?),
                    updated_at: parse_datetime(row.get::<_, String>(5)?),
                    is_archived: row.get(6)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Journal entry not found: {}", id)))?;

    Ok(journal)
}

/// List journal entries with pagination.
pub fn list(
    conn: &Connection,
    limit: Option<i64>,
    offset: Option<i64>,
    archived: Option<bool>,
) -> Result<Vec<Journal>, AppError> {
    let limit = limit.unwrap_or(50).min(100);
    let offset = offset.unwrap_or(0);

    let (sql, use_archived_param) = if archived.is_some() {
        (
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals WHERE is_archived = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3".to_string(),
            true,
        )
    } else {
        (
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals ORDER BY created_at DESC LIMIT ?1 OFFSET ?2".to_string(),
            false,
        )
    };

    let mut stmt = conn.prepare(&sql)?;

    let row_mapper = |row: &rusqlite::Row| {
        let entry_type_str: Option<String> = row.get(3)?;
        Ok(Journal {
            id: row.get(0)?,
            content: row.get(1)?,
            title: row.get(2)?,
            entry_type: entry_type_str
                .as_deref()
                .unwrap_or_default()
                .parse()
                .unwrap_or_default(),
            created_at: parse_datetime(row.get::<_, String>(4)?),
            updated_at: parse_datetime(row.get::<_, String>(5)?),
            is_archived: row.get(6)?,
        })
    };

    let journals: Vec<Journal> = if use_archived_param {
        let archived_val: i32 = if archived.unwrap_or(false) { 1 } else { 0 };
        stmt.query_map(params![archived_val, limit, offset], row_mapper)?
    } else {
        stmt.query_map(params![limit, offset], row_mapper)?
    }
    .filter_map(|r| {
        r.map_err(|e| log::error!("Failed to parse journal row: {}", e))
            .ok()
    })
    .collect();

    Ok(journals)
}

/// Update a journal entry's content, title, entry type, and/or created_at date.
pub fn update(
    conn: &Connection,
    id: &str,
    content: Option<&str>,
    title: Option<&str>,
    entry_type: Option<&str>,
    created_at: Option<&str>,
) -> Result<Journal, AppError> {
    // Validate content if provided
    if let Some(c) = content {
        if c.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Content cannot be empty".to_string(),
            ));
        }
    }

    // Validate created_at if provided (must be valid RFC3339)
    if let Some(ca) = created_at {
        DateTime::parse_from_rfc3339(ca).map_err(|_| {
            AppError::InvalidInput(format!("Invalid created_at date format: {}", ca))
        })?;
    }

    let now = Utc::now();

    // Build dynamic update query based on provided fields
    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    updates.push("updated_at = ?".to_string());
    params_vec.push(Box::new(now.to_rfc3339()));

    if let Some(c) = content {
        updates.push("content = ?".to_string());
        params_vec.push(Box::new(c.to_string()));
    }
    if let Some(t) = title {
        updates.push("title = ?".to_string());
        params_vec.push(Box::new(t.to_string()));
    }
    if let Some(e) = entry_type {
        updates.push("entry_type = ?".to_string());
        params_vec.push(Box::new(e.to_string()));
    }
    if let Some(ca) = created_at {
        updates.push("created_at = ?".to_string());
        params_vec.push(Box::new(ca.to_string()));
    }

    params_vec.push(Box::new(id.to_string()));

    // Renumber placeholders
    let numbered_updates: Vec<String> = updates
        .iter()
        .enumerate()
        .map(|(i, u)| u.replacen("?", &format!("?{}", i + 1), 1))
        .collect();

    let sql = format!(
        "UPDATE journals SET {} WHERE id = ?{}",
        numbered_updates.join(", "),
        params_vec.len()
    );

    log::info!("update SQL: {}", sql);
    log::info!(
        "update params count: {}, created_at provided: {}",
        params_vec.len(),
        created_at.is_some()
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let rows_affected = conn.execute(&sql, params_refs.as_slice())?;

    log::info!("update rows_affected: {}", rows_affected);

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!(
            "Journal entry not found: {}",
            id
        )));
    }

    log::info!("Entry updated: id={}", id);

    get(conn, id)
}

/// Delete a journal entry.
pub fn delete(conn: &Connection, id: &str) -> Result<DeleteResponse, AppError> {
    let rows_affected = conn.execute("DELETE FROM journals WHERE id = ?1", params![id])?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!(
            "Journal entry not found: {}",
            id
        )));
    }

    log::info!("Entry deleted: id={}", id);

    Ok(DeleteResponse { success: true })
}

/// Archive a journal entry.
pub fn archive(conn: &Connection, id: &str) -> Result<Journal, AppError> {
    let now = Utc::now();

    let rows_affected = conn.execute(
        "UPDATE journals SET is_archived = 1, updated_at = ?1 WHERE id = ?2",
        params![now.to_rfc3339(), id],
    )?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!(
            "Journal entry not found: {}",
            id
        )));
    }

    log::info!("Entry archived: id={}", id);

    get(conn, id)
}

/// Unarchive a journal entry.
pub fn unarchive(conn: &Connection, id: &str) -> Result<Journal, AppError> {
    let now = Utc::now();

    let rows_affected = conn.execute(
        "UPDATE journals SET is_archived = 0, updated_at = ?1 WHERE id = ?2",
        params![now.to_rfc3339(), id],
    )?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!(
            "Journal entry not found: {}",
            id
        )));
    }

    log::info!("Entry unarchived: id={}", id);

    get(conn, id)
}

/// Search journal entries using FTS5.
pub fn search(
    conn: &Connection,
    query: &str,
    include_archived: bool,
) -> Result<Vec<Journal>, AppError> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    // Escape special FTS5 characters and create a prefix search
    let escaped_query = query
        .replace('"', "\"\"")
        .split_whitespace()
        .map(|word| format!("\"{}\"*", word))
        .collect::<Vec<_>>()
        .join(" ");

    let sql = if include_archived {
        r#"
            SELECT j.id, j.content, j.title, j.entry_type, j.created_at, j.updated_at, j.is_archived
            FROM journals j
            JOIN journals_fts fts ON j.rowid = fts.rowid
            WHERE journals_fts MATCH ?1
            ORDER BY rank
            LIMIT 50
        "#
    } else {
        r#"
            SELECT j.id, j.content, j.title, j.entry_type, j.created_at, j.updated_at, j.is_archived
            FROM journals j
            JOIN journals_fts fts ON j.rowid = fts.rowid
            WHERE journals_fts MATCH ?1 AND j.is_archived = 0
            ORDER BY rank
            LIMIT 50
        "#
    };

    let mut stmt = conn.prepare(sql)?;
    let journals: Vec<Journal> = stmt
        .query_map(params![escaped_query], |row| {
            let entry_type_str: Option<String> = row.get(3)?;
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                title: row.get(2)?,
                entry_type: entry_type_str
                    .as_deref()
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or_default(),
                created_at: parse_datetime(row.get::<_, String>(4)?),
                updated_at: parse_datetime(row.get::<_, String>(5)?),
                is_archived: row.get(6)?,
            })
        })?
        .filter_map(|r| {
            r.map_err(|e| log::error!("Failed to parse journal row: {}", e))
                .ok()
        })
        .collect();

    Ok(journals)
}

/// Get entries that don't have titles (for bulk title generation).
pub fn list_without_titles(
    conn: &Connection,
    limit: Option<i64>,
) -> Result<Vec<Journal>, AppError> {
    let limit = limit.unwrap_or(50).min(100);

    let mut stmt = conn.prepare(
        "SELECT id, content, title, entry_type, created_at, updated_at, is_archived
         FROM journals
         WHERE title IS NULL AND content != ''
         ORDER BY created_at DESC
         LIMIT ?1",
    )?;

    let journals: Vec<Journal> = stmt
        .query_map(params![limit], |row| {
            let entry_type_str: Option<String> = row.get(3)?;
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                title: row.get(2)?,
                entry_type: entry_type_str
                    .as_deref()
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or_default(),
                created_at: parse_datetime(row.get::<_, String>(4)?),
                updated_at: parse_datetime(row.get::<_, String>(5)?),
                is_archived: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(journals)
}

/// Update only the title of an entry.
pub fn update_title(conn: &Connection, id: &str, title: &str) -> Result<(), AppError> {
    let now = Utc::now();
    conn.execute(
        "UPDATE journals SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now.to_rfc3339(), id],
    )?;
    Ok(())
}

/// Parse a datetime string into a DateTime<Utc>.
/// Logs an error if parsing fails (indicates data corruption) and falls back to Utc::now().
fn parse_datetime(s: String) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|e| {
            log::error!(
                "Corrupt datetime in database: '{}' (parse error: {}). Using current time as fallback.",
                s, e
            );
            Utc::now()
        })
}

/// Stats for the journal dashboard.
#[derive(Debug, Serialize)]
pub struct JournalStats {
    pub total_entries: i64,
    pub streak_days: i64,
    pub entries_this_week: i64,
    pub entries_this_month: i64,
}

/// Extended streak information for the dashboard.
#[derive(Debug, Serialize)]
pub struct StreakInfo {
    pub current_streak: u32,
    pub longest_streak: u32,
    pub last_entry_date: Option<String>,
    pub entries_this_week: Vec<String>,
}

/// Emotion summary for a single day.
#[derive(Debug, Serialize)]
pub struct DayEmotions {
    pub date: String,
    pub dominant_emotion: Option<String>,
    pub entry_count: u32,
}

/// Get journal statistics for the dashboard.
pub fn get_stats(conn: &Connection) -> Result<JournalStats, AppError> {
    // Total count (excluding archived)
    let total_entries: i64 = conn.query_row(
        "SELECT COUNT(*) FROM journals WHERE is_archived = 0",
        [],
        |row| row.get(0),
    )?;

    // Entries this week (Sunday start)
    let entries_this_week: i64 = conn.query_row(
        "SELECT COUNT(*) FROM journals
         WHERE is_archived = 0
         AND created_at >= date('now', 'weekday 0', '-7 days')",
        [],
        |row| row.get(0),
    )?;

    // Entries this month
    let entries_this_month: i64 = conn.query_row(
        "SELECT COUNT(*) FROM journals
         WHERE is_archived = 0
         AND created_at >= date('now', 'start of month')",
        [],
        |row| row.get(0),
    )?;

    // Streak: consecutive days with entries ending today or yesterday
    let streak_days = calculate_streak(conn)?;

    Ok(JournalStats {
        total_entries,
        streak_days,
        entries_this_week,
        entries_this_month,
    })
}

/// Calculate the current journaling streak.
/// Streak is the number of consecutive days with at least one entry,
/// ending today or yesterday.
fn calculate_streak(conn: &Connection) -> Result<i64, AppError> {
    // Get distinct dates with entries, ordered descending
    let mut stmt = conn.prepare(
        "SELECT DISTINCT date(created_at) as entry_date
         FROM journals
         WHERE is_archived = 0
         ORDER BY entry_date DESC
         LIMIT 365",
    )?;

    let dates: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    if dates.is_empty() {
        return Ok(0);
    }

    let today = Local::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    // Parse first date
    let first_date = NaiveDate::parse_from_str(&dates[0], "%Y-%m-%d")
        .map_err(|_| AppError::InvalidInput("Invalid date format".to_string()))?;

    // Streak must start from today or yesterday
    if first_date != today && first_date != yesterday {
        return Ok(0);
    }

    let mut streak = 1i64;
    for i in 1..dates.len() {
        let current = NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d").ok();
        let previous = NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d").ok();

        match (current, previous) {
            (Some(c), Some(p)) if c - p == chrono::Duration::days(1) => streak += 1,
            _ => break,
        }
    }

    Ok(streak)
}

/// Get extended streak information for the dashboard.
pub fn get_streak_info(conn: &Connection) -> Result<StreakInfo, AppError> {
    // Get distinct dates with entries, ordered descending
    let mut stmt = conn.prepare(
        "SELECT DISTINCT date(created_at) as entry_date
         FROM journals
         WHERE is_archived = 0
         ORDER BY entry_date DESC
         LIMIT 365",
    )?;

    let dates: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    let today = Local::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    // Calculate current streak
    let current_streak = if dates.is_empty() {
        0
    } else {
        let first_date = NaiveDate::parse_from_str(&dates[0], "%Y-%m-%d").ok();
        if first_date != Some(today) && first_date != Some(yesterday) {
            0
        } else {
            let mut streak = 1u32;
            for i in 1..dates.len() {
                let current = NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d").ok();
                let previous = NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d").ok();
                match (current, previous) {
                    (Some(c), Some(p)) if c - p == chrono::Duration::days(1) => streak += 1,
                    _ => break,
                }
            }
            streak
        }
    };

    // Calculate longest streak
    let longest_streak = calculate_longest_streak(&dates);

    // Last entry date
    let last_entry_date = dates.first().cloned();

    // Get dates with entries this week (Sunday to Saturday)
    let week_start = today - chrono::Duration::days(today.weekday().num_days_from_sunday() as i64);
    let entries_this_week: Vec<String> = dates
        .iter()
        .filter_map(|d| {
            let date = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()?;
            if date >= week_start && date <= today {
                Some(d.clone())
            } else {
                None
            }
        })
        .collect();

    Ok(StreakInfo {
        current_streak,
        longest_streak,
        last_entry_date,
        entries_this_week,
    })
}

/// Calculate the longest streak from a list of dates (descending order).
fn calculate_longest_streak(dates: &[String]) -> u32 {
    if dates.is_empty() {
        return 0;
    }

    let mut longest = 1u32;
    let mut current = 1u32;

    for i in 1..dates.len() {
        let prev = NaiveDate::parse_from_str(&dates[i - 1], "%Y-%m-%d").ok();
        let curr = NaiveDate::parse_from_str(&dates[i], "%Y-%m-%d").ok();

        match (prev, curr) {
            (Some(p), Some(c)) if p - c == chrono::Duration::days(1) => {
                current += 1;
                if current > longest {
                    longest = current;
                }
            }
            _ => {
                current = 1;
            }
        }
    }

    longest
}

/// Get entries from the same date in previous years ("On This Day").
pub fn get_on_this_day(conn: &Connection) -> Result<Vec<Journal>, AppError> {
    let today = Local::now().date_naive();
    let month_day = today.format("%m-%d").to_string();

    let mut stmt = conn.prepare(
        "SELECT id, content, title, entry_type, created_at, updated_at, is_archived
         FROM journals
         WHERE is_archived = 0
         AND strftime('%m-%d', created_at) = ?1
         AND date(created_at) < date('now')
         ORDER BY created_at DESC
         LIMIT 10",
    )?;

    let journals: Vec<Journal> = stmt
        .query_map(params![month_day], |row| {
            let entry_type_str: Option<String> = row.get(3)?;
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                title: row.get(2)?,
                entry_type: entry_type_str
                    .as_deref()
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or_default(),
                created_at: parse_datetime(row.get::<_, String>(4)?),
                updated_at: parse_datetime(row.get::<_, String>(5)?),
                is_archived: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(journals)
}

/// Get entries within a date range with their dates (for calendar display).
pub fn list_entries_by_date_range(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<(String, String)>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, date(created_at) as entry_date
         FROM journals
         WHERE is_archived = 0
         AND date(created_at) >= ?1
         AND date(created_at) <= ?2
         ORDER BY created_at DESC",
    )?;

    let entries: Vec<(String, String)> = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

/// Get full journal entries within a date range (for summary generation).
pub fn get_entries_in_range(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<Journal>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, content, title, entry_type, created_at, updated_at, is_archived
         FROM journals
         WHERE is_archived = 0
         AND date(created_at) >= ?1
         AND date(created_at) <= ?2
         ORDER BY created_at DESC",
    )?;

    let journals: Vec<Journal> = stmt
        .query_map(params![start_date, end_date], |row| {
            let entry_type_str: Option<String> = row.get(3)?;
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                title: row.get(2)?,
                entry_type: entry_type_str
                    .as_deref()
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or_default(),
                created_at: parse_datetime(row.get::<_, String>(4)?),
                updated_at: parse_datetime(row.get::<_, String>(5)?),
                is_archived: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(journals)
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
    fn test_create_and_get() {
        let conn = setup_test_db();

        let result = create(&conn, "Test entry content", None, None).unwrap();
        assert_eq!(result.status, "success");

        let journal = get(&conn, &result.id).unwrap();
        assert_eq!(journal.content, "Test entry content");
        assert!(!journal.is_archived);
        assert_eq!(journal.entry_type, EntryType::Reflection);
    }

    #[test]
    fn test_create_with_title_and_type() {
        let conn = setup_test_db();

        let result = create(
            &conn,
            "Morning thoughts",
            Some("A Fresh Start"),
            Some("morning"),
        )
        .unwrap();
        let journal = get(&conn, &result.id).unwrap();

        assert_eq!(journal.title, Some("A Fresh Start".to_string()));
        assert_eq!(journal.entry_type, EntryType::Morning);
    }

    #[test]
    fn test_create_empty_content_fails() {
        let conn = setup_test_db();

        let result = create(&conn, "   ", None, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_list_entries() {
        let conn = setup_test_db();

        create(&conn, "Entry 1", None, None).unwrap();
        create(&conn, "Entry 2", None, None).unwrap();
        create(&conn, "Entry 3", None, None).unwrap();

        let entries = list(&conn, Some(10), None, None).unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_update_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "Original content", None, None).unwrap();
        let updated = update(&conn, &result.id, Some("Updated content"), None, None, None).unwrap();

        assert_eq!(updated.content, "Updated content");
    }

    #[test]
    fn test_update_title_only() {
        let conn = setup_test_db();

        let result = create(&conn, "Some content", None, None).unwrap();
        let updated = update(&conn, &result.id, None, Some("New Title"), None, None).unwrap();

        assert_eq!(updated.title, Some("New Title".to_string()));
        assert_eq!(updated.content, "Some content");
    }

    #[test]
    fn test_delete_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "To be deleted", None, None).unwrap();
        let deleted = delete(&conn, &result.id).unwrap();

        assert!(deleted.success);

        let get_result = get(&conn, &result.id);
        assert!(get_result.is_err());
    }

    #[test]
    fn test_archive_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "To be archived", None, None).unwrap();
        let archived = archive(&conn, &result.id).unwrap();

        assert!(archived.is_archived);
    }

    #[test]
    fn test_unarchive_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "To be unarchived", None, None).unwrap();
        archive(&conn, &result.id).unwrap();
        let unarchived = unarchive(&conn, &result.id).unwrap();

        assert!(!unarchived.is_archived);
    }

    #[test]
    fn test_search_entries() {
        let conn = setup_test_db();

        create(&conn, "Today was a good day", None, None).unwrap();
        create(&conn, "Feeling anxious about tomorrow", None, None).unwrap();
        create(&conn, "Good morning sunshine", None, None).unwrap();

        let results = search(&conn, "good", false).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_excludes_archived() {
        let conn = setup_test_db();

        let entry1 = create(&conn, "Today was a good day", None, None).unwrap();
        create(&conn, "Good morning sunshine", None, None).unwrap();
        archive(&conn, &entry1.id).unwrap();

        // Without archived
        let results = search(&conn, "good", false).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "Good morning sunshine");

        // With archived
        let results_with_archived = search(&conn, "good", true).unwrap();
        assert_eq!(results_with_archived.len(), 2);
    }

    #[test]
    fn test_list_archived_only() {
        let conn = setup_test_db();

        let entry1 = create(&conn, "Entry 1", None, None).unwrap();
        create(&conn, "Entry 2", None, None).unwrap();
        archive(&conn, &entry1.id).unwrap();

        let archived = list(&conn, None, None, Some(true)).unwrap();
        assert_eq!(archived.len(), 1);

        let not_archived = list(&conn, None, None, Some(false)).unwrap();
        assert_eq!(not_archived.len(), 1);
    }
}
