# Implementation Plan

Dokumen ini menjadi acuan implementasi update workflow ticketing SLA. Fokus perubahan adalah mengganti jalur tolak menjadi pending/reschedule, memperketat aturan media, dan merapikan notifikasi setelah flow utama stabil.

## 1. Keputusan yang Disepakati

- SLA tetap berjalan saat ticket berada pada status `PENDING`.
- Tambahkan status ticket `PENDING` untuk kebutuhan pending/reschedule.
- Tambahkan data pendukung reschedule pada ticket:
  - `scheduledAt`
  - `pendingReason`
- Status `REJECTED` lama tidak dihapus dari database/enum agar histori lama tetap aman.
- Fitur reject operasional baru dihilangkan dari UI, endpoint aktif, permission seed, dan dokumentasi workflow.
- Teknisi tidak bisa menolak assignment.
- Reschedule dan reassign menjadi tanggung jawab Head/Admin.
- Notifikasi in-app, email, dan direct link dikerjakan pada fase paling akhir.

## 2. Aturan Media Baru

### Public Complaint

- Media wajib.
- Minimal 1 file.
- Multi-upload.
- Tipe file yang diizinkan:
  - foto: JPG, PNG, WEBP
  - video: MP4
- Media dikaitkan ke ticket dengan context `COMPLAINT`.

### Check-in Teknisi

- Media wajib.
- Tepat 1 foto.
- Tidak menerima video.
- Tipe file yang diizinkan:
  - JPG, PNG, WEBP
- Media dikaitkan ke check-in dengan context `CHECKIN`.

### Completion Teknisi

- Media wajib.
- Minimal 1 file.
- Multi-upload.
- Tipe file yang diizinkan:
  - foto: JPG, PNG, WEBP
  - video: MP4
- Media dikaitkan ke completion dengan context `COMPLETION`.

## 3. Target Workflow Ticket

### Status Utama

```text
NEW
RESPONDED
PENDING
ASSIGNED
ON_SITE
IN_PROGRESS
RESOLVED
CLOSED
REOPENED
CANCELLED
REJECTED
```

Catatan:

- `REJECTED` tetap ada hanya untuk histori lama.
- Jalur baru tidak lagi menggunakan `REJECTED` sebagai aksi operasional.

### Transisi yang Direkomendasikan

```text
NEW -> RESPONDED
NEW -> PENDING
NEW -> CANCELLED

RESPONDED -> ASSIGNED
RESPONDED -> PENDING
RESPONDED -> CANCELLED

PENDING -> RESPONDED
PENDING -> ASSIGNED
PENDING -> CANCELLED

ASSIGNED -> ON_SITE
ASSIGNED -> PENDING
ASSIGNED -> CANCELLED

ON_SITE -> IN_PROGRESS
ON_SITE -> PENDING
ON_SITE -> CANCELLED

IN_PROGRESS -> RESOLVED
IN_PROGRESS -> PENDING
IN_PROGRESS -> CANCELLED

RESOLVED -> CLOSED
RESOLVED -> REOPENED

CLOSED -> REOPENED

REOPENED -> ASSIGNED
REOPENED -> IN_PROGRESS
REOPENED -> PENDING
REOPENED -> CANCELLED
```

### Reschedule

Head/Admin dapat menjalankan aksi reschedule dari status aktif berikut:

- `NEW`
- `RESPONDED`
- `ASSIGNED`
- `ON_SITE`
- `IN_PROGRESS`
- `REOPENED`

Input wajib:

- alasan pending/reschedule
- jadwal baru

Efek:

- ticket berpindah ke `PENDING`
- `pendingReason` dan `scheduledAt` disimpan di ticket
- event masuk ke `TicketStatusLog`
- SLA tidak berhenti dan tidak pause

### Resume dari Pending

Head/Admin dapat melanjutkan ticket dari `PENDING`:

- ke `RESPONDED` jika ticket masih butuh respons/triage
- ke `ASSIGNED` jika sudah siap ditugaskan atau assignment lama dilanjutkan
- ke `CANCELLED` jika ticket tidak jadi dilanjutkan

## 4. Fase Implementasi

### Fase 1 - Backend Schema dan Contract

Tujuan:

- Tambahkan `PENDING` pada enum ticket.
- Tambahkan field `scheduledAt` dan `pendingReason` pada model ticket.
- Sinkronkan enum di shared contracts.
- Siapkan perubahan Prisma migration atau `db push` sesuai mode development yang dipakai.

Area terdampak:

- `apps/api/prisma/schema.prisma`
- `packages/contracts/src/enums/index.ts`
- dokumentasi status terkait

Kriteria selesai:

- Prisma client bisa digenerate.
- Build backend tidak gagal karena enum/field baru.

### Fase 2 - Backend State Machine dan Service Ticket

Tujuan:

- Tambahkan transisi `PENDING`.
- Tambahkan endpoint/action reschedule.
- Tambahkan endpoint/action resume pending bila diperlukan.
- Hilangkan penggunaan reject dari flow operasional baru.
- Pastikan `REJECTED` tetap terbaca untuk histori lama.

Area terdampak:

- `apps/api/src/modules/tickets/ticket-state-machine.ts`
- `apps/api/src/modules/tickets/tickets.dto.ts`
- `apps/api/src/modules/tickets/tickets.service.ts`
- `apps/api/src/modules/tickets/tickets.controller.ts`
- `apps/api/src/modules/tickets/ticket-state-machine.spec.ts`

Kriteria selesai:

- Transisi valid/invalid punya test.
- Reschedule mewajibkan alasan dan jadwal baru.
- SLA tidak dihentikan saat masuk `PENDING`.
- Endpoint reject ticket tidak dipakai lagi oleh UI dan dapat dinonaktifkan dari permission operasional.

### Fase 3 - Backend Assignment dan Technician Flow

Tujuan:

- Hapus jalur reject assignment dari flow teknisi.
- Pastikan reassign tetap dilakukan oleh Head/Admin.
- Pertahankan status `REJECTED` assignment lama untuk histori bila sudah ada data lama.

Area terdampak:

- `apps/api/src/modules/assignments/assignments.controller.ts`
- `apps/api/src/modules/assignments/assignments.service.ts`
- `apps/api/src/modules/assignments/assignments.dto.ts`
- `apps/api/prisma/seed.js`

Kriteria selesai:

- Teknisi tidak memiliki endpoint operasional untuk menolak assignment.
- Head/Admin tetap dapat reassign/remove member dengan alasan.
- Data assignment lama yang berstatus `REJECTED` tetap bisa ditampilkan.

### Fase 4 - Backend Validasi Media

Tujuan:

- Validasi public complaint wajib memiliki minimal 1 media.
- Validasi check-in wajib memiliki tepat 1 foto.
- Validasi completion wajib memiliki minimal 1 media.
- Validasi tipe media berdasarkan context.

Area terdampak:

- `apps/api/src/modules/tickets/tickets.dto.ts`
- `apps/api/src/modules/tickets/tickets.service.ts`
- `apps/api/src/modules/field-operations/field-operations.dto.ts`
- `apps/api/src/modules/field-operations/field-operations.service.ts`
- `apps/api/src/modules/media/media.service.ts`

Kriteria selesai:

- Public ticket tanpa media ditolak.
- Check-in tanpa foto ditolak.
- Check-in dengan video ditolak.
- Completion tanpa media ditolak.
- Completion dengan multi foto/video diterima.

### Fase 5 - Frontend Public Complaint

Tujuan:

- Ubah input media menjadi multi-upload.
- Jadikan media wajib.
- Izinkan foto/video.
- Upload seluruh file sebelum submit ticket.
- Kirim semua `mediaIds` ke API.
- Tampilkan nama/jumlah file yang dipilih dan error yang jelas saat kosong.

Area terdampak:

- `apps/web/src/pages/public/public-complaint-page.tsx`
- `apps/web/src/api/http-client.ts`

Kriteria selesai:

- User tidak bisa submit complaint tanpa media.
- User bisa memilih lebih dari satu foto/video.
- Ticket berhasil dibuat dengan semua media terkait.

### Fase 6 - Frontend Technician Flow

Tujuan:

- Hapus tombol dan panel `Tolak` dari halaman tugas teknisi.
- Check-in wajib 1 foto.
- Completion wajib minimal 1 foto/video dan multi-upload.
- Upload seluruh media completion sebelum submit completion.

Area terdampak:

- `apps/web/src/pages/technician/my-assignments-page.tsx`
- `apps/web/src/api/http-client.ts`

Kriteria selesai:

- Teknisi tidak melihat aksi tolak.
- Check-in tidak dapat dikirim tanpa 1 foto.
- Completion tidak dapat dikirim tanpa media.
- Completion dapat mengirim banyak foto/video.

### Fase 7 - Frontend Head/Admin Ticket Detail

Tujuan:

- Tambahkan aksi `Pending/Reschedule`.
- Form reschedule berisi alasan dan jadwal baru.
- Tampilkan informasi pending pada detail ticket.
- Tambahkan aksi resume dari `PENDING`.
- Pastikan opsi reject tidak tampil.

Area terdampak:

- `apps/web/src/pages/internal/ticket-detail-page.tsx`
- `apps/web/src/pages/internal/tickets-page.tsx`
- `apps/web/src/components/ui/badge.tsx`

Kriteria selesai:

- Head/Admin bisa mengubah ticket aktif menjadi `PENDING`.
- Head/Admin bisa melanjutkan ticket dari `PENDING`.
- Daftar ticket bisa filter/tampil status `PENDING`.
- Status lama `REJECTED` tetap bisa tampil jika ada data lama, tetapi bukan aksi baru.

### Fase 8 - Report, Dashboard, dan Dokumentasi

Tujuan:

- Tambahkan status `PENDING` pada dashboard/report.
- Pastikan report tidak menganggap `PENDING` sebagai selesai.
- Update dokumen workflow, API, role-permission, dan data model.

Area terdampak:

- `apps/api/src/modules/reports/reports.service.ts`
- `docs/Ticket-Workflow.md`
- `docs/API-Specification.md`
- `docs/Roles-Permissions.md`
- `docs/Data-Model.md`
- `docs/Reporting-Specification.md`

Kriteria selesai:

- `PENDING` muncul pada summary status.
- Ticket pending tetap dihitung sebagai ticket aktif/tertunda, bukan closed.
- Dokumentasi sesuai flow baru.

### Fase 9 - Notifikasi dan Email

Fase ini dikerjakan paling akhir sesuai kesepakatan.

Tujuan:

- Tambahkan direct link untuk notifikasi.
- Notifikasi mengarah ke detail ticket.
- Item notifikasi punya perbedaan visual jelas antara baru dan sudah dibaca.
- Klik notifikasi menandai item sebagai sudah dibaca.
- Kirim email ke Head/Admin saat ticket baru masuk.

Area terdampak:

- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.controller.ts`
- modul email baru bila diperlukan
- `apps/api/src/modules/tickets/tickets.service.ts`
- `apps/web/src/pages/internal/notifications-page.tsx`
- `apps/web/src/components/layout/app-layout.tsx`
- `.env.example`
- `apps/api/package.json`

Kriteria selesai:

- Notifikasi baru dan sudah dibaca mudah dibedakan.
- Notifikasi ticket membuka `/app/tickets/:id`.
- Notifikasi assignment-related tetap diarahkan ke detail ticket.
- Email ticket baru terkirim ke user role `HEAD` dan `ADMINISTRATOR`.
- Jika SMTP belum dikonfigurasi, ticket tetap berhasil dibuat dan email dilewati dengan aman.

## 5. Strategi Notifikasi Email

Karena konfigurasi email belum tersedia, implementasi disarankan dibuat defensif:

- service email membaca env SMTP
- jika env tidak lengkap, service masuk mode disabled
- mode disabled tidak menyebabkan error pada pembuatan ticket
- email hanya dikirim setelah ticket berhasil dibuat

Env yang perlu disiapkan:

```text
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EMAIL_NOTIFICATIONS_ENABLED=
```

## 6. Testing Minimum

### Backend

- State machine:
  - transisi ke `PENDING`
  - transisi dari `PENDING`
  - transisi invalid tetap ditolak
- Public ticket:
  - tanpa media ditolak
  - multi media diterima
- Check-in:
  - tanpa media ditolak
  - video ditolak
  - 1 foto diterima
- Completion:
  - tanpa media ditolak
  - multi foto/video diterima
- Assignment:
  - reject teknisi tidak tersedia pada flow baru
- Notification:
  - unread/read tetap bekerja
  - target URL benar

### Frontend

- Public complaint tidak bisa submit tanpa media.
- Public complaint bisa multi-upload.
- Teknisi tidak melihat tombol tolak.
- Check-in wajib foto.
- Completion wajib media dan bisa multi-upload.
- Head/Admin bisa reschedule.
- Head/Admin bisa resume dari pending.
- Notifikasi membuka detail ticket.

## 7. Risiko dan Catatan

- Menambahkan field Prisma membutuhkan sinkronisasi database.
- Menghapus enum `REJECTED` tidak disarankan karena berisiko merusak data lama.
- SLA tetap berjalan saat `PENDING`, sehingga ticket pending tetap bisa breach. Ini sesuai keputusan bisnis saat ini.
- Multi-upload frontend sebaiknya tetap meng-upload file satu per satu ke endpoint media yang sudah ada, lalu mengirim kumpulan `mediaIds`. Ini lebih sederhana dan cocok dengan backend saat ini.
- Jika nanti jumlah file besar, perlu limit jumlah file per context agar storage dan upload time terkendali.

## 8. Urutan Eksekusi Singkat

1. Schema dan enum `PENDING`.
2. State machine dan endpoint reschedule/resume.
3. Hilangkan reject operasional.
4. Validasi media backend.
5. Update public complaint.
6. Update technician check-in/completion.
7. Update Head/Admin ticket detail.
8. Update report/dashboard/docs.
9. Implementasi notifikasi dan email.
