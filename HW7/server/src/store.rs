use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::todo::{create_todo, UpdateTodoRequest, Todo};

#[derive(Clone)]
pub struct TodoStore {
    inner: Arc<RwLock<HashMap<String, Todo>>>,
}

impl Default for TodoStore {
    fn default() -> Self {
        Self::new()
    }
}

impl TodoStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create(&self, raw_title: &str) -> Result<Todo, String> {
        let todo = create_todo(raw_title)?;
        let mut guard = self.inner.write().await;
        guard.insert(todo.id.clone(), todo.clone());
        Ok(todo)
    }

    pub async fn list(&self) -> Vec<Todo> {
        let guard = self.inner.read().await;
        let mut todos: Vec<Todo> = guard.values().cloned().collect();
        todos.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        todos
    }

    pub async fn get(&self, id: &str) -> Result<Option<Todo>, String> {
        let guard = self.inner.read().await;
        Ok(guard.get(id).cloned())
    }

    /// Toggle (or set) the completed flag of a todo.
    pub async fn set_completed(&self, id: &str, completed: bool) -> Result<Option<Todo>, String> {
        let mut guard = self.inner.write().await;
        let todo = guard
            .get_mut(id)
            .ok_or_else(|| format!("todo {id} not found"))?;
        todo.completed = completed;
        todo.updated_at = chrono::Utc::now();
        Ok(Some(todo.clone()))
    }

    pub async fn update(
        &self,
        id: &str,
        patch: &UpdateTodoRequest,
    ) -> Result<Option<Todo>, String> {
        let mut guard = self.inner.write().await;
        let todo = guard
            .get_mut(id)
            .ok_or_else(|| format!("todo {id} not found"))?;
        if let Some(title) = &patch.title {
            let validated = crate::todo::validate_title(title)?;
            todo.title = validated;
        }
        if let Some(completed) = patch.completed {
            todo.completed = completed;
        }
        todo.updated_at = chrono::Utc::now();
        Ok(Some(todo.clone()))
    }

    pub async fn delete(&self, id: &str) -> Result<bool, String> {
        let mut guard = self.inner.write().await;
        Ok(guard.remove(id).is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn create_then_list_returns_the_todo() {
        let store = TodoStore::new();
        let todo = store.create("買牛奶").await.unwrap();
        assert_eq!(todo.title, "買牛奶");
        assert!(!todo.completed);

        let list = store.list().await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, todo.id);
    }

    #[tokio::test]
    async fn create_rejects_empty_title() {
        let store = TodoStore::new();
        assert!(store.create("  ").await.is_err());
        assert!(store.list().await.is_empty());
    }

    #[tokio::test]
    async fn toggle_marks_todo_completed() {
        let store = TodoStore::new();
        let todo = store.create("寫測試").await.unwrap();
        let updated = store.set_completed(&todo.id, true).await.unwrap().unwrap();
        assert!(updated.completed);

        let fetched = store.get(&todo.id).await.unwrap().unwrap();
        assert!(fetched.completed);
    }

    #[tokio::test]
    async fn delete_removes_todo() {
        let store = TodoStore::new();
        let todo = store.create("臨時事項").await.unwrap();
        assert!(store.delete(&todo.id).await.unwrap());
        assert!(store.get(&todo.id).await.unwrap().is_none());
    }
}
