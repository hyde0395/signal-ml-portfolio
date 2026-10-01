# 연락처 탑승권 다시 그리기 (2026-10-01)

## 결정

- 연락처의 내 정보 상자를 **실제 공항 카운터에서 받는 가로 탑승권 + 절취선 꼬리표**로 바꾼다(사용자 선택 2026-10-01, 시안 A — `docs/superpowers/mockups/2026-10-01/contact-ticket.html`). B(세로 모바일 탑승권)·C(종이 항공권)는 고르지 않았다.
- **문구는 디자인을 모두 정한 뒤에 한꺼번에 바꾼다**(사용자 결정 2026-10-01). 그래서 편명·게이트·도시 같은 꾸밈 값은 코드가 아니라 데이터(`facts.contact.ticket`)에 두고 임시값으로 채운다.
- 아래 "소개" 블록은 그대로 둔다.

## 구조

- 본권(`.pass-main`)
  - 호박색 머리 띠: 왼쪽 `BOARDING PASS`, 오른쪽 `SIGNAL · <편명>`(IBM Plex Mono, 자간 넓게)
  - 노선 줄: FROM 큰 코드 `ICN` + 작은 도시 → 점선 두 토막 사이 호박색 비행기(SVG — `✈` 글자는 기기에 따라 컬러 이모지가 됨) → TO 큰 코드 `NRT · KIX · HND` + 작은 도시
  - 칸 격자: PASSENGER(`CHOI HALIM` Space Grotesk + `contact.nameSub`), CLASS(`contact.role`), BOARDING(졸업 월), GATE, EMAIL(`EmailLink`), GITHUB, LINKEDIN(값이 있을 때만)
- 세로 점선 절취선 + 위아래 반원 홈
- 꼬리표(`.pass-stub`): FLIGHT(편명, 호박색), PASSENGER(본권 되풀이), RESUME(`ResumeLink`, 파일이 없으면 "준비 중"), 바코드(CSS 줄무늬 네 벌을 겹친 꾸밈)

## 데이터

- `data/facts.json` `contact.ticket` = `{ flight, gate, fromCity, toCity }`(임시값 `SIG 0395`·`03`·`SEOUL INCHEON`·`TOKYO · OSAKA`), zod 스키마 `src/lib/facts.ts`(빈 값 거부)
- BOARDING은 이미 있던 `profile.graduation`(`2028-02`, 소개의 졸업 예정 문구도 같은 값)을 그대로 쓴다 — 같은 값을 두 곳에 두지 않는다
- FROM = `facts.site.airport.code`(첫 화면 메타 줄과 같은 값), TO = `facts.data.byRoute`의 도착 공항을 순서대로 겹치지 않게(`src/lib/ticket.ts` `destinationCodes`) — 노선이 바뀌면 탑승권도 따라간다
- `scripts/export_facts.py`는 `dataVersion`·`data`·`model`만 바꾸고 `contact`는 그대로 둔다(pytest에 `ticket` 보존을 더함)
- 칸 이름(화면 낭독기용) 문구 키 추가: `contact.flight·from·to·class·boarding·gate`(세 언어, 숫자 없음)

## 반응형

- 화면 792px 이상(본문 폭 760px 이상): 본권 | 꼬리표 230px 나란히, 최대 폭 880px. 꼬리표 위 띠는 본권 머리 띠와 높이를 맞춘다(`--band`)
- 그보다 좁으면 꼬리표가 본권 아래로, 절취선은 가로, 홈은 왼쪽·오른쪽 끝
- 560px 미만: 칸 격자 두 칸(이름·직무는 한 줄 전체, 탑승·게이트 나란히), 노선 코드 작게, 도착 코드는 줄바꿈 허용. 380px 미만: 머리 띠에서 `SIGNAL ·`를 빼 한 줄 유지
- 3D가 켜지면 연락처 글은 560px로 줄지만 `.pass`는 그 규칙에서 뺀다(자기 배경이 있는 카드라서)

## 절취선 홈

- 반원 홈은 색을 칠한 원이 아니라 **mask로 실제로 뚫는다**(본권·꼬리표 각자 반원 두 개, `mask-composite: intersect`). 뒤가 3D 점이든 바탕 그라데이션이든 홈 안으로 그대로 보여, 3D 켬·끔 모두에서 "페이지 바탕과 같은 색"이 된다
- 홈 위치는 변수(`--n1`·`--n2`)만 배치에 따라 바꾼다

## 접근성

- 보이는 칸 이름은 실제 탑승권처럼 영어 대문자, 화면 낭독기에는 그 언어 이름: `<dt><span aria-hidden="true">PASSENGER</span><span class="sr-only">탑승객</span></dt>`. `dt`의 `aria-label`은 일반 요소라 무시하는 낭독기가 있어 쓰지 않았다
- `dl/dt/dd` 구조 유지(노선은 FROM·TO 두 `dl`, 점선·비행기는 `dl` 밖 `aria-hidden` — `dl` 안에 `dt/dd` 없는 `div`를 두면 구조 규칙에 걸린다)
- 꾸밈 숨김: 바코드·비행기·꼬리표의 되풀이 이름, 머리 띠의 `SIGNAL · 편명`(편명은 꼬리표에서 "편명 SIG 0395"로 한 번 읽힌다)
- 카드 배경은 거의 불투명(96%)이라 뒤 3D 점과 상관없이 대비가 유지된다. axe(wcag2a·2aa·21aa) 통과

## 구현 결과

- 파일: `src/components/sections/Contact.tsx`, `src/styles/globals.css`(`.pass*`), `src/lib/ticket.ts`, `src/lib/facts.ts`, `data/facts.json`, `content/{ko,en,ja}.json`
- 테스트: 단위 `tests/unit/facts.test.ts`(`contact.ticket` 스키마, 도착 코드 뽑기, 출발 공항), pytest `test_export_facts.py`(ticket 보존), e2e `tests/e2e/contact.spec.ts`(세 언어 칸 내용·링크, 언어별 낭독 칸 이름, 꾸밈 숨김·LinkedIn 없음, axe 3D 켬/끔, 1440px 옆·390px 아래, 320·390px 가로 넘침 없음과 머리 띠 한 줄)
- 크기: 초기 JS 143.8KB/150KB(그대로), 3D 청크 250.3KB/280KB(zod 스키마에 `ticket`이 늘어 +0.9KB)
- 확인한 화면: 1440×900·390×844, 3D 켬·끔, ko·en·ja, 그리고 320px·820px
- **가운데 정렬(사용자 결정 2026-10-01, 데모 PR `plan-9-2-demo`와 맞춤)**: `CONTACT` 머리표·제목은 글자 가운데, 탑승권은 상자 가운데(`.pass` `margin-inline: auto`, 모든 폭), 소개는 560px 가운데 칸이지만 글(역할·학력·문단·역량 목록)은 왼쪽 정렬 — 여러 줄 문단을 가운데 맞추면 줄 시작이 들쭉날쭉해 읽기 어렵다. 3D가 켜지면 걸리는 560px 규칙이 머리표·제목에도 걸려 `margin-inline: auto`로 상자째 가운데. 소개 칸은 3D 켬·끔 모두 560px라 폭이 바뀌지 않는다(전에는 끔 640px). e2e: 1440px에서 머리표·제목 글자·탑승권·소개 칸 가운데가 본문 가운데와 4px 안, 소개 글 왼쪽 정렬(3D 켬·끔)
- 남은 것: 문구(편명·게이트·도시·칸 이름)는 디자인을 모두 정한 뒤 한꺼번에 사용자가 정한다
