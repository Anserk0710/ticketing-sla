import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SlaCountdownProps {
  dueAt?: string | Date | null;
  status?: string | null;
  outcome?: string | null;
  completedAt?: string | Date | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function formatCountdownDigits(totalSeconds: number): string {
  const absolute = Math.abs(totalSeconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const seconds = absolute % 60;

  const hStr = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : '';
  const mStr = `${minutes.toString().padStart(2, '0')}:`;
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}${mStr}${sStr}`;
}

export function SlaCountdown({
  dueAt,
  status,
  outcome,
  completedAt,
  className,
  size = 'md',
  showLabel = true
}: SlaCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!dueAt) return null;
    return Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000);
  });

  useEffect(() => {
    if (!dueAt || completedAt || outcome === 'MET' || outcome === 'COMPLETED_BREACHED' || status === 'COMPLETED') {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const diff = Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueAt, completedAt, outcome, status]);

  if (completedAt || outcome === 'MET' || status === 'COMPLETED') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200', className)}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {outcome === 'MET' ? 'SLA Met' : 'Selesai'}
      </span>
    );
  }

  if (outcome === 'COMPLETED_BREACHED') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200', className)}>
        <AlertCircle className="h-3.5 w-3.5" />
        Selesai (Breached)
      </span>
    );
  }

  if (!dueAt || secondsLeft === null) {
    return <span className={cn('text-xs text-lavender-grey-400 font-medium', className)}>—</span>;
  }

  const isBreached = secondsLeft <= 0 || status === 'BREACHED';
  const isWarning = !isBreached && (secondsLeft <= 900 || status === 'WARNING');

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-2 text-sm md:text-base font-extrabold'
  };

  const timerString = formatCountdownDigits(secondsLeft);

  if (isBreached) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-rose-600 text-white font-extrabold shadow-sm shadow-rose-600/30 animate-pulse',
          sizeClasses[size],
          className
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Breached</span>

      </span>
    );
  }


  if (isWarning) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white font-bold shadow-sm shadow-amber-500/20 animate-pulse',
          sizeClasses[size],
          className
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono">{timerString}</span>
        {showLabel && <span className="text-[10px] uppercase tracking-wider opacity-90">Sisa</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-alice-blue-50 text-alice-blue-900 border border-alice-blue-300 font-bold',
        sizeClasses[size],
        className
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-alice-blue-600" />
      <span className="font-mono">{timerString}</span>
      {showLabel && <span className="text-[10px] uppercase tracking-wider text-alice-blue-700">Sisa</span>}
    </span>
  );
}
