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
});

const STATUSES = ['all', 'active', 'done'];

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
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/todos', (req, res) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required' });
  db.query('INSERT INTO todos (title) VALUES (?)', [title], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: result.insertId, title, completed: false });
  });
});

app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  db.query('UPDATE todos SET completed = NOT completed WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Updated' });
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

app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM todos WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// Server hanya listen kalau file dijalankan langsung (node index.js),
// sehingga test bisa memakai `app` tanpa membuka port.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log('Backend running on port ' + PORT));
}

module.exports = { app, db };
