# 🎫 Ticketing SLA

> **Sistem Ticketing, Field Service, SLA Respond, dan SLA Pengerjaan**

Monorepo full-stack berbasis **NestJS** (backend) dan **React/Vite** (frontend) untuk manajemen tiket layanan lapangan, penugasan teknisi multi-assign, monitoring SLA respond & pengerjaan, serta pelaporan dan notifikasi terintegrasi.

[![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-22.x-brightgreen.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-private-red.svg)]()

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi](#-teknologi)
- [Struktur Repository](#-struktur-repository)
- [Prasyarat](#-prasyarat)
- [Menjalankan dengan Docker (Cara Cepat)](#-menjalankan-dengan-docker-cara-cepat)
- [Menjalankan Secara Lokal](#-menjalankan-secara-lokal)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Perintah Penting](#-perintah-penting)
- [Akun & Data Demo](#-akun--data-demo)
- [Akses Aplikasi](#-akses-aplikasi)
- [Akses LAN dengan Hostname](#-akses-lan-dengan-hostname)
- [Status Implementasi](#-status-implementasi)
- [Changelog](#-changelog)

---

## ✨ Fitur Utama

| Modul | Deskripsi |
|---|---|
| 🌐 **Public Complaint** | Portal pengaduan publik berbasis QR code dengan multi-upload media |
| 🔐 **Autentikasi & RBAC** | JWT rotating refresh token, role Administrator/Head/Technician, approval & password sementara |
| 🎫 **Manajemen Ticket** | Lifecycle ticket lengkap: PENDING → IN_PROGRESS → COMPLETED, reschedule & resume |
| 👷 **Field Operations** | Check-in GPS, start work, completion, dan bukti foto/video oleh teknisi |
| 👥 **Multi-Assignment** | Penugasan beberapa teknisi sekaligus pada satu ticket |
| ⏱️ **SLA Monitoring** | SLA Respond & SLA Pengerjaan per teknisi dengan scheduler, warning, breach, dan historisasi |
| 📧 **Notifikasi & Email** | Notifikasi in-app + email HTML ke Head/Admin saat ticket baru masuk (via SMTP/Nodemailer) |
| 📊 **Dashboard & Report** | Dashboard ringkasan, laporan, dan export Excel (ExcelJS) |
| 🔍 **Audit Trail** | Log perubahan status dan aksi pada setiap ticket |
| 🏥 **Health Check** | Endpoint `/health/live` dan `/health/ready` untuk monitoring deployment |

---

## 🛠️ Teknologi

### Backend (`apps/api`)

| Teknologi | Versi | Kegunaan |
|---|---|---|
| **NestJS** | `^10.4` | REST API framework (modular, DI, Guard) |
| **Prisma** | `^6.6` | ORM + schema database + migration |
| **PostgreSQL** | `16` | Database relasional utama |
| **JWT + Passport** | `^10.2` | Autentikasi access & refresh token |
| **Nodemailer** | `^9.0` | Pengiriman email notifikasi via SMTP |
| **ExcelJS** | `^4.4` | Export laporan ke format Excel |
| **Multer** | `^1.4` | Upload file/foto/video |
| **Vercel Blob** | `^2.8` | Storage media production (opsional) |
| **Helmet** | `^8.1` | Security headers HTTP |
| **Swagger** | `^8.1` | Dokumentasi API otomatis |
| **Throttler** | `^6.4` | Rate limiting per endpoint |

### Frontend (`apps/web`)

| Teknologi | Versi | Kegunaan |
|---|---|---|
| **React** | `^18` | UI framework |
| **Vite** | `^5` | Build tool & dev server |
| **TypeScript** | `5.8.3` | Type safety |
| **Tailwind CSS** | `^3` | Utility-first CSS framework |
| **TanStack Query** | `^5` | Server state & data fetching |
| **React Router** | `^6` | Routing SPA |

### Shared (`packages/contracts`)

- **TypeScript interfaces** — DTO request/response bersama antara API dan Web
- **Enums standar** — `TicketStatus`, `Role`, dsb.

### Infrastruktur

- **Docker Compose** + **Nginx** — deployment container siap pakai
- **Vercel** — deployment cloud (API + Web)
- **TLS/HTTPS** — sertifikat lokal untuk LAN

---

## 📁 Struktur Repository

```text
ticketing-sla/
├── apps/
│   ├── api/                          # Backend REST API
│   │   ├── prisma/                   # Schema database, seed, dan migration
│   │   └── src/
│   │       ├── config/               # Validasi environment & variabel global
│   │       ├── database/             # Prisma service & transaksi
│   │       ├── common/               # Guard, interceptor, decorator, exception filter
│   │       └── modules/              # Domain-driven feature modules
│   │           ├── auth/             # JWT autentikasi & RBAC
│   │           ├── tickets/          # Lifecycle ticket & rescue/reschedule
│   │           ├── assignments/      # Multi-assign teknisi per ticket
│   │           ├── field-operations/ # Check-in GPS, start, completion
│   │           ├── sla/              # SLA respond & pengerjaan + scheduler
│   │           ├── technicians/      # Profil & approval akun teknisi
│   │           ├── media/            # Upload & validasi foto/video
│   │           ├── notifications/    # Notifikasi in-app
│   │           ├── email/            # Notifikasi email via SMTP (Nodemailer)
│   │           ├── reports/          # Laporan & export Excel
│   │           ├── audit/            # Audit trail aksi ticket
│   │           ├── master-data/      # Data master (client, site, kategori, prioritas)
│   │           └── health/           # Health check endpoint
│   │
│   └── web/                          # Frontend Web SPA
│       └── src/
│           ├── api/                  # Axios client & central API caller
│           ├── components/           # Reusable UI components
│           ├── features/             # Business logic modular (slice)
│           ├── hooks/                # Custom React hooks
│           ├── pages/
│           │   ├── admin/            # Dashboard, laporan, manajemen (Admin/Head)
│           │   ├── technician/       # Operasional, task, check-in (Teknisi)
│           │   └── public/           # Portal klien (complaint & tracking)
│           ├── routes/               # Konfigurasi & proteksi React Router
│           ├── store/                # Global state lokal
│           ├── types/                # Type internal frontend
│           └── utils/                # Utilitas (formatter, konversi, dsb.)
│
├── packages/
│   └── contracts/                    # Shared TypeScript DTO & enums (monorepo)
│
├── infra/
│   └── nginx/                        # Konfigurasi reverse proxy Docker
│
├── scripts/                          # Script automasi developer
│   ├── setup.sh / setup.ps1          # Inisialisasi environment otomatis
│   ├── docker-seed.ps1               # Inject data demo ke database Docker
│   ├── docker-status.ps1             # Cek status & log container Docker
│   └── smoke-check.sh                # Sanity check environment
│
├── docs/                             # Spesifikasi sistem (PRD, flowchart)
├── docker-compose.yml                # Konfigurasi Docker Compose utama
├── docker-compose.local.yml          # Override Docker untuk development lokal
├── .env.example                      # Template variabel environment
├── CHANGELOG.md                      # Riwayat perubahan per versi
└── IMPLEMENTATION-NOTES.md           # Catatan asumsi teknis & cakupan MVP
```

---

## ✅ Prasyarat

### Untuk Docker (Direkomendasikan)

- Docker Engine dan Docker Compose

### Untuk Development Lokal

- **Node.js** `22.x`
- **npm** `10+`
- **PostgreSQL** `16+` (atau gunakan Docker hanya untuk database)

---

## 🐳 Menjalankan dengan Docker (Cara Cepat)

> PostgreSQL pada konfigurasi Docker **tidak dipublikasikan ke port host**, sehingga tidak bentrok dengan PostgreSQL lokal atau container lain.

### 1. Salin dan konfigurasi environment

**PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Bash:**
```bash
cp .env.example .env
```

### 2. Build dan jalankan seluruh service

```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d --wait
docker compose ps
```

### 3. Isi data demo (jalankan sekali saja)

```powershell
# PowerShell
./scripts/docker-seed.ps1
```

```bash
# Bash
docker compose run --rm api node prisma/seed.js
```

### 4. Cek status container

```powershell
./scripts/docker-status.ps1
```

---

## 💻 Menjalankan Secara Lokal

### Setup Manual

```bash
# 1. Salin file environment
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 2. Jalankan hanya database via Docker
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres

# 3. Install dependencies
npm install

# 4. Setup database
npm run db:generate   # generate Prisma Client
npm run db:push       # sinkronisasi schema
npm run db:seed       # isi data demo

# 5. Jalankan dev server
npm run dev
```

### Setup Otomatis (Script)

```bash
# Bash
./scripts/setup.sh

# PowerShell
./scripts/setup.ps1

# Kemudian jalankan dev server
npm run dev
```

---

## ⚙️ Konfigurasi Environment

Gunakan `.env.example` sebagai acuan. **Jangan gunakan secret default pada deployment production.**

### Variabel Utama

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Connection string PostgreSQL |
| `JWT_ACCESS_SECRET` | ✅ | — | Minimal 32 karakter |
| `JWT_REFRESH_SECRET` | ✅ | — | Minimal 32 karakter |
| `PUBLIC_WEB_URL` | ✅ (prod) | `https://localhost` | URL frontend, bisa beberapa (pisah koma) |
| `EMAIL_WEB_BASE_URL` | ✅ (prod) | — | Base URL untuk direct link di email |
| `APP_ENV` | — | `DEVELOPMENT` | `DEVELOPMENT` atau `PRODUCTION` |
| `PORT` | — | `3000` | Port API |

### Konfigurasi SMTP (Email Notifikasi)

Email notifikasi **opsional** di development. Jika SMTP tidak dikonfigurasi, email dinonaktifkan secara otomatis.

| Variabel | Keterangan |
|---|---|
| `SMTP_HOST` | Host SMTP (misal: `smtp.gmail.com`) |
| `SMTP_PORT` | Port SMTP (default: `587`) |
| `SMTP_SECURE` | `true` untuk port `465`, `false` untuk STARTTLS |
| `SMTP_USER` | Username SMTP |
| `SMTP_PASS` | Password SMTP |
| `SMTP_FROM` | Alamat pengirim (misal: `Ticketing SLA <it@example.com>`) |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | `true` untuk production (default: `true`) |
| `SMTP_CONNECTION_TIMEOUT_MS` | Timeout koneksi SMTP (default: `30000`) |

### Konfigurasi Media Storage

| Variabel | Keterangan |
|---|---|
| `MEDIA_STORAGE_PROVIDER` | `LOCAL` (development) atau `VERCEL_BLOB` (production) |
| `BLOB_STORE_ID` | ID Vercel Blob Store (jika `VERCEL_BLOB`) |
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob (jika `VERCEL_BLOB`) |

### Konfigurasi SLA Scheduler

| Variabel | Keterangan |
|---|---|
| `SLA_SCHEDULER_MODE` | `INTERNAL` (development) atau `EXTERNAL` (Vercel Cron) |
| `SLA_INTERNAL_INTERVAL_MS` | Interval scheduler internal (default: `60000` ms) |
| `SLA_CRON_SECRET` | Secret untuk Vercel Cron (wajib jika `EXTERNAL`) |

> **Production:** Wajib menggunakan `APP_ENV=PRODUCTION`, `MEDIA_STORAGE_PROVIDER=VERCEL_BLOB`, dan `SLA_SCHEDULER_MODE=EXTERNAL`.

---

## 🔧 Perintah Penting

```bash
# Development
npm run dev              # Jalankan API dan Web secara bersamaan
npm run preflight        # Validasi workspace dan dependency

# Build
npm run build            # Build contracts > API > Web

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Sinkronisasi schema (dev/demo)
npm run db:migrate       # Buat migration versioned
npm run db:deploy        # Deploy migration (staging/CI)
npm run db:seed          # Isi data demo
npm run db:studio        # Buka Prisma Studio di browser

# Testing & Quality
npm run test             # Unit test backend dan frontend
npm run lint             # Static lint seluruh workspace
npm run format           # Format kode dengan Prettier

# Validasi
./scripts/smoke-check.sh # Sanity check endpoint dan infrastruktur
```

---

## 👥 Akun & Data Demo

| Role | Email | Password |
|---|---|---|
| **Administrator** | `forfun071020@gmail.com` | `Admin123!` |
| **Head** | `head@example.com` | `Head123!` |
| **Technician 1** | `tech1@example.com` | `Tech123!` |
| **Technician 2** | `tech2@example.com` | `Tech123!` |
| **Technician 3** | `tech3@example.com` | `Tech123!` |
| **Teknisi (Pending Approval)** | `pending@example.com` | `Tech123!` |

**Data Demo Lainnya:**
- 🔲 QR Code demo: `DEMO-SITE-QR`
- 🎫 Ticket contoh: `TKT-DEMO01`
- 📱 Nomor tracking: `628171111111`
- 🔗 Form pengaduan: `https://ticketing-demo.test/complaint/DEMO-SITE-QR`

---

## 🌐 Akses Aplikasi

### Docker (Production-like)

| Layanan | URL |
|---|---|
| 🖥️ Web App | `https://ticketing-demo.test` |
| 🔌 REST API | `https://ticketing-demo.test/api/v1` |
| 📄 Swagger Docs | `https://ticketing-demo.test/docs` |
| 🏥 Health Live | `https://ticketing-demo.test/api/v1/health/live` |
| 🏥 Health Ready | `https://ticketing-demo.test/api/v1/health/ready` |

### Development Lokal

| Layanan | URL |
|---|---|
| 🖥️ Web App | `http://localhost:5173` |
| 🔌 REST API | `http://localhost:3000/api/v1` |
| 📄 Swagger Docs | `http://localhost:3000/docs` |

---

## 📡 Akses LAN dengan Hostname

Aplikasi menggunakan hostname lokal, bukan URL IP langsung. Daftarkan hostname berikut ke DNS lokal/router Anda:

```text
ticketing-demo.test   <IP server>
ticketing-dev.test    <IP server>
```

Jika IP server berubah, cukup update record DNS lokal — **tidak perlu rebuild image atau mengubah source code**.

**Konfigurasi relevan di `.env`:**
```env
PUBLIC_WEB_URL=https://ticketing-demo.test,https://localhost
EMAIL_WEB_BASE_URL=https://ticketing-demo.test
VITE_API_URL=/api/v1
TLS_CERT_FILE=./runtime/certs/demo/server-cert.pem
TLS_KEY_FILE=./runtime/certs/demo/server-key.pem
```

> `VITE_API_URL=/api/v1` menggunakan path relatif agar frontend memanggil API pada hostname yang sama dengan halaman yang dibuka.

---

## 📈 Status Implementasi

Berdasarkan `Implementation Update Roadmap.md`, roadmap pengembangan saat ini:

| Phase | Status | Deskripsi |
|---|---|---|
| **Phase 1** | ✅ Selesai | Schema, Enum, dan Backward Compatibility |
| **Phase 2** | ✅ Selesai | State Machine, Reschedule, Resume, dan SLA |
| **Phase 3** | ✅ Selesai | Menghilangkan Reject Operasional |
| **Phase 4** | ✅ Selesai | Backend Media Rules |
| **Phase 5** | ✅ Selesai | Head/Admin Ticket Detail |
| **Phase 6** | ✅ Selesai | Technician Workflow (foto/video check-in & completion) |
| **Phase 7** | ✅ Selesai | Public Complaint (multi-upload media portal klien) |
| **Phase 8** | ✅ Selesai | Report, Dashboard, Filter, dan Dokumentasi |
| **Phase 9** | ✅ Selesai | Notification, Direct Link, dan Email |
| **Phase 10** | 🔄 Berjalan | Regression, QA, dan UAT (Test End-to-End) |

---

## 📝 Changelog

Lihat [CHANGELOG.md](CHANGELOG.md) untuk riwayat perubahan lengkap per versi.

**Versi terbaru: `1.0.5`**
- Mengganti Prisma seed TypeScript menjadi `seed.js` yang dijalankan langsung oleh Node
- Menghapus ketergantungan runtime terhadap `ts-node`
- Menambahkan validasi preflight agar file seed dan command seed runtime tetap sinkron

---

## 📚 Dokumentasi Tambahan

| Dokumen | Deskripsi |
|---|---|
| [`IMPLEMENTATION-NOTES.md`](IMPLEMENTATION-NOTES.md) | Catatan asumsi teknis dan cakupan rilis MVP |
| [`CHANGELOG.md`](CHANGELOG.md) | Riwayat perubahan setiap versi |
| [`Implementation Update Roadmap.md`](Implementation%20Update%20Roadmap.md) | Rencana pembaruan per fase |
| [`docs/`](docs/) | Dokumentasi spesifikasi sistem (PRD, flowchart) |

---

<div align="center">
  <sub>Built with ❤️ — Ticketing SLA v1.0.5</sub>
</div>
