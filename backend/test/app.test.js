// Unit test backend memakai test runner bawaan Node (node --test) + supertest.
// Test ini tidak butuh database: semua request di bawah ditolak oleh validasi
// sebelum menyentuh MySQL.
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app, db } = require('../index');

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
