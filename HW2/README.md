# NQU Campus · 金門大學風格校務系統

一個以國立金門大學校務行政系統為靈感的全端示範專案，包含 **學生、教師、管理員** 三種角色，涵蓋選課、課表、成績、畢業學分、請假、公告與教務管理等功能。

專案刻意採用 **零外部套件** 設計：後端只用 Node.js 內建模組，前端使用原生 ES Modules 與 CSS，資料儲存於本機 JSON 檔。下載後即可執行，適合用來展示校務系統的互動流程與後端 API 設計。

> 本專案為展示用途，非國立金門大學官方系統，請勿輸入真實個人資料或公務帳密。

---

## 快速開始

需求：**Node.js 20 以上**（開發時使用 Node.js 24）。

```bash
cd nqu-campus
npm start
```

開啟 <http://localhost:3000>。

| 指令 | 說明 |
| --- | --- |
| `npm start` | 啟動伺服器（預設 3000 埠） |
| `npm run dev` | 以 `node --watch` 啟動，修改後自動重啟 |
| `npm test` | 執行 `node:test` API／靜態檔案測試 |
| `npm run reset` | 重置 `data/db.json` 為初始示範資料 |

若要更換埠號：

```bash
# Windows PowerShell
$env:PORT=4000; npm start

# macOS / Linux
PORT=4000 npm start
```

### 示範帳號

所有帳號密碼皆為 **`123456`**。登入頁也提供一鍵登入按鈕。

| 角色 | 帳號 | 姓名 | 說明 |
| --- | --- | --- | --- |
| 學生 | `s11301001` | 陳品妤 | 資工二A，有 6 門課與歷年成績 |
| 教師 | `t1001` | 王世豪 | 資工系副教授，開設 3 門課 |
| 管理員 | `admin` | 林美華 | 教務處管理員 |

其他可用的學生帳號：`s11301002`、`s11302003`、`s11204005` 等；教師帳號：`t1002`～`t1008`。完整名單可於 `src/seed.js` 查看。

---

## 功能一覽

### 學生

- **學習總覽**：本學期學分、今日課程、最新公告、畢業學分進度、待審請假。
- **選課系統**：搜尋、系所／必修選修篩選、課程詳情、加選與退選。
  - 檢查衝堂、課程容量、重複選課。
  - 顯示剩餘名額、選課率、授課教師與課程大綱。
- **我的課程**：本學期課程卡、學分統計、課程詳情與退選。
- **課表**：週課表、今日課程、列印。
- **成績查詢**：歷年成績、學期平均、GPA、等第、CSV 匯出。
- **畢業學分**：各類學分要求、已修／尚缺學分、達成率。
- **請假申請**：建立假單、查看審核狀態、取消待審假單。
- **校園公告**：分類篩選、關鍵字搜尋、公告詳情。
- **個人資料**：編輯聯絡資訊、變更密碼。

### 教師

- **教學總覽**：授課課程、修課人次、待登錄成績、今日授課、待審請假。
- **授課課程**：課程名單、選課人數、課程詳情。
- **成績登錄**：依課程輸入平時／期中／期末成績，自動以 **30% / 30% / 40%** 計算總分與等第，支援 CSV 匯出。
- **課表**：授課課表。
- **校園公告**：發布公告、刪除自己發布的公告。
- **個人資料**：編輯辦公室、聯絡資訊與密碼。

### 管理員

- **教務管理總覽**：學生／教師／課程數、選課人次、容量使用率、各系所人數、熱門課程、待審假單。
- **課程管理**：新增、編輯、刪除課程；設定教師、學分、容量、教室、課程簡介與多時段課表。
- **學生名冊**：學生基本資料、選課數、學分數、成績筆數，支援系所／年級篩選與 CSV 匯出。
- **請假審核**：核准／駁回假單、填寫審核備註、依狀態篩選。
- **公告管理**：發布／置頂／刪除公告。
- **個人資料**：編輯聯絡資訊與密碼。

---

## 專案結構

```text
nqu-campus/
├─ server.js              # HTTP 伺服器、靜態檔案、SPA fallback、安全標頭
├─ package.json
├─ src/
│  ├─ api.js              # 所有 REST API、權限、驗證、DTO
│  ├─ auth.js             # 記憶體 Session（Bearer token，8 小時）
│  ├─ db.js               # JSON 資料庫（原子寫入）
│  ├─ security.js         # scrypt 密碼雜湊、隨機 token
│  └─ seed.js             # 示範資料（使用者、課程、成績、公告、請假）
├─ public/
│  ├─ index.html
│  ├─ css/styles.css      # 設計系統、版面、響應式樣式
│  └─ js/
│     ├─ app.js           # 登入、App Shell、路由、通知
│     ├─ api.js           # fetch 包裝與 token 儲存
│     ├─ ui.js            # icon、modal、toast、CSV 等共用工具
│     └─ pages/
│        ├─ student.js    # 學生頁面
│        ├─ teacher.js    # 教師頁面
│        ├─ admin.js      # 管理員頁面
│        └─ shared.js     # 課表、公告、個人資料、課程詳情
├─ scripts/reset.js       # 重置示範資料
├─ test/api.test.js       # node:test API／靜態檔案整合測試
└─ data/db.json           # 執行後自動產生的資料檔
```

前端使用 hash routing（例如 `#/courses`），由 `app.js` 依角色與路由載入對應頁面。所有資料透過 `/api/*` 取得。

---

## REST API

除了 `POST /api/auth/login` 與 `GET /api/meta` 外，其餘 API 都需要：

```http
Authorization: Bearer <token>
```

### 認證

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 登入，回傳 token、user、meta |
| `POST` | `/api/auth/logout` | 登出並摧毀 token |
| `GET` | `/api/auth/me` | 取得目前使用者與系統 meta |
| `PATCH` | `/api/auth/me` | 更新 email、phone、address、emergencyContact、office |
| `POST` | `/api/auth/password` | 變更密碼（需 `currentPassword`、`newPassword`） |
| `GET` | `/api/meta` | 公開的學校／學期／系所／節次資訊 |

登入範例：

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"s11301001\",\"password\":\"123456\"}"
```

### 課程與選課

| Method | Path | 角色 | 說明 |
| --- | --- | --- | --- |
| `GET` | `/api/courses` | 全部 | 課程列表，支援 `q`、`dept`、`type`、`scope=mine` |
| `GET` | `/api/courses/:idOrCode` | 全部 | 課程詳情；教師（本人）與管理員可看到名單 |
| `POST` | `/api/courses` | 管理員 | 新增課程 |
| `PATCH` | `/api/courses/:id` | 管理員 | 更新課程（含代碼重複與時段格式驗證） |
| `DELETE` | `/api/courses/:id` | 管理員 | 刪除課程與相關成績／假單 |
| `POST` | `/api/courses/:id/enroll` | 學生 | 加選（檢查衝堂、容量、重複） |
| `DELETE` | `/api/courses/:id/enroll` | 學生 | 退選 |
| `GET` | `/api/courses/:id/roster` | 教師／管理員 | 修課名單 |
| `GET` | `/api/courses/:id/grades` | 教師／管理員 | 成績名單 |
| `PUT` | `/api/courses/:id/grades` | 教師／管理員 | 批次儲存成績 |

### 學習紀錄

| Method | Path | 角色 | 說明 |
| --- | --- | --- | --- |
| `GET` | `/api/grades` | 學生 | 歷年成績與學業摘要 |
| `GET` | `/api/requirements` | 學生 | 畢業學分統計 |
| `GET` | `/api/timetable` | 全部 | 依角色回傳課表 entries 與節次 |
| `GET` | `/api/leaves` | 全部 | 依角色篩選假單 |
| `POST` | `/api/leaves` | 學生 | 建立假單 |
| `PATCH` | `/api/leaves/:id` | 學生／管理員 | 學生取消；管理員核准／駁回 |

### 公告與管理

| Method | Path | 角色 | 說明 |
| --- | --- | --- | --- |
| `GET` | `/api/announcements` | 全部 | 公告列表（置頂優先） |
| `POST` | `/api/announcements` | 教師／管理員 | 發布公告（僅管理員可置頂） |
| `DELETE` | `/api/announcements/:id` | 作者／管理員 | 刪除公告 |
| `GET` | `/api/admin/stats` | 管理員 | 教務統計 |
| `GET` | `/api/admin/students` | 管理員 | 學生名冊 |
| `GET` | `/api/teachers` | 全部 | 教師列表 |

錯誤一律以 JSON 回傳：

```json
{ "error": "課程人數已額滿" }
```

常見狀態碼：`400` 驗證失敗、`401` 未登入／帳密錯誤、`403` 權限不足、`404` 找不到資源、`413` 請求過大。

---

## 資料與客製化

- 首次啟動時若 `data/db.json` 不存在，會自動以 `src/seed.js` 建立示範資料。
- 所有寫入會先寫入暫存檔再 rename，降低 JSON 損壞風險。
- 想調整課程、使用者或公告內容，可修改 `src/seed.js` 後執行：

```bash
npm run reset
```

- 也可用環境變數 `DB_FILE` 指定其他資料檔：

```bash
DB_FILE=./data/demo.json npm start
```

目前種子資料包含：

- 21 位使用者（12 學生、8 教師、1 管理員）
- 14 門課程、55 筆選課
- 12 筆歷年成績、11 筆課程成績
- 5 則公告、3 筆請假
- 5 類畢業學分要求（總計 128 學分）

---

## 測試

```bash
npm test
```

測試會：

1. 在系統暫存目錄建立獨立的 `db.json`。
2. 以隨機埠啟動真正的 HTTP 伺服器。
3. 驗證靜態檔案、SPA fallback、安全標頭與路徑穿越防護。
4. 驗證三種角色登入、課程查詢、課表、成績、畢業學分。
5. 驗證選課衝堂／額滿／退選、教師成績儲存與越權阻擋。
6. 驗證課程 CRUD 與欄位驗證、請假建立／取消／審核、公告權限。
7. 驗證個資更新、密碼變更、登出與錯誤 JSON 處理。

目前共 **13 組整合測試**，全部通過。

---

## 安全性設計

- 密碼以 Node.js `crypto.scrypt` 加鹽雜湊，不儲存明文。
- 登入使用隨機 Bearer token，Session 存於記憶體，預設 8 小時過期。
- 所有 API 依角色檢查權限；教師只能存取自己授課的課程。
- 回應中的使用者物件會移除 `password` 欄位。
- 請求 JSON 大小限制 1 MB，並驗證日期、成績、學分、容量、時段等欄位。
- 靜態檔案阻擋目錄穿越；設定 CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`。
- API 回應使用 `Cache-Control: no-store`；HTML／JS／CSS 使用 `no-cache`，避免開發時載入舊版。

---

## 已知限制

本專案以「可獨立執行的展示系統」為目標，以下項目未實作：

- 真正的資料庫、交易與多人同時寫入控制（JSON 檔案適合單機展示）。
- 選課期間限制、加退選審核、學分上限與必修擋修規則。
- 成績複查、成績上傳批次檔、教師請假與課程大綱編輯。
- 學生名冊的管理員編輯功能（目前為唯讀查詢）。
- 公告附件、富文字編輯、對象分流。
- 正式的身分驗證（SSO／LDAP）、HTTPS、審計日誌與備份機制。
- 多學期切換；目前資料以 115 學年度第 1 學期為主。

若要用於真實環境，建議改用 PostgreSQL／MySQL、加入正式驗證與授權、CSRF 防護、審計紀錄與完整測試。

---

## 授權與聲明

此為教學與作品展示用途的獨立專案，與國立金門大學無正式關聯。校名與情境僅作為介面設計靈感；所有人物、課程與資料皆為虛構。
