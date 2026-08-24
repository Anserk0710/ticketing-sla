# Production Deployment Roadmap

## Project
Ticketing SLA

## Target Architecture

### Development
- Docker tetap digunakan untuk development lokal.
- PostgreSQL tetap berjalan melalui Docker.
- Media tetap menggunakan local storage / Docker volume.
- SLA scheduler tetap dapat menggunakan internal NestJS cron untuk kebutuhan development.

### Production
- Frontend: Vercel Hobby
- Backend NestJS: Vercel Hobby
- Database: Neon PostgreSQL
- Media Storage: Vercel Blob
- SLA Scheduler: cron-job.org setiap 10 menit
- Email: SMTP/provider yang sudah digunakan
- Shared package: `packages/contracts`

---

# Phase 1 — Production Readiness Backend

## Tujuan
Menyesuaikan Backend agar dapat berjalan pada dua environment tanpa merusak workflow development Docker.

## Scope

### 1. Scheduler SLA dual-mode
Pisahkan mekanisme scheduler dari business logic SLA.

Development:

```env
SLA_SCHEDULER_MODE=INTERNAL
```

Production:

```env
SLA_SCHEDULER_MODE=EXTERNAL
```

Behaviour:

```text
Docker
  -> NestJS @Cron
  -> evaluateOpenInstances()

Production
  -> cron-job.org
  -> protected HTTP endpoint
  -> evaluateOpenInstances()
```

Production scheduler dijalankan setiap 10 menit:

```cron
*/10 * * * *
```

Tambahkan endpoint internal, misalnya:

```text
POST /api/v1/internal/sla/evaluate
```

Endpoint wajib dilindungi dengan secret:

```env
SLA_CRON_SECRET=<strong-random-secret>
```

cron-job.org mengirim:

```text
Authorization: Bearer <SLA_CRON_SECRET>
```

Business logic SLA tetap berada di `SlaService`.

### 2. Optimasi evaluator SLA
Evaluator tidak boleh mengambil data lebih banyak dari yang diperlukan.

Prioritaskan SLA yang masih aktif dan sudah mencapai waktu warning/due.

Target:
- Mengurangi query database.
- Mengurangi waktu eksekusi Vercel Function.
- Menghemat resource Vercel Hobby dan Neon.

Catatan:
Dengan scheduler 10 menit, perubahan persistent `WARNING` atau `BREACHED` dan notifikasi dapat terlambat hingga sekitar 10 menit.

Runtime SLA pada API/UI tetap harus dihitung berdasarkan timestamp seperti:
- `startedAt`
- `warningAt`
- `dueAt`
- waktu saat ini

Sehingga status yang ditampilkan tidak sepenuhnya bergantung pada scheduler.

### 3. Prisma production-safe
Pastikan Prisma Client selalu dibuat saat deployment.

Tambahkan proses:

```text
prisma generate
```

ke installation/build lifecycle yang sesuai.

Pindahkan logic perubahan data yang sekarang dilakukan saat startup aplikasi ke Prisma migration atau proses deployment terkontrol.

`PrismaService` pada production sebaiknya hanya bertanggung jawab pada lifecycle database connection.

### 4. Media storage abstraction
Pisahkan provider storage:

```env
MEDIA_STORAGE_PROVIDER=LOCAL
```

untuk Docker, dan:

```env
MEDIA_STORAGE_PROVIDER=VERCEL_BLOB
```

untuk production.

Target arsitektur:

```text
MediaStorageService
  |
  +-- LocalMediaStorage
  |
  +-- VercelBlobMediaStorage
```

Jangan menggantungkan file production pada filesystem Vercel Function.

Untuk upload file besar, browser meng-upload langsung ke Blob Storage sehingga file tidak melewati request body Backend.

### 5. Environment configuration
Lengkapi `.env.example` dengan seluruh variable production yang diperlukan tanpa memasukkan secret asli.

Minimal:

```env
NODE_ENV=
DATABASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ISSUER=
JWT_AUDIENCE=

PUBLIC_WEB_URL=
EMAIL_WEB_BASE_URL=

MEDIA_STORAGE_PROVIDER=
BLOB_READ_WRITE_TOKEN=

SLA_SCHEDULER_MODE=
SLA_CRON_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

## Area/File Utama

```text
Backend/src/modules/sla/
Backend/src/modules/media/
Backend/src/modules/health/
Backend/src/prisma/
Backend/prisma/
Backend/package.json
Backend/.env.example
packages/contracts/
```

Nama path dapat disesuaikan dengan struktur final repository.

## Output
- Backend berjalan di Docker dengan behaviour lama.
- Backend siap dijalankan sebagai Vercel Function.
- Internal SLA cron tidak bergantung pada process Vercel yang selalu hidup.
- Media production tidak menggunakan local filesystem.
- Prisma aman untuk deployment serverless.

## Validation
- Docker development tetap berjalan normal.
- Internal scheduler berjalan pada mode `INTERNAL`.
- Scheduler tidak otomatis berjalan pada mode `EXTERNAL`.
- Endpoint scheduler menolak request tanpa secret.
- Endpoint scheduler berhasil dengan secret yang benar.
- SLA runtime tetap akurat meskipun scheduler belum dieksekusi.
- Local upload tetap berhasil.
- Build Backend berhasil.

---

# Phase 2 — Production Infrastructure & Data

## Tujuan
Menyediakan seluruh layanan production yang dibutuhkan sebelum Backend dihubungkan ke Vercel.

## Scope

### 1. Neon PostgreSQL
Buat PostgreSQL production di Neon.

Dapatkan connection string production:

```env
DATABASE_URL=postgresql://...
```

Jika tersedia, gunakan connection/pooler endpoint yang direkomendasikan untuk workload serverless.

Database Docker tetap digunakan untuk development.

### 2. Prisma migration production
Jalankan migration terhadap database Neon secara terkontrol.

Gunakan production migration workflow, bukan:

```text
prisma db push
```

sebagai mekanisme utama production.

Target:

```text
Prisma migrations
      |
      v
Neon PostgreSQL
```

Seed hanya data yang memang diperlukan untuk environment production.

Jangan menyalin data dummy/development tanpa kebutuhan.

### 3. Vercel Blob
Buat Blob storage untuk:
- foto check-in
- foto completion
- video completion
- media ticket terkait lainnya

Hubungkan token Blob hanya ke environment production.

Pastikan metadata file tetap tercatat di PostgreSQL.

### 4. SMTP
Siapkan environment SMTP production dan lakukan test pengiriman.

Pastikan URL di dalam email mengarah ke domain Frontend production.

### 5. Scheduler eksternal
Buat account/configuration di cron-job.org.

Jadwal:

```cron
*/10 * * * *
```

Target URL:

```text
https://<backend-domain>/api/v1/internal/sla/evaluate
```

Header:

```text
Authorization: Bearer <SLA_CRON_SECRET>
```

Scheduler baru diaktifkan setelah Backend production berhasil diverifikasi.

## Output
- Neon database tersedia.
- Schema production sudah termigrasi.
- Vercel Blob tersedia.
- SMTP production siap.
- Configuration cron-job.org siap tetapi belum aktif sampai Backend lolos deployment validation.

## Validation
- Backend lokal dapat terkoneksi ke Neon menggunakan temporary production test configuration bila diperlukan.
- Prisma migration sukses.
- Prisma Client dapat melakukan query.
- Blob upload dan read flow berhasil.
- SMTP test berhasil.
- Secret scheduler tidak disimpan di repository.

---

# Phase 3 — Vercel Deployment

## Tujuan
Deploy Backend dan Frontend menggunakan Vercel Hobby dengan konfigurasi production yang benar.

## Scope

### 1. Repository
Pastikan repository production memuat struktur monorepo lengkap:

```text
root/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   └── contracts/
├── package.json
├── package-lock.json
└── ...
```

Shared package `@ticketing/contracts` harus tersedia saat build Backend maupun Frontend.

### 2. Deploy Backend
Import repository ke Vercel.

Buat project Backend terpisah.

Konfigurasikan root directory/build sesuai struktur monorepo.

Tambahkan environment variables production:
- database
- JWT
- URL
- Blob
- scheduler
- SMTP

Production wajib menggunakan:

```env
NODE_ENV=production
SLA_SCHEDULER_MODE=EXTERNAL
MEDIA_STORAGE_PROVIDER=VERCEL_BLOB
```

Jangan menggunakan hostname Docker seperti:

```text
postgres:5432
```

di Vercel.

### 3. Backend smoke test
Setelah deployment, test minimal:

```text
/api/v1/health/live
/api/v1/health/ready
/docs
```

Kemudian test:
- authentication
- refresh token
- ticket
- client/site search
- sorting
- assignment
- technician workflow
- check-in
- completion
- SLA
- notification
- media upload

### 4. Deploy Frontend
Buat Vercel project Frontend terpisah.

Set production API base URL ke URL Backend Vercel.

Contoh:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
```

Gunakan nama environment variable yang memang digunakan source Frontend.

### 5. CORS dan public URL
Backend harus mengizinkan origin Frontend production.

Contoh:

```env
PUBLIC_WEB_URL=https://<frontend-domain>
EMAIL_WEB_BASE_URL=https://<frontend-domain>
```

Jangan gunakan konfigurasi development/IP lokal di production.

### 6. Aktifkan scheduler
Setelah Backend lolos smoke test, aktifkan cron-job.org.

Interval:

```text
10 menit
```

Verifikasi log eksekusi scheduler dan perubahan status SLA.

## Output
- Backend online di Vercel Hobby.
- Frontend online di Vercel Hobby.
- Backend terhubung Neon.
- Media menggunakan Vercel Blob.
- Frontend berkomunikasi dengan Backend production.
- Scheduler SLA berjalan dari cron-job.org setiap 10 menit.

## Validation
- Tidak ada dependency terhadap Docker di production.
- Tidak ada secret di source code.
- CORS benar.
- Login production berhasil.
- CRUD utama berhasil.
- Search/sorting ticket berhasil.
- Check-in dan completion berhasil.
- Media dapat dibuka kembali.
- Email production berhasil.
- cron-job.org mendapat HTTP success.
- SLA `WARNING/BREACHED` dipersist dan notification dibuat.

---

# Phase 4 — Go-Live, Hardening & Monitoring

## Tujuan
Memastikan production stabil, aman, dan siap digunakan tanpa mengganggu environment development.

## Scope

### 1. End-to-end production test
Lakukan satu workflow lengkap:

```text
Create Ticket
  ->
Assignment
  ->
Technician Check-in
  ->
SLA Work Start
  ->
Start Work
  ->
Completion
  ->
Ticket Resolution
```

Validasi:
- timestamps
- SLA
- location
- media
- notification
- email
- role permission

### 2. SLA scheduler test
Untuk testing, gunakan SLA dengan waktu pendek pada data test/staging bila memungkinkan.

Verifikasi:

```text
OPEN
  ->
WARNING
  ->
BREACHED
```

Karena scheduler production berjalan setiap 10 menit, persistence/notifikasi dapat terlambat sampai satu siklus scheduler.

Pastikan runtime status pada UI tetap mengikuti timestamp secara akurat.

### 3. Security hardening
Periksa:
- JWT secret kuat
- cron secret kuat
- SMTP credential tidak terekspos
- Blob credential tidak terekspos
- `.env` tidak masuk Git
- internal scheduler endpoint terproteksi
- production CORS hanya origin yang diperlukan
- Swagger production sesuai kebijakan yang dipilih

### 4. Database protection
Sebelum production digunakan:
- pastikan migration history benar
- buat strategi backup Neon
- jangan menggunakan destructive migration tanpa review
- hindari `db push` terhadap production
- gunakan migration deployment workflow

### 5. Logging dan monitoring
Pantau:
- Vercel Function error
- failed API request
- Prisma/database error
- failed Blob upload
- failed email
- cron-job.org execution
- SLA evaluator failure

Scheduler endpoint sebaiknya memberikan response ringkas seperti:

```json
{
  "success": true,
  "processed": 8,
  "updated": 2
}
```

tanpa mengekspos data sensitif.

### 6. Production checklist

- [ ] Backend production deploy berhasil
- [ ] Frontend production deploy berhasil
- [ ] Neon database terhubung
- [ ] Prisma migration berhasil
- [ ] Authentication berhasil
- [ ] Role/permission berhasil
- [ ] Ticket CRUD berhasil
- [ ] Client/Site search berhasil
- [ ] Ticket sorting berhasil
- [ ] Assignment berhasil
- [ ] Technician check-in berhasil
- [ ] Completion berhasil
- [ ] Media Blob berhasil
- [ ] SLA Respond berhasil
- [ ] SLA Work berhasil
- [ ] Notification berhasil
- [ ] SMTP berhasil
- [ ] cron-job.org berjalan setiap 10 menit
- [ ] Scheduler endpoint aman
- [ ] CORS production benar
- [ ] Tidak ada secret di repository
- [ ] Docker development tetap berjalan normal

## Output
Production dinyatakan siap digunakan setelah seluruh validation utama berhasil.

---

# Final Production Architecture

```text
                         PRODUCTION

                    Vercel Hobby
                 Frontend Application
                         |
                         | HTTPS
                         v
                    Vercel Hobby
                  NestJS Backend
                   /     |      \
                  /      |       \
                 v       v        v
              Neon    Vercel     SMTP
           PostgreSQL   Blob
                 ^
                 |
                 |
          SLA Evaluation API
                 ^
                 |
          cron-job.org
          every 10 minutes
```

Development tetap terpisah:

```text
                         DEVELOPMENT

Browser
   |
   v
Docker Web
   |
   v
Docker NestJS
   |
   +--> Internal SLA Scheduler
   |
   +--> Docker PostgreSQL
   |
   +--> Docker Volume / Local Media
```

---

# Recommended Implementation Order

Urutan pengerjaan:

```text
Phase 1
Production Readiness Backend
       |
       v
Phase 2
Production Infrastructure & Data
       |
       v
Phase 3
Vercel Deployment
       |
       v
Phase 4
Go-Live, Hardening & Monitoring
```

Jangan membuat infrastructure production terlebih dahulu sebelum perubahan pada Phase 1 selesai dan lolos local validation.

Dengan pola ini, satu source code tetap mendukung:

```text
Development = Docker
Production  = Vercel Hobby
```

tanpa mempertahankan dua codebase berbeda.
