import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

let server;
let base;
let tmpDir;

const tokens = {};

async function api(pathname, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function login(username, password = '123456') {
  const res = await api('/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(res.status, 200, `login failed for ${username}: ${JSON.stringify(res.data)}`);
  return res.data;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nqu-campus-test-'));
  server = createApp({ dbFile: path.join(tmpDir, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('靜態檔案與 SPA fallback', async () => {
  const home = await api('/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.data, /<title>/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(home.headers.get('content-security-policy'));

  const js = await api('/js/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /text\/javascript/);

  const spa = await api('/some/deep/route');
  assert.equal(spa.status, 200);
  assert.match(spa.data, /<title>/);

  const missing = await api('/missing.js');
  assert.equal(missing.status, 404);

  const traversal = await api('/%2e%2e/server.js');
  assert.ok([403, 404].includes(traversal.status), `unexpected traversal status ${traversal.status}`);
  assert.ok(!String(traversal.data).includes('createApp'), '不應讀取到專案原始碼');

  const badMethod = await api('/', { method: 'POST' });
  assert.equal(badMethod.status, 405);
});

test('未登入與錯誤帳密會被拒絕', async () => {
  assert.equal((await api('/api/courses')).status, 401);
  assert.equal((await api('/api/auth/me')).status, 401);
  assert.equal((await api('/api/nope')).status, 401);

  const bad = await api('/api/auth/login', { method: 'POST', body: { username: 's11301001', password: 'wrong' } });
  assert.equal(bad.status, 401);
  assert.match(bad.data.error, /帳號或密碼/);

  const empty = await api('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(empty.status, 400);
});

test('三種角色皆可登入並取得個人資料', async () => {
  const student = await login('s11301001');
  tokens.student = student.token;
  assert.equal(student.user.role, 'student');
  assert.equal(student.user.password, undefined);
  assert.equal(student.meta.counts.courses, 14);

  tokens.teacher = (await login('t1001')).token;
  tokens.admin = (await login('admin')).token;

  const me = await api('/api/auth/me', { token: tokens.student });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.studentNo, '11301001');
  assert.equal(me.data.user.password, undefined);

  const teacherMe = await api('/api/auth/me', { token: tokens.teacher });
  assert.equal(teacherMe.data.user.role, 'teacher');
});

test('學生可查詢課程、課表、成績與畢業門檻', async () => {
  const courses = await api('/api/courses', { token: tokens.student });
  assert.equal(courses.status, 200);
  assert.equal(courses.data.courses.length, 14);
  const c001 = courses.data.courses.find((c) => c.id === 'C001');
  assert.equal(c001.isEnrolled, true);
  assert.equal(c001.teacher.name, '王世豪');
  assert.ok(c001.scheduleText.includes('週一'));

  const mine = await api('/api/courses?scope=mine', { token: tokens.student });
  assert.equal(mine.data.courses.length, 6);

  const search = await api('/api/courses?q=資料庫&dept=資訊工程學系', { token: tokens.student });
  assert.equal(search.data.courses.length, 1);
  assert.equal(search.data.courses[0].code, 'CS305');

  const detail = await api('/api/courses/C001', { token: tokens.student });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.course.roster, undefined, '學生不應看到全班名單');

  const timetable = await api('/api/timetable', { token: tokens.student });
  assert.equal(timetable.status, 200);
  assert.equal(timetable.data.periods.length, 12);
  assert.equal(timetable.data.entries.length, 10);

  const grades = await api('/api/grades', { token: tokens.student });
  assert.equal(grades.status, 200);
  assert.equal(grades.data.grades.length, 12);
  assert.equal(grades.data.summary.totalEarned, 26);
  assert.equal(grades.data.summary.gpa, 3.69);

  const reqs = await api('/api/requirements', { token: tokens.student });
  assert.equal(reqs.status, 200);
  assert.equal(reqs.data.requirements.categories.length, 5);
  assert.equal(reqs.data.requirements.totalRequired, 128);

  const announcements = await api('/api/announcements', { token: tokens.student });
  assert.equal(announcements.status, 200);
  assert.equal(announcements.data.announcements[0].pinned, true);
  assert.ok(announcements.data.announcements[0].authorName);
});

test('教師僅能存取自己的課程與名單', async () => {
  const mine = await api('/api/courses?scope=mine', { token: tokens.teacher });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.courses.length, 3);
  assert.ok(mine.data.courses.every((c) => c.teacherId === 'U1001'));

  const roster = await api('/api/courses/C001/roster', { token: tokens.teacher });
  assert.equal(roster.status, 200);
  assert.equal(roster.data.roster.length, 7);
  assert.equal(roster.data.roster[0].student.password, undefined);

  const forbidden = await api('/api/courses/C005/roster', { token: tokens.teacher });
  assert.equal(forbidden.status, 403);

  const grades = await api('/api/courses/C001/grades', { token: tokens.teacher });
  assert.equal(grades.status, 200);
  assert.equal(grades.data.roster.length, 7);
});

test('教師可儲存成績並驗證分數範圍', async () => {
  const save = await api('/api/courses/C001/grades', {
    method: 'PUT',
    token: tokens.teacher,
    body: {
      grades: [
        { studentId: 'S11301001', regular: 90, midterm: 80, final: 70 },
        { studentId: 'S11301002', regular: 100, midterm: 100, final: 100 }
      ]
    }
  });
  assert.equal(save.status, 200);
  assert.equal(save.data.ok, true);
  const row = save.data.roster.find((r) => r.studentId === 'S11301001');
  assert.equal(row.total, 79);
  assert.equal(row.label, 'B+');

  const outOfRange = await api('/api/courses/C001/grades', {
    method: 'PUT',
    token: tokens.teacher,
    body: { grades: [{ studentId: 'S11301001', regular: 101, midterm: 80, final: 70 }] }
  });
  assert.equal(outOfRange.status, 400);

  const outsider = await api('/api/courses/C001/grades', {
    method: 'PUT',
    token: tokens.teacher,
    body: { grades: [{ studentId: 'S11302003', regular: 80, midterm: 80, final: 80 }] }
  });
  assert.equal(outsider.status, 400);

  const forbidden = await api('/api/courses/C002/grades', {
    method: 'PUT',
    token: (await login('t1002')).token,
    body: { grades: [] }
  });
  assert.equal(forbidden.status, 403);
});

test('學生選課、衝堂、額滿與退選', async () => {
  const created = await api('/api/courses', {
    method: 'POST',
    token: tokens.admin,
    body: {
      code: 'TS101', name: '測試選課課程', credits: 2, capacity: 1,
      teacherId: 'U1001', dept: '資訊工程學系', room: '測試教室',
      schedule: [{ day: 2, periods: [9, 10] }]
    }
  });
  assert.equal(created.status, 201);
  const testCourse = created.data.course;

  const enroll = await api(`/api/courses/${testCourse.id}/enroll`, { method: 'POST', token: tokens.student });
  assert.equal(enroll.status, 200);
  assert.equal(enroll.data.course.isEnrolled, true);

  const duplicate = await api(`/api/courses/${testCourse.id}/enroll`, { method: 'POST', token: tokens.student });
  assert.equal(duplicate.status, 400);

  const second = await login('s11301002');
  const full = await api(`/api/courses/${testCourse.id}/enroll`, { method: 'POST', token: second.token });
  assert.equal(full.status, 400);
  assert.match(full.data.error, /額滿/);

  const overlap = await api('/api/courses', {
    method: 'POST',
    token: tokens.admin,
    body: {
      code: 'TS102', name: '測試衝堂課程', credits: 1, capacity: 10,
      teacherId: 'U1002', dept: '企業管理學系',
      schedule: [{ day: 1, periods: [3, 4] }]
    }
  });
  assert.equal(overlap.status, 201);
  const conflict = await api(`/api/courses/${overlap.data.course.id}/enroll`, { method: 'POST', token: tokens.student });
  assert.equal(conflict.status, 400);
  assert.match(conflict.data.error, /衝堂/);

  const drop = await api(`/api/courses/${testCourse.id}/enroll`, { method: 'DELETE', token: tokens.student });
  assert.equal(drop.status, 200);
  assert.equal(drop.data.course.isEnrolled, false);

  const teacherEnroll = await api(`/api/courses/${testCourse.id}/enroll`, { method: 'POST', token: tokens.teacher });
  assert.equal(teacherEnroll.status, 403);

  assert.equal((await api(`/api/courses/${testCourse.id}`, { method: 'DELETE', token: tokens.admin })).status, 200);
  assert.equal((await api(`/api/courses/${overlap.data.course.id}`, { method: 'DELETE', token: tokens.admin })).status, 200);
});

test('管理員課程 CRUD 與欄位驗證', async () => {
  const body = {
    code: 'AD101', name: '管理測試課程', credits: 3, capacity: 30,
    teacherId: 'U1003', dept: '觀光管理學系', type: 'elective',
    room: 'A101', schedule: [{ day: 4, periods: [9, 10] }]
  };
  const created = await api('/api/courses', { method: 'POST', token: tokens.admin, body });
  assert.equal(created.status, 201);
  const id = created.data.course.id;
  assert.equal(created.data.course.isOwner, false);

  const duplicate = await api('/api/courses', { method: 'POST', token: tokens.admin, body });
  assert.equal(duplicate.status, 400);

  const invalidSchedule = await api('/api/courses', {
    method: 'POST', token: tokens.admin,
    body: { ...body, code: 'AD102', schedule: [{ day: 9, periods: [1] }] }
  });
  assert.equal(invalidSchedule.status, 400);

  const invalidCredits = await api('/api/courses', {
    method: 'POST', token: tokens.admin, body: { ...body, code: 'AD103', credits: 9 }
  });
  assert.equal(invalidCredits.status, 400);

  const patched = await api(`/api/courses/${id}`, {
    method: 'PATCH', token: tokens.admin,
    body: { name: '管理測試課程（更新）', capacity: 40, room: 'A202' }
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.course.name, '管理測試課程（更新）');
  assert.equal(patched.data.course.capacity, 40);

  const duplicatePatch = await api(`/api/courses/${id}`, {
    method: 'PATCH', token: tokens.admin, body: { code: 'CS201' }
  });
  assert.equal(duplicatePatch.status, 400);

  const badSchedulePatch = await api(`/api/courses/${id}`, {
    method: 'PATCH', token: tokens.admin, body: { schedule: [{ day: 8, periods: [1] }] }
  });
  assert.equal(badSchedulePatch.status, 400);

  const badCapacityPatch = await api(`/api/courses/${id}`, {
    method: 'PATCH', token: tokens.admin, body: { capacity: 0 }
  });
  assert.equal(badCapacityPatch.status, 400);

  const studentPatch = await api(`/api/courses/${id}`, {
    method: 'PATCH', token: tokens.student, body: { name: 'x' }
  });
  assert.equal(studentPatch.status, 403);

  assert.equal((await api(`/api/courses/${id}`, { method: 'DELETE', token: tokens.admin })).status, 200);
  assert.equal((await api(`/api/courses/${id}`, { method: 'DELETE', token: tokens.admin })).status, 404);
});

test('學生請假流程：建立、取消、審核', async () => {
  const created = await api('/api/leaves', {
    method: 'POST', token: tokens.student,
    body: { courseId: 'C001', type: '事假', startDate: '2026-11-20', endDate: '2026-11-21', reason: '測試請假流程，需返台處理家庭事務。' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.leave.status, 'pending');

  const cancel = await api(`/api/leaves/${created.data.leave.id}`, {
    method: 'PATCH', token: tokens.student, body: { action: 'cancel' }
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.leave.status, 'cancelled');

  const second = await api('/api/leaves', {
    method: 'POST', token: tokens.student,
    body: { courseId: 'C002', type: '病假', startDate: '2026-11-23', endDate: '2026-11-23', reason: '測試管理員審核流程，附診斷證明。' }
  });
  assert.equal(second.status, 201);

  const teacherApprove = await api(`/api/leaves/${second.data.leave.id}`, {
    method: 'PATCH', token: tokens.teacher, body: { action: 'approve' }
  });
  assert.equal(teacherApprove.status, 403);

  const approve = await api(`/api/leaves/${second.data.leave.id}`, {
    method: 'PATCH', token: tokens.admin, body: { action: 'approve', note: '已核可' }
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.data.leave.status, 'approved');
  assert.equal(approve.data.leave.reviewer, '林美華');

  const again = await api(`/api/leaves/${second.data.leave.id}`, {
    method: 'PATCH', token: tokens.admin, body: { action: 'reject' }
  });
  assert.equal(again.status, 400);

  const invalidDate = await api('/api/leaves', {
    method: 'POST', token: tokens.student,
    body: { courseId: 'C001', startDate: '2026-11-25', endDate: '2026-11-20', reason: '日期顛倒的測試資料。' }
  });
  assert.equal(invalidDate.status, 400);

  const notEnrolled = await api('/api/leaves', {
    method: 'POST', token: tokens.student,
    body: { courseId: 'C005', startDate: '2026-11-25', endDate: '2026-11-25', reason: '未選修課程的請假測試。' }
  });
  assert.equal(notEnrolled.status, 400);

  const list = await api('/api/leaves', { token: tokens.student });
  assert.equal(list.status, 200);
  assert.ok(list.data.leaves.every((l) => l.studentId === 'S11301001'));
});

test('公告權限與刪除', async () => {
  const studentPost = await api('/api/announcements', {
    method: 'POST', token: tokens.student, body: { title: '學生公告', body: '學生不應能發布公告。' }
  });
  assert.equal(studentPost.status, 403);

  const teacherPost = await api('/api/announcements', {
    method: 'POST', token: tokens.teacher,
    body: { title: '教師測試公告', body: '這是一則由教師發布的測試公告。', pinned: true }
  });
  assert.equal(teacherPost.status, 201);
  assert.equal(teacherPost.data.announcement.pinned, false, '教師不能置頂公告');
  const id = teacherPost.data.announcement.id;

  const studentDelete = await api(`/api/announcements/${id}`, { method: 'DELETE', token: tokens.student });
  assert.equal(studentDelete.status, 403);

  const otherTeacherDelete = await api(`/api/announcements/${id}`, {
    method: 'DELETE', token: (await login('t1002')).token
  });
  assert.equal(otherTeacherDelete.status, 403);

  assert.equal((await api(`/api/announcements/${id}`, { method: 'DELETE', token: tokens.admin })).status, 200);
  assert.equal((await api(`/api/announcements/${id}`, { method: 'DELETE', token: tokens.admin })).status, 404);
});

test('管理員統計與學生名冊', async () => {
  const stats = await api('/api/admin/stats', { token: tokens.admin });
  assert.equal(stats.status, 200);
  assert.equal(stats.data.counts.students, 12);
  assert.equal(stats.data.counts.teachers, 8);
  assert.equal(stats.data.counts.courses, 14);
  assert.ok(stats.data.depts.length > 0);
  assert.ok(stats.data.util.length === 14);

  const students = await api('/api/admin/students', { token: tokens.admin });
  assert.equal(students.status, 200);
  assert.equal(students.data.students.length, 12);
  const s = students.data.students.find((x) => x.studentNo === '11301001');
  assert.equal(s.courseCount, 6);
  assert.equal(s.credits, 16);

  const forbidden = await api('/api/admin/stats', { token: tokens.teacher });
  assert.equal(forbidden.status, 403);

  const teachers = await api('/api/teachers', { token: tokens.student });
  assert.equal(teachers.status, 200);
  assert.equal(teachers.data.teachers.length, 8);
  assert.ok(teachers.data.teachers.every((t) => t.password === undefined));
});

test('個人資料、密碼變更與登出', async () => {
  const patch = await api('/api/auth/me', {
    method: 'PATCH', token: tokens.student,
    body: { email: 'new-student@nqu.edu.tw', phone: '0912-111-222', unknownField: 'ignored' }
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.data.user.email, 'new-student@nqu.edu.tw');
  assert.equal(patch.data.user.phone, '0912-111-222');
  assert.equal(patch.data.user.unknownField, undefined);

  const account = await login('s11301002');
  const wrongCurrent = await api('/api/auth/password', {
    method: 'POST', token: account.token,
    body: { currentPassword: 'nope', newPassword: 'newpass123' }
  });
  assert.equal(wrongCurrent.status, 400);

  const shortPassword = await api('/api/auth/password', {
    method: 'POST', token: account.token,
    body: { currentPassword: '123456', newPassword: '123' }
  });
  assert.equal(shortPassword.status, 400);

  const changed = await api('/api/auth/password', {
    method: 'POST', token: account.token,
    body: { currentPassword: '123456', newPassword: 'newpass123' }
  });
  assert.equal(changed.status, 200);

  const oldLogin = await api('/api/auth/login', { method: 'POST', body: { username: 's11301002', password: '123456' } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await login('s11301002', 'newpass123');
  assert.ok(newLogin.token);

  const logout = await api('/api/auth/logout', { method: 'POST', token: newLogin.token });
  assert.equal(logout.status, 200);
  assert.equal((await api('/api/auth/me', { token: newLogin.token })).status, 401);
});

test('JSON 格式錯誤與未知 API 回傳正確錯誤', async () => {
  const badJson = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: undefined
  });
  assert.equal(badJson.status, 400);

  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{oops'
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /JSON/);

  const unknown = await api('/api/unknown/route', { token: tokens.admin });
  assert.equal(unknown.status, 404);
});
