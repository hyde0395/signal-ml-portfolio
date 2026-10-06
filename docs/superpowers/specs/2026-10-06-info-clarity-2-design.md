# 정보 전달 2 — 제목과 숫자만 읽어도 결과가 들어오게 (설계)

- 날짜: 2026-10-06 (맥북)
- 배경: 교수님 피드백(2026-10-01) "필요한 정보가 확 들어오지 않는다, 불필요한 문구가 많다". 점 위계 설계(`2026-10-04-dot-hierarchy-design.md`, PR #28)가 **그림**을 다뤘고, 이 설계는 그 §8에서 넘긴 **정보 설계**(제목·숫자·차트 3·자막 칸·이름표)를 다룬다
- 결정 기록: CLAUDE.md "정보 전달 2" 질문 1~5(2026-10-06), 방향 결정 7개(2026-10-04, `docs/superpowers/notes/2026-10-01-professor-feedback.md`)
- 시안(승인): `docs/superpowers/mockups/2026-10-05/validation-scoreboard.html`(1번 탭), `bubble-dumbbell.html`(왼쪽 A)
- 범위 밖: **문구 덜어내기**(블록 첫 줄을 결과로·겹치는 문장 정리·`intro.note` 삭제)는 디자인을 다 정한 뒤 한꺼번에 — 이 설계는 제목·이름표·숫자 칸만 바꾸고 본문 문단은 그대로 둔다(아래에서 줄이 바뀌는 자막 칸 2곳만 예외)

## 1. 지킬 것

- 점 컨셉, 차트 흐름(자막 칸마다 단계), 점 위계·별자리 선(점 위계 설계 §2)은 그대로
- **문구에 숫자를 직접 쓰지 않는다** — 제목의 숫자도 `{facts 경로}` 자리 표시. 3개 언어 키 일치
- 새 수치는 `scripts/export_facts.py`가 데이터에서 계산한다(손으로 적지 않음)
- 이 설계에서 새로 쓰는 문구는 **임시값**이다. 영·일은 Claude 초안 → 문구 검토 때 사용자·검수자
- 톤: 꾸밈 없이 사실만. 제목은 "무엇에 대한 차트" 대신 "그 차트가 보여 준 결과"

## 2. 새 facts 수치 (`export_facts.py`)

| 경로 | 값(지금 데이터) | 계산 | 쓰는 곳 |
|---|---|---|---|
| `data.filter.removed` | 15,955 | `unit + mismatch + direct` | ② 걸러내기 제목 |
| `model.baselineGap.mae` | 453 | `baselineMae − tss.mae` | ⑤ 한계 제목 |
| `model.baselineGap.pct` | 0.9 | `gap / baselineMae × 100`, 소수 1자리 | ⑤ 한계 제목 |
| `insight.holidayPeak.pct` | 71 | 출발일 % 중 공휴일 무렵의 최댓값(정수) — `departLayout`의 봉우리 callout과 같은 규칙 | ④ 출발일 제목 |
| `insight.holidayPeak.holiday` | `kr_new_year` | 그 날의 공휴일 코드 | 테스트용(아래) |
| `insight.weekdayPct` | `[월…일]` 7개, 일 +20 · 화·수 −17 | 요일별 출발일 % 평균(정수) — 요일 막대와 같은 값 | ④ 출발일 본문(문구 정리 때), 테스트 |
| `insight.curveMin` | −5.0 | `model.bookingCurve` 최솟값 | ④ U자 제목 |
| `model.groupShare.lookup` · `.categorical` | 47 · 26 | `featureGroups` gain 반올림 정수 | ③ 와플 제목 |

- `insight.*`는 `charts.json`과 같은 원본에서 계산하므로 **단위 테스트로 서로 대조**한다(지금 `bookingBins`처럼): 봉우리 % = `charts.json` 출발일 % 최댓값(공휴일), 요일 평균 = 같은 % 평균, `data.filter.removed = rawRows − filteredRows`
- ④ 출발일 제목은 공휴일 이름을 글자로 쓴다("신정"/"New Year"/"元日") — 자리 표시로 공휴일 이름을 끌어올 수 없어서. 대신 테스트가 `insight.holidayPeak.holiday === 'kr_new_year'`를 확인해, 재학습으로 봉우리가 바뀌면 테스트가 깨지고 제목을 고치게 한다
- `npm run facts` 뒤 `site` 줄만 바뀌었으면 되돌린다(알려진 동작)

## 3. 결론형 제목 (질문 4 답 + 2026-10-04 결정)

| 섹션 | 키 | 지금 | ko (임시) | en 초안 | ja 초안 |
|---|---|---|---|---|---|
| ② 수집 | `data.heading` | 수집한 데이터 | {collectMonths}개월 동안 가격 {rawRows}개를 모았다 | {rawRows} prices collected over {collectMonths} months | {collectMonths}か月で価格{rawRows}件を集めた |
| ② 걸러내기 | `data.filter.heading` | 오류 걸러내기 | 잘못 들어온 {removed}행을 걸러 냈다 | {removed} faulty rows filtered out | 誤った{removed}行を取り除いた |
| ③ 모델 구조 | `features.structure.heading` | 모델 구조 | 기준 가격을 먼저 잡고, 벗어난 몫을 배운다 | A baseline price first, then the gap from it | まず基準価格を置き、そこからのずれを学ぶ |
| ③ 와플 | `features.heading` | {featureCount} FEATURES | 과거 가격 통계 {lookup}% · 노선·항공사 {categorical}% | Past-price stats {lookup}% · route & airline {categorical}% | 過去価格の統計 {lookup}% · 路線・航空会社 {categorical}% |
| ④ 출발일 | `charts.depart.heading` | 출발일별 가격 | 언제 떠나느냐가 더 크다: 신정 무렵 +{pct}% | When you fly matters more: +{pct}% around New Year | いつ発つかの方が大きい：元日前後 +{pct}% |
| ④ U자 | `charts.curve.heading` | U자 예약 곡선 | 언제 사느냐는 그보다 작다: 출발 한 달 전후 {curveMin}% | When you buy matters less: {curveMin}% about a month out | いつ買うかはそれより小さい：出発ひと月前後 {curveMin}% |
| ⑤ R² 거품 | `charts.bubble.heading` | R² 거품 빼기 | R²는 두 번 부풀려져 있었다 | R² was inflated — twice | R²は二度、水増しされていた |
| ⑤ 검증 설계 | `charts.validation.heading` | 검증 설계 | 미래 데이터를 쓰지 않는 검증으로 성능을 잰다 | Measured without peeking at future data | 未来のデータを使わない検証で性能を測る |
| ⑤ 예측 구간 | `charts.band.heading` | 예측 구간 보정 | 예측 구간이 실제 가격의 {coverage}%를 감쌌다 | The interval covered {coverage}% of actual prices | 予測区間が実際の価格の{coverage}%を捉えた |
| ⑤ 한계 | `charts.limits.heading` | 한계와 다음 단계 | 단순 기준선과 MAE 차이는 {gap}원({gapPct}%) | MAE gap to a simple baseline: ₩{gap} ({gapPct}%) | 単純なベースラインとのMAE差は{gap}ウォン({gapPct}%) |

- 자리 표시 경로는 위 §2 이름 그대로(예: `{data.filter.removed}`, `{insight.curveMin|signed}`, `{model.baselineGap.pct|fixed1}`). 숫자는 문구에 쓰지 않으므로 ja "ひと月", en "a month"처럼 글자로
- 섹션 h2(①~⑤ 큰 제목 "한·일 항공권, 언제 사야 할까?"·"데이터가 보여 준 것"·"모델 검증" 등)는 그대로 — h2는 섹션 이름, h3가 결론
- 긴 제목 처리: 제목이 두 줄을 넘지 않는지 1024·768·390에서 3개 언어로 확인(가장 긴 것: ④ 두 제목 en). 넘으면 콜론 뒤를 줄바꿈 단위로(`<wbr>` 대신 문구 쪽 조정)
- 차트 판의 `aria-label`(`제목 · 값 살펴보기`)도 새 제목을 쓴다 — 지금 코드가 같은 키를 쓰므로 자동

## 4. ① 숫자 4개를 성과로 (방향 결정 2)

| 칸 | 값 | 이름표 (ko 임시) | 지금 |
|---|---|---|---|
| 1 | `{data.rawRows}` → 258,829 | 모은 가격 | 노선 6 |
| 2 | `{model.interval.coverage}%` → 80.2% | 예측 구간 포함률 · 보정 전 {model.interval.driftLow}% | 매일 자동 수집 5개월 |
| 3 | `{model.bubble.firstR2} → {model.bubble.firstR2After}` → 0.93 → 0.71 | 부풀려진 R² 바로잡음 | 피처 33 |
| 4 | `{data.routes}` → 6 | 노선 | 예측 구간 80% |

- `project.stats` 키를 `rows`·`coverage`·`r2Fix`·`routes`로 바꾼다(세 언어 함께). 값은 플립 글자판 그대로 — 3번 칸은 화살표가 들어가는 글자판(`→`를 글자판 문자 집합에 넣거나 화살표만 고정 글자로; 구현 계획에서 `flip.ts` 문자 집합을 확인)
- 3번 칸이 "숫자가 떨어졌다 = 나빠졌다"로 읽히지 않게 이름표에 "바로잡음"을 반드시 둔다
- 2번 칸 작은 줄 "보정 전 69%"는 이름표 아래 둘째 줄(작은 회색)
- 휴대폰: 지금처럼 2×2. 3번 칸 값이 가장 길다(9자) — 390px에서 넘치지 않는지 확인

## 5. ⑤ 검증 설계 "점수판 쌓기" (질문 1)

- 지금: 판 위 R²·MAE가 단계마다 **바뀌는** 플립 숫자. 바꿀 것: 단계마다 **한 줄씩 쌓이는** 점수판
  - 단계 0(K-Fold): `K-FOLD  R² 0.668 · MAE 44,196` 한 줄
  - 단계 1(GroupKFold): 위 줄이 흐려지고(알파 약 0.45) 아래에 `GROUPKFOLD  0.649 · 49,067`
  - 단계 2(TSS): 위 두 줄 흐리게, 마지막 줄 `▶ TSS  R² 0.637 · MAE 48,235원`만 **호박색·크게**(약 1.4배), 오른쪽 꼬리표 "운영 기준 · 대표값"(content `charts.validation.tagTss`를 이 말로)
  - 순서는 그대로(K-Fold → GroupKFold → TSS), TSS 폴드 1/5 → 5/5 저절로 넘김도 그대로
- 점수판은 지금처럼 `splitLayout`의 이름표(labels)로 그린다(3D·2D 같음). 새 줄은 플립으로 나타남, 지난 줄은 알파만 바뀜
- 좁은 판: 세 줄이 판 위 공간을 넘으면 지난 줄은 방식 이름 + R²만(MAE 생략)
- **겹치는 이름 5개 → 2개**: 지금 이 블록 주변에 "05 — VALIDATION"(섹션 머리표)·"모델 검증"(h2)·"EVALUATION"(블록 머리표)·"검증 설계"(h3)·"평가 방식별 성능"(표 caption)이 보인다
  - 블록 머리표 `EVALUATION`을 없앤다(다른 차트처럼 `CHART`로 바꾸지 않음 — 이 판은 번호 차트가 아님). 이유가 적힌 주석도 함께 정리
  - 표 caption "평가 방식별 성능"은 화면에서 숨기고(`sr-only`) 낭독용으로만 남긴다 — 표는 판 바로 뒤라 제목 없이 읽힌다
  - 화면에 남는 이름: 섹션(05 — VALIDATION / 모델 검증) + 블록 결론 제목. 이 결정은 질문에서 따로 묻지 않았으므로 미리보기에서 확인받는다
- 낭독: 판의 단계 문장(지금 있음)에 "대표값은 TimeSeriesSplit" 포함 확인

## 6. 차트 3 "R² 거품" → 전·후 아령 판 (질문 2)

지금은 3D 장면 카드(`kind: 'card'`, 장면 `bubble` — 지형에서 제거 레이어가 떨어지는 장면, 대체 이미지 `bubble.webp`)이고 축·이름표가 없어 정보가 없다. **점 차트 판(ChartStage)으로 바꾼다.**

- 새 차트 키 `chartBubble`, 배치 함수 `bubbleLayout`(`src/charts/bubble.ts`), 블록 `{ kind: 'stage', id: 'bubble', tag: 'CHART 03', chart: 'chartBubble', paras: 3, stages: 3 }`
- 그림(시안 A):
  - **가로 R² 축 하나**(0.5~1.0), 눈금 0.6·0.7·0.8·0.9를 성긴 점선 기준 층으로
  - 줄 두 개: 위 "첫 정정"(0.93 → 0.71), 아래 "둘째 정정"(0.84 → 0.64). 줄 이름은 왼쪽 작은 글자
  - 전 = **속 빈 점**(SVG 덧그림 층, ⑤ 분위수 점 그림과 같은 방식), 후 = **호박 별**(결론 층 점 + 빛 번짐). 둘을 가는 별자리 선(`lines`)으로 잇고, 선 아래 차이 `−0.22`·`−0.20`(값은 배치 함수가 facts에서 계산)
  - 오른쪽 작은 칸 "MAE": 둘째 정정은 점 둘이 거의 겹침 + `48,442 → 48,235원` "거의 그대로". 첫 정정은 facts에 MAE 숫자가 없으므로 글자 "MAE 거의 그대로"만(숫자 없음 — 문구 숫자 금지 규칙과도 맞음)
  - 배경 층: 축 위 흐린 점 몇 줄(3D에서 배경 점이 모일 자리). 점 수는 다른 판과 같은 규칙(3D 점 수 한도 안)
- 단계(자막 3칸 = 지금 body1~3 그대로):
  - 0: 첫 정정 한 쌍이 나타남(전 점 → 선이 그어지며 후 별)
  - 1: 둘째 정정 한 쌍 + MAE 칸
  - 2: 두 쌍 모두, 전 점은 흐리게, 결론 "R²만 보지 않고 MAE와 무결성을 함께 본다"(body3) — 그림 변화는 강조만
- 좁은 판(약 560px 미만): MAE 칸을 축 아래로
- 3D 장면 `bubble`(제거 레이어 떨어짐)은 이 블록에서 쓰지 않게 된다 → `scenes.ts`·`activeScene.ts`의 `bubble` 장면, `figureKeys`의 `bubble`, `public/fallback/bubble.webp`, `capture-fallbacks`의 bubble 캡처를 정리. 제거 레이어(9,387행)가 떨어지는 연출은 ② 걸러내기 판(규칙 3)이 같은 이야기를 이미 하므로 잃는 정보는 없다 — 다만 연출 하나가 사라지므로 미리보기에서 확인받는다
- 테스트 영향: `motion.spec.ts`의 `[data-scene="bubble"] .eyebrow`, `terrain.spec.ts`의 bubble 대비 검사(맥미니 로컬 알려진 실패도 함께 사라짐)를 판 기준으로 바꾼다

## 7. ③ 모델 구조 자막 4칸 → 2칸 (질문 3, A)

- 지금: 자막 4칸(step1·step2·step3+flow·body2)이 그림 단계 3개(관측 → 기준 가격 → 잔차)에 대응
- 바꿀 것:
  - **1칸** = step1 + step2를 한 문단으로(문장은 그대로 이어 붙임 — 문구 덜어내기 때 다시 봄). 그림은 1칸 안에서 **단계 0(모은 가격) → 1.2초 뒤 저절로 단계 1(기준 가격)**. ⑤ TSS 폴드와 같은 sub 타이머(`subs: [2, 1]`, `subMs: 1200`)
  - **2칸** = step3 + 흐름 줄(flow) + body2를 **한 줄**로 줄인 새 키 `features.structure.tools`(ko 임시 "Optuna로 설정을 고르고, 분위수 모델로 구간을, SHAP으로 피처별 기여를 본다" — 숫자는 `{model.optunaTrials}` 자리 표시가 필요하면 넣음). 그림 단계 2(잔차)
  - body2 키는 지우지 않고 남겨 둔다(문구 정리 때 결정) — 화면에서만 빠짐. 테스트의 "세 파일 키 일치"는 그대로 통과
- `MODEL.stages`는 3 그대로, 블록이 (자막 칸, sub) → 그림 단계로 바꾼다: (0,0)→0, (0,1)→1, (1,0)→2. `--paras: 4` → 2
- 움직임 줄이기: sub 타이머는 지금 규칙대로 마지막 sub(기준 가격)를 바로 보인다
- **sub 타이머 시작 문턱**: 지금 IntersectionObserver에 `threshold`가 없어 판이 조금만 보여도 시작한다(미룬 작은 것). 이 설계로 sub 타이머를 쓰는 판이 둘이 되므로 `threshold: 0.5`를 함께 넣는다(⑤ TSS에도 적용)

## 8. ② 걸러내기 규칙 이름표 (질문 5, B)

- 지금 `filter.ts` `RULES`에 영어 글자 그대로(`RULE 1 · DURATION · UNIT` 등), 좁은 판은 앞 6글자
- 바꿀 것: 넓은 판 `RULE 1 · {이름} · {개수}`
  - 이름(content `data.filter.rule1..3`, ko 임시): "소요 시간·단위 오류" / "시각 불일치" / "직항인데 경유만큼 걸림"(③은 `boxLabel`과 같은 말 — 같은 키를 재사용하거나 값 일치를 테스트로)
  - en 초안: "Duration / unit error" / "Time mismatch" / "Direct, but as long as a layover"; ja 초안: "所要時間・単位の誤り" / "時刻の不一致" / "直行なのに経由並みの所要時間"
  - 개수: facts `data.filter.unit`·`mismatch`·`direct`(지역별 천 단위 구분)
  - 좁은 판: `RULE 1 · 5,742`(이름 생략)
- 규칙이 켜질 때(지금 `ruleOn` 클래스) 개수도 함께 밝아진다. 켜지기 전에는 이름까지만 흐리게 보이고 개수는 숨김 — 제목의 15,955가 어디서 왔는지 단계마다 더해지는 모양
- 이름표 글자는 `FilterTexts`로 받는다(지금 `axisX` 등과 같은 방식). `RULE n` 머리는 세 언어 공통 영어

## 9. 접근성·성능

- 새 판(`chartBubble`): 다른 판과 같이 캔버스·SVG는 `aria-hidden`, 의미는 `sr-only` alt 문단(`charts.bubble.alt` 새 키 — 두 정정의 전후 R²와 MAE를 문장으로)과 자막
- 속 빈 점·호박 별: 색만이 아니라 모양(속 빈/별)으로 전·후를 구분
- 점수판 흐린 줄도 대비 ≥ 4.5:1 유지(알파 0.45가 부족하면 0.55)
- 초기 JS: 새 배치 함수는 차트 청크에(지금 규칙대로 `import()`), `client-imports.test.ts` 통과. 3D 장면 하나가 줄어 3D 청크는 약간 줄거나 같음

## 10. 테스트

- 단위
  - facts: §2 새 값이 있고 `charts.json`과 대조(봉우리·요일 평균·U자 최솟값), `removed = rawRows − filteredRows`, `holidayPeak.holiday === 'kr_new_year'`
  - 문구: 새 키 세 언어 일치, 숫자 직접 기입 없음(지금 테스트가 자동으로)
  - `bubbleLayout`: 단계마다 보이는 쌍 수(1·2·2), 후 별 2개가 호박, 전 점 2개가 덧그림 층에 속 빈 점, 차이 값 −0.22·−0.20, 단계 사이 점 수 같음
  - `splitLayout`: 단계 n에 점수판 줄 n+1개, 마지막 줄만 강조 클래스
  - `modelLayout`/블록: (칸, sub) → 단계 대응
  - `filterLayout`: 넓은 판 이름표에 이름·개수, 좁은 판은 `RULE n · 개수`, 켜지기 전 개수 없음
- e2e(전부, 무거운 것은 CI): 새 제목 h3 문구(3개 언어 하나씩), ① 숫자 4개, `chartBubble` 판에 선·별·속 빈 점, 검증 판에서 단계마다 점수판 줄 수, ③ 판이 2칸 + 1칸 안 자동 넘김(움직임 줄이기에서는 바로 기준 가격), 가로 넘침(1024·768, 이번에는 일본어도), axe
- 눈 확인: 데스크톱 1440·1024, 휴대폰 390, 3D 켜짐·꺼짐 캡처를 직접 본다. 제목 줄바꿈 3개 언어

## 11. 작업 묶음 (구현 계획에서 나눔 — 병렬 가능 여부)

1. facts 새 수치(`export_facts.py` + 테스트) — 다른 묶음보다 먼저(제목이 이 값을 씀)
2. 제목·① 숫자 4개·걸러내기 이름표(문구 + `filter.ts` + `Project`) — 1 뒤
3. 차트 3 아령 판(`bubble.ts`·블록·장면 정리) — 1과 병렬 가능(facts 기존 값만 씀)
4. 검증 점수판 + 이름 정리(`split.ts`·`Charts.tsx`·`ValidationTable`) — 병렬 가능
5. ③ 모델 구조 2칸 + sub 타이머 문턱(`Features.tsx`·`ChartStage`) — 4와 `ChartStage`가 겹치면 순서대로
- e2e는 마지막에 한 번(동시에 한두 개 규칙)

## 구현 결과

(구현 뒤 적는다)
