# Implementation Notes

Dokumen ini menjelaskan cakupan implementasi source code terhadap spesifikasi di folder `docs/`.

## Cakupan MVP yang tersedia

### Public portal

- Resolusi QR site dan formulir keluhan publik.
- Upload bukti keluhan.
- Idempotency key untuk mencegah duplikasi submit.
- Tracking ticket memakai ticket code dan nomor telepon.
- Registrasi teknisi, lupa password, dan reset password.

### Identity, security, dan RBAC

- JWT access token dan rotating refresh token.
- Role `ADMINISTRATOR`, `HEAD`, dan `TECHNICIAN`.
- Permission guard pada endpoint internal.
- Approval, rejection, suspension, dan reactivation teknisi.
- Password sementara dengan wajib ganti password.
- Audit log untuk aksi penting.
- Rate limiting, Helmet, CORS allow-list, validation pipe, dan request ID.

### Ticket dan field service

- Workflow `NEW` sampai `CLOSED`, termasuk `REJECTED`, `CANCELLED`, dan `REOPENED`.
- Initial official response yang atomic dan aman dari race condition.
- Klasifikasi kategori dan prioritas.
- Assignment multi-teknisi, lead technician, accept/reject, remove, dan reassign.
- Check-in GPS, perhitungan jarak dari site, start work, completion, dan bukti media.
- Resolve oleh lead/Head/Administrator dan verifikasi close.

### SLA

- SLA Respond per ticket/service cycle.
- SLA Pengerjaan per assignment member.
- Snapshot policy/priority pada saat SLA dibuat.
- Status open, warning, breached, completed, dan ended.
- Scheduler evaluasi SLA dan notification deduplication.
- Reopen membuat service cycle baru tanpa mengubah histori sebelumnya.

### Operations dan reporting

- Dashboard ringkas.
- Daftar ticket, detail, timeline, dan komentar.
- Notification inbox.
- Report ticket dan report teknisi dengan filter.
- Export Excel multi-sheet dengan sanitasi formula injection.
- Master data client, site, category, priority, QR, SLA policy, dan user.
- Swagger, health liveness/readiness, Docker Compose, Nginx, backup script, dan CI.

## Adapter MVP

Beberapa integrasi sengaja menggunakan adapter lokal agar proyek dapat langsung didemokan:

- Media disimpan pada filesystem/volume `uploads` dan bukan Cloudinary.
- Token reset password ditampilkan pada response development dan log, bukan dikirim melalui SMTP.
- Reverse geocoding tidak diwajibkan; alamat check-in dapat berasal dari input/fallback.
- SLA memakai calendar elapsed time 24/7. Business-hours calendar belum diaktifkan.

## Hal yang harus dilakukan sebelum produksi

1. Ganti seluruh secret default dan batasi origin CORS.
2. Gunakan object storage privat serta signed URL.
3. Hubungkan email provider dan hilangkan development reset token dari response.
4. Buat dan review migration Prisma versi produksi; `db push` hanya dipakai untuk bootstrap demo.
5. Tambahkan observability terpusat, alerting, backup teruji, antivirus upload, dan retention policy.
6. Jalankan load test, security test, UAT, serta disaster-recovery rehearsal sesuai dokumentasi.
