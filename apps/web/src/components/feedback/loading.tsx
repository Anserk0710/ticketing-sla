export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center text-sm font-semibold text-lavender-grey-300">
      <span className="mr-3 h-6 w-6 animate-spin rounded-full border-2 border-charcoal-700 border-t-alice-blue-400" />
      {label}
    </div>
  );
}

export function ErrorPanel({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-4 text-sm font-semibold text-rose-900 shadow-sm">
      {error instanceof Error ? error.message : 'Terjadi kesalahan.'}
    </div>
  );
}

