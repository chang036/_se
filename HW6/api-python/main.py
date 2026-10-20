import os
import asyncpg
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Python API", version="1.0.0")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "microservices"),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "secret123"),
}


@app.get("/")
async def root():
    return {"service": "python-api", "status": "ok", "framework": "FastAPI"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/db-info")
async def db_info():
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        version = await conn.fetchval("SELECT version()")
        await conn.close()
        return {"db_connected": True, "db_version": version}
    except Exception as e:
        return {"db_connected": False, "error": str(e)}


class VisitCreate(BaseModel):
    service: str
    message: str


@app.post("/visits")
async def create_visit(visit: VisitCreate):
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        await conn.execute(
            "INSERT INTO visits (service, message) VALUES ($1, $2)",
            visit.service,
            visit.message,
        )
        await conn.close()
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@app.get("/visits")
async def list_visits():
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        rows = await conn.fetch("SELECT * FROM visits ORDER BY created_at DESC LIMIT 20")
        await conn.close()
        return {"visits": [dict(r) for r in rows]}
    except Exception as e:
        return {"error": str(e)}
