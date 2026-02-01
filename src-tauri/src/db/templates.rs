use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Template categories for organization.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TemplateCategory {
    Growth,
    Mindfulness,
    Morning,
    #[default]
    Reflection,
}

impl TemplateCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            TemplateCategory::Growth => "growth",
            TemplateCategory::Mindfulness => "mindfulness",
            TemplateCategory::Morning => "morning",
            TemplateCategory::Reflection => "reflection",
        }
    }
}

impl std::str::FromStr for TemplateCategory {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            "growth" => TemplateCategory::Growth,
            "mindfulness" => TemplateCategory::Mindfulness,
            "morning" => TemplateCategory::Morning,
            _ => TemplateCategory::Reflection,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub template_text: String,
    pub icon: Option<String>,
    pub category: TemplateCategory,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CreateTemplateResponse {
    pub status: String,
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct DeleteTemplateResponse {
    pub success: bool,
}

/// Create a new template.
pub fn create(
    conn: &Connection,
    title: &str,
    prompt: &str,
    template_text: &str,
    icon: Option<&str>,
    category: &str,
) -> Result<CreateTemplateResponse, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::InvalidInput("Title cannot be empty".to_string()));
    }
    if prompt.trim().is_empty() {
        return Err(AppError::InvalidInput("Prompt cannot be empty".to_string()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    conn.execute(
        "INSERT INTO journal_templates (id, title, prompt, template_text, icon, category, is_default, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
        params![
            id,
            title,
            prompt,
            template_text,
            icon,
            category,
            now.to_rfc3339(),
            now.to_rfc3339()
        ],
    )?;

    log::info!("Template created: id={}, title={}", id, title);

    Ok(CreateTemplateResponse {
        status: "success".to_string(),
        id,
    })
}

/// Get a single template by ID.
pub fn get(conn: &Connection, id: &str) -> Result<Template, AppError> {
    let template = conn
        .query_row(
            "SELECT id, title, prompt, template_text, icon, category, is_default, created_at, updated_at
             FROM journal_templates WHERE id = ?1",
            params![id],
            |row| {
                let category_str: String = row.get(5)?;
                Ok(Template {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    prompt: row.get(2)?,
                    template_text: row.get(3)?,
                    icon: row.get(4)?,
                    category: category_str.parse().unwrap_or_default(),
                    is_default: row.get(6)?,
                    created_at: parse_datetime(row.get::<_, String>(7)?),
                    updated_at: parse_datetime(row.get::<_, String>(8)?),
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Template not found: {}", id)))?;

    Ok(template)
}

/// List all templates, sorted by category, then is_default DESC, then created_at DESC.
pub fn list(conn: &Connection) -> Result<Vec<Template>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, prompt, template_text, icon, category, is_default, created_at, updated_at
         FROM journal_templates
         ORDER BY
            CASE category
                WHEN 'growth' THEN 1
                WHEN 'mindfulness' THEN 2
                WHEN 'morning' THEN 3
                WHEN 'reflection' THEN 4
                ELSE 5
            END,
            is_default DESC,
            created_at DESC",
    )?;

    let templates = stmt
        .query_map([], |row| {
            let category_str: String = row.get(5)?;
            Ok(Template {
                id: row.get(0)?,
                title: row.get(1)?,
                prompt: row.get(2)?,
                template_text: row.get(3)?,
                icon: row.get(4)?,
                category: category_str.parse().unwrap_or_default(),
                is_default: row.get(6)?,
                created_at: parse_datetime(row.get::<_, String>(7)?),
                updated_at: parse_datetime(row.get::<_, String>(8)?),
            })
        })?
        .filter_map(|r| {
            r.map_err(|e| log::error!("Failed to parse template row: {}", e))
                .ok()
        })
        .collect();

    Ok(templates)
}

/// List templates by category.
pub fn list_by_category(conn: &Connection, category: &str) -> Result<Vec<Template>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, prompt, template_text, icon, category, is_default, created_at, updated_at
         FROM journal_templates
         WHERE category = ?1
         ORDER BY is_default DESC, created_at DESC",
    )?;

    let templates = stmt
        .query_map(params![category], |row| {
            let category_str: String = row.get(5)?;
            Ok(Template {
                id: row.get(0)?,
                title: row.get(1)?,
                prompt: row.get(2)?,
                template_text: row.get(3)?,
                icon: row.get(4)?,
                category: category_str.parse().unwrap_or_default(),
                is_default: row.get(6)?,
                created_at: parse_datetime(row.get::<_, String>(7)?),
                updated_at: parse_datetime(row.get::<_, String>(8)?),
            })
        })?
        .filter_map(|r| {
            r.map_err(|e| log::error!("Failed to parse template row: {}", e))
                .ok()
        })
        .collect();

    Ok(templates)
}

/// Update a template. Only non-None fields are updated.
/// Cannot update is_default (protected field).
pub fn update(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    prompt: Option<&str>,
    template_text: Option<&str>,
    icon: Option<&str>,
    category: Option<&str>,
) -> Result<Template, AppError> {
    // Validate inputs if provided
    if let Some(t) = title {
        if t.trim().is_empty() {
            return Err(AppError::InvalidInput("Title cannot be empty".to_string()));
        }
    }
    if let Some(p) = prompt {
        if p.trim().is_empty() {
            return Err(AppError::InvalidInput("Prompt cannot be empty".to_string()));
        }
    }

    let now = Utc::now();

    // Build dynamic update query
    let mut updates = vec!["updated_at = ?1"];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.to_rfc3339())];

    if let Some(t) = title {
        updates.push("title = ?");
        params_vec.push(Box::new(t.to_string()));
    }
    if let Some(p) = prompt {
        updates.push("prompt = ?");
        params_vec.push(Box::new(p.to_string()));
    }
    if let Some(tt) = template_text {
        updates.push("template_text = ?");
        params_vec.push(Box::new(tt.to_string()));
    }
    if let Some(i) = icon {
        updates.push("icon = ?");
        params_vec.push(Box::new(i.to_string()));
    }
    if let Some(c) = category {
        updates.push("category = ?");
        params_vec.push(Box::new(c.to_string()));
    }

    // Build numbered placeholders
    let mut numbered_updates = Vec::new();
    for (i, update) in updates.iter().enumerate() {
        if update.contains('?') && !update.contains("?1") {
            numbered_updates.push(update.replace('?', &format!("?{}", i + 1)));
        } else {
            numbered_updates.push(update.to_string());
        }
    }

    params_vec.push(Box::new(id.to_string()));
    let id_param_num = params_vec.len();

    let sql = format!(
        "UPDATE journal_templates SET {} WHERE id = ?{}",
        numbered_updates.join(", "),
        id_param_num
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let rows_affected = conn.execute(&sql, params_refs.as_slice())?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Template not found: {}", id)));
    }

    log::info!("Template updated: id={}", id);
    get(conn, id)
}

/// Delete a template.
/// Cannot delete default templates.
pub fn delete(conn: &Connection, id: &str) -> Result<DeleteTemplateResponse, AppError> {
    // Check if it's a default template
    let is_default: bool = conn
        .query_row(
            "SELECT is_default FROM journal_templates WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Template not found: {}", id)))?;

    if is_default {
        return Err(AppError::InvalidInput(
            "Cannot delete default templates".to_string(),
        ));
    }

    let rows_affected = conn.execute("DELETE FROM journal_templates WHERE id = ?1", params![id])?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Template not found: {}", id)));
    }

    log::info!("Template deleted: id={}", id);
    Ok(DeleteTemplateResponse { success: true })
}

/// Parse a datetime string into a DateTime<Utc>.
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

        let result = create(
            &conn,
            "Test Template",
            "Test prompt?",
            "Test text",
            Some("heart"),
            "growth",
        )
        .unwrap();
        assert_eq!(result.status, "success");

        let template = get(&conn, &result.id).unwrap();
        assert_eq!(template.title, "Test Template");
        assert_eq!(template.prompt, "Test prompt?");
        assert_eq!(template.template_text, "Test text");
        assert_eq!(template.icon, Some("heart".to_string()));
        assert_eq!(template.category, TemplateCategory::Growth);
        assert!(!template.is_default);
    }

    #[test]
    fn test_create_empty_title_fails() {
        let conn = setup_test_db();
        let result = create(&conn, "   ", "prompt", "text", None, "reflection");
        assert!(result.is_err());
    }

    #[test]
    fn test_list_templates() {
        let conn = setup_test_db();

        // 12 default templates are seeded by migrations
        let initial_count = list(&conn).unwrap().len();
        assert!(
            initial_count >= 12,
            "Should have at least 12 default templates"
        );

        create(&conn, "T1", "P1", "Text1", None, "growth").unwrap();
        create(&conn, "T2", "P2", "Text2", None, "mindfulness").unwrap();
        create(&conn, "T3", "P3", "Text3", None, "morning").unwrap();

        let templates = list(&conn).unwrap();
        assert_eq!(templates.len(), initial_count + 3);
    }

    #[test]
    fn test_list_by_category() {
        let conn = setup_test_db();

        // Get baseline counts (includes seeded defaults)
        let initial_growth = list_by_category(&conn, "growth").unwrap().len();
        let initial_mindfulness = list_by_category(&conn, "mindfulness").unwrap().len();

        create(&conn, "T1", "P1", "Text1", None, "growth").unwrap();
        create(&conn, "T2", "P2", "Text2", None, "growth").unwrap();
        create(&conn, "T3", "P3", "Text3", None, "mindfulness").unwrap();

        let growth = list_by_category(&conn, "growth").unwrap();
        assert_eq!(growth.len(), initial_growth + 2);

        let mindfulness = list_by_category(&conn, "mindfulness").unwrap();
        assert_eq!(mindfulness.len(), initial_mindfulness + 1);
    }

    #[test]
    fn test_update_template() {
        let conn = setup_test_db();

        let result = create(&conn, "Original", "OP", "OT", None, "growth").unwrap();
        let updated = update(
            &conn,
            &result.id,
            Some("Updated"),
            None,
            None,
            Some("sun"),
            None,
        )
        .unwrap();

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.prompt, "OP");
        assert_eq!(updated.icon, Some("sun".to_string()));
    }

    #[test]
    fn test_delete_template() {
        let conn = setup_test_db();

        let result = create(&conn, "To delete", "P", "T", None, "reflection").unwrap();
        let deleted = delete(&conn, &result.id).unwrap();
        assert!(deleted.success);

        let get_result = get(&conn, &result.id);
        assert!(get_result.is_err());
    }
}
