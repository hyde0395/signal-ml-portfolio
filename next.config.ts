// Next.js 설정. Vercel에 정적 export로 배포하므로 서버 런타임 기능(이미지 최적화 등)은 쓰지 않는다.
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // 정적 HTML/CSS/JS로 빌드(out/). 서버 없이 서빙 가능.
  trailingSlash: true, // 주소가 항상 슬래시로 끝나게(/en/, /ja/) — 정적 파일 서버의 폴더 인덱스 규칙과 맞춘다.
  images: { unoptimized: true }, // next/image 서버 최적화는 정적 export에서 못 쓴다.
  experimental: { globalNotFound: true }, // 로케일별이 아닌 사이트 전체 공용 404(app/global-not-found.tsx) 사용.
};

export default nextConfig;
