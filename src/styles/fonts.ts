// Pretendard는 여기서 정의하지 않는다. 한글 서브셋 파일이 굵기당 약 270KB라,
// 패키지의 dynamic-subset CSS(유니코드 범위별 92조각)를 import해 페이지에 실제로 나온 글자 조각만 받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

export const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });

export const baseFontVars = `${display.variable} ${mono.variable}`;
