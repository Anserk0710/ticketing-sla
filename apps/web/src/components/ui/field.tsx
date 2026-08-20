import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-semibold text-charcoal-950">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-lavender-grey-600">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

const baseInput = 'w-full rounded-xl border border-lavender-grey-200 bg-white px-3.5 py-2.5 text-sm text-charcoal-950 shadow-sm placeholder:text-lavender-grey-400 focus:border-alice-blue-600 focus:outline-none focus:ring-2 focus:ring-alice-blue-600/20 transition-all file:mr-3 file:rounded-lg file:border-0 file:bg-lavender-grey-200 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-charcoal-800 hover:file:bg-lavender-grey-300';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(baseInput, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(baseInput, 'min-h-28 resize-y leading-relaxed', props.className)} />;
}

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(baseInput, 'bg-white text-charcoal-900 [&>option]:bg-white [&>option]:text-charcoal-900', className)}>
      {children}
    </select>
  );
}

