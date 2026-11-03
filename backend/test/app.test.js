// Unit test backend memakai test runner bawaan Node (node --test) + supertest.
// Test ini tidak butuh database: semua request di bawah ditolak oleh validasi
// sebelum menyentuh MySQL.
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const {
  app,
  db,
  validateTitle,
  validatePriority,
  validateDueDate,
  toCSV,
  parseCSV,
  normalizeImportRow,
  escapeLike,
} = require('../index');

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

// ---------------------------------------------------------------- Update 4: export dan import

test('GET /todos/export dengan format tidak dikenal ditolak', async () => {
  const res = await request(app).get('/todos/export?format=xml');
  assert.strictEqual(res.status, 400);
});

test('POST /todos/import dengan body kosong ditolak', async () => {
  const res = await request(app).post('/todos/import').send({});
  assert.strictEqual(res.status, 400);
});

test('POST /todos/import menyebut nomor baris yang salah', async () => {
  const res = await request(app)
    .post('/todos/import')
    .send([{ title: 'Benar' }, { title: '' }]);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Row 2: Title is required');
});

test('POST /todos/import CSV tanpa kolom title ditolak', async () => {
  const res = await request(app)
    .post('/todos/import')
    .set('Content-Type', 'text/csv')
    .send('nama,prioritas\nBelajar,high\n');
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /title/);
});

test('toCSV memberi kutip pada koma, kutip, dan baris baru', () => {
  const csv = toCSV([
    { id: 1, title: 'Beli kopi, gula', completed: 1, priority: 'low', due_date: null, created_at: null },
    { id: 2, title: 'Kata "penting"\nbaris dua', completed: 0, priority: 'high', due_date: '2026-11-02', created_at: null },
  ]);
  const lines = csv.split('\r\n');
  assert.strictEqual(lines[0], 'id,title,completed,priority,due_date,created_at');
  assert.strictEqual(lines[1], '1,"Beli kopi, gula",true,low,,');
  assert.ok(csv.includes('"Kata ""penting""\nbaris dua"'));
});

test('toCSV mencegah CSV injection dengan awalan kutip satu', () => {
  const csv = toCSV([{ id: 1, title: '=SUM(A1:A2)', completed: 0, priority: 'low', due_date: null, created_at: null }]);
  assert.ok(csv.includes(",'=SUM(A1:A2),"));
});

test('parseCSV membaca hasil toCSV kembali dengan utuh', () => {
  const original = [
    { id: 1, title: 'Beli kopi, gula', completed: 1, priority: 'low', due_date: null, created_at: null },
    { id: 2, title: 'Kata "penting"\nbaris dua', completed: 0, priority: 'high', due_date: '2026-11-02', created_at: null },
    { id: 3, title: '-catatan minus', completed: 0, priority: 'medium', due_date: null, created_at: null },
  ];
  const records = parseCSV('﻿' + toCSV(original));
  assert.strictEqual(records.length, 3);
  const rows = records.map((r) => normalizeImportRow(r).value);
  assert.deepStrictEqual(rows[0], ['Beli kopi, gula', true, 'low', null]);
  assert.deepStrictEqual(rows[1], ['Kata "penting"\nbaris dua', false, 'high', '2026-11-02']);
  assert.deepStrictEqual(rows[2], ['-catatan minus', false, 'medium', null]);
});

test('parseCSV menerima kolom tanpa urutan tetap dan huruf besar', () => {
  const records = parseCSV('Priority,TITLE\r\nHIGH,Belajar\r\n\r\n,Tanpa prioritas\r\n');
  assert.deepStrictEqual(records.map((r) => normalizeImportRow(r).value), [
    ['Belajar', false, 'high', null],
    ['Tanpa prioritas', false, 'medium', null],
  ]);
});

test('normalizeImportRow menolak nilai completed yang aneh', () => {
  assert.match(normalizeImportRow({ title: 'x', completed: 'mungkin' }).error, /completed/);
});

test('POST /todos/import dengan JSON rusak dijawab 400 berformat JSON', async () => {
  const res = await request(app)
    .post('/todos/import')
    .set('Content-Type', 'application/json')
    .send('{"todos": [ rusak');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'The request body is not valid JSON');
});

// ---------------------------------------------------------------- Update 5: pencarian

test('GET /todos?q= tetap memvalidasi status', async () => {
  const res = await request(app).get('/todos?q=docker&status=semua');
  assert.strictEqual(res.status, 400);
});

test('escapeLike membuat % dan _ dicari sebagai huruf biasa', () => {
  assert.strictEqual(escapeLike('100%'), '100\\%');
  assert.strictEqual(escapeLike('nama_file'), 'nama\\_file');
  assert.strictEqual(escapeLike('a\\b'), 'a\\\\b');
  assert.strictEqual(escapeLike('docker'), 'docker');
});
