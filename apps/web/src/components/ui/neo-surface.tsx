import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type NeoSurfaceVariant = 'raised' | 'white' | 'soft' | 'inset';

const variantClass: Record<NeoSurfaceVariant, string> = {
  raised: 'neo-card',
  white: 'neo-card-white',
  soft: 'neo-soft',
  inset: 'neo-inset'
};

export function NeoSurface({
  children,
  className,
  variant = 'raised',
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; variant?: NeoSurfaceVariant }) {
  return (
    <div {...props} className={cn('rounded-[22px]', variantClass[variant], className)}>
      {children}
    </div>
  );
}
