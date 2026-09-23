// ja 로케일 전용 글꼴 파일. ko/en 레이아웃은 이 파일을 import하지 않으므로, ko/en 페이지 번들에는
// 일본어 글꼴 CSS가 실리지 않는다.
import { Noto_Sans_JP } from 'next/font/google';

// 일본어 페이지 layout에서만 import한다. 가나·한자 서브셋이 크므로 preload하지 않는다.
export const jp = Noto_Sans_JP({ weight: ['400', '600'], variable: '--font-jp', display: 'swap', preload: false });
