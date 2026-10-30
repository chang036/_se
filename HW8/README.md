# 安心操作助理－長輩的 3C 小幫手

給長輩使用的手機、電腦與智慧手錶操作助理。大字、大按鈕、一步一步唸給您聽，還能一鍵打給家人。加到手機主畫面後，就算沒有網路也能看教學。

這個專案原本是一份靜態的 3C 操作指南，現在升級成可以真正放在長輩手機裡的「安心操作助理」：不需要註冊、沒有後端、不會收集資料，打開就能用。

## 為什麼要做這個

長輩遇到 3C 問題時，通常不是「找不到教學」，而是：

- 字太小、按鈕太難按，看得到卻點不到。
- 教學寫得太簡短，不知道現在做到第幾步。
- 臨時需要找人幫忙，還要翻電話簿、找號碼。
- 網路不穩或家裡沒有 Wi-Fi，網頁就打不開。
- 接到詐騙電話時，不知道可以先打 165 查證。

所以這個專案把「教學」和「求助」放在同一頁，並針對長輩的使用情境重新設計。

## 主要功能

### 快速求助

- 設定最多 4 位家人的名字與電話，直接從首頁撥號或傳簡訊。
- 緊急電話 110（警察）、119（消防／救護）、112（手機緊急）、165（反詐騙）。
- 110、119、112 撥號前會再確認一次，避免誤觸。
- 家人資料只存在這台裝置，不會上傳。

### 一步一步教學

- 4 個分類、15 個教學：手機、電腦、智慧手錶、安心求助。
- iPhone / Android、Windows / Mac、Apple Watch / Wear OS 分開說明。
- 自動判斷目前裝置，選錯也可以手動切換系統。
- 每個教學都有大字步驟、進度條、上一步／下一步、再聽一次、完成提示。
- 使用 Web Speech API 以台灣中文（zh-TW）朗讀步驟，語速放慢到 0.85 倍。
- 步驟中的 `{{family}}` 會換成設定的家人名字，例如「點一下通話記錄，找阿明」。
- 自動記住上次看的教學，下次打開可以繼續。

### 生活與安全

- 傳送位置：取得 GPS、開啟地圖、複製地址、用簡訊或 LINE 傳給家人。
- 列印教學：列印時自動隱藏按鈕與導覽，只留下標題和步驟。
- 防詐騙教學：ATM、匯款、個資、可疑電話的處理方式。
- 緊急求助教學：手機與智慧手錶的 SOS 操作。

### 體貼的介面

- 字級切換：小／中／大（預設大），選擇會記住。
- 自動朗讀開關，設定也會記住。
- 黑底白字、高對比、大按鈕、清楚的數字步驟。
- 支援鍵盤操作、跳至主要內容、`aria-live` 狀態提示。
- 尊重系統的「減少動畫」設定。
- 離線時顯示提示，已下載的教學仍可閱讀。

### 可安裝、可離線（PWA）

- 有 Web App Manifest 與 Service Worker，可加到手機主畫面。
- 第一次開啟後會快取所有教學與程式，之後沒有網路也能使用。
- iPhone 用 Safari「加入主畫面」；Android 用 Chrome「安裝應用程式」。

## 隱私設計

- **沒有後端、沒有帳號、沒有追蹤碼。**
- 家人姓名與電話存在瀏覽器的 `localStorage`（鍵名前綴 `anxin-assistant:`），只留在這台裝置。
- 位置只有在使用者按下「取得我的位置」時才會讀取，不會自動上傳或儲存到伺服器。
- 分享位置時是透過裝置本身的分享功能、簡訊或 LINE，由使用者自己送出。
- 教學內容與程式都由 Service Worker 快取在裝置內。

清除瀏覽器資料或按「清除家人資料」後，設定就會消失。

## 檔案結構

```text
simple-device-guide/
├─ index.html              # 頁面骨架、設定／引導／撥號確認／安裝說明 dialog
├─ styles.css              # 全部樣式、響應式、列印、減少動畫
├─ script.js               # 主程式：渲染、教學、引導、設定、位置、PWA
├─ js/
│  ├─ tasks.js             # 教學內容、分類、緊急電話資料
│  ├─ store.js             # localStorage 封裝（字級、語音、家人、上次教學）
│  ├─ speech.js            # Web Speech API 語音朗讀
│  └─ device.js            # 裝置與系統自動判斷
├─ manifest.webmanifest    # PWA manifest
├─ sw.js                   # Service Worker 離線快取
├─ icons/                  # 192／512／maskable／apple-touch 圖示
├─ tools/
│  └─ make_icons.py        # 用 Pillow 重新產生圖示
└─ .github/workflows/
   └─ static.yml           # GitHub Pages 自動部署
```

## 本機執行

這個專案是純 HTML／CSS／JavaScript，不需要建置流程。但因為使用 ES modules 與 Service Worker，請用本機伺服器開啟，不要直接雙擊 `index.html`。

```bash
cd projects/simple-device-guide
python -m http.server 8765
```

然後開啟 <http://localhost:8765/>。

## 部署到 GitHub Pages

專案已包含 `.github/workflows/static.yml`：

1. 將變更推送到 `main` 分支。
2. 到 GitHub repo 的 **Settings → Pages**，Source 選擇 **GitHub Actions**。
3. 推送後 Actions 會自動部署，網址通常是 `https://<帳號>.github.io/<repo>/`。

## 新增或修改教學

教學內容集中在 `js/tasks.js`，不需要改 HTML。

```js
export const tasks = {
  myTask: {
    category: "phone",          // phone / computer / watch / safety
    icon: "📞",
    title: "教學標題",
    summary: "一句話說明這個教學。",
    tip: "小提醒（可省略）",
    quickCall: "165",           // 需要直接撥號時才加（可省略）
    systems: [
      {
        id: "ios",              // 系統 id，會影響自動判斷
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "第一步：…{{family}}…",
          "第二步：…",
        ],
      },
    ],
  },
};
```

- 步驟中的 `{{family}}` 會換成第一位家人的名字。
- `id` 請沿用 `ios`、`android`、`windows`、`mac`、`watch-ios`、`watch-android`，自動判斷才能正確運作。
- 新增分類請編輯同檔案的 `categories`；首頁與導覽會自動產生。
- 修改完成後，記得把 `sw.js` 的 `CACHE_NAME` 版本號加一，否則已安裝的裝置可能繼續使用舊快取。

## 離線與快取測試

1. 用本機伺服器開啟網站，等 Service Worker 安裝完成。
2. 在 DevTools 的 **Application → Cache Storage** 確認看到 `anxin-assistant-v2`。
3. 勾選 **Application → Service Workers → Offline**，或直接停止本機伺服器，再重新整理。
4. 頁面應該仍能完整顯示，教學、語音與家人電話都能使用。

更新網站內容時：

1. 修改檔案。
2. 把 `sw.js` 的 `CACHE_NAME` 改成新版本，例如 `anxin-assistant-v3`。
3. 重新整理兩次，讓新 Service Worker 安裝並接管。

## 無障礙與品質檢查

- 已通過 Lighthouse：Accessibility、Best Practices、SEO 皆為 100 分。
- 使用語意化標籤、跳至主要內容連結、可見焦點樣式、`aria-live` 狀態提示。
- 所有功能可用鍵盤操作；dialog 使用原生 `<dialog>`，開啟時鎖定背景捲動。
- 列印時自動隱藏操作按鈕，只輸出教學內容。
- 支援 `prefers-reduced-motion`。

## 已知限制

- 語音朗讀需要裝置與瀏覽器支援 Web Speech API，且最好安裝中文語音；不支援時會停用相關按鈕。
- 撥號與簡訊需要能打電話的裝置；在電腦上可能只會開啟對應的應用程式或沒有反應。
- 位置分享需要瀏覽器支援 Geolocation，且使用者要允許定位；地圖、分享、複製功能依瀏覽器支援度而異。
- 私密瀏覽模式可能無法寫入 `localStorage`，設定在重新整理後會消失。
- iPhone 必須使用 Safari 的「加入主畫面」才能安裝 PWA；其他瀏覽器的行為可能不同。
- 本專案提供操作說明與求助入口，不能取代醫療、警消或專業協助。

## 圖片與圖示

圖示由 `tools/make_icons.py` 產生（需要 Python 與 Pillow）：

```bash
python tools/make_icons.py
```

會重新產生 `icons/` 內的 192、512、maskable 與 apple-touch 圖示。
