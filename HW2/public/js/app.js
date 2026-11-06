import { api, tokenStore } from './api.js';
import {
  $, $$, esc, avatar, icon, toast, loadingState, errorState,
  openModal, confirmDialog, fmtDate, todayLong
} from './ui.js';
import {
  renderStudentDashboard, renderCourseSelection, renderMyCourses, renderGrades,
  renderRequirements, renderLeaves
} from './pages/student.js';
import {
  renderTeacherDashboard, renderTeacherCourses, renderGradeEntry
} from './pages/teacher.js';
import {
  renderAdminDashboard, renderAdminCourses, renderAdminStudents, renderAdminLeaves
} from './pages/admin.js';
import {
  renderTimetablePage, renderAnnouncementsPage, renderProfilePage
} from './pages/shared.js';

const ROLE_LABEL = { student: '學生', teacher: '教師', admin: '教務管理員' };

const NAV = {
  student: [
    { label: '學習', items: [
      { id: 'dashboard', label: '學習總覽', icon: 'home' },
      { id: 'courses', label: '選課系統', icon: 'search' },
      { id: 'my-courses', label: '我的課程', icon: 'book' },
      { id: 'timetable', label: '課表', icon: 'calendar' }
    ] },
    { label: '紀錄', items: [
      { id: 'grades', label: '成績查詢', icon: 'chart' },
      { id: 'requirements', label: '畢業學分', icon: 'graduation' },
      { id: 'leaves', label: '請假申請', icon: 'file' }
    ] },
    { label: '資訊', items: [
      { id: 'announcements', label: '校園公告', icon: 'bell' },
      { id: 'profile', label: '個人資料', icon: 'user' }
    ] }
  ],
  teacher: [
    { label: '教學', items: [
      { id: 'dashboard', label: '教學總覽', icon: 'home' },
      { id: 'my-courses', label: '授課課程', icon: 'book' },
      { id: 'grade-entry', label: '成績登錄', icon: 'edit' },
      { id: 'timetable', label: '課表', icon: 'calendar' }
    ] },
    { label: '資訊', items: [
      { id: 'announcements', label: '校園公告', icon: 'bell' },
      { id: 'profile', label: '個人資料', icon: 'user' }
    ] }
  ],
  admin: [
    { label: '教務管理', items: [
      { id: 'dashboard', label: '管理總覽', icon: 'home' },
      { id: 'admin-courses', label: '課程管理', icon: 'book' },
      { id: 'admin-students', label: '學生名冊', icon: 'users' },
      { id: 'admin-leaves', label: '請假審核', icon: 'clipboard' }
    ] },
    { label: '資訊', items: [
      { id: 'admin-announcements', label: '公告管理', icon: 'megaphone' },
      { id: 'profile', label: '個人資料', icon: 'user' }
    ] }
  ]
};

const PAGES = {
  student: {
    dashboard: renderStudentDashboard,
    courses: renderCourseSelection,
    'my-courses': renderMyCourses,
    timetable: renderTimetablePage,
    grades: renderGrades,
    requirements: renderRequirements,
    leaves: renderLeaves,
    announcements: renderAnnouncementsPage,
    profile: renderProfilePage
  },
  teacher: {
    dashboard: renderTeacherDashboard,
    'my-courses': renderTeacherCourses,
    'grade-entry': renderGradeEntry,
    timetable: renderTimetablePage,
    announcements: renderAnnouncementsPage,
    profile: renderProfilePage
  },
  admin: {
    dashboard: renderAdminDashboard,
    'admin-courses': renderAdminCourses,
    'admin-students': renderAdminStudents,
    'admin-leaves': renderAdminLeaves,
    'admin-announcements': renderAnnouncementsPage,
    profile: renderProfilePage
  }
};

const state = { user: null, meta: null, route: null, booting: true };
let logoutLock = false;

const ctx = {
  state,
  navigate: (route) => goRoute(route),
  refresh: () => { if (state.user) renderRoute(state.route); },
  updateUser: (user) => { state.user = user; }
};

function parseHash() {
  return location.hash.replace(/^#\/?/, '').split('?')[0] || '';
}

function navItems(role) {
  return NAV[role].flatMap((g) => g.items);
}

function defaultRoute(role) {
  return NAV[role][0].items[0].id;
}

function routeLabel(role, route) {
  return navItems(role).find((i) => i.id === route)?.label || 'NQU Campus';
}

function routeExists(role, route) {
  return Boolean(PAGES[role]?.[route]);
}

function shellMarkup(user, meta) {
  const groups = NAV[user.role].map((group) => `<div class="nav-group">
    <div class="nav-group-label">${esc(group.label)}</div>
    ${group.items.map((item) => `<a class="nav-item" href="#/${item.id}" data-route="${item.id}">${icon(item.icon)}<span>${esc(item.label)}</span></a>`).join('')}
  </div>`).join('');

  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <a class="sidebar-brand" href="#/dashboard">
        <span class="brand-mark"><svg viewBox="0 0 64 64" fill="none"><path d="M32 7 54 17v14c0 12-9.6 21.4-22 24.5C19.6 52.4 10 43 10 31V17L32 7Z" stroke="currentColor" stroke-width="2"/><path d="M21 26h22M23 34h18M26 42h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="brand-text"><strong>NQU Campus</strong><small>國立金門大學</small></span>
      </a>
      <div class="sidebar-semester">${icon('calendar', 'icon-sm')}<span>${esc(meta.semester)}</span></div>
      <nav class="sidebar-nav" id="sidebar-nav">${groups}</nav>
      <div class="sidebar-foot">
        <div class="sidebar-user">
          <span id="shell-avatar">${avatar(user, 'sm')}</span>
          <div class="grow"><strong id="shell-name">${esc(user.name)}</strong><span>${ROLE_LABEL[user.role]} · ${esc(user.dept)}</span></div>
        </div>
        <div class="sidebar-version">NQU Campus v${esc(meta.version)} · Demo Project</div>
      </div>
    </aside>
    <div class="sidebar-scrim" id="scrim"></div>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="開啟選單">${icon('menu')}</button>
          <div class="topbar-context">
            <span class="hide-sm">${esc(meta.schoolName)}</span><span class="dot hide-sm"></span>
            <b>${esc(meta.semester)}</b><span class="dot"></span>
            <span class="topbar-date">${todayLong()}</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" id="bell-btn" title="最新公告" aria-label="最新公告">${icon('bell')}<span class="dot-alert"></span></button>
          <button class="icon-btn" id="logout-btn" title="登出" aria-label="登出">${icon('logout')}</button>
          <button class="user-chip" id="user-chip" title="個人資料">
            <span id="top-avatar">${avatar(user, 'sm')}</span>
            <span class="meta"><strong id="top-name">${esc(user.name)}</strong><span>${ROLE_LABEL[user.role]}</span></span>
            ${icon('chevron-down')}
          </button>
        </div>
      </header>
      <main class="content"><div id="view"></div></main>
    </div>
  </div>`;
}

function bindShell() {
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const closeMenu = () => { sidebar.classList.remove('open'); scrim.classList.remove('show'); };
  $('#menu-btn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    scrim.classList.toggle('show');
  });
  scrim.addEventListener('click', closeMenu);
  $('#sidebar-nav').addEventListener('click', (e) => { if (e.target.closest('.nav-item')) closeMenu(); });
  $('#user-chip').addEventListener('click', () => goRoute('profile'));
  $('#logout-btn').addEventListener('click', doLogout);
  $('#bell-btn').addEventListener('click', showNotifications);
}

function updateActiveNav(route) {
  $$('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
    if (el.dataset.route === route) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function renderRoute(route) {
  if (!state.user) return;
  const role = state.user.role;
  let target = route || state.route || defaultRoute(role);
  if (!routeExists(role, target)) {
    target = defaultRoute(role);
    history.replaceState(null, '', `#/${target}`);
  }
  state.route = target;
  const view = document.createElement('div');
  view.id = 'view';
  const old = $('#view');
  if (old) old.replaceWith(view);
  updateActiveNav(target);
  document.title = `${routeLabel(role, target)} · NQU Campus`;
  window.scrollTo({ top: 0, behavior: 'auto' });
  const page = PAGES[role][target];
  Promise.resolve(page(view, ctx)).catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="page">${errorState(err.message || '頁面載入失敗')}</div>`;
    toast('頁面載入失敗，請稍後再試', 'error');
  });
}

function goRoute(route) {
  if (!state.user || !routeExists(state.user.role, route)) return;
  if (location.hash === `#/${route}`) {
    renderRoute(route);
  } else {
    location.hash = `#/${route}`;
  }
}

function enterApp() {
  state.booting = false;
  $('#app').hidden = false;
  $('#app').innerHTML = shellMarkup(state.user, state.meta);
  bindShell();
  const role = state.user.role;
  let route = parseHash();
  if (!routeExists(role, route)) {
    route = defaultRoute(role);
    history.replaceState(null, '', `#/${route}`);
  }
  renderRoute(route);
}

function showLogin(message = '') {
  state.user = null;
  state.meta = null;
  state.route = null;
  document.title = '登入 · NQU Campus';
  const app = $('#app');
  app.hidden = false;
  app.innerHTML = `<div class="login-page">
    <section class="login-art">
      <div class="art-top">
        <span class="brand-mark"><svg viewBox="0 0 64 64" fill="none"><path d="M32 7 54 17v14c0 12-9.6 21.4-22 24.5C19.6 52.4 10 43 10 31V17L32 7Z" stroke="currentColor" stroke-width="2"/><path d="M21 26h22M23 34h18M26 42h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="brand-text"><strong>NQU Campus</strong><small>國立金門大學 · 校務行政</small></span>
      </div>
      <div class="art-main">
        <span class="art-kicker">Island · Knowledge · Future</span>
        <h1>在海島之上，<br />讓學習被<em>好好承接</em>。</h1>
        <p class="art-desc">從選課、課表到成績與畢業學分，整合學生、教師與教務處的日常校務流程，讓每一個學習階段都清晰可見。</p>
        <div class="art-features">
          <div class="art-feature">${icon('search')}<div><strong>選課與課表</strong><span>即時衝堂檢查與容量管理</span></div></div>
          <div class="art-feature">${icon('chart')}<div><strong>成績與學分</strong><span>學期成績、GPA 與畢業進度</span></div></div>
          <div class="art-feature">${icon('file')}<div><strong>請假與公告</strong><span>線上申請與教務審核流程</span></div></div>
        </div>
      </div>
      <div class="art-foot"><span>© ${new Date().getFullYear()} 國立金門大學 · 教務處</span><span>Demo Project · NQU Campus v1.0</span></div>
      <div class="island-wave"><svg viewBox="0 0 800 120" preserveAspectRatio="none" fill="none"><path d="M0 82c110-26 190 18 290 4s150-44 250-24 150 30 260 4v54H0V82Z" fill="rgba(47,125,120,.18)"/><path d="M0 98c120-20 210 14 310 0s170-30 260-12 150 16 230 0v34H0V98Z" fill="rgba(196,154,82,.10)"/></svg></div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <div class="login-eyebrow">NQU CAMPUS · SIGN IN</div>
        <h2>歡迎回來</h2>
        <p class="login-sub">請使用校務系統帳號登入，開始今天的學習與教學。</p>
        <form class="login-form" id="login-form" novalidate>
          <div class="login-error" id="login-error">${icon('alert', 'icon-sm')}<span>${esc(message)}</span></div>
          <div class="field">
            <label for="login-username">帳號</label>
            <div class="input-wrap">${icon('user')}<input id="login-username" name="username" autocomplete="username" placeholder="學號 / 教師編號 / 管理員帳號" required value="${esc(localStorage.getItem('nqu_last_user') || '')}" /></div>
          </div>
          <div class="field">
            <label for="login-password">密碼</label>
            <div class="input-wrap">${icon('lock')}<input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="請輸入密碼" required />
              <button type="button" class="pwd-toggle" id="pwd-toggle" aria-label="顯示密碼">${icon('eye', 'icon-sm')}</button>
            </div>
          </div>
          <button class="btn btn-primary btn-block login-submit" type="submit" id="login-submit">${icon('arrow-right')}登入系統</button>
        </form>
        <div class="demo-box">
          <div class="demo-box-head"><strong>示範帳號</strong><span>點擊即可一鍵登入 · 密碼 123456</span></div>
          <div class="demo-list">
            <button class="demo-btn" type="button" data-demo="s11301001"><span class="demo-role">STUDENT</span><strong>陳品妤</strong><span>資工二A · s11301001</span></button>
            <button class="demo-btn" type="button" data-demo="t1001"><span class="demo-role">TEACHER</span><strong>王世豪</strong><span>資訊工程學系 · t1001</span></button>
            <button class="demo-btn" type="button" data-demo="admin"><span class="demo-role">ADMIN</span><strong>林美華</strong><span>教務處 · admin</span></button>
          </div>
        </div>
        <p class="login-foot">此為展示用專案，資料儲存於本機 <strong>data/db.json</strong>。<br />請勿輸入真實個人資料或公務帳號密碼。</p>
      </div>
    </section>
  </div>`;

  if (message) $('#login-error').classList.add('show');
  const form = $('#login-form');
  const errorBox = $('#login-error');
  const pwd = $('#login-password');
  const toggle = $('#pwd-toggle');
  toggle.addEventListener('click', () => {
    const isPwd = pwd.type === 'password';
    pwd.type = isPwd ? 'text' : 'password';
    toggle.innerHTML = icon(isPwd ? 'eye-off' : 'eye', 'icon-sm');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $('#login-username').value.trim();
    const password = pwd.value;
    errorBox.classList.remove('show');
    if (!username || !password) {
      errorBox.querySelector('span').textContent = '請輸入帳號與密碼';
      errorBox.classList.add('show');
      return;
    }
    const btn = $('#login-submit');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:15px;height:15px;border-width:2px"></span>登入中…`;
    try {
      const res = await api.login(username, password);
      tokenStore.set(res.token);
      localStorage.setItem('nqu_last_user', username);
      state.user = res.user;
      state.meta = res.meta;
      state.booting = false;
      enterApp();
      toast(`歡迎回來，${res.user.name}`);
    } catch (err) {
      errorBox.querySelector('span').textContent = err.message;
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = `${icon('arrow-right')}登入系統`;
      pwd.select();
    }
  });

  $$('[data-demo]').forEach((btn) => btn.addEventListener('click', () => {
    $('#login-username').value = btn.dataset.demo;
    pwd.value = '123456';
    form.requestSubmit();
  }));
}

async function doLogout() {
  if (logoutLock) return;
  const ok = await confirmDialog({
    title: '登出系統',
    message: '確定要登出校務系統嗎？未儲存的表單內容將會遺失。',
    confirmText: '登出',
    danger: true
  });
  if (!ok) return;
  logoutLock = true;
  try { await api.logout(); } catch { /* ignore */ }
  tokenStore.clear();
  sessionStorage.removeItem('nqu_grade_course');
  history.replaceState(null, '', location.pathname);
  showLogin();
  toast('已安全登出', 'info');
  logoutLock = false;
}

async function showNotifications() {
  const route = state.user.role === 'admin' ? 'admin-announcements' : 'announcements';
  const modal = openModal({
    title: '最新公告',
    subtitle: '校園與教務相關訊息',
    body: loadingState('載入公告…'),
    footer: `<button class="btn btn-outline" data-close>關閉</button><button class="btn btn-primary" data-all>查看全部公告</button>`
  });
  modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
  modal.footer.querySelector('[data-all]').addEventListener('click', () => { modal.close(); goRoute(route); });
  try {
    const { announcements } = await api.get('/announcements');
    modal.body.innerHTML = announcements.length
      ? `<div class="announce-list" style="margin:-20px -22px">${announcements.slice(0, 5).map((a) => {
        const d = new Date(a.createdAt);
        return `<div class="announce-item">
          <div class="announce-date"><strong>${String(d.getDate()).padStart(2, '0')}</strong><span>${d.getMonth() + 1}月</span></div>
          <div class="announce-main"><div class="announce-title-row">${a.pinned ? `<span class="pin-flag">${icon('pin', 'icon-sm')}</span>` : ''}<span class="announce-title">${esc(a.title)}</span></div><div class="announce-meta"><span class="badge badge-gray">${esc(a.category)}</span><span>${fmtDate(a.createdAt)}</span></div></div>
        </div>`;
      }).join('')}</div>`
      : '<p class="muted small">目前沒有公告。</p>';
  } catch (err) {
    modal.body.innerHTML = errorState(err.message);
  }
}

async function boot() {
  $('#boot')?.remove();
  window.addEventListener('hashchange', () => {
    if (!state.user) return;
    renderRoute(parseHash());
  });
  window.addEventListener('nqu:unauthorized', () => {
    if (state.booting || logoutLock) return;
    logoutLock = true;
    tokenStore.clear();
    state.user = null;
    state.meta = null;
    showLogin('登入狀態已逾時，請重新登入。');
    toast('登入狀態已逾時', 'error');
    logoutLock = false;
  });

  const token = tokenStore.get();
  if (!token) {
    state.booting = false;
    showLogin();
    return;
  }
  try {
    const res = await api.get('/auth/me');
    state.user = res.user;
    state.meta = res.meta;
    state.booting = false;
    enterApp();
  } catch {
    state.booting = false;
    tokenStore.clear();
    showLogin();
  }
}

boot();
