// ko 페이지(와 공용 404) 본문 글꼴: Pretendard를 ko·en 글자만 남긴 서브셋(scripts/build-fonts.mjs). 문구가 바뀌면 npm run fonts.
// 예전 동적 서브셋 CSS는 페이지 전체 글자 때문에 첫 배치에서 조각 25개(약 650KB)를 받아 LCP를 늘렸다(계획 2026-10-08 성능).
// 미리 받기를 끄는 이유는 fonts.ts 머리 주석
import localFont from 'next/font/local';

export const textKo = localFont({ src: './font-files/pretendard-ko.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap', preload: false });
