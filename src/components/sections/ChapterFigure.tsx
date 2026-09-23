// 3D 대체 이미지: 3D를 쓸 수 없거나 JS가 꺼진 방문자에게 장면을 정적 이미지로 보여 준다.
// 기본은 보이고, 3D 캔버스가 준비되면 <html data-3d="on">이 CSS로 숨긴다(globals.css).
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export const FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];

export function ChapterFigure({ locale, sceneKey }: { locale: Locale; sceneKey: FigureKey }) {
  const t = getT(locale);
  return (
    <figure className="scene-figure">
      <img src={`/fallback/${sceneKey}.webp`} alt={t(`figure.${sceneKey}`)} width={1280} height={720} loading="lazy" decoding="async" />
    </figure>
  );
}
