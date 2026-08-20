# Migrasi Backend ke NestJS

## 1. Keputusan

Dokumentasi versi ini menggunakan NestJS sebagai backend target. Bila FastAPI belum memiliki implementasi substansial, bangun langsung dari baseline ini. Bila FastAPI sudah berjalan, migrasikan per domain, bukan rewrite serentak tanpa kontrol.

## 2. Target Stack

- Node.js LTS;
- NestJS;
- TypeScript strict;
- PostgreSQL;
- Prisma ORM dan Prisma Migrate;
- Swagger/OpenAPI;
- Jest dan Supertest;
- Docker;
- Cloudinary/object storage;
- Redis/BullMQ opsional.

## 3. Prinsip Migrasi

- Bekukan kontrak bisnis terlebih dahulu.
- Jangan menerjemahkan file FastAPI satu-per-satu tanpa refactor domain.
- Pertahankan database hanya jika schema lama cukup baik dan migration path aman.
- Buat contract test agar response lama dan baru dapat dibandingkan bila diperlukan.
- Migrasikan vertical slice yang dapat diuji end-to-end.

## 4. Mapping Konsep

| FastAPI | NestJS |
|---|---|
| Router/endpoint | Controller |
| Dependency injection `Depends` | Provider + Guard + Decorator |
| Pydantic schema | DTO + class-validator/class-transformer |
| SQLAlchemy model/session | Prisma schema/client/transaction |
| Alembic | Prisma Migrate |
| Service function | Injectable use-case service |
| Middleware | Middleware/Guard/Interceptor/Filter sesuai concern |
| Background task | Scheduler atau BullMQ worker |

## 5. Urutan Migrasi

### Step 1 — Baseline

- NestJS app;
- config validation;
- Prisma connection;
- error envelope;
- logging/request ID;
- Swagger;
- Docker.

### Step 2 — Identity

- users;
- auth;
- refresh token;
- role/permission;
- technician approval;
- forgot password.

### Step 3 — Catalog dan Public Ticket

- clients/sites/QR;
- categories/priorities;
- create ticket;
- tracking.

### Step 4 — Ticket Core dan SLA Respond

- list/detail;
- state machine;
- response;
- SLA respond.

### Step 5 — Assignment dan Field Operation

- assignment member;
- lead;
- check-in;
- completion;
- SLA work.

### Step 6 — Report, Notification, Hardening

- dashboard;
- notifications;
- report/export;
- audit;
- performance/security.

## 6. Database Strategy

Pilihan:

1. **Greenfield schema** — terbaik jika belum ada production data.
2. **Adopt existing schema** — introspect dan mapping Prisma, lalu tambah migration bertahap.
3. **Parallel schema/data migration** — untuk sistem aktif dengan cutover terencana.

Jangan menjalankan Alembic dan Prisma Migrate secara paralel sebagai dua pemilik migration aktif pada schema yang sama. Setelah cutover, tetapkan satu source of truth.

## 7. Cutover Checklist

- semua endpoint kritis tersedia;
- contract/E2E test lulus;
- data migration tervalidasi;
- password hash compatible atau reset plan tersedia;
- media reference valid;
- SLA historical data dipetakan;
- freeze window dan rollback tersedia;
- monitoring aktif.

## 8. Kapan Tidak Perlu Migrasi

Pertahankan FastAPI bila:

- sistem sudah production dan stabil;
- tim dominan Python;
- manfaat TypeScript tidak menutupi biaya rewrite;
- business rule masih berubah cepat dan rewrite hanya mengalihkan fokus.

Dalam kondisi tersebut, dokumentasi domain ini tetap dapat diterapkan pada FastAPI.
