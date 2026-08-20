# Spesifikasi SLA

## 1. Tujuan

Sistem memiliki dua SLA yang terpisah agar kualitas respons awal dan performa pengerjaan teknisi tidak tercampur.

1. **SLA Respond** — level ticket.
2. **SLA Pengerjaan** — level teknisi/assignment member.

## 2. Target Default

Target berikut merupakan baseline awal dan harus dapat dikonfigurasi oleh Administrator.

| Priority | SLA Respond | SLA Pengerjaan per Teknisi |
|---|---:|---:|
| `CRITICAL` | 15 menit | 2 jam |
| `HIGH` | 30 menit | 4 jam |
| `MEDIUM` | 1 jam | 8 jam |
| `LOW` | 4 jam | 24 jam |

Perubahan target menghasilkan versi policy baru. Ticket dan assignment lama tetap menggunakan snapshot policy saat dibuat.

## 3. Asumsi Waktu MVP

- Perhitungan menggunakan elapsed calendar time 24/7.
- Semua waktu resmi berasal dari server.
- Database menyimpan UTC.
- Tampilan menggunakan WITA.
- Pause SLA belum aktif pada MVP.

Kalender jam kerja, hari libur, dan pause reason dapat ditambahkan sebagai versi berikutnya tanpa mengubah record historis.

## 4. SLA Respond

### 4.1 Scope

Satu instance untuk setiap ticket.

### 4.2 Start

```text
respond_started_at = ticket.created_at
```

### 4.3 Deadline

```text
respond_due_at = respond_started_at + response_target_seconds
```

Target diambil dari priority policy snapshot ticket.

### 4.4 Stop

SLA berhenti pada respons awal resmi pertama:

```text
respond_completed_at = ticket.first_responded_at
```

Respons harus dibuat oleh actor dengan permission `ticket.respond`.

### 4.5 Outcome

```text
MET       jika completed_at <= due_at
BREACHED  jika completed_at > due_at
OPEN      jika belum selesai dan now < warning_at
WARNING   jika belum selesai dan warning_at <= now <= due_at
BREACHED  jika belum selesai dan now > due_at
```

### 4.6 Warning

Default warning threshold: 75% dari target.

```text
warning_at = started_at + target_seconds * 0.75
```

### 4.7 Rejection

Jika ticket ditolak sebelum respons resmi, SLA Respond ditutup dengan outcome `TERMINATED_REJECTED`. Report harus memisahkan outcome tersebut dari `MET`.

## 5. SLA Pengerjaan per Teknisi

### 5.1 Scope

Setiap active `ticket_assignment_member` memiliki satu SLA instance. Bila tiga teknisi ditugaskan, terdapat tiga SLA Pengerjaan.

### 5.2 Start

Karena requirement mengukur teknisi sejak ditugaskan:

```text
work_started_at = assignment_member.assigned_at
```

Jika organisasi ingin mengukur setelah teknisi menerima tugas, policy dapat diubah ke `accepted_at`, tetapi baseline MVP menggunakan `assigned_at`.

### 5.3 Deadline

```text
work_due_at = work_started_at + work_target_seconds
```

Target menggunakan priority snapshot saat assignment dibuat.

### 5.4 Stop

```text
work_completed_at = assignment_member.completed_at
```

Completion wajib memiliki ringkasan pekerjaan dan bukti sesuai policy.

### 5.5 Dua Durasi yang Ditampilkan

Agar report tidak mencampur waktu perjalanan dan waktu teknis:

```text
assignment_elapsed = completed_at - assigned_at
onsite_work_elapsed = completed_at - first_checkin_at
```

`assignment_elapsed` adalah basis SLA Pengerjaan. `onsite_work_elapsed` adalah KPI diagnostik tambahan.

### 5.6 Outcome per Teknisi

```text
MET
WARNING
BREACHED
COMPLETED_BREACHED
REASSIGNED
REMOVED
CANCELLED
```

- `BREACHED` digunakan ketika masih aktif dan melewati deadline.
- `COMPLETED_BREACHED` digunakan ketika akhirnya selesai setelah deadline.
- `REASSIGNED` dan `REMOVED` tidak dihitung sebagai met; ditampilkan terpisah.

### 5.7 Agregasi Ticket

Ticket menampilkan status SLA Pengerjaan agregat sebagai status terburuk dari member aktif yang `required_for_resolution`:

```text
BREACHED > WARNING > ON_TRACK > MET
```

Namun KPI dan report utama tetap dihitung per teknisi, bukan hanya per ticket.

## 6. Perubahan Priority

Ketika priority berubah:

- perubahan wajib memiliki alasan;
- default: deadline instance yang sudah berjalan tidak diubah;
- policy baru berlaku pada assignment baru;
- Administrator dapat melakukan recalculation override hanya dengan permission khusus dan audit lengkap.

Aturan ini mencegah manipulasi deadline setelah breach mendekat.

## 7. Reassignment

Saat teknisi diganti:

1. SLA instance lama berhenti pada `ended_at` dengan outcome `REASSIGNED`.
2. SLA instance baru dibuat untuk teknisi baru.
3. Histori keduanya tetap terlihat.
4. Ticket aggregate hanya mempertimbangkan member aktif.

## 8. Reopen

- SLA Respond tidak dimulai ulang.
- Assignment baru pada cycle reopen menghasilkan SLA Pengerjaan baru.
- Setiap SLA instance memiliki `service_cycle_no` agar report dapat membedakan cycle.

## 9. Data Minimum SLA Instance

```text
id
sla_type                 RESPOND | WORK
subject_type             TICKET | ASSIGNMENT_MEMBER
subject_id
service_cycle_no
policy_version_id
priority_snapshot
target_seconds
warning_threshold_percent
started_at
warning_at
due_at
completed_at
ended_at
status
outcome
breached_at
breach_seconds
created_at
updated_at
```

## 10. Formula

### Open elapsed

```text
elapsed_seconds = max(0, now - started_at)
```

### Completed elapsed

```text
elapsed_seconds = max(0, completed_at - started_at)
```

### Breach duration

```text
breach_seconds = max(0, effective_end_at - due_at)
```

`effective_end_at` adalah `completed_at`, `ended_at`, atau `now` untuk instance aktif.

### Achievement Rate

```text
sla_met_rate = met_instances / eligible_completed_instances * 100
```

Outcome `REASSIGNED`, `REMOVED`, `CANCELLED`, dan data invalid dikeluarkan dari denominator dan dilaporkan terpisah.

## 11. Contoh

### Contoh SLA Respond

- Ticket `HIGH` dibuat 08:00 WITA.
- Target respond 30 menit.
- Deadline 08:30.
- Head merespons 08:20.
- Outcome: `MET`, elapsed 20 menit.

### Contoh SLA Pengerjaan Banyak Teknisi

Ticket `HIGH` menugaskan:

- Teknisi A pada 09:00, selesai 12:00 → 3 jam → `MET`.
- Teknisi B pada 09:00, selesai 14:00 → 5 jam → `COMPLETED_BREACHED`, breach 1 jam.

Ticket aggregate menunjukkan breach karena salah satu required member melewati target. Report tetap menampilkan hasil A dan B secara terpisah.

## 12. Notification SLA

Event minimum:

- Respond warning;
- Respond breached;
- Work warning per technician;
- Work breached per technician;
- Work completed after breach;
- Policy changed.

Gunakan unique event key agar scheduler berulang tidak membuat notifikasi ganda.

## 13. Test Wajib

- boundary tepat pada deadline;
- crossing timezone/day boundary;
- concurrent first response;
- multiple technician independent timers;
- reassignment;
- reopen cycle;
- policy version snapshot;
- overdue active instance;
- completion setelah breach;
- excluded outcome dari KPI denominator.
