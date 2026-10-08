// en 페이지 본문 글꼴: Pretendard를 라틴(+ 다른 언어 페이지에 뜨는 한국어 언어 안내 글자)만 남긴 서브셋(scripts/build-fonts.mjs).
// 미리 받기를 끄는 이유는 fonts.ts 머리 주석
import localFont from 'next/font/local';

export const textLatin = localFont({ src: './font-files/pretendard-latin.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap', preload: false });
