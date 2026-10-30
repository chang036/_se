/* ============================================================
   本機儲存
   ------------------------------------------------------------
   只使用 localStorage，資料不會離開這台裝置。
   若瀏覽器拒絕寫入（例如私密模式），網站仍可正常使用，
   只是重新整理後設定會消失。
   ============================================================ */

const PREFIX = "anxin-assistant:";

export const KEYS = {
  font: PREFIX + "font-size",
  voice: PREFIX + "voice-auto",
  contacts: PREFIX + "contacts",
  lastTask: PREFIX + "last-task",
};

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* 忽略無法寫入的環境 */
  }
}

/* ---------------- 字級 ---------------- */

const FONT_SIZES = ["small", "medium", "large"];

export function loadFont() {
  const saved = read(KEYS.font, "large");
  return FONT_SIZES.includes(saved) ? saved : "large";
}

export function saveFont(size) {
  return write(KEYS.font, size);
}

/* ---------------- 自動朗讀 ---------------- */

export function loadVoiceEnabled() {
  const saved = read(KEYS.voice, true);
  return saved !== false;
}

export function saveVoiceEnabled(enabled) {
  return write(KEYS.voice, Boolean(enabled));
}

/* ---------------- 家人電話 ---------------- */

export function loadContacts() {
  const raw = read(KEYS.contacts, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: String(item.name || "").trim().slice(0, 12),
      phone: String(item.phone || "").trim().slice(0, 20),
    }))
    .filter((item) => item.name && item.phone)
    .slice(0, 4);
}

export function saveContacts(contacts) {
  return write(KEYS.contacts, contacts);
}

/* ---------------- 上次看的教學 ---------------- */

export function loadLastTask() {
  const raw = read(KEYS.lastTask, null);
  if (!raw || typeof raw !== "object") return null;
  const taskId = String(raw.taskId || "");
  const systemId = String(raw.systemId || "");
  const at = Number(raw.at);
  if (!taskId || !Number.isFinite(at)) return null;
  return { taskId, systemId, at };
}

export function saveLastTask(record) {
  return write(KEYS.lastTask, record);
}

export function clearLastTask() {
  remove(KEYS.lastTask);
}
