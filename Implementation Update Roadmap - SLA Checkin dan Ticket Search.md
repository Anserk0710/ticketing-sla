# Implementation Update Roadmap — SLA Check-in, Ticket Search Client/Site & Table Sorting

## 1. Tujuan Update

Roadmap ini mencakup tiga perubahan utama pada sistem Ticketing / Field Service:

1. **SLA Pengerjaan (`WORK`) baru mulai berjalan setelah teknisi berhasil melakukan check-in.**
2. **Search pada halaman Ticket diperluas agar dapat mencari berdasarkan data Client dan Site.**
3. **Table Ticket mendukung server-side sorting pada kolom bisnis utama dan tetap konsisten dengan pagination/filter/search.**

Implementasi dirancang agar tetap menjaga lifecycle assignment yang sudah ada, snapshot SLA policy, multi-technician assignment, auditability, dan performa query.

---

## 2. Kondisi Sistem Saat Ini

### 2.1 SLA Pengerjaan

Saat ini SLA Work dibuat ketika `AssignmentMember` dibuat pada proses assignment/reassignment.

Lokasi utama:

- `Backend/src/modules/sla/sla.service.ts`
- `Backend/src/modules/assignments/assignments.service.ts`
- `Backend/src/modules/field-operations/field-operations.service.ts`
- `Backend/prisma/schema.prisma`

Perilaku saat ini:

```text
Ticket di-assign
    ↓
AssignmentMember dibuat
    ↓
SlaService.createWork()
    ↓
startedAt = member.assignedAt
    ↓
SLA Work langsung berjalan
```

Artinya waktu perjalanan teknisi menuju lokasi saat ini ikut dihitung sebagai SLA pengerjaan.

### 2.2 Check-in Teknisi

Check-in saat ini sudah memiliki lifecycle yang ketat:

```text
ASSIGNED
   ↓ Accept
ACCEPTED
   ↓ Check-in berhasil
ON_SITE
```

`firstCheckinAt` sudah tersimpan pada `AssignmentMember`, sehingga timestamp ini dapat menjadi sumber waktu mulai SLA Work.

Check-in juga sudah diproses di dalam Prisma transaction, sehingga pembuatan SLA dapat ditempatkan di transaction yang sama agar bersifat atomic.

### 2.3 Search Ticket

Frontend saat ini mengirim query:

```text
GET /tickets?search=...
```

Lokasi:

- `Frontend/src/pages/internal/tickets-page.tsx`
- `Backend/src/modules/tickets/tickets.dto.ts`
- `Backend/src/modules/tickets/tickets.service.ts`

Search backend saat ini mencakup:

- `ticketCode`
- `reporterName`
- `picName`
- `description`

Tetapi belum mencakup:

- Client name
- Client code
- Site name
- Site code
- Site address

Padahal data tersebut sudah tersedia melalui relasi:

```text
Ticket
  └── Site
       └── Client
```

### 2.4 Sorting Table Ticket

Table Ticket saat ini menampilkan kolom:

- Ticket
- Client / Site
- Priority
- Status
- SLA Respond
- SLA Pengerjaan
- Dibuat

Backend saat ini menggunakan urutan tetap:

```text
orderBy: createdAt DESC
```

Frontend belum memiliki state sorting maupun interaksi pada header table. Akibatnya user tidak dapat mengurutkan daftar berdasarkan kolom yang relevan.

Karena endpoint menggunakan pagination, sorting **harus dilakukan di backend**. Client-side sorting hanya pada data 1 halaman tidak direkomendasikan karena akan menghasilkan urutan yang salah terhadap keseluruhan dataset.

---

# 3. Target Behaviour

## 3.1 Target SLA Pengerjaan

Lifecycle baru:

```text
Ticket di-assign
    ↓
AssignmentMember dibuat
    ↓
Belum ada SLA Work aktif
    ↓
Teknisi Accept
    ↓
Belum ada SLA Work aktif
    ↓
Teknisi berhasil Check-in
    ↓
firstCheckinAt = server time
    ↓
SLA Work dibuat
    ↓
startedAt = firstCheckinAt
warningAt = firstCheckinAt + warning threshold
 dueAt    = firstCheckinAt + work target
    ↓
SLA Work mulai berjalan
```

### Prinsip utama

- Assignment **tidak** memulai SLA Work.
- Accept **tidak** memulai SLA Work.
- Hanya **successful check-in** yang memulai SLA Work.
- Timestamp server (`now`) digunakan sebagai sumber waktu authoritative.
- Satu `AssignmentMember` tetap hanya boleh memiliki satu SLA Work.
- Untuk multi-technician assignment, masing-masing teknisi memiliki SLA Work berdasarkan waktu check-in masing-masing.

## 3.2 Target Sorting Table Ticket

Sorting menggunakan query parameter pada endpoint list ticket yang sama:

```text
GET /tickets?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

Target kolom sortable tahap pertama:

| Header UI | `sortBy` | Sumber data |
|---|---|---|
| Ticket | `ticketCode` | `Ticket.ticketCode` |
| Client | `clientName` | `Ticket.site.client.name` |
| Site | `siteName` | `Ticket.site.name` |
| Priority | `priority` | `Ticket.priority.severityOrder` |
| Status | `status` | `Ticket.status` |
| Dibuat | `createdAt` | `Ticket.createdAt` |

Default tetap:

```text
sortBy = createdAt
sortOrder = desc
```

`Priority` harus menggunakan `severityOrder`, bukan alphabetical `priority.code`, agar urutan merepresentasikan tingkat severity bisnis.

### SLA columns

`SLA Respond` dan terutama `SLA Pengerjaan` tidak direkomendasikan menjadi sortable pada implementasi pertama. `SLA Pengerjaan` dapat memiliki lebih dari satu member/SLA pada multi-technician assignment sehingga perlu definisi bisnis mengenai nilai aggregate yang menjadi dasar sorting. Menambahkan sorting pada kolom tersebut tanpa definisi ini dapat menghasilkan urutan ambigu.

Jika nanti dibutuhkan, sorting SLA dibuat sebagai enhancement terpisah berdasarkan nilai aggregate yang eksplisit, misalnya `nearestDueAt`, `worstStatus`, atau `remainingSeconds`.

### Stable ordering

Setiap sorting harus memiliki secondary order yang deterministic untuk menjaga pagination stabil. Contoh:

```text
ORDER BY createdAt DESC, id ASC
```

atau untuk Client:

```text
ORDER BY client.name ASC, ticket.createdAt DESC, ticket.id ASC
```

Ketika sort berubah, frontend wajib kembali ke `page = 1`.


---

# 4. Keputusan Arsitektur

## 4.1 SLA Policy tetap mengikuti waktu assignment

Saat ini SLA policy secara efektif di-snapshot ketika assignment dibuat karena SLA instance langsung dibuat pada saat itu.

Jika pembuatan SLA dipindahkan langsung ke check-in dengan mengambil `activePolicy()` saat check-in, terdapat risiko berikut:

```text
09:00 Technician assigned → Policy v1
10:00 Admin mengaktifkan Policy v2
11:00 Technician check-in
```

Tanpa pengamanan, technician tersebut akan menggunakan Policy v2 meskipun assignment dibuat ketika Policy v1 masih berlaku.

### Keputusan yang direkomendasikan

Pisahkan dua konsep:

- **Policy reference time:** `member.assignedAt`
- **SLA timer start:** `member.firstCheckinAt`

Dengan demikian:

```text
Policy = policy yang efektif saat assignedAt
Timer  = mulai saat successful check-in
```

Ini menjaga perubahan requirement tetap terbatas pada **kapan SLA berjalan**, tanpa mengubah rule versioning SLA policy.

---

# 5. Phase 1 — Refactor SLA Service

## Scope

Refactor service SLA agar pembuatan WORK SLA tidak lagi bergantung pada `member.assignedAt` sebagai waktu mulai.

### File

`Backend/src/modules/sla/sla.service.ts`

## Perubahan

### 5.1 Tambahkan resolver policy berdasarkan waktu tertentu

Refactor:

```text
activePolicy(priorityId)
```

menjadi pola yang dapat mendukung:

```text
policyAt(priorityId, effectiveAt)
```

Resolver harus mengambil policy terbaru dengan:

```text
effectiveFrom <= effectiveAt
```

Kemudian urutkan berdasarkan version/effective date seperti perilaku sekarang.

`activePolicy()` boleh tetap dipertahankan sebagai wrapper untuk kebutuhan SLA Respond agar perubahan tetap DRY.

### 5.2 Refactor `createWork()`

Ubah contract method menjadi menerima waktu mulai secara eksplisit.

Konsep:

```text
createWork(member, ticket, startedAt, tx)
```

Policy dihitung berdasarkan:

```text
member.assignedAt
```

Tetapi timer dihitung berdasarkan:

```text
startedAt
```

Perhitungan:

```text
startedAt = check-in server time
warningAt = startedAt + workTargetSeconds * warningThresholdPercent / 100
dueAt     = startedAt + workTargetSeconds
```

### 5.3 Pertahankan database constraint

Constraint yang sudah ada:

```prisma
@@unique([slaType, assignmentMemberId])
```

harus tetap dipertahankan.

Constraint ini menjadi defense terakhir agar duplicate/concurrent request tidak menciptakan dua SLA Work untuk member yang sama.

## Output Phase 1

- SLA service dapat membuat Work SLA dengan waktu mulai yang diberikan caller.
- Policy SLA tetap konsisten dengan policy yang efektif pada saat assignment.
- Tidak ada perubahan perilaku SLA Respond.

---

# 6. Phase 2 — Hapus SLA Start dari Assignment/Reassignment

## File

`Backend/src/modules/assignments/assignments.service.ts`

## Perubahan

Hapus pemanggilan:

```text
this.sla.createWork(...)
```

pada:

1. pembuatan assignment baru;
2. pembuatan member pada reassignment.

### Lifecycle setelah perubahan

Assignment baru hanya membuat:

- `TicketAssignment`
- `AssignmentMember`
- notification assignment

Tetapi **tidak membuat `SlaInstance WORK`**.

## Penyesuaian logic end/remove/reassign

Beberapa workflow saat ini mencoba mencari dan mengakhiri SLA Work ketika member:

- removed;
- reassigned;
- cancelled/ended.

Logic tersebut harus tetap **null-safe**.

Kasus valid setelah update:

```text
Technician assigned
↓
Belum check-in
↓
Technician di-remove/reassign
```

Pada kondisi ini memang tidak ada SLA Work yang perlu diakhiri.

Tidak boleh dianggap sebagai error.

## Output Phase 2

- Assignment tidak lagi memulai timer SLA Work.
- Reassignment tidak memulai timer SLA Work sebelum teknisi pengganti check-in.
- Removal/reassignment sebelum check-in tetap valid.

---

# 7. Phase 3 — Start SLA secara Atomic pada Successful Check-in

## File

`Backend/src/modules/field-operations/field-operations.service.ts`

## Lokasi implementasi

Method:

```text
checkin(memberId, dto, user)
```

## Perubahan

Pembuatan SLA Work dilakukan **di transaction check-in yang sama** setelah transition member berhasil:

```text
ACCEPTED → ON_SITE
```

### Urutan yang direkomendasikan

```text
1. Validate assignment/member access
2. Validate ticket operational state
3. Validate member status = ACCEPTED
4. Validate check-in media
5. Generate server timestamp `now`
6. Create Checkin
7. Link media
8. CAS member transition ACCEPTED → ON_SITE
9. Set firstCheckinAt = now
10. Create SLA Work menggunakan startedAt = now
11. Transition ticket ASSIGNED → ON_SITE jika diperlukan
12. Notification / transaction continuation
13. Commit
```

### Mengapa setelah CAS member?

Agar duplicate/concurrent check-in tidak memulai dua SLA.

Jika CAS gagal:

```text
memberTransition.count !== 1
```

seluruh transaction rollback.

Jika pembuatan SLA gagal, check-in dan transition juga rollback sehingga tidak ada kondisi:

```text
ON_SITE tetapi SLA gagal dibuat
```

### Timestamp authoritative

Gunakan timestamp yang sama:

```text
const now = new Date()
```

untuk:

- `Checkin.serverReceivedAt`
- `AssignmentMember.firstCheckinAt`
- `SlaInstance.startedAt`

Dengan demikian tidak terjadi drift antar record.

## Output Phase 3

Successful check-in menghasilkan invariant:

```text
member.status = ON_SITE
member.firstCheckinAt != null
WORK SLA exists
WORK SLA.startedAt = member.firstCheckinAt
```

---

# 8. Phase 4 — Validasi Lifecycle SLA Setelah Perubahan

## Backend yang perlu diaudit

### Files

- `Backend/src/modules/field-operations/field-operations.service.ts`
- `Backend/src/modules/assignments/assignments.service.ts`
- `Backend/src/modules/tickets/tickets.service.ts`
- `Backend/src/modules/reports/reports.service.ts`
- `Backend/src/modules/sla/sla.service.ts`

## Kasus yang harus divalidasi

### Case A — Assigned tetapi belum Accept

Expected:

```text
WORK SLA = tidak ada
workSlaAggregate = NOT_STARTED
```

### Case B — Accepted tetapi belum Check-in

Expected:

```text
WORK SLA = tidak ada
workSlaAggregate = NOT_STARTED
```

### Case C — Successful Check-in

Expected:

```text
WORK SLA dibuat
startedAt = firstCheckinAt
status = OPEN
```

### Case D — Start Work

Expected:

SLA tidak dibuat ulang dan timer tetap berasal dari check-in pertama.

### Case E — Complete Work

Expected:

SLA instance yang dimulai saat check-in diselesaikan melalui `sla.complete()`.

### Case F — Reassign sebelum Check-in

Expected:

- member lama diakhiri;
- tidak ada SLA lama yang perlu di-end;
- member baru belum memiliki SLA;
- SLA baru hanya dibuat setelah member baru berhasil check-in.

### Case G — Reassign setelah Check-in

Expected:

- SLA member lama diakhiri dengan outcome `REASSIGNED`;
- member baru tidak memiliki SLA sampai check-in.

### Case H — Remove sebelum Check-in

Expected:

Tidak ada error walaupun `slaInstances` kosong.

### Case I — Multi-technician

Contoh:

```text
Tech A check-in 10:00
Tech B check-in 10:20
```

Expected:

```text
A.startedAt = 10:00
B.startedAt = 10:20
```

Masing-masing SLA dihitung independen.

---

# 9. Phase 5 — Backend Ticket Search Client/Site & Sorting

## Backend

### File

`Backend/src/modules/tickets/tickets.service.ts`

Method list ticket menggunakan `Prisma.TicketWhereInput` yang saat ini sudah memiliki `OR` untuk search.

Tambahkan relation search ke `site` dan `site.client`.

### Search field yang direkomendasikan

Search term mencakup:

#### Ticket

- `ticketCode`
- `reporterName`
- `picName`
- `description`

#### Client

- `site.client.name`
- `site.client.code`

#### Site

- `site.name`
- `site.code`
- `site.address`

Seluruh text search tetap case-insensitive seperti implementasi sekarang.

### Contoh behaviour

Jika terdapat:

```text
Client: PT ABC Indonesia
Client Code: ABC
Site: Warehouse Makassar
Site Code: MKS-WH01
Address: Jl. Perintis Kemerdekaan
```

Maka keyword berikut harus menemukan ticket terkait:

```text
ABC
PT ABC
Warehouse
MKS-WH01
Perintis
```

## DTO

### File

`Backend/src/modules/tickets/tickets.dto.ts`

Field `search?: string` sudah tersedia sehingga **tidak diperlukan DTO baru**.

Validasi query saat ini dapat tetap digunakan.

## Sorting Backend

### File

- `Backend/src/modules/tickets/tickets.dto.ts`
- `Backend/src/modules/tickets/tickets.service.ts`

Tambahkan query parameter:

```text
sortBy?: ticketCode | clientName | siteName | priority | status | createdAt
sortOrder?: asc | desc
```

Default:

```text
sortBy = createdAt
sortOrder = desc
```

DTO harus menggunakan whitelist/enum validation. Jangan meneruskan string `sortBy` mentah ke Prisma karena contract sorting harus eksplisit dan aman.

Service membuat mapping `sortBy` ke `Prisma.TicketOrderByWithRelationInput`, misalnya:

```text
ticketCode → { ticketCode: direction }
clientName → { site: { client: { name: direction } } }
siteName   → { site: { name: direction } }
priority   → { priority: { severityOrder: direction } }
status     → { status: direction }
createdAt  → { createdAt: direction }
```

Gunakan mapping terpusat agar DRY dan tidak membangun dynamic Prisma path dari input user.

Tambahkan stable secondary sort, minimal `id`, dan bila relevan `createdAt`, sehingga pagination stabil ketika banyak ticket memiliki nilai kolom yang sama.

Sorting harus dikombinasikan dengan existing:

- search;
- status filter;
- priority filter;
- site filter;
- category filter;
- permission filtering.

## Output Phase 5

Endpoint yang sama mampu menangani search dan sorting:

```text
GET /tickets?search=<keyword>&sortBy=<field>&sortOrder=<asc|desc>
```

Tidak diperlukan API baru.

---

# 10. Phase 6 — Update Frontend Ticket Search & Table Sorting

## File

`Frontend/src/pages/internal/tickets-page.tsx`

## Perubahan wajib

Update placeholder dari:

```text
Cari kode ticket, reporter, PIC, atau deskripsi...
```

menjadi misalnya:

```text
Cari ticket, client, site, reporter, PIC, atau deskripsi...
```

Frontend tidak membutuhkan parameter API tambahan karena backend tetap menggunakan `search` yang sama.

## Optimasi yang direkomendasikan

Saat ini perubahan setiap karakter langsung mengubah React Query key dan dapat memicu request baru.

Setelah search diperluas ke relational query Client/Site, tambahkan debounce sekitar `250–400 ms` sebelum nilai search dipakai sebagai query key.

Target:

```text
inputSearch      → berubah langsung untuk UI
debouncedSearch  → digunakan oleh React Query
```

Manfaat:

- mengurangi request saat user mengetik;
- mengurangi query relational ke PostgreSQL;
- UI tetap responsif.

Jika ingin perubahan minimum, debounce dapat ditunda. Namun untuk production workload, debounce direkomendasikan.

## Sorting UI

Tambahkan state:

```text
sortBy
sortOrder
```

dan masukkan ke React Query key:

```text
['tickets', debouncedSearch, status, sortBy, sortOrder, page]
```

Request menjadi:

```text
/tickets?page=1&pageSize=20&search=...&status=...&sortBy=createdAt&sortOrder=desc
```

### Interaksi header

Header yang sortable harus berupa button yang tetap semantic/accessibility-friendly. Behaviour:

```text
Klik kolom baru       → asc
Klik kolom yang sama  → toggle asc/desc
Ganti sort            → page kembali ke 1
```

Tampilkan indikator arah seperti `ArrowUp`, `ArrowDown`, atau `ArrowUpDown` dari `lucide-react`.

Untuk header gabungan **Client / Site**, UI sebaiknya tidak menggunakan satu sort ambigu. Pilih salah satu pendekatan berikut:

- default klik header mengurutkan `clientName`, dengan kontrol/menu kecil untuk memilih Site; atau
- ubah header menjadi dua kolom terpisah `Client` dan `Site`.

Rekomendasi roadmap: **pisahkan Client dan Site menjadi dua kolom sortable**. Ini paling jelas secara UX dan kontrak API.

Kolom `SLA Respond` dan `SLA Pengerjaan` ditampilkan tanpa affordance sorting pada phase ini.

---

# 11. Phase 7 — Database & Performance Review

## 11.1 Core update tidak membutuhkan perubahan schema

Untuk perubahan utama ini, field berikut sudah tersedia:

- `AssignmentMember.assignedAt`
- `AssignmentMember.firstCheckinAt`
- `SlaInstance.startedAt`
- `SlaInstance.warningAt`
- `SlaInstance.dueAt`
- relasi `Ticket → Site → Client`

Karena itu **Prisma schema migration tidak wajib** untuk core implementation.

## 11.2 Search performance

Database menggunakan PostgreSQL.

Search Prisma `contains + insensitive` pada PostgreSQL pada dasarnya menghasilkan pola seperti case-insensitive substring search.

## 11.2A Sorting performance

Sorting dilakukan sebelum `skip/take`, sehingga hasil pagination mewakili keseluruhan dataset. Kolom sederhana seperti `Ticket.createdAt`, `Ticket.ticketCode`, dan `Ticket.status` dapat memanfaatkan index yang sesuai; relation sort `site.name`, `client.name`, dan `priority.severityOrder` dapat memerlukan join.

Jangan menambahkan index secara spekulatif hanya untuk semua kombinasi sort. Validasi terlebih dahulu dengan `EXPLAIN ANALYZE`/metrics pada volume production. Existing index `[status, createdAt]` sudah membantu pola umum status + created date.

Untuk dataset kecil–menengah, perluasan OR ke Client/Site masih merupakan pendekatan paling sederhana dan cukup baik.

Untuk dataset besar, ordinary B-tree index tidak optimal untuk pola `%keyword%`.

### Optimasi lanjutan jika volume data besar

Gunakan PostgreSQL `pg_trgm` + GIN index untuk searchable columns, terutama:

- `tickets.ticket_code`
- `tickets.reporter_name`
- `tickets.pic_name`
- `clients.name`
- `clients.code`
- `sites.name`
- `sites.code`
- `sites.address`

Optimasi ini sebaiknya dibuat sebagai phase terpisah setelah query metrics menunjukkan kebutuhan, agar implementasi awal tidak over-engineered.

---

# 12. Phase 8 — Compatibility / Existing Data Strategy

Perubahan trigger SLA menimbulkan pertanyaan untuk assignment yang sudah ada ketika deployment dilakukan.

## Rekomendasi default — Grandfather existing WORK SLA

Existing SLA Work yang sudah dibuat sebelum deployment **jangan diubah secara destructive**.

Rule:

```text
Existing member dengan WORK SLA
→ SLA lama tetap dilanjutkan sesuai histori existing.

Member baru setelah deployment
→ WORK SLA baru dibuat saat successful check-in.
```

### Alasan

- tidak menghapus audit/history SLA lama;
- tidak mengubah outcome/breach historis;
- tidak menimbulkan inconsistency notification lama;
- deployment lebih aman;
- tidak memerlukan destructive migration.

## Jika bisnis mengharuskan cutover seluruh active assignment

Buat one-time migration/script terpisah dan jangan dicampurkan dengan migration schema.

Script harus membedakan minimal:

1. active member yang belum check-in;
2. active member yang sudah check-in;
3. completed/ended member;
4. breached SLA;
5. SLA yang sudah mempunyai event/notification.

Cutover data lama membutuhkan keputusan bisnis mengenai histori breach sebelum script dijalankan.

Karena itu roadmap utama merekomendasikan **grandfather strategy**.

---

# 13. Phase 9 — Automated Tests

Repository backend saat ini memiliki Jest, sedangkan frontend menggunakan Vitest.

## Backend test yang perlu ditambahkan

Direkomendasikan membuat test baru untuk SLA/check-in behavior, misalnya:

```text
Backend/src/modules/field-operations/field-operations.service.spec.ts
```

atau integration/e2e test sesuai pola test project.

### Minimum test matrix SLA

- assignment tidak membuat WORK SLA;
- reassignment tidak membuat WORK SLA;
- accept tidak membuat WORK SLA;
- successful check-in membuat satu WORK SLA;
- `sla.startedAt === member.firstCheckinAt`;
- `dueAt` dihitung dari check-in, bukan assignedAt;
- policy yang digunakan adalah policy efektif saat assignedAt;
- duplicate check-in tidak membuat duplicate SLA;
- remove sebelum check-in tidak error;
- reassign sebelum check-in tidak error;
- completion menyelesaikan SLA yang dibuat saat check-in;
- multi-technician menghasilkan timer independen.

## Backend test search & sorting

Tambahkan test untuk:

- ticket code;
- reporter;
- PIC;
- description;
- client name;
- client code;
- site name;
- site code;
- site address;
- case-insensitive search;
- kombinasi search + status filter;
- permission filter tetap diterapkan;
- default sort `createdAt desc`;
- sort ticket code asc/desc;
- sort Client name asc/desc;
- sort Site name asc/desc;
- sort Priority berdasarkan `severityOrder`;
- sort Status asc/desc;
- invalid `sortBy` ditolak DTO;
- invalid `sortOrder` ditolak DTO;
- sorting tetap benar ketika digabung dengan search/filter;
- stable secondary sort menjaga pagination deterministic.

## Frontend test

Jika debounce ditambahkan:

- input search langsung berubah;
- API tidak dipanggil untuk setiap keystroke;
- request menggunakan debounced keyword;
- page kembali ke `1` ketika keyword berubah;
- klik header sortable mengubah `sortBy`;
- klik header yang sama toggle `asc/desc`;
- perubahan sort mengembalikan page ke `1`;
- query key memasukkan sort state;
- indikator sort aktif sesuai state;
- SLA columns tidak menampilkan affordance sortable pada phase ini.

---

# 14. Phase 10 — Regression Validation

Sebelum release lakukan regression pada workflow berikut.

## SLA Respond

Harus tetap:

```text
Ticket created
→ SLA Respond berjalan dari ticket.createdAt
```

Perubahan Work SLA tidak boleh memengaruhi SLA Respond.

## Technician workflow

```text
Assign
→ Accept
→ Check-in
→ Start Work
→ Complete
```

Pastikan seluruh transition tetap valid.

## Admin/Head workflow

Validasi:

- assignment;
- reassignment;
- remove member;
- pending/reschedule;
- cancel;
- reopen;
- resolve/close.

## Reports

Pastikan report menangani member yang belum memiliki Work SLA.

Expected sebelum check-in:

```text
slaTargetSeconds = null/undefined
slaDueAt = null/undefined
slaOutcome = null/undefined
```

Bukan error.

## Ticket UI

Validasi sorting table:

- default ticket terbaru tampil lebih dulu;
- Ticket dapat di-sort asc/desc;
- Client dan Site dapat di-sort asc/desc;
- Priority mengikuti `severityOrder`;
- Status dapat di-sort asc/desc;
- Dibuat dapat di-sort asc/desc;
- sort tetap berlaku saat berpindah page;
- sort tetap berlaku bersama search dan status filter;
- perubahan sort reset ke halaman pertama.

Sebelum technician check-in:

```text
SLA Pengerjaan = NOT_STARTED
```

Setelah successful check-in:

```text
SLA countdown tampil dan mulai dari timestamp check-in
```

---

# 15. Urutan Implementasi yang Direkomendasikan

```text
Phase 1
Refactor SlaService
        ↓
Phase 2
Stop createWork saat assign/reassign
        ↓
Phase 3
Start createWork saat successful check-in
        ↓
Phase 4
Audit seluruh SLA lifecycle
        ↓
Phase 5
Expand backend ticket search Client/Site + server-side sorting
        ↓
Phase 6
Update frontend search + debounce + sortable headers
        ↓
Phase 7
Performance review
        ↓
Phase 8
Existing-data compatibility strategy
        ↓
Phase 9
Automated tests
        ↓
Phase 10
Regression validation
```

---

# 16. File Impact Matrix

| File | Perubahan | Prioritas |
|---|---|---|
| `Backend/src/modules/sla/sla.service.ts` | Policy-at-time resolver dan Work SLA start timestamp | Critical |
| `Backend/src/modules/assignments/assignments.service.ts` | Hapus pembuatan Work SLA saat assign/reassign; audit null-safe SLA lifecycle | Critical |
| `Backend/src/modules/field-operations/field-operations.service.ts` | Buat Work SLA setelah successful check-in di transaction yang sama | Critical |
| `Backend/src/modules/tickets/tickets.service.ts` | Tambah Client/Site pada search OR; mapping server-side `orderBy`; stable sorting; validasi aggregate tanpa SLA | High |
| `Backend/src/modules/tickets/tickets.dto.ts` | Tambah whitelist `sortBy` dan `sortOrder`; `search` tetap digunakan | High |
| `Backend/src/modules/reports/reports.service.ts` | Regression check untuk member yang belum punya Work SLA | High |
| `Backend/prisma/schema.prisma` | Review only; core change tidak membutuhkan schema migration | Low |
| `Frontend/src/pages/internal/tickets-page.tsx` | Placeholder Client/Site, debounce search, sort state, sortable headers, sort indicators | High |
| `Frontend/src/pages/internal/ticket-detail-page.tsx` | Regression validation `NOT_STARTED` sebelum check-in | Medium |
| Backend test files | Tambah SLA lifecycle + ticket relational-search tests | High |

---

# 17. Acceptance Criteria

## SLA Pengerjaan

- [ ] Assignment baru tidak langsung membuat SLA Work.
- [ ] Reassignment baru tidak langsung membuat SLA Work.
- [ ] Accept assignment tidak memulai SLA Work.
- [ ] Successful check-in membuat tepat satu SLA Work.
- [ ] `SlaInstance.startedAt` sama dengan `AssignmentMember.firstCheckinAt`.
- [ ] `warningAt` dihitung dari waktu check-in.
- [ ] `dueAt` dihitung dari waktu check-in.
- [ ] SLA policy tetap berdasarkan policy yang efektif saat assignment dibuat.
- [ ] Duplicate/concurrent check-in tidak menghasilkan duplicate SLA.
- [ ] Multi-technician memiliki SLA Work independen berdasarkan check-in masing-masing.
- [ ] Remove/reassign sebelum check-in tidak gagal karena SLA belum ada.
- [ ] Completion tetap menyelesaikan SLA Work dengan outcome yang benar.
- [ ] SLA Respond tidak berubah.

## Search Ticket

- [ ] Search tetap dapat mencari ticket code.
- [ ] Search tetap dapat mencari reporter.
- [ ] Search tetap dapat mencari PIC.
- [ ] Search tetap dapat mencari description.
- [ ] Search dapat mencari Client name.
- [ ] Search dapat mencari Client code.
- [ ] Search dapat mencari Site name.
- [ ] Search dapat mencari Site code.
- [ ] Search dapat mencari Site address.
- [ ] Search case-insensitive.
- [ ] Search tetap kompatibel dengan status/priority/site/category filters.
- [ ] Permission filtering ticket tetap berlaku.
- [ ] Search frontend tidak memicu request berlebihan ketika user mengetik jika debounce diimplementasikan.

## Sorting Ticket Table

- [ ] Default sorting tetap `createdAt desc`.
- [ ] Ticket Code dapat di-sort ascending/descending.
- [ ] Client dapat di-sort ascending/descending.
- [ ] Site dapat di-sort ascending/descending.
- [ ] Priority di-sort berdasarkan `severityOrder`.
- [ ] Status dapat di-sort ascending/descending.
- [ ] Created At dapat di-sort ascending/descending.
- [ ] Sorting dilakukan di backend sebelum pagination.
- [ ] Sorting tetap kompatibel dengan search dan seluruh filter.
- [ ] Permission filtering tidak berubah karena sorting.
- [ ] Perubahan sorting mereset pagination ke page 1.
- [ ] Urutan deterministic ketika beberapa row memiliki nilai sort yang sama.
- [ ] DTO menolak field/direction sorting yang tidak didukung.
- [ ] Header sortable menunjukkan arah sort aktif.
- [ ] SLA Respond dan SLA Pengerjaan tidak ditandai sortable sampai semantic sorting-nya didefinisikan.

---

# 18. Definition of Done

Update dianggap selesai apabila:

1. Work SLA tidak ada sebelum successful check-in untuk assignment baru.
2. Successful check-in dan pembuatan Work SLA bersifat atomic.
3. Work SLA menggunakan check-in server timestamp sebagai awal timer.
4. Version SLA policy tidak berubah hanya karena terdapat jeda antara assignment dan check-in.
5. Seluruh workflow remove/reassign/cancel/complete tetap aman ketika SLA belum dibuat.
6. Ticket search dapat menemukan data melalui Client dan Site.
7. Ticket table mendukung server-side sorting yang konsisten dengan pagination/search/filter.
8. UI ticket menampilkan `NOT_STARTED` sebelum check-in dan countdown setelah check-in.
9. Automated test untuk critical lifecycle, relational search, dan sorting lulus.
10. Backend build/test dan frontend build/test lulus.
11. Existing-data strategy ditetapkan sebelum production deployment.

---

# 19. Rekomendasi Implementasi

Untuk requirement ini, **tidak direkomendasikan membuat `SlaInstance WORK` sejak assignment dengan status khusus “belum mulai”** karena field waktu pada model SLA saat ini bersifat required dan pendekatan tersebut akan menambah state serta migration yang sebenarnya tidak dibutuhkan.

Pendekatan yang paling sederhana sekaligus menjaga performa adalah:

```text
Tidak ada WORK SLA sebelum check-in
↓
Successful check-in
↓
Create WORK SLA dalam transaction yang sama
```

Keuntungan:

- schema tetap sederhana;
- tidak diperlukan migration untuk core feature;
- tidak diperlukan state SLA baru;
- query existing sudah cukup toleran terhadap `slaInstances = []` pada banyak area;
- database unique constraint tetap menjadi concurrency guard;
- timer benar-benar merepresentasikan waktu pengerjaan di lokasi.

Untuk search, gunakan relation filtering Prisma yang sudah tersedia terlebih dahulu dan tambahkan debounce di frontend. Untuk sorting, gunakan whitelist `sortBy` → Prisma `orderBy` di backend dan stable secondary sort; jangan melakukan client-side sorting pada hasil yang sudah dipagination. PostgreSQL trigram/index tambahan baru perlu ditambahkan jika metrics production menunjukkan query search/sort sudah menjadi bottleneck.
