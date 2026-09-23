// revealEmail이 뒤집힌 문자열을 올바른 이메일 형태로 되돌리는지 확인한다.
import { describe, expect, it } from 'vitest';
import { facts } from '@/lib/facts';
import { revealEmail } from '@/lib/email';

describe('revealEmail', () => {
  it('뒤집힌 주소를 되돌린다', () => {
    expect(revealEmail('moc.elpmaxe@a')).toBe('a@example.com');
  });
  it('facts의 주소가 올바른 형태로 복원된다', () => {
    expect(revealEmail(facts.contact.emailReversed)).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });
});
