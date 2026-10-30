/* ============================================================
   裝置判斷
   ------------------------------------------------------------
   自動選出 iPhone / Android / Windows / Mac / 手錶版本，
   讓長輩不用自己分辨。判斷錯也可以用手動切換。
   ============================================================ */

export function detectPlatform() {
  const ua = navigator.userAgent || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  if (/iPhone|iPod/i.test(ua)) return "ios";
  // iPadOS 13 以後的 Safari 會把自己說成 Mac，用觸控點數分辨。
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return /Watch/i.test(ua) ? "watch-android" : "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

export function isPlatformMatch(task, platform) {
  if (!task) return false;
  if (task.category === "phone") return platform === "ios" || platform === "android";
  if (task.category === "computer") return platform === "windows" || platform === "mac";
  if (task.category === "watch") {
    return platform === "ios" || platform === "mac" || platform === "android";
  }
  return false;
}

export function preferredSystemId(task, platform = detectPlatform()) {
  const ids = task.systems.map((system) => system.id);
  const first = ids[0];

  if (task.category === "phone") {
    if (platform === "ios" && ids.includes("ios")) return "ios";
    if (platform === "android" && ids.includes("android")) return "android";
  }

  if (task.category === "computer") {
    if (platform === "mac" && ids.includes("mac")) return "mac";
    if (platform === "windows" && ids.includes("windows")) return "windows";
  }

  if (task.category === "watch") {
    if ((platform === "ios" || platform === "mac") && ids.includes("watch-ios")) {
      return "watch-ios";
    }
    if (platform === "android" && ids.includes("watch-android")) return "watch-android";
    if (platform === "watch-android" && ids.includes("watch-android")) return "watch-android";
  }

  return first;
}
