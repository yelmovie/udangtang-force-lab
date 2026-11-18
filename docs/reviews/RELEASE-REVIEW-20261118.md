# 배포 검토 보고서 — 우당탕 힘 실험실

> 작성일: 2026-11-18(점검은 11-19 새벽까지) · 브랜치: main · 커밋: `9f2ffb2` · 배포 대상: Cloudflare Workers `udangtang-force-lab`
> 점검자: edu-final-check(읽기 전용 판정) — 이번 범위(화면·조작·빌드·배포)의 수정은 같은 세션에서 먼저 하고 그 결과를 점검했다.
> 이전 보고서: `RELEASE-REVIEW-20261019.md`(조건부), `SCORE-20261019.md`(52/100). 이번에 다시 재지 않은 항목은 이전 근거를 인용하고 증거등급을 `추정`으로 적었다.

## 최종 판정

**조건부 배포 가능**

### 왜 이 판정인가

- FAIL 0건. 10-19의 FAIL 3건(B19 재실험 잠김·탭 대안 없음, C3 44px 미만 터치, C20 작은 글자)은 그 뒤 수정됐고, 이번에 C3·C20을 6화면 × 4크기로 다시 재서 0건을 확인했다.
- B 핵심 경로(B3·B9·B10·B14)는 이번에 직접 밟아 PASS(확인됨). A·F 영역에 FAIL·NOT TESTED 없음.
- NOT TESTED 7건(B12 다섯 미션 연속 완료·엔딩, B16 40분 분량, C25 텍스트 확대, D5·D6 중복·미사용 에셋, D8 누수, D9 FPS)이 5건 이상이라 `배포 가능`이 아닌 `조건부`.

### 배포 전 처리할 조건

1. 없음(이번 범위의 수정은 운영 반영까지 끝남). 학습 문구 관련 WARNING(A4·A5·A9·A13·A14)은 학습 내용 변경이라 이번 범위 밖 — 사용자 결정.

### 배포 후 확인할 것

1. 실제 태블릿(iPad Safari·Android Chrome)에서 다섯 미션 연속 플레이·터치·회전·백그라운드 복귀.
2. 결과 팝업을 실제 실험으로 띄워 ×가 숨은 팝업에서 「계속 실험하기」·Esc로 닫히는지(선택자는 앱 CSS 위에서 확인함).

---

## 요약

| 영역 | PASS | WARNING | FAIL | NOT TESTED | N/A |
|---|---|---|---|---|---|
| A 교육적 품질 | 10 | 7 | 0 | 0 | 0 |
| B 기능 | 16 | 1 | 0 | 2 | 0 |
| C 태블릿·UI | 22 | 1 | 0 | 1 | 1 |
| D 성능 | 9 | 3 | 0 | 4 | 0 |
| E 코드 품질 | 8 | 6 | 0 | 0 | 0 |
| F 데이터·안전 | 12 | 3 | 0 | 0 | 0 |
| G 배포 | 18 | 1 | 0 | 0 | 1 |
| **합계** | 95 | 22 | 0 | 7 | 2 |

## 실행 환경 (실측, Mac arm64)

| 항목 | 값 |
|---|---|
| package manager | npm (lock: `package-lock.json` 하나) |
| 배포 URL | https://udangtang-force-lab.yelsam.workers.dev |
| 배포 | `_scratch/deploy-20261118/deploy.sh 01 1udangtangtang worker-own udangtang-force-lab`(origin/main `9f2ffb2`만 빌드) → Version `624a90c2-3238-4e4b-ae4a-4b746139106a` |
| 롤백 대상 | 직전 Version `0a6b4b2e-0ee7-408e-b8a9-b221c4ac331d`(커밋 `3b0670e`) |

| 명령 | 결과 |
|---|---|
| install | 기존 `node_modules` 사용(재설치 안 함) |
| lint | **정의 안 됨** → NOT APPLICABLE |
| typecheck | `npx tsc --noEmit` 통과(`npm run build` 첫 단계 포함) |
| test | `npm test` 209/209 통과 |
| build | `npm run build` 통과. three.module 566kB 청크 경고 1건(기존) |

브라우저 확인: 함 — Playwright(헤드리스 Chrome)로 빌드 미리보기와 운영 주소. 공용 잠금 `_shared/run-stage-lock.sh browser` 안에서 실행.
자동 스윕: 프로젝트 스크립트는 없음. 이번 점검용 `.tmp/layout-balance-20261118/qa.mjs`로 지도+다섯 미션 × 4크기(24화면) 측정 → 44px 미만 터치 0, 가로 스크롤 0, 오류 0.

---

## 영역별 판정

### A. 교육적 품질 (이번 작업은 학습 문구를 바꾸지 않음)

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| A1 목표–활동 | PASS | 추정 | 다섯 미션이 4과01-01~04(밀기·당기기, 무게 비교, 저울, 도구)에 대응(`src/info.ts` 교사용 설명) |
| A2 성취기준 | PASS | 추정 | 11-10 공식 검수 대응에서 문구 대조 |
| A3 정답만 맞히기 아님 | PASS | 추정 | 실험 기록을 모아 결론을 고르는 구조 |
| A4 판단 근거 | WARNING | 추정 | 10-19: 근거 설명이 선택 활동에만 |
| A5 오개념 피드백 | WARNING | 추정 | 10-19: 일부 오답이 '다시 봐요'만 |
| A6 난이도 | PASS | 추정 | |
| A7 보상 | PASS | 추정 | 성취 카드는 지도 악당·미션 완료에 붙음 |
| A8 클릭 반복 통과 | PASS | 추정 | 10-26 오답 뒤 1.5초 검토 잠금(`e14f8da`) |
| A9 힌트 정답 노출 | WARNING | 추정 | 10-19: 공방 의뢰 힌트(10-26 코어 힌트는 고침) |
| A10 오답 후 튕김 | PASS | 추정 | |
| A11 성취기준 구조화 | WARNING | 확인됨 | 데이터·테스트에 성취기준 필드 없음(`src/info.ts` 설명 글에만) |
| A12 검수 메타 | WARNING | 확인됨 | 콘텐츠별 검수 필드 없음 |
| A13 단정 서술 | WARNING | 추정 | 10-19 지레·미끄럼틀 표현(10-19 `6c2e9da`에서 일부 다듬음, 재확인 안 함) |
| A14 어휘 | WARNING | 추정 | '의뢰·영점' 풀이 |
| A15 피드백 어조 | PASS | 추정 | |
| A16 조작 다양성 | PASS | 확인됨 | 밀기/끌기·놓기·저울 올리기·손잡이 끌기·3D 걷기 |
| A17 난이도 상승 | PASS | 추정 | 미션마다 2단계 의뢰, 코어가 앞 기록을 씀 |

### B. 기능

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| B1 시작 | PASS | 확인됨 | 운영·미리보기에서 시작·이어 하기 |
| B2 도움말 | PASS | 확인됨 | 각 실험 콩이 힌트 버튼 |
| B3 스테이지 이동 | PASS | 확인됨 | 저장값으로 다섯 미션 진입, 미션 카드 → 실험 시작 |
| B4·B5 정오답 | PASS | 추정 | 모델 테스트 209 |
| B6 다시 시도 | PASS | 추정 | 10-19 B19 이후 「눌러서 밀기」·균형 다리 재실험(10-20) |
| B7 진행도 | PASS | 추정 | |
| B8 보상 | PASS | 추정 | |
| B9 자동 저장 | PASS | 확인됨 | 배송소 한 번 밀기 → 저장 `cargo.runs` 1건 |
| B10 이어하기 | PASS | 확인됨 | 새로고침 뒤 「이어 하기」 → 배송소, 기록 1건 유지 |
| B11 초기화 | PASS | 추정 | 설정 「탐구 기록 초기화」 확인창(10-19 `6c2e9da`) |
| B12 완료 처리 | NOT TESTED | — | 이번에 다섯 미션 연속 완료·엔딩까지 플레이하지 않음 |
| B13 뒤로가기 | PASS | 추정 | 10-19 `da217bf` 수정 |
| B14 새로고침 복원 | PASS | 확인됨 | 위 B10과 같은 측정 |
| B15 비활성 버튼 이유 | WARNING | 추정 | 일부 완료 버튼은 이유 문구 없이 비활성(10-19 관찰) |
| B16 40분 분량 | NOT TESTED | — | 처음~끝 시간 실측 없음 |
| B17 중복 보상 방지 | PASS | 추정 | 완료 판정·카드 지급이 상태 기반(테스트) |
| B18 피드백 동기화 | PASS | 추정 | |
| B19 조작 응답 | PASS | 확인됨 | 탭(「눌러서 밀기」)만으로 실험 진행·기록 |

### C. 태블릿·UI

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| C1·C2 16:9·1024 | PASS | 확인됨 | 1280×800·1024×768·1920×1080 스크린샷 |
| C3 터치 영역 | PASS | 확인됨 | 24화면 44px 미만 0 |
| C4 겹침 | PASS | 확인됨 | 스크린샷 육안 + 조작 요소 좌표 목록 |
| C5 잘림·C6 화면 밖 | PASS | 확인됨 | |
| C7 회전 | PASS | 확인됨 | 375×812 회전 안내 표시 |
| C8 애니메이션 | PASS | 추정 | |
| C9 대비 | WARNING | 추정 | 중앙 코어 어두운 상단 띠 위 아이콘 버튼이 흐리게 보임(`after/rescue-1920x1080-2-screen.png`) |
| C10 음소거 | PASS | 확인됨 | 오른쪽 위 소리 버튼 |
| C11 키보드 | PASS | 추정 | 물체·손잡이 Enter/Space, dialog Esc |
| C12 일관성 | PASS | 확인됨 | 이번에 팝업 닫기 경로를 「글자 버튼 하나(+Esc)」로 맞춤, 설정·가방·보관함은 위 × 하나 |
| C13 색 단독 | PASS | 추정 | ○/✓ 글자와 색 함께 |
| C14 조사 | PASS | 추정 | 11-18 `534e29d` |
| C15 이모지 | PASS | 확인됨 | UI 글리프는 ✓·▶·→(텍스트 기호)만 |
| C16 제목 1줄 | PASS | 확인됨 | 실험 화면 제목 줄은 숨김 |
| C17 가로 스크롤 | PASS | 확인됨 | 24화면 0 |
| C18 모달 닫힘 | PASS | 확인됨 | 글자 닫기 버튼 + Esc(배송소 화면 Esc 닫힘 측정) |
| C19 safe-area | PASS | 추정 | `env(safe-area-inset-*)` 13곳 |
| C20 글자 하한 | PASS | 확인됨 | 1920 18px 미만 0, 1024 14px 미만 0. 참고: 1280·1024의 코어 「내 발견」 접힌 칸 16px 6개 |
| C21 줄바꿈 | PASS | 확인됨 | |
| C22 캔버스↔DOM | NOT APPLICABLE | — | Phaser 없음(three는 자체 DOM 버튼) |
| C23 다음 행동 인지 | PASS | 확인됨 | 주 버튼 화면당 0~1개(`before/report.json`) |
| C24 reduced-motion | PASS | 추정 | CSS 22파일 + `autoPlay.ts` JS |
| C25 텍스트 확대 | NOT TESTED | — | 200%·125% 미실행 |

### D. 성능

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| D1 초기 로딩 | PASS | 확인됨 | 운영 주소, 캐시 없는 새 브라우저(1280×800): load 1.27초, 응답 content-length 합 약 1.0MB. 이 Mac 네트워크 기준, 학교 와이파이 아님 |
| D2 이미지 | PASS | 확인됨 | dist에 1MB 넘는 이미지 없음 |
| D3 오디오·영상 | PASS | 확인됨 | 최대 ending.mp4 4.5MB, bgm 2.9MB(5MB 미만) |
| D4 GLB | WARNING | 확인됨 | core.glb 2.7MB, dock.glb 1.2MB(마지막 미션에서만 받음) |
| D5 중복 에셋 | NOT TESTED | — | |
| D6 미사용 | NOT TESTED | — | 동적 경로 조립이 많아 자동 판정 중단(10-19와 같음) |
| D7 dependency | PASS | 추정 | three·vite·typescript·wrangler |
| D8 누수 | NOT TESTED | — | |
| D9 FPS | NOT TESTED | — | 실기 측정 없음 |
| D10 저사양 | WARNING | 추정 | 10-19: blur 레이어·무한 펄스 |
| D11 오프라인 | PASS | 확인됨 | 운영에서 서비스워커 준비 뒤 네트워크 끊고 새로고침 → 시작 화면 열림 |
| D12 외부 요청 | PASS | 추정 | 글꼴 셀프호스팅, CDN 스크립트 없음(소스 검색) |
| D13 애니 속성 | WARNING | 추정 | 10-19: 무한 box-shadow 6곳 |
| D14 폰트 | PASS | 추정 | 나눔스퀘어네오 WOFF 4종 셀프호스팅(11-10) |

### E. 코드 품질

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| E1 중복 | WARNING | 추정 | 10-19 escapeHtml·포커스 가두기 여러 벌 |
| E2 큰 파일 | WARNING | 확인됨 | `src/screens/village.ts` 1204줄, `src/main.ts` 1056줄 |
| E3 미사용 import | PASS | 확인됨 | tsconfig `noUnusedLocals` 통과 |
| E4 any | PASS | 확인됨 | `: any`·`as any` 0건 |
| E5 console 오류 | PASS | 확인됨 | 24화면 + 운영 0건 |
| E6 하드코딩 | WARNING | 추정 | |
| E7·E8 경로 | PASS | 확인됨 | 운영 404 없음, import 대소문자(AGENTS.md 10-30 점검) |
| E9 환경변수 | PASS | 추정 | 앱용 env 없음 |
| E10 lock | PASS | 확인됨 | |
| E11 빌드 | PASS | 확인됨 | |
| E12 테스트 | PASS | 확인됨 | 209/209 |
| E13 이벤트 위생 | WARNING | 추정 | 10-19 모달 정리 경로 |
| E14 파일명 | WARNING | 추정 | 10-19 |

### F. 데이터·안전

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| F1~F3 | PASS | 확인됨 | 이름·학번 없음, 서버 전송 없음(정적 Workers) |
| F4~F6 | PASS | 확인됨 | 키 `udangtang-force-lab-save-v1`, `version: 1` |
| F7 migration | PASS | 추정 | 저장 테스트 |
| F8 초기화 | PASS | 추정 | |
| F9 외부 링크 | PASS | 추정 | |
| F10 저작권 | PASS | 추정 | |
| F11 라이선스 | WARNING | 추정 | 10-19 일부 생성 도구 이용조건(11-18 유료 플랜 기록 추가 `65ff80f`) |
| F12 출처 | WARNING | 추정 | 10-19 일부 행 누락 |
| F13 비밀키 | PASS | 확인됨 | 클라이언트 키 없음 |
| F14 손상 저장 | PASS | 확인됨 | 깨진 값 넣고 새로고침 → 앱 뜸, `-broken` 백업 키 보존 |
| F15 해금 재계산 | WARNING | 추정 | 10-19 관찰, 재확인 안 함 |

### G. 배포

| # | 판정 | 등급 | 근거 |
|---|---|---|---|
| G1 경로 | PASS | 확인됨 | Workers 정적 에셋 |
| G2 base path | NOT APPLICABLE | — | 루트 배포 |
| G3 SPA | PASS | 확인됨 | `not_found_handling: single-page-application` |
| G4 asset path | PASS | 확인됨 | |
| G5 환경변수 | PASS | 추정 | |
| G6 404 | PASS | 추정 | |
| G7 OG | PASS | 확인됨 | 절대 주소 `og-image.jpg` |
| G8 제목·설명 | PASS | 확인됨 | |
| G9 favicon | PASS | 확인됨 | |
| G10 production build | PASS | 확인됨 | 푸시한 `9f2ffb2`만 빌드해 배포(`deploy.sh`), 다른 세션 미커밋 변경은 섞이지 않음 |
| G11 배포 후 smoke | PASS | 확인됨 | 운영: 시작→지도(홈 버튼 없음)→균형 다리(조작판 좌우 260px 가운데)→오프라인 재방문, 오류 0. JS·CSS·index·sw.js 해시 로컬 빌드와 MATCH |
| G12 로그인 보호 | PASS | 확인됨 | |
| G13 git status | WARNING | 확인됨 | 다른 세션(개념 영상 자막)의 미커밋 변경 `src/conceptClip.*`·`public/assets/concepts/*`·`scripts/test-concept-clip.mjs` — 보존, 커밋·배포에 안 섞음 |
| G14 README | PASS | 추정 | |
| G15 ignore | PASS | 추정 | |
| G16 push 대상 | PASS | 확인됨 | 이번 커밋 4파일 |
| G17 origin 분리 | PASS | 확인됨 | AGENTS.md E절 |
| G18 카톡 썸네일 | PASS | 추정 | `51e499f`·`ba0d51f` |
| G19 인쇄 | PASS | 추정 | |
| G20 롤백 기록 | PASS | 확인됨 | 위 표 |

## 개선 권장 (P3, 판정 밖)

- 균형 다리는 상단 띠 + 목표 줄 + 조작판으로 띠가 3줄이다(놀이 영역 70% 기준은 통과). 목표 줄을 무대 오버레이로 옮기는 안은 `docs/LAYOUT-BALANCE-20261118.md` L3에 제안만 남겼다.
