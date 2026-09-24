// 3D 대체 이미지: 3D를 쓸 수 없거나 JS가 꺼진 방문자에게 장면을 정적 이미지로 보여 준다.
// 기본은 보이고, 3D 캔버스가 준비되면 <html data-3d="on">이 CSS로 숨긴다(globals.css).
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import type { FigureKey } from '@/three/figureKeys';
export { FIGURE_KEYS, type FigureKey } from '@/three/figureKeys';

// priority: 첫 화면 이미지는 LCP 요소라 lazy면 받기 시작이 늦어진다. 그 한 장만 바로·높은 우선순위로 받는다
export function ChapterFigure({ locale, sceneKey, priority = false }: { locale: Locale; sceneKey: FigureKey; priority?: boolean }) {
  const t = getT(locale);
  return (
    <figure className="scene-figure">
      <img src={`/fallback/${sceneKey}.webp`} alt={t(`figure.${sceneKey}`)} width={1280} height={720}
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
    </figure>
  );
}
