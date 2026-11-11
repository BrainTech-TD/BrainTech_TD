# BrainTech_TD

Aplikasi Todo (React + Express + MySQL 8) yang dijalankan sebagai tiga container terpisah, dengan pipeline CI/CD di GitHub Actions: test, build image, push ke Docker Hub dan GitHub Container Registry, lalu deploy ke VPS.

Aplikasi dasarnya berasal dari [AddyKhan257/To-Do-App](https://github.com/AddyKhan257/To-Do-App), kemudian dimodifikasi untuk kebutuhan DevOps (Dockerfile per service, reverse proxy nginx, unit test, compose produksi, dan workflow CI/CD).

## Fitur

| Fitur | Keterangan |
|---|---|
| Kelola todo (CRUD) | Tambah, lihat, edit (judul, prioritas, deadline), tandai selesai, dan hapus todo |
| Filter dan penghitung | Tab All / Active / Done dengan jumlah masing-masing, progress bar, dan tombol "Clear completed" |
| Prioritas dan deadline | Prioritas Low / Medium / High dan tanggal deadline opsional. Todo yang lewat deadline ditandai Overdue |
| Halaman dan urutan | Navigasi samping ke halaman Today (jatuh tempo hari ini dan overdue), Upcoming, dan All tasks. Urutkan berdasarkan terbaru, deadline, atau prioritas |
| Pencarian | Kolom cari di samping tab filter. Kata yang cocok disorot, Esc untuk mengosongkan |
| Export dan import | Tombol di pojok kanan atas. Export ke JSON (backup) atau CSV (Excel), import dari JSON hasil export atau CSV dengan kolom `title` |
| Mode gelap | Tombol di bagian bawah navigasi. Tanpa pilihan, tema mengikuti pengaturan sistem; pilihan disimpan di browser |

## Struktur kode frontend

Setiap fitur punya komponen dan file CSS sendiri, jadi mudah dicari:

| Fitur | Komponen | CSS |
|---|---|---|
| Filter dan penghitung | `components/FilterTabs.js` | `styles/filter.css` |
| Prioritas, deadline, edit | `components/PriorityPicker.js`, `components/TodoItem.js`, `utils.js` | `styles/priority.css` |
| Sidebar dan urutan | `components/Sidebar.js`, `components/SortSelect.js`, `pages.js` | `styles/sidebar.css` |
| Export dan import | `components/DataMenu.js` | `styles/data-menu.css` |
| Pencarian | `components/SearchBox.js` | `styles/search.css` |
| Mode gelap | `components/ThemeToggle.js` | `styles/dark.css` |

`App.js` menyusun semua komponen, `App.css` berisi token warna dan tampilan dasar.

## API

Semua endpoint diakses lewat nginx dengan awalan `/api`, misalnya `http://localhost:3000/api/todos`.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Cek backend hidup |
| GET | `/todos?status=all\|active\|done&q=kata` | Daftar todo, bisa difilter dan dicari berdasarkan judul |
| GET | `/todos/export?format=json\|csv` | Unduh semua todo sebagai JSON atau CSV |
| POST | `/todos/import` | Tambah banyak todo sekaligus dari JSON (array atau hasil export) atau CSV (`Content-Type: text/csv`). Maksimal 500 baris; kalau satu baris salah, tidak ada yang disimpan |
| POST | `/todos` | Tambah todo: `{ "title", "priority"?, "due_date"? }` |
| PUT | `/todos/:id` | Tandai selesai / batal |
| PATCH | `/todos/:id` | Edit satu atau lebih field: `title`, `priority`, `due_date` |
| DELETE | `/todos/:id` | Hapus satu todo |
| DELETE | `/todos?status=done` | Hapus semua todo yang sudah selesai |

`priority` bernilai `low`, `medium` (default), atau `high`. `due_date` berformat `YYYY-MM-DD` atau `null`.

Contoh CSV untuk import (baris pertama wajib berisi nama kolom, urutan kolom bebas):

```csv
title,priority,due_date,completed
"Baca bab 4, bagian 2",high,2026-11-05,no
Pesan ruang belajar,low,,yes
```

Saat export ke CSV, judul yang diawali `=`, `+`, `-`, atau `@` diberi awalan `'` supaya tidak dijalankan sebagai rumus oleh Excel. Awalan itu dibuang lagi saat file diimport.

## Migrasi database

`mysql/init.sql` hanya dijalankan MySQL saat volume data masih kosong. Database yang sudah berjalan, misalnya di VPS, tidak ikut berubah. Karena itu backend menjalankan migrasi setiap kali start: kalau kolom `priority` atau `due_date` belum ada, kolom tersebut ditambahkan dengan `ALTER TABLE`. Data lama tetap utuh dan mendapat prioritas `medium` tanpa deadline. Hasilnya terlihat di log backend:

```
Migration: added column(s) priority, due_date
```

atau `Migration: schema up to date` kalau skema sudah sesuai.

## Arsitektur

```
Browser ──> frontend (nginx :80) ──/api/──> backend (Express :5000) ──> mysql (:3306)
```

Hanya container frontend yang membuka port ke luar. Backend dan MySQL hanya bisa diakses dari jaringan internal container.

| Service | Folder | Image dasar |
|---|---|---|
| frontend | `frontend/` | node:22-alpine (build), nginx:stable-alpine (runtime) |
| backend | `backend/` | node:22-alpine |
| mysql | `mysql/` | mysql:8.4 |

## Menjalankan di laptop

Docker:

```bash
docker compose up -d --build
docker compose ps
```

Podman:

```bash
podman compose up -d --build
```

Buka http://localhost:3000. Hentikan dengan `docker compose down` (tambah `-v` untuk menghapus data).

Unit test backend:

```bash
cd backend && npm ci && npm test
```

## Pipeline CI/CD

File: `.github/workflows/ci-cd.yml`

| Pemicu | Yang dijalankan |
|---|---|
| Pull request ke `main` | unit test backend, build frontend, integration test |
| Push ke `main` / Run workflow | semua di atas, lalu build & push 3 image, lalu deploy (kalau `DEPLOY_ENABLED=true`) |

Image hasil build:

- `docker.io/<DOCKERHUB_USERNAME>/todo-frontend`, `todo-backend`, `todo-mysql`
- `ghcr.io/al03xu/todo-frontend`, `todo-backend`, `todo-mysql`

Setiap image diberi tag `latest` dan `sha-<7 karakter commit>`.

Secrets yang dibutuhkan: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, dan untuk deploy `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

## Deploy ke VPS

Aplikasi sudah di-deploy ke VPS dan bisa dibuka di sini:

*http://103.119.237.106:30044/*

Setiap push ke branch main yang lolos pipeline akan otomatis memperbarui aplikasi di VPS.