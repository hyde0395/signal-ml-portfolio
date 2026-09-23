'use client';
import { useEffect, useState } from 'react';
import { revealEmail } from '@/lib/email';

export function EmailLink({ reversed, fallback }: { reversed: string; fallback: string }) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => setEmail(revealEmail(reversed)), [reversed]);
  if (!email) return <span className="muted">{fallback}</span>;
  return <a href={`mailto:${email}`} data-testid="email">{email}</a>;
}
