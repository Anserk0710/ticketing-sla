# Validation Record

Validasi yang dilakukan pada paket source ini:

- Seluruh file TypeScript dan TSX diparse/transpile menggunakan TypeScript 5.8.3.
- Seluruh relative import diperiksa dan tidak ada path lokal yang hilang.
- Seluruh file JSON diparse.
- Shell script diperiksa dengan `sh -n`.
- Dokumentasi sumber dipertahankan pada folder `docs/`.

Build dependency-aware (`npm install`, Prisma generate, Nest build, Vite build, dan Jest) tidak dapat dijalankan di lingkungan pembuatan paket karena registry npm internal mengembalikan HTTP 503 dan akses langsung ke registry publik gagal DNS (`EAI_AGAIN`). Jalankan rangkaian berikut pada mesin dengan akses npm normal:

```bash
npm install
npm run db:generate
npm run build
npm run test
npm run lint
```

## Perbaikan build 1.0.1

- `packages/contracts/tsconfig.json`: `rootDir: ./src`.
- `apps/api/tsconfig.build.json`: `rootDir: ./src`, `outDir: ./dist`.
- `apps/web/tsconfig.node.json`: `noEmit: true`.
- TypeScript dipatok ke versi `5.8.3` pada root, API, dan web.
- Build package contracts berhasil dijalankan dengan `tsc 5.8.3`.
- Pemeriksaan konfigurasi web tidak lagi menghasilkan TS5096; error yang tersisa di sandbox hanya modul npm yang tidak tersedia karena registry internal HTTP 503.


## Perbaikan build 1.0.2

Berdasarkan output Docker build, API sebelumnya gagal dengan 10 error TypeScript pada:

- `apps/api/src/modules/assignments/assignments.service.ts`
- `apps/api/src/modules/field-operations/field-operations.service.ts`
- `apps/api/src/modules/tickets/tickets.service.ts`

Perbaikan yang diterapkan:

- Array enum sempit seperti `[TicketStatus.RESPONDED, TicketStatus.REOPENED].includes(ticket.status)` diganti menjadi perbandingan eksplisit. Ini mencegah TS2345 ketika nilai aktual memiliki union enum yang lebih luas.
- Parameter `TicketStatus.REJECTED | TicketStatus.CANCELLED` diganti menjadi `'REJECTED' | 'CANCELLED'`. Prisma mengekspor `TicketStatus` sebagai type alias sekaligus value object, bukan namespace tipe.
- Regression type-check untuk seluruh pola status yang diperbaiki berhasil menggunakan TypeScript 5.8.3.
- Build package `@ticketing/contracts` berhasil menggunakan TypeScript 5.8.3.
- Source TypeScript/TSX berhasil diparse tanpa diagnostic sintaks.

Full dependency-aware Nest/Vite build tidak dapat diulang di sandbox karena registry npm internal mengembalikan HTTP 503. Namun seluruh 10 lokasi yang dilaporkan oleh Docker sudah diperbaiki secara langsung.

## Perbaikan build 1.0.3

Error `E404 @ticketing/contracts@1.0.0` terjadi karena API dan web masih meminta versi `1.0.0`, sedangkan package workspace lokal sudah berada pada versi `1.0.2`. Karena rentang versi tidak cocok, npm menganggap dependency tersebut bukan workspace lokal dan mencoba mengambilnya dari npm registry.

Perbaikan yang diterapkan:

- Dependency API dan web sekarang menggunakan `file:../../packages/contracts`.
- Seluruh versi workspace disinkronkan ke `1.0.3`.
- Dockerfile menyalin source monorepo lengkap sebelum `npm install`.
- Instalasi Docker memakai opsi workspace eksplisit: `--workspaces --include-workspace-root`.
- `.dockerignore` mencegah artefak host menimpa hasil instalasi di image.
- `scripts/validate-workspaces.mjs` memastikan dependency lokal, source contracts, dan versi workspace valid sebelum npm mengunduh dependency eksternal.

Validasi yang berhasil dijalankan:

- Resolusi dependency `file:../../packages/contracts` diuji dengan npm 10.9.2 dalam mode offline dan menghasilkan symlink ke package lokal.
- `npm run preflight`: berhasil.
- Build `@ticketing/contracts` dengan TypeScript 5.8.3: berhasil.
- 104 file TypeScript/TSX: tidak memiliki diagnostic sintaks.
- 291 relative import: seluruh path ditemukan.
- 11 file JSON, `docker-compose.yml`, dan shell scripts: valid.

Docker CLI tidak tersedia di lingkungan pembuatan paket, dan registry npm sandbox tidak dapat diakses. Oleh karena itu image Docker penuh tidak dapat dieksekusi di sini. Namun error registry package internal yang dilaporkan sudah direproduksi pada konfigurasi package dan ditutup dengan dependency lokal yang telah diuji tanpa koneksi registry.
## Release 1.0.4 — runtime Docker

Perubahan runtime yang divalidasi secara statis:

- PostgreSQL tidak lagi memiliki `ports: 5432:5432`; koneksi API menggunakan DNS service internal `postgres:5432`.
- Compose memiliki healthcheck untuk PostgreSQL, API, dan web.
- API entrypoint menggunakan Prisma CLI lokal, retry bootstrap database, dan `exec` untuk meneruskan signal ke proses NestJS.
- `docker compose run --rm api ... db seed` dapat menjalankan seed tanpa bergantung pada container API yang sudah aktif.
- Port host API dan web dapat diubah melalui `API_HOST_PORT` dan `WEB_HOST_PORT`.

Catatan: Docker Engine tidak tersedia di lingkungan pembuatan artefak, sehingga eksekusi container end-to-end tetap harus dilakukan pada mesin yang memiliki Docker. Build TypeScript v1.0.3 telah berhasil pada log pengguna; perubahan v1.0.4 hanya menyentuh Compose, entrypoint, environment, dan dokumentasi.



## Release 1.0.5 — seed runtime tanpa ts-node

- Seed authoritative dipindahkan dari `apps/api/prisma/seed.ts` ke `apps/api/prisma/seed.js`.
- Script `prisma:seed` menjalankan `node prisma/seed.js` secara langsung.
- Helper Docker menjalankan `docker compose run --rm api node prisma/seed.js`.
- Konfigurasi deprecated `package.json#prisma` dihapus, sehingga perintah seed tidak lagi memunculkan warning konfigurasi seed lama.
- `node --check apps/api/prisma/seed.js` berhasil.
