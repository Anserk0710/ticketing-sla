export function sanitizeExcelCell(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

export function formatExcelDateTime(date: Date | string | null | undefined, timezone = 'Asia/Makassar'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  try {
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return formatted.replace(',', '').replace(/\./g, ':').trim();
  } catch {
    return d.toISOString();
  }
}

export function formatExcelDuration(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds <= 0) return '0 Menit';

  const totalSecs = Math.round(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const remainingSecs = totalSecs % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} Jam ${minutes} Menit` : `${hours} Jam`;
  }
  if (minutes > 0) {
    return `${minutes} Menit`;
  }
  return `${remainingSecs} Detik`;
}

export function formatTicketStatus(status?: string | null): string {
  if (!status) return '—';
  switch (status.toUpperCase()) {
    case 'NEW':
      return 'Tiket Baru';
    case 'RESPONDED':
      return 'Sudah Direspon';
    case 'ASSIGNED':
      return 'Sudah Ditugaskan';
    case 'ON_SITE':
      return 'Teknisi di Lokasi';
    case 'IN_PROGRESS':
      return 'Dalam Pengerjaan';
    case 'PENDING':
      return 'Ditunda (Pending)';
    case 'RESOLVED':
      return 'Selesai Ditangani';
    case 'CLOSED':
      return 'Ditutup (Selesai)';
    case 'REOPENED':
      return 'Dibuka Kembali';
    case 'CANCELLED':
      return 'Dibatalkan';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function formatSlaStatus(status?: string | null): string {
  if (!status) return '—';
  switch (status.toUpperCase()) {
    case 'MET':
    case 'ACHIEVED':
      return 'Tepat Waktu (Achieved)';
    case 'BREACHED':
      return 'Lewat Batas (Breached)';
    case 'COMPLETED_BREACHED':
      return 'Selesai - Terlambat';
    case 'WARNING':
      return 'Mendekati Batas Waktu';
    case 'ON_TRACK':
    case 'RUNNING':
      return 'Sedang Berjalan';
    case 'NOT_STARTED':
      return 'Belum Dimulai';
    case 'TERMINATED_REJECTED':
      return 'Ditolak';
    case 'CANCELLED':
      return 'Dibatalkan';
    case 'REASSIGNED':
      return 'Dialihkan';
    case 'REMOVED':
      return 'Dihapus';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function formatPriority(code?: string | null): string {
  if (!code) return '—';
  const c = code.toUpperCase();
  if (c === 'P1' || c === 'CRITICAL') return 'P1 (Kritis)';
  if (c === 'P2' || c === 'HIGH') return 'P2 (Tinggi)';
  if (c === 'P3' || c === 'MEDIUM') return 'P3 (Sedang)';
  if (c === 'P4' || c === 'LOW') return 'P4 (Rendah)';
  return code;
}
