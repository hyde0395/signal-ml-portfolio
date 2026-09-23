// 한국어 홈페이지(기본 로케일, 주소 "/"). 실제 내용은 HomePage 컴포넌트에 있고 이 파일은 locale만 지정한다.
import { HomePage } from '@/components/HomePage';

export default function Page() {
  return <HomePage locale="ko" />;
}
