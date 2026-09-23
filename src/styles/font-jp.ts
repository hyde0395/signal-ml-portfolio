import { Noto_Sans_JP } from 'next/font/google';

// 일본어 페이지 layout에서만 import한다. 가나·한자 서브셋이 크므로 preload하지 않는다.
export const jp = Noto_Sans_JP({ weight: ['400', '600'], variable: '--font-jp', display: 'swap', preload: false });
