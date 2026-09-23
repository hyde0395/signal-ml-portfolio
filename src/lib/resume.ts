import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from './i18n';

export function resumeHref(locale: Locale, publicDir = join(process.cwd(), 'public')): string | null {
  return existsSync(join(publicDir, 'resume', `${locale}.pdf`)) ? `/resume/${locale}.pdf` : null;
}
