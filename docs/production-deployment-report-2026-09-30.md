# Laporan Perubahan dan Kesiapan Deploy Production

Tanggal audit: 30 September 2026 (Asia/Singapore)  
Repository: `ticketing-sla`  
Branch: `Fix-Demo`  
Baseline: `0bb4e07` (`Final Demo Fix`, 24 Agustus 2026)  
Status keputusan: **NO-GO sementara**

## 1. Ringkasan eksekutif

Perubahan hari ini mempersiapkan aplikasi untuk deployment production berbasis Vercel, Neon PostgreSQL, Vercel Blob, SMTP, dan scheduler SLA eksternal. Perubahan juga meningkatkan upload/akses media, evaluasi SLA, health check, observability, seed production, tampilan media pada detail tiket, serta download QR code.

Saat audit dilakukan, tidak ada commit baru pada 30 September 2026. Seluruh perubahan masih berada di working tree terhadap commit `0bb4e07`, terdiri dari 32 file tracked yang berubah dan 29 file baru yang belum dilacak. Tidak ada file yang sudah di-stage.

Build API dan Web berhasil. Lint API berhasil tanpa temuan; lint Web berhasil tanpa error tetapi memiliki 8 warning. Test API belum sepenuhnya berhasil karena satu test suite media tidak mengikuti constructor baru `MediaService`. Selain itu, perubahan index Prisma belum memiliki migration baru dan template `.env.example` memuat kredensial database yang tampak nyata. Tiga hal tersebut harus diselesaikan sebelum production.

## 2. Perubahan fungsional

### Backend API

- Menambahkan validasi environment terpusat melalui `apps/api/src/config/environment.ts`.
- Production diwajibkan memakai HTTPS, Vercel Blob, scheduler SLA eksternal, SMTP, database, dan JWT secret minimal 32 karakter.
- Menambahkan adapter Vercel Function melalui `apps/api/api/index.ts` dan konfigurasi `apps/api/vercel.json`.
- Menambahkan request ID, security header Helmet, CORS berbasis `PUBLIC_WEB_URL`, dan request logging/slow-request observability.
- Health check dipisahkan ke service dengan endpoint:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/ready`
- Readiness sekarang memeriksa koneksi PostgreSQL dan melaporkan latency, mode storage, mode scheduler, commit, environment, serta region deployment.
- Pengiriman email tiket baru dipindahkan ke background task agar response pembuatan tiket tidak menunggu SMTP.
- Query ticket dan penerima email dijalankan berurutan untuk mengurangi tekanan connection pool Prisma.
- Logic migrasi data ad-hoc SLA RESPOND di startup Prisma dihapus; perubahan database diarahkan ke migration resmi.

### Media dan storage

- Menambahkan abstraction storage untuk mode `LOCAL` dan `VERCEL_BLOB`.
- Development/Docker tetap mendukung multipart upload lokal.
- Production mendukung direct upload browser ke private Vercel Blob menggunakan signed PUT URL.
- Menambahkan alur `signature -> direct upload -> finalize` untuk media publik dan internal.
- Finalisasi memverifikasi object, ukuran, content type, dan magic bytes sebelum membuat `MediaAsset`.
- Akses media private dilakukan melalui backend setelah autentikasi/otorisasi, kemudian diarahkan ke signed GET URL sementara.
- Menambahkan guard agar endpoint upload lokal tidak dipakai saat provider production adalah Vercel Blob.
- Batas upload disiapkan hingga 100 MB pada controller lokal, dengan aturan tipe media dipusatkan pada constants/DTO.

### SLA scheduler

- Menghapus dependency `@nestjs/schedule` dan menggantinya dengan dua mode:
  - `INTERNAL`: timer untuk Docker/development.
  - `EXTERNAL`: endpoint scheduler untuk production/serverless.
- Menambahkan endpoint `POST /api/v1/internal/sla/evaluate` yang dilindungi Bearer `SLA_CRON_SECRET` dan perbandingan constant-time.
- Evaluator SLA memproses instance terbuka secara batch, menghindari overlap pada scheduler internal, dan memakai conditional update untuk mengurangi duplikasi event/notifikasi.
- Menambahkan event serta notifikasi SLA Respond/Work untuk status warning dan breached.
- Index Prisma berubah dari `(status, dueAt)` menjadi `(status, warningAt)` untuk mendukung query evaluator.

### Frontend Web

- HTTP client dirapikan dan diperluas untuk alur upload media LOCAL maupun Vercel Blob.
- Upload Blob melakukan direct PUT dari browser dan finalisasi idempotent dengan satu kali retry.
- Detail tiket kini dapat menampilkan foto check-in dan media penyelesaian (foto/video) melalui modal/lightbox terautentikasi.
- Object URL media di-revoke saat komponen dilepas untuk menghindari memory leak.
- Halaman settings dapat mengunduh QR complaint sebagai PNG yang menyertakan nama site dan token.
- Menambahkan dependency `qrcode` dan `@types/qrcode`.
- Web production ditetapkan memakai Node.js 22.x dan SPA rewrite Vercel.

### Database dan seed

- Seed dipisahkan menjadi:
  - `seed.system.js`: permission, role, katalog, dan SLA policy dasar.
  - `seed.js`: data demo/development.
  - `seed.production.js`: system seed dan satu bootstrap administrator tanpa data demo.
- Production seed mewajibkan `APP_ENV=PRODUCTION`, menggunakan `DIRECT_URL`, password bootstrap minimal 12 karakter, dan memaksa perubahan password pada login awal.
- Menambahkan script migration production yang menggunakan pooled `DATABASE_URL` untuk runtime dan direct `DIRECT_URL` untuk `prisma migrate deploy`.
- Entrypoint Docker berubah dari `prisma db push` ke `prisma migrate deploy`.

### Infrastruktur dan dokumentasi

- Menambahkan konfigurasi Vercel terpisah untuk API dan Web.
- Menambahkan `.vercelignore` dan contoh environment production.
- Docker Compose mendapatkan `APP_ENV`, konfigurasi Blob, pilihan scheduler, dan konfigurasi SMTP yang lebih eksplisit.
- Menambahkan script verifikasi production untuk database/migration, larangan data demo, Vercel Blob write/read/delete, koneksi SMTP dan email uji, serta konfigurasi scheduler.
- Root package menambahkan command migration, seed, dan infrastructure verification production.
- Node.js distandardisasi ke versi 22.x.
- README diperluas untuk arsitektur, fitur, setup, environment, Docker, dan Vercel.

## 3. Dependency baru dan perubahan runtime

| Area | Perubahan |
|---|---|
| Root | `vercel ^59.7.0` |
| API | `@vercel/blob ^2.8.0`, `@vercel/functions ^3.9.5` |
| API | `@nestjs/schedule` dihapus |
| Web | `qrcode ^1.5.4`, `@types/qrcode ^1.5.6` |
| Runtime | Node.js `22.x` |
| Database startup | `prisma db push` menjadi `prisma migrate deploy` |

## 4. Hasil validasi

| Pemeriksaan | Hasil | Catatan |
|---|---|---|
| Workspace preflight | Lulus | Versi workspace, local contracts, dan runtime seed valid |
| Build API | Lulus | Prisma Client berhasil dibuat dan NestJS berhasil dikompilasi |
| Build Web | Lulus dengan warning | Bundle JS utama 564.68 kB (165.07 kB gzip), melewati warning limit 500 kB |
| Lint API | Lulus | 0 error, 0 warning |
| Lint Web | Lulus dengan warning | 0 error, 8 warning unused import/declaration |
| Test API | Gagal sebagian | 5 suite lulus, 1 suite gagal compile; 29 test lulus |
| Git diff check | Lulus | Tidak ditemukan whitespace error; terdapat peringatan normalisasi LF ke CRLF |
| Test E2E | Belum dijalankan | Membutuhkan environment/database runtime yang siap |
| Verifikasi infra production | Belum dijalankan | Membutuhkan credential Neon, Blob, dan SMTP production |

Kegagalan test saat ini:

```text
src/modules/media/media.service.spec.ts:26:13
TS2554: Expected 2 arguments, but got 1.
new MediaService(prisma)
```

`MediaService` sekarang membutuhkan `MediaStorageService`; mock/fake storage harus ditambahkan pada test.

## 5. Blocker wajib sebelum deploy

### P0 — Kredensial database terekspos di template

`.env.example` dan `apps/api/.env.example` saat ini memuat URL Neon dengan username/password yang tampak nyata. Walaupun belum di-commit pada baseline, credential harus dianggap telah terekspos.

Tindakan wajib:

1. Rotate password/credential Neon.
2. Ganti semua URL di file contoh dengan placeholder.
3. Pastikan credential lama tidak muncul pada staged diff, commit, log CI, atau deployment history.
4. Simpan credential baru hanya pada secret manager/Vercel Environment Variables dan `.env.production.local` lokal yang di-ignore.

### P0 — Migration index Prisma belum tersedia

Schema mengubah index `sla_instances` dari `(status, dueAt)` menjadi `(status, warningAt)`, tetapi folder `apps/api/prisma/migrations` masih hanya berisi migration awal `20260820050126_init`.

Tindakan wajib:

1. Buat migration baru untuk perubahan index.
2. Review SQL migration agar hanya mengganti index yang dimaksud.
3. Uji migration pada salinan/staging database.
4. Jalankan `prisma migrate deploy` sebelum versi API baru menerima traffic.

Tanpa migration baru, `prisma migrate deploy` tidak akan menerapkan perubahan index ke production.

### P0 — Test suite API belum hijau

Perbarui `media.service.spec.ts` dengan mock `MediaStorageService`, lalu jalankan seluruh test API sampai 100% lulus.

### P1 — Scheduler external belum terjadwal dalam repository

Endpoint scheduler dan secret guard sudah tersedia, tetapi `apps/api/vercel.json` belum mendefinisikan cron. Karena endpoint memerlukan custom Bearer secret, gunakan scheduler eksternal yang dapat mengirim header Authorization, atau buat mekanisme Vercel Cron yang kompatibel dan diverifikasi.

Pastikan scheduler memanggil:

```text
POST /api/v1/internal/sla/evaluate
Authorization: Bearer <SLA_CRON_SECRET>
```

### P1 — Flag Swagger belum diterapkan

Environment validator menyediakan `SWAGGER_ENABLED` dengan default nonaktif untuk production, tetapi bootstrap Node dan Vercel masih selalu menjalankan `SwaggerModule.setup`. Implementasikan conditional setup atau terima secara eksplisit bahwa Swagger `/docs` tetap terbuka di production.

### P1 — Perubahan belum menjadi artifact Git yang dapat dilacak

Seluruh perubahan masih unstaged/untracked. Sebelum deploy:

1. Review 32 file modified dan 29 file baru.
2. Jangan sertakan build artifact `*.tsbuildinfo` bila tidak memang dikelola repository.
3. Buat commit/release tag yang jelas agar rollback dapat menunjuk commit tertentu.
4. Deploy dari commit immutable, bukan working tree lokal.

## 6. Environment production yang diperlukan

### API

```text
APP_ENV=PRODUCTION
NODE_ENV=production
DATABASE_URL=<Neon pooled URL>
DIRECT_URL=<Neon direct URL; hanya untuk migration/seed>
JWT_ACCESS_SECRET=<random minimal 32 karakter>
JWT_REFRESH_SECRET=<random berbeda minimal 32 karakter>
JWT_ISSUER=ticketing-sla-api
JWT_AUDIENCE=ticketing-sla-web
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=7
PUBLIC_WEB_URL=https://<frontend-production>
EMAIL_WEB_BASE_URL=https://<frontend-production>
MEDIA_STORAGE_PROVIDER=VERCEL_BLOB
BLOB_READ_WRITE_TOKEN=<secret>
SLA_SCHEDULER_MODE=EXTERNAL
SLA_CRON_SECRET=<random minimal 32 karakter>
SMTP_HOST=<host>
SMTP_PORT=<port>
SMTP_SECURE=<true/false>
SMTP_USER=<user bila diperlukan>
SMTP_PASS=<secret bila diperlukan>
SMTP_FROM=<sender>
SMTP_TLS_REJECT_UNAUTHORIZED=true
SWAGGER_ENABLED=false
SLOW_REQUEST_THRESHOLD_MS=1500
```

### Web

```text
VITE_API_URL=https://<api-production>/api/v1
```

Catatan: `VITE_API_URL` masuk ke bundle browser saat build. Pastikan URL production sudah benar sebelum build/deploy Web.

## 7. Urutan deploy yang direkomendasikan

### Gate sebelum rollout

1. Rotate dan hapus credential yang terekspos dari template.
2. Tambahkan migration index Prisma.
3. Perbaiki test media dan pastikan seluruh test/lint/build lulus.
4. Uji migration, seed production, upload Blob, akses media, SMTP, dan scheduler di staging.
5. Commit semua source yang diperlukan dan buat release tag.
6. Backup/snapshot database production dan catat commit production saat ini.

### Rollout

1. Konfigurasikan semua environment variable API production.
2. Jalankan migration melalui direct database URL:

   ```powershell
   npm run db:deploy:production
   ```

3. Hanya untuk bootstrap awal, jalankan production seed:

   ```powershell
   npm run db:seed:production
   ```

4. Jalankan verifikasi infrastruktur production dari environment yang aman:

   ```powershell
   npm run infra:verify:production
   ```

5. Deploy API dari commit release.
6. Verifikasi endpoint live/ready dan login administrator bootstrap.
7. Konfigurasikan serta uji scheduler eksternal.
8. Deploy Web dengan `VITE_API_URL` yang menunjuk API production.
9. Jalankan smoke test end-to-end.
10. Pantau error rate, latency database, log request ID, email, Blob, dan hasil evaluator SLA.

Production seed tidak boleh digunakan untuk membuat data demo. Setelah login pertama, ganti password administrator bootstrap.

## 8. Smoke test setelah deploy

- `GET /api/v1/health/live` mengembalikan status live dan commit release yang benar.
- `GET /api/v1/health/ready` mengembalikan database `up`, `APP_ENV=PRODUCTION`, storage `VERCEL_BLOB`, dan scheduler `EXTERNAL`.
- Login administrator berhasil dan wajib mengganti password awal.
- Public complaint dapat dibuat dari QR.
- QR dapat diunduh sebagai PNG dan URL complaint valid.
- Upload foto/video publik berhasil melalui direct Blob upload.
- Teknisi dapat check-in, mulai kerja, dan mengunggah media penyelesaian.
- Head/Admin dapat membuka preview foto/video pada detail tiket.
- User tanpa permission tidak dapat mengakses media private.
- Email tiket baru diterima oleh Head/Admin.
- Scheduler dengan secret benar menghasilkan respons sukses; secret salah menghasilkan 401.
- SLA berpindah ke warning/breached tepat satu kali dan notifikasi tidak duplikat.
- Export report tetap dapat diunduh.
- Tidak ada data demo (`TKT-DEMO01`, `CLIENT-DEMO`, atau user `@example.com`) di database production.

## 9. Strategi rollback

- Simpan commit/tag release sebelumnya dan deployment URL/API sebelumnya.
- Jika API baru gagal sebelum perubahan data digunakan, rollback deployment API/Web ke commit sebelumnya.
- Migration index bersifat struktural dan tidak mengubah isi data, tetapi rollback SQL tetap harus disiapkan dan diuji. Jangan menggunakan `prisma db push` pada production.
- Jangan menghapus Blob yang sudah di-upload saat rollback aplikasi; media mungkin sudah direferensikan oleh record database.
- Jika seed production sudah membuat administrator, rollback aplikasi tidak perlu menghapus akun tersebut. Audit dan nonaktifkan secara manual bila diperlukan.
- Setelah rollback, verifikasi health, login, workflow tiket, media, email, dan scheduler versi lama.

## 10. Keputusan akhir audit

**NO-GO sementara.** Kandidat release dapat berubah menjadi GO setelah seluruh P0 selesai, scheduler production memiliki pemanggil terjadwal yang teruji, keputusan Swagger diselesaikan, seluruh test hijau, dan smoke test staging lulus.
