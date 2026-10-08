// 글꼴: 제목 Space Grotesk·수치 IBM Plex Mono(Google, 라틴만, 미리 받기). 모든 페이지가 쓴다.
// 본문 Pretendard·일본어 Noto Sans JP는 사이트에 나오는 글자만 남긴 로컬 서브셋이고(scripts/build-fonts.mjs,
// 계획 2026-10-08 성능) 로케일마다 파일을 나눠 둔다(font-ko.ts·font-en.ts·font-jp.ts). 셋 다 미리 받기(preload)를
// 끈다 — 루트 레이아웃이 로케일마다 따로인 이 앱에서 Next(Turbopack)는 미리 받기 글꼴을 모든 페이지에 넣어,
// 켜 두면 ko 페이지도 ja·en 글꼴까지 받았다. 꺼도 브라우저는 그 페이지가 실제로 쓰는 글꼴만 받는다
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

export const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });

export const baseFontVars = `${display.variable} ${mono.variable}`;
