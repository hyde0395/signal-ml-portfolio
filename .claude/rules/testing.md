---
paths:
  - "tests/**"
  - "playwright.config.ts"
  - "vitest.config.ts"
  - ".github/workflows/**"
---

# 테스트 규칙

- 테스트·빌드·e2e처럼 출력이 긴 실행은 `test-runner` 에이전트에 맡기고 요약만 받는다
- CI 순서: 타입 검사 → 단위 테스트 → 빌드 → 용량 검사 → e2e(desktop·mobile, axe)
- e2e는 꼭 `tests/e2e/*.spec.ts` **전부** 돌린다 — PR #21에서 `site.spec.ts`를 빼먹어 CI에서 걸렸다
- **무거운 브라우저 테스트(e2e, 헤드 있는 크로미움)는 동시에 한두 개까지만.** 2026-09-30에 셋을 동시에 돌려 부하 평균 약 39 → 3D 판정 시간 초과·에이전트 멈춤. `uptime`으로 부하를 보고, 포트는 `E2E_PORT=<빈 포트>`로 나눈다(기본 4173, 로컬은 떠 있는 서버를 재사용하므로 다른 worktree의 `out/`을 테스트할 수 있다)
- 주간 사용량이 빠듯할 때는 무거운 e2e를 CI에 맡긴다
- **3D 켜짐 검사는 `expect3D()`로 기다린다** — CI 휴대폰(swiftshader) 저프레임으로 도중에 `data-3d="off"`가 되면 실패 대신 건너뛴다(PR #26). 비슷하게 걸리면 `gh run rerun <id> --failed`
- 가로 넘침 e2e(1024·768)는 영어·일본어
- `tests/unit/client-imports.test.ts`가 초기 청크 경계를, `content.test.ts`가 문구 속 숫자 금지·3개 언어 키 일치를 검사한다
- CI 일시 오류: 빌드 중 `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`(Google Fonts 못 받음) → `gh run rerun <id> --failed`
