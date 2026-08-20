import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Button({ children, className, variant = 'primary', loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }) {
  const styles = {
    primary: 'bg-alice-blue-600 text-white hover:bg-alice-blue-700 active:bg-alice-blue-800 shadow-sm shadow-alice-blue-600/20 focus:ring-alice-blue-600',
    secondary: 'border border-lavender-grey-200 bg-white text-charcoal-950 hover:bg-lavender-grey-200 active:bg-lavender-grey-300 shadow-sm focus:ring-lavender-grey-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm shadow-rose-600/20 focus:ring-rose-500',
    ghost: 'text-charcoal-900 hover:bg-lavender-grey-200 active:bg-lavender-grey-300 focus:ring-lavender-grey-400'
  };

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60', styles[variant], className)}
    >
      {loading ? 'Memproses…' : children}
    </button>
  );
}


