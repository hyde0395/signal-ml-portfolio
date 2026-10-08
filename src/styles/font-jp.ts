// ja 로케일 전용 글꼴. Noto Sans JP를 ja 페이지에 나오는 글자만 남겨(scripts/build-fonts.mjs, 굵기 400~600) 한 파일로
// 쓴다 — Google 글꼴 조각(약 120개 중 페이지당 40개·830KB)을 받던 것을 줄였다(계획 2026-10-08 성능). 라틴도 담아
// ja 페이지 라틴 모양은 그대로. 미리 받기를 끄는 이유는 fonts.ts 머리 주석
import localFont from 'next/font/local';

export const jp = localFont({ src: './font-files/noto-sans-jp.woff2', weight: '400 600', variable: '--font-jp', display: 'swap', preload: false });
// Noto 서브셋에 없는 글자(한국어 언어 안내 등)를 그릴 예비 Pretendard. 그런 글자가 화면에 있을 때만 받는다
export const textFallback = localFont({ src: './font-files/pretendard-latin.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap', preload: false });
