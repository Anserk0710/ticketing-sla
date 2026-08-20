# Security dan Privacy

## 1. Threat Surface

Area utama:

- public ticket creation;
- tracking publik;
- authentication dan password reset;
- role/permission;
- file upload;
- lokasi dan media;
- report/export;
- audit log;
- dependency dan deployment.

## 2. Authentication

- Password disimpan dengan hashing adaptif yang kuat.
- Access token berumur pendek.
- Refresh token dirotasi dan disimpan dalam bentuk hash.
- Logout dan suspension mencabut session.
- Validasi issuer, audience, expiry, dan token type.
- Login memiliki rate limit dan lockout/throttling terukur.

## 3. Authorization

- Permission guard di backend.
- Ownership check untuk Technician.
- Query list harus dibatasi di database, bukan memfilter setelah semua data diambil.
- Media access memeriksa permission dan hubungan dengan ticket.
- Semua write action sensitif diaudit.

## 4. Public Tracking

- Ticket code acak dan tidak berurutan.
- Nomor telepon dinormalisasi untuk pencocokan.
- Respons error dibuat generik.
- Rate limit berdasarkan IP dan key lain yang aman.
- Data nomor, nama, dan alamat dimasking.
- Exact coordinate, internal note, audit, dan media tidak ditampilkan publik.
- OTP dapat ditambahkan untuk ticket sensitif.

## 5. Public Form

- Server-side validation.
- Panjang field dibatasi.
- HTML/script tidak dipercaya.
- Rate limit dan bot protection bila dibutuhkan.
- Idempotency untuk mencegah submit ganda.
- QR token opaque dan dapat dinonaktifkan.

## 6. File Upload

Validasi minimum:

- allowlist extension;
- MIME type;
- file signature/magic bytes bila backend menerima binary;
- size maksimum;
- image dimension/video duration;
- generated filename/public ID;
- authenticated/signed upload;
- verifikasi provider saat finalize;
- authorization terhadap ticket/assignment;
- malware scan bila infrastructure tersedia.

Baseline limit harus ditentukan sebelum implementasi. Contoh awal:

- foto: maksimum 10 MB per file;
- video: maksimum 100 MB dan durasi maksimum 3 menit;
- jumlah file per step dibatasi.

Angka final mengikuti kebutuhan operasi dan biaya storage.

## 7. Lokasi

- Geolocation browser bukan bukti absolut.
- Simpan accuracy meter.
- Simpan jarak ke koordinat site bila tersedia.
- Gunakan waktu server.
- Tampilkan disclaimer pada kebijakan internal.
- Exact coordinate diklasifikasikan sebagai data internal.

## 8. Password Reset

### Jalur utama

- Respons generik untuk email yang ada/tidak ada.
- Token random, single-use, expiry singkat, disimpan hash.
- Rate limit per account dan IP.
- Setelah reset, revoke session lama sesuai policy.

### Fallback administratif

- Hanya permission `user.manage`.
- Verifikasi identitas dilakukan di luar sistem sesuai SOP.
- Generate temporary password.
- `must_change_password = true`.
- Audit actor, target, alasan, dan waktu.
- Temporary password tidak dikirim melalui channel publik yang tidak aman.

## 9. Privacy

Klasifikasi data:

| Kelas | Contoh |
|---|---|
| Public-safe | ticket code setelah autentikasi tracking, public status |
| Internal | category, priority, assignment, response internal |
| Sensitive operational | phone, alamat, exact location, photo/video |
| Security secret | password hash, token, API key |

Security secret tidak boleh masuk log, audit payload, analytics, atau response.

## 10. Logging dan Audit

Log aplikasi harus memiliki:

- timestamp;
- level;
- request ID;
- actor ID jika ada;
- route/status/duration;
- error code;
- tanpa token/password/media binary.

Audit action minimum:

- login failure penting;
- user/role change;
- technician approval;
- response;
- priority/category change;
- assignment/reassignment;
- check-in/completion;
- SLA policy change/recalculation;
- close/reopen/reject/cancel;
- report export;
- fallback password reset.

## 11. Security Acceptance

- permission matrix diuji positif dan negatif;
- tracking enumeration test;
- upload validation test;
- rate limit test;
- secret scan pada repository;
- dependency audit;
- HTTPS dan secure headers;
- backup encryption/permission;
- production debug mode nonaktif.
