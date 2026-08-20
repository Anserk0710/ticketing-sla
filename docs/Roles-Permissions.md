# Role dan Permission

## 1. Prinsip

Role adalah paket permission. Backend harus memeriksa permission pada setiap use case sensitif. Menyembunyikan tombol di frontend bukan authorization.

## 2. Role

| Role | Deskripsi |
|---|---|
| `ADMINISTRATOR` | Pengelola sistem, user, konfigurasi, SLA policy, dan operasional |
| `HEAD` | Pengelola operasional ticket, assignment, approval teknisi, dan laporan |
| `TECHNICIAN` | Pelaksana assignment lapangan |
| `PUBLIC_CLIENT` | Actor tanpa login untuk create dan tracking terbatas; bukan role internal database |

## 3. Permission Catalog

```text
auth.session.manage
user.read
user.manage
technician.register
technician.approve
client.read
client.manage
site.read
site.manage
catalog.read
catalog.manage
sla.policy.read
sla.policy.manage
ticket.create.public
ticket.track.public
ticket.read.all
ticket.read.assigned
ticket.respond
ticket.classify
ticket.assign
ticket.reassign
ticket.reject
ticket.resolve
ticket.close
ticket.reopen
ticket.comment.internal
field.checkin
field.work.start
field.work.complete
media.read.internal
report.read
report.export
notification.read.self
audit.read
```

## 4. Matriks Permission

| Aksi | Administrator | Head | Technician | Public |
|---|:---:|:---:|:---:|:---:|
| Kelola user/role | Ya | Tidak | Tidak | Tidak |
| Kelola client/site/QR | Ya | Opsional read | Tidak | Tidak |
| Kelola category/priority/SLA policy | Ya | Read | Tidak | Tidak |
| Registrasi teknisi | Tidak | Tidak | Ya/Public | Ya |
| Approval teknisi | Ya | Ya | Tidak | Tidak |
| Buat ticket publik | Ya | Ya | Ya | Ya |
| Tracking publik | Ya | Ya | Ya | Ya |
| Lihat semua ticket | Ya | Ya | Tidak | Tidak |
| Lihat assignment sendiri | Ya | Ya | Ya | Tidak |
| Respons awal | Ya | Ya | Tidak | Tidak |
| Klasifikasi priority/category | Ya | Ya | Tidak | Tidak |
| Assign/reassign | Ya | Ya | Tidak | Tidak |
| Check-in | Tidak | Tidak | Hanya assignment aktif | Tidak |
| Mulai/selesaikan pekerjaan | Tidak | Tidak | Hanya assignment aktif | Tidak |
| Resolve ticket | Ya | Ya | Lead, jika policy mengizinkan | Tidak |
| Close/reopen | Ya | Ya | Tidak | Tidak |
| Lihat media internal | Ya | Ya | Assignment terkait | Tidak |
| Lihat report | Ya | Ya | Tidak | Tidak |
| Export report | Ya | Ya | Tidak | Tidak |
| Lihat audit log | Ya | Terbatas | Tidak | Tidak |

## 5. Aturan Ownership

Technician hanya dapat mengakses ticket apabila:

- memiliki assignment member aktif atau historis yang diizinkan; atau
- menjadi lead technician; atau
- diberikan permission khusus sementara yang tercatat.

Setelah reassignment, akses terhadap data sensitif dapat dibatasi menjadi read-only histori sesuai kebijakan.

## 6. Approval Teknisi

Status akun:

```text
PENDING_EMAIL_VERIFICATION
PENDING_APPROVAL
APPROVED
REJECTED
SUSPENDED
DISABLED
```

Aturan:

- `PENDING_APPROVAL` tidak dapat mengakses area internal.
- Rejection wajib memiliki alasan.
- Suspension menonaktifkan session aktif.
- Approval, rejection, suspension, dan reactivation masuk audit log.

## 7. Permission Test Minimum

Untuk setiap endpoint sensitif, buat:

- positive test actor berwenang;
- negative test actor role lain;
- ownership test untuk technician lain;
- inactive/suspended account test;
- expired token test.
