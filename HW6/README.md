# 課程：現代軟體工程 -- 學生作業與專案

欄位 | 內容
-----|---------
學期 | 115 學年上學期
教師 | [陳鍾誠](https://www.nqu.edu.tw/educsie/index.php?act=blog&code=list&ids=4)
學校 | [金門大學資訊工程系](https://www.nqu.edu.tw/educsie/index.php)
學生 |張程翔
學號 | 68

---

# Docker Microservices Demo

一個使用 Docker Compose 建置的完整微服務系統，整合 Nginx、PostgreSQL、Node.js、Python (FastAPI) 和 Rust (Actix Web)。

## 系統架構

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
└──────────────────────────┬──────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Nginx (Port 80)   │
                │   Reverse Proxy     │
                └──────────┬──────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
┌─────▼─────┐    ┌────────▼────────┐    ┌──────▼──────┐
│ Frontend  │    │   Python API    │    │  Rust API   │
│ Node.js   │    │   FastAPI       │    │  Actix Web  │
│ :3000     │    │   :8000         │    │  :8000      │
└─────┬─────┘    └────────┬────────┘    └──────┬──────┘
      │                    │                    │
      └────────────────────┼────────────────────┘
                           │
                ┌──────────▼──────────┐
                │    PostgreSQL       │
                │    :5432            │
                └─────────────────────┘
```

## 服務說明

| 服務 | 技術 | 連接埠 | 說明 |
|------|------|--------|------|
| Nginx | nginx:1.27-alpine | 80 | 反向代理，統一入口 |
| Frontend | Node.js 20 + Express | 3000 | Web 儀表板 |
| Python API | Python 3.12 + FastAPI | 8000 | 後端 API |
| Rust API | Rust + Actix Web | 8080 | 高效能後端 API |
| PostgreSQL | postgres:16-alpine | 5432 | 關聯式資料庫 |

## 快速開始

### 需求
- Docker Desktop (已啟動)
- Docker Compose (已內建在 Docker Desktop)

### 啟動系統

```powershell
cd C:\Users\charl\projects\microservices-demo
docker-compose up -d --build
```

### 關閉系統

```powershell
docker-compose down
```

### 查看日誌

```powershell
docker-compose logs -f
```

### 重建並啟動

```powershell
docker-compose up -d --build --force-recreate
```

## 啟動後開啟瀏覽器

前往 [http://localhost](http://localhost) 查看儀表板。

## 資料庫初始化

系統會自動執行 `db/init.sql`，建立 `visits` 資料表：

```sql
CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 目錄結構

```
microservices-demo/
├── docker-compose.yml       # Docker Compose 主配置
├── .env                     # 環境變數
├── .env.example             # 環境變數範例
├── .gitignore
├── README.md                # 本文件
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf           # Nginx 反向代理配置
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js            # Express 伺服器
│   └── public/
│       └── index.html       # 前端儀表板
├── api-python/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py              # FastAPI 應用程式
├── api-rust/
│   ├── Dockerfile
│   ├── Cargo.toml
│   └── src/
│       └── main.rs          # Actix Web 應用程式
└── db/
    └── init.sql             # 資料庫初始化腳本
```

## 環境變數

在 `.env` 中設定：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| POSTGRES_DB | microservices | 資料庫名稱 |
| POSTGRES_USER | admin | 資料庫使用者 |
| POSTGRES_PASSWORD | secret123 | 資料庫密碼 |
| FRONTEND_PORT | 3000 | 前端連接埠 |
| PYTHON_API_PORT | 8000 | Python API 連接埠 |
| RUST_API_PORT | 8080 | Rust API 連接埠 |

## 注意事項

1. **首次啟動**需要下載映像檔，可能需要數分鐘
2. **Rust 服務**第一次 build 時間較長（需編譯）
3. 確保 Docker Desktop 已啟動且使用 WSL 2 引擎
4. 所有服務都設置了 `restart: unless-stopped`，Docker 重啟後會自動啟動
