use std::str::FromStr;

use chrono::{DateTime, Utc};
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

    // Use static SQL strings to avoid any string formatting
    let (sql, params): (&str, Vec<rusqlite::types::Value>) = match archived {
        Some(true) => (
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals WHERE is_archived = 1 ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
            vec![limit.into(), offset.into()],
        ),
        Some(false) => (
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals WHERE is_archived = 0 ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
            vec![limit.into(), offset.into()],
        ),
        None => (
            "SELECT id, content, title, entry_type, created_at, updated_at, is_archived FROM journals ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
            vec![limit.into(), offset.into()],
        ),
    };

    let mut stmt = conn.prepare(sql)?;
    let rows: Vec<Result<Journal, rusqlite::Error>> = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
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
        .collect();

    let mut journals = Vec::with_capacity(rows.len());
    let mut error_count = 0;
    for result in rows {
        match result {
            Ok(journal) => journals.push(journal),
            Err(e) => {
                log::error!("Failed to parse journal row: {}", e);
                error_count += 1;
            }
        }
    }
    if error_count > 0 {
        log::warn!("Skipped {} corrupted journal rows during list", error_count);
    }

    Ok(journals)
}

/// Update a journal entry's content and/or title.
pub fn update(
    conn: &Connection,
    id: &str,
    content: Option<&str>,
    title: Option<&str>,
    entry_type: Option<&str>,
) -> Result<Journal, AppError> {
    // Validate content if provided
    if let Some(c) = content {
        if c.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Content cannot be empty".to_string(),
            ));
        }
    }

    let now = Utc::now();

    // Build dynamic update query based on provided fields
    let mut updates = vec!["updated_at = ?1"];
    let mut param_idx = 2;

    if content.is_some() {
        updates.push("content = ?2");
        param_idx = 3;
    }
    if title.is_some() {
        updates.push(if param_idx == 2 {
            "title = ?2"
        } else {
            "title = ?3"
        });
        param_idx += 1;
    }
    if entry_type.is_some() {
        let placeholder = match param_idx {
            2 => "entry_type = ?2",
            3 => "entry_type = ?3",
            _ => "entry_type = ?4",
        };
        updates.push(placeholder);
    }

    let sql = format!(
        "UPDATE journals SET {} WHERE id = ?{}",
        updates.join(", "),
        param_idx
    );

    // Execute with the appropriate parameters
    let rows_affected = match (content, title, entry_type) {
        (Some(c), Some(t), Some(e)) => {
            conn.execute(&sql, params![now.to_rfc3339(), c, t, e, id])?
        }
        (Some(c), Some(t), None) => conn.execute(&sql, params![now.to_rfc3339(), c, t, id])?,
        (Some(c), None, Some(e)) => conn.execute(&sql, params![now.to_rfc3339(), c, e, id])?,
        (Some(c), None, None) => conn.execute(&sql, params![now.to_rfc3339(), c, id])?,
        (None, Some(t), Some(e)) => conn.execute(&sql, params![now.to_rfc3339(), t, e, id])?,
        (None, Some(t), None) => conn.execute(&sql, params![now.to_rfc3339(), t, id])?,
        (None, None, Some(e)) => conn.execute(&sql, params![now.to_rfc3339(), e, id])?,
        (None, None, None) => conn.execute(&sql, params![now.to_rfc3339(), id])?,
    };

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
    let rows: Vec<Result<Journal, rusqlite::Error>> = stmt
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
        .collect();

    let mut journals = Vec::with_capacity(rows.len());
    let mut error_count = 0;
    for result in rows {
        match result {
            Ok(journal) => journals.push(journal),
            Err(e) => {
                log::error!("Failed to parse journal row in search: {}", e);
                error_count += 1;
            }
        }
    }
    if error_count > 0 {
        log::warn!(
            "Skipped {} corrupted journal rows during search",
            error_count
        );
    }

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
        let updated = update(&conn, &result.id, Some("Updated content"), None, None).unwrap();

        assert_eq!(updated.content, "Updated content");
    }

    #[test]
    fn test_update_title_only() {
        let conn = setup_test_db();

        let result = create(&conn, "Some content", None, None).unwrap();
        let updated = update(&conn, &result.id, None, Some("New Title"), None).unwrap();

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
