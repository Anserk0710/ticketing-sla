# Spesifikasi Reporting

## 1. Prinsip

Live report adalah tampilan utama. Excel merupakan export dari query, filter, dan timezone yang sama. Tidak boleh ada formula bisnis yang berbeda antara dashboard, live report, dan export.

## 2. Report Ticket

### Filter

- rentang tanggal ticket;
- client;
- site;
- category;
- priority;
- internal status;
- public status;
- Head/Admin responder;
- assigned by;
- lead technician;
- assigned technician;
- SLA Respond status;
- SLA Pengerjaan status;
- breached only;
- service cycle;
- keyword ticket code/PIC.

### Kolom Utama

| Kelompok | Kolom |
|---|---|
| Ticket | code, client, site, reporter, PIC, contact masked, category, priority, status |
| Waktu | created, first responded, assigned, first check-in, resolved, closed |
| Actor | responded by, assigned by, lead technician, all technicians |
| SLA Respond | target, deadline, elapsed, status, breach duration |
| SLA Pengerjaan | aggregate status, jumlah member met/breached/active |
| Operasional | location summary, resolution summary, reopen cycle |

Row ticket dapat dibuka menjadi detail assignment member.

## 3. Report Teknisi

Satu row per technician assignment member.

Kolom minimum:

- ticket code;
- client/site;
- priority;
- technician;
- lead/member role;
- assigned by;
- assigned at;
- accepted/rejected at;
- first check-in at;
- work started at;
- completed at;
- assignment elapsed;
- onsite work elapsed;
- SLA target;
- SLA due;
- SLA outcome;
- breach duration;
- completion summary;
- reassignment outcome;
- service cycle.

## 4. Detail Drawer/Page

Dari report, actor berwenang dapat membuka:

- timeline;
- map dengan marker site dan check-in;
- coordinate dan accuracy;
- foto check-in;
- media penyelesaian;
- response;
- assignment history;
- SLA timeline;
- audit summary.

Media tetap mengikuti access policy.

## 5. Dashboard KPI

### Ticket

- total dibuat;
- new/unresponded;
- active;
- resolved;
- closed;
- rejected/cancelled;
- reopened.

### SLA Respond

- eligible count;
- met count/rate;
- breached count/rate;
- median/p90 response time;
- open warning/breach.

### SLA Pengerjaan

- eligible technician assignments;
- met/breached per technician;
- median/p90 assignment elapsed;
- active warning/breach;
- workload per technician;
- reassignment count.

## 6. Excel

Workbook minimum:

1. `Summary`
2. `Tickets`
3. `Technician SLA`
4. `Filters & Metadata`

`Filters & Metadata` memuat:

- waktu export;
- timezone;
- actor export;
- filter;
- policy/report version.

Proteksi formula injection: string yang diawali karakter berbahaya harus di-escape.

## 7. Pagination dan Performance

- Live report wajib pagination.
- Sort default: `created_at DESC`.
- Query menggunakan index.
- Export kecil dapat sinkron; export besar menggunakan job queue.
- Jangan memuat binary media pada query report.

## 8. Konsistensi

Test otomatis harus membandingkan:

- jumlah row hasil API report;
- jumlah row Excel;
- timestamp dan timezone;
- SLA outcome;
- assigned by/technician mapping.
