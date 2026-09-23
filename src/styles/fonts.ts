// Pretendard는 여기서 정의하지 않는다. 한글 서브셋 파일이 굵기당 약 270KB라,
// 패키지의 dynamic-subset CSS(유니코드 범위별 92조각)를 import해 페이지에 실제로 나온 글자 조각만 받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { IBM_Plex_Mono, Noto_Sans_JP, Space_Grotesk } from 'next/font/google';

export const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });
// 일본어 페이지 layout에서만 import한다. 가나·한자 서브셋이 크므로 preload하지 않는다.
export const jp = Noto_Sans_JP({ weight: ['400', '600'], variable: '--font-jp', display: 'swap', preload: false });

export const baseFontVars = `${display.variable} ${mono.variable}`;
