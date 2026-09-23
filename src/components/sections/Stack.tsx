// "기술 스택" 섹션: 데이터 파이프라인을 collect → external → model → serve 순서로 보여준다.
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

// content/*.json의 stack.<step>.title/body 키와 순서를 맞춘 목록.
const STEPS = ['collect', 'external', 'model', 'serve'] as const;

export function Stack({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="stack" data-section="stack" className="wrap" aria-labelledby="stack-h">
      <p className="eyebrow">STACK</p>
      <h2 id="stack-h" className="display">{t('stack.heading')}</h2>
      <ol className="pipeline">
        {STEPS.map((s) => (
          <li key={s}>
            <strong className="mono">{t(`stack.${s}.title`)}</strong>
            <span>{t(`stack.${s}.body`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
