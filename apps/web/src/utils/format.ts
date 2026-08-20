export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '—';
  const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}h` : '', hours ? `${hours}j` : '', `${minutes}m`].filter(Boolean).join(' ');
}
export function statusLabel(value: string): string { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }
