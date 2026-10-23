use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const MAX_TITLE_LENGTH: usize = 200;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTodoRequest {
    pub title: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UpdateTodoRequest {
    pub title: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TodoResponse {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

impl From<Todo> for TodoResponse {
    fn from(todo: Todo) -> Self {
        Self {
            id: todo.id,
            title: todo.title,
            completed: todo.completed,
            created_at: todo.created_at,
            updated_at: todo.updated_at,
        }
    }
}

/// Trim the raw input and validate it. Returns an error message when invalid.
pub fn validate_title(raw: &str) -> Result<String, String> {
    let title = raw.trim();
    if title.is_empty() {
        return Err("title is required".to_string());
    }
    if title.chars().count() > MAX_TITLE_LENGTH {
        return Err(format!("title must be at most {MAX_TITLE_LENGTH} characters"));
    }
    Ok(title.to_string())
}

/// Domain factory: builds a new todo with a fresh id, timestamps and undone state.
pub fn create_todo(title: &str) -> Result<Todo, String> {
    let title = validate_title(title)?;
    let now = Utc::now();
    Ok(Todo {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        completed: false,
        created_at: now,
        updated_at: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_todo_accepts_non_empty_title() {
        let todo = create_todo("  買牛奶  ").expect("should create");
        assert_eq!(todo.title, "買牛奶");
        assert!(!todo.completed);
        assert!(!todo.id.is_empty());
    }

    #[test]
    fn create_todo_rejects_empty_title() {
        assert!(create_todo("   ").is_err());
        assert!(create_todo("").is_err());
    }

    #[test]
    fn create_todo_rejects_overly_long_title() {
        let long = "x".repeat(MAX_TITLE_LENGTH + 1);
        let err = create_todo(&long).unwrap_err();
        assert!(err.contains("at most"));
    }

    #[test]
    fn validate_title_trims_and_keeps_content() {
        assert_eq!(validate_title("  hello  ").unwrap(), "hello");
        assert!(validate_title("").is_err());
    }
}
