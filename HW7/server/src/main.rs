use std::path::PathBuf;

use axum::serve;
use tower_http::services::ServeDir;

use todo_server::create_router;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = create_router();

    // Serve the built frontend from ../client/dist when it exists.
    let static_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../client/dist");
    let app = app.fallback_service(
        ServeDir::new(&static_dir).append_index_html_on_directories(true),
    );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("failed to bind listener");
    let addr = listener.local_addr().unwrap();
    println!("todo server listening on {addr}");

    serve(listener, app).await.expect("failed to serve");
}
