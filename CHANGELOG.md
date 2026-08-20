# Changelog

## 1.0.5 - 2026-07-23

### Fixed

- Mengganti Prisma seed TypeScript menjadi `prisma/seed.js` yang dijalankan langsung oleh Node pada image runtime.
- Menghapus ketergantungan runtime terhadap executable `ts-node`, sehingga seed tidak lagi gagal dengan `spawn ts-node ENOENT`.
- Menghapus konfigurasi `package.json#prisma` yang deprecated dan mengarahkan seluruh script/helper Docker ke seed JavaScript.
- Menambahkan validasi preflight agar file seed dan command seed runtime tidak dapat kembali tidak sinkron.

## 1.0.4 - 2026-07-23

### Fixed

- Menghapus publikasi port PostgreSQL `5432` ke host; database hanya tersedia melalui network internal Compose sehingga tidak bentrok dengan PostgreSQL lokal/container lain.
- Menambahkan API entrypoint dengan retry `prisma db push` dan log startup yang eksplisit.
- Menambahkan restart policy dan healthcheck untuk PostgreSQL, API, dan web.
- Membuat web menunggu API benar-benar healthy, bukan sekadar container dibuat.
- Menambahkan helper PowerShell untuk seed dan pemeriksaan status Docker.
- Menyamakan port web Docker dengan dokumentasi (`8080`) dan membuat port host API/web dapat dikonfigurasi.

## 1.0.3 - 2026-07-23

### Fixed
- Mengganti dependency internal `@ticketing/contracts` pada API dan web menjadi path lokal `file:../../packages/contracts`, sehingga npm tidak lagi mencari package private tersebut di npm registry.
- Menyamakan versi root, API, web, dan contracts ke `1.0.3`.
- Mengubah Dockerfile agar seluruh monorepo disalin sebelum `npm install`, sehingga workspace lokal tersedia saat dependency resolution.
- Menambahkan `.dockerignore` untuk mencegah `node_modules`, `dist`, `.env`, upload, dan artefak lokal masuk ke Docker build context.
- Menambahkan `npm run preflight` untuk memvalidasi dependency lokal dan sinkronisasi versi sebelum instalasi Docker.

## 1.0.2 - 2026-07-23

### Fixed
- Mengganti pemeriksaan `.includes()` pada enum Prisma dengan perbandingan status eksplisit yang kompatibel dengan TypeScript 5.8.
- Memperbaiki tipe parameter terminasi ticket dari namespace enum menjadi union literal `'REJECTED' | 'CANCELLED'`.
- Menutup 10 error kompilasi NestJS pada assignment, field operation, dan ticket resolution.

## 1.0.1 - 2026-07-23

### Fixed
- Menetapkan `rootDir` eksplisit pada package contracts agar kompatibel dengan pemeriksaan TypeScript terbaru.
- Menetapkan `rootDir` build NestJS tanpa mengganggu eksekusi Prisma seed.
- Menambahkan `noEmit` pada konfigurasi TypeScript Vite untuk memperbaiki TS5096.
- Mengunci TypeScript `5.8.3` di seluruh workspace agar Docker build deterministik.

## 1.0.0 - 2026-07-23

- Implementasi monorepo React/Vite dan NestJS/Prisma.
- Public complaint, tracking, dan media upload.
- JWT authentication, rotating refresh token, RBAC, approval teknisi, reset/change password.
- Ticket workflow, multi-technician assignment, field check-in, completion, dan audit trail.
- SLA Respond dan SLA Pengerjaan dengan scheduler, warning, breach, dan historisasi service cycle.
- Notification, dashboard, reporting, Excel export, master data, Swagger, Docker, CI, setup, dan smoke-check scripts.
