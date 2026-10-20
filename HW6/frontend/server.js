const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'microservices',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'secret123',
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({
      status: 'ok',
      service: 'frontend-node',
      time: result.rows[0].time,
      db_version: result.rows[0].version,
    });
  } catch (err) {
    res.json({ status: 'ok', service: 'frontend-node', db_connected: false, error: err.message });
  }
});

app.get('/api/db/visits', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM visits ORDER BY created_at DESC LIMIT 20');
    res.json({ visits: result.rows });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.post('/api/db/visit', async (req, res) => {
  const { service, message } = req.body || {};
  try {
    await pool.query('INSERT INTO visits (service, message) VALUES ($1, $2)', [service, message]);
    res.json({ ok: true });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});
