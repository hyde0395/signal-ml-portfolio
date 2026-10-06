// ⑤ 검증 설계 점(계획 8-1, 설계 2026-09-30-validation-filter-dots-design §4.2): 실제 수집 행 표본을 수집일(가로) × 출발일(세로)에
// 뿌리고, 자막 칸마다 평가 방식이 데이터를 나누는 모습을 색으로 보인다 — K-Fold(가운데 시간 구간이 평가, 앞뒤가 학습),
// GroupKFold(노선·출발일째 평가), TimeSeriesSplit(과거만 학습, 다음 구간 평가, sub마다 경계가 밀려 간다).
// 점 자리는 단계와 무관하고 색·알파만 바뀐다 — 3D에서는 같은 지형 점이 제자리에서 색만 바뀐다.
// 판 위 수치는 방식마다 한 줄씩 쌓이는 점수판(정보 전달 2 §5) — 지난 줄은 흐리게, 마지막 TSS 줄만 호박색·크게.
import type { ChartsData } from './data';
import { DAY, mulberry32, Pts, utc, type PlotSize } from './layouts';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from './types';

// subs: TSS 단계만 폴드 5개를 저절로 넘긴다(사용자 결정 2026-09-30, 약 1.2초). jitterPx: 같은 날 수집·같은 출발일 점이
// 한 점에 겹치지 않게 조금 흔든다(시드 고정 — 단계가 바뀌어도 자리 그대로). unusedA: 아직 안 쓴(미래) 점의 알파
// wideMinPx 820: 옆 칸(0.78W)이 영어 문구까지 담으려면 판이 820px는 돼야 한다. 그보다 좁으면 옆 칸이 판 밖으로 나가
// 페이지 가로 스크롤이 생겼다(8-1 최종 검토). 820 이상에서 긴 꼬리표는 CSS가 판 오른쪽 끝에서 줄바꿈한다.
// trainA: 학습 점은 배경 층 — 규칙이 무엇을 걸렀는지 먼저 보이게(설계 2026-10-04 §4)
export const SPLIT = { stages: 3, subs: [1, 1, 5], subMs: 1200, wideMinPx: 820, jitterPx: 1.6, seed: 5, unusedA: 0.2, trainA: 0.4 } as const;

export type SplitMethod = { name: string; r2: string; mae: string; tag: string };
export type SplitTexts = {
  month(iso: string): string;
  axisX: string; axisY: string;
  legend: [string, string, string];            // 학습, 평가, 아직 안 씀
  methods: readonly [SplitMethod, SplitMethod, SplitMethod]; // K-Fold, GroupKFold, TimeSeriesSplit 순
};

// 0 학습, 1 평가, 2 아직 안 씀(TSS에서 평가 구간 뒤 — 그 폴드를 잴 때는 아직 없던 미래 행)
export function splitRole(sp: NonNullable<ChartsData['split']>, i: number, stage: number, sub: number): 0 | 1 | 2 {
  if (stage === 0) return sp.kf[i] === sp.show.kf ? 1 : 0;
  if (stage === 1) return sp.gkf[i] === sp.show.gkf ? 1 : 0;
  const t = sp.tss[i];
  return t === sub ? 1 : t < sub ? 0 : 2;
}

const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function splitLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: SplitTexts): ChartLayout {
  const sp = d.split;
  if (!sp) throw new Error('charts.json에 split이 없다');
  const st = Math.max(0, Math.min(SPLIT.stages - 1, Math.floor(stage)));
  const sb = Math.max(0, Math.min(SPLIT.subs[st] - 1, Math.floor(sub)));
  const W = size.w, H = size.h, wide = W >= SPLIT.wideMinPx;
  // 넓은 판: 오른쪽 24%에 수치·범례. 좁은 판: 위쪽 28%에 수치
  const gx0 = W * (wide ? 0.08 : 0.14), gx1 = wide ? W * 0.74 : W - 8;
  const top = H * (wide ? 0.08 : 0.34), bottom = H * 0.86;
  // 수집 시작일 = 기준일(마지막 수집일) − (fetchDays − 1)일
  const start = utc(d.asOf) - (sp.fetchDays - 1) * DAY;
  const XF = (f: number) => gx0 + (gx1 - gx0) * (f / Math.max(1, sp.fetchDays - 1));
  const t0 = utc(d.dates[0]), t1 = utc(d.dates[d.dates.length - 1]);
  const YT = (t: number) => bottom - (bottom - top) * ((t - t0) / Math.max(1, t1 - t0));
  const p = new Pts();
  const dot = wide ? 2.2 : 1.6;
  const rand = mulberry32(SPLIT.seed);
  for (let i = 0; i < sp.fetch.length; i++) {
    const jx = (rand() - 0.5) * 2 * SPLIT.jitterPx, jy = (rand() - 0.5) * 2 * SPLIT.jitterPx;
    const role = splitRole(sp, i, st, sb);
    const x = Math.min(1, Math.max(0, (XF(sp.fetch[i]) + jx) / W));
    const y = Math.min(1, Math.max(0, (YT(utc(d.dates[sp.date[i]])) + jy) / H));
    p.add(x, y, dot, role === 1 ? 0.95 : role === 0 ? SPLIT.trainA : SPLIT.unusedA, role === 1 ? TONE.amber : TONE.dot, sp.date[i]);
  }

  // 점수판(정보 전달 2 §5): 줄 3개 × (이름·R², MAE) + 꼬리표 + 폴드 = 앞 8개. 아직 안 나온 줄도 빈 글자로 자리를 둔다 —
  // 그림 판이 이름표를 번호로 그려, 같은 번호의 플립이 단계 사이에 이어지고 지난 줄은 글자가 그대로라 다시 플립하지 않는다.
  // 넓은 판은 줄마다 두 줄(이름·R² / MAE), 좁은 판은 한 줄(지금 줄만 MAE를 오른쪽에)
  const labels: ChartLabel[] = [];
  const sx = wide ? W * 0.78 : gx0, sy = wide ? H * 0.1 : H * 0.04;
  const rowH = wide ? 50 : 18, maeDy = wide ? 20 : 0, maeX = wide ? sx : sx + W * 0.5;
  const hiDy = wide ? 8 : 0; // 강조 줄은 글자가 커서 MAE를 조금 더 내린다
  s.methods.forEach((m, i) => {
    const shown = i <= st, now = i === st, hi = now && st === 2;
    const cls = !shown || now ? (hi ? 'scoreHi' : 'score') : 'scorePast';
    const y = sy + i * rowH;
    labels.push({ type: 'text', x: sx / W, y: y / H, text: shown ? `${hi ? '▶ ' : ''}${m.name} · ${m.r2}` : '', align: 'start', cls });
    // 좁은 판의 지난 줄은 MAE를 뺀다 — 세 줄이 판 위 공간(판 높이의 34%)에 들어가야 한다
    const mae = shown && (wide || now) ? m.mae : '';
    labels.push({ type: 'text', x: maeX / W, y: (y + maeDy + (hi ? hiDy : 0)) / H, text: mae, align: 'start', cls });
  });
  const tagY = sy + (st + 1) * rowH + (wide ? 4 : 0);
  labels.push({ type: 'text', x: sx / W, y: tagY / H, text: s.methods[st].tag, align: 'start', cls: 'note' });
  labels.push({ type: 'text', x: (wide ? sx : sx + W * 0.5) / W, y: (wide ? tagY + 22 : tagY) / H, text: st === 2 ? `FOLD ${sb + 1} / ${SPLIT.subs[2]}` : '', align: 'start', cls: 'statSm' });
  // 범례: 셋째(아직 안 씀)는 TSS에서만 글자 — 개수는 늘 같게 둔다(이름표 순서가 단계 사이에 흔들리지 않게)
  const ky = wide ? H * 0.72 : top - 30; // 좁은 판: 수치 세 줄 아래에 범례 → 축 이름 순서로 두어 설명 줄과 겹치지 않게
  const keys: ['keyDot', 'keyAmber', 'keyDim'] = ['keyDot', 'keyAmber', 'keyDim'];
  keys.forEach((cls, i) => labels.push({
    type: 'text', x: (wide ? sx : gx0 + ((W - 8 - gx0) / 3) * i) / W, y: (wide ? ky + i * 20 : ky) / H,
    text: i === 2 && st !== 2 ? '' : s.legend[i], align: 'start', cls,
  }));
  // 가로 눈금: 매달 1일
  for (let t = start; t <= start + (sp.fetchDays - 1) * DAY; t += DAY) {
    const iso = isoOf(t);
    if (iso.endsWith('-01')) labels.push({ type: 'text', x: XF((t - start) / DAY) / W, y: (bottom + (H - bottom) * 0.45) / H, text: s.month(iso), align: 'center', cls: 'month' });
  }
  // 세로 눈금: 홀수 달(1·3·5…월) 1일, 1월에는 해도
  const d0 = new Date(t0);
  for (let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1; ; mo++) {
    if (mo > 11) { mo = 0; y++; }
    const t = Date.UTC(y, mo, 1);
    if (t > t1) break;
    if (mo % 2 === 0) {
      const iso = isoOf(t);
      labels.push({ type: 'text', x: (gx0 - 6) / W, y: YT(t) / H, text: mo === 0 ? `${s.month(iso)} ’${String(y).slice(2)}` : s.month(iso), align: 'end', cls: 'tick' });
    }
  }
  labels.push({ type: 'text', x: gx0 / W, y: (wide ? Math.max(8, top * 0.5) : top - 10) / H, text: s.axisY, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: gx1 / W, y: (bottom + (H - bottom) * 0.85) / H, text: s.axisX, align: 'end', cls: 'axis' });
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}:${sb}` };
}
