const paths = {
  home: '<path d="M3 10.7 12 3l9 7.7"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8 7.5h8M8 11h5"/>',
  'book-open': '<path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-14c-4.5 0-6.5.5-8 2Z"/><path d="M12 6.5v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="M7.5 14h2M14.5 14h2M7.5 17.5h2"/>',
  'calendar-check': '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m8.5 15 2.2 2.2 4.8-4.7"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx=".8"/><rect x="13" y="8" width="3" height="9" rx=".8"/><rect x="18" y="14" width="3" height="3" rx=".8"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 8 5-2.6 5 2.6-1.5-8"/>',
  file: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8Z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 6.5 3 3"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M11 8l-4 4 4 4M7 12h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  pin: '<path d="M20 10c0 6-8 11.5-8 11.5S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M7 3h3l1.5 5-2 1.5a13 13 0 0 0 5 5L16 12.5l5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3h1Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
  graduation: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  save: '<path d="M5 3h11l3 3v15H5V3Z"/><path d="M8 3v6h7V3M8 14h8v7H8z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 6"/><path d="M20 4v7h-7"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  'eye-off': '<path d="M3 3l18 18"/><path d="M10.5 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-2.4 3.1M6.2 6.4C3.4 8.4 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.1-.9"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/>',
  building: '<path d="M4 21V5l8-3 8 3v16"/><path d="M2 21h20"/><path d="M8 8h1M8 12h1M8 16h1M15 8h1M15 12h1M15 16h1M11 21v-4h2v4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  message: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12Z"/><path d="M8 12h8M8 9h5"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h5M11 16.5h5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  megaphone: '<path d="m3 11 15-6v14L3 13v-2Z"/><path d="M6 13v5a2 2 0 0 0 2 2h1v-6"/><path d="M21 9v6"/>'
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function initials(name = '') {
  const text = String(name).trim();
  if (!text) return '?';
  const latin = text.match(/[A-Za-z]+/g);
  if (latin && /^[A-Za-z\s.]+$/.test(text)) {
    return latin.slice(0, 2).map((s) => s[0].toUpperCase()).join('');
  }
  return text.slice(0, 1);
}

export function avatar(user, size = '') {
  const name = typeof user === 'string' ? user : user?.name || '?';
  const color = (!user || typeof user === 'string') ? '#0f3558' : (user.color || '#0f3558');
  return `<span class="avatar ${size ? `avatar-${size}` : ''}" style="background:${esc(color)}" title="${esc(name)}">${esc(initials(name))}</span>`;
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDate(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtShort(value) {
  const d = parseDate(value);
  if (!d) return { day: '—', month: '', weekday: '', full: '—' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: `${d.getMonth() + 1}月`,
    weekday: `週${WEEK[d.getDay()]}`,
    full: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  };
}

export function fmtDateTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function todayLong() {
  const d = new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 週${WEEK[d.getDay()]}`;
}

export function pageHead({ eyebrow = '', title, sub = '', actions = '' }) {
  return `<div class="page-head">
    <div>${eyebrow ? `<div class="page-eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;
}

export function emptyState({ iconName = 'info', title = '目前沒有資料', desc = '', action = '' }) {
  return `<div class="empty"><div class="empty-icon">${icon(iconName)}</div><h3>${esc(title)}</h3>${desc ? `<p>${desc}</p>` : ''}${action}</div>`;
}

export const loadingState = (text = '載入中…') => `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`;
export const errorState = (msg = '資料載入失敗') => `<div class="error-box"><strong>發生錯誤</strong>${esc(msg)}</div>`;

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function statusBadge(status) {
  const map = {
    pending: ['amber', '審核中'],
    approved: ['green', '已核准'],
    rejected: ['red', '已駁回'],
    cancelled: ['gray', '已取消']
  };
  const [tone, label] = map[status] || ['gray', status || '未知'];
  return `<span class="badge badge-${tone}"><span class="status-dot" style="background:currentColor"></span>${label}</span>`;
}

export function typeBadge(type) {
  return type === 'required'
    ? '<span class="badge badge-navy">必修</span>'
    : '<span class="badge badge-gold">選修</span>';
}

export function gpaClass(score) {
  if (score >= 85) return 'a';
  if (score >= 70) return 'b';
  if (score >= 60) return 'c';
  return 'f';
}

export function gradeLetter(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C';
  return 'F';
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round(part / total * 100)));
}

export function toast(message, type = 'success') {
  const root = $('#toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
  node.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  root.append(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 260);
  }, 3200);
}

export function openModal({ title, subtitle = '', body = '', footer = '', size = '' }) {
  const root = $('#modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head">
      <div><h3>${esc(title)}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      <button class="modal-close" type="button" aria-label="關閉">${icon('x')}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div>`;
  root.append(overlay);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const close = () => {
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  const focusable = overlay.querySelector('input, select, textarea, button.btn-primary');
  if (focusable) setTimeout(() => focusable.focus(), 60);
  return { overlay, el: overlay, close, body: overlay.querySelector('.modal-body'), footer: overlay.querySelector('.modal-foot') };
}

export function confirmDialog({ title = '確認操作', message = '', confirmText = '確定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      size: 'modal-sm',
      body: `<p style="font-size:13px;line-height:1.8;color:#44576b">${message}</p>`,
      footer: `<button class="btn btn-outline" data-cancel>${esc(cancelText)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>`
    });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve(value);
    };
    modal.footer.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    modal.footer.querySelector('[data-ok]').addEventListener('click', () => finish(true));
    modal.overlay.addEventListener('click', (e) => { if (e.target === modal.overlay) finish(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); }, { once: true });
  });
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function setBusy(button, busy, text = '處理中…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>${esc(text)}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}
