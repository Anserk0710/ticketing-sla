import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={cn('rounded-2xl border border-iron-grey-200/80 bg-white p-6 shadow-sm transition-all', className)}>{children}</div>;
}

