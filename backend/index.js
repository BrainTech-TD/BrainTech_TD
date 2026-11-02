const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

const STATUSES = ['all', 'active', 'done'];
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

// ---------------------------------------------------------------- Routes

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Daftar todo. Opsional: ?status=all|active|done
app.get('/todos', (req, res) => {
  const status = req.query.status || 'all';
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  }
  let where = '';
  if (status === 'active') where = ' WHERE completed = FALSE';
  if (status === 'done') where = ' WHERE completed = TRUE';
  db.query(`SELECT * FROM todos${where} ORDER BY created_at DESC, id DESC`, (err, results) => {
  db.query(`${SELECT_TODO}${where} ORDER BY created_at DESC, id DESC`, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
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
};
