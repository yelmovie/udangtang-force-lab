# 01 우당탕 힘 실험실 · 3D 달리기 스테이지 계획 · 2026-11-17

**현재 단계: 계획 문서.** 코드, 이미지, 배포는 손대지 않았다. 공통 규격은 [공통 계획](../../_shared/RUN-STAGE-3D-PLAN-20261117.md)에 있다.

## 한 줄 요약

마지막 미션 「중앙 코어」를, 탐구자가 작업장을 직접 걸어 다니며 상자를 당기고 빗면을 골라 코어를 밀어 올리는 3D 작전으로 바꾼다.

## 바꿀 자리

- 3학년 「힘과 우리 생활」([4과01-01~04]), 다섯 미션 중 마지막인 `rescue`(중앙 코어 · 배터리 다시 끼우기). 필수다.
- 파일: `src/rescueModel.ts`(판정), `src/screens/rescue.ts`(화면), `src/three/coreScene.ts`(지금의 3D 빗면 작업대).
- 처음 추천에서는 `src/cargoModel.ts`를 가리켰는데, 그 파일은 첫 미션 「물자 배송소」의 것이다. 첫 미션은 HANDOFF에 "2단계 추가 의뢰는 필수. 선택화·개수·라운드·완료 조건 축소 금지"라고 적혀 있고 기초 비교를 차근차근 하는 자리라서 대상에서 뺐다. 배운 것을 다시 쓰는 마지막 미션이 달리기 형식과 맞고, 이미 3D 화면이 있다.

## 지금 방식과 바뀐 방식

지금 미션은 네 단계다: 코어 무게 확인 → 길을 막은 상자를 내 쪽으로 당기기 → 두 빗면을 같은 힘으로 비교 → 도착하는 길로 코어 운반.

| | 지금 | 바꾼 뒤 |
|---|---|---|
| 이동 | 화면의 물건을 직접 끈다. 시점 돌리기 버튼이 있다 | 방향판으로 탐구자를 움직여 저울, 상자, 빗면 앞으로 간다 |
| 상자 | 끌어서 당긴다 | 상자 앞에 서서 '당기기' 버튼을 누른다 |
| 빗면 고르기 | A·B 꼬리표를 누른다 | 짧고 가파른 빗면 A나 길고 완만한 빗면 B 입구로 걸어간다 |
| 힘 고르기 | 작은 힘·중간 힘·큰 힘 버튼 | 같은 버튼 |
| 운반 | 코어를 끌거나 Enter를 누르고 있는다 | 코어 뒤에서 '밀기' 버튼을 누르고 있는다 |

이 프로젝트는 9개 중 점프를 가장 적게 쓴다. 점프는 작업장의 턱과 흩어진 부품을 넘을 때만 쓰고, 중심 조작은 밀기와 당기기다.

## 과학 개념과 조작

| 개념 | 달리기에서 하는 일 |
|---|---|
| 물체를 밀거나 당기면 움직인다 | 길을 막은 상자를 당겨 치우고, 코어를 밀어 올린다 |
| 같은 물체를 같은 높이로 옮길 때 빗면이 완만하면 작은 힘으로도 옮길 수 있다 | 같은 힘으로 두 빗면을 각각 시도해 한쪽은 멈추고 한쪽은 도착하는 것을 본다 |
| 공정하게 비교하려면 한 가지만 바꾼다 | 힘은 그대로 두고 빗면만 바꿔 다시 시도해야 비교 기록이 생긴다 |

### 지켜야 할 제한

- 코드 주석: "Same load, height and surface. Qualitative model; these are not measured newtons."
- 코어가 올라가는지는 `canLift(route, force)`만으로 정한다. 짧은 빗면은 큰 힘에서만, 긴 빗면은 모든 힘에서 도착한다. 버튼을 오래 누르거나 달려와서 민다고 결과가 달라지지 않는다.
- 힘이 모자라면 코어는 `stallTravel`(.08)만큼만 움직이고 곧바로 멈춘다. 주석에 적힌 대로 힘이 "연료처럼 중간까지 실어 주는" 것처럼 보이면 안 된다.
- 화면의 "같은 코어 · 같은 힘 · 같은 도착 높이" 조건 표시를 그대로 둔다.
- 완료 조건(무게 확인, 상자 당기기, `hasFairComparison`, 운반 완료)을 줄이지 않는다.
- **자동 진행 보호(이 프로젝트 `AGENTS.md` E-1):** 수동 조작을 바꾸는 작업은 '자동으로 보기'를 바꾸는 작업이 아니다. 자동 시연의 화면, 버튼, 순서, 횟수, 속도, 중지와 수동 전환, 시연 직후의 결과·질문을 이전 검증 버전 그대로 둔다. 걷는 방식은 수동 경로에만 넣고, `src/autoPlay.ts`와 `rescue.ts`의 `autoPlay()`가 거치는 코드는 조건을 나눠 기존대로 동작하게 한다. 변경 전후를 별도 저장으로 비교하고, 3D와 2D 대체 경로를 둘 다 확인한다.

## 코스 구성

1. **저울 앞:** 코어를 저울에 올려 무게를 확인한다. 앞서 잰 저울 기록을 다시 볼 수 있다.
2. **막힌 문:** 길을 막은 상자를 내 쪽으로 당겨 치운다.
3. **두 빗면:** A와 B 입구가 갈라진다. 힘을 고르고 한쪽에서 밀어 본 뒤, 같은 힘으로 다른 쪽도 밀어 본다. 시도할 때마다 기록판에 도착·멈춤이 남는다.
4. **운반:** 도착하는 길로 코어를 끝까지 밀어 중앙 장치에 끼운다.

방해꾼은 지도 악당 스프라이트를 써서 작업장 통로를 오가게 한다. 닿으면 움찔만 하고 코어와 기록은 바뀌지 않는다.

## 연결과 저장

- 저장 키는 localStorage `udangtang-force-lab-save-v1`이다. `rescue` 상태의 `measured`, `gate`, `runs[]`(각 기록은 `route`, `force`, `success`), `delivered`를 그대로 쓴다.
- 진행 표시는 기존 `setMissionProgress`의 네 칸을 그대로 쓴다.
- 대체 화면은 지금의 끌기 방식 3D 작업대와 '그림으로 계속하기' 2D 화면(`rescue.ts` 153~160행 부근)이다.

## 이미지 생성·적용 목록

참고 그림은 `public/assets/characters/student_poses.webp`, `corgi_poses.webp`, `squirrel_poses.webp`다. 마을은 픽셀아트이고, 실험 화면 그림체는 작업을 시작할 때 `public/assets/game/`의 그림(저울 `scale.webp` 등)을 보고 맞춘다.

| 번호 | 그림 | 종류 | 적용 위치 |
|---|---|---|---|
| 1 | 탐구자 대기 | 캐릭터 동작 줄 | 서 있을 때 |
| 2 | 탐구자 걷기 | 캐릭터 동작 줄 | 이동 |
| 3 | 탐구자 밀기 | 캐릭터 동작 줄 | 코어 밀 때 |
| 4 | 탐구자 당기기 | 캐릭터 동작 줄 | 상자 당길 때 |
| 5 | 탐구자 점프 | 캐릭터 동작 줄 | 턱 넘을 때 |
| 6 | 탐구자 기뻐하기 | 캐릭터 동작 줄 | 코어 장착 |
| 7 | 콩이 따라 걷기 | 캐릭터 동작 줄 | 동료, 힌트 줄 때 |
| 8 | 작업장 바닥 무늬 | 바닥 무늬 | 길 |
| 9 | 빗면 나무판 무늬 | 바닥 무늬 | 두 빗면 |
| 10 | 길을 막은 상자 | 소품 | 막힌 문 |
| 11 | 흩어진 부품 더미 | 소품 | 넘어갈 턱 |
| 12 | 작업장 원경(벽과 창, 가까운 선반) | 원경 2장 | 배경 |
| 13 | 시작 카드 그림 | 시작 카드 | 미션 들어갈 때 |

코어, 저울, 중앙 장치는 `coreScene.ts`가 이미 쓰는 모형과 그림을 다시 쓴다. 예상 14장.

## 기술, 검증, 배포

- Three.js는 npm `three` ^0.180.0이 이미 있다. `rescue.ts` 143행 부근에서 필요할 때 불러온다. `coreScene.ts`의 빗면과 코어 구성을 그대로 살리고, 그 위에 걸어 다니는 캐릭터와 입력을 더한다.
- 방향판은 `src/map-controls.js`를 다시 쓴다(`screens/village.ts`가 쓰는 방식).
- 검증 명령: `npm run build`(`tsc --noEmit && vite build`), `npm test`(`scripts/test-*.mjs` 15개).
- `scripts/offline-plugin.mjs`가 캐시 목록을 자동으로 만든다. `.webp`는 포함된다.
- 운영 주소는 https://udangtang-force-lab.yelsam.workers.dev 이고 `npm run build && npx wrangler deploy`로 올린다.

## 작업 순서

1. 규칙 연결: 캐릭터의 위치와 누른 버튼을 기존 `rescue` 상태 변화로 바꾸는 함수와 테스트
2. `coreScene.ts`에 걷는 캐릭터를 올려 네 단계를 끝까지 해 보기
3. 힘이 모자랄 때 "조금 움직이고 멈춤"이 걷는 방식에서도 똑같이 보이는지 확인
4. 이미지 생성·적용
5. 대체 화면, 새로고침 후 이어 하기, 교사 시연 확인
6. 검증 명령 → 커밋·푸시 → 운영 배포 → 운영 주소 확인

## 시작 전에 확인할 것

- 탐구자(학생 캐릭터)와 다람쥐 기록관의 이름을 확인하지 못했다.
- 최신 진행 상황은 `.project-memory/PROJECT_STATE.md` 맨 위와 `HANDOFF.md`에 있다. 시작할 때 먼저 읽는다.
- Git 명령에는 `-c safe.directory="$(pwd)"`를 붙인다(외장 SSD 소유권 문제).
- 배포할 컴퓨터에 `public/assets/story/*.mp4`, `public/assets/concepts/*.mp4`가 있는지 확인한다. 이 영상은 Git에 없고, 없는 채로 빌드해 올리면 운영본에서 영상이 빠진다.
- 배포 절차와 기록은 `docs/DEPLOY-LOG.md`를 따른다(`npm test && npm run build && npx wrangler deploy`, 배포 뒤 기록 표에 한 줄 추가).
- 지금 화면의 시점 돌리기·코어 확대 버튼을 걷는 방식에서 남길지 정한다. 공통 규격은 시점 고정이지만, 코어 모양을 살펴보는 '코어 확대'는 관찰 기능이라 남기는 쪽을 권한다.
- 운영 시트 G·H열의 주소와 저장소를 대조한다.

---

## 계획 확정 (2026-11-17 구현 세션)

코드를 읽어 「시작 전에 확인할 것」을 해결하고 문서와 실제를 대조했다.

### 확인한 것과 바로잡은 것

- 이름: 학생 캐릭터는 코드에서 '탐구자'·'탐험가'로만 부른다(고유 이름 없음). 강아지는 '콩이', 다람쥐는 '도토리 박사'다. 달리기 화면도 같은 호칭을 쓴다.
- 방향판: `src/map-controls.js`의 `bindDirectionPad`는 화면 버튼의 누름·뗌만 알려 주고 키보드는 표시만 한다. 키보드 이동은 같은 파일의 `mapKeyDirection`으로 직접 받는다.
- 테스트 파일은 문서의 15개가 맞다(`package.json`의 `test`에 나열된 15개, 198건 통과). 이번에 `scripts/test-rescue-walk.mjs`를 더한다.
- 대체 화면의 실제 위치: `rescue.ts`의 `prepareScene()`(3D 작업대 불러오기)과 `use2D`('그림으로 계속하기'). 줄 번호는 139~161행이다.
- 운반 기록을 남기는 곳은 `rescue.ts`의 `finishTravel()` → `recordRun()`이다. 걷는 방식도 이 두 함수를 그대로 거치게 해서 기록·문구·소리·예상 칩이 같아지게 한다.
- `main.ts`의 `watchFinish`가 완료 버튼이 풀리면 '다 했어요!' 팝업을 띄운다. 걷는 화면에서도 같은 버튼(`#rescue-finish`)을 쓰므로 그대로 동작한다.
- **코어 모형 삼각형 수:** `core.glb`는 49,974개(`scripts/core-models.json`)라 걷는 화면에 그대로 올리면 공통 목표(3만)를 넘는다. 걷는 화면의 코어는 기존 그림 `public/assets/props/core-cargo.webp`를 세워 쓰고, 중앙 장치는 기본 도형으로 만든다. `core.glb`는 '코어 확대'를 누를 때만 불러와 가까이 보여 준다(기존 작업대와 같은 모형).
- 시점 돌리기 버튼은 걷는 화면에 두지 않는다. '코어 확대'는 남기고, 확대 중에는 방향판 좌우로 코어 자체를 돌려 본다.
- 운영 주소·저장소는 지휘 세션이 2026-11-17에 시트 G·H열과 대조했다(프롬프트 값 사용). `origin`과 차이 없음, 영상 7개 있음.

### 화면을 얹는 방식

걷는 화면은 기존 「중앙 코어」 화면 안의 세 번째 그리기·입력 방식이다(기존: SVG 그림, 3D 작업대).

- `rescue.ts`의 상태·판정·기록 함수(`recordWeight`, `finishTravel`, `recordRun`, `selectRoute`, `slideBack`)를 그대로 부른다. 새 판정을 만들지 않는다.
- 단계 머리줄(안내 문구, '▶ 자동으로 보기', '내 발견 꺼내 쓰기')과 아래 완료 버튼은 그대로 보인다.
- **자동으로 보기**를 누르면 걷는 화면을 닫고 기존 화면으로 바꾼 뒤 기존 `autoPlay()`를 그대로 실행한다. 자동 진행 중에는 걷는 화면 전환 버튼을 숨긴다.
- 「기존 방식으로 하기」/「걸어서 하기」 버튼으로 언제든 바꾼다. 움직임 줄이기(`prefers-reduced-motion`)나 WebGL 실패 때는 처음부터 기존 화면이다.

### 코스 설계표 (오른쪽으로 가는 한 방향, 왼쪽이 출발)

| 구간 | x 범위 | 있는 것 | 하는 일 | 바뀌는 저장 필드 |
|---|---|---|---|---|
| 출발 | −19 | 탐구자, 콩이 | 방향판으로 오른쪽으로 걷기 | 없음 |
| ① 저울 앞(연습) | −17.5 ~ −13 | 코어 거치대, 전자저울(숫자는 코드로 표시) | 저울 앞에서 '0 맞추기', '코어 올리기' | `zeroed`, `loaded`, `measured` |
| 턱 | −12.2 | 낮은 턱(높이 0.28) | 점프로 넘기 | 없음 |
| ② 막힌 문(적용) | −11.5 ~ −9 | 문틀에 낀 상자 | 상자 앞에서 '밀기'(안 움직임) 또는 '당기기'(누르고 있기) | `gate` |
| 통로 | −8 ~ −5.5 | 부품 더미(돌아가거나 점프), 오가는 바퀴잠금 봇(닿으면 움찔만) | 지나가기 | 없음 |
| ③ 두 빗면(도전) | −5.6 ~ 1.5 | B 길고 완만한 빗면(앞쪽), A 짧고 가파른 빗면(뒤쪽), 힘 버튼 3개 | 빗면 입구로 걸어가 길 고르기 → '밀기' 누르고 있기 | `route`, `force`, `runs[]`, `delivered` |
| ④ 중앙 장치 | 1.5 ~ 5.3 | 높은 받침, 중앙 장치 | '코어 끼우기'(= 기존 완료 버튼) | 완료 기록(`context.finish`) |

- 좌표는 기존 `coreSceneModel.ts`의 `coreRoutes`를 그대로 쓴다(두 빗면의 길이·높이·도착 높이 동일).
- 체크포인트: 출발, 저울 앞, 문 앞, 빗면 앞. 바닥 아래로 떨어지거나 끼이면 마지막 지점으로 돌아온다.
- 코어 이동: 무게를 잰 뒤 코어는 뒷벽 레일 거치대에 걸려 있다가, 길이 열리면 레일을 타고 빗면 앞으로 간다.
- 같은 곳에서 세 번 막히면(같은 힘에서 세 번 멈춤 등) 콩이 말풍선으로 기존 힌트 문구를 보여 주고 「기존 방식으로 하기」 버튼을 강조한다.

### 구현 작업 목록

1. `src/rescueWalkModel.ts`: 구간 판별, 구간·상태별로 쓸 수 있는 버튼, 밀기 결과(`canLift`, `stallTravel`) — 테스트 `scripts/test-rescue-walk.mjs` 먼저
2. `src/three/walkStage.ts`: 무대, 캐릭터(세운 그림), 입력, 고정 추적 카메라, 체크포인트, 방해꾼
3. `src/screens/rescueWalk.css`: 방향판·점프·동작 버튼·힘 버튼·이름표
4. `src/screens/rescue.ts`: 걷는 화면 전환과 기존 함수 연결(자동 진행은 기존 화면으로)
5. 이미지 생성·적용 → 검증 → 커밋·푸시·배포 → 기록

### 진행 상황

- [x] 1 읽기 · 2 계획 확정 (2026-11-17)
- [x] 3 구현 1차(임시 그림): `rescueWalkModel.ts`+테스트 11건, `three/walkStage.ts`, `screens/rescueWalk.css`, `rescue.ts` 연결. 개발 서버 1280×800에서 키보드로 처음부터 끝까지 플레이(0 맞추기 → 코어 올리기 180 g → 턱 점프 → 밀기 막힘 → 당기기 → 짧은 빗면 작은 힘 멈춤 → 긴 빗면 도착 → 코어 끼우기)해 `rescue` 저장 필드와 `pendingStage` 요약이 기존과 같은 형식으로 남는 것을 확인. 콘솔 오류 없음. (2026-11-17)
- [x] 4 이미지 1차(캐릭터·콩이·바닥·부품 더미) 생성·가공·화면 적용 확인, 내장 임시 원본 정리 (2026-11-17)

## 이미지 기록 (2026-11-17)

도구: `gpt-imagegen` 스킬(`gpt-image.sh`), 공용 잠금 래퍼 `_shared/run-stage-lock.sh image …`로 한 장씩. 원본은 `references/images/run-stage-20261117/`(저장소 제외, SSD 보관), 실행 파일은 `public/assets/run-stage/`(WebP). 가공은 `node scripts/prepare-run-stage.mjs`(반투명 얼룩 제거 → 칸 나누기 → 같은 배율·같은 발 높이로 256×256 칸에 배치). 생성 스크립트와 로그는 `.tmp/run-stage/`(`gen-images.sh`, `gen-images-2.sh`, `imagegen*.log`).

공통 문구(동작 줄): "Sprite sheet for a 2D game, wide 3:1 image (1536x512): one single horizontal row of exactly 6 equally spaced frames. Same character size in every frame, feet on the same baseline, evenly spaced, frames must not overlap. Soft 3D-cartoon illustration style, colors and proportions matching the reference image. Fully transparent background. No text, no letters, no numbers, no logo, no ground shadow, no frame borders."

| 원본(`references/images/run-stage-20261117/`) | 참고 그림(`-i`) | 프롬프트 요지 | 실행 파일 | 쓰는 곳 |
|---|---|---|---|---|
| `explorer-walk.png` | `characters/student_poses.webp` | 공통 + 같은 탐구자, 오른쪽을 보고 걷는 6칸 | `explorer-walk.webp` (6칸) | 걷기 |
| `explorer-push.png` | 같음 | 공통 + 두 손바닥으로 앞을 미는 6칸, 미는 물체는 그리지 않음 | `explorer-push.webp` (6칸) | 코어 밀기 |
| `explorer-pull.png` | 같음 | 공통 + 두 주먹을 가슴 앞에 쥐고 뒤로 당기는 6칸, 당기는 물체는 그리지 않음 | `explorer-pull.webp` (5칸, 다섯째 칸은 원본에서 칸 경계에 걸려 제외) | 상자 당기기 |
| `corgi-walk.png` | `characters/corgi_poses.webp` | 공통 + 같은 코기, 오른쪽으로 달리는 6칸 | `corgi-walk.webp` (6칸, 털 주변 흐림 제거) | 콩이 따라 걷기 |
| `floor.png` | 없음 | 이어 붙는 정사각 바닥 무늬: 짙은 청록 돌판과 가는 황동 줄눈, 그림자·글자 없음 | `floor.webp` (512²) | 작업장 바닥 |
| `parts-pile.png` | 없음 | 투명 배경 소품: 황동 톱니, 볼트·너트, 구리 관, 작은 스패너 더미 | `parts-pile.webp` | 넘거나 돌아갈 부품 더미 |
| `wall.png` | `backgrounds/core-hall-v2.webp` | 2차 공통(아래) + 원근 없는 정면 벽: 크림색 돌벽, 아치 창 너머 소나무 숲, 청록 깃발, 구리 관, 보일러, 벽등, 화분 선반, 아래 1/5은 청록 판벽 | `wall.webp` | 뒷벽(좌우 반복) |
| `dock.png` | 같음 | 2차 소품 공통 + 빈 네모 소켓이 있는 낮은 청록·황동 받침과 뒤쪽 기계판(등·화면 없음) | `dock.webp` | 중앙 장치 |
| `panel.png` | 같음 | 2차 공통 + 이어 붙는 청록 금속판 무늬, 황동 테두리·리벳 | `panel.webp` | 상자·받침 겉면 |
| `decor-shelf.png` | 같음 | 2차 소품 공통 + 화분·유리병·지구본·도면·톱니가 놓인 나무 선반 | `decor-shelf.webp` | 뒷벽 장식(출발점) |
| `decor-barrels.png` | 같음 | 2차 소품 공통 + 나무통 두 개, 작은 상자 위 황동 등, 밧줄 | `decor-barrels.webp` (512×457) | 뒷벽 장식(턱 오른쪽 뒤, 너비 1.7) |
| `decor-bench.png` | 같음 | 2차 소품 공통 + 바이스·탁상등·스패너·망치·톱니·도면이 놓인 작업대와 의자 | `decor-bench.webp` (512×505) | 뒷벽 장식(빗면 왼쪽 뒤, 너비 2.3) |
| `bot-walk.png` | `ref-bot-pixel.png`(지도 악당 픽셀 그림), `characters/student_poses.webp` | 공통 + 픽셀 로봇(주황 헬멧·톱니 문양·용수철 팔·스패너 집게)을 둘째 참고 그림체로 다시 그린 6칸 걷기, 귀엽고 무섭지 않게 | `bot-walk.webp` (6칸) | 방해꾼 |

2차 공통 문구: "Soft cozy 3D-cartoon illustration style with warm light, teal, cream and brass colors, matching the reference image. No text, no letters, no numbers, no logo." 소품은 앞에 "Game prop, square 1024x1024, front view from slightly above, the whole object visible with empty margin around it. Fully transparent background. No ground shadow."를 붙였다. 전문은 `.tmp/run-stage/gen-images-2.sh`, `gen-images-3.sh`.

- 대기·점프·기뻐하기는 새로 만들지 않고 기존 `public/assets/characters/student_poses.webp`(4×2)에서 1·8·6번 자세를 같은 배율로 잘라 쓴다(`explorer-idle/jump/cheer.webp`).
- 코어(`props/core-cargo.webp`), 상자(`props/wood-crate.webp`), 저울(`game/scale.webp`), 빗면 나무판(`textures/workshop-wood.webp`), 방해꾼(`village/encounters/wheel-lock-atlas.webp` 셋째 줄)은 기존 그림을 다시 쓴다.
- 저울 숫자, A·B 빗면 이름, 상태등 다섯 개는 그림이 아니라 코드로 그린다.
- 시작 카드 그림은 만들지 않았다. 이 미션에는 이미 미션 카드(예상 고르기)가 있어 그대로 쓴다.
- 검수: 모두 직접 열어 글자·로고 없음, 투명 배경, 칸 정렬, 생김새를 확인했다. 원본의 빨강·노랑 반투명 얼룩은 가공에서 제거된다(가공 결과를 다시 열어 확인).

### 진행 메모 (2026-11-17 11:40, 이어서 할 사람용)

- 사용자 추가 지시(같은 날): "구현한 화면을 GPT 이미지로 고도화, 배경도 아기자기하게, 겹침·잘림·물리적으로 이상한 것 확인·수정."
- 끝난 것: 걷는 화면 전체 흐름(키보드·화면 버튼), 자동으로 보기 운영본 대조(12줄 기록·저장 일치, 3D·그림 작업대 둘 다), 움직임 줄이기·WebGL 실패 대체, 1024×768·1180×757·1280×800·1920×1080 겹침 검사, 테스트 209건·빌드 통과. 1차 그림 6장 적용·내장 원본 정리 완료.
- 고친 어색한 점: 세운 그림이 뒤 물체에 잘림(카메라 쪽으로 기울던 스프라이트 → 똑바로 선 그림), 코어가 사람을 뚫고 내려옴(되돌아올 때 탐구자가 잡고 같이 내려옴), 콩이가 턱을 통과, 탁자·가구·받침 위로 점프해 올라섬, 빗면 아래 끼임, 멈출 때 미끄러짐, 저울이 사람만큼 큼, 이름표 잘림, 이어하기 위치가 방해꾼 옆.
- 기다리는 것: 2차·3차 그림 7장(`wall`, `dock`, `panel`, `decor-shelf`, `decor-barrels`, `decor-bench`, `bot-walk`). 공용 이미지 잠금을 다른 세션들과 나눠 써서 오래 걸린다. `.tmp/run-stage/gen-images-2.sh`, `gen-images-3.sh`가 뒤에서 재시도 중(로그 `imagegen-2.log`, `imagegen-3.log`). 지금 `public/assets/run-stage/`의 `wall·dock·panel·decor-*.webp`는 임시 그림이다.
- 그림이 오면: `node scripts/prepare-run-stage.mjs` → `walkStage.ts`에서 크기·위치 맞춤(중앙 장치 소켓 위치, 방해꾼은 `strips.bot`을 `run-stage/bot-walk.webp` 6칸으로) → 화면 확인 → `.tmp/run-stage/clean-images.sh <이름…>`으로 내장 원본 정리 → 테스트·빌드 → 커밋·푸시 → 배포 → 기록.
- 아직 안 한 것: 커밋, 푸시, 운영 배포, `docs/DEPLOY-LOG.md`·`.project-memory/PROJECT_STATE.md` 기록.

### 인계 (2026-11-17 12:35)

이 세션은 여기서 멈췄다. 지금 상태와 남은 순서는 [인수인계 문서](RUN-STAGE-3D-HANDOFF-20261117.md)에 있다. 위 「진행 메모」 뒤에 달라진 것: 배경 벽·방해꾼·중앙 장치·벽 무늬·선반 그림 적용(화면 확인), 캐릭터를 똑바로 선 평면으로 바꿈, 빗면 옆 보이지 않는 난간, 장착 뒤 카메라 복귀. 남은 그림은 `decor-barrels`, `decor-bench` 두 장이다.

- [x] 4 이미지 2차(배경 벽·방해꾼·중앙 장치·벽 무늬·선반) 적용·화면 확인 — 내장 임시 원본 정리 전
- [x] 4 이미지 나머지 2장(`decor-barrels`, `decor-bench`) 가공·화면 적용, 「이미지 기록」 표 보충, 내장 임시 원본 7장 정리 (2026-11-17 13:10)
- [x] 5 최종 검증 · 6 커밋·푸시·배포 · 7 「구현 결과」 기록 (2026-11-17, 아래)
- 13:02 덧붙임: `decor-barrels.png`, `decor-bench.png` 원본 생성 완료(13:00~13:01). 가공·화면 적용·내장 원본 정리는 다음 세션에서 한다.

## 구현 결과 (2026-11-17)

「중앙 코어」(`rescue`)가 처음에 걷는 3D 작업장으로 열린다. 판정과 저장은 기존 `rescue.ts` 함수와 기존 `rescue` 필드를 그대로 쓴다. 자동으로 보기는 기존 화면에서 기존 `autoPlay()`로 돈다.

### 바뀐 파일

- 새 파일: `src/rescueWalkModel.ts`, `src/three/walkStage.ts`, `src/screens/rescueWalk.css`, `scripts/test-rescue-walk.mjs`(11건), `scripts/prepare-run-stage.mjs`, `public/assets/run-stage/*.webp` 16개(합계 약 1.0 MB), 이 문서와 `docs/RUN-STAGE-3D-HANDOFF-20261117.md`
- 수정: `src/screens/rescue.ts`(걷는 화면 연결, CRLF 유지), `package.json`(`test`에 새 테스트), `README.md`, `HANDOFF.md`, `AGENTS.md`(운영 배포 자동 승인 문구), `docs/DEPLOY-LOG.md`(배포 기록)

### 검증 (Mac, 2026-11-17 13:05~13:25)

| 항목 | 결과 |
|---|---|
| `npm test` | 209건 통과, 실패 0 |
| `npx tsc --noEmit` | 오류 없음 |
| `npm run build` | 통과(`walkStage` 조각 21.0 kB, 서비스워커 19/208 파일). `three` 조각 500 kB 경고는 전부터 있던 것 |
| 장식 그림 2장 | 원본·가공본을 직접 열어 글자·로고 없음, 투명 배경, 잘림 없음 확인. 걷는 화면에서 통은 턱 오른쪽 뒤, 작업대는 빗면 왼쪽 뒤 바닥에 서 있고 레일·기록판과 겹치지 않음 |
| 1280×800 키보드+화면 버튼 | 0 맞추기 → 코어 올리기 180 g → 턱 점프 → 밀기 → 당기기 → A 짧은 빗면 작은 힘 멈춤(E 누르고 있기) → B 긴 빗면 도착(밀기 버튼 누르고 있기) → 코어 끼우기 → 「다 했어요!」 → 결과·문제 화면. 저장값 `runs=[short✗, long✓]`, `route: long`, `force: 1`, `delivered: true`, `pendingStage` 요약 기존 형식 |
| 1024×768 화면 버튼만 | 방향판·점프(두 손가락 동시)·당기기·밀기 누르고 있기로 처음부터 끝까지 통과. 버튼·안내 겹침과 화면 밖 넘침 없음 |
| 자동으로 보기(3D 작업대) | 인계 문서 12줄과 안내 문구·피드백·화면 종류(`is-core-3d`, `core-delivered`)·끝난 저장값 일치. 끝난 뒤 버튼은 기존과 같이 숨겨짐(`syncAutoButton` 변경 없음) |
| 자동으로 보기(그림 작업대) | 3D 작업대 불러오기 실패 → 「그림으로 계속하기」 → 자동으로 보기가 끝까지 진행, 같은 문구·저장값·팝업(「저울의 숫자는 180 g」, 「다 했어요! 멋져요」). 3D 불러오기가 자동 진행 중에 실패하면 거기서 멈추는 것은 변경 전과 같은 동작 |
| 기존 방식 ↔ 걷기 전환 | 기록 유지, 캔버스 1개 유지. 코어 장착 뒤에는 전환 버튼이 숨겨짐(설계대로) |
| 새로고침 뒤 이어하기 | 상자 단계 위치(x=−12.6)에서 다시 시작 |
| 움직임 줄이기 | 기존 화면이 먼저 뜨고 「걸어서 하기」 버튼 제공 |
| 콘솔 오류 | 없음(WebGL을 일부러 막은 시험의 오류 한 줄만) |
| 영상 | `public/assets/story/*.mp4` 2개, `concepts/*.mp4` 5개 확인, `dist`에 7개 포함 |

### 확인하지 못한 것

- 실물 태블릿(iPad Safari, Android Chrome)의 터치·회전·백그라운드 복귀·오프라인
- 다섯 미션 연속 플레이(검증용 저장으로 「중앙 코어」만 바로 열었다)
- Windows에서의 테스트·빌드
- 1180×757·1920×1080 겹침은 이전 세션 측정(새 장식 그림 전). 버튼 배치는 그 뒤 바뀌지 않았다
