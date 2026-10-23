# ⚡ 極速待辦事項 (Rust Todo App)

一個以「極速」為主題的全端待辦事項應用，包含 **三種測試層級**：

| 層級 | 技術 | 數量 | 說明 |
| --- | --- | --- | --- |
| 1. 單元測試（必測） | Rust `cargo test` | 8 | 領域邏輯：標題驗證、建立、切換、刪除 |
| 2. 系統測試（Web API） | Rust 整合測試 + `tower::ServiceExt` | 8 | 真實 HTTP 請求／回應、狀態碼、JSON、錯誤處理 |
| 3. E2E 測試 | Playwright（headless Chromium） | 5 | 瀏覽器操作：新增、勾選、刪除、重新整理 |

![極速待辦事項預覽](docs/preview.png)

## 技術棧

- **Server**：Rust 1.99 · Axum 0.8 · Tokio · `Arc<RwLock<HashMap>>` 記憶體儲存
- **Client**：Node.js 24 · React 19 · TypeScript 7 · Vite 8
- **E2E**：Playwright 1.64 · Chromium headless

## 專案結構

```
todo-app/
├── server/                     # Rust API
│   ├── src/
│   │   ├── todo.rs             # 領域模型 + 驗證（含單元測試）
│   │   ├── store.rs            # 記憶體儲存（含單元測試）
│   │   ├── api.rs              # Axum 路由與 handlers
│   │   ├── lib.rs              # create_router()
│   │   └── main.rs             # 啟動 :8080，並服務 client/dist
│   └── tests/api.rs            # 系統測試（Web API）
├── client/                     # React + Vite 前端
│   └── src/
│       ├── App.tsx             # 待辦事項 UI
│       ├── api.ts              # fetch 包裝
│       └── index.css           # 速度感深色主題
├── e2e/todo.spec.ts            # Playwright E2E
├── playwright.config.ts        # 自動啟動 Rust + Vite
└── package.json                # 一鍵指令
```

## 快速開始

需求：Rust 工具鏈、Node.js 20+、npm。

```bash
# 1. 安裝依賴
npm install
npm install --prefix client

# 2. 建置前端（讓 Rust 直接服務靜態檔）
npm run build:client

# 3. 啟動
npm run server
# → http://localhost:8080
```

### 開發模式（前端熱更新）

```bash
npm run server   # 終端機 1：Rust API（:8080）
npm run client   # 終端機 2：Vite（:5173，/api 代理到 :8080）
```

## 三種測試怎麼跑

### 1. 單元測試（Rust server，必測）

```bash
npm run test:unit
# 或：cd server && cargo test --lib
```

測試內容：標題 trim、空字串拒絕、長度上限、建立／列表／切換／刪除。

### 2. 系統測試（Web API）

```bash
npm run test:api
# 或：cd server && cargo test --test api
```

透過 `tower::ServiceExt::oneshot` 對真實的 Axum Router 發送 HTTP 請求，驗證：

- `GET /api/todos` → `200` 空陣列
- `POST /api/todos` → `201` + JSON
- 空標題 → `400`
- 查詢／更新不存在的 id → `404`
- `DELETE` → `204`，再次刪除 → `404`

### 3. E2E 測試（Playwright headless）

```bash
npx playwright install chromium   # 第一次安裝瀏覽器
npm run test:e2e
```

`playwright.config.ts` 會自動啟動 **Rust server** 與 **Vite**，不需手動開服務。
測試流程：空狀態 → 新增 → 切換完成 → 刪除 → 重新整理後資料仍在。

### 一次跑完

```bash
npm test
```

## Web API

| Method | Path | 說明 | 成功狀態 |
| --- | --- | --- | --- |
| `GET` | `/api/todos` | 列出所有待辦事項 | `200` |
| `POST` | `/api/todos` | 新增 `{ "title": "..." }` | `201` |
| `GET` | `/api/todos/{id}` | 取得單筆 | `200` |
| `PUT` | `/api/todos/{id}` | 更新 `{ "title"?: "...", "completed"?: true }` | `200` |
| `DELETE` | `/api/todos/{id}` | 刪除 | `204` |

錯誤格式：`{ "error": "訊息" }`。

## 設計重點

- **極速**：記憶體儲存（HashMap + Tokio `RwLock`），讀取可並行、操作 O(1)。
- **樂觀更新**：勾選完成狀態時 UI 立即反應，API 失敗才回滾。
- **單一指令測試**：Playwright `webServer` 陣列同時管理 Rust 與 Vite 兩個服務。
- **三層測試職責分明**：單元測試不碰 HTTP；API 測試不碰瀏覽器；E2E 只驗證使用者流程。

## 疑難排解

- **`link.exe not found`（Windows）**：代表缺少 MSVC 連結器。
  安裝 Visual Studio Build Tools（C++ 工作負載），或改用 GNU 工具鏈：
  ```bash
  rustup default stable-gnu   # 需要 MinGW gcc（例如 MSYS2）
  ```
- **連接埠被占用**：Rust 使用 `8080`、Vite 使用 `5173`，可在設定檔調整。
