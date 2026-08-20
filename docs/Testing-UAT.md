# Strategi Testing dan UAT

## 1. Test Pyramid

| Level | Fokus |
|---|---|
| Unit | Calculator SLA, state machine, permission policy, validator |
| Integration | Service + PostgreSQL, transaction, repository, unique constraint |
| API E2E | Endpoint, auth, permission, workflow penuh |
| Frontend component | Form, state, error, role rendering |
| Browser E2E | Alur pengguna lintas frontend/backend |
| UAT | Kesesuaian proses bisnis |

## 2. Unit Test Wajib

- ticket code generator;
- phone normalization/masking;
- state transition matrix;
- SLA Respond calculation;
- SLA Work calculation;
- warning/breach boundary;
- KPI denominator exclusion;
- permission evaluator;
- report formatter dan Excel sanitization.

## 3. Integration Test Wajib

- first response transaction dan concurrency;
- assignment membuat member dan SLA instance atomik;
- completion hanya menghentikan instance actor;
- reassignment menutup instance lama;
- policy snapshot tidak berubah saat master policy berubah;
- notification unique event;
- password token single use;
- audit log terbentuk untuk action kritis.

## 4. API E2E Scenario

### E2E-001 Happy Path

```text
Create public ticket
→ Admin responds within SLA
→ Head assigns two technicians
→ Both check in
→ Both complete
→ Lead resolves
→ Head closes
→ Report dan Excel konsisten
```

### E2E-002 SLA Respond Breach

- Ticket dibuat.
- Tidak ada response sampai deadline lewat.
- Warning dan breach tercatat.
- Response terlambat menghasilkan completed breach duration.

### E2E-003 SLA Pengerjaan Individual

- Dua teknisi ditugaskan bersamaan.
- Teknisi A selesai tepat waktu.
- Teknisi B terlambat.
- KPI dan detail memperlihatkan outcome berbeda.

### E2E-004 Reassignment

- Teknisi A ditugaskan lalu diganti.
- Instance A menjadi `REASSIGNED`.
- Instance B dimulai dari waktu assignment B.
- Histori tidak hilang.

### E2E-005 Unauthorized Access

- Technician B mencoba mengakses assignment Technician A.
- API mengembalikan 403/404 sesuai policy.
- Tidak ada data sensitif bocor.

## 5. UAT Matrix

| ID | Actor | Scenario | Expected |
|---|---|---|---|
| UAT-01 | Client | Submit aduan dari QR | Kode ticket tampil dan dapat dilacak |
| UAT-02 | Head | Beri respons awal | SLA Respond berhenti dan actor tercatat |
| UAT-03 | Head | Assign banyak teknisi | Satu lead dan SLA per member dibuat |
| UAT-04 | Technician | Check-in | Peta, foto, accuracy, waktu server tersimpan |
| UAT-05 | Technician | Complete | SLA actor berhenti; teknisi lain tetap aktif |
| UAT-06 | Head | Resolve/close | Transition valid dan timeline lengkap |
| UAT-07 | Head | Reopen | Alasan dan cycle baru tercatat |
| UAT-08 | Admin | Approval teknisi | Akun dapat login setelah approved |
| UAT-09 | User | Forgot password | Token single-use dan expired berfungsi |
| UAT-10 | Head/Admin | Live report + Excel | Data dan filter konsisten |

## 6. Non-Functional Test

- load test public create dan ticket list;
- p95 API sesuai NFR;
- upload failure/retry;
- DB connection failure handling;
- scheduler restart tidak menduplikasi event;
- backup/restore;
- browser responsive;
- accessibility dasar: keyboard, label, contrast, focus.

## 7. Defect Severity

| Severity | Definisi |
|---|---|
| Critical | Data loss, auth bypass, core flow tidak dapat digunakan |
| High | SLA/status/report salah atau fitur inti gagal tanpa workaround layak |
| Medium | Fitur sebagian terganggu dengan workaround |
| Low | UI/copy/minor issue |

MVP tidak boleh rilis dengan Critical atau High terbuka.

## 8. Test Data

Seed harus menyediakan:

- Admin, Head, 3 Technician approved, 1 pending;
- 2 Client, beberapa Site dan QR;
- ticket semua priority/status;
- contoh respond met/breach;
- contoh multi-technician met/breach/reassigned;
- media dummy metadata;
- report dataset minimal 100 record untuk pagination.
