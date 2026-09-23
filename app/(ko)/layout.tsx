// 한국어 페이지의 루트 레이아웃. 정적 export한 HTML마다 올바른 <html lang="ko">가 박히도록
// 로케일별로 layout을 따로 둔다(클라이언트에서 lang 속성만 바꾸는 방식은 정적 파일엔 못 쓴다).
import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata('ko');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="ko">{children}</RootDocument>;
}
