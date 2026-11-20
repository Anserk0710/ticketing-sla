# Dokumentasi Penggunaan Ticketing SLA

Panduan fitur dan tata cara penggunaan aplikasi Ticketing SLA untuk pelapor, Administrator, Head, dan teknisi.

Dokumen ini mengikuti implementasi aplikasi yang ditinjau pada **6 Oktober 2026**. Nama tombol dan menu mengikuti tampilan aplikasi. Fungsi yang tersedia melalui API tetapi belum memiliki tombol di aplikasi dijelaskan terpisah pada bagian [Fungsi lanjutan melalui API](#14-fungsi-lanjutan-melalui-api).

## Daftar isi

1. [Gambaran umum dan fitur](#1-gambaran-umum-dan-fitur)
2. [Peran dan hak akses](#2-peran-dan-hak-akses)
3. [Persiapan dan akses aplikasi](#3-persiapan-dan-akses-aplikasi)
4. [Akun, login, dan password](#4-akun-login-dan-password)
5. [Pengaduan dan pelacakan publik](#5-pengaduan-dan-pelacakan-publik)
6. [Dashboard](#6-dashboard)
7. [Daftar dan detail tiket](#7-daftar-dan-detail-tiket)
8. [Pengelolaan tiket oleh Administrator dan Head](#8-pengelolaan-tiket-oleh-administrator-dan-head)
9. [Pelaksanaan tugas oleh teknisi](#9-pelaksanaan-tugas-oleh-teknisi)
10. [Status tiket dan perhitungan SLA](#10-status-tiket-dan-perhitungan-sla)
11. [Notifikasi](#11-notifikasi)
12. [Laporan dan ekspor Excel](#12-laporan-dan-ekspor-excel)
13. [Master Data](#13-master-data)
14. [Fungsi lanjutan melalui API](#14-fungsi-lanjutan-melalui-api)
15. [Contoh penggunaan dari awal sampai selesai](#15-contoh-penggunaan-dari-awal-sampai-selesai)
16. [Penanganan kendala dan batasan saat ini](#16-penanganan-kendala-dan-batasan-saat-ini)
17. [Istilah dan referensi](#17-istilah-dan-referensi)

## 1. Gambaran umum dan fitur

Ticketing SLA digunakan untuk menerima keluhan, menugaskan teknisi, mencatat pekerjaan lapangan, memantau batas waktu layanan, dan membuat laporan operasional.

| Fitur | Kegunaan |
|---|---|
| Pengaduan publik | Membuat tiket tanpa login melalui tautan biasa atau QR lokasi. |
| Pelacakan publik | Melihat status tiket dengan kode tiket dan nomor kontak pelapor. |
| Pengelolaan akun | Registrasi teknisi, approval, pengelolaan Head/teknisi, dan password sementara. |
| Dashboard | Memantau jumlah keluhan, aktivitas, dan indikator waktu layanan. |
| Daftar tiket | Mencari, memfilter, mengurutkan, dan membuka tiket. |
| Respons awal | Mencatat tanggapan resmi, prioritas, kategori, dan rencana tindak lanjut. |
| Penugasan | Menugaskan satu atau beberapa teknisi dengan satu lead technician. |
| Operasional lapangan | Menerima tugas, check-in GPS dengan foto, memulai, dan menyelesaikan pekerjaan. |
| Penjadwalan ulang | Mengubah tiket menjadi `PENDING` dan melanjutkannya melalui resume. |
| Penyelesaian tiket | Mengajukan resolved, memverifikasi, menutup, dan membuka kembali tiket. |
| SLA | Mengukur waktu respons per tiket dan waktu pengerjaan per teknisi. |
| Notifikasi | Memberi informasi kejadian operasional dan peringatan SLA. |
| Laporan | Meninjau laporan tiket dan SLA teknisi serta mengunduh Excel. |
| Master Data | Mengelola client, site, token QR, kategori, pengguna, dan versi kebijakan SLA. |
| Histori dan audit | Menelusuri perubahan status, penugasan, dan tindakan pengguna. |

Alur penggunaan normal:

```text
Pelapor mengirim keluhan
  → Head/Admin memberikan respons awal
  → Head/Admin menugaskan teknisi
  → Setiap teknisi menerima tugas
  → Setiap teknisi check-in dengan GPS dan foto
  → Setiap teknisi memulai pekerjaan
  → Setiap teknisi mengirim hasil dan bukti penyelesaian
  → Head/Admin mengajukan resolved
  → Head/Admin memverifikasi dan menutup tiket
```

## 2. Peran dan hak akses

Menu ditampilkan sesuai permission akun. Matriks berikut mengikuti konfigurasi peran bawaan proyek.

| Fungsi | Publik/pelapor | Administrator | Head | Technician |
|---|:---:|:---:|:---:|:---:|
| Membuat dan melacak pengaduan publik | Ya | Ya | Ya | Ya |
| Registrasi teknisi melalui halaman publik | Ya | Ya | Ya | Ya |
| Dashboard dan laporan | — | Ya | Ya | — |
| Melihat seluruh tiket | — | Ya | Ya | — |
| Melihat tiket yang terkait penugasannya | — | Ya | Ya | Ya |
| Respons awal dan penugasan | — | Ya | Ya | — |
| Reschedule, resume, resolve, close, reopen | — | Ya | Ya | — |
| Menerima dan menjalankan tugas sendiri | — | Sesuai penugasan/peran teknisi | — | Ya |
| Approval registrasi teknisi | — | Ya | Ya | — |
| Membaca Master Data | — | Ya | Ya | — |
| Mengubah Master Data dan akun Head/teknisi | — | Ya | — | — |
| Membuat versi kebijakan SLA | — | Ya | — | — |
| Notifikasi akun sendiri | — | Ya | Ya | Ya |
| Audit melalui API | — | Ya | Ya | — |

**Lead technician** adalah penanggung jawab dalam satu penugasan, bukan peran akun tersendiri. Pada implementasi saat ini, teknisi termasuk lead menyelesaikan bagiannya melalui menu **My Assignments**; tindakan resolve dan close tiket dilakukan Administrator atau Head.

## 3. Persiapan dan akses aplikasi

### 3.1 Persiapan pengguna

1. Dapatkan alamat aplikasi dari Administrator.
2. Gunakan browser pada komputer atau smartphone dengan koneksi ke server aplikasi.
3. Untuk pekerjaan lapangan, aktifkan layanan lokasi perangkat dan izinkan akses lokasi pada browser.
4. Siapkan foto/video sesuai [ketentuan lampiran](#54-ketentuan-foto-dan-video).
5. Pengguna internal harus memiliki akun berstatus `APPROVED`.

Check-in membutuhkan geolocation browser. Gunakan alamat HTTPS yang sertifikatnya dipercaya perangkat; akses development melalui `localhost` dapat digunakan pada perangkat server itu sendiri. Alamat `localhost` di smartphone menunjuk ke smartphone, bukan ke server aplikasi.

### 3.2 Alamat halaman

Tambahkan path berikut setelah alamat aplikasi. Contoh: `https://ticketing-demo.test/login`.

| Halaman | Path | Pengguna |
|---|---|---|
| Pengaduan tanpa QR | `/complaint` | Publik |
| Pengaduan dari QR | `/complaint/{qrToken}` | Publik |
| Pelacakan tiket | `/track` | Publik |
| Login | `/login` | Internal |
| Registrasi teknisi | `/register-technician` | Calon teknisi |
| Lupa password | `/forgot-password` | Pemilik akun |
| Reset dengan token | `/reset-password` | Pemilik token reset |
| Ganti password sementara | `/change-password` | Akun yang diwajibkan mengganti password |
| Dashboard | `/app/dashboard` | Administrator/Head |
| Tickets | `/app/tickets` | Internal sesuai akses |
| Detail tiket | `/app/tickets/{id}` | Internal sesuai akses |
| My Assignments | `/app/assignments` | Teknisi |
| Approval Teknisi | `/app/approvals` | Administrator/Head |
| Reports | `/app/reports` | Administrator/Head |
| Master Data | `/app/settings` | Administrator/Head sesuai permission |
| Notifikasi | `/app/notifications` | Internal |

`{id}` pada URL internal adalah ID data tiket, bukan kode tiket seperti `TKT-DEMO01`. Buka detail melalui tautan tiket agar ID terisi dengan benar.

Konfigurasi demo menggunakan `https://ticketing-demo.test`; development lokal menggunakan `http://localhost:5173`. Alamat tersebut bergantung pada pemasangan server. Halaman `/` saat ini mengarah ke pengaduan QR demo `DEMO-SITE-QR`, sehingga untuk lokasi lain gunakan tautan QR yang sesuai atau `/complaint`.

### 3.3 Navigasi

Setelah login, gunakan menu di sisi kiri. Pada layar kecil, buka ikon menu untuk menampilkan navigasi. Ikon lonceng membuka notifikasi; angka pada lonceng menunjukkan jumlah notifikasi yang belum dibaca. Gunakan tombol keluar pada navigasi untuk mengakhiri sesi.

Panduan pemasangan server dan akun demo tersedia di [README](README.md). Dokumen ini berfokus pada penggunaan aplikasi setelah server tersedia.

## 4. Akun, login, dan password

### 4.1 Login

1. Buka `/login`.
2. Masukkan email dan password akun.
3. Kirim formulir login.
4. Administrator/Head masuk ke dashboard dan teknisi ke halaman tugas, kecuali sedang membuka tautan tujuan tertentu yang diizinkan.
5. Jika akun memakai password sementara, selesaikan penggantian password terlebih dahulu.

Akun yang masih menunggu approval, ditolak, ditangguhkan, atau dinonaktifkan tidak dapat digunakan untuk login operasional.

### 4.2 Registrasi teknisi

1. Buka `/register-technician`.
2. Isi **Nama lengkap**, **Email**, dan **Nomor telepon**.
3. Isi **Kode pegawai** jika tersedia.
4. Buat password minimal **8 karakter**.
5. Klik **Kirim Registrasi**.
6. Setelah muncul **Registrasi diterima**, tunggu persetujuan Administrator atau Head.
7. Setelah disetujui, login menggunakan email dan password yang didaftarkan.

Formulir registrasi publik belum menyediakan input keahlian. Administrator dapat melengkapinya melalui **Master Data → Users**.

### 4.3 Approval atau penolakan registrasi

**Pelaksana:** Administrator atau Head.

1. Buka **Approval Teknisi**.
2. Periksa nama, email, nomor telepon, kode pegawai, keahlian yang tercatat, dan waktu registrasi.
3. Klik **Approve** untuk menyetujui akun.
4. Untuk menolak, klik **Reject**, isi **Alasan penolakan**, lalu klik **Konfirmasi**. Gunakan alasan minimal 3 karakter.
5. Gunakan **Batal** jika penolakan tidak dilanjutkan.

Registrasi yang sudah diproses tidak lagi tampil dalam daftar approval tertunda. Penolakan registrasi akun tetap tersedia; penolakan tiket atau penolakan tugas operasional tidak tersedia dalam alur saat ini.

### 4.4 Mengganti password sementara

1. Login menggunakan password sementara dari Administrator.
2. Pada halaman **Ganti password**, isi **Password saat ini**.
3. Isi **Password baru** minimal 8 karakter dan konfirmasinya dengan nilai yang sama.
4. Klik **Ganti password**.
5. Setelah berhasil, login kembali dengan password baru.

Halaman `/change-password` saat ini khusus akun yang memiliki kewajiban mengganti password. Akun tanpa kewajiban tersebut akan diarahkan kembali ke halaman utama perannya.

### 4.5 Lupa dan reset password

1. Buka **Lupa password** atau `/forgot-password`.
2. Masukkan email akun, lalu klik **Kirim Instruksi**.
3. Pada lingkungan non-production, jika tersedia **Token demo**, klik **Lanjutkan reset password**.
4. Pada halaman reset, pastikan token terisi, masukkan password baru minimal 8 karakter dan konfirmasinya.
5. Klik **Simpan password baru**, lalu login kembali.

Token berlaku **30 menit** dan hanya dapat digunakan sekali. Respons permintaan reset dibuat sama untuk email terdaftar maupun tidak terdaftar.

**Batas implementasi:** pengiriman email reset password belum terhubung pada layanan autentikasi saat ini. Jika token demo tidak tersedia, hubungi Administrator untuk membuat password sementara melalui **Master Data → Users → Reset**. Jangan menganggap pesan “instruksi akan dikirim” sebagai bukti email sudah terkirim.

## 5. Pengaduan dan pelacakan publik

### 5.1 Membuat pengaduan melalui QR

1. Pindai QR lokasi menggunakan perangkat, lalu buka tautannya.
2. Pastikan client, nama site, dan alamat pada formulir sesuai lokasi keluhan.
3. Isi data berikut.

| Isian | Ketentuan |
|---|---|
| Nama Pelapor | Wajib; minimal 2 karakter. |
| Nomor kontak | Wajib; minimal 7 digit, hanya angka tanpa spasi atau simbol. |
| Nama PIC | Wajib; minimal 2 karakter; orang yang dapat ditemui di lokasi. |
| Detail Lokasi Spesifik | Opsional; isi ruangan, lantai, atau posisi perangkat agar mudah ditemukan. |
| Kategori Gangguan | Pilih jika diketahui; boleh dibiarkan belum diketahui/umum. |
| Deskripsi Kendala | Wajib; minimal 5 karakter. Jelaskan gejala, waktu kejadian, dan dampaknya. |
| Bukti keluhan | Wajib; minimal satu foto atau video. |

4. Pilih lampiran. Beberapa file dapat ditambahkan; hapus file yang salah melalui ikon **X** sebelum pengiriman.
5. Kirim laporan dan tunggu sampai unggahan serta pembuatan tiket selesai.
6. Setelah berhasil, simpan kode tiket yang ditampilkan. Gunakan **Salin Kode Tiket** bila diperlukan.
7. Klik **Lacak Status Tiket** untuk membuka pelacakan, atau **Kirim Laporan Lain** untuk membuat laporan berikutnya.

Contoh deskripsi: “Jaringan internet ruang administrasi lantai 2 terputus sejak pukul 09.15. Lima komputer tidak dapat membuka aplikasi layanan.”

### 5.2 Membuat pengaduan tanpa QR

1. Buka `/complaint`.
2. Pilih **Site / Lokasi Layanan** dari daftar.
3. Lengkapi identitas, deskripsi, dan bukti dengan langkah yang sama seperti pengaduan melalui QR.
4. Kirim dan simpan kode tiket.

Saat menggunakan URL QR, lokasi ditentukan oleh token QR. Untuk melaporkan lokasi berbeda, gunakan QR yang benar atau formulir tanpa QR.

### 5.3 Melacak tiket

1. Buka `/track`.
2. Masukkan **Kode ticket** yang diterima setelah pengaduan berhasil.
3. Masukkan **Nomor kontak** yang digunakan ketika membuat pengaduan.
4. Klik **Lacak Ticket**.
5. Baca status terbaru, client/site, waktu pembuatan, waktu respons awal, prioritas, deskripsi, dan timeline perkembangan.
6. Jika tiket dijadwalkan ulang, periksa tanggal dan waktu pada bagian **Perubahan Jadwal**.

Pelacakan publik tidak menampilkan seluruh data internal, catatan internal, rincian GPS teknisi, atau seluruh bukti lapangan. Untuk memperbarui hasil, lakukan pelacakan kembali.

### 5.4 Ketentuan foto dan video

| Penggunaan | Jumlah | Format pada formulir |
|---|---|---|
| Bukti pengaduan publik | Minimal 1; dapat beberapa file | JPG/JPEG, PNG, WEBP, MP4, MOV, WEBM. |
| Foto check-in | Tepat 1 foto | JPG/JPEG, PNG, WEBP; video tidak diterima. |
| Bukti penyelesaian teknisi | Minimal 1; dapat beberapa file | JPG/JPEG, PNG, WEBP; MP4, MOV, 3GP, 3G2, WEBM, AVI, MKV, M4V, OGV, MPEG/MPG. |

Batas per file adalah **10 MB untuk gambar** dan **100 MB untuk video**. File diperiksa oleh server, sehingga mengganti ekstensi file tidak mengubah format sebenarnya. Foto HEIC tidak termasuk format foto yang didukung; konversikan ke JPEG/PNG/WEBP sebelum mengunggah.

Pastikan unggahan berhasil sebelum meninggalkan halaman. Jika koneksi terputus, periksa pesan hasil terlebih dahulu sebelum mengirim ulang untuk menghindari laporan ganda.

## 6. Dashboard

**Pelaksana:** Administrator dan Head. Buka **Dashboard**.

| Informasi | Cara membaca |
|---|---|
| Total Keluhan | Jumlah tiket yang tercatat. |
| Keluhan Baru | Tiket dengan status `NEW`. |
| Aktif & Tertunda | Gabungan `ASSIGNED`, `ON_SITE`, `IN_PROGRESS`, `REOPENED`, dan `PENDING`. Angka ini tidak mencakup seluruh status yang belum ditutup. |
| Kecepatan Respons | Rata-rata jam sejak tiket dibuat sampai respons awal; tiket belum direspons dihitung sampai waktu sekarang. |
| Kecepatan Selesai | Rata-rata jam sejak penugasan sampai resolved; tiket yang sudah ditugaskan tetapi belum resolved dihitung sampai waktu sekarang. |
| Keluhan terbaru yang masuk | Daftar tiket terbaru; klik kode tiket untuk membuka detail atau **Lihat semua** untuk daftar lengkap. |
| Perhitungan SLA | Indikator persentase yang disediakan dashboard. |

**Catatan pembacaan persentase:** implementasi indikator dashboard saat ini membandingkan rata-rata waktu respons terhadap acuan 2 jam, serta rata-rata waktu penyelesaian terhadap rata-rata target pengerjaan. Nilainya bukan persentase langsung jumlah tiket ber-outcome `MET`. Gunakan detail SLA dan laporan per tiket/per teknisi untuk memeriksa pencapaian deadline masing-masing.

## 7. Daftar dan detail tiket

### 7.1 Mencari dan memfilter

1. Buka **Tickets**.
2. Ketik kode tiket, client, site, nama pelapor, PIC, atau bagian deskripsi pada kolom pencarian.
3. Pilih status pada filter jika ingin mempersempit hasil, misalnya `NEW`, `PENDING`, atau `CLOSED`.
4. Untuk mengembalikan hasil lengkap, kosongkan kata kunci dan pilih **Semua status ticket**.
5. Gunakan **Sebelumnya** dan **Berikutnya** untuk berpindah halaman.

Hasil pencarian mengikuti hak akses: Administrator/Head melihat seluruh tiket, sedangkan teknisi melihat tiket terkait penugasannya.

### 7.2 Mengurutkan daftar

Klik judul kolom **Ticket**, **Client**, **Site**, **Priority**, **Status**, atau **Dibuat**. Klik kembali untuk membalik arah urutan. Secara default, tiket terbaru ditampilkan lebih dahulu.

### 7.3 Membaca detail tiket

Klik kode tiket pada daftar. Periksa identitas dan lokasi keluhan, deskripsi, prioritas/status, respons yang tercatat, SLA respons, ringkasan SLA pengerjaan, histori penugasan/anggota, waktu check-in dan penyelesaian, serta timeline status.

Bukti yang terkait tiket tersedia sesuai data dan hak akses. Tombol tindakan di detail hanya muncul jika peran dan status tiket mengizinkan. Tidak munculnya tombol dapat berarti tahap sebelumnya belum selesai atau tindakan tidak tersedia untuk akun tersebut.

## 8. Pengelolaan tiket oleh Administrator dan Head

### 8.1 Memberikan respons awal

**Prasyarat:** tiket berstatus `NEW`.

1. Buka detail tiket dan baca keluhan beserta bukti yang tersedia.
2. Isi **Respons awal**, minimal 3 karakter.
3. Pilih **Prioritas** yang sesuai tingkat gangguan.
4. Pilih **Kategori** jika perlu dan isi **Tindakan berikutnya** bila tersedia.
5. Klik **Kirim Respons Awal**.
6. Pastikan status berubah menjadi `RESPONDED` dan waktu respons tercatat.

Respons awal resmi menghentikan SLA Respond. Komentar internal, penugasan, dan penjadwalan ulang tidak menggantikan respons awal. Perubahan prioritas pada respons tidak menghitung ulang deadline SLA Respond yang sudah dibuat.

### 8.2 Menugaskan teknisi

**Prasyarat:** tiket berstatus `RESPONDED` atau `REOPENED`.

1. Buka bagian penugasan pada detail tiket.
2. Centang satu atau beberapa nama pada **Pilih teknisi**.
3. Pilih satu **Lead technician** dari teknisi yang dipilih.
4. Isi **Catatan assignment** jika ada instruksi tambahan.
5. Klik **Assign Teknisi**.
6. Pastikan tiket berstatus `ASSIGNED` dan penugasan aktif tampil.

Setiap teknisi menjalankan workflow dan memiliki SLA pengerjaan sendiri. Penugasan belum memulai timer pengerjaan; timer dimulai saat check-in pertama berhasil. Jika teknisi tidak tersedia pada daftar, periksa status akun dan profilnya di Master Data.

Pergantian teknisi pada penugasan aktif tersedia melalui API; belum ada formulir reassign di detail web saat ini. Lihat [bagian 14](#14-fungsi-lanjutan-melalui-api).

### 8.3 Menjadwalkan ulang atau menunda tiket

**Prasyarat:** tiket berstatus `NEW`, `RESPONDED`, `ASSIGNED`, `ON_SITE`, `IN_PROGRESS`, atau `REOPENED`.

1. Buka bagian **Reschedule** pada detail tiket.
2. Isi **Alasan reschedule**, minimal 5 karakter, misalnya menunggu akses ruangan atau suku cadang.
3. Isi **Jadwal baru** berupa tanggal dan waktu.
4. Klik **Reschedule**.
5. Pastikan tiket berubah menjadi `PENDING` dan informasi jadwal tampil.

Selama `PENDING`, teknisi tidak dapat menerima tugas, check-in, memulai, atau menyelesaikan pekerjaan. Reassign juga perlu menunggu resume. **SLA yang sudah berjalan tetap dihitung**; jadwal baru tidak memindahkan deadline dan tidak menjeda timer.

Input tanggal/jam menggunakan waktu lokal browser, sedangkan tampilan tanggal aplikasi menggunakan WITA. Periksa hasil jadwal setelah disimpan, khususnya jika perangkat berada di zona waktu berbeda.

### 8.4 Melanjutkan tiket yang pending

1. Buka detail tiket berstatus `PENDING`.
2. Baca perkiraan status tujuan pada bagian **Resume Ticket**.
3. Isi **Catatan resume** jika diperlukan.
4. Klik **Resume Ticket**.
5. Periksa status dan koordinasikan kelanjutan tugas dengan teknisi.

| Status sebelum pending | Status tiket setelah resume |
|---|---|
| `NEW` atau `RESPONDED` | `RESPONDED` |
| `ASSIGNED`, `ON_SITE`, `IN_PROGRESS`, atau `REOPENED` | `ASSIGNED` |

Resume membersihkan alasan pending dan jadwal aktif. Histori penjadwalan tetap tercatat. Resume tidak otomatis membuat penugasan, mengulang check-in, atau memulai ulang SLA. Status anggota teknisi tetap mengikuti catatan pekerjaannya.

**Batas alur saat ini:** resume dari `NEW` dapat menghasilkan status `RESPONDED` tanpa mencatat respons awal resmi. Karena itu, berikan respons awal sebelum melakukan reschedule bila memungkinkan. Jika tiket telanjur masuk kondisi tersebut, minta Administrator meninjau data respons/SLA. Resume dari pekerjaan yang sudah berjalan juga mengembalikan status tiket ke `ASSIGNED`; bila kelanjutan tindakan terhambat, gunakan penanganan Administrator pada [bagian kendala](#16-penanganan-kendala-dan-batasan-saat-ini).

### 8.5 Mengajukan tiket resolved

**Prasyarat:** tiket berstatus `IN_PROGRESS` dan seluruh teknisi aktif yang wajib menyelesaikan pekerjaan telah menjalankan check-in, mulai pekerjaan, dan completion.

1. Periksa ringkasan hasil serta bukti penyelesaian teknisi.
2. Pastikan seluruh anggota wajib berstatus `COMPLETED`.
3. Isi **Ringkasan resolusi**, minimal 3 karakter.
4. Klik **Ajukan Resolved**.
5. Pastikan tiket berubah menjadi `RESOLVED` atau **Menunggu Verifikasi** pada tracking publik.

Minimal satu teknisi aktif harus diwajibkan untuk resolusi. Tidak tersedia override resolve untuk melewati workflow wajib. Completion satu teknisi tidak menyelesaikan pekerjaan teknisi lainnya dan tidak otomatis menutup tiket.

### 8.6 Memverifikasi dan menutup tiket

1. Buka tiket berstatus `RESOLVED`.
2. Verifikasi bahwa keluhan sudah ditangani berdasarkan hasil pekerjaan dan bukti.
3. Klik **Verifikasi & Close**.
4. Pastikan status menjadi `CLOSED`; pelapor melihat status **Selesai**.

Tombol web menyimpan catatan verifikasi standar. Catatan verifikasi khusus dapat diberikan melalui API close.

### 8.7 Membuka kembali tiket

**Prasyarat:** tiket berstatus `RESOLVED` atau `CLOSED`.

1. Buka detail tiket.
2. Isi **Alasan reopen**, minimal 3 karakter, yang menjelaskan masalah lanjutan.
3. Klik **Reopen Ticket**.
4. Pastikan status menjadi `REOPENED`.
5. Lakukan penugasan kembali melalui **Assign Teknisi**.

Histori siklus sebelumnya tetap tersimpan. SLA Respond awal tidak dimulai ulang; teknisi pada penugasan baru memulai SLA pengerjaan baru saat check-in.

## 9. Pelaksanaan tugas oleh teknisi

### 9.1 Melihat tugas

1. Login sebagai teknisi dan buka **My Assignments** atau halaman **Tugas Saya**.
2. Periksa kode tiket, lokasi, peran lead/member, status tugas, dan informasi SLA.
3. Klik tautan kode tiket jika membutuhkan detail keluhan.
4. Jika tampil informasi pending/reschedule, tunggu Administrator/Head melakukan resume.

### 9.2 Menerima tugas

1. Pada tugas berstatus anggota `ASSIGNED`, klik **Terima Tugas**.
2. Pastikan status anggota menjadi `ACCEPTED`.
3. Lanjutkan perjalanan dan persiapan sesuai instruksi penugasan.

Check-in hanya dapat dilakukan setelah tugas diterima. Alur saat ini tidak menyediakan tombol tolak tugas; koordinasikan kendala penugasan kepada Head/Administrator.

### 9.3 Check-in di lokasi

1. Tiba di lokasi pekerjaan dan buka tugas yang sudah diterima.
2. Buka tindakan **Check-in**.
3. Isi **Alamat/keterangan lokasi** bila perlu, misalnya patokan gedung atau ruangan.
4. Pilih tepat **satu foto kedatangan** berformat JPEG, PNG, atau WEBP.
5. Klik **Check-in**, lalu izinkan akses lokasi saat browser memintanya.
6. Tunggu pengambilan koordinat, unggahan foto, dan penyimpanan check-in selesai.
7. Pastikan status anggota berubah menjadi `ON_SITE` dan SLA pengerjaan mulai berjalan.
8. Gunakan **Lihat Data Check-in** untuk memeriksa data yang telah tersimpan.

Sistem mencatat koordinat, akurasi lokasi, waktu, keterangan, foto, dan jarak terhadap koordinat site jika tersedia. Waktu server menjadi acuan resmi. Radius check-in dapat dicatat pada Master Data, tetapi implementasi check-in saat ini belum menolak otomatis berdasarkan radius tersebut.

### 9.4 Memulai pekerjaan

1. Pastikan check-in sudah berhasil dan status anggota `ON_SITE`.
2. Klik **Mulai Pekerjaan**.
3. Pastikan status anggota menjadi `IN_PROGRESS`.

Timer SLA telah berjalan sejak check-in; tombol ini mencatat awal pekerjaan teknis dan tidak mengulang timer.

### 9.5 Menyelesaikan pekerjaan

1. Setelah pekerjaan selesai, pada tugas berstatus `IN_PROGRESS`, klik **Selesaikan**.
2. Isi **Ringkasan pekerjaan** secara jelas: tindakan, hasil pemeriksaan, dan kondisi akhir.
3. Tambahkan minimal satu foto atau video pada **Bukti penyelesaian**.
4. Periksa daftar file dan hapus lampiran yang salah sebelum dikirim.
5. Klik **Kirim** dan tunggu proses selesai.
6. Pastikan status anggota menjadi `COMPLETED`.

SLA pengerjaan teknisi tersebut berhenti pada completion yang berhasil. Administrator/Head selanjutnya mengajukan resolved dan melakukan verifikasi penutupan tiket.

### 9.6 Tugas dengan beberapa teknisi

Setiap teknisi harus menerima tugas, check-in, memulai pekerjaan, serta mengirim completion sendiri. Contohnya, teknisi A sudah bekerja sementara teknisi B baru menerima tugas: B tetap dapat melakukan check-in selama tiket masih operasional. Keberhasilan atau keterlambatan A dan B dihitung terpisah.

## 10. Status tiket dan perhitungan SLA

### 10.1 Status tiket

| Status internal | Label publik | Makna |
|---|---|---|
| `NEW` | Dalam Antrian | Pengaduan baru dibuat. |
| `RESPONDED` | Sudah Direspons | Tahap setelah respons; perhatikan pengecualian resume dari `NEW`. |
| `ASSIGNED` | Teknisi Ditugaskan | Penanganan berada pada tahap penugasan; juga status tujuan resume operasional. |
| `ON_SITE` | Sedang Dikerjakan | Teknisi pertama sudah check-in. |
| `IN_PROGRESS` | Sedang Dikerjakan | Pekerjaan telah dimulai. |
| `PENDING` | Dijadwalkan Ulang | Aktivitas teknisi ditunda sampai resume. |
| `RESOLVED` | Menunggu Verifikasi | Hasil penanganan telah diajukan untuk verifikasi. |
| `CLOSED` | Selesai | Tiket sudah diverifikasi dan ditutup. |
| `REOPENED` | Sedang Dikerjakan | Tiket dibuka kembali untuk penanganan berikutnya. |
| `CANCELLED` | Dibatalkan | Penanganan dihentikan melalui fungsi pembatalan. |
| `REJECTED` | Ditolak | Status histori lama; bukan pilihan tindakan operasional baru. |

Status anggota teknisi berbeda dari status tiket:

```text
ASSIGNED → ACCEPTED → ON_SITE → IN_PROGRESS → COMPLETED
```

Status `REMOVED` dan `REASSIGNED` menandai anggota yang dikeluarkan atau diganti. Status tiket adalah kondisi keseluruhan, sementara status anggota menggambarkan kemajuan masing-masing teknisi.

### 10.2 Dua jenis SLA

| Aspek | SLA Respond | SLA Pengerjaan |
|---|---|---|
| Diukur untuk | Satu tiket | Setiap anggota penugasan teknisi |
| Mulai | Saat tiket dibuat | Saat check-in pertama berhasil |
| Berhenti normal | Respons awal resmi pertama | Completion teknisi berhasil |
| Sebelum check-in | Tidak terkait tahap check-in | Belum dimulai; dapat tampil `NOT_STARTED` |
| Saat pending | Tetap berjalan jika belum selesai | Tetap berjalan jika sudah dimulai |
| Setelah reopen | Tidak dimulai ulang | Penugasan baru memiliki timer baru saat check-in |

Perhitungan menggunakan waktu kalender **24 jam, 7 hari**, termasuk di luar jam kerja. Tampilan tanggal menggunakan **WITA (UTC+8)**. Durasi singkat memakai `h` untuk hari, `j` untuk jam, dan `m` untuk menit; contoh `1h 2j 15m` berarti 1 hari 2 jam 15 menit.

### 10.3 Target bawaan

Nilai berikut berasal dari data awal/demo. Administrator dapat membuat kebijakan baru; periksa kebijakan yang berlaku di **Master Data → SLA Policy**.

| Prioritas | Target respons | Target pengerjaan per teknisi |
|---|---:|---:|
| CRITICAL | 15 menit | 2 jam |
| HIGH | 30 menit | 4 jam |
| MEDIUM | 1 jam | 8 jam |
| LOW | 4 jam | 24 jam |

Peringatan bawaan dimulai setelah **75%** target terpakai. Contoh target 4 jam: warning setelah 3 jam, deadline setelah 4 jam.

### 10.4 Membaca status dan hasil SLA

| Nilai | Arti |
|---|---|
| `NOT_STARTED` | SLA pengerjaan belum dimulai karena belum check-in. |
| `OPEN` | Timer berjalan dan belum masuk ambang peringatan. |
| `WARNING` | Timer mendekati deadline sesuai persentase warning. |
| `BREACHED` | Deadline sudah terlewati. |
| `COMPLETED` | Timer selesai; lihat outcome untuk hasil akhirnya. |
| `MET` | Selesai pada atau sebelum deadline. |
| `COMPLETED_BREACHED` | Pengerjaan selesai setelah deadline. |
| `ENDED` | Timer diakhiri; lihat outcome penyebabnya. |
| `REASSIGNED`, `REMOVED`, `CANCELLED` | Timer berakhir karena pergantian, pengeluaran anggota, atau pembatalan. |

SLA pengerjaan pada tiket merangkum anggota terkait, tetapi evaluasi setiap teknisi tetap harus dibaca per anggota. Durasi **sejak penugasan** pada laporan dapat lebih panjang daripada durasi SLA **sejak check-in**.

Contoh: teknisi ditugaskan pukul 09.00, check-in pukul 10.00, dan memiliki target 4 jam. Deadline pengerjaan adalah pukul 14.00. Jika selesai pukul 13.30, durasi sejak penugasan 4 jam 30 menit, durasi SLA 3 jam 30 menit, dan hasilnya `MET`.

### 10.5 Perubahan kebijakan

SLA menyimpan versi kebijakan dan target yang digunakan. Membuat policy baru tidak otomatis menghitung ulang SLA yang sudah berjalan. SLA Respond menggunakan kebijakan ketika tiket dibuat. SLA pengerjaan mulai pada check-in dan memilih versi kebijakan yang efektif pada waktu penugasan untuk prioritas tiket yang digunakan saat check-in.

Karena itu, hindari menafsirkan prioritas tiket yang terlihat sekarang sebagai jaminan bahwa seluruh SLA historis menggunakan target yang sama. Baca snapshot/target pada rincian SLA atau laporan.

## 11. Notifikasi

### 11.1 Membaca notifikasi

1. Klik ikon lonceng atau buka `/app/notifications`.
2. Baca judul, isi, dan waktu notifikasi.
3. Klik notifikasi untuk membuka tiket atau tujuan terkait jika tersedia.
4. Notifikasi yang belum dibaca akan ditandai dibaca saat diklik.
5. Klik **Tandai Semua Dibaca** untuk menandai seluruh notifikasi akun sebagai dibaca.

Contoh kejadian yang menghasilkan notifikasi adalah tiket baru, penugasan, check-in, completion, perubahan status tertentu, serta warning dan breach SLA. Daftar penerima mengikuti kejadian dan peran akun. Jangan mengasumsikan setiap perubahan selalu menghasilkan notifikasi.

Notifikasi diperbarui melalui polling; badge jumlah belum dibaca diperiksa setiap sekitar **30 detik**. Pembaruan tidak selalu muncul seketika.

### 11.2 Notifikasi email

Email tiket baru ditujukan kepada Administrator/Head yang memenuhi syarat penerima, apabila SMTP dikonfigurasi pada server. Tautan email mengarah ke detail tiket dan tetap membutuhkan login yang berwenang.

Pengiriman email merupakan proses tambahan. Jika email tidak terkirim, periksa tiket pada aplikasi dan notifikasi internal. Pengaturan SMTP dilakukan oleh pengelola server, bukan melalui menu Master Data. Dukungan email tiket baru ini terpisah dari fitur lupa password.

## 12. Laporan dan ekspor Excel

**Pelaksana:** Administrator dan Head. Buka **Reports**.

### 12.1 Report Ticket

1. Pilih tab **Report Ticket**.
2. Gunakan pencarian berdasarkan kode tiket, pelapor, atau PIC.
3. Pilih status untuk mempersempit hasil.
4. Periksa client/site, status, petugas yang merespons, SLA Respond, SLA Work agregat, lead, dan waktu pembuatan.

Pencarian laporan memiliki cakupan lebih sempit daripada pencarian pada menu Tickets. Untuk mencari berdasarkan client/site langsung, gunakan Tickets atau filter API laporan.

### 12.2 SLA Teknisi

1. Pilih tab **SLA Teknisi**.
2. Terapkan pencarian atau filter status tiket.
3. Periksa setiap baris anggota penugasan: teknisi, lead/member, waktu assigned, check-in, completed, outcome SLA, dan durasi breach.

Satu tiket dengan beberapa teknisi dapat menghasilkan beberapa baris. Histori penugasan juga perlu diperhatikan agar pekerjaan dari siklus berbeda tidak dianggap satu pekerjaan yang sama.

### 12.3 Export Excel

1. Atur kata kunci dan status yang diperlukan.
2. Klik **Export Excel** dan tunggu unduhan selesai.
3. Buka file `ticket-report-YYYY-MM-DD.xlsx` dari folder unduhan browser.
4. Gunakan worksheet berikut.

| Worksheet | Isi |
|---|---|
| `Summary` | Ringkasan operasional dan SLA. |
| `Tickets` | Rincian tiket. |
| `Technician SLA` | Rincian penugasan dan SLA teknisi. |
| `Filters & Metadata` | Filter dan metadata pembuatan laporan. |

Tombol export menghasilkan workbook gabungan tersebut, baik saat tab Report Ticket maupun SLA Teknisi aktif. Filter pencarian/status ikut digunakan.

Tabel web saat ini meminta **maksimal 100 baris pada halaman pertama**, tanpa kontrol halaman laporan lanjutan. Ekspor mengambil seluruh baris yang cocok dengan filter, sehingga jumlah baris Excel dapat lebih banyak daripada tabel layar.

## 13. Master Data

Administrator dapat mengubah data sesuai permission. Head dapat membaca tab yang diizinkan. Urutan persiapan awal yang disarankan adalah **client → site → QR → kategori/policy → akun teknisi → approval → operasional tiket**.

### 13.1 Clients

1. Buka **Master Data → Clients**.
2. Klik **Tambah Client**.
3. Isi **Kode**, **Nama Client**, dan **Status**.
4. Klik **Buat Client**.
5. Untuk mengubah data, klik **Edit**, sesuaikan isian, lalu **Simpan Perubahan**.

Gunakan kode yang unik. Pilihan **Nonaktif** tersedia melalui formulir edit; tidak ada tombol hapus client pada menu ini.

### 13.2 Sites

1. Buka **Master Data → Sites & QR**.
2. Klik **Tambah Site**.
3. Pilih client, kemudian isi **Kode Site**, **Nama Site**, dan **Alamat**.
4. Lengkapi **Latitude (GPS)**, **Longitude (GPS)**, serta **Radius Check-in (meter)** jika tersedia.
5. Pilih status, lalu klik **Buat Site**.
6. Gunakan **Edit** dan **Simpan Perubahan** untuk memperbarui data.

Koordinat site membantu pencatatan jarak check-in dan menyediakan tautan peta saat ditampilkan. Radius adalah data konfigurasi; saat ini belum menjadi aturan penolakan check-in otomatis.

### 13.3 Token dan tautan QR

1. Pada site yang sesuai, klik tombol jumlah **QR Code** untuk membuka daftarnya.
2. Klik **Generate QR Code Baru**.
3. Gunakan token yang dibuat otomatis atau isi token unik.
4. Klik **Simpan QR**.
5. Klik ikon salin untuk menyalin URL pengaduan lengkap.
6. Klik **Buka URL Complaint** untuk memastikan formulir mengarah ke lokasi yang benar.

Fungsi ini membuat **token dan tautan pengaduan**. Menu saat ini belum menyediakan gambar QR siap unduh/cetak. Jika membutuhkan label QR fisik, pengelola perlu mengubah URL tersebut menjadi gambar QR menggunakan alat organisasi, lalu memverifikasi hasil pindainya.

Daftar menampilkan status aktif serta waktu kedaluwarsa bila ada. Formulir web pembuatan QR belum menyediakan pengaturan kedaluwarsa atau pencabutan token lama; membuat token baru tidak otomatis menonaktifkan token sebelumnya.

### 13.4 Kategori dan prioritas

1. Buka **Master Data → Kategori**.
2. Pada bagian Kategori, klik **Tambah**.
3. Isi **Kode**, **Nama Kategori**, **Urutan Tampil**, dan **Status**.
4. Klik **Buat Kategori**.
5. Gunakan **Edit** untuk mengubah kategori dan klik **Simpan**.

Pada tab yang sama terdapat daftar prioritas beserta label dan target SLA. Daftar prioritas bersifat baca saja di UI. Target waktunya dikelola melalui tab **SLA Policy**.

### 13.5 Menambah akun Head atau teknisi

1. Buka **Master Data → Users**, lalu klik **Tambah User**.
2. Isi nama, email, dan nomor HP jika diperlukan.
3. Pilih role **Head** atau **Teknisi**.
4. Tentukan status akun. Pilih `APPROVED` untuk akun yang sudah diizinkan login.
5. Untuk teknisi, lengkapi **Kode Teknisi**, **Keahlian**, dan **Ketersediaan**. Pisahkan beberapa keahlian dengan koma, misalnya `Network, Hardware`.
6. Klik **Buat User**.
7. Salin password sementara dari hasil yang ditampilkan dan sampaikan kepada pengguna melalui saluran yang sesuai.
8. Pengguna harus mengganti password tersebut setelah login pertama.

Formulir ini tidak menyediakan pembuatan Administrator baru. Pengelolaan akun Administrator memerlukan mekanisme administrasi di luar formulir Head/teknisi ini.

### 13.6 Mengubah dan menonaktifkan akun

1. Pada akun Head/teknisi, klik **Edit**.
2. Ubah identitas, role, status, atau profil teknisi yang diperlukan.
3. Klik **Simpan Perubahan**.
4. Untuk menonaktifkan akun, klik **Nonaktifkan** dan setujui dialog konfirmasi aplikasi.

Nonaktifkan mengubah status menjadi `DISABLED`; histori pekerjaan tetap tersimpan. Untuk mengaktifkan kembali akun melalui formulir, Administrator dapat mengubah statusnya menjadi `APPROVED` setelah peninjauan.

| Status akun | Penggunaan |
|---|---|
| `APPROVED` | Akun diizinkan login. |
| `PENDING_APPROVAL` | Menunggu pemeriksaan/persetujuan. |
| `REJECTED` | Registrasi atau akun ditolak. |
| `SUSPENDED` | Akun ditangguhkan. |
| `DISABLED` | Akun dinonaktifkan. |

Ketersediaan `Available/Unavailable` adalah atribut profil teknisi, berbeda dari status akun. Mengubah ketersediaan tidak sama dengan menyelesaikan atau membatalkan tugas yang sudah tercatat.

### 13.7 Membuat password sementara

1. Pada akun Head/teknisi yang dapat dikelola, klik **Reset**.
2. Isi **Alasan reset**.
3. Klik **Generate Password**.
4. Salin password sementara yang ditampilkan.
5. Berikan kepada pemilik akun; pengguna kemudian menjalankan [penggantian password sementara](#44-mengganti-password-sementara).

### 13.8 Membuat versi SLA Policy

1. Buka **Master Data → SLA Policy**.
2. Periksa versi dan target yang telah ada.
3. Klik **Policy Baru**.
4. Pilih **Priority**.
5. Isi **Target Respond (menit)** dan **Target Pengerjaan (jam)**.
6. Isi **Warning Threshold (%)** antara 1 dan 99.
7. Klik **Simpan Policy**.
8. Periksa versi baru, waktu efektif, dan pembuat pada tabel.

Formulir web membuat versi baru yang efektif saat disimpan. Data SLA yang telah berjalan tidak otomatis berubah. Perhatikan satuan input: respons dalam **menit**, pengerjaan dalam **jam**.

## 14. Fungsi lanjutan melalui API

Bagian ini ditujukan kepada Administrator teknis atau integrator. Fungsi berikut sudah memiliki endpoint tetapi belum seluruhnya memiliki kontrol pada halaman web. Semua path di bawah menggunakan awalan API `/api/v1`.

### 14.1 Cara mengakses

1. Buka Swagger pada `/docs` di server API yang digunakan. Pada demo: `https://ticketing-demo.test/docs`; pada development API: `http://localhost:3000/docs`.
2. Gunakan endpoint login untuk memperoleh access token akun yang memiliki permission terkait.
3. Masukkan access token melalui **Authorize** untuk endpoint internal.
4. Pilih endpoint, gunakan **Try it out**, isi parameter dan body, lalu **Execute**.
5. Periksa hasil dan baca kembali tiket/data setelah perubahan.

ID tiket, assignment, assignment member, user, dan profil teknisi adalah ID yang berbeda. Gunakan ID dari respons endpoint terkait. Menjalankan endpoint perubahan akan memengaruhi data operasional seperti tindakan melalui UI.

### 14.2 Operasional tiket dan penugasan

| Fungsi | Endpoint | Cara penggunaan |
|---|---|---|
| Ubah klasifikasi | `PATCH /tickets/{id}/classification` | Isi `priorityId` dan/atau `categoryId` beserta `reason` minimal 3 karakter. Deadline lama tidak otomatis dihitung ulang. |
| Batalkan tiket | `POST /tickets/{id}/cancel` | Isi `reason` minimal 3 karakter. Hanya untuk status yang mengizinkan pembatalan; tiket menjadi `CANCELLED`. |
| Tambah komentar | `POST /tickets/{id}/comments` | Isi `message`; gunakan `isPublic: false` untuk komentar internal. Komentar bukan respons awal resmi. |
| Baca timeline | `GET /tickets/{id}/timeline` | Baca histori terkait tiket sesuai akses. |
| Baca histori assignment | `GET /tickets/{id}/assignments` | Gunakan hasil untuk mengenali assignment dan member yang benar. |
| Reassign | `POST /assignments/{id}/reassign` | Isi `technicianIds`, `leadTechnicianId`, `reason`, dan `note` opsional. Berlaku saat tiket `ASSIGNED`, `ON_SITE`, atau `IN_PROGRESS`; resume dahulu jika pending. |
| Ubah anggota | `PATCH /assignments/{id}/members/{memberId}` | Gunakan `isLead` dan/atau `requiredForResolution` sesuai kebutuhan, dengan alasan perubahan. Tetap penuhi persyaratan minimal anggota wajib untuk resolve. |
| Keluarkan anggota | `POST /assignments/{id}/members/{memberId}/remove` | Isi alasan pada `reason`. Periksa kembali lead dan anggota wajib setelah perubahan. |
| Close dengan catatan khusus | `POST /tickets/{id}/close` | Isi `verificationNote` setelah tiket resolved dan verifikasi selesai. |

Reassign mempertahankan histori penugasan sebelumnya dan mengakhiri SLA lama yang terkait. Teknisi baru menjalankan alur tugasnya sendiri. `REJECTED` tetap dapat muncul pada histori, tetapi endpoint reject operasional tidak digunakan pada implementasi saat ini.

### 14.3 Pemantauan, akun, dan laporan

| Fungsi | Endpoint | Keterangan penggunaan |
|---|---|---|
| Audit log | `GET /audit?page=1&pageSize=30` | Membaca pelaku, tindakan, waktu, dan data audit; ukuran halaman maksimal 100. |
| SLA tiket | `GET /tickets/{id}/sla` | Melihat instance SLA respons dan anggota penugasan terkait. |
| SLA anggota | `GET /assignments/{memberId}/sla` | Parameter adalah ID assignment member. SLA belum tersedia sebelum check-in pada penugasan baru. |
| Daftar breach | `GET /sla/breaches` | Melihat instance berstatus breach yang tercatat. |
| Aktivitas teknisi | `GET /technician/assignments/{memberId}/activity` | Membaca check-in, completion, dan SLA sesuai akses. |
| Suspend teknisi | `POST /technicians/{id}/suspend` | Menangguhkan teknisi menggunakan payload yang ditampilkan Swagger. |
| Reactivate teknisi | `POST /technicians/{id}/reactivate` | Mengaktifkan kembali teknisi sesuai aturan layanan. |
| Laporan tiket | `GET /reports/tickets` | Membaca laporan dengan halaman dan filter tambahan. |
| Laporan teknisi | `GET /reports/technicians` | Membaca rincian SLA/penugasan teknisi. |
| Ringkasan laporan | `GET /reports/tickets/summary` | Membaca agregasi laporan. |
| Ringkasan dashboard | `GET /dashboard/summary`, `GET /dashboard/sla` | Membaca ringkasan operasional dari layanan laporan. |
| Ekspor terfilter | `POST /reports/tickets/export` | Mengunduh workbook dengan parameter filter pada query. |

Filter laporan yang diterapkan mencakup `dateFrom`, `dateTo`, `clientId`, `siteId`, `categoryId`, `priorityId`, `status`, `technicianId`, dan `search`. Rentang tanggal mengikuti **waktu pembuatan tiket**. Gunakan tanggal ISO 8601 dengan zona waktu yang jelas. Parameter `page` dan `pageSize` digunakan untuk laporan tabel; maksimal `pageSize` API adalah 500.

Parameter status SLA yang tercantum pada definisi request belum boleh diasumsikan bekerja sebagai filter: implementasi filter laporan saat ini belum menerapkan `slaRespondStatus` dan `slaWorkStatus`.

Endpoint rutin untuk pengaduan, autentikasi, media, notifikasi, master data, approval, dan field operations juga tercantum pada Swagger. Gunakan [spesifikasi API](docs/API-Specification.md) sebagai referensi tambahan dan cocokkan dengan endpoint implementasi saat ini jika ada perbedaan dengan spesifikasi lama.

## 15. Contoh penggunaan dari awal sampai selesai

### 15.1 Keluhan dengan dua teknisi

1. Pelapor membuka QR site, mengisi identitas dan deskripsi, serta mengunggah foto gangguan.
2. Sistem membuat tiket `NEW`; pelapor menyimpan kode tiket.
3. Head membuka Tickets, membaca keluhan, lalu mengirim respons awal dengan prioritas yang sesuai.
4. Tiket menjadi `RESPONDED`; Head menugaskan teknisi A dan B dengan A sebagai lead.
5. A dan B masing-masing membuka My Assignments dan menekan **Terima Tugas**.
6. Keduanya melakukan check-in dengan GPS dan satu foto kedatangan masing-masing. Timer SLA mereka mulai pada waktu check-in masing-masing.
7. Keduanya menekan **Mulai Pekerjaan**, melakukan perbaikan, kemudian **Selesaikan** dengan ringkasan dan bukti.
8. Setelah seluruh anggota wajib `COMPLETED`, Head mengisi ringkasan resolusi dan klik **Ajukan Resolved**.
9. Setelah hasil diverifikasi, Head klik **Verifikasi & Close**.
10. Pelapor membuka tracking dan melihat **Selesai**. Head mengunduh Excel untuk laporan.

### 15.2 Penundaan sebelum kedatangan

1. Tiket sudah direspons dan ditugaskan, tetapi akses lokasi belum tersedia.
2. Head mengisi alasan dan jadwal baru melalui **Reschedule**.
3. Status menjadi `PENDING`; teknisi melihat bahwa tugas ditunda.
4. Bila belum ada check-in, SLA pengerjaan belum dimulai. Bila sebelumnya sudah check-in, SLA tetap berjalan selama pending.
5. Ketika akses siap, Head klik **Resume Ticket**.
6. Teknisi melanjutkan tahap tugas yang tersedia. Jadwal tidak melakukan resume otomatis.

### 15.3 Masalah kembali setelah penutupan

1. Head membuka tiket `CLOSED`, mengisi alasan, lalu klik **Reopen Ticket**.
2. Head melakukan penugasan untuk siklus baru.
3. Teknisi menjalankan kembali alur terima tugas sampai completion pada penugasan tersebut.
4. Head melakukan resolve dan close setelah verifikasi.
5. Histori siklus sebelumnya tetap menjadi bagian laporan; SLA Respond awal tetap menggunakan catatan pertama.

## 16. Penanganan kendala dan batasan saat ini

| Kendala | Pemeriksaan atau tindakan |
|---|---|
| Tidak dapat login | Periksa email/password dan status akun. Akun registrasi harus disetujui terlebih dahulu. |
| Selalu diarahkan ke ganti password | Akun masih menggunakan password sementara; selesaikan penggantian, lalu login kembali. |
| Email reset tidak diterima | Pengiriman email reset belum terhubung; gunakan token demo jika tersedia atau minta password sementara dari Administrator. |
| Token reset tidak valid | Token mungkin salah, kedaluwarsa setelah 30 menit, atau sudah dipakai; minta token baru atau bantuan Administrator. |
| QR tidak dapat dibuka | Periksa token, status aktif, masa berlaku, dan site. Gunakan tautan yang benar atau `/complaint`. |
| Lokasi tidak ada di pilihan pengaduan | Minta Administrator memeriksa data serta status client/site. |
| Pengaduan gagal dikirim | Lengkapi nama/PIC, nomor angka minimal 7 digit, deskripsi minimal 5 karakter, dan sedikitnya satu bukti. Baca pesan error server. |
| Tracking tidak menemukan tiket | Cocokkan kode tiket dan nomor kontak dengan data pengaduan. Jangan menggunakan ID internal sebagai kode tracking. |
| Unggahan ditolak | Periksa jenis file, ukuran, dan jumlah. Check-in hanya satu foto; HEIC tidak didukung. |
| Lokasi GPS tidak tersedia | Aktifkan lokasi perangkat, izinkan geolocation browser, gunakan HTTPS yang dipercaya, lalu coba kembali di area dengan penerimaan lokasi lebih baik. |
| Check-in tidak dapat dilakukan | Terima tugas terlebih dahulu, pilih foto, dan pastikan tiket tidak pending atau sudah berakhir. |
| Tombol Mulai Pekerjaan belum tersedia | Pastikan check-in tersimpan dan status anggota sudah `ON_SITE`. |
| Completion gagal | Pastikan status anggota `IN_PROGRESS`, ringkasan terisi, bukti tersedia, dan tiket masih operasional. |
| Aksi teknisi terblokir saat pending | Head/Administrator perlu melakukan **Resume Ticket**. Jadwal baru tidak otomatis membuka blokir. |
| SLA tetap bertambah saat pending | Ini perilaku saat ini: pending menghentikan aktivitas operasional, bukan timer SLA yang sudah dimulai. |
| Resolve ditolak | Pastikan tiket `IN_PROGRESS` dan seluruh teknisi wajib telah check-in, mulai pekerjaan, serta completion. |
| Resume membuat tiket `ASSIGNED` sementara anggota sudah bekerja/selesai | Resume tidak memulihkan status operasional lama atau mengulang status anggota. Jika tidak ada lagi transisi yang dapat memajukan tiket, Administrator perlu meninjau konsistensi workflow; jangan mengirim ulang completion yang sudah berhasil. |
| Resume dari `NEW` tidak menghentikan SLA Respond | Resume tidak mencatat respons resmi. Minta Administrator meninjau data; pada alur berikutnya kirim respons sebelum reschedule. |
| Tombol tindakan tidak ada | Periksa peran, permission, dan status. Sejumlah fungsi seperti cancel/reassign/komentar hanya tersedia melalui API. |
| Muncul konflik status | Data mungkin berubah oleh pengguna lain. Muat ulang, periksa kondisi terbaru, lalu lakukan tindakan yang masih valid. |
| Notifikasi belum muncul | Tunggu polling atau muat ulang. Periksa akun penerima dan jangan mengandalkan email sebagai satu-satunya indikator. |
| Laporan layar kurang dari Excel | Tabel laporan web maksimal 100 baris pertama; ekspor memuat semua data yang cocok dengan filter. |
| Persentase dashboard berbeda dari evaluasi per tiket | Indikator dashboard menggunakan perbandingan rata-rata durasi. Gunakan outcome SLA per tiket/teknisi untuk evaluasi deadline. |
| Jam jadwal terlihat berbeda | Tampilan menggunakan WITA, sedangkan input datetime mengikuti zona waktu browser. Periksa zona waktu perangkat. |
| Membutuhkan gambar QR untuk dicetak | Menu menghasilkan token/URL; gambar QR perlu dibuat dari URL tersebut menggunakan alat terpisah. |

Jika meminta bantuan Administrator, sertakan kode tiket, tindakan yang dilakukan, waktu kejadian, dan pesan error. Jangan menyertakan password atau token login.

## 17. Istilah dan referensi

| Istilah | Arti |
|---|---|
| Client | Organisasi/pelanggan pemilik lokasi layanan. |
| Site | Lokasi layanan yang berada di bawah client. |
| PIC | Penanggung jawab atau kontak yang dapat ditemui di lokasi. |
| Ticket/tiket | Catatan pengaduan beserta proses penanganannya. |
| Assignment | Penugasan teknisi untuk menangani tiket. |
| Assignment member | Satu teknisi dalam sebuah assignment. |
| Lead technician | Penanggung jawab tim dalam satu assignment. |
| Check-in | Pencatatan kedatangan dengan GPS dan foto. |
| Completion | Penyelesaian bagian pekerjaan oleh teknisi. |
| Resolve | Pengajuan bahwa penanganan tiket telah selesai dan siap diverifikasi. |
| Close | Penutupan tiket setelah verifikasi. |
| Reschedule | Pencatatan jadwal baru yang mengubah status menjadi pending. |
| Resume | Melanjutkan tiket dari status pending. |
| Reopen | Membuka kembali tiket resolved/closed. |
| SLA | Target waktu layanan yang diukur sistem. |
| Breach | Kondisi melewati deadline SLA. |
| Policy snapshot | Catatan versi kebijakan dan target yang dipakai oleh instance SLA. |
| Audit log | Rekaman tindakan pengguna untuk penelusuran. |

Referensi tambahan:

- [README: pemasangan, alamat lingkungan, dan akun demo](README.md).
- [Catatan implementasi](IMPLEMENTATION-NOTES.md).
- [Spesifikasi API](docs/API-Specification.md).
- [Panduan deployment](docs/Deployment-Runbook.md).
- [Pengujian dan UAT](docs/Testing-UAT.md).

Beberapa dokumen spesifikasi menggambarkan rancangan awal. Untuk penggunaan sehari-hari, perhatikan aturan implementasi dalam panduan ini, khususnya awal SLA pengerjaan pada check-in, pembatasan tindakan teknisi saat pending, dan pemisahan completion teknisi dari resolve/close tiket.
