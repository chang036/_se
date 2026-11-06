import { api } from '../api.js';
import {
  $, $$, esc, avatar, icon, pageHead, fmtDate, fmtShort, todayLong,
  emptyState, loadingState, errorState, statusBadge, typeBadge, toast,
  openModal, confirmDialog, gradeLetter, gpaClass, pct, downloadCsv
} from '../ui.js';
import { openCourseDetail } from './shared.js';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function weekOfSemester(meta) {
  const start = new Date(`${meta.semesterStart}T00:00:00`);
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}

function statCard({ label, value, unit = '', note = '', iconName = 'book', tone = 'navy' }) {
  const tones = {
    navy: ['#e8f1fa', '#164b78'], teal: ['#e4f2f1', '#2f7d78'],
    gold: ['#f3e8d3', '#a87324'], red: ['#fbeaea', '#bf4d4d'], green: ['#e6f4ec', '#2f855a']
  };
  const [soft, color] = tones[tone] || tones.navy;
  return `<div class="stat-card">
    <div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon" style="--stat-soft:${soft};--stat-color:${color}">${icon(iconName)}</span></div>
    <div class="stat-value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    <div class="stat-foot">${note}</div>
  </div>`;
}

function conflictWith(course, mine) {
  for (const slot of course.schedule || []) {
    for (const other of mine) {
      if (other.id === course.id) continue;
      for (const s of other.schedule || []) {
        if (s.day === slot.day && slot.periods.some((p) => s.periods.includes(p))) return other;
      }
    }
  }
  return null;
}

export async function renderStudentDashboard(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'ACADEMIC OVERVIEW', title: '學習總覽' }) + loadingState('正在整理你的學習資訊…');
  try {
    const [courseData, tt, annData, leaveData, gradeData] = await Promise.all([
      api.get('/courses?scope=mine'),
      api.get('/timetable'),
      api.get('/announcements'),
      api.get('/leaves'),
      api.get('/grades')
    ]);
    const courses = courseData.courses;
    const credits = courses.reduce((s, c) => s + c.credits, 0);
    const summary = gradeData.summary;
    const today = new Date().getDay();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const todayEntries = tt.entries.filter((e) => e.day === today).sort((a, b) => a.periods[0] - b.periods[0]);
    const pendingLeaves = leaveData.leaves.filter((l) => l.status === 'pending');
    const first = todayEntries[0];
    const firstPeriod = first ? tt.periods.find((p) => p.no === first.periods[0]) : null;
    const now = new Date();
    const d = fmtShort(now);

    let todayHtml = '';
    if (!todayEntries.length) {
      todayHtml = emptyState({ iconName: 'calendar-check', title: '今天沒有排課', desc: today === 0 || today === 6 ? '週末愉快！好好休息，為下週充電。' : '可以利用時間複習課程或到圖書館走走。' });
    } else {
      todayHtml = `<div class="today-list">${todayEntries.map((e) => {
        const start = tt.periods.find((p) => p.no === e.periods[0]);
        const end = tt.periods.find((p) => p.no === e.periods[e.periods.length - 1]);
        return `<div class="today-item">
          <div class="today-time"><strong>${start.time.split('–')[0]}</strong><span>${start.time.split('–')[1]} 下課</span></div>
          <div class="today-bar" style="--c:${esc(e.color)}"></div>
          <div class="today-main"><strong>${esc(e.name)}</strong><span>${esc(e.room)} · ${esc(e.teacher)} · 第 ${e.periods[0]}–${e.periods[e.periods.length - 1]} 節</span></div>
        </div>`;
      }).join('')}</div>`;
    }

    const annHtml = annData.announcements.slice(0, 4).map((a) => {
      const ad = fmtShort(a.createdAt);
      return `<div class="announce-item" style="padding-left:0;padding-right:0">
        <div class="announce-date"><strong>${ad.day}</strong><span>${ad.month}</span></div>
        <div class="announce-main">
          <div class="announce-title-row">${a.pinned ? `<span class="pin-flag">${icon('pin', 'icon-sm')}</span>` : ''}<a class="announce-title" href="#/announcements">${esc(a.title)}</a></div>
          <div class="announce-meta"><span class="badge badge-gray">${esc(a.category)}</span><span>${fmtDate(a.createdAt)}</span></div>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = pageHead({
      eyebrow: 'ACADEMIC OVERVIEW', title: '學習總覽',
      sub: `歡迎回來，${esc(ctx.state.user.name)}。以下是你的本學期學習狀態。`,
      actions: `<a class="btn btn-outline" href="#/timetable">${icon('calendar')}我的課表</a><a class="btn btn-primary" href="#/courses">${icon('plus')}選課</a>`
    }) + `
    <div class="hero" style="margin-bottom:18px">
      <div class="hero-inner">
        <div>
          <div class="hero-kicker">${icon('sparkle')}${esc(ctx.state.meta.semester)} · 第 ${weekOfSemester(ctx.state.meta)} 週</div>
          <h1>${greeting()}，<em>${esc(ctx.state.user.name)}</em> 同學</h1>
          <p class="hero-desc">${first
            ? `今天有 <b style="color:#e7d3aa">${todayEntries.length}</b> 門課，第一堂是 <b style="color:#f0e0be">${esc(first.name)}</b>（${firstPeriod?.time.split('–')[0]} 於 ${esc(first.room)}）。記得預留通勤時間。`
            : '今天沒有排定課程，適合安排自主學習、專題討論或到圖書館充實自己。'}</p>
          <div class="hero-meta">
            <span class="hero-pill">${icon('graduation')}學號 ${esc(ctx.state.user.studentNo)}</span>
            <span class="hero-pill">${icon('users')}${esc(ctx.state.user.className)}</span>
            <span class="hero-pill">${icon('book')}本學期 ${credits} 學分</span>
          </div>
          <div class="hero-actions">
            <a class="btn btn-gold btn-sm" href="#/grades">${icon('chart')}查看成績</a>
            <a class="btn btn-outline btn-sm" href="#/leaves">${icon('file')}提出請假</a>
          </div>
        </div>
        <div class="hero-day"><small>${d.month} / ${d.weekday}</small><strong>${d.day}</strong><span>${ctx.state.meta.semester}</span></div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '本學期學分', value: credits, unit: '學分', note: `共 ${courses.length} 門課程`, iconName: 'book', tone: 'navy' })}
      ${statCard({ label: '歷年平均', value: summary.average || '—', unit: summary.average ? '分' : '', note: `累計 ${summary.totalEarned} 畢業學分`, iconName: 'chart', tone: 'teal' })}
      ${statCard({ label: '學業 GPA', value: summary.gpa || '—', unit: '/ 4.0', note: '依歷年成績加權計算', iconName: 'award', tone: 'gold' })}
      ${statCard({ label: '待審假單', value: pendingLeaves.length, unit: '件', note: pendingLeaves.length ? '請留意教務處審核結果' : '目前沒有待審申請', iconName: 'file', tone: pendingLeaves.length ? 'red' : 'green' })}
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);align-items:start">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>今日課程</h2><p>${todayLong()}</p></div><a class="btn-link" href="#/timetable">完整課表 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body">${todayHtml}</div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>最新公告</h2><p>來自教務處與校園各單位</p></div><a class="btn-link" href="#/announcements">查看全部 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${annHtml || emptyState({ iconName: 'bell', title: '目前沒有公告' })}</div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>畢業學分進度</h2><p>${ctx.state.user.className}</p></div><a class="btn-link" href="#/requirements">詳細 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body">
            <div class="between" style="margin-bottom:7px"><span class="small muted">總計</span><span class="small"><b style="font-size:18px">${summary.totalEarned}</b> / ${summary.totalRequired} 學分</span></div>
            <div class="progress gold" style="height:8px"><span style="width:${pct(summary.totalEarned, summary.totalRequired)}%"></span></div>
            <p class="hint" style="margin-top:6px">達成率 ${pct(summary.totalEarned, summary.totalRequired)}%，尚缺 ${Math.max(0, summary.totalRequired - summary.totalEarned)} 學分</p>
            <div class="divider"></div>
            <div class="stack" style="gap:11px">
              ${summary.categories.map((c) => `<div>
                <div class="between" style="margin-bottom:4px"><span class="xs strong">${esc(c.name)}</span><span class="xs muted nums">${c.earned} / ${c.required}</span></div>
                <div class="progress"><span style="width:${pct(c.earned, c.required)}%"></span></div>
              </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>快速入口</h2></div></div>
          <div class="card-body">
            <div class="quick-grid" style="grid-template-columns:1fr 1fr">
              <a class="quick-link" href="#/courses">${icon('search')}選課系統</a>
              <a class="quick-link" href="#/my-courses">${icon('book')}我的課程</a>
              <a class="quick-link" href="#/grades">${icon('chart')}成績查詢</a>
              <a class="quick-link" href="#/leaves">${icon('file')}請假申請</a>
            </div>
          </div>
        </div>
        ${pendingLeaves.length ? `<div class="info-strip gold">${icon('clock')}<div>你有 <b>${pendingLeaves.length}</b> 件請假申請正在審核中，可至 <a href="#/leaves" style="text-decoration:underline">請假紀錄</a> 查看進度。</div></div>` : ''}
      </div>
    </div>`;
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'ACADEMIC OVERVIEW', title: '學習總覽' }) + errorState(err.message);
  }
}

export async function renderCourseSelection(container, ctx) {
  const meta = ctx.state.meta;
  container.innerHTML = pageHead({
    eyebrow: 'COURSE SELECTION', title: '選課系統',
    sub: `${esc(meta.semester)} · 加退選期間：即日起至開學後第 2 週`,
    actions: `<a class="btn btn-outline" href="#/my-courses">${icon('book')}我的課程</a>`
  }) + `
  <div class="card mb-2" style="margin-bottom:16px"><div class="card-body tight"><div class="credit-summary" id="credit-summary">${loadingState('載入選課資料…')}</div></div></div>
  <div class="card" style="margin-bottom:16px"><div class="card-body tight">
    <div class="filters">
      <div class="search">${icon('search')}<input id="cs-search" type="search" placeholder="搜尋課程名稱、代碼或教師…" /></div>
      <select id="cs-dept"><option value="">全部開課單位</option>${meta.departments.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>
      <select id="cs-type"><option value="">全部類別</option><option value="required">必修</option><option value="elective">選修</option></select>
      <label class="checkbox"><input type="checkbox" id="cs-available" /> 只看可選課程</label>
    </div>
  </div></div>
  <div id="cs-grid">${loadingState('載入課程列表…')}</div>`;

  let allCourses = [];
  let mine = [];
  let q = '';
  let dept = '';
  let type = '';
  let onlyAvailable = false;

  const draw = () => {
    const list = allCourses.filter((c) => {
      const text = `${c.name} ${c.code} ${c.teacher?.name || ''}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (dept && c.dept !== dept) return false;
      if (type && c.type !== type) return false;
      if (onlyAvailable && (c.isEnrolled || c.seatsLeft <= 0 || conflictWith(c, mine))) return false;
      return true;
    });
    const credits = mine.reduce((s, c) => s + c.credits, 0);
    const required = mine.filter((c) => c.type === 'required').reduce((s, c) => s + c.credits, 0);
    const elective = credits - required;
    $('#credit-summary', container).innerHTML = `
      <div class="cs-item"><strong>${mine.length}</strong><span>已選課程</span></div><div class="divider-v"></div>
      <div class="cs-item"><strong>${credits}</strong><span>本學期學分</span></div><div class="divider-v"></div>
      <div class="cs-item"><strong>${required}</strong><span>必修學分</span></div>
      <div class="cs-item"><strong>${elective}</strong><span>選修學分</span></div>
      <div class="divider-v"></div>
      <div class="grow small muted">${credits < 9 ? '目前學分數偏低，請留意最低修課學分規定。' : credits > 25 ? '學分數偏高，請評估課業負荷。' : '學分數在建議範圍內，選課狀況良好。'}</div>
      <span class="badge ${credits >= 9 ? 'badge-green' : 'badge-amber'}">${credits >= 9 ? '符合最低修課' : '低於 9 學分'}</span>`;

    const grid = $('#cs-grid', container);
    if (!list.length) {
      grid.innerHTML = `<div class="card">${emptyState({ iconName: 'search', title: '找不到符合條件的課程', desc: '請調整搜尋關鍵字、開課單位或類別。' })}</div>`;
      return;
    }
    grid.innerHTML = `<div class="course-grid">${list.map((c) => {
      const conflict = conflictWith(c, mine);
      const full = c.seatsLeft <= 0;
      const accent = esc(c.color || '#0f3558');
      return `<article class="course-card ${c.isEnrolled ? 'enrolled' : ''}" style="--accent:${accent}">
        ${c.isEnrolled ? '<span class="course-flag" style="background:var(--green)">已選修</span>' : conflict && !c.isEnrolled ? '<span class="course-flag" style="background:var(--red)">時段衝堂</span>' : ''}
        <div class="course-top"><span class="course-code">${esc(c.code)}</span>${typeBadge(c.type)}</div>
        <button class="btn-link course-title" data-detail="${esc(c.id)}" style="text-align:left;font-weight:700;color:inherit">${esc(c.name)}</button>
        <div class="course-teacher">${icon('user', 'icon-sm')}${esc(c.teacher?.name || '未指定')} · ${esc(c.teacher?.title || '')}</div>
        <div class="course-meta">
          <div class="course-meta-row">${icon('clock')}<span>${esc(c.scheduleText)}</span></div>
          <div class="course-meta-row">${icon('pin')}<span>${esc(c.room)}</span></div>
          <div class="course-meta-row">${icon('graduation')}<span>${c.credits} 學分 · ${esc(c.dept)}</span></div>
        </div>
        <div class="course-capacity">
          <div class="between"><span>選課人數</span><span class="nums">${c.enrolledCount} / ${c.capacity}${full ? ' · 額滿' : ` · 餘 ${c.seatsLeft}`}</span></div>
          <div class="progress ${full ? 'red' : c.seatsLeft < 5 ? 'gold' : ''}"><span style="width:${pct(c.enrolledCount, c.capacity)}%"></span></div>
        </div>
        <div class="course-actions">
          <button class="btn btn-outline btn-sm" data-detail="${esc(c.id)}">${icon('eye')}課程資訊</button>
          ${c.isEnrolled
            ? `<button class="btn btn-danger-soft btn-sm" data-drop="${esc(c.id)}">${icon('trash')}退選</button>`
            : `<button class="btn btn-primary btn-sm" data-enroll="${esc(c.id)}" ${full || conflict ? 'disabled' : ''}>${icon('plus')}${full ? '已額滿' : conflict ? '衝堂' : '選課'}</button>`}
        </div>
      </article>`;
    }).join('')}</div>`;
  };

  const load = async () => {
    const [a, b] = await Promise.all([api.get('/courses'), api.get('/courses?scope=mine')]);
    allCourses = a.courses;
    mine = b.courses;
    draw();
  };

  try {
    await load();
  } catch (err) {
    $('#cs-grid', container).innerHTML = `<div class="card">${errorState(err.message)}</div>`;
    $('#credit-summary', container).innerHTML = `<span class="small muted">${esc(err.message)}</span>`;
  }

  $('#cs-search', container).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  $('#cs-dept', container).addEventListener('change', (e) => { dept = e.target.value; draw(); });
  $('#cs-type', container).addEventListener('change', (e) => { type = e.target.value; draw(); });
  $('#cs-available', container).addEventListener('change', (e) => { onlyAvailable = e.target.checked; draw(); });

  $('#cs-grid', container).addEventListener('click', async (event) => {
    const detail = event.target.closest('[data-detail]');
    if (detail) { openCourseDetail(detail.dataset.detail, ctx); return; }
    const enroll = event.target.closest('[data-enroll]');
    if (enroll) {
      enroll.disabled = true;
      try {
        await api.post(`/courses/${enroll.dataset.enroll}/enroll`);
        toast('選課成功，已加入你的課表');
        await load();
      } catch (err) {
        toast(err.message, 'error');
        enroll.disabled = false;
      }
      return;
    }
    const drop = event.target.closest('[data-drop]');
    if (drop) {
      const course = mine.find((c) => c.id === drop.dataset.drop);
      const ok = await confirmDialog({
        title: '退選課程', danger: true, confirmText: '確認退選',
        message: `確定要退選「<b>${esc(course?.name || '')}</b>」嗎？退選後將從課表移除。`
      });
      if (!ok) return;
      try {
        await api.del(`/courses/${drop.dataset.drop}/enroll`);
        toast('已退選課程');
        await load();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
}

export async function renderMyCourses(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'MY COURSES', title: '我的課程' }) + loadingState();
  try {
    const { courses } = await api.get('/courses?scope=mine');
    const credits = courses.reduce((s, c) => s + c.credits, 0);
    const required = courses.filter((c) => c.type === 'required').reduce((s, c) => s + c.credits, 0);
    const weekly = courses.reduce((s, c) => s + c.schedule.reduce((x, slot) => x + slot.periods.length, 0), 0);
    container.innerHTML = pageHead({
      eyebrow: 'MY COURSES', title: '我的課程',
      sub: `${esc(ctx.state.meta.semester)} · 點擊課程可查看大綱與修課資訊`,
      actions: `<a class="btn btn-primary" href="#/courses">${icon('plus')}加選課程</a>`
    }) + `
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '本學期課程', value: courses.length, unit: '門', note: `每週 ${weekly} 節課`, iconName: 'book', tone: 'navy' })}
      ${statCard({ label: '本學期學分', value: credits, unit: '學分', note: '含必修與選修', iconName: 'award', tone: 'gold' })}
      ${statCard({ label: '必修學分', value: required, unit: '學分', note: `選修 ${credits - required} 學分`, iconName: 'layers', tone: 'teal' })}
      ${statCard({ label: '平均每週', value: weekly, unit: '節', note: '依排定時段計算', iconName: 'clock', tone: 'green' })}
    </div>
    ${courses.length ? `<div class="course-grid">${courses.map((c) => `
      <article class="course-card enrolled" style="--accent:${esc(c.color || '#0f3558')}">
        <div class="course-top"><span class="course-code">${esc(c.code)}</span>${typeBadge(c.type)}</div>
        <button class="btn-link course-title" data-detail="${esc(c.id)}" style="text-align:left;font-weight:700;color:inherit">${esc(c.name)}</button>
        <div class="course-teacher">${icon('user', 'icon-sm')}${esc(c.teacher?.name || '未指定')} · ${esc(c.teacher?.title || '')}</div>
        <div class="course-meta">
          <div class="course-meta-row">${icon('clock')}<span>${esc(c.scheduleText)}</span></div>
          <div class="course-meta-row">${icon('pin')}<span>${esc(c.room)}</span></div>
          <div class="course-meta-row">${icon('users')}<span>${c.enrolledCount} 位同學選修</span></div>
        </div>
        <p class="small muted" style="margin-top:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(c.description)}</p>
        <div class="course-actions">
          <button class="btn btn-outline btn-sm" data-detail="${esc(c.id)}">${icon('eye')}課程資訊</button>
          <button class="btn btn-danger-soft btn-sm" data-drop="${esc(c.id)}">${icon('trash')}退選</button>
        </div>
      </article>`).join('')}</div>`
      : `<div class="card">${emptyState({ iconName: 'book', title: '本學期尚未選課', desc: '前往選課系統，探索你有興趣的課程。', action: '<a class="btn btn-primary" href="#/courses">前往選課</a>' })}</div>`}`;

    container.addEventListener('click', async (event) => {
      const detail = event.target.closest('[data-detail]');
      if (detail) { openCourseDetail(detail.dataset.detail, ctx); return; }
      const drop = event.target.closest('[data-drop]');
      if (!drop) return;
      const course = courses.find((c) => c.id === drop.dataset.drop);
      const ok = await confirmDialog({
        title: '退選課程', danger: true, confirmText: '確認退選',
        message: `確定要退選「<b>${esc(course?.name || '')}</b>」嗎？`
      });
      if (!ok) return;
      try {
        await api.del(`/courses/${drop.dataset.drop}/enroll`);
        toast('已退選課程');
        ctx.refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'MY COURSES', title: '我的課程' }) + errorState(err.message);
  }
}

export async function renderGrades(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'ACADEMIC RECORD', title: '成績查詢' }) + loadingState();
  try {
    const { grades, summary } = await api.get('/grades');
    const semesters = [...new Set(grades.map((g) => g.semester))].sort((a, b) => b.localeCompare(a));
    const bySemester = semesters.map((sem) => {
      const rows = grades.filter((g) => g.semester === sem);
      const avg = rows.length ? Math.round(rows.reduce((s, g) => s + g.score, 0) / rows.length * 10) / 10 : 0;
      return { sem, rows, avg };
    });
    const passed = grades.filter((g) => g.score >= 60);
    const earnedCredits = passed.reduce((s, g) => s + g.credits, 0);

    container.innerHTML = pageHead({
      eyebrow: 'ACADEMIC RECORD', title: '成績查詢',
      sub: '歷年學期成績、等第與畢業學分累計',
      actions: `<button class="btn btn-outline" data-export>${icon('download')}匯出 CSV</button>`
    }) + `
    <div class="card" style="margin-bottom:18px"><div class="card-body">
      <div class="grade-summary">
        <div><span>學業平均</span><strong>${summary.average || '—'}<small style="font-size:12px;color:var(--muted);font-weight:500"> / 100</small></strong></div>
        <div><span>GPA（4.0 制）</span><strong style="color:var(--teal)">${summary.gpa || '—'}</strong></div>
        <div><span>已取得學分</span><strong>${earnedCredits}<small style="font-size:12px;color:var(--muted);font-weight:500"> 學分</small></strong></div>
        <div><span>及格課程</span><strong>${passed.length}<small style="font-size:12px;color:var(--muted);font-weight:500"> / ${grades.length} 門</small></strong></div>
      </div>
    </div></div>
    <div class="grid" style="grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);align-items:start;margin-bottom:18px">
      <div class="card">
        <div class="card-head"><div><h2>學期平均趨勢</h2><p>依歷年成績計算</p></div></div>
        <div class="card-body">
          <div class="bar-chart">
            ${bySemester.slice().reverse().map((s) => `<div class="bar-item"><div class="bar" style="height:${Math.max(4, s.avg * 1.3)}px"><span>${s.avg}</span></div><small>${esc(s.sem.replace('-', ' 學年 '))}</small></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>學分達成</h2><p>畢業門檻 ${summary.totalRequired} 學分</p></div><a class="btn-link" href="#/requirements">詳細</a></div>
        <div class="card-body">
          <div class="between"><span class="muted small">已取得</span><span><b style="font-size:20px">${summary.totalEarned}</b> <span class="muted small">/ ${summary.totalRequired}</span></span></div>
          <div class="progress gold" style="height:8px;margin:9px 0 16px"><span style="width:${pct(summary.totalEarned, summary.totalRequired)}%"></span></div>
          <div class="stack" style="gap:10px">
            ${summary.categories.map((c) => `<div class="between"><span class="small">${esc(c.name)}</span><span class="small muted nums">${c.earned} / ${c.required}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="stack">
      ${bySemester.length ? bySemester.map(({ sem, rows, avg }) => `
        <div class="card">
          <div class="card-head"><div><h2>${esc(sem.replace('-', ' 學年度第 '))}${sem.includes('-') ? ' 學期' : ''}</h2><p>共 ${rows.length} 門課程 · ${rows.reduce((s, g) => s + g.credits, 0)} 學分</p></div><span class="badge badge-navy">平均 ${avg}</span></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>課程名稱</th><th>類別</th><th>學分</th><th>分數</th><th>等第</th><th>狀態</th></tr></thead>
            <tbody>${rows.map((g) => `<tr>
              <td><strong>${esc(g.courseName)}</strong></td>
              <td><span class="badge badge-gray">${esc(g.category)}</span></td>
              <td class="num">${g.credits}</td>
              <td class="num strong">${g.score}</td>
              <td><span class="grade-pill ${gpaClass(g.score)}">${gradeLetter(g.score)}</span></td>
              <td>${g.score >= 60 ? '<span class="badge badge-green">及格</span>' : '<span class="badge badge-red">不及格</span>'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>`).join('') : `<div class="card">${emptyState({ iconName: 'chart', title: '目前沒有成績紀錄' })}</div>`}
    </div>`;

    $('[data-export]', container).addEventListener('click', () => {
      const rows = [['學期', '課程名稱', '類別', '學分', '分數', '等第']];
      bySemester.forEach(({ sem, rows: list }) => list.forEach((g) => rows.push([sem, g.courseName, g.category, g.credits, g.score, gradeLetter(g.score)])));
      downloadCsv(`NQU_成績_${ctx.state.user.studentNo}.csv`, rows);
      toast('成績 CSV 已匯出');
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'ACADEMIC RECORD', title: '成績查詢' }) + errorState(err.message);
  }
}

export async function renderRequirements(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'GRADUATION', title: '畢業學分' }) + loadingState();
  try {
    const { requirements } = await api.get('/requirements');
    const percent = pct(requirements.totalEarned, requirements.totalRequired);
    const remaining = Math.max(0, requirements.totalRequired - requirements.totalEarned);
    const radius = 64;
    const circumference = 2 * Math.PI * radius;

    container.innerHTML = pageHead({
      eyebrow: 'GRADUATION', title: '畢業學分',
      sub: `${esc(ctx.state.user.dept)} · ${esc(ctx.state.user.className)} · 畢業門檻 ${requirements.totalRequired} 學分`
    }) + `
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);align-items:start">
      <div class="card">
        <div class="card-head"><div><h2>畢業進度</h2><p>依已取得學分成績計算</p></div></div>
        <div class="card-body" style="text-align:center">
          <div class="ring" style="margin:0 auto">
            <svg viewBox="0 0 154 154">
              <circle class="ring-bg" cx="77" cy="77" r="${radius}"></circle>
              <circle class="ring-val" cx="77" cy="77" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - percent / 100)}"></circle>
            </svg>
            <div class="ring-label"><strong>${percent}%</strong><span>完成率</span></div>
          </div>
          <div style="margin-top:18px"><b style="font-size:26px">${requirements.totalEarned}</b><span class="muted"> / ${requirements.totalRequired} 學分</span></div>
          <p class="hint" style="margin-top:5px">尚缺 ${remaining} 學分即可達成畢業門檻</p>
          <div class="divider"></div>
          <div class="between"><span class="small muted">目前 GPA</span><span class="badge badge-teal">${requirements.gpa} / 4.0</span></div>
          <div class="between" style="margin-top:9px"><span class="small muted">歷年平均</span><span class="badge badge-gold">${requirements.average} 分</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>各類學分要求</h2><p>對照教務處畢業學分表</p></div></div>
        <div class="card-body">
          <div class="stack" style="gap:16px">
            ${requirements.categories.map((c) => {
              const p = pct(c.earned, c.required);
              const done = c.earned >= c.required;
              return `<div>
                <div class="between" style="margin-bottom:6px">
                  <div class="row" style="gap:7px"><span class="req-name" style="font-size:12.5px;font-weight:600">${esc(c.name)}</span>${done ? '<span class="badge badge-green">已達成</span>' : `<span class="badge badge-gray">尚缺 ${c.required - c.earned}</span>`}</div>
                  <span class="small muted nums">${c.earned} / ${c.required} 學分</span>
                </div>
                <div class="progress ${done ? 'green' : 'gold'}" style="height:8px"><span style="width:${p}%"></span></div>
                <div class="hint" style="margin-top:4px">達成率 ${p}%</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="card mt-2" style="margin-top:18px">
      <div class="card-head"><div><h2>學分明細</h2><p>依類別彙整已取得學分</p></div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>學分科目</th><th>最低要求</th><th>已取得</th><th>尚缺</th><th>達成率</th></tr></thead>
        <tbody>${requirements.categories.map((c) => `<tr>
          <td><strong>${esc(c.name)}</strong></td><td class="num">${c.required}</td>
          <td class="num">${c.earned}</td><td class="num">${Math.max(0, c.required - c.earned)}</td>
          <td><div class="progress-row" style="max-width:220px"><div class="progress"><span style="width:${pct(c.earned, c.required)}%"></span></div><span class="nums">${pct(c.earned, c.required)}%</span></div></td>
        </tr>`).join('')}
        <tr style="background:#f8fafc"><td><strong>合計</strong></td><td class="num strong">${requirements.totalRequired}</td><td class="num strong">${requirements.totalEarned}</td><td class="num strong">${remaining}</td><td class="num strong">${percent}%</td></tr>
        </tbody>
      </table></div>
    </div>
    <div class="info-strip mt-2" style="margin-top:18px">${icon('info')}<div>畢業學分採計依各學年度入學學生適用之課程規劃表為準。此頁面為示範資料，實際畢業資格仍以教務處審核結果為準。</div></div>`;
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'GRADUATION', title: '畢業學分' }) + errorState(err.message);
  }
}

export async function renderLeaves(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'LEAVE REQUEST', title: '請假申請' }) + loadingState();
  try {
    const [leaveData, courseData] = await Promise.all([api.get('/leaves'), api.get('/courses?scope=mine')]);
    const leaves = leaveData.leaves;
    const courses = courseData.courses;
    const counts = {
      pending: leaves.filter((l) => l.status === 'pending').length,
      approved: leaves.filter((l) => l.status === 'approved').length,
      rejected: leaves.filter((l) => l.status === 'rejected').length
    };

    const openForm = () => {
      if (!courses.length) {
        toast('目前沒有選修課程，無法提出請假', 'error');
        return;
      }
      const modal = openModal({
        title: '提出請假申請',
        subtitle: '送出後將由教務處進行審核',
        body: `<form id="leave-form" class="stack" style="gap:13px">
          <div class="form-error" id="leave-error"></div>
          <div class="field"><label>請假課程<span class="req">*</span></label><select name="courseId" required>${courses.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}（${esc(c.code)}）</option>`).join('')}</select></div>
          <div class="form-grid">
            <div class="field"><label>假別<span class="req">*</span></label><select name="type"><option>病假</option><option>事假</option><option>公假</option><option>喪假</option></select></div>
            <div class="field"><label>請假天數</label><input value="1 日" disabled /></div>
            <div class="field"><label>開始日期<span class="req">*</span></label><input type="date" name="startDate" value="${localToday()}" required /></div>
            <div class="field"><label>結束日期<span class="req">*</span></label><input type="date" name="endDate" value="${localToday()}" required /></div>
          </div>
          <div class="field"><label>請假事由<span class="req">*</span></label><textarea name="reason" rows="4" maxlength="500" placeholder="請簡述請假原因，並於事後補繳相關證明文件。" required></textarea></div>
          <div class="info-strip gold">${icon('info')}<div>病假請於就診後檢附診斷證明；公假請附活動公文或競賽通知。未經核准之缺課仍依缺席規定處理。</div></div>
        </form>`,
        footer: `<button class="btn btn-outline" data-close>取消</button><button class="btn btn-primary" data-submit>${icon('check')}送出申請</button>`
      });
      modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
      modal.footer.querySelector('[data-submit]').addEventListener('click', async () => {
        const form = $('#leave-form', modal.body);
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const btn = modal.footer.querySelector('[data-submit]');
        btn.disabled = true;
        try {
          await api.post('/leaves', {
            courseId: fd.get('courseId'), type: fd.get('type'),
            startDate: fd.get('startDate'), endDate: fd.get('endDate'), reason: fd.get('reason')
          });
          toast('請假申請已送出');
          modal.close();
          ctx.refresh();
        } catch (err) {
          const box = $('#leave-error', modal.body);
          box.textContent = err.message;
          box.classList.add('show');
          btn.disabled = false;
        }
      });
    };

    container.innerHTML = pageHead({
      eyebrow: 'LEAVE REQUEST', title: '請假申請',
      sub: '提出課程請假並追蹤教務處審核進度',
      actions: `<button class="btn btn-primary" data-new>${icon('plus')}提出請假</button>`
    }) + `
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '審核中', value: counts.pending, unit: '件', note: '等待教務處處理', iconName: 'clock', tone: 'gold' })}
      ${statCard({ label: '已核准', value: counts.approved, unit: '件', note: '完成審核程序', iconName: 'check-circle', tone: 'green' })}
      ${statCard({ label: '已駁回', value: counts.rejected, unit: '件', note: '可洽教務處了解原因', iconName: 'x-circle', tone: 'red' })}
      ${statCard({ label: '累計申請', value: leaves.length, unit: '件', note: '本學期所有假單', iconName: 'file', tone: 'navy' })}
    </div>
    ${leaves.length ? `<div class="leave-list">${leaves.map((l) => `
      <div class="leave-card">
        <div class="leave-top">
          <div>
            <div class="leave-title">${esc(l.courseName)} <span class="badge badge-gray">${esc(l.type)}</span></div>
            <div class="leave-meta">
              <span>${icon('calendar')}${fmtDate(l.startDate)}${l.endDate !== l.startDate ? ` 至 ${fmtDate(l.endDate)}` : ''}</span>
              <span>${icon('clock')}申請於 ${fmtDate(l.createdAt)}</span>
              <span>${icon('file')}單號 ${esc(l.id)}</span>
            </div>
          </div>
          ${statusBadge(l.status)}
        </div>
        <div class="leave-reason">${esc(l.reason)}</div>
        ${l.reviewNote ? `<div class="leave-note">${icon('check-circle', 'icon-sm')}<span>審核備註：${esc(l.reviewNote)}${l.reviewer ? `（${esc(l.reviewer)}）` : ''}</span></div>` : ''}
        ${l.status === 'pending' ? `<div class="leave-actions"><button class="btn btn-outline btn-sm" data-cancel="${esc(l.id)}">${icon('x')}取消申請</button><span class="xs muted">審核中，尚可取消</span></div>` : ''}
      </div>`).join('')}</div>`
      : `<div class="card">${emptyState({ iconName: 'file', title: '目前沒有請假紀錄', desc: '如有課程缺席需求，可在此提出請假申請。', action: '<button class="btn btn-primary" data-new>提出請假</button>' })}</div>`}
    <div class="info-strip mt-2" style="margin-top:18px">${icon('info')}<div>請假申請送出後，將由教務處依相關辦法審核。若為突發傷病，請先聯繫授課教師與系辦，並於事後補齊證明文件。</div></div>`;

    $$('[data-new]', container).forEach((b) => b.addEventListener('click', openForm));
    container.addEventListener('click', async (event) => {
      const cancel = event.target.closest('[data-cancel]');
      if (!cancel) return;
      const ok = await confirmDialog({ title: '取消請假申請', message: '確定要取消這筆審核中的請假申請嗎？', confirmText: '取消申請', danger: true });
      if (!ok) return;
      try {
        await api.patch(`/leaves/${cancel.dataset.cancel}`, { action: 'cancel' });
        toast('已取消請假申請');
        ctx.refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'LEAVE REQUEST', title: '請假申請' }) + errorState(err.message);
  }
}
