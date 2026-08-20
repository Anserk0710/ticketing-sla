# Product Requirements Document — Sistem Ticketing, Field Service, dan SLA

## 1. Informasi Dokumen

| Item | Nilai |
|---|---|
| Nama produk | Sistem Ticketing, Field Service, dan SLA |
| Versi | 2.0.0 |
| Status | Baseline implementasi |
| Platform | Web responsive |
| Target pengguna | Client, Administrator, Head, Technician |
| Backend | NestJS + PostgreSQL + Prisma |
| Frontend | React + Vite + TypeScript + Tailwind CSS |

## 2. Latar Belakang

Keluhan client saat ini membutuhkan proses yang dapat dilacak dari laporan awal sampai pekerjaan selesai. Tanpa sistem terpusat, respons awal, penugasan teknisi, bukti kunjungan, durasi pekerjaan, dan evaluasi SLA sulit diukur secara konsisten.

Produk ini menyediakan satu alur operasional:

```text
Client membuat ticket
→ Admin/Head memberi respons awal
→ Admin/Head menugaskan teknisi
→ Teknisi check-in
→ Teknisi melakukan pekerjaan
→ Teknisi menyelesaikan assignment
→ Head/Admin memverifikasi dan menutup ticket
```

## 3. Tujuan Produk

1. Mempermudah client melaporkan keluhan melalui QR code.
2. Memastikan setiap keluhan mendapatkan respons awal yang terukur.
3. Memastikan setiap teknisi yang ditugaskan memiliki durasi pengerjaan yang dapat diukur.
4. Memberikan visibilitas status dan histori ticket kepada tim internal.
5. Menyimpan bukti lokasi, foto check-in, dan media penyelesaian.
6. Menyediakan live report dan export Excel dari sumber data yang sama.
7. Menyediakan audit trail untuk tindakan penting.

## 4. Sasaran Keberhasilan

| Sasaran | Indikator |
|---|---|
| Keluhan tercatat | Ticket memiliki kode unik dan histori awal |
| Respons awal terukur | `first_responded_at` dan status SLA Respond tersedia |
| Pengerjaan teknisi terukur | Setiap assignment member memiliki SLA Pengerjaan sendiri |
| Operasional dapat diaudit | Actor, waktu server, perubahan status, dan alasan tersimpan |
| Laporan konsisten | Data live report sama dengan export Excel |
| Akses terkendali | Endpoint memeriksa permission, bukan hanya status login |

Target angka bisnis seperti persentase SLA terpenuhi ditetapkan setelah data operasional tersedia.

## 5. Persona dan Role

### 5.1 Public / Client

Tidak wajib memiliki akun. Dapat:

- membuka form dari QR code;
- membuat ticket;
- menerima kode ticket;
- melacak status publik dengan ticket code dan nomor kontak;
- melihat respons awal dan ringkasan progres yang aman untuk publik.

### 5.2 Technician

Dapat:

- registrasi akun;
- menunggu approval;
- login setelah disetujui;
- melihat assignment miliknya;
- menerima atau menolak assignment sesuai kebijakan;
- melakukan check-in;
- mengunggah foto kedatangan;
- menandai pekerjaan dimulai;
- mengunggah bukti penyelesaian;
- menyelesaikan bagian assignment miliknya.

### 5.3 Head

Dapat:

- melihat semua ticket operasional;
- memberikan respons awal;
- mengatur prioritas dan kategori;
- menugaskan dan mengganti teknisi;
- menyetujui atau menolak registrasi teknisi;
- melihat lokasi dan media;
- memverifikasi penyelesaian;
- menutup atau membuka kembali ticket;
- melihat dashboard dan laporan.

### 5.4 Administrator

Memiliki kemampuan Head ditambah:

- mengelola user, role, dan permission;
- mengelola kategori, prioritas, dan policy SLA;
- mengelola site dan QR code;
- mengakses konfigurasi sistem dan audit log.

## 6. Scope MVP

### 6.1 Termasuk MVP

- QR landing dan public complaint form;
- pembuatan ticket code acak;
- tracking publik;
- authentication internal;
- registrasi dan approval teknisi;
- forgot password dan fallback administratif;
- dashboard operasional dasar;
- ticket list dan detail lengkap;
- respons awal oleh Admin/Head;
- assignment satu atau lebih teknisi;
- lead technician;
- check-in dengan koordinat, akurasi, alamat, foto, dan waktu server;
- status pekerjaan teknisi;
- upload bukti penyelesaian;
- ticket status log dan audit log;
- SLA Respond;
- SLA Pengerjaan per teknisi;
- notifikasi dalam aplikasi dengan polling;
- live report;
- export Excel;
- filter dasar;
- Docker deployment dan backup dasar.

### 6.2 Tidak Termasuk MVP

- aplikasi mobile native;
- jaminan 100% foto berasal dari kamera;
- anti-location-spoofing tingkat perangkat;
- WhatsApp gateway;
- WebSocket real-time;
- AI classification;
- predictive SLA;
- microservices;
- event sourcing;
- kalender jam kerja dan hari libur kompleks;
- tanda tangan digital client.

## 7. Functional Requirements

### FR-001 — Form Aduan Publik

Client mengisi:

- nama pelapor;
- nama PIC;
- nomor kontak;
- client/site dari QR atau pilihan yang diizinkan;
- alamat atau lokasi tambahan;
- kategori;
- deskripsi;
- lampiran awal opsional.

Sistem harus memvalidasi input, membatasi spam, dan membuat ticket dengan status `NEW`.

### FR-002 — Ticket Code

- Tidak menggunakan ID database.
- Tidak mudah ditebak.
- Unik.
- Dapat dibaca dan diketik ulang.
- Contoh format: `TKT-7K9M2Q`.

### FR-003 — Tracking Publik

Client memasukkan ticket code dan nomor kontak. Sistem hanya menampilkan data publik yang telah dimasking dan tidak menampilkan data internal, exact coordinate, audit log, atau media sensitif.

### FR-004 — Respons Awal

Admin/Head memberikan respons awal berisi pesan, kategori, prioritas, dan tindakan berikutnya. Respons resmi pertama menghentikan SLA Respond. Edit setelahnya tidak boleh mengubah timestamp SLA Respond pertama.

### FR-005 — Assignment Teknisi

Admin/Head dapat menugaskan satu atau lebih teknisi dan menentukan satu lead technician. Setiap teknisi mendapatkan record assignment member serta SLA Pengerjaan terpisah.

### FR-006 — Registrasi dan Approval Teknisi

Akun baru berada pada `PENDING_APPROVAL`. Teknisi belum dapat mengakses pekerjaan sebelum berstatus `APPROVED`. Approval atau rejection harus menyimpan reviewer, waktu, dan alasan.

### FR-007 — Check-in

Teknisi yang aktif pada assignment dapat check-in dengan:

- foto kedatangan;
- latitude dan longitude;
- accuracy meter;
- alamat hasil reverse geocoding jika tersedia;
- waktu device sebagai informasi;
- waktu server sebagai sumber resmi.

### FR-008 — Penyelesaian Per Teknisi

Setiap teknisi dapat menyelesaikan bagian assignment-nya dengan ringkasan pekerjaan, media bukti, lokasi opsional, dan waktu server. Penyelesaian ini menghentikan SLA Pengerjaan milik teknisi tersebut.

### FR-009 — Resolusi dan Closure Ticket

Lead technician atau Head/Admin membuat ringkasan resolusi ticket setelah pekerjaan yang diwajibkan selesai. Ticket menjadi `RESOLVED`, lalu diverifikasi oleh Head/Admin untuk menjadi `CLOSED`. Ticket dapat dibuka kembali dengan alasan.

### FR-010 — Detail Ticket Internal

Detail ticket memuat:

- identitas ticket dan client/site;
- prioritas dan kategori;
- respons awal;
- status dan timeline;
- SLA Respond;
- SLA Pengerjaan per teknisi;
- pemberi assignment;
- lead dan anggota teknisi;
- check-in, peta, koordinat, akurasi, dan foto;
- media penyelesaian;
- waktu mulai, selesai, resolved, dan closed;
- komentar internal;
- audit terkait.

### FR-011 — Live Report dan Excel

Report dapat dibuka di browser sebelum diunduh. Filter dan kolom report dijelaskan di `Reporting-Specification.md`. Export harus menggunakan filter dan query yang sama dengan live report.

### FR-012 — Notification

Notifikasi minimum:

- ticket baru;
- ticket mendekati atau melewati SLA Respond;
- assignment baru;
- assignment ditolak;
- SLA Pengerjaan mendekati atau melewati target;
- teknisi check-in;
- teknisi selesai;
- ticket resolved, closed, atau reopened;
- approval akun teknisi.

### FR-013 — Forgot Password

Reset utama menggunakan token sekali pakai dan memiliki masa berlaku. Fallback administratif hanya dapat dilakukan role berwenang, harus diaudit, dan menghasilkan temporary password yang wajib diganti.

## 8. Non-Functional Requirements

### NFR-001 — Availability

Target awal 99% pada jam operasional, tidak termasuk maintenance terjadwal.

### NFR-002 — Performance

- API list/detail normal: p95 di bawah 800 ms pada beban MVP.
- Public create ticket: p95 di bawah 1.5 detik, di luar waktu upload media.
- Live report menggunakan pagination.
- Export besar diproses melalui queue pada phase lanjutan.

### NFR-003 — Security

- HTTPS production;
- password hashing kuat;
- access token singkat dan refresh token rotation;
- permission check per endpoint;
- rate limit public endpoint;
- validasi file berlapis;
- private media access;
- audit log append-oriented.

### NFR-004 — Maintainability

- TypeScript strict;
- modular monolith;
- DTO validation;
- migration database versioned;
- OpenAPI terdokumentasi;
- unit, integration, dan end-to-end test pada flow kritis.

### NFR-005 — Time

Semua timestamp disimpan dalam UTC dan ditampilkan dalam WITA. Waktu server merupakan sumber resmi untuk SLA.

## 9. Asumsi MVP

- SLA dihitung menggunakan elapsed calendar time 24/7.
- Target SLA dapat dikonfigurasi berdasarkan priority.
- Tidak ada pause SLA pada MVP, kecuali diterapkan secara eksplisit pada phase berikutnya.
- QR code terkait dengan site atau lokasi operasional.
- Client tidak memiliki portal login pada MVP.
- Satu ticket hanya memiliki satu priority aktif, tetapi histori perubahan tersimpan.

## 10. Ketergantungan

- PostgreSQL;
- Cloudinary atau object storage setara;
- layanan reverse geocoding/maps;
- SMTP/email provider;
- Redis hanya jika queue atau cache diaktifkan;
- server Docker dan domain HTTPS.

## 11. Risiko Produk

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Definisi SLA berubah | Data laporan tidak konsisten | Versioned SLA policy dan snapshot pada ticket/assignment |
| Multiple technician ambigu | Status dan KPI salah | Lead technician dan status per assignment member |
| Upload video gagal | Flow teknisi terhenti | Retry, progress UI, ukuran maksimum, dan direct upload |
| Tracking publik ditebak | Kebocoran informasi | Ticket code acak, rate limit, respons generik, masking |
| Lokasi dimanipulasi | Bukti lapangan lemah | Simpan accuracy, waktu server, jarak site, dan disclaimer |
| Rewrite framework membesar | Timeline terlambat | Modular monolith dan migrasi per module |

## 12. Acceptance Produk Tingkat Tinggi

Produk dianggap siap MVP ketika:

1. Client dapat membuat dan melacak ticket.
2. Admin/Head dapat memberi respons awal dan sistem menghitung SLA Respond.
3. Admin/Head dapat menugaskan banyak teknisi dengan satu lead.
4. Setiap teknisi memiliki SLA Pengerjaan dan histori individual.
5. Teknisi dapat check-in dan menyelesaikan pekerjaan dengan bukti.
6. Head/Admin dapat memverifikasi dan menutup ticket.
7. Detail ticket menampilkan peta, foto, media, actor, dan seluruh timestamp penting.
8. Live report dan export Excel konsisten.
9. Permission negatif diuji.
10. Deployment, backup, logging, dan rollback dasar tersedia.
