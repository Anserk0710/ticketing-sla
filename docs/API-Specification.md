# Kontrak API REST

## 1. Konvensi

- Base path: `/api/v1`.
- JSON menggunakan `camelCase`.
- Timestamp ISO-8601.
- Pagination cursor atau page-based konsisten; MVP boleh page-based.
- Error memiliki `code` stabil.
- OpenAPI dihasilkan dari NestJS dan menjadi kontrak utama.

## 2. Response Envelope

### Success tunggal

```json
{
  "data": {
    "id": "..."
  }
}
```

### Success list

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": [],
    "requestId": "req_..."
  }
}
```

## 3. Public Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/public/qr/:token` | Resolve QR ke site context aman |
| `POST` | `/public/tickets` | Buat ticket |
| `POST` | `/public/tickets/track` | Tracking dengan code + phone |
| `POST` | `/public/technicians/register` | Registrasi teknisi |
| `POST` | `/public/auth/forgot-password` | Request reset |
| `POST` | `/public/auth/reset-password` | Gunakan reset token |

Public endpoint wajib rate limit dan tidak boleh membocorkan apakah akun/ticket tertentu ada melalui pesan yang terlalu spesifik.

## 4. Authentication

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/auth/login` | Login internal |
| `POST` | `/auth/refresh` | Rotate refresh token |
| `POST` | `/auth/logout` | Revoke session |
| `GET` | `/auth/me` | Profile dan permission |
| `POST` | `/auth/change-password` | Ganti password |

## 5. Technician Approval

| Method | Path | Permission |
|---|---|---|
| `GET` | `/technicians/approvals` | `technician.approve` |
| `GET` | `/technicians/approvals/:id` | `technician.approve` |
| `POST` | `/technicians/approvals/:id/approve` | `technician.approve` |
| `POST` | `/technicians/approvals/:id/reject` | `technician.approve` |
| `POST` | `/technicians/:id/suspend` | `user.manage` |
| `POST` | `/technicians/:id/reactivate` | `user.manage` |

## 6. Ticket Internal

| Method | Path | Permission |
|---|---|---|
| `GET` | `/tickets` | `ticket.read.all` atau scope assigned |
| `GET` | `/tickets/:id` | permission + ownership |
| `POST` | `/tickets/:id/respond` | `ticket.respond` |
| `PATCH` | `/tickets/:id/classification` | `ticket.classify` |
| `POST` | `/tickets/:id/reject` | `ticket.reject` |
| `POST` | `/tickets/:id/cancel` | `ticket.close` atau permission khusus |
| `POST` | `/tickets/:id/resolve` | `ticket.resolve` |
| `POST` | `/tickets/:id/close` | `ticket.close` |
| `POST` | `/tickets/:id/reopen` | `ticket.reopen` |
| `POST` | `/tickets/:id/comments` | `ticket.comment.internal` |
| `GET` | `/tickets/:id/timeline` | ticket read permission |

Endpoint transition wajib menggunakan expected version atau optimistic concurrency untuk menghindari update status bersamaan.

## 7. Assignment

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/tickets/:id/assignments` | Buat assignment multi-technician |
| `GET` | `/tickets/:id/assignments` | Histori assignment |
| `POST` | `/assignments/:id/reassign` | Reassignment |
| `PATCH` | `/assignments/:id/members/:memberId` | Ubah lead/required flag sesuai permission |
| `POST` | `/assignments/:id/members/:memberId/remove` | Hentikan member |
| `GET` | `/technician/assignments` | Assignment actor sendiri |
| `POST` | `/technician/assignments/:memberId/accept` | Accept |
| `POST` | `/technician/assignments/:memberId/reject` | Reject dengan alasan |

## 8. Field Operation

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/technician/assignments/:memberId/checkins` | Check-in |
| `POST` | `/technician/assignments/:memberId/start` | Mulai pekerjaan |
| `POST` | `/technician/assignments/:memberId/complete` | Selesaikan bagian teknisi |
| `GET` | `/technician/assignments/:memberId/activity` | Histori activity |

## 9. Media

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/media/signature` | Signed upload parameters |
| `POST` | `/media/finalize` | Verifikasi upload dan simpan metadata |
| `GET` | `/media/:id/access` | Signed/authenticated access |

Finalization harus memverifikasi ownership, provider metadata, tipe, ukuran, dan konteks entity.

## 10. SLA

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/tickets/:id/sla` | SLA Respond dan aggregate work |
| `GET` | `/assignments/:memberId/sla` | SLA Pengerjaan teknisi |
| `GET` | `/sla/policies` | List policy |
| `POST` | `/sla/policies` | Buat versi policy baru |
| `GET` | `/sla/breaches` | Queue breach operasional |

Policy yang sudah dipakai tidak diedit in-place; buat versi baru.

## 11. Dashboard, Notification, Report

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/dashboard/summary` | KPI utama |
| `GET` | `/dashboard/sla` | SLA Respond/Work metrics |
| `GET` | `/notifications` | Notification actor |
| `POST` | `/notifications/:id/read` | Mark read |
| `POST` | `/notifications/read-all` | Mark all read |
| `GET` | `/reports/tickets` | Live report |
| `GET` | `/reports/tickets/summary` | Summary filter yang sama |
| `POST` | `/reports/tickets/export` | Excel export |
| `GET` | `/reports/technicians` | SLA Pengerjaan per teknisi |

## 12. Master Data

Endpoint CRUD terbatas untuk:

- clients;
- sites;
- QR codes;
- categories;
- priorities;
- users;
- roles dan permissions bila diperlukan UI.

## 13. Idempotency dan Concurrency

- `POST /public/tickets`: mendukung `Idempotency-Key`.
- Completion dan check-in pertama memiliki unique business constraint.
- First response menggunakan transaction dan conditional update.
- Transition menerima `version` atau `If-Match` untuk optimistic locking.

## 14. HTTP Status

| Status | Penggunaan |
|---:|---|
| 200 | Success read/update |
| 201 | Resource created |
| 204 | Success tanpa body |
| 400 | Request malformed |
| 401 | Tidak terautentikasi |
| 403 | Tidak memiliki permission/ownership |
| 404 | Resource tidak ada atau disembunyikan |
| 409 | Conflict/state transition/idempotency |
| 422 | Validation semantik bila dipilih |
| 429 | Rate limited |
| 500 | Internal error dengan request ID |
