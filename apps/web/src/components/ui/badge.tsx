import { cn } from '../../lib/cn';

export function Badge({ value, className, variant }: { value: string; className?: string; variant?: 'dark' | 'light' }) {
  const key = value.toUpperCase();

  let tone = 'bg-alice-blue-50 text-alice-blue-800 border-alice-blue-200/80';

  if (variant === 'dark') {
    tone = key.includes('ADMIN') ? 'bg-purple-950/80 text-purple-300 border-purple-700/60'
      : key.includes('HEAD') ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
      : key.includes('TECH') ? 'bg-powder-blue-800/80 text-powder-blue-300 border-powder-blue-700/60'
      : 'bg-charcoal-800 text-charcoal-300 border-charcoal-700';
  } else if (key.includes('BREACH') || ['REJECTED', 'CANCELLED', 'SUSPENDED'].includes(key)) {
    tone = 'bg-rose-100 text-rose-800 border-rose-200/80';
  } else if (key.includes('WARNING') || ['PENDING_APPROVAL', 'NEW'].includes(key)) {
    tone = 'bg-amber-100 text-amber-900 border-amber-300/80';
  } else if (['CLOSED', 'COMPLETED', 'MET', 'APPROVED'].includes(key)) {
    tone = 'bg-emerald-100 text-emerald-800 border-emerald-200/80';
  } else if (key === 'RESOLVED') {
    tone = 'bg-emerald-100 text-emerald-900 border-emerald-300/80';
  } else if (key === 'IN_PROGRESS') {
    tone = 'bg-alice-blue-100 text-alice-blue-900 border-alice-blue-200/80';
  } else if (key === 'ON_SITE') {
    tone = 'bg-indigo-100 text-indigo-900 border-indigo-200/80';
  } else if (key === 'ASSIGNED') {
    tone = 'bg-violet-100 text-violet-900 border-violet-200/80';
  } else if (key === 'RESPONDED') {
    tone = 'bg-cyan-100 text-cyan-900 border-cyan-200/80';
  } else if (key === 'REOPENED') {
    tone = 'bg-purple-100 text-purple-900 border-purple-200/80';
  } else if (key === 'PENDING') {
    tone = 'bg-orange-100 text-orange-900 border-orange-300/80';
  } else if (['CRITICAL', 'P1'].includes(key)) {
    tone = 'bg-rose-100 text-rose-900 border-rose-300 font-black';
  } else if (['HIGH', 'P2'].includes(key)) {
    tone = 'bg-orange-100 text-orange-900 border-orange-200/80';
  } else if (['MEDIUM', 'P3'].includes(key)) {
    tone = 'bg-amber-100 text-amber-900 border-amber-200/80';
  } else if (['LOW', 'P4'].includes(key)) {
    tone = 'bg-iron-grey-100 text-charcoal-700 border-iron-grey-200/80';
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors', tone, className)}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

