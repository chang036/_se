import { verifyPassword, hashPassword } from './security.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, '請求內容過大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON 格式不正確'));
      }
    });
    req.on('error', reject);
  });
}

export function publicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

const nowIso = () => new Date().toISOString();

function formatSchedule(course, periods) {
  const names = ['一', '二', '三', '四', '五', '六', '日'];
  return course.schedule.map((slot) => {
    const start = periods.find((p) => p.no === slot.periods[0]);
    const end = periods.find((p) => p.no === slot.periods[slot.periods.length - 1]);
    return `週${names[slot.day - 1]} 第 ${slot.periods[0]}–${slot.periods[slot.periods.length - 1]} 節${start ? `（${start.time.split('–')[0]}–${end.time.split('–')[1]}）` : ''}`;
  }).join('、');
}

function hasConflict(course, studentId, data) {
  const mine = data.courses.filter((c) => c.id !== course.id && c.enrolled.includes(studentId));
  for (const slot of course.schedule) {
    for (const other of mine) {
      for (const otherSlot of other.schedule) {
        if (slot.day === otherSlot.day && slot.periods.some((p) => otherSlot.periods.includes(p))) {
          return other;
        }
      }
    }
  }
  return null;
}

function courseDto(course, viewer, data) {
  const teacher = data.users.find((u) => u.id === course.teacherId);
  const enrolledCount = course.enrolled.length;
  return {
    ...course,
    enrolledCount,
    seatsLeft: Math.max(0, course.capacity - enrolledCount),
    teacher: teacher ? publicUser(teacher) : null,
    scheduleText: formatSchedule(course, data.meta.periods),
    isEnrolled: viewer ? course.enrolled.includes(viewer.id) : false,
    isOwner: viewer ? course.teacherId === viewer.id : false
  };
}

const scoreTotal = (g) => {
  if (!g) return null;
  const { regular, midterm, final } = g;
  if (regular == null || midterm == null || final == null) return null;
  return Math.round(regular * 0.3 + midterm * 0.3 + final * 0.4);
};

function gradeLabel(total) {
  if (total == null) return '未結算';
  if (total >= 90) return 'A+';
  if (total >= 85) return 'A';
  if (total >= 80) return 'A-';
  if (total >= 75) return 'B+';
  if (total >= 70) return 'B';
  if (total >= 65) return 'B-';
  if (total >= 60) return 'C';
  return 'F';
}

function gpaOf(score) {
  if (score >= 80) return 4;
  if (score >= 70) return 3;
  if (score >= 60) return 2;
  if (score >= 50) return 1;
  return 0;
}

function requirementSummary(studentId, data) {
  const rows = data.grades.filter((g) => g.studentId === studentId && g.score >= 60);
  const categories = data.requirements.map((req) => {
    const earned = rows.filter((g) => g.category === req.name).reduce((sum, g) => sum + g.credits, 0);
    return { ...req, earned };
  });
  const totalRequired = categories.reduce((s, c) => s + c.required, 0);
  const totalEarned = categories.reduce((s, c) => s + c.earned, 0);
  const allCredits = rows.reduce((s, g) => s + g.credits, 0);
  const weighted = rows.reduce((s, g) => s + gpaOf(g.score) * g.credits, 0);
  return {
    categories,
    totalRequired,
    totalEarned: Math.min(totalEarned, totalRequired),
    gpa: allCredits ? Math.round((weighted / allCredits) * 100) / 100 : 0,
    average: rows.length ? Math.round(rows.reduce((s, g) => s + g.score, 0) / rows.length * 10) / 10 : 0
  };
}

function metaDto(data) {
  return {
    ...data.meta,
    counts: {
      students: data.users.filter((u) => u.role === 'student').length,
      teachers: data.users.filter((u) => u.role === 'teacher').length,
      courses: data.courses.length,
      announcements: data.announcements.length
    },
    today: new Date().toISOString().slice(0, 10)
  };
}

function resolveSession(req, data, sessions) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return data.users.find((u) => u.id === userId) || null;
}

function requireRole(user, ...roles) {
  if (!user) throw new HttpError(401, '請先登入');
  if (roles.length && !roles.includes(user.role)) throw new HttpError(403, '權限不足');
  return user;
}

export async function handleApi(req, res, url, { db, sessions }) {
  if (!url.pathname.startsWith('/api/')) return false;
  const data = db.load();
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method;
  const user = resolveSession(req, data, sessions);

  try {
    if (!parts.length) throw new HttpError(404, '找不到 API');

    // ---------- 認證 ----------
    if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST') {
      const body = await readBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!username || !password) throw new HttpError(400, '請輸入帳號與密碼');
      const found = data.users.find((u) => u.username.toLowerCase() === username);
      if (!found || !verifyPassword(password, found.password)) {
        throw new HttpError(401, '帳號或密碼錯誤');
      }
      const token = sessions.create(found.id);
      const { password: _pw, ...safe } = found;
      return send(res, 200, { token, user: safe, meta: metaDto(data) });
    }

    if (parts[0] === 'auth' && parts[1] === 'logout' && method === 'POST') {
      const header = req.headers.authorization || '';
      if (header.startsWith('Bearer ')) sessions.destroy(header.slice(7));
      return send(res, 200, { ok: true });
    }

    if (parts[0] === 'auth' && parts[1] === 'me' && method === 'GET') {
      requireRole(user);
      return send(res, 200, { user: publicUser(user), meta: metaDto(data) });
    }

    if (parts[0] === 'auth' && parts[1] === 'me' && method === 'PATCH') {
      requireRole(user);
      const body = await readBody(req);
      const allowed = ['email', 'phone', 'address', 'emergencyContact', 'office'];
      for (const key of allowed) {
        if (body[key] !== undefined) {
          const value = String(body[key]).trim();
          if (value.length > 120) throw new HttpError(400, '欄位內容過長');
          user[key] = value;
        }
      }
      db.save();
      return send(res, 200, { user: publicUser(user) });
    }

    if (parts[0] === 'auth' && parts[1] === 'password' && method === 'POST') {
      requireRole(user);
      const body = await readBody(req);
      if (!verifyPassword(String(body.currentPassword || ''), user.password)) {
        throw new HttpError(400, '目前密碼不正確');
      }
      if (String(body.newPassword || '').length < 6) {
        throw new HttpError(400, '新密碼至少需要 6 個字元');
      }
      user.password = hashPassword(String(body.newPassword));
      db.save();
      return send(res, 200, { ok: true });
    }

    if (parts[0] === 'meta' && method === 'GET') {
      return send(res, 200, { meta: metaDto(data) });
    }

    requireRole(user);

    // ---------- 公告 ----------
    if (parts[0] === 'announcements' && parts.length === 1 && method === 'GET') {
      const list = [...data.announcements].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }).map((a) => ({ ...a, authorName: data.users.find((u) => u.id === a.authorId)?.name || '校務系統' }));
      return send(res, 200, { announcements: list });
    }

    if (parts[0] === 'announcements' && parts.length === 1 && method === 'POST') {
      requireRole(user, 'teacher', 'admin');
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const text = String(body.body || '').trim();
      if (title.length < 2 || title.length > 80) throw new HttpError(400, '標題長度需為 2–80 字');
      if (text.length < 2 || text.length > 2000) throw new HttpError(400, '內容長度需為 2–2000 字');
      const item = {
        id: `A${String(data.counters.announcement++).padStart(3, '0')}`,
        title,
        body: text,
        category: String(body.category || user.dept).slice(0, 30),
        authorId: user.id,
        pinned: user.role === 'admin' ? Boolean(body.pinned) : false,
        audience: 'all',
        createdAt: nowIso()
      };
      data.announcements.unshift(item);
      db.save();
      return send(res, 201, { announcement: item });
    }

    if (parts[0] === 'announcements' && parts.length === 2 && method === 'DELETE') {
      const item = data.announcements.find((a) => a.id === parts[1]);
      if (!item) throw new HttpError(404, '找不到公告');
      if (user.role !== 'admin' && item.authorId !== user.id) throw new HttpError(403, '只能刪除自己發布的公告');
      data.announcements = data.announcements.filter((a) => a.id !== item.id);
      db.save();
      return send(res, 200, { ok: true });
    }

    // ---------- 課程 ----------
    if (parts[0] === 'courses' && parts.length === 1 && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      const dept = url.searchParams.get('dept') || '';
      const type = url.searchParams.get('type') || '';
      const scope = url.searchParams.get('scope') || 'all';
      let list = data.courses;
      if (scope === 'mine') {
        if (user.role === 'student') list = list.filter((c) => c.enrolled.includes(user.id));
        if (user.role === 'teacher') list = list.filter((c) => c.teacherId === user.id);
      }
      if (q) list = list.filter((c) => `${c.name} ${c.code} ${c.teacherId}`.toLowerCase().includes(q)
        || (data.users.find((u) => u.id === c.teacherId)?.name || '').toLowerCase().includes(q));
      if (dept) list = list.filter((c) => c.dept === dept);
      if (type) list = list.filter((c) => c.type === type);
      const courses = list.map((c) => courseDto(c, user, data))
        .sort((a, b) => a.code.localeCompare(b.code));
      return send(res, 200, { courses });
    }

    if (parts[0] === 'courses' && parts[1] && parts.length === 2 && method === 'GET') {
      const course = data.courses.find((c) => c.id === parts[1] || c.code === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      const dto = courseDto(course, user, data);
      dto.conflict = user.role === 'student' && !dto.isEnrolled
        ? hasConflict(course, user.id, data)?.name || null : null;
      if (user.role === 'admin' || course.teacherId === user.id) {
        dto.roster = course.enrolled.map((sid) => {
          const s = data.users.find((u) => u.id === sid);
          const g = data.courseGrades.find((x) => x.courseId === course.id && x.studentId === sid);
          const total = scoreTotal(g);
          return {
            student: publicUser(s), regular: g?.regular ?? null, midterm: g?.midterm ?? null,
            final: g?.final ?? null, total, label: gradeLabel(total)
          };
        });
      }
      return send(res, 200, { course: dto });
    }

    if (parts[0] === 'courses' && parts.length === 1 && method === 'POST') {
      requireRole(user, 'admin');
      const body = await readBody(req);
      const code = String(body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim();
      if (!code || !name) throw new HttpError(400, '請填寫課程代碼與名稱');
      if (data.courses.some((c) => c.code === code)) throw new HttpError(400, '課程代碼已存在');
      const teacher = data.users.find((u) => u.id === body.teacherId && u.role === 'teacher');
      if (!teacher) throw new HttpError(400, '請選擇授課教師');
      const credits = Number(body.credits);
      if (!Number.isInteger(credits) || credits < 1 || credits > 6) throw new HttpError(400, '學分數需為 1–6');
      const capacity = Number(body.capacity) || 50;
      if (capacity < 1 || capacity > 300) throw new HttpError(400, '人數上限需為 1–300');
      const schedule = Array.isArray(body.schedule) ? body.schedule : [];
      const valid = schedule.every((s) => s.day >= 1 && s.day <= 7
        && Array.isArray(s.periods) && s.periods.length && s.periods.every((p) => p >= 1 && p <= 12));
      if (!valid) throw new HttpError(400, '上課時段格式不正確');
      const course = {
        id: `C${String(data.courses.length + 1).padStart(3, '0')}${Date.now().toString().slice(-2)}`,
        code, name, credits, type: body.type === 'elective' ? 'elective' : 'required',
        dept: String(body.dept || teacher.dept), teacherId: teacher.id,
        room: String(body.room || '未指定').slice(0, 40), schedule,
        capacity, enrolled: [], description: String(body.description || '').slice(0, 500),
        color: String(body.color || '#2f6b9a'), semester: '115-1', syllabus: []
      };
      data.courses.push(course);
      db.save();
      return send(res, 201, { course: courseDto(course, user, data) });
    }

    if (parts[0] === 'courses' && parts[1] && method === 'PATCH') {
      requireRole(user, 'admin');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      const body = await readBody(req);
      if (body.code !== undefined) {
        const code = String(body.code).trim().toUpperCase();
        if (!code) throw new HttpError(400, '課程代碼不可為空');
        if (data.courses.some((c) => c.id !== course.id && c.code === code)) {
          throw new HttpError(400, '課程代碼已存在');
        }
        course.code = code.slice(0, 20);
      }
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) throw new HttpError(400, '課程名稱不可為空');
        course.name = name.slice(0, 80);
      }
      for (const key of ['room', 'description', 'color']) {
        if (body[key] !== undefined) course[key] = String(body[key]).trim().slice(0, key === 'description' ? 500 : 80);
      }
      if (body.credits !== undefined) {
        const credits = Number(body.credits);
        if (!Number.isInteger(credits) || credits < 1 || credits > 6) throw new HttpError(400, '學分數需為 1–6');
        course.credits = credits;
      }
      if (body.capacity !== undefined) {
        const cap = Number(body.capacity);
        if (!Number.isInteger(cap) || cap < 1 || cap > 300 || cap < course.enrolled.length) {
          throw new HttpError(400, '人數上限需為 1–300，且不可小於目前選課人數');
        }
        course.capacity = cap;
      }
      if (body.teacherId !== undefined) {
        const teacher = data.users.find((u) => u.id === body.teacherId && u.role === 'teacher');
        if (!teacher) throw new HttpError(400, '授課教師不存在');
        course.teacherId = teacher.id;
      }
      if (body.type !== undefined) course.type = body.type === 'elective' ? 'elective' : 'required';
      if (body.dept !== undefined) course.dept = String(body.dept);
      if (Array.isArray(body.schedule)) {
        const valid = body.schedule.every((s) => s.day >= 1 && s.day <= 7
          && Array.isArray(s.periods) && s.periods.length && s.periods.every((p) => p >= 1 && p <= 12));
        if (!valid) throw new HttpError(400, '上課時段格式不正確');
        course.schedule = body.schedule;
      }
      db.save();
      return send(res, 200, { course: courseDto(course, user, data) });
    }

    if (parts[0] === 'courses' && parts[1] && parts.length === 2 && method === 'DELETE') {
      requireRole(user, 'admin');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      data.courses = data.courses.filter((c) => c.id !== course.id);
      data.courseGrades = data.courseGrades.filter((g) => g.courseId !== course.id);
      data.leaves = data.leaves.filter((l) => l.courseId !== course.id);
      db.save();
      return send(res, 200, { ok: true });
    }

    // ---------- 選課 ----------
    if (parts[0] === 'courses' && parts[1] && parts[2] === 'enroll' && method === 'POST') {
      requireRole(user, 'student');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      if (course.enrolled.includes(user.id)) throw new HttpError(400, '你已選修這門課程');
      if (course.enrolled.length >= course.capacity) throw new HttpError(400, '課程人數已額滿');
      const conflict = hasConflict(course, user.id, data);
      if (conflict) throw new HttpError(400, `衝堂：與「${conflict.name}」上課時段重疊`);
      course.enrolled.push(user.id);
      db.save();
      return send(res, 200, { course: courseDto(course, user, data), message: '選課成功' });
    }

    if (parts[0] === 'courses' && parts[1] && parts[2] === 'enroll' && method === 'DELETE') {
      requireRole(user, 'student');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      if (!course.enrolled.includes(user.id)) throw new HttpError(400, '你尚未選修這門課程');
      course.enrolled = course.enrolled.filter((id) => id !== user.id);
      data.courseGrades = data.courseGrades.filter((g) => !(g.courseId === course.id && g.studentId === user.id));
      db.save();
      return send(res, 200, { course: courseDto(course, user, data), message: '已退選' });
    }

    if (parts[0] === 'courses' && parts[1] && parts[2] === 'roster' && method === 'GET') {
      requireRole(user, 'teacher', 'admin');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      if (user.role === 'teacher' && course.teacherId !== user.id) throw new HttpError(403, '只能查看自己授課的課程');
      const roster = course.enrolled.map((sid) => {
        const s = data.users.find((u) => u.id === sid);
        const g = data.courseGrades.find((x) => x.courseId === course.id && x.studentId === sid);
        return {
          student: publicUser(s), regular: g?.regular ?? null, midterm: g?.midterm ?? null,
          final: g?.final ?? null, total: scoreTotal(g), label: gradeLabel(scoreTotal(g))
        };
      });
      return send(res, 200, { course: courseDto(course, user, data), roster });
    }

    // ---------- 成績 ----------
    if (parts[0] === 'grades' && parts.length === 1 && method === 'GET') {
      requireRole(user, 'student');
      const grades = data.grades.filter((g) => g.studentId === user.id)
        .sort((a, b) => b.semester.localeCompare(a.semester));
      return send(res, 200, { grades, summary: requirementSummary(user.id, data) });
    }

    if (parts[0] === 'requirements' && method === 'GET') {
      requireRole(user, 'student');
      return send(res, 200, { requirements: requirementSummary(user.id, data) });
    }

    if (parts[0] === 'courses' && parts[1] && parts[2] === 'grades' && method === 'GET') {
      requireRole(user, 'teacher', 'admin');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      if (user.role === 'teacher' && course.teacherId !== user.id) throw new HttpError(403, '只能查看自己授課的課程');
      const roster = course.enrolled.map((sid) => {
        const s = data.users.find((u) => u.id === sid);
        const g = data.courseGrades.find((x) => x.courseId === course.id && x.studentId === sid);
        return {
          studentId: sid, name: s?.name || sid, studentNo: s?.studentNo || '', className: s?.className || '',
          regular: g?.regular ?? null, midterm: g?.midterm ?? null, final: g?.final ?? null,
          total: scoreTotal(g), label: gradeLabel(scoreTotal(g))
        };
      });
      return send(res, 200, { course: courseDto(course, user, data), roster });
    }

    if (parts[0] === 'courses' && parts[1] && parts[2] === 'grades' && method === 'PUT') {
      requireRole(user, 'teacher', 'admin');
      const course = data.courses.find((c) => c.id === parts[1]);
      if (!course) throw new HttpError(404, '找不到課程');
      if (user.role === 'teacher' && course.teacherId !== user.id) throw new HttpError(403, '只能登錄自己授課的課程');
      const body = await readBody(req);
      if (!Array.isArray(body.grades)) throw new HttpError(400, '成績資料格式不正確');
      for (const row of body.grades) {
        if (!course.enrolled.includes(row.studentId)) throw new HttpError(400, '名單中包含非本課程學生');
        const values = {};
        for (const key of ['regular', 'midterm', 'final']) {
          const raw = row[key];
          if (raw === '' || raw == null) {
            values[key] = null;
          } else {
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, '成績需介於 0–100');
            values[key] = Math.round(n * 10) / 10;
          }
        }
        let record = data.courseGrades.find((g) => g.courseId === course.id && g.studentId === row.studentId);
        if (!record) {
          record = { courseId: course.id, studentId: row.studentId };
          data.courseGrades.push(record);
        }
        Object.assign(record, values, { updatedAt: nowIso() });
      }
      db.save();
      const roster = course.enrolled.map((sid) => {
        const s = data.users.find((u) => u.id === sid);
        const g = data.courseGrades.find((x) => x.courseId === course.id && x.studentId === sid);
        return {
          studentId: sid, name: s?.name || sid, studentNo: s?.studentNo || '', className: s?.className || '',
          regular: g?.regular ?? null, midterm: g?.midterm ?? null, final: g?.final ?? null,
          total: scoreTotal(g), label: gradeLabel(scoreTotal(g))
        };
      });
      return send(res, 200, { ok: true, roster, message: '成績已儲存' });
    }

    // ---------- 課表 ----------
    if (parts[0] === 'timetable' && method === 'GET') {
      let list = [];
      if (user.role === 'student') list = data.courses.filter((c) => c.enrolled.includes(user.id));
      if (user.role === 'teacher') list = data.courses.filter((c) => c.teacherId === user.id);
      if (user.role === 'admin') list = data.courses;
      const entries = [];
      for (const c of list) {
        const teacher = data.users.find((u) => u.id === c.teacherId);
        for (const slot of c.schedule) {
          entries.push({
            courseId: c.id, code: c.code, name: c.name, room: c.room, color: c.color,
            teacher: teacher?.name || '', day: slot.day, periods: slot.periods
          });
        }
      }
      return send(res, 200, { periods: data.meta.periods, entries });
    }

    // ---------- 請假 ----------
    if (parts[0] === 'leaves' && parts.length === 1 && method === 'GET') {
      let list = data.leaves;
      if (user.role === 'student') list = list.filter((l) => l.studentId === user.id);
      if (user.role === 'teacher') {
        const own = data.courses.filter((c) => c.teacherId === user.id).map((c) => c.id);
        list = list.filter((l) => own.includes(l.courseId));
      }
      const dtos = list.map((l) => {
        const student = data.users.find((u) => u.id === l.studentId);
        const course = data.courses.find((c) => c.id === l.courseId);
        return { ...l, studentName: student?.name || '', studentNo: student?.studentNo || '', courseName: course?.name || '' };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return send(res, 200, { leaves: dtos });
    }

    if (parts[0] === 'leaves' && parts.length === 1 && method === 'POST') {
      requireRole(user, 'student');
      const body = await readBody(req);
      const course = data.courses.find((c) => c.id === body.courseId);
      if (!course || !course.enrolled.includes(user.id)) throw new HttpError(400, '請選擇已選修的課程');
      const startDate = String(body.startDate || '');
      const endDate = String(body.endDate || startDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        throw new HttpError(400, '請填寫正確的請假日期');
      }
      if (endDate < startDate) throw new HttpError(400, '結束日期不可早於開始日期');
      const reason = String(body.reason || '').trim();
      if (reason.length < 5 || reason.length > 500) throw new HttpError(400, '請假事由需為 5–500 字');
      const leave = {
        id: `L${String(data.counters.leave++).padStart(3, '0')}`,
        studentId: user.id, courseId: course.id,
        type: ['病假', '事假', '公假', '喪假'].includes(body.type) ? body.type : '事假',
        startDate, endDate, reason, status: 'pending',
        createdAt: nowIso(), reviewer: null, reviewNote: ''
      };
      data.leaves.push(leave);
      db.save();
      return send(res, 201, { leave });
    }

    if (parts[0] === 'leaves' && parts[1] && method === 'PATCH') {
      requireRole(user);
      const leave = data.leaves.find((l) => l.id === parts[1]);
      if (!leave) throw new HttpError(404, '找不到請假單');
      const body = await readBody(req);
      if (user.role === 'student') {
        if (leave.studentId !== user.id) throw new HttpError(403, '權限不足');
        if (body.action !== 'cancel') throw new HttpError(400, '不支援的操作');
        if (leave.status !== 'pending') throw new HttpError(400, '只能取消審核中的請假單');
        leave.status = 'cancelled';
      } else if (user.role === 'admin') {
        if (!['approve', 'reject'].includes(body.action)) throw new HttpError(400, '不支援的操作');
        if (leave.status !== 'pending') throw new HttpError(400, '此請假單已處理');
        leave.status = body.action === 'approve' ? 'approved' : 'rejected';
        leave.reviewer = user.name;
        leave.reviewNote = String(body.note || '').slice(0, 200);
      } else {
        throw new HttpError(403, '權限不足');
      }
      db.save();
      return send(res, 200, { leave });
    }

    // ---------- 管理 ----------
    if (parts[0] === 'admin' && parts[1] === 'stats' && method === 'GET') {
      requireRole(user, 'admin');
      const students = data.users.filter((u) => u.role === 'student');
      const depts = [...new Set(students.map((s) => s.dept))].map((dept) => ({
        dept, students: students.filter((s) => s.dept === dept).length
      })).sort((a, b) => b.students - a.students);
      const enrollment = data.courses.reduce((sum, c) => sum + c.enrolled.length, 0);
      const capacity = data.courses.reduce((sum, c) => sum + c.capacity, 0);
      const util = [...data.courses].map((c) => ({
        id: c.id, name: c.name, code: c.code, enrolled: c.enrolled.length,
        capacity: c.capacity, percent: Math.round(c.enrolled.length / c.capacity * 100)
      })).sort((a, b) => b.percent - a.percent);
      return send(res, 200, {
        counts: {
          students: students.length, teachers: data.users.filter((u) => u.role === 'teacher').length,
          courses: data.courses.length, enrollment, capacity,
          utilization: capacity ? Math.round(enrollment / capacity * 100) : 0,
          pendingLeaves: data.leaves.filter((l) => l.status === 'pending').length
        },
        depts,
        util,
        recentLeaves: data.leaves.filter((l) => l.status === 'pending').slice(0, 5).map((l) => ({
          ...l, studentName: data.users.find((u) => u.id === l.studentId)?.name || '',
          courseName: data.courses.find((c) => c.id === l.courseId)?.name || ''
        }))
      });
    }

    if (parts[0] === 'admin' && parts[1] === 'students' && method === 'GET') {
      requireRole(user, 'admin');
      const students = data.users.filter((u) => u.role === 'student').map((s) => {
        const enrolled = data.courses.filter((c) => c.enrolled.includes(s.id));
        return {
          ...publicUser(s),
          courseCount: enrolled.length,
          credits: enrolled.reduce((sum, c) => sum + c.credits, 0),
          gradesCount: data.grades.filter((g) => g.studentId === s.id).length
        };
      });
      return send(res, 200, { students });
    }

    if (parts[0] === 'teachers' && method === 'GET') {
      requireRole(user);
      return send(res, 200, {
        teachers: data.users.filter((u) => u.role === 'teacher').map(publicUser)
      });
    }

    throw new HttpError(404, '找不到 API');
  } catch (err) {
    if (err instanceof HttpError) {
      return send(res, err.status, { error: err.message });
    }
    console.error('[api]', err);
    return send(res, 500, { error: '伺服器發生錯誤，請稍後再試' });
  }
}
