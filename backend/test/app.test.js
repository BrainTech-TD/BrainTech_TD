// Unit test backend memakai test runner bawaan Node (node --test) + supertest.
// Test ini tidak butuh database: semua request di bawah ditolak oleh validasi
// sebelum menyentuh MySQL.
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app, db, validateTitle, validatePriority, validateDueDate } = require('../index');

after(() => db.end());

// ---------------------------------------------------------------- Endpoint dasar

test('GET /health mengembalikan status ok', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { status: 'ok' });
});

test('POST /todos tanpa title ditolak dengan 400', async () => {
  const res = await request(app).post('/todos').send({});
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Title is required');
});

test('route yang tidak ada mengembalikan 404', async () => {
  const res = await request(app).get('/tidak-ada');
  assert.strictEqual(res.status, 404);
});

// ---------------------------------------------------------------- Update 1: filter + hapus yang selesai

test('GET /todos dengan status tidak dikenal ditolak', async () => {
  const res = await request(app).get('/todos?status=semua');
  assert.strictEqual(res.status, 400);
});

test('DELETE /todos tanpa ?status=done ditolak supaya tidak menghapus semua', async () => {
  const res = await request(app).delete('/todos');
  assert.strictEqual(res.status, 400);
});

// ---------------------------------------------------------------- Update 2: prioritas, deadline, edit

test('POST /todos dengan title berisi spasi saja ditolak', async () => {
  const res = await request(app).post('/todos').send({ title: '   ' });
  assert.strictEqual(res.status, 400);
});

test('POST /todos dengan prioritas tidak dikenal ditolak', async () => {
  const res = await request(app).post('/todos').send({ title: 'Belajar', priority: 'urgent' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Priority/);
});

test('POST /todos dengan format tanggal salah ditolak', async () => {
  const res = await request(app).post('/todos').send({ title: 'Belajar', due_date: '30/10/2026' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /YYYY-MM-DD/);
});

test('PATCH /todos/:id tanpa field apa pun ditolak', async () => {
  const res = await request(app).patch('/todos/1').send({});
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Nothing to update/);
});

test('PATCH /todos/:id dengan title kosong ditolak', async () => {
  const res = await request(app).patch('/todos/1').send({ title: '' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Title is required');
});

test('PATCH /todos/:id dengan id bukan angka ditolak', async () => {
  const res = await request(app).patch('/todos/abc').send({ title: 'x' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid id');
});

test('validatePriority hanya menerima low, medium, high', () => {
  for (const p of ['low', 'medium', 'high']) assert.strictEqual(validatePriority(p).value, p);
  assert.ok(validatePriority('HIGH').error);
  assert.ok(validatePriority(undefined).error);
});

test('validateDueDate menerima tanggal valid dan kosong', () => {
  assert.strictEqual(validateDueDate('2026-10-30').value, '2026-10-30');
  assert.strictEqual(validateDueDate('2028-02-29').value, '2028-02-29'); // tahun kabisat
  assert.strictEqual(validateDueDate('').value, null);
  assert.strictEqual(validateDueDate(null).value, null);
});

test('validateDueDate menolak tanggal yang tidak ada', () => {
  assert.ok(validateDueDate('2026-02-30').error);
  assert.ok(validateDueDate('2026-13-01').error);
  assert.ok(validateDueDate('2027-02-29').error); // bukan tahun kabisat
});

test('validateTitle membuang spasi di awal dan akhir, dan membatasi panjang', () => {
  assert.strictEqual(validateTitle('  Belajar Docker  ').value, 'Belajar Docker');
  assert.ok(validateTitle('a'.repeat(256)).error);
  assert.ok(validateTitle(123).error);
});
