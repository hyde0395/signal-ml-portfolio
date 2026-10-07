---
paths:
  - "scripts/**"
  - "public/data/**"
  - "data/**"
---

# 데이터 추출 파이프라인 규칙

- `scripts/py.sh`가 고른 파이썬(AIRFARE_PYTHON → `~/.venvs/airfare-py311` → 항공권 저장소 `.venv` 순서)으로 실행하고 결과를 `public/data/`에 저장. 사이트는 JSON만 읽으므로 빌드·배포에 항공권 저장소가 필요 없다
- `public/data/*.json`은 **스크립트 결과물이다 — 손으로 고치지 않는다**(훅이 막음). 파일명에 버전(예: `demo.2026-09-22.json`)
  - `export_terrain.py`: 원본 CSV + 항공권 저장소 필터 함수(`src/processing/features.py` import 재사용) → `terrain.json`
  - `export_demo.py`: `v2_predictor.pkl` + `recommend_action()` → `demo.json`
  - `export_facts.py`: 사이트의 모든 수치 → `facts.json`(항공권 저장소 CLAUDE.md 기준)
  - `export_charts.py`: 출발일별 %·공휴일 이름표·예약 곡선 8구간·관측 표본 16,000 + SHAP 33 × 150(`pred_contribs`, 피처 값은 0~100 순위) + 모델 구조 `model`(인천→나리타 LCC 관측 출발일마다 최대 48개 + NeuralProphet 기준 가격, 노선·등급 평균 대비 %×10) → `charts.json`. ② 걸러내기·⑤ 검증 설계 표본 각 8,000(설계 2026-10-07). 불확실성 구름은 `demo.json`을 그대로 씀
- `npm run facts`·`npm run charts`(`refresh_derived`)가 `data/facts.json`의 한 줄 객체(`site.airport`·`contact.ticket`)를 여러 줄로 바꿔 쓴다 — 돌린 뒤 diff에서 그 서식만 바뀌었으면 되돌린다

## 데모 데이터
- 기준일 2026-09-22, 6개 노선 × 등급(LCC/FSC) × 출발일 D+3~90(모델 `MAX_DTD = 90`)
- 조합마다 예측가, q10~q90 구간, 추천(BUY_NOW / DROP_EXPECTED / WAIT)과 이유(코드+값)
- 대표 편은 최근 3주 관측 50건 이상인 편 중에서(항공권 저장소 시뮬레이션 기준과 동일)
- 용량 목표 약 500KB 이하, 넘으면 출발일을 주 단위로 줄인다

## 항공권 저장소 (iCloud 안)
- `~/Documents/airfare-forecasting-ml`는 iCloud 동기화, `.venv`는 기기마다 깨진다. **그 `.venv`를 지우거나 다시 만들지 않는다**(삭제가 다른 기기로 동기화됨 — 훅이 막음)
- 모델을 돌리기 전에 그쪽 CLAUDE.md의 iCloud 워밍 절차를 따른다. NP 로그는 `redirect_stdout`으로 억제. `npm run charts`는 SHAP·모델 구조 때문에 모델을 불러온다(약 20초)
- 재학습 뒤 전체 갱신 순서는 `refresh-data` 스킬
