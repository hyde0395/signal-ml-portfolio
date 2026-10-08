# ⑤ 큰 숫자: R² 거품 카드 + 성능 대표값 (2026-10-08)

교수님 피드백(2026-10-08): ⑤ R² 아령 차트는 "눈이 여러 번 가야 해서" 명확하지 않다. 성능 표는 "제일 중요한 부분이니 더 크게".
시안 `docs/superpowers/mockups/2026-10-08/r2-options.html`(C 선택), `table-options.html`(A 선택).

## 1. 차트 3 R² 거품 → 큰 숫자 두 장 (시안 C)
- 점 그림 판(`chartBubble`, ChartStage)을 없애고 글 카드(`.chapter`)로. 머리표 `CHART 03`, 제목, 그 아래 카드 두 장, 그 아래 본문 문단(body1~3 그대로 — 덜어내기는 문구 정리 때)
- 카드 한 장 = 정정 이름(`row1`/`row2`) + 무엇을 걸러냈나(`row1Note`/`row2Note`) + **`R² 0.93 → 0.71`** 크게(전 = 흐린 글자, 후 = 호박색) + 아래 한 줄 `MAE 거의 그대로`(둘째 카드는 `48,442 → 48,235원 · 거의 그대로`)
- 숫자는 facts(`model.bubble.*`). 카드는 넓은 화면에서 두 칸, 767px 이하 한 칸
- 3D 장면은 `model`(조용한 지형 — ⑤ 머리와 같음). 카드 뒤에 옅은 바탕(`rgba(2,4,10,.72)`, ② 수집 단계와 같은 값)을 깔아 점 위에서도 대비를 지킨다
- 정리: `src/charts/bubble.ts`·테스트, `ChartKey`/`SceneKey`의 `chartBubble`, `build.ts` 분기, e2e의 chartBubble 검사, 콘텐츠 `legendBefore`·`legendAfter` 삭제(3개 언어)

## 2. 성능 표 → 대표값 세 개 크게 + 작은 참고 비교표 (시안 A)
- 위: 머리 줄 `운영 기준 · TimeSeriesSplit — 과거로만 배우고 그다음 기간으로 시험` + 큰 숫자 세 개(R² · MAE · MAPE, 호박색), 숫자마다 이름과 뜻 한 줄
  - R²: "예측이 가격 차이를 얼마나 설명하는지 (1에 가까울수록 좋음)" / MAE: "평균적으로 틀린 금액" / MAPE: "평균적으로 틀린 비율"
- 아래: 작은 표 `참고 비교` — GroupKFold, K-Fold 두 줄(흐린 색). 기존 caption은 낭독용 그대로
- 큰 숫자 묶음도 같은 옅은 바탕. 3D 켜짐에서 560px 줄 너비 제한에서 빼고 최대 820px
- 새 콘텐츠 키: `charts.validation.table.{lead,r2Note,maeNote,mapeNote,cmp}`(3개 언어, 영·일 Claude 초안 → 검토 대기)

## 3. 확인
- 단위 테스트(콘텐츠 키 일치·숫자 금지), 타입 검사, e2e(charts·motion·info-clarity·terrain 대비)
- 1440·1024·390 화면 눈 확인

## 구현 결과
- 차트 3: `src/components/sections/R2Figures.tsx`(카드 두 장), `Charts.tsx` 블록 종류 `figures`. `chartBubble` 키·`src/charts/bubble.ts`·테스트 삭제. 콘텐츠 `legendBefore`·`legendAfter`·`alt` 삭제
- 성능: `ValidationTable.tsx`가 대표값 묶음(`dl.perf-big`, 화면에서는 숫자가 위 — column-reverse) + 참고 표 두 줄. 안 쓰게 된 `table.method`·`table.tss` 삭제
- R² 뜻 줄은 문구에 숫자 금지라 "(1에 가까울수록)" 대신 "(높을수록 좋음)"
- 넓은 화면에서 대표값 칸이 같은 폭이면 "원"이 옆 숫자에 붙어 보여 칸 폭을 숫자 길이대로(auto)
- 점 컨셉 예외: 차트 3은 점 그림이 아니다(사용자 선택 2026-10-08, 시안 C를 고를 때 콘셉트에서 벗어남을 알고 고름)
- 확인: 단위 547, e2e charts·motion·info-clarity·site·terrain 238 통과(로컬). 1440·390·en 화면 캡처로 눈 확인(3D 꺼짐)
- **개정(2026-10-08, 사용자)**: 두 카드 모두 배경 3D 없음 + 가운데 정렬로 크게. 장면 `validation`(지형을 위에서)을 `blank`(dim 0·잡음 0, 데모와 같은 방식)로 바꿔 두 카드에 씀. 카드 바탕·테두리 없앰, 글 카드는 `.figs-chapter`(가운데 축, 560px 왼쪽 줄 너비 규칙에서 뺌), 본문 문단도 가운데·줄 길이 고르게
- **개정 2(2026-10-08, 사용자 "미리보기에 아직 있다")**: 장면은 화면 가운데선에 걸린 블록으로 정해져, 카드가 아래에서 올라오는 동안 앞 장면(⑤ 머리 지형, 검증 설계 점)이 카드 윗부분 뒤에 남았다. ⑤ 머리 장면도 `blank`, 성능 카드는 위로 15vh 뻗은 보이지 않는 `data-scene="blank"` 띠(`.scene-reach`)로 더 일찍 바뀐다(30vh는 판 이름표가 남은 채 점만 먼저 사라짐). 처음 확인은 카드를 가운데 맞추고 3초 기다린 캡처라 이 순간을 놓쳤다 — 이번에는 카드 맨 위가 화면 70~55%에 올 때를 찍어 확인
