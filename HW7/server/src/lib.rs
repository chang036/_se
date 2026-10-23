pub mod api;
pub mod store;
pub mod todo;

use crate::api::TodoApiState;
use crate::store::TodoStore;
use axum::Router;

pub fn create_router() -> Router {
    api::create_router(TodoApiState {
        store: TodoStore::new(),
    })
}

pub fn new_state() -> TodoApiState {
    TodoApiState {
        store: TodoStore::new(),
    }
}
