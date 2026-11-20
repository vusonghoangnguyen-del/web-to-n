'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function ResponsiveDisclosure({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 701px)');
    const update = () => setOpen(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <details className={className} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{label}</summary>{children}</details>;
}
