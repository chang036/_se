import { api } from '../api.js';
import {
  $, $$, esc, avatar, icon, pageHead, fmtDate, fmtShort, fmtDateTime, todayLong,
  emptyState, loadingState, errorState, statusBadge, typeBadge, toast, openModal,
  confirmDialog, gradeLetter, pct
} from '../ui.js';

const ROLE_LABEL = { student: '學生', teacher: '教師', admin: '教務管理員' };
const SEMESTER_LABEL = (sem) => {
  if (!sem) return '';
  const m = String(sem).match(/^(\d+)-(\d+)$/);
  return m ? `${m[1]} 學年度第 ${m[2]} 學期` : sem;
};

function courseBlock(entry) {
  const periods = entry.periods;
  const span = periods.length > 1 ? `第 ${periods[0]}–${periods[periods.length - 1]} 節` : `第 ${periods[0]} 節`;
  return `<button class="tt-course" style="--c:${esc(entry.color || '#0f3558')}" data-course="${esc(entry.courseId)}" title="${esc(entry.name)} · ${esc(entry.room)}">
    <strong>${esc(entry.name)}</strong>
    <span>${esc(entry.room)}</span>
    <span>${esc(entry.teacher)} · ${span}</span>
  </button>`;
}

export async function renderTimetablePage(container, ctx) {
  container.innerHTML = pageHead({
    eyebrow: 'MY SCHEDULE', title: '課表',
    sub: `${esc(ctx.state.meta.semester)} · 每週授課與選課時段一覽`,
    actions: `<button class="btn btn-outline" data-print>${icon('download')}列印課表</button>`
  }) + loadingState();

  try {
    const [tt, mine] = await Promise.all([
      api.get('/timetable'),
      api.get('/courses?scope=mine')
    ]);
    const entries = tt.entries;
    const unique = new Map();
    entries.forEach((e) => unique.set(e.courseId, e));
    const totalPeriods = entries.reduce((sum, e) => sum + e.periods.length, 0);
    const credits = mine.courses.reduce((sum, c) => sum + c.credits, 0);
    const days = [1, 2, 3, 4, 5];
    if (entries.some((e) => e.day === 6 || e.day === 7)) days.push(6, 7);
    const maxPeriod = Math.max(9, ...entries.flatMap((e) => e.periods), 1);
    const periods = tt.periods.filter((p) => p.no <= maxPeriod);

    const occupancy = new Map();
    for (const entry of entries) {
      for (const p of entry.periods) {
        const key = `${entry.day}-${p}`;
        if (!occupancy.has(key)) occupancy.set(key, entry);
      }
    }
    const today = new Date().getDay();

    let rows = '';
    for (const period of periods) {
      rows += `<tr><td class="tt-time"><strong>${period.no}</strong><span>${period.time}</span></td>`;
      for (const day of days) {
        const entry = occupancy.get(`${day}-${period.no}`);
        if (entry && entry.periods[0] === period.no) {
          rows += `<td rowspan="${entry.periods.length}" class="${day === today ? 'day-col today' : ''}">${courseBlock(entry)}</td>`;
        } else if (!entry) {
          rows += `<td class="${day === today ? 'day-col today' : ''}"></td>`;
        }
      }
      rows += '</tr>';
    }

    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    container.innerHTML = pageHead({
      eyebrow: 'MY SCHEDULE', title: '課表',
      sub: `${esc(ctx.state.meta.semester)} · 每週授課與選課時段一覽`,
      actions: `<button class="btn btn-outline" data-print>${icon('download')}列印課表</button>`
    }) + `
    <div class="stats-grid mb-2" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-top"><span class="stat-label">本學期課程</span><span class="stat-icon" style="--stat-soft:#e8f1fa;--stat-color:#164b78">${icon('book')}</span></div><div class="stat-value">${unique.size}<small>門</small></div><div class="stat-foot">${ctx.state.user.role === 'teacher' ? '授課課程' : '已選課程'}</div></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">每週節數</span><span class="stat-icon" style="--stat-soft:#e4f2f1;--stat-color:#2f7d78">${icon('clock')}</span></div><div class="stat-value">${totalPeriods}<small>節</small></div><div class="stat-foot">含所有排定時段</div></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">課程學分</span><span class="stat-icon" style="--stat-soft:#f3e8d3;--stat-color:#a87324">${icon('award')}</span></div><div class="stat-value">${credits}<small>學分</small></div><div class="stat-foot">${ctx.state.user.role === 'teacher' ? '開設學分數' : '本學期累計'}</div></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">今日課程</span><span class="stat-icon" style="--stat-soft:#e8f1fa;--stat-color:#0f3558">${icon('calendar-check')}</span></div><div class="stat-value">${entries.filter((e) => e.day === today).length}<small>門</small></div><div class="stat-foot">${todayLong()}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h2>每週課表</h2><p>點擊課程區塊可查看課程大綱與詳細資訊</p></div><span class="badge badge-gold">${esc(SEMESTER_LABEL(ctx.state.meta.semester))}</span></div>
      <div class="timetable-wrap">
        <table class="timetable">
          <thead><tr><th>節次 / 時間</th>${days.map((d) => `<th>週${dayNames[d - 1]}${d === today ? '<span class="today-tag">今天</span>' : ''}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="tt-legend">${[...unique.values()].map((e) => `<span><i style="background:${esc(e.color)}"></i>${esc(e.name)}</span>`).join('') || '<span>目前沒有排課</span>'}</div>
    </div>
    <div class="info-strip mt-2">${icon('info')}<div>課表資料依教務處排課結果同步。若發現衝堂或教室異動，請洽教務處課務組（分機 313-100）。</div></div>`;

    $('[data-print]', container)?.addEventListener('click', () => window.print());
    container.addEventListener('click', (event) => {
      const target = event.target.closest('[data-course]');
      if (target) openCourseDetail(target.dataset.course, ctx);
    });
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'MY SCHEDULE', title: '課表' }) + errorState(err.message);
  }
}

export async function openCourseDetail(courseId, ctx) {
  let data;
  try {
    data = await api.get(`/courses/${encodeURIComponent(courseId)}`);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  const c = data.course;
  const isStudent = ctx.state.user.role === 'student';
  const canEnroll = isStudent && !c.isEnrolled && c.seatsLeft > 0 && !c.conflict;
  const accent = c.color || '#0f3558';

  const rosterHtml = Array.isArray(c.roster) && c.roster.length
    ? `<div class="divider"></div><div class="section-title">修課名單 <span class="badge badge-gray">${c.roster.length} 人</span></div>
       <div class="table-wrap" style="max-height:280px;overflow:auto">
        <table class="table"><thead><tr><th>學生</th><th>學號</th><th>平時</th><th>期中</th><th>期末</th><th>總分</th></tr></thead>
        <tbody>${c.roster.map((r) => `<tr>
          <td><div class="name-cell">${avatar(r.student, 'sm')}<div><strong>${esc(r.student?.name)}</strong><span>${esc(r.student?.className || '')}</span></div></div></td>
          <td class="num">${esc(r.student?.studentNo || '')}</td>
          <td class="num">${r.regular ?? '—'}</td><td class="num">${r.midterm ?? '—'}</td><td class="num">${r.final ?? '—'}</td>
          <td class="num score-total">${r.total ?? '—'}</td></tr>`).join('')}</tbody></table>
       </div>`
    : '';

  const syllabusHtml = c.syllabus?.length
    ? `<div class="divider"></div><div class="section-title">課程大綱</div><div class="syllabus">${c.syllabus.map((s) => `<div class="syllabus-row"><b>${esc(s.week)}</b>${esc(s.topic)}</div>`).join('')}</div>`
    : '';

  const footer = isStudent
    ? `<button class="btn btn-outline" data-close>關閉</button>
       ${c.isEnrolled
         ? `<button class="btn btn-danger-soft" data-drop>${icon('trash')}退選</button>`
         : `<button class="btn btn-primary" data-enroll ${canEnroll ? '' : 'disabled'}>${icon('plus')}${c.seatsLeft <= 0 ? '人數已額滿' : c.conflict ? '時段衝堂' : '加入選課'}</button>`}`
    : `<button class="btn btn-primary" data-close>關閉</button>`;

  const modal = openModal({
    title: c.name,
    subtitle: `${esc(c.code)} · ${esc(c.dept)}`,
    size: 'modal-lg',
    body: `<div class="cd-head">
      <div class="cd-icon" style="--accent:${esc(accent)}">${icon('book-open', 'icon-lg')}</div>
      <div class="grow">
        <div class="row wrap" style="gap:6px">${typeBadge(c.type)}<span class="badge badge-gray">${c.credits} 學分</span>${c.isEnrolled ? '<span class="badge badge-green">已選修</span>' : ''}</div>
        <p class="muted small" style="margin-top:5px">${esc(c.description || '本課程尚未提供課程簡介。')}</p>
      </div>
    </div>
    <div class="cd-grid">
      <div class="cd-item">${icon('user')}<div><span>授課教師</span><strong>${esc(c.teacher?.name || '未指定')}${c.teacher?.title ? ` · ${esc(c.teacher.title)}` : ''}</strong></div></div>
      <div class="cd-item">${icon('building')}<div><span>開課單位</span><strong>${esc(c.dept)}</strong></div></div>
      <div class="cd-item">${icon('clock')}<div><span>上課時間</span><strong>${esc(c.scheduleText || '未排定')}</strong></div></div>
      <div class="cd-item">${icon('pin')}<div><span>上課教室</span><strong>${esc(c.room)}</strong></div></div>
      <div class="cd-item">${icon('users')}<div><span>選課人數</span><strong>${c.enrolledCount} / ${c.capacity} 人（餘 ${c.seatsLeft} 位）</strong></div></div>
      <div class="cd-item">${icon('graduation')}<div><span>課程學分</span><strong>${c.credits} 學分 · ${c.type === 'required' ? '必修' : '選修'}</strong></div></div>
    </div>
    <div class="mt-2"><div class="progress-row"><div class="progress ${c.seatsLeft === 0 ? 'red' : ''}"><span style="width:${pct(c.enrolledCount, c.capacity)}%"></span></div><span class="nums">${pct(c.enrolledCount, c.capacity)}%</span></div></div>
    ${c.conflict && isStudent ? `<div class="info-strip gold mt-2">${icon('alert')}<div>此時段與「${esc(c.conflict)}」衝堂，無法加選。請先退選衝堂課程，或選擇其他班級。</div></div>` : ''}
    ${syllabusHtml}
    ${rosterHtml}`,
    footer
  });

  modal.footer.querySelector('[data-close]')?.addEventListener('click', modal.close);
  modal.footer.querySelector('[data-enroll]')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    try {
      await api.post(`/courses/${c.id}/enroll`);
      toast('選課成功，已加入你的課表');
      modal.close();
      ctx.refresh();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
  modal.footer.querySelector('[data-drop]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '退選課程', danger: true, confirmText: '確認退選',
      message: `確定要退選「<b>${esc(c.name)}</b>」嗎？退選後將從本學期課表移除。`
    });
    if (!ok) return;
    try {
      await api.del(`/courses/${c.id}/enroll`);
      toast('已退選課程');
      modal.close();
      ctx.refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function announcementDetail(a, ctx, onDeleted) {
  const canDelete = ctx.state.user.role === 'admin' || a.authorId === ctx.state.user.id;
  const modal = openModal({
    title: a.title,
    subtitle: `${esc(a.category)} · ${fmtDateTime(a.createdAt)} · ${esc(a.authorName || '')}`,
    body: `<div class="row wrap" style="gap:6px;margin-bottom:14px">${a.pinned ? '<span class="badge badge-gold">置頂公告</span>' : ''}<span class="badge badge-navy">${esc(a.category)}</span></div>
      <div style="font-size:13px;line-height:2;color:#33475b;white-space:pre-wrap">${esc(a.body)}</div>`,
    footer: `<button class="btn btn-outline" data-close>關閉</button>${canDelete ? `<button class="btn btn-danger-soft" data-delete>${icon('trash')}刪除公告</button>` : ''}`
  });
  modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
  modal.footer.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: '刪除公告', message: '刪除後將無法復原，確定要刪除這則公告嗎？', confirmText: '刪除', danger: true });
    if (!ok) return;
    try {
      await api.del(`/announcements/${a.id}`);
      toast('公告已刪除');
      modal.close();
      onDeleted?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export async function renderAnnouncementsPage(container, ctx) {
  const canPost = ['teacher', 'admin'].includes(ctx.state.user.role);
  container.innerHTML = pageHead({
    eyebrow: 'CAMPUS NEWS', title: '校園公告',
    sub: '教務、學務與校園活動的最新訊息',
    actions: canPost ? `<button class="btn btn-primary" data-new>${icon('plus')}發布公告</button>` : ''
  }) + loadingState();

  let announcements = [];
  let category = 'all';
  let keyword = '';

  const compose = () => {
    const categories = ['教務處', '學務處', '總務處', '圖書館', '資訊處', '研發處', '國際事務處', ctx.state.user.dept].filter(Boolean);
    const uniqueCats = [...new Set(categories)];
    const modal = openModal({
      title: '發布校園公告',
      subtitle: '公告發布後將立即顯示於所有使用者的公告列表',
      body: `<form id="ann-form" class="stack" style="gap:13px">
        <div class="form-error" id="ann-error"></div>
        <div class="field"><label>公告標題<span class="req">*</span></label><input name="title" maxlength="80" placeholder="請輸入標題" required /></div>
        <div class="form-grid">
          <div class="field"><label>公告分類</label><select name="category">${uniqueCats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>張貼單位</label><input value="${esc(ctx.state.user.dept)}" disabled /></div>
        </div>
        <div class="field"><label>公告內容<span class="req">*</span></label><textarea name="body" rows="7" maxlength="2000" placeholder="請輸入公告內容…" required></textarea></div>
        ${ctx.state.user.role === 'admin' ? '<label class="checkbox"><input type="checkbox" name="pinned" /> 置頂顯示於公告列表頂端</label>' : ''}
      </form>`,
      footer: `<button class="btn btn-outline" data-close>取消</button><button class="btn btn-primary" data-submit>${icon('check')}發布公告</button>`
    });
    modal.footer.querySelector('[data-close]').addEventListener('click', modal.close);
    modal.footer.querySelector('[data-submit]').addEventListener('click', async () => {
      const form = $('#ann-form', modal.body);
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const btn = modal.footer.querySelector('[data-submit]');
      btn.disabled = true;
      try {
        await api.post('/announcements', {
          title: fd.get('title'), body: fd.get('body'), category: fd.get('category'), pinned: fd.get('pinned') === 'on'
        });
        toast('公告已發布');
        modal.close();
        await refresh();
      } catch (err) {
        const box = $('#ann-error', modal.body);
        box.textContent = err.message;
        box.classList.add('show');
        btn.disabled = false;
      }
    });
  };

  const draw = () => {
    const list = announcements.filter((a) => {
      const matchCat = category === 'all' || a.category === category;
      const matchText = !keyword || `${a.title} ${a.body} ${a.category}`.toLowerCase().includes(keyword);
      return matchCat && matchText;
    });
    const cats = ['all', ...new Set(announcements.map((a) => a.category))];
    const listNode = $('#ann-list', container);
    listNode.innerHTML = `
      <div class="card-head" style="align-items:center;flex-wrap:wrap">
        <div class="filters grow">
          <div class="search">${icon('search')}<input type="search" id="ann-search" placeholder="搜尋公告標題或內容…" value="${esc(keyword)}" /></div>
          <select id="ann-cat">${cats.map((c) => `<option value="${esc(c)}" ${c === category ? 'selected' : ''}>${c === 'all' ? '全部分類' : esc(c)}</option>`).join('')}</select>
        </div>
        <span class="badge badge-gray">${list.length} 則公告</span>
      </div>
      <div class="announce-list">${list.length ? list.map((a) => {
        const d = fmtShort(a.createdAt);
        return `<div class="announce-item">
          <div class="announce-date"><strong>${d.day}</strong><span>${d.month}</span></div>
          <div class="announce-main">
            <div class="announce-title-row">${a.pinned ? `<span class="pin-flag" title="置頂">${icon('pin', 'icon-sm')}</span>` : ''}<button class="btn-link announce-title" data-ann="${esc(a.id)}" style="font-size:13px">${esc(a.title)}</button></div>
            <p class="announce-excerpt">${esc(a.body)}</p>
            <div class="announce-meta"><span class="badge badge-${a.category === '教務處' ? 'navy' : 'gray'}">${esc(a.category)}</span><span>${fmtDateTime(a.createdAt)}</span><span>${esc(a.authorName || '')}</span></div>
          </div>
          <div class="announce-actions"><button class="icon-btn" style="width:30px;height:30px" data-ann="${esc(a.id)}" aria-label="查看公告">${icon('chevron-right', 'icon-sm')}</button></div>
        </div>`;
      }).join('') : emptyState({ iconName: 'bell', title: '沒有符合條件的公告', desc: '試著調整搜尋關鍵字或分類。' })}</div>`;

    $$('[data-ann]', listNode).forEach((btn) => btn.addEventListener('click', () => {
      const a = announcements.find((x) => x.id === btn.dataset.ann);
      if (a) announcementDetail(a, ctx, refresh);
    }));
    $('#ann-cat', listNode).addEventListener('change', (e) => { category = e.target.value; draw(); });
    const search = $('#ann-search', listNode);
    search.addEventListener('input', () => { keyword = search.value.trim().toLowerCase(); const pos = search.selectionStart; draw(); const ns = $('#ann-search', container); if (ns) { ns.focus(); ns.setSelectionRange(pos, pos); } });
  };

  const refresh = async () => {
    try {
      const data = await api.get('/announcements');
      announcements = data.announcements;
      if (!announcements.length) {
        $('#ann-list', container).innerHTML = emptyState({ iconName: 'bell', title: '目前沒有公告', desc: '校園公告發布後會出現在這裡。' });
      } else {
        draw();
      }
    } catch (err) {
      $('#ann-list', container).innerHTML = errorState(err.message);
    }
  };

  try {
    const data = await api.get('/announcements');
    announcements = data.announcements;
    container.innerHTML = pageHead({
      eyebrow: 'CAMPUS NEWS', title: '校園公告',
      sub: '教務、學務與校園活動的最新訊息',
      actions: canPost ? `<button class="btn btn-primary" data-new>${icon('plus')}發布公告</button>` : ''
    }) + `<div class="card" id="ann-list"></div>`;
    draw();
    $('[data-new]', container)?.addEventListener('click', compose);
  } catch (err) {
    container.innerHTML = pageHead({ eyebrow: 'CAMPUS NEWS', title: '校園公告' }) + errorState(err.message);
  }
}

export async function renderProfilePage(container, ctx) {
  const u = ctx.state.user;
  const role = ROLE_LABEL[u.role] || u.role;
  container.innerHTML = pageHead({
    eyebrow: 'MY ACCOUNT', title: '個人資料',
    sub: '管理聯絡資訊與帳號密碼'
  }) + `
  <div class="grid grid-2" style="align-items:start">
    <div class="stack">
      <div class="card">
        <div class="card-body" style="text-align:center;padding:30px 24px 24px">
          ${avatar(u, 'xl')}
          <h2 style="font-family:var(--font-serif);font-size:21px;margin-top:12px">${esc(u.name)}</h2>
          <p class="muted small">${esc(u.title || u.className || '')} · ${esc(u.dept)}</p>
          <div class="row" style="justify-content:center;gap:6px;margin-top:10px"><span class="badge badge-navy">${role}</span><span class="badge badge-gray">${esc(ctx.state.meta.semester)}</span></div>
          <div class="divider"></div>
          <div style="display:grid;gap:10px;text-align:left">
            ${u.role === 'student' ? `
              <div class="cd-item">${icon('graduation')}<div><span>學號</span><strong>${esc(u.studentNo)}</strong></div></div>
              <div class="cd-item">${icon('book')}<div><span>班級 / 年級</span><strong>${esc(u.className)} · ${u.grade} 年級</strong></div></div>
              <div class="cd-item">${icon('calendar')}<div><span>入學學年度</span><strong>${u.enrollYear} 學年度</strong></div></div>
              ${u.dorm ? `<div class="cd-item">${icon('home')}<div><span>宿舍</span><strong>${esc(u.dorm)}</strong></div></div>` : ''}
            ` : `
              <div class="cd-item">${icon('award')}<div><span>員工編號</span><strong>${esc(u.employeeNo)}</strong></div></div>
              <div class="cd-item">${icon('building')}<div><span>服務單位</span><strong>${esc(u.dept)}</strong></div></div>
              <div class="cd-item">${icon('pin')}<div><span>研究室 / 辦公室</span><strong>${esc(u.office || '—')}</strong></div></div>
            `}
            <div class="cd-item">${icon('mail')}<div><span>電子郵件</span><strong>${esc(u.email)}</strong></div></div>
            <div class="cd-item">${icon('phone')}<div><span>聯絡電話</span><strong>${esc(u.phone || '—')}</strong></div></div>
          </div>
        </div>
      </div>
      <div class="info-strip">${icon('info')}<div>此為示範系統，個人資料僅儲存於本機 <code>data/db.json</code>。請勿輸入真實敏感資訊。</div></div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h2>聯絡資訊</h2><p>更新後將同步顯示於校務系統</p></div>${icon('edit', 'icon-sm')}</div>
        <div class="card-body">
          <form id="profile-form" class="form-grid">
            <div class="form-error span-2" id="profile-error"></div>
            <div class="field"><label>姓名</label><input value="${esc(u.name)}" disabled /></div>
            <div class="field"><label>${u.role === 'student' ? '學號' : '員工編號'}</label><input value="${esc(u.studentNo || u.employeeNo || '')}" disabled /></div>
            <div class="field span-2"><label>電子郵件</label><input type="email" name="email" value="${esc(u.email || '')}" placeholder="name@nqu.edu.tw" /></div>
            <div class="field"><label>聯絡電話</label><input type="tel" name="phone" value="${esc(u.phone || '')}" placeholder="09xx-xxx-xxx" /></div>
            <div class="field"><label>${u.role === 'teacher' ? '研究室 / 辦公室' : '緊急聯絡人'}</label>${u.role === 'teacher' ? `<input name="office" value="${esc(u.office || '')}" />` : `<input name="emergencyContact" value="${esc(u.emergencyContact || '')}" />`}</div>
            <div class="field span-2"><label>通訊地址</label><input name="address" value="${esc(u.address || '')}" placeholder="金門縣金寧鄉大學路1號" /></div>
            <div class="span-2" style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('save')}儲存變更</button></div>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>變更密碼</h2><p>建議定期更新密碼以維護帳號安全</p></div>${icon('lock', 'icon-sm')}</div>
        <div class="card-body">
          <form id="password-form" class="stack" style="gap:12px">
            <div class="form-error" id="pwd-error"></div>
            <div class="field"><label>目前密碼</label><input type="password" name="currentPassword" autocomplete="current-password" required /></div>
            <div class="form-grid">
              <div class="field"><label>新密碼</label><input type="password" name="newPassword" minlength="6" autocomplete="new-password" required /></div>
              <div class="field"><label>確認新密碼</label><input type="password" name="confirmPassword" minlength="6" autocomplete="new-password" required /></div>
            </div>
            <div class="hint">密碼長度至少 6 個字元。變更後請使用新密碼重新登入。</div>
            <div style="display:flex;justify-content:flex-end"><button class="btn btn-outline" type="submit">${icon('lock')}更新密碼</button></div>
          </form>
        </div>
      </div>
    </div>
  </div>`;

  $('#profile-form', container).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const btn = form.querySelector('button[type=submit]');
    const box = $('#profile-error', container);
    box.classList.remove('show');
    btn.disabled = true;
    try {
      const payload = {};
      for (const key of ['email', 'phone', 'address', 'emergencyContact', 'office']) {
        if (fd.get(key) !== null) payload[key] = fd.get(key);
      }
      const res = await api.patch('/auth/me', payload);
      Object.assign(ctx.state.user, res.user);
      ctx.updateUser(res.user);
      toast('個人資料已更新');
    } catch (err) {
      box.textContent = err.message;
      box.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });

  $('#password-form', container).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const box = $('#pwd-error', container);
    box.classList.remove('show');
    if (fd.get('newPassword') !== fd.get('confirmPassword')) {
      box.textContent = '兩次輸入的新密碼不一致';
      box.classList.add('show');
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api.post('/auth/password', {
        currentPassword: fd.get('currentPassword'),
        newPassword: fd.get('newPassword')
      });
      form.reset();
      toast('密碼已更新，請妥善保管新密碼');
    } catch (err) {
      box.textContent = err.message;
      box.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });
}

export function openRosterModal(courseId, ctx, title = '修課名單') {
  openCourseDetail(courseId, ctx);
}
