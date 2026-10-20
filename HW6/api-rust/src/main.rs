use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::env;

#[derive(Serialize)]
struct StatusResponse {
    service: String,
    status: String,
    framework: String,
}

#[derive(Serialize)]
struct DbInfoResponse {
    db_connected: bool,
    db_version: String,
}

#[derive(Deserialize)]
struct VisitInput {
    service: String,
    message: String,
}

#[derive(Serialize)]
struct Visit {
    id: i32,
    service: String,
    message: String,
    created_at: String,
}

#[derive(Serialize)]
struct VisitsResponse {
    visits: Vec<Visit>,
}

#[derive(Serialize)]
struct CreateResponse {
    ok: bool,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[get("/")]
async fn root() -> impl Responder {
    HttpResponse::Ok().json(StatusResponse {
        service: "rust-api".to_string(),
        status: "ok".to_string(),
        framework: "Actix Web".to_string(),
    })
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(StatusResponse {
        service: "rust-api".to_string(),
        status: "healthy".to_string(),
        framework: "Actix Web".to_string(),
    })
}

#[get("/db-info")]
async fn db_info() -> impl Responder {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://admin:secret123@localhost:5432/microservices".to_string());

    match PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
    {
        Ok(pool) => {
            let row: (String,) = sqlx::query_as("SELECT version()")
                .fetch_one(&pool)
                .await
                .unwrap_or(("unknown".to_string(),));
            HttpResponse::Ok().json(DbInfoResponse {
                db_connected: true,
                db_version: row.0,
            })
        }
        Err(e) => HttpResponse::Ok().json(ErrorResponse {
            error: e.to_string(),
        }),
    }
}

#[post("/visits")]
async fn create_visit(body: web::Json<VisitInput>) -> impl Responder {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://admin:secret123@localhost:5432/microservices".to_string());

    match PgPoolOptions::new().connect(&database_url).await {
        Ok(pool) => {
            sqlx::query("INSERT INTO visits (service, message) VALUES ($1, $2)")
                .bind(&body.service)
                .bind(&body.message)
                .execute(&pool)
                .await
                .unwrap();
            HttpResponse::Ok().json(CreateResponse { ok: true })
        }
        Err(e) => HttpResponse::Ok().json(ErrorResponse {
            error: e.to_string(),
        }),
    }
}

#[get("/visits")]
async fn list_visits() -> impl Responder {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://admin:secret123@localhost:5432/microservices".to_string());

    match PgPoolOptions::new().connect(&database_url).await {
        Ok(pool) => {
            let rows: Vec<(i32, String, String, String)> =
                sqlx::query_as("SELECT id, service, message, created_at::text FROM visits ORDER BY created_at DESC LIMIT 20")
                    .fetch_all(&pool)
                    .await
                    .unwrap_or_default();

            let visits: Vec<Visit> = rows
                .into_iter()
                .map(|(id, service, message, created_at)| Visit {
                    id,
                    service,
                    message,
                    created_at,
                })
                .collect();

            HttpResponse::Ok().json(VisitsResponse { visits })
        }
        Err(e) => HttpResponse::Ok().json(ErrorResponse {
            error: e.to_string(),
        }),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);

    println!("Rust API running on port {}", port);

    HttpServer::new(|| {
        App::new()
            .service(root)
            .service(health)
            .service(db_info)
            .service(create_visit)
            .service(list_visits)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
