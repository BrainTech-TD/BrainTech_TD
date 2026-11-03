const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
// Batas 1 MB supaya import file JSON/CSV berisi ratusan todo tetap muat.
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '1mb' }));

// Semua konfigurasi diambil dari environment variable (diisi lewat .env / docker compose).
const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tododb',
  waitForConnections: true,
  connectionLimit: 10,
  // Kolom DATE dikirim apa adanya sebagai 'YYYY-MM-DD', tanpa konversi zona waktu.
  dateStrings: ['DATE'],
});

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['all', 'active', 'done'];
const MAX_TITLE = 255;

// ---------------------------------------------------------------- Validasi input

// Mengembalikan judul yang sudah di-trim, atau pesan error.
function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return { error: 'Title is required' };
  const clean = title.trim();
  if (clean.length > MAX_TITLE) return { error: `Title must be at most ${MAX_TITLE} characters` };
  return { value: clean };
}

function validatePriority(priority) {
  if (!PRIORITIES.includes(priority)) {
    return { error: `Priority must be one of: ${PRIORITIES.join(', ')}` };
  }
  return { value: priority };
}

// Deadline boleh kosong (null / ''), atau tanggal valid berformat YYYY-MM-DD.
function validateDueDate(dueDate) {
  if (dueDate === null || dueDate === undefined || dueDate === '') return { value: null };
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: 'Due date must use the format YYYY-MM-DD' };
  }
  const [y, m, d] = dueDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid) return { error: 'Due date is not a valid date' };
  return { value: dueDate };
}

function isValidId(id) {
  return /^\d+$/.test(id);
}

const SELECT_TODO = 'SELECT id, title, completed, priority, due_date, created_at FROM todos';

// ---------------------------------------------------------------- CSV dan import

const MAX_IMPORT = 500;
const CSV_COLUMNS = ['id', 'title', 'completed', 'priority', 'due_date', 'created_at'];

// Nilai yang diawali = + - @ bisa dijalankan sebagai rumus oleh Excel (CSV injection),
// jadi diberi awalan ' saat export dan awalan itu dibuang lagi saat import.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCSV(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvField(c === 'completed' ? Boolean(row[c]) : row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// Parser CSV sederhana: mendukung tanda kutip, koma dan baris baru di dalam kutip, CRLF, dan BOM.
function parseCSV(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (inQuotes) throw new Error('CSV has an unclosed quote');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  if (!header.includes('title')) throw new Error('CSV must have a "title" column in the first row');
  return nonEmpty.slice(1).map((cells) => {
    const record = {};
    header.forEach((name, idx) => { record[name] = cells[idx] === undefined ? '' : cells[idx]; });
    return record;
  });
}

function parseCompleted(value) {
  if (value === undefined || value === null || value === '') return { value: false };
  if (typeof value === 'boolean') return { value };
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'done'].includes(text)) return { value: true };
  if (['false', '0', 'no', 'n', 'active'].includes(text)) return { value: false };
  return { error: 'completed must be true or false' };
}

function unescapeFormula(value) {
  return typeof value === 'string' && /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

// Ubah satu baris data import menjadi [title, completed, priority, due_date], atau pesan error.
function normalizeImportRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Each item must be an object' };
  const title = validateTitle(unescapeFormula(raw.title));
  if (title.error) return { error: title.error };
  const completed = parseCompleted(raw.completed);
  if (completed.error) return { error: completed.error };
  const rawPriority = typeof raw.priority === 'string' ? raw.priority.trim().toLowerCase() : raw.priority;
  const priority = validatePriority(rawPriority === undefined || rawPriority === '' ? 'medium' : rawPriority);
  if (priority.error) return { error: priority.error };
  const rawDue = typeof raw.due_date === 'string' ? raw.due_date.trim() : raw.due_date;
  const dueDate = validateDueDate(rawDue);
  if (dueDate.error) return { error: dueDate.error };
  return { value: [title.value, completed.value, priority.value, dueDate.value] };
}

// Ambil daftar item dari body request (JSON array, JSON hasil export, atau teks CSV).
function readImportBody(req) {
  if (typeof req.body === 'string') return parseCSV(req.body);
  if (Array.isArray(req.body)) return req.body;
  if (req.body && Array.isArray(req.body.todos)) return req.body.todos;
  throw new Error('Send a JSON array, an exported JSON file, or a CSV file');
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------- Routes

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Daftar todo. Opsional: ?status=all|active|done dan ?q=kata (cari di judul)
app.get('/todos', (req, res) => {
  const status = req.query.status || 'all';
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  }
  const conditions = [];
  const values = [];
  if (status === 'active') conditions.push('completed = FALSE');
  if (status === 'done') conditions.push('completed = TRUE');
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    conditions.push("title LIKE ? ESCAPE '\\\\'");
    values.push(`%${escapeLike(q)}%`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  db.query(`${SELECT_TODO}${where} ORDER BY created_at DESC, id DESC`, values, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Export semua todo: ?format=json (default) atau ?format=csv
app.get('/todos/export', (req, res) => {
  const format = req.query.format || 'json';
  if (!['json', 'csv'].includes(format)) {
    return res.status(400).json({ error: 'Format must be json or csv' });
  }
  db.query(`${SELECT_TODO} ORDER BY created_at DESC, id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="todos-${stamp}.${format}"`);
    if (format === 'csv') {
      res.type('text/csv; charset=utf-8').send('﻿' + toCSV(rows));
    } else {
      const todos = rows.map((r) => ({ ...r, completed: Boolean(r.completed) }));
      res.json({ exported_at: new Date().toISOString(), count: todos.length, todos });
    }
  });
});

// Import todo dari file export (JSON) atau CSV. Data ditambahkan, tidak menimpa yang lama.
// Semua baris divalidasi dulu; kalau ada satu yang salah, tidak ada yang disimpan.
app.post('/todos/import', (req, res) => {
  let items;
  try {
    items = readImportBody(req);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (items.length === 0) return res.status(400).json({ error: 'The file has no todos to import' });
  if (items.length > MAX_IMPORT) {
    return res.status(400).json({ error: `Import at most ${MAX_IMPORT} todos at a time` });
  }
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const result = normalizeImportRow(items[i]);
    if (result.error) return res.status(400).json({ error: `Row ${i + 1}: ${result.error}` });
    rows.push(result.value);
  }
  db.query('INSERT INTO todos (title, completed, priority, due_date) VALUES ?', [rows], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ imported: result.affectedRows });
  });
});

// Tambah todo: { title, priority?, due_date? }
app.post('/todos', (req, res) => {
  const body = req.body || {};
  const title = validateTitle(body.title);
  if (title.error) return res.status(400).json({ error: title.error });
  const priority = validatePriority(body.priority === undefined ? 'medium' : body.priority);
  if (priority.error) return res.status(400).json({ error: priority.error });
  const dueDate = validateDueDate(body.due_date);
  if (dueDate.error) return res.status(400).json({ error: dueDate.error });

  db.query(
    'INSERT INTO todos (title, priority, due_date) VALUES (?, ?, ?)',
    [title.value, priority.value, dueDate.value],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: result.insertId,
        title: title.value,
        completed: false,
        priority: priority.value,
        due_date: dueDate.value,
      });
    }
  );
});

// Tandai selesai / batal (toggle)
app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  db.query('UPDATE todos SET completed = NOT completed WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ message: 'Updated' });
  });
});

// Edit todo: kirim satu atau lebih field { title, priority, due_date }
app.patch('/todos/:id', (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  const body = req.body || {};
  const sets = [];
  const values = [];

  if (body.title !== undefined) {
    const title = validateTitle(body.title);
    if (title.error) return res.status(400).json({ error: title.error });
    sets.push('title = ?');
    values.push(title.value);
  }
  if (body.priority !== undefined) {
    const priority = validatePriority(body.priority);
    if (priority.error) return res.status(400).json({ error: priority.error });
    sets.push('priority = ?');
    values.push(priority.value);
  }
  if (body.due_date !== undefined) {
    const dueDate = validateDueDate(body.due_date);
    if (dueDate.error) return res.status(400).json({ error: dueDate.error });
    sets.push('due_date = ?');
    values.push(dueDate.value);
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: 'Nothing to update: send title, priority or due_date' });
  }

  db.query(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, [...values, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Todo not found' });
    db.query(`${SELECT_TODO} WHERE id = ?`, [id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(rows[0]);
    });
  });
});

// Hapus semua todo yang sudah selesai. Wajib ?status=done supaya tidak terhapus semua tanpa sengaja.
app.delete('/todos', (req, res) => {
  if (req.query.status !== 'done') {
    return res.status(400).json({ error: 'Only completed todos can be bulk deleted: use ?status=done' });
  }
  db.query('DELETE FROM todos WHERE completed = TRUE', (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: result.affectedRows });
  });
});

// Hapus satu todo
app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  db.query('DELETE FROM todos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ message: 'Deleted' });
  });
});

// Body request yang rusak (JSON tidak valid) atau terlalu besar dijawab dengan JSON, bukan halaman HTML.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The file is too large (max 1 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------- Migrasi database
//
// init.sql hanya dijalankan MySQL saat volume data masih kosong. Database yang
// sudah berjalan (misalnya di VPS) tidak ikut berubah, jadi kolom baru ditambahkan
// di sini setiap kali backend start. Aman dijalankan berulang kali.

const NEW_COLUMNS = [
  { name: 'priority', ddl: "ALTER TABLE todos ADD COLUMN priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium'" },
  { name: 'due_date', ddl: 'ALTER TABLE todos ADD COLUMN due_date DATE NULL DEFAULT NULL' },
];

async function migrate(pool = db.promise()) {
  await pool.query(`CREATE TABLE IF NOT EXISTS todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'todos'"
  );
  const existing = new Set(rows.map((r) => r.name));
  const added = [];
  for (const col of NEW_COLUMNS) {
    if (!existing.has(col.name)) {
      await pool.query(col.ddl);
      added.push(col.name);
    }
  }
  return added;
}

// Database bisa belum siap saat container backend baru menyala, jadi dicoba ulang.
async function migrateWithRetry(attempts = 30, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await migrate();
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`Database not ready (${err.code || err.message}), retry ${i}/${attempts}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return [];
}

// Server hanya listen kalau file dijalankan langsung (node index.js),
// sehingga test bisa memakai `app` tanpa membuka port dan tanpa database.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  migrateWithRetry()
    .then((added) => {
      console.log(added.length ? `Migration: added column(s) ${added.join(', ')}` : 'Migration: schema up to date');
      app.listen(PORT, () => console.log('Backend running on port ' + PORT));
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  app,
  db,
  migrate,
  validateTitle,
  validatePriority,
  validateDueDate,
  toCSV,
  parseCSV,
  normalizeImportRow,
  escapeLike,
};
