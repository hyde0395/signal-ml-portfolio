// 일본어 페이지의 루트 레이아웃. 정적 export한 HTML마다 올바른 <html lang="ja">가 박히도록
// 로케일별로 layout을 따로 둔다. Noto Sans JP 변수(jp.variable)도 이 layout에서만 붙여서
// ko/en 페이지에는 일본어 글꼴 CSS가 실리지 않게 한다. Noto에 없는 글자를 그릴 예비 Pretendard(미리 받지 않음)도 붙인다.
import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';
import { jp, textFallback } from '@/styles/font-jp';

export const metadata = buildMetadata('ja');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="ja" extraClass={`${jp.variable} ${textFallback.variable}`}>{children}</RootDocument>;
}
