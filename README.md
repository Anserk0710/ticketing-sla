# Ticketing SLA

Monorepo MVP **Sistem Ticketing, Field Service, SLA Respond, dan SLA Pengerjaan** berdasarkan seluruh spesifikasi pada folder [`docs`](docs/).

## Teknologi

- Frontend: React, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router
- Backend: NestJS, Prisma, PostgreSQL, JWT, Swagger
- Report: ExcelJS
- Deployment: Docker Compose dan Nginx

## Fitur utama

- Pengaduan publik berbasis QR dan tracking ticket.
- RBAC Administrator, Head, dan Technician.
- Approval teknisi dan password sementara wajib diganti.
- Workflow ticket lengkap dan assignment multi-teknisi.
- Check-in GPS, start work, completion, dan bukti media.
- SLA Respond per ticket serta SLA Pengerjaan per teknisi.
- Notification, audit trail, dashboard, report, dan export Excel.

Rincian cakupan dan batas adapter demo tersedia di [`IMPLEMENTATION-NOTES.md`](IMPLEMENTATION-NOTES.md).

## Cara cepat: Docker

Persyaratan: Docker Engine dan Docker Compose.

Ekstrak release ke folder baru agar file lama dari release sebelumnya tidak tercampur. PostgreSQL pada konfigurasi Docker **tidak dipublikasikan ke port host**, sehingga tidak akan bentrok dengan PostgreSQL lokal atau container lain pada port `5432`.

PowerShell:

```powershell
Copy-Item .env.example .env
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d --wait
docker compose ps
```

Bash:

```bash
cp .env.example .env
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d --wait
docker compose ps
```

API melakukan bootstrap schema secara otomatis dengan retry ketika PostgreSQL baru mulai. Setelah semua service `healthy`, isi data demo satu kali. Perintah ini tetap bekerja walaupun container API sebelumnya belum berjalan:

```powershell
./scripts/docker-seed.ps1
```

atau secara langsung:

```bash
docker compose run --rm api node prisma/seed.js
```

Akses:

- Web: `http://localhost:8080`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health live: `http://localhost:3000/api/v1/health/live`
- Health ready: `http://localhost:3000/api/v1/health/ready`

Jika port host `3000` atau `8080` sudah dipakai, ubah `API_HOST_PORT` atau `WEB_HOST_PORT` di `.env`, lalu jalankan kembali `docker compose up -d --force-recreate`.

Untuk melihat penyebab service tidak healthy:

```powershell
./scripts/docker-status.ps1
```

Container API memakai `prisma db push` untuk bootstrap database demo. Untuk production, gunakan migration Prisma yang versioned dan direview.

## Menjalankan secara lokal

Persyaratan: Node.js 20+, npm, PostgreSQL 16+, dan Docker opsional untuk database.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Alternatif setup otomatis:

```bash
./scripts/setup.sh
# PowerShell: ./scripts/setup.ps1
npm run dev
```

Akses lokal:

- Web: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

## Akun dan data demo

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@example.com` | `Admin123!` |
| Head | `head@example.com` | `Head123!` |
| Technician 1 | `tech1@example.com` | `Tech123!` |
| Technician 2 | `tech2@example.com` | `Tech123!` |
| Technician 3 | `tech3@example.com` | `Tech123!` |

- Teknisi menunggu approval: `pending@example.com` / `Tech123!`
- QR demo: `DEMO-SITE-QR`
- Form pengaduan Docker: `http://localhost:8080/complaint/DEMO-SITE-QR`
- Ticket contoh: `TKT-DEMO01`, nomor tracking `628171111111`

## Perintah penting

```bash
npm run preflight    # validasi workspace dan dependency lokal
npm run build        # build contracts, API, dan web
npm run test         # unit test backend dan test frontend
npm run lint         # static lint seluruh workspace
npm run db:generate  # generate Prisma Client
npm run db:push      # sinkronisasi schema untuk demo/development
npm run db:migrate   # membuat migration versioned
npm run db:seed      # data demo
./scripts/smoke-check.sh
```

## Struktur Repository

```text
ticketing-sla/
├── apps/
│   ├── api/                     # Backend REST API (NestJS, Prisma, PostgreSQL)
│   │   ├── prisma/              # Schema database dan script seed migration
│   │   └── src/
│   │       ├── config/          # Konfigurasi environment dan variabel global
│   │       ├── database/        # Prisma service & transaksi database
│   │       ├── common/          # Interceptor, exception filter, decorator, dll
│   │       └── modules/         # Modul fitur backend (Domain-driven)
│   │           ├── auth/        # Autentikasi & Role-based Access Control (RBAC)
│   │           ├── tickets/     # Manajemen ticket, lifecycle, dan resume/reschedule
│   │           ├── sla/         # Perhitungan SLA respond & SLA pekerjaan (termasuk saat PENDING)
│   │           ├── technicians/ # Manajemen profil teknisi & persetujuan akun
│   │           ├── assignments/ # Logika penugasan teknisi multi-assign pada ticket
│   │           ├── media/       # Aturan upload & validasi file/foto/video
│   │           └── ...          # Modul lain (reports, audit, notifications)
│   │
│   └── web/                     # Frontend Web SPA (React, Vite, Tailwind CSS, React Query)
│       ├── public/              # Aset statis (favicon, image, manifest)
│       └── src/
│           ├── api/             # Konfigurasi Axios & central API caller functions
│           ├── components/      # Reusable UI component (Button, Form, Table, Modal)
│           ├── features/        # Komponen modular yang mewakili business logic (Slice feature)
│           ├── hooks/           # Custom React hook (seperti integrasi API Data fetching)
│           ├── lib/             # Konfigurasi eksternal third-party library
│           ├── pages/           # Komponen halaman level atas (struktur layar utama per route)
│           │   ├── admin/       # Halaman dashboard, pelaporan, dan manajemen Admin/Head
│           │   ├── technician/  # Halaman operasional, task, dan check-in Teknisi
│           │   └── public/      # Halaman portal klien (contoh: public complaint multi-upload)
│           ├── routes/          # Konfigurasi struktur dan proteksi React Router
│           ├── store/           # Global state management lokal
│           ├── types/           # Type definisi frontend yang bersifat internal web
│           └── utils/           # Fungsi utilitas (formatter tanggal, konversi file, dll)
│
├── packages/
│   └── contracts/               # Paket Typescript mandiri yang dipakai bersama (Monorepo)
│       └── src/
│           ├── api/             # Interface DTO (Data Transfer Object) request & response
│           └── enums/           # Standar enum yang sama (misal: TicketStatus, Role)
│
├── infra/                       # Kebutuhan Infrastruktur dan Deployment
│   └── nginx/                   # Reverse proxy config untuk deployment Docker
│
├── scripts/                     # Script automasi untuk membantu developer
│   ├── setup.sh                 # Script instalasi dan inisialisasi environment
│   ├── docker-seed.ps1          # Injeksi data demo ke database Docker
│   └── smoke-check.sh           # Tes validasi sanity check environment
│
├── docs/                        # Dokumentasi spesifikasi sistem (Requirement PRD, Flowchart)
├── README.md                    # Dokumentasi panduan utama proyek
├── IMPLEMENTATION-NOTES.md      # Catatan asumsi teknis dan cakupan rilis MVP
├── Implementation Update Roadmap.md # Rencana pembaruan per fase yang sedang berjalan (Roadmap)
└── docker-compose.yml           # Konfigurasi Docker compose untuk backend dan PostgreSQL
```

## Status Implementasi (Berdasarkan Roadmap)

Berdasarkan dokumen `Implementation Update Roadmap.md`, pengembangan saat ini sedang berada di **Phase 7 - Public Complaint**.

**Fase yang Telah Selesai:**
- ✅ **Phase 1:** Schema, Enum, dan Backward Compatibility (Penambahan field dan status `PENDING` pada database).
- ✅ **Phase 2:** State Machine, Reschedule, Resume, dan SLA (Workflow SLA berjalan saat status pending).
- ✅ **Phase 3:** Menghilangkan Reject Operasional (Menghapus flow tolak oleh teknisi).
- ✅ **Phase 4:** Backend Media Rules (Validasi upload foto/video di layer API).
- ✅ **Phase 5:** Head/Admin Ticket Detail (Antarmuka untuk Reschedule/Resume ticket).
- ✅ **Phase 6:** Technician Workflow (Aturan baru untuk upload foto/video saat check-in dan completion).
- ✅ **Phase 7:** Public Complaint (Multi-upload media di portal klien).
- ✅ **Phase 8:** Report, Dashboard, Filter, dan Dokumentasi.
- ✅ **Phase 9:** Notification, Direct Link, dan Email.

**Fase Saat Ini (Sedang Dikerjakan):**
- 🔄 **Phase 10:** Regression, QA, dan UAT (Test End-to-End).


## Environment

Gunakan `.env.example`, `apps/api/.env.example`, dan `apps/web/.env.example` sebagai acuan. Jangan gunakan secret default pada deployment production.
