use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::json;
use tower::ServiceExt;
use todo_server::create_router;

async fn send(
    app: &axum::Router,
    method: Method,
    uri: &str,
    body: Option<serde_json::Value>,
) -> axum::response::Response {
    let mut builder = Request::builder().method(method).uri(uri);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    let body = body
        .map(|v| Body::from(serde_json::to_string(&v).unwrap()))
        .unwrap_or_else(Body::empty);
    let request = builder.body(body).unwrap();
    app.clone().oneshot(request).await.unwrap()
}

async fn response_json(response: axum::response::Response) -> serde_json::Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn list_todos_returns_empty_array() {
    let app = create_router();
    let response = send(&app, Method::GET, "/api/todos", None).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    assert!(body.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn create_todo_returns_201_with_todo_payload() {
    let app = create_router();
    let response = send(
        &app,
        Method::POST,
        "/api/todos",
        Some(json!({ "title": "Write integration tests" })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response_json(response).await;
    assert_eq!(body["title"], "Write integration tests");
    assert_eq!(body["completed"], false);
    assert!(!body["id"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn create_todo_with_empty_title_returns_400() {
    let app = create_router();
    let response = send(&app, Method::POST, "/api/todos", Some(json!({ "title": "   " }))).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn get_todo_by_id_returns_created_todo() {
    let app = create_router();
    let created = send(
        &app,
        Method::POST,
        "/api/todos",
        Some(json!({ "title": "買牛奶" })),
    )
    .await;
    assert_eq!(created.status(), StatusCode::CREATED);
    let created_body = response_json(created).await;
    let id = created_body["id"].as_str().unwrap().to_string();

    let response = send(&app, Method::GET, &format!("/api/todos/{id}"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response).await;
    assert_eq!(body["id"], id);
    assert_eq!(body["title"], "買牛奶");
}

#[tokio::test]
async fn get_unknown_todo_returns_404() {
    let app = create_router();
    let response = send(&app, Method::GET, "/api/todos/does-not-exist", None).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn update_todo_toggle_completed() {
    let app = create_router();
    let created = send(
        &app,
        Method::POST,
        "/api/todos",
        Some(json!({ "title": "寫測試" })),
    )
    .await;
    let created_body = response_json(created).await;
    let id = created_body["id"].as_str().unwrap().to_string();

    let updated = send(
        &app,
        Method::PUT,
        &format!("/api/todos/{id}"),
        Some(json!({ "completed": true })),
    )
    .await;
    assert_eq!(updated.status(), StatusCode::OK);
    let body = response_json(updated).await;
    assert_eq!(body["completed"], true);

    let updated = send(
        &app,
        Method::PUT,
        &format!("/api/todos/{id}"),
        Some(json!({ "completed": false })),
    )
    .await;
    assert_eq!(updated.status(), StatusCode::OK);
    let body = response_json(updated).await;
    assert_eq!(body["completed"], false);
}

#[tokio::test]
async fn update_todo_with_empty_body_returns_400() {
    let app = create_router();
    let created = send(
        &app,
        Method::POST,
        "/api/todos",
        Some(json!({ "title": "臨時事項" })),
    )
    .await;
    let created_body = response_json(created).await;
    let id = created_body["id"].as_str().unwrap().to_string();

    let updated = send(&app, Method::PUT, &format!("/api/todos/{id}"), Some(json!({}))).await;
    assert_eq!(updated.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn delete_todo_returns_204_then_404() {
    let app = create_router();
    let created = send(
        &app,
        Method::POST,
        "/api/todos",
        Some(json!({ "title": "臨時事項" })),
    )
    .await;
    let created_body = response_json(created).await;
    let id = created_body["id"].as_str().unwrap().to_string();

    let deleted = send(&app, Method::DELETE, &format!("/api/todos/{id}"), None).await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);

    let again = send(&app, Method::DELETE, &format!("/api/todos/{id}"), None).await;
    assert_eq!(again.status(), StatusCode::NOT_FOUND);
}
