export function revealEmail(reversed: string): string {
  return [...reversed].reverse().join('');
}
