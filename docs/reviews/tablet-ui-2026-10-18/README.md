# 태블릿 UI/UX 수정·검증 — 2026-10-18

로컬 `main`의 기준 커밋 `5979580`에서 수정했다. 커밋·푸시·병합·배포는 하지 않았다. 기존 `.tmp/`, `graphify-out/`은 변경하지 않았다. 프로젝트와 상위 폴더에서 별도 AGENTS.md는 발견되지 않아 대화로 제공된 지침을 적용했다.

## 수정 결과

| 요청 | 반영 내용 |
|---|---|
| 균형 다리 안내 가림 | 진행 상태와 기록 버튼을 정상 문서 흐름의 독립 행에 배치. 한국어 줄바꿈을 허용하고 글자를 축소하지 않음. |
| 완료 안내/버튼 불일치 | 미션 1 마지막 결과창에 **운반 레일 복구하기**, 미션 3에 **비교 기록 저장**을 직접 제공. 기존 완료 처리 함수를 재사용하고 추가 완료 확인창을 생략. |
| 단계/예상 혼동 | 상·하단이 같은 현재 단계 문구를 사용. 도입은 **실험 전 처음 생각**, 개별 비교는 **이번 비교 예상/결과**로 구분. 과학 판단·정답·무게·보상 모델은 변경하지 않음. |
| 측정 전 무반응 | 미측정 부품 제출 시 이유와 다음 행동을 토스트 및 저울 아래 안내에 표시. 토스트가 사라져도 다음 조작까지 설명 유지. 미측정 제출은 시도 횟수·진행을 바꾸지 않음. |
| 시작 전 회전 안내 | 도입 카드에서 가로 회전을 미리 안내하고 세로에서는 시작 비활성화. 가로 복귀 시 선택 유지. 실험 화면을 다시 마운트하지 않음. |
| 그래픽 복구 | WebGL 생성 실패, context lost, 그림/모형 실패, 모듈 로딩 실패를 구분. 캐릭터 위에 읽기 쉬운 패널과 **다시 준비하기 / 지도로 돌아가기** 제공. 실패 시 조작 중단, 기존 기록 유지. |
| 입력·이동 안정성 | 전자저울·공방·코어의 회전/포커스 이탈 시 입력 정리 보완. 화면을 떠난 후 예약된 완료창·의뢰 편지가 뜨지 않도록 정리. 중복 완료창 방지. |
| 미션 5 추가 발견 | 1024×768에서 운반 안내가 A 경로 버튼을 가리는 현상을 확인. 안내를 코어 왼쪽으로 옮겨 세 가로 크기에서 겹침 해소. |

## 변경 파일

| 파일 | 내용 |
|---|---|
| [main.ts](D:/iscreammedia_sc34/1udangtangtang/src/main.ts) | 시작 전 회전, 예상 라벨, 결과창/완료창 조정·수명 관리 |
| [tabletUx.css](D:/iscreammedia_sc34/1udangtangtang/src/tabletUx.css) | 겹침·줄바꿈·버튼 크기·복구 패널·코어 안내 |
| [predictionChip.ts](D:/iscreammedia_sc34/1udangtangtang/src/predictionChip.ts) | 처음 생각 피드백 |
| [balance.ts](D:/iscreammedia_sc34/1udangtangtang/src/screens/balance.ts) | 현재 단계와 이번 비교 문구 |
| [cargo.ts](D:/iscreammedia_sc34/1udangtangtang/src/screens/cargo.ts) | 결과창의 직접 복구 버튼 |
| [scale.ts](D:/iscreammedia_sc34/1udangtangtang/src/screens/scale.ts) | 직접 저장, 제출 불가 설명, 입력 정리 |
| [workshop.ts](D:/iscreammedia_sc34/1udangtangtang/src/screens/workshop.ts) | 그래픽 오류 패널·재시도, 회전 시 입력 정리 |
| [workshopScene.ts](D:/iscreammedia_sc34/1udangtangtang/src/three/workshopScene.ts) | 그래픽/자산 오류 분류와 context lost 감지 |
| [rescue.ts](D:/iscreammedia_sc34/1udangtangtang/src/screens/rescue.ts) | SVG/3D 포인터 취소 및 회전 처리 |
| [requestLetter.ts](D:/iscreammedia_sc34/1udangtangtang/src/requestLetter.ts) | 이전 화면의 예약 편지 방지 |
| [tablet-ui.fixture.html](D:/iscreammedia_sc34/1udangtangtang/scripts/tablet-ui.fixture.html), [fixture.js](D:/iscreammedia_sc34/1udangtangtang/scripts/tablet-ui.fixture.js) | 학생 저장소와 분리된 실제 화면 모듈 회귀 검사 |

## 자동 검사

- `npm run build`: 통과. 기존 Three.js/GLTFLoader 관련 500 kB 초과 청크 경고는 남아 있음.
- `npm test`: **170/170 통과**. 무게·정답·단계 저장 복원·중복 완료/보상 관련 기존 모델 테스트 포함.
- 로컬 브라우저 회귀 검사: **21/21 통과**. [실행 결과](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/browser-regression.txt).
- 브라우저 검사는 WebGL 생성 실패 및 자산 로딩 실패 주입, 실제 `WEBGL_lose_context` 확장으로 연결 끊기, 재시도·중복 재시도·지도 복귀·기록 불변을 검사.
- 다섯 미션의 pointercancel/resize/blur, 영역 밖 이동, 취소 뒤 재조작 및 의도하지 않은 실험 방지를 검사. **합성 PointerEvent와 테스트용 pointer capture 대역을 사용했으며 실제 손가락/OS 터치 검사는 아님.**
- 결과창이 열린 중 context lost가 발생해도 복구 패널이 바로 보이고 기존 결과가 유지됨. 의뢰 2 미측정 제출 두 번에도 진행 불변, 화면 이동 후 예약 편지 취소 통과.
- 기존 파일의 줄바꿈 형식을 유지했고 `git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --check` 통과.

재실행: `npm run dev` 후 `/scripts/tablet-ui.fixture.html`에서 **자동 회귀 검사 실행**. fixture는 프로덕션 진입점에서 불러오지 않으며 빌드에 포함되지 않는다.

## 직접 플레이 — 로컬 Chromium 계열 인앱 브라우저

학생 기록에 영향을 주지 않도록 앱의 탭 내부 미리보기를 사용했다. 이 기능은 권한 상승이 아니라 메모리 안의 저장 데이터 복사본으로 동작함을 코드로 확인했다. 아래는 상태를 주입한 fixture가 아닌 실제 UI 조작 결과다.

| 미션 | 실제 진행 | 입력/크기 | 결과 |
|---|---|---|---|
| 1 | 1개·5개 밀기 → 같은 상자 당기기 → 비교 답 → 주문 3개 → 직접 복구 → 지도 | 마우스·키보드, 1180×820 | 완료. 마지막 복구 버튼 빠른 두 번 클릭에도 완료창 1개, 별 2개·카드 1장. |
| 2 | 기울기·수평 → 상자 3개/4개 의뢰 → 오답 후 재선택 → 저장 → 지도 | 마우스, 1030×771 및 1024×768 | 완료. 물체 선택→자리 선택 유지, 상·하단 단계 일치. |
| 3 | 영점 → 사과·책 측정 → 의뢰 1/2 → 의뢰 2 측정 전 제출 → 부품 측정 → 직접 저장 → 지도 | 마우스, 1024×768 및 1180×820 | 완료. 2단계 미측정 제출의 이유 표시. 측정값·올린 부품·의뢰 단계는 세로/가로 왕복 후 유지. |
| 4 | 직접 들기 → 지레 위치 비교 → 빗면 길이 비교 → 화물 3개 → 생활 도구 관찰 → 완료 → 지도 | 마우스 드래그·키보드, 1180×820 | 완료. 이 로컬 환경에서는 WebGL이 정상 작동. 실패 복구는 별도 자동 검사. |
| 5 | 영점·측정 → 장애물 당기기 → 작은 힘으로 긴/짧은 길 비교 → 긴 길 운반 → 3D 재장착 → 완료 → 엔딩 건너뛰기 → 지도 | 마우스·키보드, 1180×820 | 완료. 별도의 의뢰 2단계가 없는 통합 적용 미션. 최종 지도는 별 11개·카드 5장. |

## 화면 크기별 확인 범위

| 크기 | 실제 확인 |
|---|---|
| 1030×771 | 균형 다리 원본 버튼 겹침·③/① 불일치 재현 및 수정 후 비교 |
| 1024×768, 1180×820, 1280×800 | 실제 화면 모듈의 미션 1~5 대표 상태를 fixture로 표시해 버튼 크기·화면 밖 잘림 측정. 검사한 버튼 모두 최소 44×44 CSS px 이상, 화면 밖 버튼 없음. 미션 4/5는 3D 로딩 후 측정. |
| 위 세 가로 크기 | 수수께끼 상자 안내/기록 버튼은 별도 행으로 겹치지 않음. 그래픽 오류 패널 잘림 없음, 복구 버튼 높이 48 px. 코어 운반 안내와 A/B 경로 라벨 겹침 없음. |
| 768×1024, 820×1180 | 실제 앱 도입 카드의 회전 안내·시작 비활성화·처음 생각 선택 유지 확인. 768×1024 왕복에서 전자저울 의뢰 2의 측정값과 올린 부품 유지 확인. |

화면 치수 근거는 같은 폴더의 `layout-metrics.json`, `error-layout-metrics.json`, `rescue-label-metrics.json`과 JPG에 저장했다. **모든 실험 분기·모든 결과창을 모든 크기에서 완주한 것은 아니다.** 전체 플레이는 위 표에 적힌 크기에서 확인했고, 3개 크기 전수 검사는 대표 상태의 구성 검사다.

## 남은 제한

- 실제 태블릿 손가락 입력, 멀티터치, iPad Safari, 하드웨어 GPU별 context lost는 미검증.
- 합성 이벤트는 OS의 실제 pointer capture 동작까지 검증하지 않는다.
- 직접 플레이는 미리보기였으므로, 실제 학생의 영구 저장·새로고침·재진입을 통한 전체 재완주는 미검증. 저장 복원과 중복 보상은 자동 모델 테스트로 확인했다.
- 브라우저 뒤로 가기를 모든 모달에서 반복하는 스트레스 검사는 미검증. 예약 모달 정리는 구현했고 예약 편지 이동 회귀 검사는 통과했다.
- 모듈 네트워크 다운로드 실패 안내는 구현했지만 별도 오류 주입 검사는 하지 않았다. 자산 실패와 WebGL/context lost는 실행 검증했다.
- 배포 사이트는 변경·재배포하지 않았다. 이번 검증 결과는 로컬 수정본에 해당한다.
- 미션 4의 2D 대체 학습은 추가하지 않았다. 필요하면 추후 별도 범위로 기존 힘 비교·의뢰 조건을 동일하게 유지하는 대체 작업대를 검토할 수 있다.

## 핵심 화면

균형 다리 수정 전 — 기록 버튼이 안내를 덮고, 위는 ③인데 아래는 ①.

![균형 다리 수정 전](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/balance-before.jpg)

수정 후 — 기록 버튼 분리, 상·하단 ③ 일치.

![균형 다리 수정 후](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/balance-after.jpg)

미션 3 마지막 결과창의 안내와 실제 저장 버튼.

![직접 저장 버튼](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/scale-completion-action.jpg)

그래픽 실패 복구 패널 — 검증 fixture에서 생성 실패를 주입한 화면.

![그래픽 실패 복구](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/webgl-recovery-1024.jpg)

미션 5 안내 이동 후 — A/B 경로 버튼을 가리지 않음.

![코어 안내 겹침 수정](D:/iscreammedia_sc34/1udangtangtang/docs/reviews/tablet-ui-2026-10-18/rescue-after-1024.jpg)
