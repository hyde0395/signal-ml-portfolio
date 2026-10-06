---
paths:
  - "content/**"
  - "data/facts.json"
  - "src/lib/content.ts"
  - "src/lib/i18n.ts"
  - "src/lib/facts.ts"
  - "src/styles/font-jp.ts"
  - "tests/unit/content.test.ts"
  - "tests/unit/i18n.test.ts"
  - "tests/unit/facts.test.ts"
---

# 문구·다국어·수치 규칙

## 언어 (승인됨)
- **한국어 + 영어 + 일본어 3개 언어로 처음부터**(일본계 회사 지원 고려). 일본어는 사용자가 검수를 받을 수 있다
- 주소 `/`(ko 기본)·`/en`·`/ja`, 상단 `KO · EN · JA` 전환, 선택 언어 기억. 브라우저 언어가 다르면 안내만 띄우고 자동 이동은 하지 않는다. 언어별 `lang`·`hreflang`·OG 이미지
- 문장은 `content/{ko,en,ja}.json`, 수치는 `facts.json`만. 테스트: 숫자 직접 기입 금지(3개 언어) + 세 파일 키 일치
- 작업 순서: Claude 한국어 초안 → 사용자 검토 → Claude 영·일 초안 → 영어는 사용자, 일본어는 사용자가 섭외한 검수자
- 데모 문장 틀은 언어별로 따로. `demo.json`에는 추천 이유를 문장 대신 **코드+값**으로 저장하고 사이트가 언어별로 조립한다(스펙 §6.2 "구현 결과"). 공휴일 이름표도 3개 언어
- 일본어 페이지만 Noto Sans JP(`next/font` 조각 로딩), ko/en에서는 로딩 안 함. `GATE 01 — PROBLEM` 같은 영어 연출 글자는 공통

## 수치
- 재학습하면 수치가 바뀌므로 콘텐츠와 수치는 데이터 파일 한 곳에 모은다. 문구에 숫자 직접 기입 금지(`facts.json` 참조를 테스트로 강제)
- 새 수치는 `scripts/export_facts.py`가 데이터에서 계산해 넣는다(손으로 적지 않음)
- `charts.validation.body3`의 "다섯 번 / five times / 五回"는 폴드 수(`scripts/export_charts.py` `N_FOLDS`)와 손으로 맞춘 글자다(숫자 금지 규칙 때문에 글자로 씀)
- 수치 원본·주의점은 `.claude/rules/airfare-facts.md`

## 문구 톤 (사용자 피드백)
- 슬로건·광고 같은 문장은 "오글거린다"고 싫어한다. 꾸밈 없이 사실만, 담백하게
- **문구는 디자인을 모두 정한 뒤에 한꺼번에 바꾼다**(2026-10-01). 그 전까지 디자인 작업의 문구·꾸밈 값(예: 탑승권 편명·게이트·도시)은 임시값으로 두고 데이터(`facts.json`·`content/*.json`)에 넣는다
- 문구 정리 때: 블록마다 첫 줄을 결과로 바꾸고 겹치는 문장만 덜어 낸다(접기 UI는 쓰지 않음). `intro.note` "점 하나는 실제로 수집한 가격 하나입니다."는 사실이 아니므로 지운다

## 문구 검토 대기 (사용자)
- 한국어 확인 후 영·일 초안을 사용자·검수자에게: 5-3c `features.shap.*`, 7-2 `features.structure.*`, 8-1 `data.filter.*`·`charts.validation.*`(body1~3·tagKf/tagGkf/tagTss·legend*·axis*·alt)
- 8-1 검토에서 나온 영·일 용어 맞추기 후보: en `data.filter.axisY` "vs. route/cabin mean" → "vs. route-and-class average", en `tagKf` "upper reference" → "reference upper bound", en `data.filter.body1` "placed by" → "plotted by", en `charts.validation.body2` "service setup" → "service configuration", ja `tagGkf` "初めて見る出発日" → "未知の出発日", ja `legendUnused` "未使用" → "まだ未使用", ja `data.filter.heading` → "エラー行の除去", ja `charts.validation.body2` "学習とサービスの不一致" → "学習と提供の不一致"

## 개인 정보·콘텐츠
- **이름**: 최하림 / CHOI HALIM / 崔夏林(チェ・ハリム). 첫 화면 큰 제목은 `SIGNAL`만(2026-09-29, 2026-10-04 재확인). 이름 `CHOI HALIM`·언어별 표기(ko 최하림, en 없음, ja 崔夏林 + 후리가나)·`ML ENGINEER`는 연락처 섹션에만 — 탑승권 탑승객 칸, 소개 제목 아래 `ML ENGINEER`(키 `contact.nameSub`·`contact.role`). 탭 제목(`meta.title`)과 OG 이미지에는 이름이 남는다
- **한 줄 소개**: 키워드 나열 `ML ENGINEER · 시계열 예측 · 모델 검증 · 데이터 파이프라인`(영·일 같은 구성)
- **학력**: 수원대학교 컴퓨터소프트웨어학과 · 2028년 2월 졸업 예정 / B.S. in Computer Software, The University of Suwon · Expected Feb 2028 / 水原大学 コンピュータソフトウェア学科 · 2028年2月卒業見込み(학과 일본어명은 검수 때 확인). 신입
- **핵심 역량**: 항공권 프로젝트에서 증명된 것만(수집 자동화, 시계열 모델링, 검증 설계, 예측 구간 보정). 다른 경험·다른 프로젝트 목록은 넣지 않는다
- **연락처**: 이메일은 `facts.json` `contact.emailReversed`(뒤집어 저장, HTML 소스에 바로 드러나지 않게), GitHub `github.com/hyde0395`, LinkedIn은 나중에(`contact.linkedin` 비면 버튼 숨김)
- **이력서 PDF**: `public/resume/{ko,en,ja}.pdf`(ja는 履歴書/職務経歴書 형식, 내려받을 때 `CHOI_HALIM_resume_<언어>.pdf`). 없는 언어는 "준비 중"으로 흐리게
- **"코드 보기" 링크는 당분간 404가 의도된 상태**: `airfare-forecasting-ml`이 비공개. 공개 저장소가 생기면 `facts.json` `codeLinks.baseUrl`만 바꾼다. 404를 버그로 고치지 않는다
- **데이터 공개 원칙**: 지형은 %로만, 원본 CSV는 공개하지 않는다
