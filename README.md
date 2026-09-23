# SIGNAL — ML Engineer Portfolio

CHOI HALIM(최하림)의 ML 엔지니어 포트폴리오 사이트입니다. 대표 프로젝트인 한·일 항공권 가격 예측(`airfare-forecasting-ml`)을 실제 수집 데이터로 만든 3D 가격 지형(계획 3에서 추가 예정) 위에서 설명합니다.

- 사이트: https://signal-ml-portfolio.vercel.app
- 언어: 한국어 `/` · English `/en/` · 日本語 `/ja/`

## 구조

| 경로 | 역할 |
|---|---|
| `data/facts.json` | 사이트에 나오는 모든 수치의 유일한 원본 |
| `content/{ko,en,ja}.json` | 문장만. 수치는 `{model.tss.mae}` 같은 자리표시로 참조 |
| `scripts/export_facts.py` | 모델 저장소의 스냅샷(기준일까지 자른 CSV + 학습용 필터)에서 `facts.json`을 다시 만든다 |
| `src/lib/i18n.ts` | 자리표시 해석과 언어별 숫자·날짜 표기 |
| `app/(ko|en|ja)` | 언어별 root layout, 정적 export |

코드에는 한국어 주석을 달아 둡니다(파일 머리에 역할, 이유가 드러나지 않는 곳에 "왜").

## 수치가 틀리지 않게 하는 장치

- 문장에 숫자를 직접 쓰면 단위 테스트가 실패합니다(`tests/unit/content.test.ts`).
- 자리표시가 `facts.json`에 없는 경로를 가리키면 빌드가 실패합니다.
- `export_facts.py`는 다시 센 행 수가 모델 학습 행 수와 다르면 멈춥니다.

## 실행

Node 24 (`.nvmrc`)

```bash
npm ci
npm run dev        # 개발 서버
npm test           # 단위 테스트
npm run build      # 정적 export → out/
npm run e2e        # Playwright + axe
npm run facts      # 모델 저장소에서 수치 갱신 (AIRFARE_ROOT 필요)
```

Next.js (App Router, static export) · TypeScript · zod · Vitest · Playwright · GitHub Actions · Vercel
