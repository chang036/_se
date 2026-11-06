import { api } from '../api.js';
import {
  $, $$, esc, avatar, icon, pageHead, fmtDate, fmtShort, todayLong,
  emptyState, loadingState, errorState, statusBadge, typeBadge, toast,
  openModal, confirmDialog, downloadCsv, pct
} from '../ui.js';
import { openCourseDetail } from './shared.js';

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

export async function renderAdminDashboard(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'ADMINISTRATION', title: '教務管理總覽' }) + loadingState('正在彙整校務資料…');
  try {
    const stats = await api.get('/admin/stats');
    const counts = stats.counts;
    const deptMax = Math.max(...stats.depts.map((d) => d.students), 1);
    const d = fmtShort(new Date());

    container.innerHTML = pageHead({
      eyebrow: 'ADMINISTRATION', title: '教務管理總覽',
      sub: `${esc(ctx.state.meta.schoolName)} · ${esc(ctx.state.meta.semester)}`,
      actions: `<a class="btn btn-outline" href="#/admin-announcements">${icon('megaphone')}發布公告</a><a class="btn btn-primary" href="#/admin-courses">${icon('plus')}新增課程</a>`
    }) + `
    <div class="hero" style="margin-bottom:18px">
      <div class="hero-inner">
        <div>
          <div class="hero-kicker">${icon('sparkle')}ACADEMIC AFFAIRS · 校務行政</div>
          <h1>歡迎回來，<em>${esc(ctx.state.user.name)}</em> 管理員</h1>
          <p class="hero-desc">目前系統共有 <b style="color:#e7d3aa">${counts.students}</b> 位學生、<b style="color:#e7d3aa">${counts.teachers}</b> 位教師與 <b style="color:#e7d3aa">${counts.courses}</b> 門開設課程。選課總人次 ${counts.enrollment}，尚有 <b style="color:#e7d3aa">${counts.pendingLeaves}</b> 件請假申請待審核。</p>
          <div class="hero-meta">
            <span class="hero-pill">${icon('building')}${esc(ctx.state.meta.semester)}</span>
            <span class="hero-pill">${icon('server')}系統版本 v${esc(ctx.state.meta.version)}</span>
            <span class="hero-pill">${icon('users')}${counts.students + counts.teachers} 位使用者</span>
          </div>
          <div class="hero-actions">
            <a class="btn btn-gold btn-sm" href="#/admin-leaves">${icon('file')}審核請假（${counts.pendingLeaves}）</a>
            <a class="btn btn-outline btn-sm" href="#/admin-students">${icon('users')}學生名冊</a>
          </div>
        </div>
        <div class="hero-day"><small>${d.month} / ${d.weekday}</small><strong>${d.day}</strong><span>${new Date().getFullYear()} 學年度</span></div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:18px">
      ${statCard({ label: '在學學生', value: counts.students, unit: '人', note: `${stats.depts.length} 個系所`, iconName: 'users', tone: 'navy' })}
      ${statCard({ label: '專兼任教師', value: counts.teachers, unit: '人', note: '本學期開課教師', iconName: 'graduation', tone: 'teal' })}
      ${statCard({ label: '開設課程', value: counts.courses, unit: '門', note: `選課 ${counts.enrollment} 人次`, iconName: 'book', tone: 'gold' })}
      ${statCard({ label: '待審假單', value: counts.pendingLeaves, unit: '件', note: counts.pendingLeaves ? '需要儘速處理' : '目前無待審案件', iconName: 'file', tone: counts.pendingLeaves ? 'red' : 'green' })}
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:start;margin-bottom:18px">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>各系所學生人數</h2><p>依註冊在學身分統計</p></div><span class="badge badge-gray">${counts.students} 人</span></div>
          <div class="card-body"><div class="stack" style="gap:13px">
            ${stats.depts.map((d2) => `<div>
              <div class="between" style="margin-bottom:4px"><span class="small strong">${esc(d2.dept)}</span><span class="small muted nums">${d2.students} 人 · ${Math.round(d2.students / counts.students * 100)}%</span></div>
              <div class="progress navy"><span style="width:${pct(d2.students, deptMax)}%"></span></div>
            </div>`).join('')}
          </div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>熱門課程與容量</h2><p>依選課率排序</p></div><a class="btn-link" href="#/admin-courses">課程管理</a></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>課程</th><th>選課 / 容量</th><th style="width:190px">選課率</th></tr></thead>
            <tbody>${stats.util.slice(0, 6).map((c) => `<tr>
              <td><strong>${esc(c.name)}</strong> <span class="muted xs">${esc(c.code)}</span></td>
              <td class="num">${c.enrolled} / ${c.capacity}</td>
              <td><div class="progress-row"><div class="progress ${c.percent >= 90 ? 'red' : c.percent >= 60 ? 'gold' : ''}"><span style="width:${c.percent}%"></span></div><span class="nums">${c.percent}%</span></div></td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h2>待審請假</h2><p>最新需處理的申請</p></div><a class="btn-link" href="#/admin-leaves">全部 ${icon('chevron-right', 'icon-sm')}</a></div>
          <div class="card-body" style="padding-top:6px;padding-bottom:6px">
            ${stats.recentLeaves.length ? stats.recentLeaves.map((l) => `<div class="today-item" style="align-items:center">
              ${avatar(l.studentName, 'sm')}
              <div class="today-main grow"><strong>${esc(l.studentName)} <span class="badge badge-gray">${esc(l.type)}</span></strong><span>${esc(l.courseName)} · ${fmtDate(l.startDate)}</span></div>
              <a class="btn btn-outline btn-sm" href="#/admin-leaves">審核</a>
            </div>`).join('') : emptyState({ iconName: 'check-circle', title: '沒有待審假單', desc: '所有申請皆已處理完畢。' })}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>選課概況</h2><p>全校課程容量使用率</p></div></div>
          <div class="card-body" style="text-align:center">
            <div class="ring" style="margin:0 auto;width:132px;height:132px">
              <svg viewBox="0 0 154 154">
                <circle class="ring-bg" cx="77" cy="77" r="64" stroke-width="11"></circle>
                <circle class="ring-val" cx="77" cy="77" r="64" stroke-width="11" stroke-dasharray="402" stroke-dashoffset="${402 * (1 - counts.utilization / 100)}"></circle>
              </svg>
              <div class="ring-label"><strong style="font-size:26px">${counts.utilization}%</strong><span>容量使用率</span></div>
            </div>
            <div class="between" style="margin-top:16px"><span class="small muted">總選課人次</span><span class="strong">${counts.enrollment} 人次</span></div>
            <div class="between" style="margin-top:8px"><span class="small muted">總可容納人數</span><span class="strong">${counts.capacity} 人</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>管理快速入口</h2></div></div>
          <div class="card-body"><div class="quick-grid" style="grid-template-columns:1fr 1fr">
            <a class="quick-link" href="#/admin-courses">${icon('book')}課程管理</a>
            <a class="quick-link" href="#/admin-students">${icon('users')}學生名冊</a>
            <a class="quick-link" href="#/admin-leaves">${icon('file')}請假審核</a>
            <a class="quick-link" href="#/admin-announcements">${icon('megaphone')}公告管理</a>
          </div></div>
        </div>
      </div>
    </div>
    <div class="info-strip">${icon('info')}<div>此為校務系統示範專案，所有資料儲存於本機。教務處可透過課程管理調整開課資訊，並由請假審核頁面處理學生申請。</div></div>`;
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'ADMINISTRATION', title: '教務管理總覽' }) + errorState(err.message);
  }
}

export async function renderAdminCourses(container, ctx) {
  const meta = ctx.state.meta;
  container.innerHTML = pageHead({ eyebrow: 'COURSE MANAGEMENT', title: '課程管理' }) + loadingState();
  try {
    const [courseData, teacherData] = await Promise.all([api.get('/courses'), api.get('/teachers')]);
    let courses = courseData.courses;
    const teachers = teacherData.teachers;
    let q = '';
    let dept = '';
    let type = '';

    const draw = () => {
      const list = courses.filter((c) => {
        const text = `${c.name} ${c.code} ${c.teacher?.name || ''}`.toLowerCase();
        return (!q || text.includes(q)) && (!dept || c.dept === dept) && (!type || c.type === type);
      });
      const required = courses.filter((c) => c.type === 'required').length;
      const enrollment = courses.reduce((s, c) => s + c.enrolledCount, 0);
      const capacity = courses.reduce((s, c) => s + c.capacity, 0);
      $('#ac-stats', container).innerHTML = `
        ${statCard({ label: '開設課程', value: courses.length, unit: '門', note: `必修 ${required} · 選修 ${courses.length - required}`, iconName: 'book', tone: 'navy' })}
        ${statCard({ label: '選課人次', value: enrollment, unit: '人次', note: `總容量 ${capacity} 人`, iconName: 'users', tone: 'teal' })}
        ${statCard({ label: '容量使用率', value: capacity ? Math.round(enrollment / capacity * 100) : 0, unit: '%', note: '全校課程平均', iconName: 'chart', tone: 'gold' })}
        ${statCard({ label: '平均班級', value: courses.length ? Math.round(enrollment / courses.length) : 0, unit: '人', note: '每門課程平均人數', iconName: 'building', tone: 'green' })}`;
      $('#ac-count', container).textContent = `${list.length} 門課程`;
      $('#ac-table', container).innerHTML = list.length ? `<table class="table">
        <thead><tr><th>課程</th><th>授課教師</th><th>開課單位</th><th>學分</th><th>上課時段</th><th>選課人數</th><th style="text-align:right">操作</th></tr></thead>
        <tbody>${list.map((c) => `<tr>
          <td><div class="name-cell"><span class="avatar avatar-sm" style="background:${esc(c.color || '#0f3558')}">${icon('book', 'icon-sm')}</span><div><strong>${esc(c.name)}</strong><span>${esc(c.code)} · ${c.type === 'required' ? '必修' : '選修'}</span></div></div></td>
          <td>${esc(c.teacher?.name || '未指定')}<div class="xs muted">${esc(c.teacher?.title || '')}</div></td>
          <td class="small">${esc(c.dept)}</td>
          <td class="num">${c.credits}</td>
          <td class="small">${esc(c.scheduleText || '未排定')}</td>
          <td><div class="progress-row" style="min-width:130px;max-width:160px"><div class="progress ${c.seatsLeft === 0 ? 'red' : ''}"><span style="width:${pct(c.enrolledCount, c.capacity)}%"></span></div><span class="nums">${c.enrolledCount}/${c.capacity}</span></div></td>
          <td><div class="table-actions">
            <button class="btn btn-outline btn-sm" data-detail="${esc(c.id)}">${icon('eye')}</button>
            <button class="btn btn-outline btn-sm" data-edit="${esc(c.id)}">${icon('edit')}編輯</button>
            <button class="btn btn-danger-soft btn-sm" data-delete="${esc(c.id)}">${icon('trash')}</button>
          </div></td>
        </tr>`).join('')}</tbody></table>` : `<div class="table-empty">沒有符合條件的課程</div>`;
    };

    container.innerHTML = pageHead({
      eyebrow: 'COURSE MANAGEMENT', title: '課程管理',
      sub: `${esc(meta.semester)} · 開課、教師安排與課程資訊維護`,
      actions: `<button class="btn btn-primary" data-new>${icon('plus')}新增課程</button>`
    }) + `
    <div class="stats-grid" id="ac-stats" style="margin-bottom:18px"></div>
    <div class="card">
      <div class="card-head" style="flex-wrap:wrap;align-items:center">
        <div class="filters grow">
          <div class="search">${icon('search')}<input id="ac-search" type="search" placeholder="搜尋課程名稱、代碼或教師…" /></div>
          <select id="ac-dept"><option value="">全部開課單位</option>${meta.departments.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>
          <select id="ac-type"><option value="">全部類別</option><option value="required">必修</option><option value="elective">選修</option></select>
        </div>
        <span class="badge badge-gray" id="ac-count"></span>
      </div>
      <div class="table-wrap" id="ac-table"></div>
    </div>`;

    $('#ac-search', container).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $('#ac-dept', container).addEventListener('change', (e) => { dept = e.target.value; draw(); });
    $('#ac-type', container).addEventListener('change', (e) => { type = e.target.value; draw(); });
    draw();

    const openEditor = (existing = null) => {
      const slots = existing?.schedule?.map((s) => ({ day: s.day, periods: [...s.periods] })) || [];
      const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
      const modal = openModal({
        title: existing ? '編輯課程' : '新增課程',
        subtitle: existing ? `${existing.code} · ${existing.name}` : '建立新學期開課資料',
        size: 'modal-lg',
        body: `<form id="course-form" class="form-grid">
          <div class="form-error span-2" id="course-error"></div>
          <div class="field"><label>課程代碼<span class="req">*</span></label><input name="code" value="${esc(existing?.code || '')}" placeholder="例如 CS201" required maxlength="20" /></div>
          <div class="field"><label>課程名稱<span class="req">*</span></label><input name="name" value="${esc(existing?.name || '')}" placeholder="例如 資料結構" required maxlength="60" /></div>
          <div class="field"><label>授課教師<span class="req">*</span></label><select name="teacherId" required><option value="">請選擇</option>${teachers.map((t) => `<option value="${esc(t.id)}" ${existing?.teacherId === t.id ? 'selected' : ''}>${esc(t.name)}（${esc(t.dept)}）</option>`).join('')}</select></div>
          <div class="field"><label>開課單位<span class="req">*</span></label><select name="dept">${meta.departments.map((d) => `<option value="${esc(d)}" ${existing?.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
          <div class="field"><label>課程類別</label><select name="type"><option value="required" ${existing?.type === 'required' ? 'selected' : ''}>必修</option><option value="elective" ${existing?.type === 'elective' ? 'selected' : ''}>選修</option></select></div>
          <div class="field"><label>學分數<span class="req">*</span></label><input type="number" name="credits" min="1" max="6" value="${existing?.credits || 3}" required /></div>
          <div class="field"><label>人數上限<span class="req">*</span></label><input type="number" name="capacity" min="1" max="300" value="${existing?.capacity || 50}" required /></div>
          <div class="field"><label>上課教室</label><input name="room" value="${esc(existing?.room || '')}" placeholder="例如 理工大樓 E201" maxlength="40" /></div>
          <div class="field span-2"><label>上課時段</label>
            <div class="row wrap" id="slot-chips" style="margin-bottom:7px"></div>
            <div class="row wrap">
              <select id="slot-day" style="width:auto">${dayNames.map((n, i) => `<option value="${i + 1}">週${n}</option>`).join('')}</select>
              <select id="slot-start" style="width:auto">${meta.periods.map((p) => `<option value="${p.no}" ${p.no === 3 ? 'selected' : ''}>第 ${p.no} 節</option>`).join('')}</select>
              <span class="muted small">至</span>
              <select id="slot-end" style="width:auto">${meta.periods.map((p) => `<option value="${p.no}" ${p.no === 4 ? 'selected' : ''}>第 ${p.no} 節</option>`).join('')}</select>
              <button type="button" class="btn btn-outline btn-sm" id="add-slot">${icon('plus')}新增時段</button>
            </div>
          </div>
          <div class="field span-2"><label>課程簡介</label><textarea name="description" rows="3" maxlength="500" placeholder="簡述課程目標、內容與評量方式…">${esc(existing?.description || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn btn-outline" data-close>取消</button><button class="btn btn-primary" data-submit>${icon('check')}${existing ? '儲存變更' : '建立課程'}</button>`
      });

      const drawSlots = () => {
        const box = $('#slot-chips', modal.body);
        box.innerHTML = slots.length ? slots.map((s, i) => `<span class="badge badge-navy" style="gap:6px">週${dayNames[s.day - 1]} 第 ${s.periods[0]}–${s.periods[s.periods.length - 1]} 節 <button type="button" data-remove-slot="${i}" style="border:0;background:transparent;color:inherit;padding:0;display:grid;place-items:center">${icon('x', 'icon-sm')}</button></span>`).join('') : '<span class="hint">尚未設定上課時段</span>';
      };
      drawSlots();
      $('#add-slot', modal.body).addEventListener('click', () => {
        const day = Number($('#slot-day', modal.body).value);
        let start = Number($('#slot-start', modal.body).value);
        let end = Number($('#slot-end', modal.body).value);
        if (end < start) [start, end] = [end, start];
        const periods = [];
        for (let p = start; p <= end; p += 1) periods.push(p);
        const duplicated = slots.some((s) => s.day === day && s.periods.some((p) => periods.includes(p)));
        if (duplicated) { toast('此時段與已設定時段重疊', 'error'); return; }
        slots.push({ day, periods });
        drawSlots();
      });
      $('#slot-chips', modal.body).addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-slot]');
        if (!btn) return;
        slots.splice(Number(btn.dataset.removeSlot), 1);
        drawSlots();
      });
      modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
      modal.footer.querySelector('[data-submit]').addEventListener('click', async () => {
        const form = $('#course-form', modal.body);
        if (!form.reportValidity()) return;
        if (!slots.length) { toast('請至少設定一個上課時段', 'error'); return; }
        const fd = new FormData(form);
        const payload = {
          code: String(fd.get('code')).trim().toUpperCase(), name: fd.get('name'), teacherId: fd.get('teacherId'),
          dept: fd.get('dept'), type: fd.get('type'), credits: Number(fd.get('credits')),
          capacity: Number(fd.get('capacity')), room: fd.get('room'), description: fd.get('description'),
          schedule: slots
        };
        const btn = modal.footer.querySelector('[data-submit]');
        btn.disabled = true;
        try {
          if (existing) await api.patch(`/courses/${existing.id}`, payload);
          else await api.post('/courses', payload);
          toast(existing ? '課程資料已更新' : '課程已建立');
          modal.close();
          ctx.refresh();
        } catch (err) {
          const box = $('#course-error', modal.body);
          box.textContent = err.message;
          box.classList.add('show');
          btn.disabled = false;
        }
      });
    };

    $$('[data-new]', container).forEach((b) => b.addEventListener('click', () => openEditor()));
    container.addEventListener('click', async (event) => {
      const detail = event.target.closest('[data-detail]');
      if (detail) { openCourseDetail(detail.dataset.detail, ctx); return; }
      const edit = event.target.closest('[data-edit]');
      if (edit) { openEditor(courses.find((c) => c.id === edit.dataset.edit)); return; }
      const del = event.target.closest('[data-delete]');
      if (del) {
        const course = courses.find((c) => c.id === del.dataset.delete);
        const ok = await confirmDialog({
          title: '刪除課程', danger: true, confirmText: '確認刪除',
          message: `確定要刪除「<b>${esc(course?.name || '')}</b>」嗎？<br><span style="color:#bf4d4d">目前有 ${course?.enrolledCount || 0} 位學生選修，刪除後相關選課與成績資料將一併移除。</span>`
        });
        if (!ok) return;
        try {
          await api.del(`/courses/${course.id}`);
          toast('課程已刪除');
          ctx.refresh();
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'COURSE MANAGEMENT', title: '課程管理' }) + errorState(err.message);
  }
}

export async function renderAdminStudents(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'STUDENT RECORDS', title: '學生名冊' }) + loadingState();
  try {
    const { students } = await api.get('/admin/students');
    let q = '';
    let dept = '';
    let grade = '';

    const draw = () => {
      const list = students.filter((s) => {
        const text = `${s.name} ${s.studentNo} ${s.email} ${s.className}`.toLowerCase();
        return (!q || text.includes(q)) && (!dept || s.dept === dept) && (!grade || String(s.grade) === grade);
      });
      const totalCourses = students.reduce((sum, s) => sum + s.courseCount, 0);
      const totalCredits = students.reduce((sum, s) => sum + s.credits, 0);
      $('#as-stats', container).innerHTML = `
        ${statCard({ label: '在學學生', value: students.length, unit: '人', note: '含所有系所年級', iconName: 'users', tone: 'navy' })}
        ${statCard({ label: '本學期選課', value: totalCourses, unit: '人次', note: '平均每人 ' + (students.length ? (totalCourses / students.length).toFixed(1) : 0) + ' 門', iconName: 'book', tone: 'teal' })}
        ${statCard({ label: '選課學分', value: totalCredits, unit: '學分', note: '所有學生加總', iconName: 'award', tone: 'gold' })}
        ${statCard({ label: '平均學分', value: students.length ? Math.round(totalCredits / students.length * 10) / 10 : 0, unit: '學分', note: '每位學生本學期', iconName: 'chart', tone: 'green' })}`;
      $('#as-count', container).textContent = `${list.length} 位學生`;
      $('#as-table', container).innerHTML = list.length ? `<table class="table">
        <thead><tr><th>學生</th><th>學號</th><th>系所 / 班級</th><th>年級</th><th>選課</th><th>學分</th><th>聯絡資訊</th><th style="text-align:right">操作</th></tr></thead>
        <tbody>${list.map((s) => `<tr>
          <td><div class="name-cell">${avatar(s, 'sm')}<div><strong>${esc(s.name)}</strong><span>${esc(s.email)}</span></div></div></td>
          <td class="num">${esc(s.studentNo)}</td>
          <td class="small">${esc(s.dept)}<div class="xs muted">${esc(s.className)}</div></td>
          <td class="num">${s.grade}</td>
          <td class="num">${s.courseCount} 門</td>
          <td class="num">${s.credits}</td>
          <td class="small">${esc(s.phone || '—')}</td>
          <td><div class="table-actions"><button class="btn btn-outline btn-sm" data-view="${esc(s.id)}">${icon('eye')}檢視</button></div></td>
        </tr>`).join('')}</tbody></table>` : `<div class="table-empty">沒有符合條件的學生</div>`;
    };

    const departments = [...new Set(students.map((s) => s.dept))];
    container.innerHTML = pageHead({
      eyebrow: 'STUDENT RECORDS', title: '學生名冊',
      sub: `${esc(ctx.state.meta.semester)} · 學生基本資料與選課概況`,
      actions: `<button class="btn btn-outline" data-export>${icon('download')}匯出名冊</button>`
    }) + `
    <div class="stats-grid" id="as-stats" style="margin-bottom:18px"></div>
    <div class="card">
      <div class="card-head" style="flex-wrap:wrap;align-items:center">
        <div class="filters grow">
          <div class="search">${icon('search')}<input id="as-search" type="search" placeholder="搜尋姓名、學號、Email…" /></div>
          <select id="as-dept"><option value="">全部系所</option>${departments.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>
          <select id="as-grade"><option value="">全部年級</option>${[1, 2, 3, 4].map((g) => `<option value="${g}">${g} 年級</option>`).join('')}</select>
        </div>
        <span class="badge badge-gray" id="as-count"></span>
      </div>
      <div class="table-wrap" id="as-table"></div>
    </div>`;

    $('#as-search', container).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $('#as-dept', container).addEventListener('change', (e) => { dept = e.target.value; draw(); });
    $('#as-grade', container).addEventListener('change', (e) => { grade = e.target.value; draw(); });
    draw();

    $('[data-export]', container).addEventListener('click', () => {
      const rows = [['學號', '姓名', '系所', '班級', '年級', '選課數', '學分', 'Email', '電話']];
      students.forEach((s) => rows.push([s.studentNo, s.name, s.dept, s.className, s.grade, s.courseCount, s.credits, s.email, s.phone]));
      downloadCsv('NQU_學生名冊.csv', rows);
      toast('學生名冊已匯出');
    });

    container.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-view]');
      if (!btn) return;
      const s = students.find((x) => x.id === btn.dataset.view);
      const modal = openModal({
        title: s.name,
        subtitle: `${esc(s.studentNo)} · ${esc(s.dept)} · ${esc(s.className)}`,
        body: `<div class="row" style="gap:16px;margin-bottom:18px">${avatar(s, 'lg')}<div><h3 style="font-family:var(--font-serif);font-size:19px">${esc(s.name)}</h3><p class="small muted">${esc(s.dept)} · ${s.grade} 年級 · ${esc(s.className)}</p><div class="row" style="gap:6px;margin-top:5px"><span class="badge badge-navy">在學</span><span class="badge badge-gray">${esc(ctx.state.meta.semester)}</span></div></div></div>
        <div class="cd-grid">
          <div class="cd-item">${icon('mail')}<div><span>Email</span><strong>${esc(s.email)}</strong></div></div>
          <div class="cd-item">${icon('phone')}<div><span>聯絡電話</span><strong>${esc(s.phone || '—')}</strong></div></div>
          <div class="cd-item">${icon('book')}<div><span>本學期選課</span><strong>${s.courseCount} 門 · ${s.credits} 學分</strong></div></div>
          <div class="cd-item">${icon('chart')}<div><span>歷年成績筆數</span><strong>${s.gradesCount} 筆</strong></div></div>
          <div class="cd-item">${icon('pin')}<div><span>通訊地址</span><strong>${esc(s.address || '—')}</strong></div></div>
          <div class="cd-item">${icon('home')}<div><span>宿舍</span><strong>${esc(s.dorm || '—')}</strong></div></div>
        </div>`,
        footer: '<button class="btn btn-primary" data-close>關閉</button>'
      });
      modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'STUDENT RECORDS', title: '學生名冊' }) + errorState(err.message);
  }
}

export async function renderAdminLeaves(container, ctx) {
  container.innerHTML = pageHead({ eyebrow: 'LEAVE REVIEW', title: '請假審核' }) + loadingState();
  try {
    const { leaves } = await api.get('/leaves');
    let filter = 'pending';

    const review = (leave, action) => {
      const isApprove = action === 'approve';
      const modal = openModal({
        title: isApprove ? '核准請假申請' : '駁回請假申請',
        subtitle: `${leave.studentName} · ${leave.courseName} · ${leave.type}`,
        body: `<div class="form-error" id="review-error"></div>
          <div class="leave-reason" style="margin-top:0">${esc(leave.reason)}</div>
          <div class="field" style="margin-top:14px"><label>審核備註</label><textarea id="review-note" rows="3" maxlength="200" placeholder="${isApprove ? '例如：已核對診斷證明，准假。' : '請說明駁回原因，以利學生了解。'}">${isApprove ? '已核對相關證明，准假。' : ''}</textarea></div>`,
        footer: `<button class="btn btn-outline" data-close>取消</button><button class="btn ${isApprove ? 'btn-primary' : 'btn-danger'}" data-confirm>${isApprove ? '確認核准' : '確認駁回'}</button>`
      });
      modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
      modal.footer.querySelector('[data-confirm]').addEventListener('click', async () => {
        const btn = modal.footer.querySelector('[data-confirm]');
        btn.disabled = true;
        try {
          await api.patch(`/leaves/${leave.id}`, { action, note: $('#review-note', modal.body).value });
          toast(isApprove ? '請假申請已核准' : '請假申請已駁回');
          modal.close();
          ctx.refresh();
        } catch (err) {
          const box = $('#review-error', modal.body);
          box.textContent = err.message;
          box.classList.add('show');
          btn.disabled = false;
        }
      });
    };

    const draw = () => {
      const counts = {
        pending: leaves.filter((l) => l.status === 'pending').length,
        approved: leaves.filter((l) => l.status === 'approved').length,
        rejected: leaves.filter((l) => l.status === 'rejected').length
      };
      const list = filter === 'all' ? leaves : leaves.filter((l) => l.status === filter);
      $('#al-stats', container).innerHTML = `
        ${statCard({ label: '待審核', value: counts.pending, unit: '件', note: '需要教務處處理', iconName: 'clock', tone: counts.pending ? 'gold' : 'green' })}
        ${statCard({ label: '已核准', value: counts.approved, unit: '件', note: '已完成審核', iconName: 'check-circle', tone: 'green' })}
        ${statCard({ label: '已駁回', value: counts.rejected, unit: '件', note: '未通過申請', iconName: 'x-circle', tone: 'red' })}
        ${statCard({ label: '申請總數', value: leaves.length, unit: '件', note: '本學期所有假單', iconName: 'file', tone: 'navy' })}`;
      $('#al-tabs', container).innerHTML = [['pending', `待審核 ${counts.pending}`], ['all', `全部 ${leaves.length}`], ['approved', '已核准'], ['rejected', '已駁回']]
        .map(([key, label]) => `<button data-tab="${key}" class="${filter === key ? 'active' : ''}">${label}</button>`).join('');
      $('#al-list', container).innerHTML = list.length ? `<div class="leave-list">${list.map((l) => `<div class="leave-card">
        <div class="leave-top">
          <div class="row" style="align-items:flex-start;gap:10px">${avatar(l.studentName, 'sm')}<div>
            <div class="leave-title">${esc(l.studentName)} <span class="xs muted">${esc(l.studentNo)}</span></div>
            <div class="leave-meta">
              <span>${icon('book')}${esc(l.courseName)}</span>
              <span>${icon('file')}${esc(l.type)}</span>
              <span>${icon('calendar')}${fmtDate(l.startDate)}${l.endDate !== l.startDate ? ` 至 ${fmtDate(l.endDate)}` : ''}</span>
              <span>${icon('clock')}${fmtDate(l.createdAt)} 申請</span>
            </div>
          </div></div>
          ${statusBadge(l.status)}
        </div>
        <div class="leave-reason">${esc(l.reason)}</div>
        ${l.reviewNote ? `<div class="leave-note">${icon('check-circle', 'icon-sm')}<span>${esc(l.reviewNote)}${l.reviewer ? `（${esc(l.reviewer)}）` : ''}</span></div>` : ''}
        ${l.status === 'pending' ? `<div class="leave-actions"><button class="btn btn-primary btn-sm" data-approve="${esc(l.id)}">${icon('check')}核准</button><button class="btn btn-danger-soft btn-sm" data-reject="${esc(l.id)}">${icon('x')}駁回</button></div>` : ''}
      </div>`).join('')}</div>` : `<div class="card">${emptyState({ iconName: 'file', title: '沒有符合條件的假單', desc: filter === 'pending' ? '目前所有請假申請皆已處理完畢。' : '此分類目前沒有紀錄。' })}</div>`;
    };

    container.innerHTML = pageHead({
      eyebrow: 'LEAVE REVIEW', title: '請假審核',
      sub: '檢視學生請假事由並完成核准或駁回',
      actions: `<a class="btn btn-outline" href="#/dashboard">${icon('home')}返回總覽</a>`
    }) + `
    <div class="stats-grid" id="al-stats" style="margin-bottom:18px"></div>
    <div class="between" style="margin-bottom:12px"><div class="segmented" id="al-tabs"></div><span class="hint">審核結果將同步顯示於學生端</span></div>
    <div id="al-list"></div>`;

    draw();
    $('#al-tabs', container).addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tab]');
      if (!btn) return;
      filter = btn.dataset.tab;
      draw();
    });
    container.addEventListener('click', (event) => {
      const approve = event.target.closest('[data-approve]');
      if (approve) { review(leaves.find((l) => l.id === approve.dataset.approve), 'approve'); return; }
      const reject = event.target.closest('[data-reject]');
      if (reject) { review(leaves.find((l) => l.id === reject.dataset.reject), 'reject'); }
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'LEAVE REVIEW', title: '請假審核' }) + errorState(err.message);
  }
}
