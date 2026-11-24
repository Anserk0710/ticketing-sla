export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours ? `${hours} jam` : '', `${minutes} menit`].filter(Boolean).join(' ');
}

export function toAverageDurationDisplay(hours?: number | null): {
  value: number;
  note: string;
} {
  const normalizedHours = Math.max(0, hours ?? 0);
  const useMinutes = normalizedHours < 1;
  const value = useMinutes ? normalizedHours * 60 : normalizedHours;

  return {
    value: Number(value.toFixed(2)),
    note: `Rata-rata (${useMinutes ? 'Menit' : 'Jam'})`,
  };
}

export function statusLabel(value: string): string {
  if (value.toUpperCase() === 'MET' || value.toUpperCase() === 'ACHIEVED') return 'Achieved';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
