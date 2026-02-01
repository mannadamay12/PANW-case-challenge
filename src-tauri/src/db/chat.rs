use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Chat message stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub journal_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub metadata: Option<String>,
}

/// Parameters for creating a new chat message.
#[derive(Debug, Deserialize)]
pub struct CreateMessageParams {
    pub journal_id: String,
    pub role: String,
    pub content: String,
    pub metadata: Option<String>,
}

/// Create a new chat message.
pub fn create(conn: &Connection, params: CreateMessageParams) -> Result<ChatMessage, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO chat_messages (id, journal_id, role, content, created_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            id,
            params.journal_id,
            params.role,
            params.content,
            now,
            params.metadata,
        ],
    )?;

    Ok(ChatMessage {
        id,
        journal_id: params.journal_id,
        role: params.role,
        content: params.content,
        created_at: now,
        metadata: params.metadata,
    })
}

/// List all chat messages for a journal entry, ordered by creation time.
pub fn list_for_entry(conn: &Connection, journal_id: &str) -> Result<Vec<ChatMessage>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, journal_id, role, content, created_at, metadata
         FROM chat_messages
         WHERE journal_id = ?1
         ORDER BY created_at ASC",
    )?;

    let messages = stmt
        .query_map([journal_id], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                journal_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(messages)
}

/// Delete all chat messages for a journal entry.
pub fn delete_for_entry(conn: &Connection, journal_id: &str) -> Result<usize, AppError> {
    let count = conn.execute(
        "DELETE FROM chat_messages WHERE journal_id = ?1",
        [journal_id],
    )?;
    Ok(count)
}

/// Get recent chat messages for context (most recent N messages).
pub fn get_recent_for_entry(
    conn: &Connection,
    journal_id: &str,
    limit: usize,
) -> Result<Vec<ChatMessage>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, journal_id, role, content, created_at, metadata
         FROM chat_messages
         WHERE journal_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;

    let messages = stmt
        .query_map(rusqlite::params![journal_id, limit as i64], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                journal_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Reverse to get chronological order
    let mut messages = messages;
    messages.reverse();
    Ok(messages)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }
        let conn = Connection::open_in_memory().unwrap();
        crate::db::schema::run_migrations(&conn).unwrap();
        conn
    }

    fn create_test_journal(conn: &Connection) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO journals (id, content) VALUES (?1, ?2)",
            rusqlite::params![id, "Test journal content"],
        )
        .unwrap();
        id
    }

    #[test]
    fn test_create_and_list_messages() {
        let conn = setup_test_db();
        let journal_id = create_test_journal(&conn);

        // Create messages
        let msg1 = create(
            &conn,
            CreateMessageParams {
                journal_id: journal_id.clone(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                metadata: None,
            },
        )
        .unwrap();

        let msg2 = create(
            &conn,
            CreateMessageParams {
                journal_id: journal_id.clone(),
                role: "assistant".to_string(),
                content: "Hi there!".to_string(),
                metadata: None,
            },
        )
        .unwrap();

        // List messages
        let messages = list_for_entry(&conn, &journal_id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].id, msg1.id);
        assert_eq!(messages[1].id, msg2.id);
    }

    #[test]
    fn test_delete_for_entry() {
        let conn = setup_test_db();
        let journal_id = create_test_journal(&conn);

        create(
            &conn,
            CreateMessageParams {
                journal_id: journal_id.clone(),
                role: "user".to_string(),
                content: "Test".to_string(),
                metadata: None,
            },
        )
        .unwrap();

        let count = delete_for_entry(&conn, &journal_id).unwrap();
        assert_eq!(count, 1);

        let messages = list_for_entry(&conn, &journal_id).unwrap();
        assert!(messages.is_empty());
    }

    #[test]
    fn test_cascade_delete_with_journal() {
        let conn = setup_test_db();
        let journal_id = create_test_journal(&conn);

        create(
            &conn,
            CreateMessageParams {
                journal_id: journal_id.clone(),
                role: "user".to_string(),
                content: "Test".to_string(),
                metadata: None,
            },
        )
        .unwrap();

        // Delete the journal
        conn.execute("DELETE FROM journals WHERE id = ?1", [&journal_id])
            .unwrap();

        // Messages should be cascade deleted
        let messages = list_for_entry(&conn, &journal_id).unwrap();
        assert!(messages.is_empty());
    }
}
