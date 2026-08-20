import type { ReactNode } from 'react';
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-alice-blue-600">{eyebrow}</p>}<h1 className="page-title mt-1">{title}</h1>{description && <p className="mt-2 max-w-3xl text-sm text-lavender-grey-500">{description}</p>}</div>{action}</div>;
}
