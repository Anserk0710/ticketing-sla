# Deployment Runbook

## 1. Environment

- `local`
- `test`
- `staging`
- `production`

Staging harus menyerupai production untuk database engine, storage integration, reverse proxy, dan timezone handling.

## 2. Runtime

- Gunakan Node.js LTS yang didukung saat deployment.
- Containerized deployment.
- PostgreSQL managed atau server dengan backup terjadwal.
- Redis opsional untuk queue/cache.
- Nginx/reverse proxy dan HTTPS.

## 3. Environment Variable

Kelompok minimum:

```text
APP_ENV
PORT
PUBLIC_WEB_URL
API_BASE_URL
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ISSUER
JWT_AUDIENCE
CLOUDINARY_*
SMTP_*
MAPS_*
REDIS_URL
LOG_LEVEL
```

Secret tidak disimpan di repository atau image.

## 4. Pre-Deploy Checklist

- CI lulus;
- unit/integration/E2E kritis lulus;
- migration direview;
- backup terbaru tersedia;
- environment variable tervalidasi;
- storage/email/maps credential diuji;
- changelog disiapkan;
- rollback plan disetujui.

## 5. Deployment Sequence

1. Buat backup database.
2. Deploy image aplikasi yang sudah di-version tag.
3. Jalankan migration production.
4. Jalankan application instances.
5. Verifikasi readiness.
6. Jalankan smoke test.
7. Aktifkan traffic.
8. Monitor error, latency, DB connection, dan queue.

Untuk migration destructive, gunakan expand-and-contract; jangan langsung drop column yang masih dipakai aplikasi lama.

## 6. Health Check

- `/health/live`: proses hidup.
- `/health/ready`: database dan dependency kritis siap.
- Storage/email/maps tidak harus membuat liveness gagal, tetapi readiness/status harus menjelaskan degradation sesuai kebutuhan.

## 7. Observability

Minimum:

- structured logs;
- request ID;
- error rate;
- p95 latency;
- DB pool usage;
- scheduler last run;
- jumlah SLA warning/breach event;
- notification failure;
- storage upload/finalize failure;
- disk/CPU/memory untuk self-hosted.

## 8. Backup

- backup PostgreSQL terjadwal;
- retention dan encryption;
- backup konfigurasi kritis;
- media mengikuti backup/retention provider;
- restore drill minimal sebelum go-live dan berkala.

## 9. Rollback

Rollback aplikasi:

1. Alihkan ke image versi sebelumnya.
2. Pastikan schema backward compatible.
3. Jalankan smoke test.
4. Dokumentasikan incident.

Rollback migration hanya dilakukan bila script aman dan data tidak hilang. Prioritaskan forward-fix untuk migration yang sudah memodifikasi data.

## 10. Incident Minimum

- identifikasi severity;
- hentikan dampak;
- simpan log/request ID;
- rollback atau forward-fix;
- komunikasikan status internal;
- buat post-incident review untuk issue Critical/High.

## 11. Post-Deploy Smoke Test

- login Admin/Head/Technician;
- create ticket dummy;
- response dan SLA terlihat;
- assignment dummy;
- notification terbentuk;
- report dapat dibuka;
- health endpoint normal.
