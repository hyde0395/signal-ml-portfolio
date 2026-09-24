// 3D 대체 이미지: 3D를 쓸 수 없거나 JS가 꺼진 방문자에게 장면을 정적 이미지로 보여 준다.
// <html data-3d>가 "pending"(판정 대기, src/lib/boot.ts) 또는 "on"(3D 준비됨)이면 CSS로 숨긴다(globals.css).
// 모두 lazy: 숨겨진 lazy 이미지는 받지 않으므로, 3D를 쓸 방문자는 첫 화면 이미지도 받지 않고 LCP가 이름 글자가 된다.
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import type { FigureKey } from '@/three/figureKeys';
export { FIGURE_KEYS, type FigureKey } from '@/three/figureKeys';

export function ChapterFigure({ locale, sceneKey }: { locale: Locale; sceneKey: FigureKey }) {
  const t = getT(locale);
  return (
    <figure className="scene-figure">
      <img src={`/fallback/${sceneKey}.webp`} alt={t(`figure.${sceneKey}`)} width={1280} height={720}
        loading="lazy" decoding="async" />
    </figure>
  );
}
