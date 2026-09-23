'use client';
import { useState } from 'react';

export function HeaderMore({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="pill menu-toggle" aria-expanded={open} aria-controls="header-more"
              onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      <div id="header-more" className="header-more" data-open={open}>{children}</div>
    </>
  );
}
