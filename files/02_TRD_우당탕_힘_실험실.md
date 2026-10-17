# 우당탕 힘 실험실 — TRD

## 1. 기술 스택
- Vite + TypeScript
- Phaser 3: 2D 물리/실험 화면
- Three.js: 3D 핵심 화면(4, 9, 12)
- HTML/CSS/SVG: UI, 카드, 버튼, 패널, 기록
- LocalStorage: 저장/이어하기
- EventBus: 화면 간 상태/이벤트 전달

## 2. 렌더링 원칙
### 2D 화면
- Phaser 또는 DOM/SVG 기반
- 수평대, 저울 표시, 결과 기록은 읽기 쉬운 2D 우선

### 3D 화면
- Page 4: 창고 공간과 밀기/당기기 방향 판단
- Page 9: 지레·빗면 조립
- Page 12: Final Mission

### 3D + CSS 역할 분리
- Three.js: 공간/오브젝트/물리 반응
- CSS/DOM: 제목, 버튼, 미션, 기록, 설정

## 3. 3D 구현 주의
- 자유 카메라 금지, 기본 3/4 시점
- 좌우 회전 약 ±30~45°
- 확대/축소 제한
- 오브젝트 Hit Area는 실제 모델보다 크게
- 같은 조건에는 같은 결과가 나오도록 deterministic하게 구현
- 실패 시 전체 Reset보다 현장 수정 우선
- 지나친 그림자/반사/파티클보다 30fps 이상 안정성 우선

## 4. Page 4 — 막힌 창고 탈출
- 카메라 회전
- 캐릭터 이동
- 상자 앞/뒤 위치 판단
- 밀기/당기기
- 장애물과 출구 관계 파악
- 상자 튐/회전 등 과도한 물리 금지

## 5. Page 9 — 장치를 만들어라
- 판자, 받침대, 경사판, 코어 상자
- 반자유 조립 + Snap Point
- 구조 조건이 성립해야 작동
- 직접 들기 vs 도구 사용은 정성적 힘 게이지로 비교
- 공식 계산 금지

## 6. Page 12 — Final Mission
- 공간 관찰
- 장애물 이동 방향 결정
- 지레/빗면 필요 여부 판단
- 힘 보조 슈트 활성화
- 직접 밀기/당기기
- 슈트가 자동 해결하는 치트키가 되지 않게 설계

## 7. 저장 데이터
```ts
interface SaveData {
  currentMission: number;
  currentPage: number;
  evidence: boolean[];
  worldState: number;
  experimentHistory: unknown[];
  comparisonLog: unknown[];
  measurementLog: unknown[];
  retryCount: number;
  hintCount: number;
  explorationStyleStats: Record<string, number>;
  bonusQuest: Record<string, boolean>;
  soundSetting: boolean;
}
```

## 8. 공통 UI
CSS로 처리:
- 버튼
- 패널
- 말풍선
- 탭
- 진행표시
- 모달
- 토스트
- Evidence 슬롯
- 설정창
- 사운드 버튼
- Stage 상태
- 인증서 입력 UI

## 9. 애니메이션
- 2D 캐릭터: 투명 PNG/WEBP 파츠 + CSS/GSAP
- 3D 학생: Rigged GLB
- 3D 학생 애니메이션: Idle, Walk, PushLight, PushHeavy, Pull, PickUp, Place, OperateLever, Celebrate
- 힘 보조 슈트: 학생 GLB 위 장착 파츠

## 10. VFX
- CSS: UI pulse, Evidence glow, unlock
- Phaser: 먼지, 이동선, 수평 성공, 측정 반응
- Three.js: Snap, 코어 점등, 바닥 라인, World Restore
- VFX는 장식이 아니라 행동 결과를 명확히 보여주는 용도로 사용

## 11. 사운드
### BGM
1. Title Lab
2. Mission Map
3. Force Delivery
4. Balance Thinking
5. Measurement Lab
6. Force Workshop
7. Emergency Transport
8. Final Mission
9. Final Report
10. Mission Complete
11. Final Movie

### SFX
tap, save, unlock, hint, crate_move, balance_tilt, zero_beep,
spring, dial_tick, tool_snap, lever, ramp_roll, core_move,
suit_on, machine_start, power_restore, stamp, confetti 등

## 12. 성능
- 태블릿 30fps 이상 목표
- GLB/texture 압축
- 반복 오브젝트 instancing 권장
- Stage 종료 시 geometry/material/texture dispose
- Phaser/Three.js 동시 고부하 렌더링 금지
