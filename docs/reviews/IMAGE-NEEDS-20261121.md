# 01 우당탕 힘 실험실 · 새 그림이 필요한 자리 (2026-11-21)

과학34 110점 계획 3-1단계 ⑤(`_shared/SCORE-110-STAGE31-20261121.md` 37~38행). 이 단계에서는 그림을 만들지 않는다. 사용자 결정(2026-11-21 "추천대로"): 출처 모르는 옛 그림은 **자료가 있으면 장부에 연결하고, 없으면 새로 만들어 교체**한다(3-3단계).

- 기준: HEAD `cb36ba2`, 권리 장부 `docs/RIGHTS-LEDGER-20261121.md`, 할 일 목록 `docs/reviews/SCORE-100-TODO-20261120.md`.
- 크기는 `sips`로 잰 실제 픽셀이고, 화면에 보이는 크기는 CSS·TS 값으로 계산했다. 브라우저에서 흐림을 직접 비교하지는 않았다.
- 교체할 때 공통: 지금 파일과 같은 경로·같은 크기(또는 같은 비율로 더 크게)·투명 여부를 지킨다. 균형 다리·물자 배송소·운반 공방 그림은 「자동으로 보기」에서도 같은 파일을 쓰므로(`AGENTS.md` E-1) 발 기준선·여백·얼굴 위치를 지금과 맞추고, 교체 전후를 별도 테스트 저장으로 비교한다.
- 화풍 참고는 기록이 확인된 그림을 먼저 적었다(권리 장부 「확인됨」 줄).

## 요약

| 갈래 | 장수 |
|---|---|
| (가) 권리 장부에서 출처 미확인인 그림 | **22장** |
| (나) 해상도가 튀는 그림 | **3장** |
| (다) 할 일 목록의 게임성·화면 보강용 소품·배경 | **없음** |

## (가) 출처 미확인 그림 — 22장

사용자가 원본·생성 기록·업체 계약을 주면 장부에 연결하고 교체하지 않아도 된다(권리 장부 「사용자가 줘야 하는 자료」 1~3번).

| # | 쓰이는 화면 | 지금 파일 | 필요한 크기·비율 | 화풍을 맞출 참고 그림 경로 | 왜 필요한지 |
|---|---|---|---|---|---|
| 가-1 | 마을 대화창의 도토리 박사 말하는 초상(`src/npcDialogueVoice.ts` 10행, 두 칸을 번갈아 입 모양: `src/npcDialogue.css` 36·38~39행) | `public/assets/village/dialogue/guide.webp` 1024×512 | 1024×512(512×512 두 칸: 왼쪽 입 닫힘, 오른쪽 입 열림, 나머지는 같게), 투명 배경, 상반신 | 생김새: `public/assets/village/npc/guide.webp`(마을 팩, 확인됨). 화풍: `public/assets/reward-cards/card-1-cargo.webp`(확인됨) 또는 지금 초상 구도 | 생성 기록 없음(커밋 `db22baa`, 2026-11-13). CREDITS에도 줄 없음 |
| 가-2 | 마을 대화창의 콩이 초상 | `village/dialogue/kong.webp` 1024×512 | 가-1과 같음 | `public/assets/game/balance-corgi.webp`(확인됨), `public/assets/reward-cards/card-1-cargo.webp` | 가-1과 같음 |
| 가-3 | 빵집 주인 대화 초상(왼쪽 초상은 CSS로 좌우 뒤집어 씀: `src/npcDialogue.css` 135행) | `village/dialogue/baker.webp` 1024×512 | 가-1과 같음. 얼굴 방향을 지금과 같게 | `public/assets/village/npc/baker.webp`(Higgsfield, 확인됨) | 가-1과 같음 |
| 가-4 | 다리 점검원 대화 초상(뒤집어 씀) | `village/dialogue/inspector.webp` 1024×512 | 가-3과 같음 | `public/assets/village/npc/inspector.webp`(확인됨) | 가-1과 같음 |
| 가-5 | 보급소 직원 대화 초상 | `village/dialogue/clerk.webp` 1024×512 | 가-1과 같음 | `public/assets/village/npc/clerk.webp`(확인됨) | 가-1과 같음 |
| 가-6 | 공방 친구 대화 초상(뒤집어 씀) | `village/dialogue/crafter.webp` 1024×512 | 가-3과 같음 | `public/assets/village/npc/crafter.webp`(확인됨) | 가-1과 같음 |
| 가-7 | 카카오톡·SNS 공유 미리보기(`index.html` og:image) | `public/og-image.jpg` 1200×600 JPEG(201 KB) | 1200×630(1.91:1) 또는 지금처럼 1200×600, JPEG 300 KB 이하. 제목 글자는 그림 생성에 맡기지 않고 합성하는 편이 한글 오류가 없다 | `public/assets/reward-cards/card-1-cargo.webp`(주인공·콩이, 확인됨), `public/assets/backgrounds/core-hall-v2.webp`(확인됨) | 2026-10-29 교체본(`0cc485c`)의 생성 기록 없음. CREDITS 52행은 옛 합성본을 적고 있음 |
| 가-8 | 균형 다리 실험 바탕(`src/balance.css` 13행) | `public/assets/backgrounds/balance-tilt.webp` 1440×810 | 1600×900(16:9) 이상, 가운데 원형 단 자리 비움(수평대를 코드로 올림), 글자 없음 | `public/assets/backgrounds/core-hall-v2.webp`(확인됨), 같은 방 구도는 `backgrounds/balance.webp` | 첫 커밋(2026-10-17) 전 그림, 도구·원본 없음 |
| 가-9 | 중앙 코어 2D 화면 바탕(`src/screens/rescue.css` 18행)과 이야기 장면 카드 1(`src/polish.css` 394행) | `backgrounds/rescue-lab.webp` 1600×900 | 1600×900, 가운데 바닥 비움(코어·빗면은 코드로 올림), 글자 없음 | `public/assets/backgrounds/core-hall-v2.webp`(같은 동력실 계열, 확인됨) | 가-8과 같음 |
| 가-10 | 이야기 장면 카드 기본 바탕(`src/polish.css` 393행) | `backgrounds/ending-village.webp` 1600×900 | 1600×900, 위아래 어둡게 덮으므로 가운데에 마을 | `public/assets/village/terrain.webp`(마을 배치, 확인됨), 화풍 `public/assets/backgrounds/core-hall-v2.webp` | 가-8과 같음 |
| 가-11 | 균형 다리 접시에 올리는 나무 블록(`src/data.ts` 22행, 화면 68~100px) | `game/balance-wood-v2.webp` 384×384 | 384×384, 투명 배경, 정면 약간 위 | `public/assets/game/toolcard-balance.webp`(Higgsfield, 확인됨), `public/assets/game/cargo-part.webp` | 가-8과 같음. 세 블록 크기·시점을 함께 맞춰야 함 |
| 가-12 | 균형 다리 금속 블록(`src/data.ts` 23행) | `game/balance-metal-v2.webp` 384×384 | 가-11과 같음 | 가-11과 같음 | 가-11과 같음 |
| 가-13 | 균형 다리 도자기 블록(`src/data.ts` 24행) | `game/balance-ceramic-v2.webp` 384×384 | 가-11과 같음 | 가-11과 같음 | 가-11과 같음 |
| 가-14 | 균형 다리 잠금핀 버튼(`src/screens/balance.ts` 96행) | `game/balance-lock-pin.webp` 400×180 | 400×180, 투명, 고리가 왼쪽·핀이 오른쪽(오른쪽으로 뽑는 동작) | `public/assets/game/toolcard-balance.webp`, `public/assets/game/cargo-part.webp`(금속 질감) | 가-8과 같음 |
| 가-15 | 물자 배송소 상자를 미는 학생(`src/screens/cargo.ts` `imagePath`) | `game/student-cargo-push.webp` 800×666 | 800×666, 투명, 지금과 같은 발 기준선·배율 | `public/assets/game/balance-student.webp`(같은 학생 새 자세, Higgsfield, 확인됨), `public/assets/reward-cards/card-1-cargo.webp` | 가-8과 같음 |
| 가-16 | 물자 배송소 당기는 학생 | `game/student-cargo-pull.webp` 800×670 | 800×670, 가-15와 같음 | 가-15와 같음 | 가-8과 같음 |
| 가-17 | 운반 공방 2D: 직접 들기 시작 자세(`src/screens/workshop.ts` 52·217행) | `game/workshop-direct-start.webp` 420×530 | 420×530, 투명, 여섯 장 같은 배율·발 위치 | `public/assets/game/workshop-lever-press-0-hard.webp`(같은 자세 계열 표정 편집본, Higgsfield, 확인됨), `public/assets/game/balance-student.webp` | 가-8과 같음. 여섯 장이 한 세트라 함께 교체 |
| 가-18 | 운반 공방 2D: 직접 들어 올린 자세 | `game/workshop-direct-lift.webp` 420×530 | 가-17과 같음 | 가-17과 같음 | 가-17과 같음 |
| 가-19 | 운반 공방 2D: 빗면 쉬움(`workshop.ts` 217행) | `game/workshop-ramp-easy.webp` 420×530 | 가-17과 같음 | 가-17과 같음 | 가-17과 같음 |
| 가-20 | 운반 공방 2D: 빗면 힘듦 | `game/workshop-ramp-hard.webp` 420×530 | 가-17과 같음 | 가-17과 같음 | 가-17과 같음 |
| 가-21 | 운반 공방 힘 표정 원(얼굴 부분만 175%로 잘라 64px 원에 넣음: `src/workshop.css` 231행) | `game/workshop-lever-easy.webp` 420×530 | 420×530, 얼굴이 지금과 같은 자리(가로 32%·세로 4% 기준)에 오게 | 가-17과 같음 | 가-17과 같음 |
| 가-22 | 운반 공방 힘든 표정 원(`src/workshop.css` 232행) | `game/workshop-lever-hard.webp` 420×530 | 가-21과 같음 | 가-17과 같음 | 가-17과 같음 |

## (나) 해상도가 튀는 그림 — 3장

모두 첫 화면(시작 화면)이다. 원 그림은 권리 장부에서 「근거 약함」(ChatGPT 이름의 2026-09-22 원본)이라, 새로 만들면 출처 문제도 함께 풀린다. 원본 시트(`references/images/`)에서 더 크게 다시 잘라 쓰는 길도 있지만 원본 칸도 최대 약 362px 너비라 아래 크기에는 못 미친다.

| # | 쓰이는 화면 | 지금 파일 | 필요한 크기·비율 | 화풍을 맞출 참고 그림 경로 | 왜 필요한지 |
|---|---|---|---|---|---|
| 나-1 | 시작 화면 왼쪽 학생(`src/polish.css` 220·240행: 너비 `clamp(150px, min(22vw,40vh), 380px)`) | `public/assets/game/student-idle.webp` 220×326 | 760×1126 이상(최대 표시 380px의 2배), 투명 배경, 같은 자세·발 기준 | `public/assets/game/balance-student.webp`(436×600, 확인됨), `public/assets/characters/student_poses.webp` | 표시 너비 1280×800에서 약 282px, 1920×1080에서 380px → 원본보다 1.3~1.7배 확대, 화면 배율 2인 태블릿에서는 2.6~3.5배 |
| 나-2 | 시작 화면 오른쪽 콩이(`src/polish.css` 221·234·241행: 너비 `clamp(170px, min(23vw,43vh), 400px)`) | `public/assets/game/corgi-idle.webp` 190×191 | 800×800 이상(최대 표시 400px의 2배), 투명, 정사각 | `public/assets/game/balance-corgi.webp`(460×600, 확인됨), `public/assets/characters/corgi_poses.webp` | 1280×800에서 약 294px, 1920×1080에서 400px → 1.5~2.1배 확대(배율 2 태블릿 3~4배) |
| 나-3 | 시작 화면 제목 로고(`src/polish.css` 213행: 너비 `min(78vw, 1150px)`) | `public/assets/ui/title.webp` 1000×375(한글 글자가 그림에 들어 있음) | 2300×863 이상(8:3, 최대 표시 1150px의 2배), 투명 배경. 한글 글자는 생성 그림에 맡기지 말고 글꼴·벡터로 합성하는 편이 안전 | 지금 `public/assets/ui/title.webp`(배치·색), `public/assets/reward-cards/card-1-cargo.webp`(질감) | 1280×800에서 약 998px(1배), 1920×1080 전자칠판에서 1150px(1.15배), 배율 2 태블릿에서 2~2.3배 확대 |

### 살펴봤지만 새 그림까지는 필요 없다고 본 것 (개수에 넣지 않음)

| 파일 | 본 것 | 판단 |
|---|---|---|
| `backgrounds/*.webp` 1440×810(배포되는 7장) | 전자칠판 1920×1080 전체 화면에서 1.33배 확대 | 모든 배경이 같은 수준이라 혼자 튀지 않음. 선택 과제 |
| `game/balance-beam.webp` 163×51 | 수평대 판(보드 너비 70%, 높이 24px)에 늘려 씀(`src/balance.css` 19~21행) | 무늬 없는 나무색 띠라 늘어난 티가 적음. 고친다면 새 그림보다 CSS 반복 무늬가 간단 |
| `village/buildings/empty.webp` | 완전 투명(매니페스트 2053행 경고) | 빈 건물 자리용 의도된 빈칸 |
| `reward-cards/thumb-*.webp` 96×144 | 보관함 칸 26×38px로 표시 | 충분 |
| `game/toolcard-*.webp` 256², `life-tools/*.webp` 320×240 | 최대 220px, 160×120으로 표시 | 충분(2배 안쪽) |
| 마을 픽셀 그림 / 대화 초상 / 실험 화면 3D 카툰 | 화풍이 셋으로 나뉨 | 마을은 의도한 픽셀 화풍(`references/pixel-village-v1/`). 대화 초상은 (가)에서 다시 만들 때 실험 화면 화풍에 맞출지 정하면 됨 |

## (다) 게임성·화면 보강용 소품·배경 — 없음

`docs/reviews/SCORE-100-TODO-20261120.md`에 A17·C14 같은 게임성·화면 보강 줄이 없다. 「수정으로 풀 것」은 "남은 줄 없음"(30~32행)이고, 「다음 단계에서 할 것」 표의 그림 관련 줄은 「출처 모르는 옛 그림」(46행) 하나뿐이며 그것은 위 (가)다.

## 3-2a 대조 뒤 (2026-11-21 09시)

Codex·Claude Code 생성 기록과 대조해도 (가) 22장의 기록을 찾지 못해 장수는 **22장 그대로**다(근거: `docs/RIGHTS-LEDGER-20261121.md` 끝 「3-2a 대조 결과」). 사용자가 「이미지는 다 코덱스로 만들었어」를 01에도 적용해도 된다고 확인하면 (가)는 0장이 되고 새로 그릴 그림은 (나) 3장만 남는다.
