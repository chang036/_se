import { Database } from '../src/db.js';

const db = new Database(process.env.DB_FILE);
const data = db.reset();
console.log(`已重設資料庫：${db.file}`);
console.log(`使用者 ${data.users.length} 位、課程 ${data.courses.length} 門、公告 ${data.announcements.length} 則`);
console.log('示範帳號：s11301001 / t1001 / admin，密碼皆為 123456');
