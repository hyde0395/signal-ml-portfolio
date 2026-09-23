import '@/styles/globals.css';
import { baseFontVars } from '@/styles/fonts';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={baseFontVars}>
      <body>{children}</body>
    </html>
  );
}
