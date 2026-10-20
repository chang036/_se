# curlike

一個用 Python + [httpx](https://www.python-httpx.org/) 寫的命令列 HTTP 客戶端，
用法貼近 `curl`，專案特色集中在四個進階功能：**`--json`、`-T`、`--proxy`、`--retry`**。

目標是「把 curl 會用到的東西真的做出來」，而不是只做一個能抓網頁的小工具：
表頭、Cookie、認證、重新導向、代理、重試、續傳輸出、計時統計與 curl 相容的離開代碼都涵蓋在內。

---

## 目錄

- [安裝](#安裝)
- [快速開始](#快速開始)
- [四大進階功能](#四大進階功能)
  - [`--json`](#--json)
  - [`-T` / `--upload-file`](#-t----upload-file)
  - [`--proxy`](#--proxy)
  - [`--retry`](#--retry)
- [其他支援的選項](#其他支援的選項)
- [`--write-out` 變數](#--write-out-變數)
- [離開代碼](#離開代碼)
- [與 curl 的差異](#與-curl-的差異)
- [專案結構](#專案結構)
- [執行測試](#執行測試)

---

## 安裝

需要 Python 3.10 以上。

```bash
# 方式一：直接用模組執行
python -m curlike https://example.com

# 方式二：安裝成命令
pip install -e .
curlike https://example.com
```

唯一的執行期相依是 `httpx`。HTTP/2 支援需要額外安裝：

```bash
pip install -e ".[http2]"    # 之後 --http2 才會生效
```

---

## 快速開始

```bash
curlike https://example.com                      # 最簡單的 GET
curlike -X POST --json '{"a":1}' /api            # JSON請求，自動帶 Content-Type
curlike -F 'file=@./report.pdf' /upload          # multipart 上傳
curlike -T ./movie.mp4 https://host/store        # 原始 PUT
curlike -G -d 'q=curl' https://host/search       # 把資料放進 query string
curlike -L -o page.html --retry 3 /big           # 追重新導向 + 重試 + 存檔
curlike -sS -w '%{http_code} %{time_total}\n' -o NUL https://host
curlike -x http://127.0.0.1:8080 https://host     # 走代理
curlike -b jar.txt -c jar.txt https://host        # 讀寫 Cookie
curlike 'https://host/a[1..3]/b'                 # URL globbing，一個指令三個請求
```

---

## 四大進階功能

### `--json`

送出 JSON 請求體，並自動設定 `Content-Type: application/json` 與 `Accept: application/json`。
方法預設為 `POST`（除非用 `-X` 明確指定）。

```bash
# 內嵌字串
curlike -X POST --json '{"name":"Ada","age":36}' https://api.example.com/users

# 從檔案讀取（@ 開頭）
curlike --json @payload.json https://api.example.com/users

# 從 stdin 讀取
echo '{"a":1}' | curlike --json @- https://api.example.com/users
```

行為細節：

- 送出前會先驗證是否為合法 JSON，**不是合法 JSON 直接以 `(2)` 離開**，不會送出壞掉的請求。
- 自己用 `-H "Accept: ..."` 指定過時，curlike 就不會覆蓋你的 `Accept`。
- 送出的是你輸入的**原始字串**，不會重新序列化或改變空白與縮排。

```bash
$ curlike -s -o NUL -w '%{http_code}\n' --json '{"a":1}' https://httpbin.org/post
200
```

### `-T` / `--upload-file`

把整個檔案當成請求本體送出，方法預設為 `PUT`。位元組完全不做轉換。

```bash
# 檔案上傳
curlike -T ./movie.mp4 https://storage.example.com/videos/movie.mp4

# 從 stdin 上傳
tar cz . | curlike -T - -H 'Content-Type: application/x-tar' https://host/backup.tgz
```

支援的變化：

- 檔名或路徑不存在 → `(26)`，和 curl 一致。
- 可以搭配 `-H` 手動指定 `Content-Type`；`curlike` 不會擅自猜測。

### `--proxy`

```bash
# 一般 HTTP 代理
curlike -x http://127.0.0.1:8080 https://example.com

# 省略協定時預設視為 http://
curlike -x 127.0.0.1:8080 https://example.com

# 例外清單：這些主機直接連線，不走代理
curlike -x http://proxy:8080 --noproxy 'localhost,.internal' https://example.com
```

- `--noproxy '*'` 代表全部繞過代理。
- 代理連不上 → `(7)`。
- 搭配 `--trust-env` 會一併讀取 `HTTP_PROXY` / `HTTPS_PROXY` 環境變數。

### `--retry`

只在**暫時性**錯誤時重試：連線錯誤、`408`、`429`、`500`、`502`、`503`、`504`。

```bash
# 最多重試 3 次
curlike --retry 3 https://flaky.example.com

# 自訂退避秒數（不給就是 1、2、4… 指數退避）
curlike --retry 3 --retry-delay 0.5 https://flaky.example.com

# 加上總時限，避免一直重試下去
curlike --retry 5 --retry-max-time 30 https://flaky.example.com

# 連 4xx 也重試（預設不重試）
curlike --retry 2 --retry-all-errors https://example.com
```

回應裡有 **`Retry-After`** 表頭時，會優先採用伺服器指定的等待時間（上限 60 秒）。
重試會原樣重送同一個請求，包含請求本體，所以 `-d` / `-F` / `--json` / `-T` 都適用。

```bash
$ curlike --retry 2 --retry-delay 0 -s https://example.com/flaky
the requested URL returned error: 503; attempt 1/2, retrying in 0.000s
* Connection #0 to host ... left intact
```

---

## 其他支援的選項

| 類別 | 選項 |
| --- | --- |
| **請求** | `-X` `-H` `-d` `--data-raw` `--data-binary` `--data-urlencode` `-F` `--json` `-T` `-G` `-I` `-e` `-A` `--compressed` |
| **認證 / Cookie** | `-u` `--basic` `--bearer` `-b` `-c` |
| **連線** | `-x` `--noproxy` `--trust-env` `-L` `--max-redirs` `-m` `--connect-timeout` `--http1.1` `--http2` |
| **TLS** | `-k` `--cacert` `--capath` `--cert` `--key` |
| **重試** | `--retry` `--retry-delay` `--retry-max-time` `--retry-all-errors` |
| **輸出** | `-o` `-O` `-J` `-i` `-D` `-f` `--fail-with-body` `-w` `--trace` |
| **紀錄** | `-v` `-s` `-S` |

幾個比較值得說明的行為：

- **`-H "Name;"`** 與 **`-H "Name:"`** 會把該表頭以**空值**送出（而不是刪掉它），
  這是覆蓋 curlike 自帶預設值的正確方式，行為與 curl 一致。
  httpx 建立請求時會補上自己的預設值，所以這個空值會在送出前**再次套用**。
- **`--data-urlencode` 完全比照 curl 的五種寫法**，且欄位名不做編碼：
  `content` / `=content` / `name=content` / `@file` / `name@file`。
  空格編碼成 `+`（不是 `%20`）；注意 `name=@file` **不會**讀檔，`@` 必須出現在 `=` 之前才算檔案。
  對比之下 `-d @file` 會把換行刪掉，`--data-urlencode @file` 則保留。
- **`-f`** 遇到 4xx/5xx 不輸出本體、直接以 `22` 離開；`--fail-with-body` 則保留本體。
- **`-w` 一律寫到 stdout**，即使同時用了 `-o`，和 curl 的行為一致。
- **`-O` / `-J`** 取檔名時會過濾路徑分隔符號，伺服器無法用 `../../` 跳出目錄。
- **`-v`** 會顯示 `> ` 開頭的請求與 `< ` 開頭的回應，並保留伺服器原本的表頭大小寫。
- **重新導向是手動追蹤的**（不是交給 httpx），因此 `-v` 會逐跳記錄、`--max-redirs` 有效，
  且跨主機時會自動丟棄 `Authorization`。
- **URL globbing**：`{1..10}` 與 `[a..e]` 會展開成多個請求；`{0..10..5}` 這種帶步長的
  會依較大端點的位數補零（`00, 05, 10`）。

---

## `--write-out` 變數

支援的 `%{...}` 變數：

| 變數 | 意義 |
| --- | --- |
| `http_code` / `response_code` | HTTP 回應碼 |
| `http_version` | 協定版本，例如 `HTTP/1.1` |
| `url` / `url_effective` | 原始 / 實際請求的 URL |
| `content_type` | 回應的 `Content-Type` |
| `size_download` | 已下載的本文大小 |
| `size_header` | 回應表頭大小 |
| `size_request` | 請求大小 |
| `speed_download` | 平均下載速度（bytes/s） |
| `num_redirects` | 重新導向次數 |
| `num_connects` | 建立的連線數 |
| `remote_ip` / `remote_port` | 對端位址 |
| `local_ip` / `local_port` | 本機位址 |
| `scheme` | `http` 或 `https` |
| `ssl_verify_result` | 憑證驗證結果 |
| `exitcode` / `errormsg` | 離開代碼 / 錯誤訊息 |
| `time_namelookup` | DNS 解析完成時間點 |
| `time_connect` | TCP 連線建立完成時間點 |
| `time_appconnect` | TLS 握手完成時間點 |
| `time_pretransfer` | 開始送出請求前 |
| `time_starttransfer` | 收到第一個回應位元組 |
| `time_total` | 整體花費 |

時間變數是**從傳輸開始算起的時間點**（不是各階段的耗時），因此一定滿足
`namelookup ≤ connect ≤ appconnect ≤ pretransfer ≤ starttransfer ≤ total`，
和 curl 的語義相同。這些數字直接來自 httpcore 的 trace 事件，是實際測量值而非估計值。

```bash
$ curlike -s -o NUL \
    -w 'code=%{http_code} time=%{time_total}s ip=%{remote_ip} proto=%{http_version}\n' \
    https://example.com
code=200 time=0.412s ip=93.184.216.34 proto=HTTP/1.1
```

---

## 離開代碼

沿用 curl 的代碼，方便既有的 shell script 直接沿用。

| 代碼 | 意義 |
| --- | --- |
| `0` | 成功 |
| `1` | 不支援的協定 |
| `2` | 命令列用法錯誤 |
| `6` | 無法解析主機名稱 |
| `7` | 無法連線 |
| `18` | 檔案不完整 |
| `22` | HTTP 回應為錯誤狀態（`-f`） |
| `23` | 寫出檔案失敗 |
| `26` | 讀取檔案失敗 |
| `28` | 操作逾時 |
| `35` | SSL 連線錯誤 |
| `47` | 重新導向次數過多 |
| `55` | 送出資料時連線中斷 |
| `60` | 對端憑證驗證失敗 |

---

## 與 curl 的差異

已知且刻意保留的差異，換取實作上的簡潔：

- **`-u` 採預先驗證（preemptive）**：第一個請求就會送出 `Authorization`，
  不像 curl 只在收到 `401` 後才重送。對不實作 challenge 的 API 反而更省一次往返。
- **`--http1.0` 不支援**：httpx 底層沒有提供，選項會被接受但標示為不支援。
- **`time_namelookup` 包含連線池等待時間**：DNS 解析與 TCP 握手在底層是同一步驟，
  無法再細分。
- **HTTP/2 為選用功能**：需要另外安裝 `h2`，沒裝時會給清楚的提示而不是直接崩潰。
- **`-G` 不能與 `--data-binary` 併用**：curl 允許但結果不明確，此處直接拒絕。
- **HTTP Digest 認證不完整**：`--digest` 標示為需要額外支援。
- **`--compressed` 只宣告 `gzip, deflate`**：brotli / zstd 未列入。
- **multipart 上傳的 `Content-Type` 推測**：使用 Python 的 `mimetypes`，
  對 `.txt` / `.png` / `.html` 等常見副檔名與 curl 相同，但對較新的副檔名
  （例如 `.md`、`.json`）curl 會傳 `application/octet-stream`，curlike 會傳正確的型別。

---

## 專案結構

```
curlike/
├── curlike/
│   ├── __main__.py     入口點（python -m curlike）
│   ├── app.py          請求執行、重新導向迴圈、錯誤轉換
│   ├── auth.py         Basic / Bearer 認證
│   ├── body.py         -d / -F / --json / -T → 請求本體
│   ├── cli.py          argparse 定義與主流程
│   ├── cookies.py      Cookie 字串與 Netscape jar 格式
│   ├── diagnostics.py  trace 事件、連線資訊、verbose 紀錄
│   ├── errors.py       例外類型與 curl 離開代碼
│   ├── output.py       -o / -O / -J / -D 輸出目的地
│   ├── retry.py        重試策略與 Retry-After 解析
│   ├── urlbuild.py     URL 正規化與 {} / [] globbing
│   ├── version.py      版本資訊
│   └── writeout.py     -w 格式字串
├── tests/              單元測試 + 對本機測試伺服器的端到端測試
├── tools/
│   └── compare_with_curl.py   與真正的 curl 逐項比對送出內容
├── pyproject.toml
└── requirements.txt
```

---

## 執行測試

測試使用標準函式庫的 `unittest`，不需要額外安裝測試框架。
端到端測試會實際啟動一個本機 HTTP 伺服器，並以子程序執行真正的 CLI。

```bash
python -m unittest discover -s tests -t .
```

想確認送出內容和 curl 一致，可以直接跑比對工具（需要系統上有 `curl`）：

```bash
python tools/compare_with_curl.py
```

它會把同一組請求分別交給 `curl` 與 `curlike`，並列出兩邊實際送出的
method、path、query、表頭與本體，逐項比對。multipart 的 boundary 每次都不同
（curl 與 httpx 的格式也不同），比對前會先正規化掉。目前 **21 個案例全數一致**。
