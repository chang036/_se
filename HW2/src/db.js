import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeedData } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DB_FILE = path.join(ROOT, 'data', 'db.json');

export class Database {
  constructor(file = process.env.DB_FILE || DEFAULT_DB_FILE) {
    this.file = file;
    this.data = null;
  }

  load() {
    if (this.data) return this.data;
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        return this.data;
      } catch (err) {
        console.warn(`[db] 無法讀取 ${this.file}，將重新建立種子資料：${err.message}`);
      }
    }
    this.data = createSeedData();
    this.save();
    return this.data;
  }

  save() {
    if (!this.data) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    try {
      fs.renameSync(tmp, this.file);
    } catch {
      fs.copyFileSync(tmp, this.file);
      fs.rmSync(tmp, { force: true });
    }
  }

  reset() {
    this.data = createSeedData();
    this.save();
    return this.data;
  }
}
