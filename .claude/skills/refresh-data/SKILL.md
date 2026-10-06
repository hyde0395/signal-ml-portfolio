---
name: refresh-data
description: 항공권 모델을 재학습했거나 원본 데이터가 바뀌어 사이트 수치·JSON·대체 이미지를 다시 만들어야 할 때의 순서(facts → terrain → demo → charts → build → fallbacks → og).
---

# 재학습 뒤 데이터 갱신

1. 항공권 저장소(`~/Documents/airfare-forecasting-ml`) CLAUDE.md의 **iCloud 워밍 절차**를 먼저 따른다
2. 순서대로 실행(출력이 길면 `test-runner` 에이전트에 맡긴다):
   1. `npm run facts` — 돌린 뒤 `data/facts.json` diff에서 `site` 줄만 여러 줄로 바뀌었으면 되돌린다
   2. `npm run terrain`
   3. `npm run demo`
   4. `npm run charts`(SHAP·모델 구조·걸러내기·검증 설계 포함, 모델 로드 약 20초)
   5. `npm run build`
   6. `npm run fallbacks`(정적 대체 WebP)
   7. `npm run og`
3. `npm test`·`npm run size` 통과 확인, 바뀐 수치를 `.claude/rules/airfare-facts.md`·README에 반영
4. 브랜치에 커밋 → `ship-pr` 스킬
