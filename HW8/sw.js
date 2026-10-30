/* ============================================================
   離線快取
   ------------------------------------------------------------
   教學內容都是靜態檔案，第一次開啟後就存進手機。
   之後就算沒有網路，也能看教學、用語音和家人的電話。
   更新網站內容時，請把 CACHE_NAME 的版本號加一。
   ============================================================ */

const CACHE_NAME = "anxin-assistant-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./js/tasks.js",
  "./js/store.js",
  "./js/speech.js",
  "./js/device.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function storeResponse(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, copy))
    .catch(() => {
      /* 快取失敗不影響上網 */
    });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 頁面：先試網路，離線或網路出錯時用快取。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            storeResponse(request, response);
            return response;
          }
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            response
          );
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            new Response("目前沒有網路，請稍後再打開。", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        })
    );
    return;
  }

  // 其他檔案：先給快取，同時在背景更新。
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            storeResponse(request, response);
            return response;
          }
          return cached || response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
