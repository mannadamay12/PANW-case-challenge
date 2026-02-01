use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Metadata for an image attached to a journal entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryImage {
    pub id: String,
    pub entry_id: String,
    pub filename: String,
    pub relative_path: String,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: String,
}

/// Parameters for inserting a new image.
#[derive(Debug)]
pub struct InsertImageParams {
    pub entry_id: String,
    pub filename: String,
    pub relative_path: String,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

/// Insert a new image record into the database.
pub fn insert_image(conn: &Connection, params: InsertImageParams) -> Result<EntryImage, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO entry_images (id, entry_id, filename, relative_path, mime_type, file_size, width, height, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            params.entry_id,
            params.filename,
            params.relative_path,
            params.mime_type,
            params.file_size,
            params.width,
            params.height,
            now,
        ],
    )?;

    Ok(EntryImage {
        id,
        entry_id: params.entry_id,
        filename: params.filename,
        relative_path: params.relative_path,
        mime_type: params.mime_type,
        file_size: params.file_size,
        width: params.width,
        height: params.height,
        created_at: now,
    })
}

/// Get all images for a specific journal entry.
pub fn get_images_for_entry(
    conn: &Connection,
    entry_id: &str,
) -> Result<Vec<EntryImage>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, entry_id, filename, relative_path, mime_type, file_size, width, height, created_at
         FROM entry_images
         WHERE entry_id = ?1
         ORDER BY created_at ASC",
    )?;

    let images = stmt
        .query_map(params![entry_id], |row| {
            Ok(EntryImage {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                filename: row.get(2)?,
                relative_path: row.get(3)?,
                mime_type: row.get(4)?,
                file_size: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(images)
}

/// Get a single image by ID.
pub fn get_image(conn: &Connection, image_id: &str) -> Result<EntryImage, AppError> {
    conn.query_row(
        "SELECT id, entry_id, filename, relative_path, mime_type, file_size, width, height, created_at
         FROM entry_images
         WHERE id = ?1",
        params![image_id],
        |row| {
            Ok(EntryImage {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                filename: row.get(2)?,
                relative_path: row.get(3)?,
                mime_type: row.get(4)?,
                file_size: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Image not found: {}", image_id))
        }
        _ => AppError::Database(e),
    })
}

/// Delete a single image by ID.
pub fn delete_image(conn: &Connection, image_id: &str) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM entry_images WHERE id = ?1", params![image_id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Image not found: {}", image_id)));
    }
    Ok(())
}

/// Delete all images for a specific entry.
/// Note: This is kept for potential future use; currently CASCADE handles DB cleanup.
#[allow(dead_code)]
pub fn delete_images_for_entry(conn: &Connection, entry_id: &str) -> Result<usize, AppError> {
    let rows = conn.execute(
        "DELETE FROM entry_images WHERE entry_id = ?1",
        params![entry_id],
    )?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE journals (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL
            );
            CREATE TABLE entry_images (
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
            INSERT INTO journals (id, content) VALUES ('entry-1', 'test content');
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_insert_and_get_image() {
        let conn = setup_test_db();

        let params = InsertImageParams {
            entry_id: "entry-1".to_string(),
            filename: "test.png".to_string(),
            relative_path: "images/entry-1/test.png".to_string(),
            mime_type: Some("image/png".to_string()),
            file_size: Some(1024),
            width: Some(800),
            height: Some(600),
        };

        let image = insert_image(&conn, params).unwrap();
        assert_eq!(image.filename, "test.png");
        assert_eq!(image.entry_id, "entry-1");

        let images = get_images_for_entry(&conn, "entry-1").unwrap();
        assert_eq!(images.len(), 1);
        assert_eq!(images[0].id, image.id);
    }

    #[test]
    fn test_delete_image() {
        let conn = setup_test_db();

        let params = InsertImageParams {
            entry_id: "entry-1".to_string(),
            filename: "test.png".to_string(),
            relative_path: "images/entry-1/test.png".to_string(),
            mime_type: None,
            file_size: None,
            width: None,
            height: None,
        };

        let image = insert_image(&conn, params).unwrap();
        delete_image(&conn, &image.id).unwrap();

        let images = get_images_for_entry(&conn, "entry-1").unwrap();
        assert!(images.is_empty());
    }
}
