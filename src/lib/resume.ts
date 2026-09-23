// 언어별 이력서 PDF 경로를 반환한다. 빌드 시점(정적 export)에 public/resume/<locale>.pdf 파일이
// 실제로 있는지 확인해서, 아직 없는 언어는 깨진 링크 대신 "준비 중" 표시로 대체할 수 있게 한다.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from './i18n';

export function resumeHref(locale: Locale, publicDir = join(process.cwd(), 'public')): string | null {
  return existsSync(join(publicDir, 'resume', `${locale}.pdf`)) ? `/resume/${locale}.pdf` : null;
}
