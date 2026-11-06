import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Database } from './src/db.js';
import { SessionStore } from './src/auth.js';
import { handleApi } from './src/api.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'");
}

async function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }
  if (decoded.includes('\0')) {
    res.writeHead(400);
    return res.end();
  }
  let filePath = path.resolve(PUBLIC_DIR, '.' + (decoded === '/' ? '/index.html' : decoded));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  } catch {
    if (!path.extname(decoded)) {
      try {
        const body = await fs.promises.readFile(path.join(PUBLIC_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        return res.end(body);
      } catch {
        // fall through
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

export function createApp(options = {}) {
  const db = new Database(options.dbFile);
  db.load();
  const sessions = options.sessions || new SessionStore();

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    const host = req.headers.host || 'localhost';
    let url;
    try {
      url = new URL(req.url || '/', `http://${host}`);
    } catch {
      res.writeHead(400);
      return res.end();
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, { db, sessions });
      return;
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('405 Method Not Allowed');
    }
    await serveStatic(req, res, url.pathname);
  });

  server.db = db;
  server.sessions = sessions;
  return server;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const server = createApp();
  server.listen(port, () => {
    console.log('');
    console.log('  ╭──────────────────────────────────────────────╮');
    console.log('  │   金門大學風格校務系統 · NQU Campus Demo     │');
    console.log('  ╰──────────────────────────────────────────────╯');
    console.log(`  網址：http://localhost:${port}`);
    console.log('');
    console.log('  示範帳號（密碼皆為 123456）');
    console.log('    學生：s11301001');
    console.log('    教師：t1001');
    console.log('    管理員：admin');
    console.log('');
  });
}
