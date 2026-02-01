use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Journal {
    pub id: String,
    pub content: String,
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
pub fn create(conn: &Connection, content: &str) -> Result<CreateEntryResponse, AppError> {
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "Content cannot be empty".to_string(),
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    conn.execute(
        "INSERT INTO journals (id, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, content, now.to_rfc3339(), now.to_rfc3339()],
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
            "SELECT id, content, created_at, updated_at, is_archived FROM journals WHERE id = ?1",
            params![id],
            |row| {
                Ok(Journal {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    created_at: parse_datetime(row.get::<_, String>(2)?),
                    updated_at: parse_datetime(row.get::<_, String>(3)?),
                    is_archived: row.get(4)?,
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

    let mut sql =
        String::from("SELECT id, content, created_at, updated_at, is_archived FROM journals");

    if let Some(archived) = archived {
        sql.push_str(&format!(
            " WHERE is_archived = {}",
            if archived { 1 } else { 0 }
        ));
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT ?1 OFFSET ?2");

    let mut stmt = conn.prepare(&sql)?;
    let journals = stmt
        .query_map(params![limit, offset], |row| {
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: parse_datetime(row.get::<_, String>(2)?),
                updated_at: parse_datetime(row.get::<_, String>(3)?),
                is_archived: row.get(4)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(journals)
}

/// Update a journal entry's content.
pub fn update(conn: &Connection, id: &str, content: &str) -> Result<Journal, AppError> {
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "Content cannot be empty".to_string(),
        ));
    }

    let now = Utc::now();

    let rows_affected = conn.execute(
        "UPDATE journals SET content = ?1, updated_at = ?2 WHERE id = ?3",
        params![content, now.to_rfc3339(), id],
    )?;

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
pub fn search(conn: &Connection, query: &str) -> Result<Vec<Journal>, AppError> {
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

    let sql = r#"
        SELECT j.id, j.content, j.created_at, j.updated_at, j.is_archived
        FROM journals j
        JOIN journals_fts fts ON j.rowid = fts.rowid
        WHERE journals_fts MATCH ?1
        ORDER BY rank
        LIMIT 50
    "#;

    let mut stmt = conn.prepare(sql)?;
    let journals = stmt
        .query_map(params![escaped_query], |row| {
            Ok(Journal {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: parse_datetime(row.get::<_, String>(2)?),
                updated_at: parse_datetime(row.get::<_, String>(3)?),
                is_archived: row.get(4)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(journals)
}

/// Parse a datetime string into a DateTime<Utc>.
fn parse_datetime(s: String) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
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
    fn test_create_and_get() {
        let conn = setup_test_db();

        let result = create(&conn, "Test entry content").unwrap();
        assert_eq!(result.status, "success");

        let journal = get(&conn, &result.id).unwrap();
        assert_eq!(journal.content, "Test entry content");
        assert!(!journal.is_archived);
    }

    #[test]
    fn test_create_empty_content_fails() {
        let conn = setup_test_db();

        let result = create(&conn, "   ");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_entries() {
        let conn = setup_test_db();

        create(&conn, "Entry 1").unwrap();
        create(&conn, "Entry 2").unwrap();
        create(&conn, "Entry 3").unwrap();

        let entries = list(&conn, Some(10), None, None).unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_update_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "Original content").unwrap();
        let updated = update(&conn, &result.id, "Updated content").unwrap();

        assert_eq!(updated.content, "Updated content");
    }

    #[test]
    fn test_delete_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "To be deleted").unwrap();
        let deleted = delete(&conn, &result.id).unwrap();

        assert!(deleted.success);

        let get_result = get(&conn, &result.id);
        assert!(get_result.is_err());
    }

    #[test]
    fn test_archive_entry() {
        let conn = setup_test_db();

        let result = create(&conn, "To be archived").unwrap();
        let archived = archive(&conn, &result.id).unwrap();

        assert!(archived.is_archived);
    }

    #[test]
    fn test_search_entries() {
        let conn = setup_test_db();

        create(&conn, "Today was a good day").unwrap();
        create(&conn, "Feeling anxious about tomorrow").unwrap();
        create(&conn, "Good morning sunshine").unwrap();

        let results = search(&conn, "good").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_list_archived_only() {
        let conn = setup_test_db();

        let entry1 = create(&conn, "Entry 1").unwrap();
        create(&conn, "Entry 2").unwrap();
        archive(&conn, &entry1.id).unwrap();

        let archived = list(&conn, None, None, Some(true)).unwrap();
        assert_eq!(archived.len(), 1);

        let not_archived = list(&conn, None, None, Some(false)).unwrap();
        assert_eq!(not_archived.len(), 1);
    }
}
