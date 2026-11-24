import {
  formatExcelDateTime,
  formatExcelDuration,
  formatPriority,
  formatSlaStatus,
  formatTicketStatus,
  sanitizeExcelCell,
} from './excel';

describe('Excel Utilities', () => {
  describe('sanitizeExcelCell', () => {
    it('prepends single quote to dangerous formula characters', () => {
      expect(sanitizeExcelCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeExcelCell('+cmd|')).toBe("'+cmd|");
      expect(sanitizeExcelCell('-123')).toBe("'-123");
      expect(sanitizeExcelCell('@admin')).toBe("'@admin");
      expect(sanitizeExcelCell('Normal Text')).toBe('Normal Text');
      expect(sanitizeExcelCell(12345)).toBe(12345);
    });
  });

  describe('formatExcelDateTime', () => {
    it('formats dates into DD/MM/YYYY HH:mm in Makassar timezone', () => {
      const date = new Date('2026-11-20T04:22:15.000Z'); // 04:22 UTC = 12:22 WITA (UTC+8)
      const formatted = formatExcelDateTime(date, 'Asia/Makassar');
      expect(formatted).toBe('20/11/2026 12:22');
    });

    it('returns em-dash for null or undefined or invalid date', () => {
      expect(formatExcelDateTime(null)).toBe('—');
      expect(formatExcelDateTime(undefined)).toBe('—');
      expect(formatExcelDateTime('invalid-date')).toBe('—');
    });
  });

  describe('formatExcelDuration', () => {
    it('formats seconds into readable hours and minutes', () => {
      expect(formatExcelDuration(3600)).toBe('1 Jam');
      expect(formatExcelDuration(3660)).toBe('1 Jam 1 Menit');
      expect(formatExcelDuration(7200)).toBe('2 Jam');
      expect(formatExcelDuration(7320)).toBe('2 Jam 2 Menit');
      expect(formatExcelDuration(900)).toBe('15 Menit');
      expect(formatExcelDuration(45)).toBe('45 Detik');
      expect(formatExcelDuration(0)).toBe('0 Menit');
      expect(formatExcelDuration(null)).toBe('—');
      expect(formatExcelDuration(undefined)).toBe('—');
    });
  });

  describe('formatTicketStatus', () => {
    it('translates ticket statuses to human readable Indonesian labels', () => {
      expect(formatTicketStatus('NEW')).toBe('Tiket Baru');
      expect(formatTicketStatus('ASSIGNED')).toBe('Sudah Ditugaskan');
      expect(formatTicketStatus('IN_PROGRESS')).toBe('Dalam Pengerjaan');
      expect(formatTicketStatus('RESOLVED')).toBe('Selesai Ditangani');
      expect(formatTicketStatus('CLOSED')).toBe('Ditutup (Selesai)');
      expect(formatTicketStatus('UNKNOWN_STATUS')).toBe('UNKNOWN STATUS');
      expect(formatTicketStatus(null)).toBe('—');
    });
  });

  describe('formatSlaStatus', () => {
    it('translates SLA outcomes and statuses accurately', () => {
      expect(formatSlaStatus('MET')).toBe('Tepat Waktu (Achieved)');
      expect(formatSlaStatus('ACHIEVED')).toBe('Tepat Waktu (Achieved)');
      expect(formatSlaStatus('BREACHED')).toBe('Lewat Batas (Breached)');
      expect(formatSlaStatus('COMPLETED_BREACHED')).toBe('Selesai - Terlambat');
      expect(formatSlaStatus('WARNING')).toBe('Mendekati Batas Waktu');
      expect(formatSlaStatus('ON_TRACK')).toBe('Sedang Berjalan');
      expect(formatSlaStatus('NOT_STARTED')).toBe('Belum Dimulai');
      expect(formatSlaStatus(null)).toBe('—');
    });
  });

  describe('formatPriority', () => {
    it('translates priority codes', () => {
      expect(formatPriority('P1')).toBe('P1 (Kritis)');
      expect(formatPriority('P2')).toBe('P2 (Tinggi)');
      expect(formatPriority('P3')).toBe('P3 (Sedang)');
      expect(formatPriority('P4')).toBe('P4 (Rendah)');
      expect(formatPriority('CRITICAL')).toBe('P1 (Kritis)');
      expect(formatPriority(null)).toBe('—');
    });
  });
});
