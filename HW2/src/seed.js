import { hashPassword } from './security.js';

const PASSWORD = '123456';
const PASSWORD_HASH = hashPassword(PASSWORD);
const hash = () => PASSWORD_HASH;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const SEMESTER = '115學年度第1學期';

const teachers = [
  {
    id: 'U1001', username: 't1001', role: 'teacher', name: '王世豪', title: '副教授',
    dept: '資訊工程學系', email: 'shwang@nqu.edu.tw', phone: '082-313-501', office: '理工大樓 E512',
    employeeNo: 'T1001', color: '#2f6b9a', password: hash()
  },
  {
    id: 'U1002', username: 't1002', role: 'teacher', name: '李雅雯', title: '助理教授',
    dept: '企業管理學系', email: 'ywlee@nqu.edu.tw', phone: '082-313-502', office: '管理大樓 A305',
    employeeNo: 'T1002', color: '#8a5a9e', password: hash()
  },
  {
    id: 'U1003', username: 't1003', role: 'teacher', name: '陳志明', title: '教授',
    dept: '觀光管理學系', email: 'cmchen@nqu.edu.tw', phone: '082-313-503', office: '管理大樓 B412',
    employeeNo: 'T1003', color: '#b5762c', password: hash()
  },
  {
    id: 'U1004', username: 't1004', role: 'teacher', name: '張美玲', title: '講師',
    dept: '護理學系', email: 'mlchang@nqu.edu.tw', phone: '082-313-504', office: '健康大樓 C208',
    employeeNo: 'T1004', color: '#b0506e', password: hash()
  },
  {
    id: 'U1005', username: 't1005', role: 'teacher', name: '林俊宏', title: '副教授',
    dept: '資訊工程學系', email: 'jhline@nqu.edu.tw', phone: '082-313-505', office: '理工大樓 E508',
    employeeNo: 'T1005', color: '#2b7a78', password: hash()
  },
  {
    id: 'U1006', username: 't1006', role: 'teacher', name: '李淑芬', title: '講師',
    dept: '華語文學系', email: 'sflee@nqu.edu.tw', phone: '082-313-506', office: '人文大樓 H210',
    employeeNo: 'T1006', color: '#6b7a3a', password: hash()
  },
  {
    id: 'U1007', username: 't1007', role: 'teacher', name: '郭建宏', title: '助理教授',
    dept: '通識教育中心', email: 'jhkuo@nqu.edu.tw', phone: '082-313-507', office: '綜合大樓 R316',
    employeeNo: 'T1007', color: '#5a6b8a', password: hash()
  },
  {
    id: 'U1008', username: 't1008', role: 'teacher', name: '鄭凱文', title: '講師',
    dept: '體育室', email: 'kwcheng@nqu.edu.tw', phone: '082-313-508', office: '體育館 G101',
    employeeNo: 'T1008', color: '#3f7a55', password: hash()
  }
];

function student(id, name, dept, grade, className, color, extra = {}) {
  const studentNo = id.slice(1);
  return {
    id, username: id.toLowerCase(), role: 'student', name, dept, grade, className,
    studentNo, enrollYear: 115 - grade, email: `${id.toLowerCase()}@nqu.edu.tw`,
    phone: '0912-000-000', address: '金門縣金寧鄉大學路1號', color,
    password: hash(), emergencyContact: '家長 0912-000-001', ...extra
  };
}

const students = [
  student('S11301001', '陳品妤', '資訊工程學系', 2, '資工二A', '#2f6b9a', {
    email: 's11301001@nqu.edu.tw', phone: '0912-345-678', dorm: '女一舍 302-2'
  }),
  student('S11301002', '林冠宇', '資訊工程學系', 3, '資工三A', '#2b7a78', {
    phone: '0922-456-789', dorm: '男二舍 415-1'
  }),
  student('S11301006', '張家豪', '資訊工程學系', 3, '資工三A', '#5a6b8a'),
  student('S11301007', '李欣穎', '資訊工程學系', 2, '資工二A', '#b0506e'),
  student('S11301008', '周柏翰', '資訊工程學系', 2, '資工二A', '#7a6a4a'),
  student('S11301012', '徐立翔', '資訊工程學系', 4, '資工四A', '#3f7a55'),
  student('S11301013', '高語彤', '資訊工程學系', 2, '資工二A', '#8a5a9e'),
  student('S11302003', '黃詩涵', '企業管理學系', 2, '企管二A', '#b5762c'),
  student('S11302009', '蔡宜蓁', '企業管理學系', 2, '企管二A', '#b0506e'),
  student('S11303004', '吳承恩', '觀光管理學系', 1, '觀光一A', '#2b7a78'),
  student('S11204005', '許雅婷', '護理學系', 2, '護理二A', '#8a5a9e'),
  student('S11204011', '楊晴', '護理學系', 2, '護理二A', '#b5762c')
];

const admin = {
  id: 'U9001', username: 'admin', role: 'admin', name: '林美華', title: '教務處管理員',
  dept: '教務處', email: 'registrar@nqu.edu.tw', phone: '082-313-100', office: '行政大樓 2F',
  employeeNo: 'A9001', color: '#123a63', password: hash()
};

const syllabus = (name) => [
  { week: '第 1–2 週', topic: '課程導論、評量方式與學習目標' },
  { week: '第 3–6 週', topic: `${name}核心概念與基礎應用` },
  { week: '第 7–9 週', topic: '期中評量、案例討論與實作檢討' },
  { week: '第 10–14 週', topic: '進階主題、分組專題與同儕回饋' },
  { week: '第 15–18 週', topic: '期末成果發表、課程總結與反思' }
];

const course = (id, code, name, credits, type, dept, teacherId, room, schedule, capacity, enrolled, description, color) => ({
  id, code, name, credits, type, dept, teacherId, room, schedule, capacity, enrolled,
  description, color, semester: '115-1', syllabus: syllabus(name)
});

const courses = [
  course('C001', 'CS201', '資料結構', 3, 'required', '資訊工程學系', 'U1001', '理工大樓 E201',
    [{ day: 1, periods: [3, 4] }, { day: 3, periods: [3, 4] }], 60,
    ['S11301001', 'S11301002', 'S11301006', 'S11301007', 'S11301008', 'S11301012', 'S11301013'],
    '介紹陣列、鏈結串列、堆疊、佇列、樹與圖等資料結構，並以程式實作分析時間與空間複雜度。', '#2f6b9a'),
  course('C002', 'CS305', '資料庫系統', 3, 'required', '資訊工程學系', 'U1001', '理工大樓 E305',
    [{ day: 2, periods: [5, 6] }, { day: 4, periods: [5, 6] }], 55,
    ['S11301001', 'S11301002', 'S11301006', 'S11301007', 'S11301008', 'S11301012', 'S11301013'],
    '關聯式資料庫理論、SQL 語言、正規化、交易處理與資料庫設計實務。', '#2b7a78'),
  course('C003', 'CS410', '人工智慧導論', 3, 'elective', '資訊工程學系', 'U1005', '理工大樓 E401',
    [{ day: 3, periods: [7, 8] }, { day: 5, periods: [3, 4] }], 50,
    ['S11301001', 'S11301002', 'S11301006', 'S11301008', 'S11301013'],
    '從搜尋演算法、機器學習到深度學習，建立人工智慧的基礎觀念與應用能力。', '#8a5a9e'),
  course('C004', 'CS220', '網頁程式設計', 3, 'elective', '資訊工程學系', 'U1005', '理工大樓 E306',
    [{ day: 1, periods: [7, 8] }, { day: 4, periods: [7, 8] }], 50,
    ['S11301001', 'S11301002', 'S11301007', 'S11301008', 'S11301012', 'S11301013'],
    '以 HTML、CSS、JavaScript 與現代框架開發 responsive 網站，並實作 REST API 串接。', '#b5762c'),
  course('C005', 'BA201', '管理學', 3, 'required', '企業管理學系', 'U1002', '管理大樓 A201',
    [{ day: 2, periods: [3, 4] }, { day: 4, periods: [3, 4] }], 70,
    ['S11302003', 'S11302009', 'S11303004'],
    '介紹規劃、組織、領導與控制四大管理功能，並以金門在地企業案例進行討論。', '#b5762c'),
  course('C006', 'BA310', '行銷管理', 3, 'elective', '企業管理學系', 'U1002', '管理大樓 A303',
    [{ day: 3, periods: [5, 6] }], 55,
    ['S11302003', 'S11302009', 'S11303004'],
    '市場區隔、目標市場選擇、品牌定位與數位行銷策略的理論與實務。', '#8a5a9e'),
  course('C007', 'TM101', '觀光學概論', 3, 'required', '觀光管理學系', 'U1003', '管理大樓 B201',
    [{ day: 1, periods: [5, 6] }], 65,
    ['S11303004', 'S11302009'],
    '觀光產業結構、旅遊行為、目的地管理與金門觀光資源的個案分析。', '#2b7a78'),
  course('C008', 'TM220', '旅館管理', 3, 'elective', '觀光管理學系', 'U1003', '管理大樓 B305',
    [{ day: 2, periods: [7, 8] }], 45,
    ['S11303004', 'S11302009'],
    '旅館營運管理、客房與餐飲服務流程、服務品質與顧客關係管理。', '#b0506e'),
  course('C009', 'NR210', '基本護理學', 3, 'required', '護理學系', 'U1004', '健康大樓 C301',
    [{ day: 3, periods: [1, 2] }, { day: 5, periods: [1, 2] }], 50,
    ['S11204005', 'S11204011'],
    '護理專業核心概念、護理過程、基本技術與臨床案例演練。', '#b0506e'),
  course('C010', 'NR320', '社區護理學', 2, 'elective', '護理學系', 'U1004', '健康大樓 C302',
    [{ day: 4, periods: [1, 2] }], 45,
    ['S11204005', 'S11204011'],
    '以社區為基礎的健康照護、健康促進、弱勢族群關懷與在地健康營造。', '#6b7a3a'),
  course('C011', 'GE101', '大學國文', 2, 'required', '通識教育中心', 'U1006', '人文大樓 H101',
    [{ day: 1, periods: [1, 2] }], 80,
    ['S11301001', 'S11301002', 'S11303004', 'S11204005'],
    '透過經典閱讀與書寫練習，培養語文表達、批判思考與人文關懷。', '#6b7a3a'),
  course('C012', 'GE205', '資訊素養與倫理', 2, 'elective', '通識教育中心', 'U1007', '綜合大樓 R201',
    [{ day: 2, periods: [1, 2] }], 90,
    ['S11301001', 'S11302003', 'S11204005'],
    '資訊倫理、著作權、假訊息識讀、資料隱私與 AI 工具的正確使用。', '#5a6b8a'),
  course('C013', 'PE101', '體育（羽球）', 1, 'required', '體育室', 'U1008', '體育館 G201',
    [{ day: 5, periods: [5, 6] }], 40,
    ['S11301002', 'S11302003', 'S11303004', 'S11204005'],
    '羽球基本動作、規則、雙打戰術與運動安全觀念。', '#3f7a55'),
  course('C014', 'CS330', '專題製作（一）', 2, 'required', '資訊工程學系', 'U1001', '理工大樓 E402',
    [{ day: 5, periods: [7, 8] }], 30,
    ['S11301002', 'S11301006', 'S11301007', 'S11301008', 'S11301012'],
    '以團隊方式完成資訊系統專題，從需求訪談、系統設計到雛型實作與成果發表。', '#123a63')
];

const history = [
  ['114-1', '計算機概論', 3, '系必修', 88],
  ['114-1', '微積分（一）', 3, '系必修', 76],
  ['114-1', '英文（一）', 2, '通識', 85],
  ['114-1', '體育（一）', 1, '體育', 90],
  ['114-1', '程式設計實習', 2, '系必修', 92],
  ['114-2', '物件導向程式設計', 3, '系必修', 89],
  ['114-2', '線性代數', 3, '系必修', 71],
  ['114-2', '離散數學', 3, '系必修', 83],
  ['114-2', '英文（二）', 2, '通識', 79],
  ['114-2', '體育（二）', 1, '體育', 88],
  ['114-2', '網頁設計', 2, '系選修', 94],
  ['114-2', '服務學習', 1, '通識', 85]
].map(([semester, courseName, credits, category, score], i) => ({
  id: `G${String(i + 1).padStart(3, '0')}`, studentId: 'S11301001', courseId: null,
  semester, courseName, credits, category, score, teacherName: '校務系統匯入'
}));

const courseGrades = [
  ['C001', 'S11301001', 88, 82, null],
  ['C001', 'S11301002', 91, 76, null],
  ['C001', 'S11301006', 79, 68, null],
  ['C001', 'S11301007', 85, 80, null],
  ['C001', 'S11301008', 72, 55, 0],
  ['C001', 'S11301012', 93, 89, null],
  ['C001', 'S11301013', 86, 77, null],
  ['C002', 'S11301001', 90, 85, null],
  ['C002', 'S11301002', 84, 79, null],
  ['C003', 'S11301001', 92, 87, null],
  ['C004', 'S11301001', 95, 91, null]
].map(([courseId, studentId, regular, midterm, final]) => ({
  courseId, studentId, regular, midterm, final, updatedAt: daysAgo(6)
}));

const leaves = [
  {
    id: 'L001', studentId: 'S11301001', courseId: 'C002', type: '病假',
    startDate: daysFromNow(-12), endDate: daysFromNow(-12),
    reason: '因急性腸胃炎至金門醫院就診，附上診斷證明，申請病假一日。',
    status: 'approved', createdAt: daysAgo(13), reviewer: '林美華', reviewNote: '已核對診斷證明，准假。'
  },
  {
    id: 'L002', studentId: 'S11301001', courseId: 'C001', type: '事假',
    startDate: daysFromNow(3), endDate: daysFromNow(3),
    reason: '需返台陪同家人進行門診手術，申請事假一日。',
    status: 'pending', createdAt: daysAgo(1), reviewer: null, reviewNote: ''
  },
  {
    id: 'L003', studentId: 'S11301002', courseId: 'C004', type: '公假',
    startDate: daysFromNow(-4), endDate: daysFromNow(-3),
    reason: '代表學校參加全國大專院校程式設計競賽。',
    status: 'pending', createdAt: daysAgo(3), reviewer: null, reviewNote: ''
  }
];

const announcements = [
  {
    id: 'A001', title: '115學年度第1學期期中考週注意事項', category: '教務處',
    body: '期中考週將於第 9 週舉行，請同學依授課教師公告之考試時間與地點應試。\n\n一、考試期間請攜帶學生證，並放置於桌面左上角備查。\n二、因病無法應試者，請於考試前完成請假手續，並於一週內補繳證明。\n三、各科考試範圍與評量方式請洽授課教師或查閱課程大綱。\n\n教務處 敬啟', authorId: 'U9001', pinned: true, audience: 'all', createdAt: daysAgo(2)
  },
  {
    id: 'A002', title: '圖書館期中考週延長開放時間', category: '圖書館',
    body: '為因應期中考試需求，圖書館自 11 月 9 日至 11 月 20 日延長開放至晚間 11 時。\n\n2 樓自習室維持 24 小時開放，請同學共同維護閱覽品質，並隨身保管貴重物品。', authorId: 'U9001', pinned: false, audience: 'all', createdAt: daysAgo(4)
  },
  {
    id: 'A003', title: '114學年度第2學期書卷獎獲獎名單公告', category: '學務處',
    body: '114 學年度第 2 學期書卷獎獲獎名單已公告於學務處網頁，請獲獎同學於 11 月 30 日前至學務處簽領獎狀。\n\n如有疑義，請於公告日起 7 日內提出複查申請。', authorId: 'U9001', pinned: false, audience: 'all', createdAt: daysAgo(6)
  },
  {
    id: 'A004', title: '校園無線網路設備維護通知', category: '資訊處',
    body: '資訊處將於本週日 08:00–12:00 進行無線網路控制器維護，維護期間圖資大樓與管理大樓可能發生短暫斷線。\n\n造成不便，敬請見諒。', authorId: 'U9001', pinned: false, audience: 'all', createdAt: daysAgo(8)
  },
  {
    id: 'A005', title: '金門大學校園馬拉松志工招募', category: '學務處',
    body: '一年一度的金門大學校園馬拉松即將登場！即日起招募活動志工 30 名，提供服務時數與餐盒。\n\n報名請洽學務處課外活動組，額滿為止。', authorId: 'U9001', pinned: false, audience: 'all', createdAt: daysAgo(10)
  }
];

const requirements = [
  { id: 'R1', name: '系必修', required: 60 },
  { id: 'R2', name: '系選修', required: 24 },
  { id: 'R3', name: '通識', required: 28 },
  { id: 'R4', name: '體育', required: 4 },
  { id: 'R5', name: '自由選修', required: 12 }
];

const departments = [
  '資訊工程學系', '企業管理學系', '觀光管理學系', '護理學系',
  '華語文學系', '應用英語學系', '建築學系', '食品科學系', '通識教育中心', '體育室'
];

const periods = [
  { no: 1, time: '08:10–09:00' }, { no: 2, time: '09:10–10:00' },
  { no: 3, time: '10:10–11:00' }, { no: 4, time: '11:10–12:00' },
  { no: 5, time: '13:10–14:00' }, { no: 6, time: '14:10–15:00' },
  { no: 7, time: '15:10–16:00' }, { no: 8, time: '16:10–17:00' },
  { no: 9, time: '17:10–18:00' }, { no: 10, time: '18:30–19:20' },
  { no: 11, time: '19:25–20:15' }, { no: 12, time: '20:20–21:10' }
];

export function createSeedData() {
  return {
    meta: {
      schoolName: '國立金門大學', systemName: '校務行政系統', shortName: 'NQU Campus',
      semester: SEMESTER, semesterStart: '2026-09-14', semesterEnd: '2027-01-08',
      version: '1.0.0', departments, periods
    },
    users: [...teachers, ...students, admin],
    courses, grades: history, courseGrades, leaves, announcements, requirements,
    counters: { announcement: 6, leave: 4, grade: 13 },
    createdAt: new Date().toISOString()
  };
}

