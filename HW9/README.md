# HW9：快速筆記 － 網頁筆記工具

一個簡潔的網頁筆記工具，部署在 Cloudflare Pages 上。
主打「打開就能用」：側邊清單管理筆記、第一行自動變標題、支援搜尋與暗色模式，所有資料存在瀏覽器本機，不用註冊、不用登入。

## 線上網站

👉 https://notes-app-10v.pages.dev

## 主要功能

### 筆記管理
- 新增／編輯／刪除筆記，側邊欄清單一覽
- 第一行文字自動變成筆記標題
- 顯示每篇筆記的最後編輯時間
- 內容與標題「搜尋筆記」

### 暗色模式
- 三段式切換：跟隨系統（◐）→ 暗色（☀️/🌙）
- 跟隨系統模式下，作業系統切換深淺色時網站即時跟著變
- 選擇記在瀏覽器，下次打開維持同一模式
- 載入時預先套用主題，不會出現「先閃白再變暗」
- 暗色配色：深藍灰底、調整過的強調色與成功／危險色

### 自動儲存
- 每次編輯立即自動儲存（點「✓ 自動儲存」即為已存）
- 筆記存在瀏覽器 `localStorage`（鍵值為 `notes-app:notes`），只保留在這台裝置

## 技術設計

- **React 18 + Vite 6**：元件化前端，開發與建置快速
- **無後端**：不需要帳號，資料全部存在瀏覽器 `localStorage`
- **Cloudflare Pages**：靜態建置（`vite build`）後用 wrangler 上傳
  - 部署指令：`npm run deploy`
  - 免費的全球 CDN 與 HTTPS

## 檔案結構

```text
HW9/
 ├── index.html                # 頁面骨架、預先套用主題的 script
 ├── src/
 │    ├── App.jsx              # 主元件：筆記列表、編輯器、搜尋、主題切換、localStorage
 │    ├── index.css            # 全部樣式（含亮／暗雙主題變數）
 │    └── main.jsx             # React 進入點
 ├── package.json
 ├── vite.config.js
 └── .gitignore                # 排除 node_modules、dist、.wrangler
```

## 本機執行

```bash
npm install    # 安裝依賴
npm run dev    # 開發伺服器（預設 http://localhost:5173）
npm run build  # 建置到 dist/
npm run deploy # 建置並部署到 Cloudflare Pages
```
