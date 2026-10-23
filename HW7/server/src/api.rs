use axum::body::Body;
use axum::extract::{Json, Path, State};
use axum::http::{Response as HttpResponse, StatusCode};
use axum::response::IntoResponse;
use axum::{routing::get, Router};

use crate::store::TodoStore;
use crate::todo::{CreateTodoRequest, ErrorResponse, TodoResponse, UpdateTodoRequest};

#[derive(Clone)]
pub struct TodoApiState {
    pub store: TodoStore,
}

pub fn create_router(state: TodoApiState) -> Router {
    Router::new()
        .route("/api/todos", get(list_todos).post(create_todo))
        .route(
            "/api/todos/{id}",
            get(get_todo).put(update_todo).delete(delete_todo),
        )
        .with_state(state)
}

/// Error type that carries an HTTP status code and maps into an axum response.
#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> HttpResponse<Body> {
        let body = serde_json::to_string(&ErrorResponse {
            error: self.error,
        })
        .expect("failed to serialize error response");
        let response = HttpResponse::builder()
            .status(self.status)
            .header(axum::http::header::CONTENT_TYPE, "application/json")
            .body(Body::from(body))
            .expect("failed to build error response");
        response
    }
}

fn error(status: StatusCode, message: impl Into<String>) -> AppError {
    AppError {
        status,
        error: message.into(),
    }
}

type ApiResult<T> = Result<axum::Json<T>, AppError>;

async fn list_todos(State(state): State<TodoApiState>) -> ApiResult<Vec<TodoResponse>> {
    let todos = state.store.list().await;
    Ok(axum::Json(
        todos
            .into_iter()
            .map(TodoResponse::from)
            .collect::<Vec<TodoResponse>>(),
    ))
}

async fn create_todo(
    State(state): State<TodoApiState>,
    Json(req): Json<CreateTodoRequest>,
) -> Result<HttpResponse<Body>, AppError> {
    let todo = state
        .store
        .create(&req.title)
        .await
        .map_err(|e| error(StatusCode::BAD_REQUEST, e))?;
    let mut response = axum::Json(TodoResponse::from(todo)).into_response();
    *response.status_mut() = StatusCode::CREATED;
    Ok(response)
}

async fn get_todo(
    State(state): State<TodoApiState>,
    Path(id): Path<String>,
) -> ApiResult<TodoResponse> {
    match state.store.get(&id).await {
        Ok(Some(todo)) => Ok(axum::Json(TodoResponse::from(todo))),
        Ok(None) => Err(error(
            StatusCode::NOT_FOUND,
            format!("todo {id} not found"),
        )),
        Err(e) => Err(error(StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn update_todo(
    State(state): State<TodoApiState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTodoRequest>,
) -> ApiResult<TodoResponse> {
    if req.title.is_none() && req.completed.is_none() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "at least one of title or completed is required",
        ));
    }
    match state.store.update(&id, &req).await {
        Ok(Some(todo)) => Ok(axum::Json(TodoResponse::from(todo))),
        Ok(None) => Err(error(
            StatusCode::NOT_FOUND,
            format!("todo {id} not found"),
        )),
        Err(e) => Err(error(StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn delete_todo(
    State(state): State<TodoApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    match state.store.delete(&id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(error(
            StatusCode::NOT_FOUND,
            format!("todo {id} not found"),
        )),
        Err(e) => Err(error(StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}
