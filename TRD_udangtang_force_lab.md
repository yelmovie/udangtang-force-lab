# TRD — 우당탕 힘 실험실

## 1. 기술 개요
- Repository: `udangtang-force-lab`
- 플랫폼: 태블릿 우선 웹
- Science World 통합: `topic-01 / 힘과 우리 생활`
- 구조: 5 Stages / 10 Screens
- 3D 화면: Page 2, 7, 10

## 2. 기술 목표
1. 2D/2.5D/3D를 한 단원 안에서 자연스럽게 전환한다.
2. Phaser와 Three.js 렌더 루프를 동시에 돌리지 않는다.
3. 학습 로직, 렌더링, UI, 저장을 분리한다.
4. 백엔드 없이 저장·이어하기를 지원한다.
5. 태블릿 저사양 30fps를 보수적 목표로 한다.
6. Science World 포털 호출과 독립 실행을 모두 지원한다.
7. 화면/미션을 JSON 데이터로 관리해 유지보수를 쉽게 한다.

## 3. 권장 스택
```text
Vite + TypeScript
Phaser 3        : 2D / 2.5D 학습 게임
Three.js        : Page 2, 7, 10
HTML/CSS/SVG    : HUD, 텍스트, 모달, 접근성 UI
JSON            : 페이지, 미션, 자산, 난이도, 보상, 랜덤 시드
LocalStorage    : 진행 상태와 작은 학습 로그
Canvas API      : 결과 카드 PNG 생성(선택)
Web Share API   : 결과 카드 공유(지원 브라우저만, 선택)
```
기존 저장소에 이미 쓰는 프레임워크가 있으면 우선 재사용한다. 별도 강체 물리엔진이나 대형 UI 프레임워크는 필수 의존성으로 추가하지 않는다.

## 4. 런타임 아키텍처
```text
Science World Hub (Three.js)
        │ portal enter
        ▼
Hub suspend
        ▼
TopicHost
 ├─ TopicStateMachine
 ├─ TopicEventBus
 ├─ DOMOverlayManager
 ├─ AudioManager
 ├─ SaveService
 ├─ PhaserTopicRuntime
 └─ ThreeTopicRuntime
        │
        ├─ P1,3,4,5,6,8,9 -> Phaser / Hybrid
        └─ P2,7,10          -> Three.js
        ▼
TopicResult
        ▼
Hub resume
```

### 수명주기 규칙
- 허브 진입 상태에서 단원 포털을 확정하면 Hub Three.js를 pause한다.
- 단원 내부 P2/P7/P10 진입 시 Phaser를 pause/hidden하고 ThreeTopicRuntime을 시작한다.
- 3D 페이지 종료 시 해당 scene의 geometry/material/texture/listener/mixer를 dispose한다.
- 3D 종료 후 Phaser를 정확히 한 번 재개한다.
- 단원 종료 시 TopicResult를 반환하고 Hub를 정확히 한 번 재개한다.

## 5. Scene Mode Matrix
| Page | ID | Runtime | Camera | 핵심 로직 |
|---|---|---|---|---|
| 1 | `force-cargo` | Phaser 2D | fixed | qualitative resistance |
| 2 | `warehouse-3d` | Three.js | limited orbit | grid/AABB push-pull |
| 3 | `balance-predict` | Phaser 2D | fixed | balance solver |
| 4 | `balance-deduce` | Phaser 2D | fixed | comparison graph |
| 5 | `digital-scale` | Phaser + DOM | fixed | mass sum + zero state |
| 6 | `spring-scale` | Phaser 2.5D | vertical view shift | spring pointer state machine |
| 7 | `tool-builder-3d` | Three.js | fixed 3/4 + limited orbit | snap constraints + scripted motion |
| 8 | `tool-analyzer` | Phaser 2.5D | fixed | tool scripts + catalog |
| 9 | `cargo-operation` | Phaser 2.5D | isometric/top-down | rule-based mission engine |
| 10 | `exosuit-final-3d` | Three.js | third-person follow | kinematic movement + scripted finale |

## 6. 폴더 구조
```text
src/
  topic/
    ForceLabApp.ts
    TopicHost.ts
    TopicStateMachine.ts
    TopicEventBus.ts
    topic-types.ts
  pages/
    p01_force_cargo/
    p02_warehouse_3d/
    p03_balance_predict/
    p04_balance_deduce/
    p05_digital_scale/
    p06_spring_scale/
    p07_tool_builder_3d/
    p08_tool_analyzer/
    p09_cargo_operation/
    p10_exosuit_final_3d/
  phaser/
    PhaserTopicRuntime.ts
    BaseLearningScene.ts
    systems/
      DragSystem.ts
      SnapSystem.ts
      BalanceSolver.ts
      ScaleSystem.ts
      MissionRuleEngine.ts
  three/
    ThreeTopicRuntime.ts
    BaseThreeLearningScene.ts
    CameraController.ts
    InteractionRaycaster.ts
    KinematicMover.ts
    AABBCollision.ts
    SnapPoint3D.ts
    ModelPool.ts
  ui/
    DOMOverlayManager.ts
    ProgressBar.ts
    MissionPanel.ts
    ResearchNotebook.ts
    HintLayer.ts
    Toast.ts
    ResultPanel.ts
  state/
    SaveService.ts
    SessionSeed.ts
    ProgressStore.ts
    ExperimentLog.ts
  audio/
    AudioManager.ts
public/
  assets/force-lab/{2d,3d,ui,audio}/
  config/force-lab/
    pages.json
    missions.json
    asset-manifest.json
    difficulty.json
    reward-rules.json
    tool-catalog.json
    weight-sets.json
```

## 7. 페이지 상태
```ts
type PageId =
  | 'p01' | 'p02' | 'p03' | 'p04' | 'p05'
  | 'p06' | 'p07' | 'p08' | 'p09' | 'p10';

type StageId = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';
```
전이:
```text
p01 -> p02 -> Stage1ResultOverlay
p03 -> p04 -> Stage2ResultOverlay
p05 -> p06 -> Stage3ResultOverlay
p07 -> p08 -> Stage4ResultOverlay
p09 -> p10 -> FinalResultOverlay
```
결과 오버레이는 별도 페이지로 세지 않아 실제 학습 화면 수를 10개로 유지한다.

## 8. 저장 데이터
```ts
interface ForceLabSave {
  schemaVersion: 1;
  topicId: 'topic-01-force';
  currentPage: PageId;
  unlockedStage: number;
  completedPages: PageId[];
  stageStars: Record<StageId, 0 | 1 | 2 | 3>;
  badges: string[];
  toolCatalog: string[];
  experimentLogs: ExperimentRecord[];
  hintCounts: Partial<Record<PageId, number>>;
  sessionSeed: string;
  updatedAt: number;
}

interface ExperimentRecord {
  pageId: PageId;
  missionId: string;
  prediction?: string;
  conditions: Record<string, string | number | boolean>;
  observation: Record<string, string | number | boolean>;
  correctionCount: number;
  hintCount: number;
  completed: boolean;
}
```
개인 이름·학번 등 식별 정보는 저장하지 않는다.

## 9. EventBus
공통 이벤트:
```text
topic:ready
page:enter
page:exit
mission:start
experiment:predict
experiment:change-condition
experiment:observe
experiment:retry
experiment:complete
hint:request
stage:complete
reward:grant
save:request
topic:complete
topic:exit
```
DOM UI와 Phaser/Three 장면은 직접 참조하지 않고 EventBus로 통신한다.

## 10. Page 1 — Force Cargo
- 각 가상 부품은 내부 `massValue`와 `massClass`를 가진다.
- 힘 수치 N은 학생에게 표시하지 않는다.
- 동일 gesture distance에 대해 상자 반응량, 이동 속도, 캐릭터 자세를 정성적으로 달리한다.
- 최소 두 무게 조건과 밀기/당기기 양쪽을 수행해야 완료.
- `ResearchNotebook`에 조건과 관찰 결과 자동 기록.

## 11. Page 2 — 3D Warehouse
### 좌표
- Three.js 오른손 좌표계
- Y up, 이동 XZ
- 1 unit = 1m

### 카메라/입력
- 제한된 orbit, 높이 변화 최소
- 바닥 tap 또는 가상 스틱으로 캐릭터 이동
- 상자 가까이에서 밀기/당기기 컨텍스트 행동

### 충돌
별도 강체엔진 대신 단순 grid/AABB.
- wall collider
- crate collider
- player capsule approximation
- goal trigger

### 되돌리기
최근 10개 의미 있는 상태를 snapshot 저장.
```ts
interface WarehouseSnapshot {
  playerCell: [number, number];
  crateCells: Record<string, [number, number]>;
}
```

## 12. Page 3 — Balance Solver
학생에게 공식은 보여 주지 않지만 내부 구현은 무게와 받침점 거리를 사용한다.
```text
internalBalance = Σ(leftMass × leftDistance) - Σ(rightMass × rightDistance)
```
- 임계값 내: 수평
- 양수: 왼쪽 기울기
- 음수: 오른쪽 기울기

중요: 위 계산식과 수치는 학생 UI에 절대 노출하지 않는다.

## 13. Page 4 — Comparison Graph
비교 결과를 방향 관계로 저장한다.
```text
A > B
C > A
=> C > A > B
```
- 실제 무게 seed를 기준으로 결과를 생성해 논리 모순을 방지한다.
- 최소 비교 횟수는 보너스 지표로만 사용한다.
- 추가 실험을 실패로 취급하지 않는다.

## 14. Page 5 — Digital Scale
상태 머신:
```text
OFF -> ON_UNZEROED -> ZEROED -> MEASURING -> STABLE -> ADJUSTING
```
- 무게가 없을 때 offset이 있을 수 있다.
- 영점 버튼으로 offset을 0으로 보정한다.
- 물체를 올리면 짧은 안정화 후 값 표시.
- 단위는 g 중심, 필요 시 kg도 표시하되 복잡한 변환은 주 과제로 만들지 않는다.
- 가상 실험 부품 무게는 `SessionSeed`로 생성한다.

## 15. Page 6 — Spring Scale
상태 머신:
```text
UNZEROED -> ZEROED -> OBJECT_ATTACHED -> OSCILLATING -> STABLE -> VIEW_MISALIGNED -> READABLE
```

### 표시자 흔들림
내부 구현 예:
```text
pointer(t) = target + A * exp(-k*t) * sin(w*t)
```
학생에게 수식은 보이지 않는다.

### 눈높이
관찰 view의 vertical offset에 따라 시차를 시각적으로 표현한다.
- 위/아래: 표시자와 눈금이 어긋나 보임
- 정렬 영역: 판독 가능

## 16. Page 7 — 3D Tool Builder
완전한 강체 시뮬레이션 대신 **스냅 포인트 + 제한된 작동 애니메이션**을 사용한다.

부품:
```text
plank_long
fulcrum_block
cargo
ramp_board
platform
```

```ts
interface SnapPoint3D {
  id: string;
  accepts: string[];
  position: [number, number, number];
  rotation: [number, number, number];
  tolerance: number;
}
```
- 긴 판+받침대 스냅 완료 -> lever mode
- 경사판 상·하단 연결 완료 -> ramp mode
- 작동 시 정량 N 대신 `큰 힘 / 중간 / 작은 힘` 정성 게이지
- 부품이 틀린 곳에 놓이면 물리적으로 폭발/튕기지 않고 부드럽게 원위치 또는 근접 힌트

## 17. Page 8 — Tool Analyzer
`tool-catalog.json` 예:
```json
{
  "bottle_opener": {
    "category": "lever",
    "interaction": "pry",
    "target": "bottle"
  }
}
```
- 도구를 알맞은 대상에 사용해야 분석이 열린다.
- 도구별 짧은 실제 작동 스크립트를 실행한다.
- 2개 이상 분석 시 결과 카드 생성.
- Canvas API PNG 저장, Web Share API는 지원 브라우저에서만 노출.

## 18. Page 9 — Mission Rule Engine
공통 시스템을 재사용해 종합 미션을 구성한다.
```text
MissionRuleEngine
 ├─ compareWeight()
 ├─ requestScale()
 ├─ chooseForceDirection()
 ├─ chooseRoute()
 └─ chooseTool()
```
미션별 여러 해결책:
```ts
interface ValidSolution {
  requiredConcepts: string[];
  allowedRoutes: string[];
  allowedTools: string[];
}
```
학생에게 정해진 한 순서를 강제하지 않고, 학습적으로 타당한 해결 경로를 허용한다.

## 19. Page 10 — 3D Exosuit Final
카메라:
- 3인칭 follow
- 회전 범위 제한
- 과도한 줌 금지

흐름:
```text
inspect debris
 -> choose direction
 -> prepare tool
 -> activate assist suit
 -> scripted cooperative move
 -> restore lab
 -> result overlay
```
힘 보조 슈트는 `prepare tool` 전에는 활성화할 수 없다.

## 20. Randomization
랜덤 가능:
- 가상 실험 부품 무게
- A/B/C 상대 무게 순서
- 창고 상자 위치
- 목표 무게
- Page 9 화물/경로 배치

랜덤 금지:
- 과학 규칙
- 저울 사용 절차
- 지레/빗면 분류 정답
- 성취기준 핵심 개념

세션 seed를 저장해 새로고침 후 동일 미션을 복원한다.

## 21. Persistence
키:
```text
science-world:topic-01-force:v1
```
저장 시점:
- 페이지 진입/완료
- 실험 완료
- 별 획득
- 도감 등록
- 힌트 사용
- `visibilitychange`에서 hidden 전환

`schemaVersion`을 포함하고 migration 함수를 준비한다.

## 22. Science World 연동
```ts
interface TopicResult {
  topicId: 'topic-01-force';
  completed: boolean;
  stars: number;
  maxStars: 15;
  stageResults: { stageId: StageId; stars: number }[];
  badgeId?: 'badge_force_lab';
  attemptId: string;
}
```
- 동일 attemptId 중복 보상 금지
- Hub RewardService와 연결
- 독립 실행 모드 예: `/force-lab/?standalone=1`

## 23. Asset Manifest
코드에 실제 경로를 흩뿌리지 않고 logical asset id를 사용한다.
```text
model_crate_lab
model_character_researcher
model_plank_long
model_fulcrum
model_exosuit
bg_warehouse
sfx_scale_zero
```
GLB 원본은 수정하지 않는다. 피벗이 맞지 않으면 `VisualCorrectionGroup`으로 보정하고, 충돌체는 시각 메시와 분리한다.

## 24. 3D 성능 예산
- 저사양 목표 30fps
- pixelRatio cap: low 1.0 / medium 1.25 / high 1.5
- 기본 post-processing off
- 3D 페이지 가시 삼각형 권장 150k 이하
- 리깅 캐릭터 1~2명
- 실시간 shadow caster 1개 이하
- 텍스처 512/1024, 주인공만 필요 시 2048
- 반복 소품 InstancedMesh 고려
- HDR은 선택, low profile에서 미사용

## 25. 메모리 관리
P2->P3, P7->P8, P10->결과 전환 시:
- AnimationMixer 정리
- scene-only geometry/material/texture dispose
- pointer/touch listener 해제
- RAF 중지 확인
- WebGLRenderer가 중복 생성되지 않는지 검사

## 26. 반응형/입력
- 기준 16:9 landscape
- 최소 터치 44px, 권장 48px
- 멀티터치 필수 금지
- 3D 카메라 회전과 오브젝트 드래그 모드를 구분
- drag threshold로 tap/drag 오판 방지
- 데스크톱은 WASD/Arrow/Enter/Space 기본 호환

## 27. 접근성
- 색만으로 상태 구분 금지
- 방향 화살표+텍스트/아이콘 병행
- `prefers-reduced-motion` 지원
- 사운드 없이도 모든 핵심 정보 판독 가능
- 기본 폰트 18px 이상 권장
- 긴 문장보다 짧은 미션 문장
- 키보드 포커스 표시

## 28. 오디오
```text
bgm_main
bgm_stage_1
bgm_stage_2
bgm_stage_3
bgm_stage_4
bgm_stage_5
sfx_push
sfx_pull
sfx_balance
sfx_scale_zero
sfx_scale_stable
sfx_snap
sfx_lever
sfx_ramp
sfx_reward
```
OGG + MP3 fallback. 첫 사용자 입력 전 autoplay 금지.

## 29. QA
기능:
1. 10개 페이지 모두 진입/종료 가능
2. 5개 Stage 완료 상태 정확
3. 새로고침 후 동일 page/seed 복원
4. P2/P7/P10 진입 시 Phaser 루프 중복 없음
5. 3D 종료 후 renderer/listener/mixer 증가 없음
6. 되돌리기 상태 정상
7. 전자저울 영점 전/후 상태 정상
8. 용수철저울 흔들림 -> stable 전이 정상
9. 눈높이 정렬 판정 정상
10. P9 다중 정답 검증

교육:
1. 4개 성취기준이 수행 행동으로 연결
2. 힘/토크 공식 노출 없음
3. 지레·빗면 힘 비교는 정성적
4. 실제 생활물품 무게의 고정 암기 유도 없음
5. 오답이 정답 공개로 끝나지 않음

디바이스:
- Chrome Android
- Samsung Internet
- Safari iPad
- Desktop Chrome

메모리:
- 3D↔2D 전환 10회 반복 후 listener/mixer/RAF 증가 추세 없음

## 30. 빌드/배포
```bash
npm install
npm run dev
npm run build
npm run verify
```
Vercel 정적 배포 기준:
- 대소문자 경로 검사
- public asset 경로 검사
- SPA fallback 확인
- manifest의 모든 asset 존재 검증

## 31. 위험과 완화
- **3D 과다:** P2/P7/P10으로 제한, lazy load/dispose
- **물리엔진 복잡도:** AABB, snap, scripted motion 중심
- **고학년 공식 노출:** 내부 계산과 학생 UI 분리
- **가상 측정값 암기:** 가상 부품+session seed 사용
- **Phaser/Three 누수:** TopicHost 단일 수명주기+왕복 테스트
- **P9 과난도:** 단계별 힌트 제공하되 해결 순서는 학생 선택 유지

## 32. 기술 완료 기준
- `npm run verify` 성공
- 5 Stage / 10 Screen exact
- P2/P7/P10 3D exact
- no backend
- local save
- tablet landscape usable
- low-device 30fps target
- 4개 성취기준 수행형 검증
- TopicResult 반환
- 3D↔2D 10회 왕복 메모리 누수 없음
