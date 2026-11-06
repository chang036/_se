import { api } from '../api.js';
import {
  $, $$, esc, avatar, icon, pageHead, fmtDate, fmtShort, todayLong,
  emptyState, loadingState, errorState, statusBadge, typeBadge, toast,
  downloadCsv, pct
} from '../ui.js';
import { openCourseDetail } from './shared.js';

const GRADE_COURSE_KEY = 'nqu_grade_course';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return '早安';
  if (h < 17) return '午安';
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

function teacherTotal(r) {
  if (r.regular == null || r.midterm == null || r.final == null) return null;
  return Math.round((r.regular * 0.3 + r.midterm * 0.3 + r.final * 0.4) * 10) / 10;
}

function teacherLabel(total) {
  if (total == null) return { label: '未結算', cls: '' };
  if (total >= 90) return { label: 'A+', cls: 'a' };
  if (total >= 85) return { label: 'A', cls: 'a' };
  if (total >= 80) return { label: 'A-', cls: 'a' };
  if (total >= 75) return { label: 'B+', cls: 'b' };
  if (total >= 70) return { label: 'B', cls: 'b' };
  if (total >= 65) return { label: 'B-', cls: 'c' };
  if (total >= 60) return { label: 'C', cls: 'c' };
  return { label: 'F', cls: 'f' };
}

export async function renderTeacherDashboard(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'FACULTY DESK', title: '教學總覽' }) + loadingState('正在整理授課資訊…');
  try {
    const [courseData, tt, annData, leaveData] = await Promise.all([
      api.get('/courses?scope=mine'), api.get('/timetable'),
      api.get('/announcements'), api.get('/leaves')
    ]);
    const courses = courseData.courses;
    const gradeLists = await Promise.all(courses.map((c) => api.get(`/courses/${c.id}/grades`).catch(() => null)));
    let ungraded = 0;
    gradeLists.forEach((g) => {
      (g?.roster || []).forEach((r) => { if (r.regular == null || r.midterm == null || r.final == null) ungraded += 1; });
    });
    const students = new Set(courses.flatMap((c) => c.enrolled));
    const totalStudents = courses.reduce((s, c) => s + c.enrolled.length, 0);
    const credits = courses.reduce((s, c) => s + c.credits, 0);
    const today = new Date().getDay();
    const todayEntries = tt.entries.filter((e) => e.day === today).sort((a, b) => a.periods[0] - b.periods[0]);
    const pendingLeaves = leaveData.leaves.filter((l) => l.status === 'pending');
    const d = fmtShort(new Date());

    container.innerHTML = pageHead({
      eyebrow: 'FACULTY DESK', title: '教學總覽',
      sub: `${esc(ctx.state.user.name)} ${esc(ctx.state.user.title || '')} · ${esc(ctx.state.user.dept)}`,
      actions: `<a class="btn btn-outline" href="#/timetable">${icon('calendar')}我的課表</a><a class="btn btn-primary" href="#/grade-entry">${icon('edit')}成績登錄</a>`
    }) + `
    <div class="hero" style="margin-bottom:18px">
      <div class="hero-inner">
        <div>
          <div class="hero-kicker">${icon('sparkle')}${esc(ctx.state.meta.semester)} · 教學成果與課程管理</div>
          <h1>${greeting()}，<em>${esc(ctx.state.user.name)}</em> 老師</h1>
          <p class="hero-desc">${todayEntries.length
            ? `今天有 <b style="color:#e7d3aa">${todayEntries.length}</b> 個授課時段，第一堂為 <b style="color:#f0e0be">${esc(todayEntries[0].name)}</b>（第 ${todayEntries[0].periods[0]} 節於 ${esc(todayEntries[0].room)}）。`
            : '今天沒有授課時段，可使用時間備課、輔導學生或處理成績登錄。'} 目前共有 <b style="color:#e7d3aa">${students.size}</b> 位學生修習您的課程。</p>
          <div class="hero-meta">
            <span class="hero-pill">${icon('book')}${courses.length} 門授課課程</span>
            <span class="hero-pill">${icon('users')}${totalStudents} 人次</span>
            <span class="hero-pill">${icon('award')}${credits} 開設學分</span>
          </div>
          <div class="hero-actions">
            <a class="btn btn-gold btn-sm" href="#/grade-entry">${icon('edit')}登錄成績</a>
            <a class="btn btn-outline btn-sm" href="#/my-courses">${icon('book')}授課課程</a>
          </div>
        </div>
        <div class="hero-day"><small>${d.month} / ${d.weekday}</small><strong>${d.day}</strong><span>教學日</span></div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '授課課程', value: courses.length, unit: '門', note: `共 ${credits} 學分`, iconName: 'book', tone: 'navy' })}
      ${statCard({ label: '修課人次', value: totalStudents, unit: '人次', note: `不重複學生 ${students.size} 位`, iconName: 'users', tone: 'teal' })}
      ${statCard({ label: '待登錄成績', value: ungraded, unit: '筆', note: ungraded ? '尚有成績項目未填寫' : '所有成績皆已登錄', iconName: 'edit', tone: ungraded ? 'gold' : 'green' })}
      ${statCard({ label: '學生假單', value: pendingLeaves.length, unit: '件', note: '待教務處審核', iconName: 'file', tone: pendingLeaves.length ? 'red' : 'green' })}
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);align-items:start">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>今日授課</h2><p>${todayLong()}</p></div><a class="btn-link" href="#/timetable">完整課表 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body">${todayEntries.length ? `<div class="today-list">${todayEntries.map((e) => {
            const start = tt.periods.find((p) => p.no === e.periods[0]);
            const end = tt.periods.find((p) => p.no === e.periods[e.periods.length - 1]);
            return `<div class="today-item">
              <div class="today-time"><strong>${start.time.split('–')[0]}</strong><span>${start.time.split('–')[1]} 下課</span></div>
              <div class="today-bar" style="--c:${esc(e.color)}"></div>
              <div class="today-main"><strong>${esc(e.name)}</strong><span>${esc(e.room)} · 第 ${e.periods[0]}–${e.periods[e.periods.length - 1]} 節</span></div>
            </div>`;
          }).join('')}</div>` : emptyState({ iconName: 'calendar-check', title: '今天沒有授課', desc: '可以利用時間準備教材或輔導學生。' })}</div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>授課課程</h2><p>課程選課人數與成績登錄狀態</p></div><a class="btn-link" href="#/my-courses">管理課程 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body" style="padding-top:6px;padding-bottom:6px">
            ${courses.length ? courses.map((c, i) => {
              const roster = gradeLists[i]?.roster || [];
              const done = roster.filter((r) => r.total != null).length;
              return `<div class="today-item" style="align-items:center">
                <div class="today-bar" style="--c:${esc(c.color)};height:38px"></div>
                <div class="today-main grow"><strong>${esc(c.name)} <span class="muted xs">${esc(c.code)}</span></strong><span>${c.enrolled.length} 位學生 · ${esc(c.scheduleText)}</span></div>
                <div style="text-align:right;min-width:92px"><span class="xs muted">成績完成</span><div class="progress" style="width:92px;margin-top:4px"><span style="width:${pct(done, roster.length)}%"></span></div><span class="xs muted nums">${done} / ${roster.length}</span></div>
              </div>`;
            }).join('') : emptyState({ iconName: 'book', title: '本學期沒有授課課程' })}
          </div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>學生請假動態</h2><p>您授課課程的請假申請</p></div></div>
          <div class="card-body" style="padding-top:6px;padding-bottom:6px">
            ${pendingLeaves.length ? pendingLeaves.slice(0, 4).map((l) => `<div class="today-item" style="align-items:center">
              ${avatar(l.studentName, 'sm')}
              <div class="today-main grow"><strong>${esc(l.studentName)} <span class="badge badge-gray">${esc(l.type)}</span></strong><span>${esc(l.courseName)} · ${fmtDate(l.startDate)}</span></div>
              ${statusBadge(l.status)}
            </div>`).join('') : emptyState({ iconName: 'check-circle', title: '沒有待處理假單', desc: '目前學生請假狀況正常。' })}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>教學快速入口</h2></div></div>
          <div class="card-body"><div class="quick-grid" style="grid-template-columns:1fr 1fr">
            <a class="quick-link" href="#/grade-entry">${icon('edit')}成績登錄</a>
            <a class="quick-link" href="#/my-courses">${icon('users')}修課名單</a>
            <a class="quick-link" href="#/timetable">${icon('calendar')}授課課表</a>
            <a class="quick-link" href="#/announcements">${icon('megaphone')}發布公告</a>
          </div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>最新校園公告</h2></div><a class="btn-link" href="#/announcements">全部</a></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">
            ${annData.announcements.slice(0, 3).map((a) => `<div class="today-item"><div class="today-main grow"><a href="#/announcements" style="font-weight:600;font-size:12px">${esc(a.title)}</a><span>${esc(a.category)} · ${fmtDate(a.createdAt)}</span></div></div>`).join('') || emptyState({ iconName: 'bell', title: '目前沒有公告' })}
          </div>
        </div>
      </div>
    </div>`;
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'FACULTY DESK', title: '教學總覽' }) + errorState(err.message);
  }
}

export async function renderTeacherCourses(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'TEACHING', title: '授課課程' }) + loadingState();
  try {
    const { courses } = await api.get('/courses?scope=mine');
    const details = await Promise.all(courses.map((c) => api.get(`/courses/${c.id}/grades`).catch(() => null)));
    const totalStudents = courses.reduce((s, c) => s + c.enrolled.length, 0);
    const credits = courses.reduce((s, c) => s + c.credits, 0);
    const complete = details.reduce((sum, d) => sum + (d?.roster || []).filter((r) => r.total != null).length, 0);
    const totalRows = details.reduce((sum, d) => sum + (d?.roster || []).length, 0);

    container.innerHTML = pageHead({
      eyebrow: 'TEACHING', title: '授課課程',
      sub: `${esc(ctx.state.meta.semester)} · 課程名單、成績登錄與教學資訊`,
      actions: `<a class="btn btn-primary" href="#/grade-entry">${icon('edit')}前往成績登錄</a>`
    }) + `
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '授課課程', value: courses.length, unit: '門', note: `開設 ${credits} 學分`, iconName: 'book', tone: 'navy' })}
      ${statCard({ label: '修課人次', value: totalStudents, unit: '人次', note: '所有課程加總', iconName: 'users', tone: 'teal' })}
      ${statCard({ label: '成績完成率', value: totalRows ? Math.round(complete / totalRows * 100) : 0, unit: '%', note: `${complete} / ${totalRows} 筆已結算`, iconName: 'chart', tone: 'gold' })}
      ${statCard({ label: '平均班級人數', value: courses.length ? Math.round(totalStudents / courses.length) : 0, unit: '人', note: '每門課程平均', iconName: 'building', tone: 'green' })}
    </div>
    ${courses.length ? `<div class="stack">${courses.map((c, i) => {
      const roster = details[i]?.roster || [];
      const scored = roster.filter((r) => r.total != null);
      const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.total, 0) / scored.length * 10) / 10 : null;
      const pass = scored.filter((r) => r.total >= 60).length;
      return `<div class="card">
        <div class="card-body">
          <div class="between wrap" style="align-items:flex-start">
            <div class="row" style="align-items:flex-start;gap:13px">
              <div class="cd-icon" style="--accent:${esc(c.color || '#0f3558')};width:42px;height:42px">${icon('book-open')}</div>
              <div>
                <div class="row wrap" style="gap:6px"><span class="course-code">${esc(c.code)}</span>${typeBadge(c.type)}<span class="badge badge-gray">${c.credits} 學分</span></div>
                <h3 style="font-size:16px;margin-top:4px">${esc(c.name)}</h3>
                <p class="small muted" style="margin-top:3px">${esc(c.scheduleText)} · ${esc(c.room)} · ${esc(c.dept)}</p>
              </div>
            </div>
            <div class="row" style="gap:7px">
              <button class="btn btn-outline btn-sm" data-detail="${esc(c.id)}">${icon('users')}修課名單</button>
              <button class="btn btn-primary btn-sm" data-grade="${esc(c.id)}">${icon('edit')}成績登錄</button>
            </div>
          </div>
          <div class="divider"></div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
            <div><span class="xs muted">選課人數</span><div style="font-size:18px;font-weight:700;margin-top:2px">${roster.length} <small class="muted" style="font-size:10px">/ ${c.capacity}</small></div><div class="progress" style="margin-top:5px"><span style="width:${pct(roster.length, c.capacity)}%"></span></div></div>
            <div><span class="xs muted">成績已結算</span><div style="font-size:18px;font-weight:700;margin-top:2px">${scored.length} <small class="muted" style="font-size:10px">/ ${roster.length}</small></div><div class="progress gold" style="margin-top:5px"><span style="width:${pct(scored.length, roster.length)}%"></span></div></div>
            <div><span class="xs muted">班級平均</span><div style="font-size:18px;font-weight:700;margin-top:2px">${avg ?? '—'} <small class="muted" style="font-size:10px">分</small></div><div class="hint" style="margin-top:5px">依已結算成績</div></div>
            <div><span class="xs muted">及格率</span><div style="font-size:18px;font-weight:700;margin-top:2px">${scored.length ? Math.round(pass / scored.length * 100) : 0} <small class="muted" style="font-size:10px">%</small></div><div class="hint" style="margin-top:5px">${pass} / ${scored.length} 人及格</div></div>
          </div>
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="card">${emptyState({ iconName: 'book', title: '本學期沒有授課課程' })}</div>`}`;

    container.addEventListener('click', (event) => {
      const detail = event.target.closest('[data-detail]');
      if (detail) { openCourseDetail(detail.dataset.detail, ctx); return; }
      const grade = event.target.closest('[data-grade]');
      if (grade) {
        sessionStorage.setItem(GRADE_COURSE_KEY, grade.dataset.grade);
        ctx.navigate('grade-entry');
      }
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'TEACHING', title: '授課課程' }) + errorState(err.message);
  }
}

export async function renderGradeEntry(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'GRADE BOOK', title: '成績登錄' }) + loadingState();
  try {
    const { courses } = await api.get('/courses?scope=mine');
    if (!courses.length) {
      container.innerHTML = pageHead({ eyebrow: 'GRADE BOOK', title: '成績登錄' })
        + `<div class="card">${emptyState({ iconName: 'edit', title: '本學期沒有授課課程', desc: '成績登錄僅開放授課教師使用。' })}</div>`;
      return;
    }
    const stored = sessionStorage.getItem(GRADE_COURSE_KEY);
    let currentId = courses.some((c) => c.id === stored) ? stored : courses[0].id;

    container.innerHTML = pageHead({
      eyebrow: 'GRADE BOOK', title: '成績登錄',
      sub: '期中與期末成績輸入後，系統依 30% / 30% / 40% 自動計算學期總分',
      actions: `<button class="btn btn-outline" data-export>${icon('download')}匯出名單</button><button class="btn btn-primary" data-save>${icon('save')}儲存成績</button>`
    }) + `
    <div class="card" style="margin-bottom:16px"><div class="card-body tight">
      <div class="filters">
        <label class="small strong" style="margin-right:2px">選擇課程</label>
        <select id="ge-course" style="min-width:300px">${courses.map((c) => `<option value="${esc(c.id)}" ${c.id === currentId ? 'selected' : ''}>${esc(c.name)}（${esc(c.code)}）</option>`).join('')}</select>
        <span class="grade-weight-note">${icon('info')}平時 30% · 期中 30% · 期末 40%</span>
        <div class="grow"></div>
        <button class="btn btn-ghost btn-sm" data-reload>${icon('refresh')}重新載入</button>
      </div>
    </div></div>
    <div class="stats-grid" id="ge-stats" style="margin-bottom:16px"></div>
    <div class="card">
      <div class="card-head"><div><h2 id="ge-title">修課名單</h2><p>輸入 0–100 的分數，未填寫的欄位將不列入結算</p></div><span class="badge badge-gray" id="ge-count"></span></div>
      <div class="table-wrap" id="ge-table">${loadingState('載入修課名單…')}</div>
      <div class="card-foot"><span class="hint" id="ge-hint">成績儲存後將立即更新學生查詢結果。</span><button class="btn btn-primary btn-sm" data-save>${icon('save')}儲存成績</button></div>
    </div>
    <div class="info-strip mt-2">${icon('info')}<div>成績送出後仍可修正，請於教務處公告之成績繳交截止日前完成。總分計算方式若有特殊規定，請洽教務處註冊組。</div></div>`;

    let roster = [];
    let course = null;

    const updateStats = () => {
      const totals = roster.map((r) => {
        const g = readRow(r.studentId);
        return teacherTotal(g);
      });
      const scored = totals.filter((t) => t != null);
      const avg = scored.length ? Math.round(scored.reduce((s, t) => s + t, 0) / scored.length * 10) / 10 : null;
      const fail = scored.filter((t) => t < 60).length;
      $('#ge-stats', container).innerHTML = `
        <div class="stat-card"><div class="stat-top"><span class="stat-label">修課人數</span><span class="stat-icon" style="--stat-soft:#e8f1fa;--stat-color:#164b78">${icon('users')}</span></div><div class="stat-value">${roster.length}<small>人</small></div><div class="stat-foot">${esc(course?.name || '')}</div></div>
        <div class="stat-card"><div class="stat-top"><span class="stat-label">已結算</span><span class="stat-icon" style="--stat-soft:#e6f4ec;--stat-color:#2f855a">${icon('check-circle')}</span></div><div class="stat-value">${scored.length}<small>/ ${roster.length}</small></div><div class="stat-foot">三項成績皆已填寫</div></div>
        <div class="stat-card"><div class="stat-top"><span class="stat-label">班級平均</span><span class="stat-icon" style="--stat-soft:#f3e8d3;--stat-color:#a87324">${icon('chart')}</span></div><div class="stat-value">${avg ?? '—'}<small>${avg != null ? '分' : ''}</small></div><div class="stat-foot">依已結算學生計算</div></div>
        <div class="stat-card"><div class="stat-top"><span class="stat-label">不及格</span><span class="stat-icon" style="--stat-soft:#fbeaea;--stat-color:#bf4d4d">${icon('alert')}</span></div><div class="stat-value">${fail}<small>人</small></div><div class="stat-foot">總分低於 60 分</div></div>`;
    };

    const readRow = (studentId) => {
      const row = $(`tr[data-row="${studentId}"]`, container);
      if (!row) return { regular: null, midterm: null, final: null };
      const val = (key) => {
        const input = row.querySelector(`[data-score="${key}"]`);
        return input && input.value !== '' ? Number(input.value) : null;
      };
      return { regular: val('regular'), midterm: val('midterm'), final: val('final') };
    };

    const draw = () => {
      $('#ge-title', container).textContent = `${course.name} · 修課名單`;
      $('#ge-count', container).textContent = `${roster.length} 位學生 · ${course.code}`;
      $('#ge-table', container).innerHTML = roster.length ? `<table class="table">
        <thead><tr><th>學生</th><th>學號</th><th>平時成績 (30%)</th><th>期中成績 (30%)</th><th>期末成績 (40%)</th><th>總分</th><th>等第</th></tr></thead>
        <tbody>${roster.map((r) => {
          const total = teacherTotal(r);
          const l = teacherLabel(total);
          return `<tr data-row="${esc(r.studentId)}">
            <td><div class="name-cell">${avatar(r.name, 'sm')}<div><strong>${esc(r.name)}</strong><span>${esc(r.className || '')}</span></div></div></td>
            <td class="num">${esc(r.studentNo)}</td>
            <td><input class="score-input" type="number" min="0" max="100" step="0.1" data-score="regular" value="${r.regular ?? ''}" placeholder="—" /></td>
            <td><input class="score-input" type="number" min="0" max="100" step="0.1" data-score="midterm" value="${r.midterm ?? ''}" placeholder="—" /></td>
            <td><input class="score-input" type="number" min="0" max="100" step="0.1" data-score="final" value="${r.final ?? ''}" placeholder="—" /></td>
            <td class="score-total" data-total>${total ?? '—'}</td>
            <td><span class="grade-pill ${l.cls}" data-label>${l.label}</span></td>
          </tr>`;
        }).join('')}</tbody></table>` : `<div class="table-empty">目前沒有學生選修此課程</div>`;
      updateStats();
    };

    const loadCourse = async (id) => {
      currentId = id;
      sessionStorage.setItem(GRADE_COURSE_KEY, id);
      const data = await api.get(`/courses/${id}/grades`);
      course = data.course;
      roster = data.roster;
      $('#ge-course', container).value = id;
      draw();
    };

    const refreshTotals = () => {
      roster.forEach((r) => {
        const row = $(`tr[data-row="${r.studentId}"]`, container);
        if (!row) return;
        const total = teacherTotal(readRow(r.studentId));
        const l = teacherLabel(total);
        row.querySelector('[data-total]').textContent = total ?? '—';
        const label = row.querySelector('[data-label]');
        label.textContent = l.label;
        label.className = `grade-pill ${l.cls}`;
      });
      updateStats();
    };

    try {
      await loadCourse(currentId);
    } catch (err) {
      $('#ge-table', container).innerHTML = errorState(err.message);
      $('#ge-stats', container).innerHTML = '';
    }

    $('#ge-course', container).addEventListener('change', async (event) => {
      try {
        await loadCourse(event.target.value);
        toast('已切換課程', 'info');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    $('[data-reload]', container).addEventListener('click', async () => {
      try {
        await loadCourse(currentId);
        toast('已重新載入最新成績', 'info');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#ge-table', container).addEventListener('input', (event) => {
      if (event.target.matches('[data-score]')) {
        const value = Number(event.target.value);
        if (event.target.value !== '' && (Number.isNaN(value) || value < 0)) event.target.value = 0;
        if (value > 100) event.target.value = 100;
        refreshTotals();
      }
    });

    const save = async (button) => {
      const rows = roster.map((r) => ({ studentId: r.studentId, ...readRow(r.studentId) }));
      const invalid = rows.some((r) => ['regular', 'midterm', 'final'].some((k) => r[k] != null && (Number.isNaN(r[k]) || r[k] < 0 || r[k] > 100)));
      if (invalid) { toast('成績需介於 0–100 之間', 'error'); return; }
      const buttons = $$('[data-save]', container);
      buttons.forEach((b) => { b.disabled = true; });
      try {
        const res = await api.put(`/courses/${currentId}/grades`, { grades: rows });
        roster = res.roster;
        draw();
        toast('成績已儲存');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    };

    $$('[data-save]', container).forEach((b) => b.addEventListener('click', () => save(b)));
    $('[data-export]', container).addEventListener('click', () => {
      if (!roster.length) { toast('目前沒有可匯出的名單', 'error'); return; }
      const rows = [['學號', '姓名', '班級', '平時', '期中', '期末', '總分', '等第']];
      roster.forEach((r) => {
        const total = teacherTotal(r);
        rows.push([r.studentNo, r.name, r.className, r.regular ?? '', r.midterm ?? '', r.final ?? '', total ?? '', teacherLabel(total).label]);
      });
      downloadCsv(`NQU_${course.code}_修課名單.csv`, rows);
      toast('修課名單已匯出');
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'GRADE BOOK', title: '成績登錄' }) + errorState(err.message);
  }
}
