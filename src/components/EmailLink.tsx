'use client';
// 이메일 주소를 화면에 보여준다. 뒤집힌 문자열(facts.contact.emailReversed)을 서버 렌더링/정적
// HTML에는 넣지 않고 useEffect로 클라이언트에서만 복원해, HTML 소스를 긁는 주소 수집 봇을 피한다.
import { useEffect, useState } from 'react';
import { revealEmail } from '@/lib/email';

export function EmailLink({ reversed, fallback }: { reversed: string; fallback: string }) {
  const [email, setEmail] = useState<string | null>(null);
  // 마운트 후에만 복원하므로, JS가 꺼져 있으면 fallback 문구만 보인다(e2e에서 확인).
  useEffect(() => setEmail(revealEmail(reversed)), [reversed]);
  if (!email) return <span className="muted">{fallback}</span>;
  return <a href={`mailto:${email}`} data-testid="email">{email}</a>;
}
