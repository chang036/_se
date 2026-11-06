import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "notes-app:notes";

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const THEME_KEY = "notes-app:theme";

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" || saved === "light" ? saved : "auto";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [notes, setNotes] = useState(loadNotes);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(loadTheme);
  const textareaRef = useRef(null);

  // 自動儲存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // 套用主題（auto = 跟隨系統）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "auto" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  function cycleTheme() {
    setTheme((t) => (t === "auto" ? "dark" : t === "dark" ? "light" : "auto"));
  }

  const isDark = theme === "dark" || (theme === "auto" && systemPrefersDark());

  // 記住明確選擇（auto 不寫入，讓它持續跟隨系統）
  useEffect(() => {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const activeNote = notes.find((n) => n.id === activeId) || null;

  const filtered = query.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(query.toLowerCase()) ||
          n.content.toLowerCase().includes(query.toLowerCase())
      )
    : notes;

  function createNote() {
    const now = Date.now();
    const note = { id: uid(), title: "新筆記", content: "", createdAt: now, updatedAt: now };
    setNotes([note, ...notes]);
    setActiveId(note.id);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function updateNote(id, patch) {
    const now = Date.now();
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n))
    );
  }

  function deleteNote(id) {
    if (!confirm("確定要刪除這篇筆記嗎？")) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }

  // 從第一行文字自動推導標題
  function deriveTitle(content) {
    const firstLine = content.split("\n")[0].trim();
    return firstLine ? firstLine.slice(0, 30) : "空白筆記";
  }

  function handleContentChange(e) {
    const content = e.target.value;
    updateNote(activeId, { content, title: deriveTitle(content) });
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>📝 快速筆記</h1>
          <div className="sidebar-actions">
            <button
              className="icon-btn"
              onClick={cycleTheme}
              title={
                theme === "auto"
                  ? "主題：跟隨系統（點擊切換）"
                  : `主題：${isDark ? "暗色" : "亮色"}（點擊切換）`
              }
            >
              {theme === "auto" ? "◐" : isDark ? "☀️" : "🌙"}
            </button>
            <button className="btn-primary" onClick={createNote}>
              ＋ 新筆記
            </button>
          </div>
        </div>
        <input
          className="search"
          type="search"
          placeholder="搜尋筆記…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="note-list">
          {filtered.length === 0 && (
            <li className="empty-hint">
              {query ? "找不到符合的筆記" : "還沒有筆記，點「＋ 新筆記」開始"}
            </li>
          )}
          {filtered.map((n) => (
            <li
              key={n.id}
              className={n.id === activeId ? "note-item active" : "note-item"}
              onClick={() => setActiveId(n.id)}
            >
              <span className="note-item-title">{n.title}</span>
              <span className="note-item-date">{formatDate(n.updatedAt)}</span>
              <button
                className="note-item-delete"
                title="刪除"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <footer className="sidebar-footer">共 {notes.length} 篇 · 存在瀏覽器本機</footer>
      </aside>

      <main className="editor">
        {activeNote ? (
          <>
            <div className="editor-header">
              <span className="editor-date">最後編輯：{formatDate(activeNote.updatedAt)}</span>
              <span className="autosave">✓ 自動儲存</span>
            </div>
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              placeholder="在這裡輸入筆記內容…（第一行會變成標題）"
              value={activeNote.content}
              onChange={handleContentChange}
            />
          </>
        ) : (
          <div className="editor-placeholder">
            <p>👈 選擇左邊的筆記，或建立一篇新筆記</p>
          </div>
        )}
      </main>
    </div>
  );
}
