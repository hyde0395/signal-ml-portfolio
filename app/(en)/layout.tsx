import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata('en');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
