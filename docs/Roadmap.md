# Roadmap Implementasi — 12 Minggu

## 1. Aturan Roadmap

- Total durasi: **12 minggu**.
- Pembagian: **6 phase**, masing-masing 2 minggu.
- Jadwal bersifat relatif karena tanggal mulai belum ditentukan.
- Setiap phase hanya dianggap selesai jika seluruh bagian **When Done** dan **Test** lulus.
- Core flow harus selesai pada akhir Phase 4 agar Phase 5–6 fokus pada penguatan, bukan mengejar fitur dasar.

## 2. Ringkasan

| Phase | Jadwal | Durasi | Fokus |
|---|---:|---:|---|
| Phase 1 | Minggu 1–2 | 2 minggu | Foundation, architecture, auth, dan master data |
| Phase 2 | Minggu 3–4 | 2 minggu | Public ticket, tracking, registrasi, dan reset password |
| Phase 3 | Minggu 5–6 | 2 minggu | Admin/Head workflow dan SLA Respond |
| Phase 4 | Minggu 7–8 | 2 minggu | Assignment teknisi, check-in, resolution, dan SLA Pengerjaan |
| Phase 5 | Minggu 9–10 | 2 minggu | Dashboard, notifications, live report, dan Excel |
| Phase 6 | Minggu 11–12 | 2 minggu | Security hardening, QA, UAT, deployment, dan handover |

---

# Phase 1 — Foundation dan Domain Baseline

## Durasi/Jadwal

**Minggu 1–2**

## Goals

- Membuat monorepo atau repository terstruktur.
- Setup React TypeScript dan NestJS.
- Setup PostgreSQL dan Prisma migration.
- Menetapkan role, permission, state machine, dan model SLA.
- Membuat authentication internal dasar.
- Membuat master data client, site, category, priority, dan SLA policy.
- Menyiapkan OpenAPI, lint, format, test runner, Docker local, dan seed.

## When Done

- Frontend dan backend dapat dijalankan melalui dokumentasi setup.
- Migration pertama dan seed berhasil pada database kosong.
- Login internal menghasilkan access dan refresh token.
- Guard permission aktif pada endpoint uji.
- Swagger/OpenAPI dapat dibuka.
- Role dan permission seed tersedia.
- State machine dan SLA policy memiliki unit test awal.

## Test

1. Unit test authentication service.
2. Unit test permission evaluator.
3. Migration up pada database kosong.
4. Seed idempotency test.
5. Integration test login valid, password salah, akun nonaktif.
6. End-to-end smoke test frontend → backend → database.
7. Negative test: Technician mengakses endpoint admin menghasilkan `403`.

---

# Phase 2 — Public Flow dan Account Lifecycle

## Durasi/Jadwal

**Minggu 3–4**

## Goals

- Membuat landing QR dan public complaint form.
- Generate ticket code yang tidak berurutan.
- Membuat tracking publik yang aman.
- Membuat registrasi teknisi.
- Membuat approval list awal untuk Head/Admin.
- Membuat forgot password dan fallback administratif.
- Menambahkan rate limit dan validasi public input.

## When Done

- Scan QR membuka form dengan site context yang benar.
- Submit menghasilkan ticket `NEW` dan ticket code.
- Client dapat tracking dengan ticket code + nomor kontak.
- Data public yang tampil sudah dimasking.
- Teknisi dapat registrasi tetapi belum dapat login sebelum approved.
- Head/Admin dapat approve atau reject teknisi dengan alasan.
- Reset password token sekali pakai dan kedaluwarsa.
- Fallback reset menghasilkan temporary password dan audit event.

## Test

1. Create ticket valid dan invalid.
2. Duplicate/replay submit tidak membuat ticket ganda jika idempotency key digunakan.
3. Tracking dengan nomor salah memberikan respons generik.
4. Rate limit public create dan tracking.
5. Approval dan rejection technician.
6. Login technician `PENDING_APPROVAL` ditolak.
7. Reset token valid, expired, dan reused.
8. Upload attachment awal dengan MIME/type/size tidak valid ditolak.

---

# Phase 3 — Admin/Head Workflow dan SLA Respond

## Durasi/Jadwal

**Minggu 5–6**

## Goals

- Membuat dashboard dasar, ticket list, dan detail ticket.
- Membuat respons awal resmi.
- Mengatur category dan priority.
- Mengaktifkan SLA Respond dari `created_at` sampai `first_responded_at`.
- Membuat warning dan breach state.
- Menampilkan timeline dan audit operasional.
- Menyiapkan assign panel untuk Phase 4.

## When Done

- Head/Admin dapat melihat semua ticket sesuai permission.
- Respons awal pertama tersimpan dengan actor dan waktu server.
- SLA Respond berhenti hanya pada respons resmi pertama.
- Edit respons tidak mengubah `first_responded_at`.
- Badge `ON_TRACK`, `WARNING`, `BREACHED`, atau `MET` tampil konsisten.
- Detail ticket menampilkan response target, deadline, elapsed, dan breach duration.
- Semua perubahan priority/category tercatat.

## Test

1. Formula SLA Respond per priority.
2. Respons sebelum deadline menghasilkan `MET`.
3. Respons setelah deadline menghasilkan `BREACHED` dan breach duration.
4. Assignment tanpa respons tidak menghentikan SLA Respond.
5. Dua request response bersamaan hanya menghasilkan satu first response timestamp.
6. Technician tidak dapat merespons ticket.
7. Scheduler memperbarui warning/breach tanpa merusak data historis.

---

# Phase 4 — Technician Execution dan SLA Pengerjaan

## Durasi/Jadwal

**Minggu 7–8**

## Goals

- Assignment satu atau lebih teknisi.
- Menentukan lead technician.
- Membuat SLA Pengerjaan per assignment member.
- Membuat My Assignments.
- Membuat accept/reject assignment bila kebijakan digunakan.
- Check-in dengan peta, koordinat, accuracy, foto, dan waktu server.
- Membuat status `ON_SITE`, `IN_PROGRESS`, dan completion per teknisi.
- Membuat resolusi ticket dan verifikasi closure.

## When Done

- Setiap teknisi aktif memiliki record SLA Pengerjaan sendiri.
- Deadline dihitung dari `assigned_at` menggunakan snapshot policy.
- Reassignment menutup instance lama dengan outcome yang benar dan membuat instance baru.
- Teknisi yang tidak ditugaskan tidak dapat melihat detail sensitif atau check-in.
- Foto check-in dan media penyelesaian tersimpan private.
- Lead atau actor berwenang dapat mengajukan ticket menjadi `RESOLVED` setelah syarat terpenuhi.
- Head/Admin dapat `CLOSE` atau `REOPEN` dengan alasan.
- Detail ticket menampilkan peta dan data per teknisi.

## Test

1. Assignment satu dan banyak teknisi.
2. Satu lead wajib dan tidak boleh lebih dari satu.
3. SLA Pengerjaan berbeda untuk setiap teknisi.
4. Completion teknisi A tidak menghentikan SLA teknisi B.
5. Reassignment menjaga histori instance lama.
6. Unauthorized technician check-in menghasilkan `403`.
7. Check-in tanpa geolocation permission ditangani sesuai policy.
8. Upload foto/video invalid ditolak.
9. Transition status invalid menghasilkan `409`.
10. Reopen ticket membuat histori dan aturan assignment baru yang jelas.

---

# Phase 5 — Operasional, Notification, dan Reporting

## Durasi/Jadwal

**Minggu 9–10**

## Goals

- Dashboard KPI SLA Respond dan SLA Pengerjaan.
- In-app notification dengan polling.
- Filter ticket dan report.
- Live report dengan pagination.
- Detail report, map link, media link sesuai permission.
- Export Excel dari query/filter yang sama.
- Audit viewer untuk Administrator.

## When Done

- Dashboard menampilkan jumlah ticket, status, SLA met/breached, dan workload teknisi.
- Notifikasi warning/breach tidak terkirim ganda untuk event yang sama.
- Live report dapat difilter berdasarkan tanggal, client, site, priority, status, Head, dan technician.
- Report menampilkan `assigned_by`, lead, anggota teknisi, check-in, completion, dan SLA individual.
- Excel memiliki data dan timezone yang sama dengan layar.
- Export kecil tersedia langsung; desain queue tersedia untuk export besar.

## Test

1. Filter kombinasi dan pagination.
2. Perbandingan row live report dengan Excel.
3. Permission media/report.
4. Notification deduplication.
5. Dashboard aggregation dengan data edge case.
6. Formula breach duration dan technician duration.
7. Export injection protection pada cell yang diawali `=`, `+`, `-`, atau `@`.

---

# Phase 6 — Hardening, UAT, Deployment, dan Handover

## Durasi/Jadwal

**Minggu 11–12**

## Goals

- Security review dan permission audit.
- Performance test flow penting.
- Logging, health check, metrics, dan alert dasar.
- Backup dan restore drill.
- Production deployment dengan HTTPS.
- UAT dengan skenario end-to-end.
- Dokumentasi operasi dan handover.

## When Done

- Tidak ada critical/high defect terbuka pada core flow.
- Seluruh permission matrix memiliki positive dan negative test.
- Backup dapat direstore pada environment uji.
- Deployment dan rollback berhasil dipraktikkan.
- Health/readiness endpoint tersedia.
- UAT sign-off tercatat.
- Runbook dan credential ownership diserahkan kepada pemilik sistem.

## Test

1. End-to-end: create → respond → assign → check-in → complete → resolve → close.
2. End-to-end breach SLA Respond.
3. End-to-end breach SLA Pengerjaan per teknisi.
4. Concurrency test pada response, assignment, dan status transition.
5. Rate limit dan brute-force test dasar.
6. Backup/restore drill.
7. Deployment smoke test.
8. Rollback smoke test.
9. UAT per role.
10. Browser responsive test pada perangkat target.

## 3. Exit Criteria MVP

MVP selesai hanya jika:

- seluruh Phase 1–6 When Done terpenuhi;
- tidak ada defect severity Critical/High;
- core E2E test lulus;
- data SLA dapat dijelaskan dan direproduksi;
- laporan layar dan Excel konsisten;
- production runbook dan rollback tersedia.
