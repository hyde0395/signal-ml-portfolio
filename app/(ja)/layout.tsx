import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';
import { jp } from '@/styles/font-jp';

export const metadata = buildMetadata('ja');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="ja" extraClass={jp.variable}>{children}</RootDocument>;
}
