# Implementation Roadmap

Roadmap ini menyusun urutan pengerjaan dari bagian paling kompleks dan berisiko terlebih dahulu. Tujuannya agar perubahan yang menyentuh schema, state machine, SLA, dan authorization diselesaikan sebelum masuk ke UI dan penyempurnaan notifikasi.

Catatan khusus: notifikasi in-app, email, dan direct link tetap dikerjakan paling akhir sesuai kesepakatan, meskipun termasuk area cross-cutting.

## 1. Prinsip Urutan

- Kerjakan perubahan yang berdampak ke database dan workflow lebih dulu.
- Pastikan backend contract stabil sebelum frontend mengikuti.
- Jangan menghapus enum/status lama yang berhubungan dengan histori.
- Validasi bisnis wajib berada di backend, bukan hanya UI.
- UI dikerjakan setelah API dan rule utama stabil.
- Notifikasi dan email dikerjakan terakhir setelah event utama final.

## 2. Ringkasan Roadmap

| Urutan | Kompleksitas | Fokus | Output Utama |
|---:|---|---|---|
| 1 | Sangat tinggi | Schema, enum, backward compatibility | `PENDING`, `scheduledAt`, `pendingReason` |
| 2 | Sangat tinggi | State machine ticket dan SLA impact | Reschedule/resume tanpa pause SLA |
| 3 | Tinggi | Deprecate reject operasional | Reject hilang dari flow baru, histori aman |
| 4 | Tinggi | Backend media rules | Public, check-in, completion tervalidasi |
| 5 | Tinggi | Head/Admin ticket detail | UI reschedule/resume |
| 6 | Sedang-tinggi | Technician workflow | Tanpa tolak, check-in wajib foto, completion multi-upload |
| 7 | Sedang | Public complaint | Media wajib dan multi-upload |
| 8 | Sedang | Report, dashboard, docs | `PENDING` terbaca di laporan dan dokumen |
| 9 | Tinggi, dikerjakan akhir | Notification dan email | Direct link, unread/read, email Head/Admin |
| 10 | Tinggi | QA, regression, UAT | Flow end-to-end stabil |

## 3. Phase 1 - Schema, Enum, dan Backward Compatibility

Kompleksitas: sangat tinggi

Alasan dikerjakan pertama:

- Perubahan schema menjadi fondasi seluruh phase berikutnya.
- Jika salah, dampaknya merambat ke Prisma Client, DTO, report, filter, dan UI.
- Status lama `REJECTED` harus tetap aman untuk histori.

Scope:

- Tambahkan `PENDING` pada enum ticket.
- Tambahkan `scheduledAt` dan `pendingReason` pada model ticket.
- Sinkronkan enum shared contracts.
- Siapkan migration atau strategi `db push` untuk development.
- Pastikan data lama tetap bisa dibaca.

Output:

- Database siap menyimpan ticket pending/reschedule.
- Contract backend/frontend mengenal status `PENDING`.
- Status `REJECTED` lama tetap ada, tetapi tidak dipakai untuk flow baru.

Validation:

- Prisma generate berhasil.
- Build backend berhasil.
- Query ticket lama yang memiliki `REJECTED` tidak gagal.
- Ticket baru dapat menyimpan field pending.

## 4. Phase 2 - State Machine, Reschedule, Resume, dan SLA

Kompleksitas: sangat tinggi

Alasan dikerjakan setelah schema:

- Ini inti perubahan bisnis.
- Harus menjamin SLA tetap berjalan saat `PENDING`.
- Harus jelas dari status mana ticket boleh masuk pending dan ke mana boleh keluar pending.

Scope:

- Tambahkan transisi ke `PENDING`.
- Tambahkan action reschedule.
- Tambahkan action resume dari `PENDING`.
- Simpan alasan dan jadwal baru.
- Simpan event ke status log.
- Pastikan SLA Respond dan SLA Work tidak di-end/pause saat pending.

Output:

- Head/Admin bisa mengubah ticket aktif menjadi `PENDING`.
- Head/Admin bisa melanjutkan ticket dari `PENDING`.
- Histori status tetap lengkap.
- SLA tetap berjalan sesuai keputusan.

Validation:

- `NEW -> PENDING` valid.
- `RESPONDED -> PENDING` valid.
- `ASSIGNED -> PENDING` valid.
- `ON_SITE -> PENDING` valid.
- `IN_PROGRESS -> PENDING` valid.
- `REOPENED -> PENDING` valid.
- `PENDING -> RESPONDED` valid.
- `PENDING -> ASSIGNED` valid.
- `PENDING -> CANCELLED` valid.
- SLA tidak berubah menjadi `ENDED` saat ticket pending.

## 5. Phase 3 - Hilangkan Reject Operasional

Kompleksitas: tinggi

Alasan dikerjakan sebelum UI:

- Reject tersebar di ticket service, assignment service, permission seed, dan UI.
- Harus dibedakan antara menghapus flow baru dan menjaga data lama.

Scope:

- Hilangkan penggunaan reject ticket dari flow operasional baru.
- Hilangkan reject assignment teknisi dari flow operasional baru.
- Pertahankan enum/status `REJECTED` untuk data lama.
- Rapikan permission seed agar Head/Admin tidak lagi memakai `ticket.reject` sebagai aksi utama.
- Pastikan report dan badge masih mampu menampilkan status lama.

Output:

- Tidak ada tombol/action tolak pada flow baru.
- Teknisi tidak bisa menolak assignment.
- Head/Admin memakai reschedule/reassign/cancel sesuai kasus.
- Histori lama tetap terbaca.

Validation:

- UI tidak memanggil endpoint reject.
- Teknisi tidak melihat tombol tolak.
- Data lama `REJECTED` tetap tampil sebagai histori.
- Reassign/remove member oleh Head/Admin tetap berjalan.

## 6. Phase 4 - Backend Media Rules

Kompleksitas: tinggi

Alasan dikerjakan sebelum frontend upload:

- Frontend bisa diakali, jadi rule wajib ada di backend.
- Aturan media berbeda per context.
- Media berhubungan dengan storage, security, dan audit operasional.

Scope:

- Public complaint wajib minimal 1 media.
- Public complaint menerima multi foto/video.
- Check-in wajib tepat 1 foto.
- Check-in tidak menerima video.
- Completion wajib minimal 1 foto/video.
- Completion menerima multi foto/video.
- Validasi media ID benar-benar ada.
- Validasi resource type/mime type sesuai context.

Output:

- Backend menolak request yang tidak memenuhi aturan media.
- Context media tetap konsisten: `COMPLAINT`, `CHECKIN`, `COMPLETION`.

Validation:

- Public complaint tanpa media ditolak.
- Public complaint multi foto/video diterima.
- Check-in tanpa foto ditolak.
- Check-in dengan 2 file ditolak.
- Check-in dengan video ditolak.
- Completion tanpa media ditolak.
- Completion multi foto/video diterima.

## 7. Phase 5 - Head/Admin Ticket Detail

Kompleksitas: tinggi

Alasan dikerjakan sebelum technician/public UI:

- Head/Admin adalah pemilik keputusan reschedule.
- UI ini menggabungkan status ticket, assignment, SLA, dan action lanjutan.
- Banyak state conditional yang perlu rapi agar tidak muncul aksi yang salah.

Scope:

- Tambahkan aksi `Pending/Reschedule`.
- Form wajib berisi alasan dan jadwal baru.
- Tampilkan info pending pada detail ticket.
- Tambahkan aksi resume dari `PENDING`.
- Sembunyikan opsi reject.
- Pastikan action yang tampil sesuai status dan permission.

Output:

- Head/Admin dapat menjalankan reschedule dari detail ticket.
- Head/Admin dapat melanjutkan ticket pending.
- Status pending terlihat jelas di detail.

Validation:

- Action reschedule hanya muncul untuk Head/Admin.
- Form reschedule tidak bisa dikirim tanpa alasan/jadwal.
- Ticket pending menampilkan jadwal baru.
- Resume dari pending mengarah ke status yang valid.

## 8. Phase 6 - Technician Workflow

Kompleksitas: sedang-tinggi

Alasan dikerjakan setelah Head/Admin:

- Teknisi mengikuti keputusan assignment/reschedule dari Head/Admin.
- Removal tombol tolak harus sinkron dengan backend.
- Check-in dan completion punya aturan media baru.

Scope:

- Hilangkan tombol dan panel `Tolak`.
- Check-in wajib 1 foto.
- Check-in hanya menerima foto.
- Completion wajib minimal 1 foto/video.
- Completion multi-upload.
- Upload file dilakukan sebelum submit action.

Output:

- Teknisi hanya menjalankan accept, check-in, start work, dan complete.
- Bukti check-in dan completion memenuhi aturan baru.

Validation:

- Teknisi tidak melihat tombol tolak.
- Check-in tanpa foto tidak bisa dikirim.
- Check-in hanya mengirim 1 foto.
- Completion tanpa media tidak bisa dikirim.
- Completion bisa mengirim banyak foto/video.

## 9. Phase 7 - Public Complaint

Kompleksitas: sedang

Alasan dikerjakan setelah backend media:

- Backend rules sudah final.
- UI tinggal mengikuti kontrak upload dan error handling.

Scope:

- Ubah input menjadi multi-upload.
- Media wajib.
- Terima foto/video.
- Upload semua file sebelum create ticket.
- Kirim kumpulan `mediaIds`.
- Tampilkan jumlah/nama file yang dipilih.

Output:

- Client/public tidak bisa membuat ticket tanpa bukti.
- Ticket baru dapat memiliki beberapa media awal.

Validation:

- Submit tanpa media ditolak di UI dan backend.
- Submit dengan 1 foto berhasil.
- Submit dengan beberapa foto/video berhasil.
- Error upload tampil jelas.

## 10. Phase 8 - Report, Dashboard, Filter, dan Dokumentasi

Kompleksitas: sedang

Alasan dikerjakan setelah core flow:

- Report harus mengikuti data aktual dari flow baru.
- Dokumentasi disesuaikan setelah keputusan implementasi stabil.

Scope:

- Tambahkan `PENDING` pada filter status ticket.
- Pastikan dashboard menghitung `PENDING` sebagai aktif/tertunda, bukan selesai.
- Pastikan report tidak menganggap pending sebagai closed/resolved.
- Update dokumentasi workflow, API, roles, data model, dan reporting.

Output:

- Laporan dan dashboard konsisten dengan flow pending/reschedule.
- Dokumentasi sesuai implementasi baru.

Validation:

- Ticket pending muncul pada daftar dan filter.
- Summary status memiliki count `PENDING`.
- Export/report tetap jalan dengan ticket pending.
- Dokumen tidak lagi mengarahkan user memakai reject operasional.

## 11. Phase 9 - Notification, Direct Link, dan Email

Kompleksitas: tinggi, tetapi dikerjakan akhir

Alasan dikerjakan akhir:

- Sesuai kesepakatan.
- Notifikasi bergantung pada event final dari phase sebelumnya.
- Email membutuhkan konfigurasi eksternal dan fallback saat SMTP belum aktif.

Scope:

- Tambahkan target direct link pada notifikasi.
- Semua notifikasi ticket membuka detail ticket.
- Assignment-related notification tetap diarahkan ke detail ticket.
- Perbedaan visual unread/read diperjelas.
- Klik notifikasi menandai item sebagai dibaca.
- Kirim email ke Head/Admin saat ticket baru masuk.
- Email service masuk mode disabled jika env SMTP belum lengkap.

Output:

- Notifikasi bisa langsung membuka detail ticket.
- Unread/read jelas.
- Head/Admin menerima email ticket baru bila SMTP aktif.
- Ticket creation tetap berhasil walau email disabled/gagal.

Validation:

- Badge unread bertambah untuk event baru.
- Klik notifikasi membuka `/app/tickets/:id`.
- Klik notifikasi mengisi `readAt`.
- Email terkirim ke role Head/Admin saat SMTP aktif.
- Email disabled tidak menggagalkan ticket creation.

## 12. Phase 10 - Regression, QA, dan UAT

Kompleksitas: tinggi

Alasan dikerjakan terakhir:

- Seluruh perubahan sudah terpasang.
- Fokusnya memastikan tidak ada regressions pada flow lama.

Scope:

- Test end-to-end public ticket sampai close.
- Test pending/reschedule sampai resume.
- Test assignment dan technician completion.
- Test report/dashboard.
- Test notification/email.
- Test permission per role.
- Test media upload invalid.

Output:

- Build dan test lulus.
- Flow utama siap UAT.
- Daftar risiko dan issue tersisa terdokumentasi.

Validation:

- Public complaint -> respond -> reschedule -> resume -> assign -> check-in -> complete -> resolve -> close.
- Public complaint wajib media.
- Check-in wajib 1 foto.
- Completion wajib media.
- Teknisi tidak bisa tolak.
- Head/Admin bisa reschedule.
- SLA tetap berjalan saat pending.
- Notifikasi direct ke detail ticket.

## 13. Dependency Map

```text
Schema/Enum
  -> State Machine/Reschedule
    -> Reject Deprecation
      -> Backend Media Rules
        -> Head/Admin UI
        -> Technician UI
        -> Public UI
          -> Report/Dashboard/Docs
            -> Notification/Email
              -> Regression/UAT
```

## 14. Definition of Done Global

Implementasi dianggap selesai jika:

- semua phase selesai sesuai validation masing-masing;
- tidak ada action reject pada flow operasional baru;
- data lama `REJECTED` tetap bisa dibaca;
- `PENDING` berjalan tanpa pause SLA;
- semua aturan media dipaksa backend dan dibantu UI;
- notifikasi direct link bekerja;
- email ticket baru aman saat SMTP aktif maupun disabled;
- build dan test utama lulus.
