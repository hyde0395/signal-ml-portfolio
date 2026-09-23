'use client';
// 이메일 주소를 화면에 보여준다. 뒤집힌 문자열(facts.contact.emailReversed)은 RSC props로
// HTML에 실제로 포함되지만, 복원된 원본 주소는 useEffect로 클라이언트에서만 만들어 HTML 소스에는
// 연속 문자열로 나타나지 않는다(주소 수집 봇이 소스를 긁어도 원본 주소는 얻지 못한다).
import { useEffect, useState } from 'react';
import { revealEmail } from '@/lib/email';

export function EmailLink({ reversed, fallback }: { reversed: string; fallback: string }) {
  const [email, setEmail] = useState<string | null>(null);
  // 마운트 후에만 복원하므로, JS가 꺼져 있으면 fallback 문구만 보인다(e2e에서 확인).
  useEffect(() => setEmail(revealEmail(reversed)), [reversed]);
  if (!email) return <span className="muted">{fallback}</span>;
  return <a href={`mailto:${email}`} data-testid="email">{email}</a>;
}
