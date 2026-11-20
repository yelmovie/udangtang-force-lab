# 01 우당탕 힘 실험실 · 권리 장부 (2026-11-21)

과학34 110점 계획 3-1단계 ④(`_shared/SCORE-110-STAGE31-20261121.md` 32~35행). 운영 빌드(`dist/`)에 들어가는 그림·영상·음악·효과음·목소리·글꼴을 종류별로 묶었다.

- 기준: 저장소 HEAD `cb36ba2`(2026-11-21 07:47), 외장 SSD의 `public/` 실제 파일 319개(`._*` 제외). `src/`에서 직접 import하는 그림·글꼴은 없다(모든 그림·글꼴은 `/assets/…` 경로로 `public/`에서 읽음). 화면 아이콘은 `src/icons.ts` 안의 SVG 코드다.
- 「배포 제외」: `scripts/offline-plugin.mjs` 11~15행 `unusedPublicFiles`가 빌드 뒤 `dist/`에서 지우는 파일(`backgrounds/islands.webp`, Jua 글꼴 2개와 `Jua-OFL.txt`, NanumSquareNeo `.woff` 4개). `public/`에는 남아 있다.
- 영상 `story/*.mp4`, `concepts/*.mp4`: 과제 안내에는 "SSD에만 있음"이라고 했지만, 지금은 git에도 들어가 있다(`.gitignore` 27~28행 예외, `git ls-files`로 확인).
- 근거는 저장소 안 기록(`public/assets/CREDITS.md`, `doc/`, `docs/`, `references/`, `.project-memory/PROJECT_STATE.md`, `.tmp/`의 생성 스크립트)과 `_shared/`의 출처 문서, 그리고 `_shared` 문서가 가리키는 `_scratch/` 원본만 썼다. 추측으로 채우지 않았다.
- 이 장부는 기록이 있는지만 정리한 것이다. 법적 권리 판단은 아니다.

## 상태 기준

| 상태 | 뜻 |
|---|---|
| 확인됨 | 이 파일(묶음)을 콕 집어 만든 도구(또는 제공처)와 날짜를 적은 기록이 있다(CREDITS 개별 행, 출처 JSON, 생성 스크립트·프롬프트, 라이선스 원문 중 하나 이상). 요금제·약관 원문이 없으면 「이용 조건」 칸에 따로 적었다 |
| 근거 약함 | 이 파일을 가리키는 기록은 있지만 도구 이름·원본·프롬프트 중 빠진 것이 있다(도구를 원본 파일 이름으로만 짐작, "추정", 생성 서비스 이름 없음, 누가 만들었는지 없음 등) |
| **출처 미확인** | 이 파일을 콕 집은 기록이 없다. CREDITS의 묶음 문장("생성형 AI로 제작한 보유 이미지")만 있거나 아무 기록도 없다 |

## 1. 그림 — 배경

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 1 | `backgrounds/{lab,cargo,balance,scale,workshop,core}.webp` (6장, 1440×810) | 원본 PNG 파일 이름이 「ChatGPT Image 2026년 9월 22일 오후 …」라 ChatGPT 이미지 생성으로 보임. sharp로 WebP 변환(`scripts/prepare-assets.mjs`) | 원본 시각 2026-09-22. 원본 PNG는 `references/images/`(148장). 프롬프트 기록 없음. 누가 만들었는지(사용자 직접 / 업체 제공) 기록 없음 — 카탈로그는 "보유 자료"라고만 적음 | CREDITS: "앱 제작자 보유. 재배포·상업적 이용 금지". ChatGPT 약관 원문 미보관, 요금제 기록 없음 | `doc/ASSET_CATALOG.md` 3·21~31행, `public/assets/CREDITS.md` 7행 | 근거 약함 (비고: `backgrounds/core.webp`는 화면 코드에서 참조를 못 찾음. 배포본에는 들어감) |
| 2 | `backgrounds/islands.webp` (1440×810) | 1과 같음(원본 `02_09_35 (2)`) | 1과 같음 | 1과 같음 | `doc/ASSET_CATALOG.md` 26행, `scripts/offline-plugin.mjs` 12행 | 근거 약함 · **배포 제외** |
| 3 | `backgrounds/balance-tilt.webp`(1440×810), `rescue-lab.webp`(1600×900), `ending-village.webp`(1600×900) | 기록 없음 | 첫 커밋 `4911934`(2026-10-17)에 처음 들어옴. 원본·프롬프트·생성 도구를 저장소·`references/`·`.tmp/`에서 못 찾음. CREDITS 7행의 묶음 문장만 있음 | 확인 불가 | `public/assets/CREDITS.md` 7행, git `4911934` | **출처 미확인** |
| 4 | `backgrounds/core-hall-v2.webp` (1600×900) | 내장 이미지 생성 도구(`built-in image_gen`) | 2026-10-08. 원본·실제 프롬프트 `references/design/core-studio-v2/` | 프로젝트용 생성. 도구 약관 원문 미보관 | `references/design/core-studio-v2/generation-prompt.json` 2~3행, `doc/ASSET_CATALOG.md` 81행, CREDITS 28행 | 확인됨 |
| 5 | `backgrounds/workshop-clear.webp`(1600×900), `textures/workshop-wood.webp`(512²) | "생성형 AI"(도구 이름 없음) | 2026-10-18(CREDITS). 원본·프롬프트 못 찾음 | 프로젝트용 생성. 약관 원문 미보관 | CREDITS 14행 | 근거 약함 |

## 2. 그림 — 캐릭터·제목

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 6 | `characters/{student,corgi,squirrel}_poses.webp` (3장, 1448×1086 시트) | ChatGPT 이미지로 보이는 원본(`03_26_49 (3)`, `03_26_48 (1)`, `03_26_48 (2)`) | 2026-09-22, 원본 `references/images/`. 프롬프트·제작자 기록 없음 | CREDITS: "앱 제작자 보유". 약관 원문 미보관 | `doc/ASSET_CATALOG.md` 33~35행, CREDITS 8행 | 근거 약함 |
| 7 | `ui/title.webp` (1000×375, 한글 제목 글자 포함) | ChatGPT 이미지로 보이는 원본(`02_09_24 (2)`) | 2026-09-22. 프롬프트 기록 없음 | CREDITS: "생성형 AI 제작, 앱 제작자 보유" | `doc/ASSET_CATALOG.md` 32행, CREDITS 27행 | 근거 약함 |
| 8 | `game/{student,corgi}-{idle,effort,observe,success}.webp` (8장) | ChatGPT 이미지로 보이는 시트 `02_08_03 (3)`에서 잘라냄(`scripts/prepare-game-sprites.mjs`) | 2026-09-22 원본. 프롬프트 기록 없음 | 1과 같음 | `doc/ASSET_CATALOG.md` 43·50행 | 근거 약함 |
| 9 | `game/balance-student.webp`, `game/balance-corgi.webp` | Higgsfield GPT Image 2.5(기존 학생·코기 그림을 참고 이미지로) | 2026-10-18(CREDITS) | 프로젝트용 생성. Higgsfield 요금제·약관 기록 없음 | CREDITS 19행 | 확인됨 |
| 10 | `game/student-cargo-push.webp`(800×666), `game/student-cargo-pull.webp`(800×670) | 기록 없음 | 첫 커밋 `4911934`(2026-10-17). 원본·프롬프트 못 찾음 | 확인 불가 | git `4911934` | **출처 미확인** |
| 11 | `game/workshop-direct-{start,lift}.webp`, `workshop-lever-{easy,hard}.webp`, `workshop-ramp-{easy,hard}.webp` (6장, 420×530) | 기록 없음. CREDITS 9행 묶음 문장("공방 조작 장면 … 기존 시트에서 분리하거나 새로 생성")만 있음 | 첫 커밋 `4911934`(2026-10-17) | 확인 불가 | CREDITS 9행, git `4911934` | **출처 미확인** |
| 12 | `game/workshop-lever-press-{0,1,2,3,4}.webp` (5장, 627²) | "이미지 생성 서비스"(서비스·모델 이름 기록 없음) | 2026-10-12. 원본 `references/animations/lever-press-atlas.png`, `lever-press-low.png`, 생성 지시 요지 기록 | 약관 원문 미보관 | `references/video/20261012/ASSET-NOTES.md` 7·10·12·17행, `doc/reviews/INTERACTION-20261012.md` 30행 | 근거 약함 |
| 13 | `game/workshop-lever-press-{0,1,2}-hard.webp`, `{3,4}-easy.webp` (5장) | Higgsfield GPT Image 2.5로 표정만 편집, 원본 윤곽에 머리만 합성 | 2026-10-18(CREDITS) | 프로젝트용 생성. Higgsfield 요금제 기록 없음 | CREDITS 13행 | 확인됨 |

## 3. 그림 — 실험 소품·카드

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 14 | `game/{scale,tray,wood-block,nut,book,apple,eraser}.webp`(시트 `02_08_02 (1)`), `game/{balance-pan,balance-base,balance-beam,rock}.webp`(`02_08_22 (1)`), `game/crate-empty.webp`(`02_08_41 (1)`) (12장) | ChatGPT 이미지로 보이는 소품 시트에서 잘라냄 | 2026-09-22 원본 `references/images/`. 잘라낸 좌표는 기록, 프롬프트 없음 | 1과 같음 | `doc/ASSET_CATALOG.md` 45~49행, `public/assets/game/manifest.json` | 근거 약함 |
| 15 | `props/core-cargo.webp`, `props/wood-crate.webp` | ChatGPT 이미지로 보이는 시트 `02_07_38 (1)`에서 잘라냄 | 2026-09-22 | 1과 같음 | `doc/ASSET_CATALOG.md` 36~39행 | 근거 약함 |
| 16 | `game/balance-{wood,metal,ceramic}-v2.webp`(384²), `game/balance-lock-pin.webp`(400×180) (4장) | 기록 없음. CREDITS 9행 묶음 문장(「수평대·…·잠금핀」)만 있음 | 첫 커밋 `4911934`(2026-10-17) | 확인 불가 | CREDITS 9행, git `4911934` | **출처 미확인** |
| 17 | `game/cargo-part.webp`, `game/cargo-parts-{1,3,5}.webp` | Higgsfield GPT Image 2.5(투명 배경 너트·볼트) + PIL 배치 합성 | 2026-10-18 | 프로젝트용 생성. Higgsfield 요금제 기록 없음 | CREDITS 16행 | 확인됨 |
| 18 | `game/toolcard-{cargo,balance,scale,workshop,rescue}.webp` (5장, 256²) | Higgsfield GPT Image 2.5 | 2026-10-18 | 위와 같음 | CREDITS 17행 | 확인됨 |
| 19 | `life-tools/*.webp` (8장, 320×240) | Higgsfield GPT Image 2.5(high, 투명), 프롬프트 요지·다시 만든 이유 기록 | 2026-10-19 | 위와 같음 | CREDITS 18행, `doc/ASSET_CATALOG.md` 93~108행 | 확인됨 |
| 20 | `reward-cards/card-{1..5}-*.webp`(640×960), `thumb-{1..5}-*.webp`(96×144) (10장) | ChatGPT 앱의 Codex 내장 이미지 도구(GPT 이미지, `gpt-imagegen` 스킬) | 2026-11-18. 프롬프트 `.tmp/reward-cards/gen-rest.sh` 5행~, 원본 `.tmp/reward-cards/gen/`, 참고 그림 `.tmp/reward-cards/ref/` | 프로젝트용 생성. ChatGPT 요금제 화면·약관 원문 미보관 | CREDITS 48행, `.tmp/reward-cards/gen-rest.sh` 3·5행 | 확인됨 |

## 4. 그림 — 마을 지도(`village/`)

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 21 | 픽셀 마을 팩: `village/terrain.webp`, `buildings/*.webp`(6, `empty.webp`는 투명 빈칸), `student/*.webp`(16), `corgi/*.webp`(16), `props/prop-01~12.webp`, `npc/{guide,wave,think,point}.webp` | 내장 이미지 생성 도구(`built-in image_gen`). 건물 2채는 2026-10-12 다시 그림, 지형은 다시 그린 프롬프트 별도 보관 | 2026-09-22. 원본 `references/pixel-village-v1/raw/`, 프롬프트 `GENERATION.json`·`PROMPTS*.json`·`NPC_PROMPT.txt`·`TERRAIN-REDRAW-PROMPT.txt`·`CHARACTER_REVISION_PROMPT.txt` | `GENERATION.json` 4행: "Original AI-generated assets for this project; Farland Tactics visual reference only"(상업 게임 이름이 화풍 참고로 적혀 있음). `ASSET_SPEC.md` 49행: "추출 기록만으로 법적 권리를 확정하지 않는다". 약관 원문 미보관 | `references/pixel-village-v1/GENERATION.json` 2~4행, `public/assets/village/manifest.json` 1836~1918행(`npc/guide·wave·think·point`의 원본 = `raw/npc-guide.png`), CREDITS 10·25·26행 | 확인됨 (비고: CREDITS 25·26행은 도토리 박사 4장을 "출처 기록 필요"라고 적었지만, `GENERATION.json`의 `npc-guide` 프롬프트와 매니페스트의 `source: raw/npc-guide.png`로 이어짐. 1254² 원본 ÷ 2 = 627² 칸과도 맞음) |
| 22 | `village/npc/baker.webp` | Higgsfield GPT Image 2.5(도토리 박사 그림을 화풍 참고) | 2026-10-17. 작업 원본 `../_tmp_baker/` | 프로젝트용 생성. Higgsfield 요금제 기록 없음 | CREDITS 11행 | 확인됨 |
| 23 | `village/npc/{inspector,clerk,crafter}.webp` | Higgsfield GPT Image 2.5 시트 1장(0.25크레딧) → 분할 | 2026-10-17 | 위와 같음 | CREDITS 12행, `.project-memory/PROJECT_STATE.md` 340행 | 확인됨 |
| 24 | `village/props/request-board.webp` | Higgsfield GPT Image 2.5(high, 투명) | 2026-10-20 | 위와 같음 | CREDITS 24행 | 확인됨 |
| 25 | `village/dialogue/{guide,kong,baker,inspector,clerk,crafter}.webp` (6장, 1024×512 = 입 닫힘·열림 두 칸) | 기록 없음 | 커밋 `db22baa`(2026-11-13 "Add voiced residents and story narration")에 처음 들어옴. CREDITS에 줄 없음, 원본·프롬프트 못 찾음 | 확인 불가 | git `db22baa` | **출처 미확인** |
| 26 | `village/encounters/wheel-lock-atlas.webp` (500×300, 지도 악당·공격·피격 시트) | 시트를 만든 도구 이름 기록 없음(악당 시안은 "Codex 기본 이미지 생성 도구") | 2026-11-14. 원본 `_scratch/villain-resume-20261114/01-atlas-original.png`, 참고 `01-reference.png` | 약관 원문 미보관. CREDITS에 줄 없음 | `_shared/MAP-VILLAINS-HANDOFF-20261114.md` 116행, `_scratch/villain-concepts-20261114/prompts-v2.md` 3행, `.project-memory/PROJECT_STATE.md` 193행 | 근거 약함 |

## 5. 그림 — 걷는 3D 작업장(`run-stage/`)

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 27 | `run-stage/{explorer-walk,explorer-push,explorer-pull,corgi-walk,floor,parts-pile,wall,dock,panel,decor-shelf,decor-barrels,decor-bench,bot-walk}.webp` (13장) | `gpt-imagegen` 스킬(ChatGPT Codex 내장 GPT 이미지). `bot-walk`은 지도 악당 픽셀 그림을 참고 | 2026-11-17. 원본 `references/images/run-stage-20261117/`, 프롬프트 표와 공통 문구 기록, 전문 `.tmp/run-stage/gen-images-2.sh` 등 | 프로젝트용 생성. "ChatGPT 구독 사용량"이라는 기록만 있고 요금제 화면·약관 원문 미보관. CREDITS에 줄 없음 | `docs/RUN-STAGE-3D-PLAN-20261117.md` 168~197행, `docs/RUN-STAGE-3D-HANDOFF-20261117.md` 29·42행, `_shared/RUN-STAGE-3D-PLAN-20261117.md` 108행, `.project-memory/PROJECT_STATE.md` 113행(장식 2장 적용) | 확인됨 |
| 28 | `run-stage/explorer-{idle,jump,cheer}.webp` (3장, 256²) | 새로 만들지 않고 `characters/student_poses.webp`에서 잘라냄 | 2026-11-17 | 6과 같음 | `docs/RUN-STAGE-3D-PLAN-20261117.md` 192행 | 근거 약함(원 그림이 6번 줄) |

## 6. 그림·영상 — 이야기와 개념 영상

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 29 | `story/intro-01~03.webp`, `story/final-01~03.webp` (6장, 1280×720) | "이미지 생성 서비스"(모델명 기록 없음) | 2026-10-12. 원본 PNG·인물 기준표·제작 프롬프트 `references/video/20261012/`(`VIDEO-PROMPTS.md`) | CREDITS: "앱 제작자 보유". 약관 원문 미보관 | CREDITS 20행("생성 모델명은 기록 없음 — 출처 기록 필요"), `references/video/20261012/ASSET-NOTES.md` 5·12·20행 | 근거 약함 |
| 30 | `story/intro.mp4`, `story/ending.mp4` (그림·움직임) | Google Flow(Veo 3.1 Fast), 29번 장면 PNG를 시작 프레임으로. 2026-11-18 자막을 ffmpeg+libass로 입힘(글꼴 Jua) | 2026-10-12 생성, 10-18 재인코딩, 11-18 소리·자막 교체(커밋 `5354c39`). 자막 큐 `docs/film-captions-20261118/` | CREDITS: "Google Flow·Veo 이용 조건과 워터마크 표기를 따름", "화면 오른쪽 아래에 Veo 워터마크가 남아 있음"(11-18 판에서 지웠다는 기록 없음). Google 요금제 화면·약관 원문 미보관 | CREDITS 21행, `docs/film-captions-20261118/01-intro.ass`(Style: Jua) | 확인됨 |
| 31 | `concepts/{cargo,balance,scale,workshop,rescue}.{webp,mp4,webm}` (15개) | 직접 코딩한 SVG 장면 → sharp → FFmpeg(`tools/concept-clips/`). 2026-11-19 자막 입힘(글꼴 Jua) | 2026-10-16 제작, 10-19 다시 렌더, 11-19 자막판(커밋 `929310d`). 큐 `docs/concept-captions-20261118/` | CREDITS: "앱 제작자 보유. 제작 도구에 상업 제한 라이선스 없음" | CREDITS 23행, `docs/concept-captions-20261118/balance.ass`(Style: Jua) | 확인됨 |

## 7. 3D 모델

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 32 | `models/core/core.glb`, `models/core/dock.glb` | Meshy(사용자가 생성해 전달) → 축소 | 2026-10-08. 원본 `references/models/original/`, Meshy 원 이름·변환 기록 `references/models/README.md`, 입력 그림 `references/meshy/` | CREDITS: "Meshy 계정의 생성·이용 조건은 별도 확인. CC0 등 별도 라이선스를 추정하지 않음" — 요금제 미확인 | `references/models/README.md` 3~8행, CREDITS 29행 | 확인됨(이용 조건 미확인) |
| 33 | `models/workshop/fulcrum.glb`, `crate.glb` | 컨셉 그림 → Meshy image-to-3D → Blender 축소 | 2026-10-18(CREDITS). Meshy 원본·입력 그림은 못 찾음 | 32와 같음 | CREDITS 15행 | 확인됨(원본 미보관, 이용 조건 미확인) |

## 8. 그림 — 아이콘·공유 그림

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 34 | `favicon.svg`, `icons/icon-192.png`, `icons/icon-512.png` | 직접 그린 SVG 플라스크(PNG는 변환) | 커밋 `6e2d035`(2026-10-18) | 앱 제작자 보유 | CREDITS 50행 | 확인됨 |
| 35 | `src/icons.ts` 안 SVG 선 아이콘 | 직접 그림 | — | 앱 제작자 보유 | CREDITS 51행 | 확인됨 |
| 36 | `og-image.jpg` (지금 1200×600, 제목 글자가 그려진 3D 카툰 그림) | 기록 없음 | 커밋 `0cc485c`(2026-10-29 "OG 이미지 교체: 나무 간판형 썸네일(1200x600)"). CREDITS 52행은 2026-10-19의 옛 합성본(`lab.webp`+`title.webp`, 1200×630)을 적고 있어 지금 파일과 다름 | 확인 불가 | CREDITS 52행, git `0cc485c` | **출처 미확인** |

## 9. 음악

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 37 | `audio/bgm-stage.mp3`(Curious Discovery), `audio/bgm-ending.mp3`(Magical Power-Up) | Suno(사용자가 생성해 전달, 연주곡) | 2026-10-19. 곡 링크·생성 기록 파일 없음 | Suno Premier(유료) — 2026-11-18 사용자 말로 확인. 요금제 화면·약관 원문 미보관 | CREDITS 30행, `_shared/voice-provenance-20261118.md` 10행 | 확인됨 |

## 10. 효과음

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 38 | `audio/{click_003,error_001,confirmation_002}.ogg` | Kenney — Interface Sounds | 원 ZIP `references/audio/kenney-interface-sounds.zip` | CC0 1.0. 원문 `audio/LICENSE-Kenney.txt` 동봉(배포본에 들어감) | CREDITS 31행, `doc/ASSET_CATALOG.md` 58~69행 | 확인됨 |
| 39 | `audio/sfx/*.mp3` (16개: freesound 13개, Kenney Impact·Interface 3개) | 과학34 공통 효과음 라이브러리에서 복사(앞뒤 무음 제거·음량 정규화) | 2026-11-17·19. 파일마다 원작자·원 페이지 주소 기록 | CC0 1.0(원본 페이지 2026-11-17 재확인). 16개 모두 `_shared/sfx-library-20261117/sfx/`의 같은 이름 파일과 바이트가 같음(이번에 `cmp`로 확인) | CREDITS 32~47행, `_shared/sfx-library-20261117/CREDITS.md` | 확인됨 |

## 11. 목소리

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 40 | `audio/npc-dialogue/guide-*.mp3`(6), `*-request.mp3`(4), `*-thanks.mp3`(4) (14개) | ElevenLabs `eleven_v4`. 도토리 박사 Grandfather Namchun, 의뢰인 4명 수진·Harry·Bee·Klamon | 2026-11-13. 줄마다 대본·generationId·sha256 기록. **14개 해시가 지금 파일과 모두 일치**(이번에 확인) | 생성 당시 ElevenLabs Starter(유료) — 사용자 확인. 이 기록 파일에는 요금제 문구가 없음. 약관 원문 미보관. CREDITS에 줄 없음 | `docs/npc-dialogue-voice.json`, `_shared/voice-provenance-20261118.md` 9·21~29·151행 | 확인됨 |
| 41 | `audio/npc-dialogue/*-mission·*-discovery·*-return·locked-*.mp3`(20), `audio/concept/*.mp3`(15), `audio/villain/*.mp3`(25), `audio/npc-welcome-el.mp3`(1) (61개) | ElevenLabs `eleven_v4`. 도토리 박사 Grandfather Namchun, 콩이 sena - Friendly, Cheerful, 바퀴 잠금 악당 Man Bo | 2026-11-18. 줄마다 기록. **61개 해시 모두 일치**(이번에 확인) | "Creator 유료 요금제, 상업 이용 가능"(기록 파일 4행). 요금제 화면·약관 원문 미보관. CREDITS에 줄 없음 | `docs/VOICE-FILL-20261118.json` 4행~, `_shared/voice-provenance-20261118.md` 9행 | 확인됨 |
| 42 | 이야기 영상 대사(`story/intro.mp4`·`ending.mp4` 안의 소리, 6줄) | ElevenLabs `eleven_v4`(도토리 박사 Namchun, 콩이 sena) | 2026-11-18. 줄마다 generationId·대본 | Creator(유료) — 41과 같음 | `docs/story-voice-20261118.json`, CREDITS 22행 | 확인됨 |
| 43 | `audio/npc-welcome.mp3` | Qwen3-TTS 12Hz 1.7B CustomVoice(로컬 실행, 기본 합성 음성 Sohee, 리비전 `0c0e3051…`) | 2026-11-09. 대본·시드·해시 기록, **해시 일치**(이번에 확인) | 모델 라이선스 Apache-2.0. 기록 문서가 "모델 라이선스와 출력물 권리는 구분한다"고 적음. 2026-11-18부터 앱에서 재생하지 않지만 배포본에 들어가고 서비스워커 첫 화면 캐시에 들어감(`scripts/offline-plugin.mjs` 45행) | `docs/audio-provenance.json`, `docs/AUDIO-PROVENANCE-20261109.md` 9~15·28~30행 | 확인됨 |

## 12. 글꼴

| # | 파일(묶음) | 만든 곳 | 만든 날·기록 위치 | 이용 조건 | 근거 파일 경로 | 상태 |
|---|---|---|---|---|---|---|
| 44 | `fonts/NanumSquareNeo-{Regular,Bold,ExtraBold,Heavy}.woff2`, `fonts/NanumSquareNeo-OFL.txt` | 네이버 나눔스퀘어 네오. 네이버 한글 웹폰트 `.woff`를 받아 같은 글꼴의 WOFF2로 변환(커밋 `e3c14cb`, 2026-11-14) | 원문 확인일 2026-11-10, 받은 주소 4개 기록 | SIL OFL 1.1(예약 글꼴 이름 "NanumSquareNeo" 등). 원문 동봉(배포본에 들어감). CREDITS에는 이 글꼴 줄이 없음(49행은 옛 Jua) | `public/assets/fonts/NanumSquareNeo-OFL.txt` 1~8·35·37행, `docs/FONT-QA-20261111.md` | 확인됨 |
| 45 | `fonts/NanumSquareNeo-{Regular,Bold,ExtraBold,Heavy}.woff` | 44와 같은 원본 | 44와 같음 | 44와 같음 | `scripts/offline-plugin.mjs` 14행 | 확인됨 · **배포 제외** |
| 46 | `fonts/jua-korean-400.woff2`, `fonts/jua-latin-400.woff2`, `fonts/Jua-OFL.txt` | Jua, Woowahan Brothers Corp.(Google Fonts 배포본) | — | SIL OFL 1.1, 예약 글꼴 이름 "Jua". 파일은 배포 제외지만, Jua 글자는 이야기 영상·개념 영상 자막에 그림으로 들어가 있음(30·31번 줄) | CREDITS 49행, `public/assets/fonts/Jua-OFL.txt` 1~4행, `scripts/offline-plugin.mjs` 13행 | 확인됨 · **배포 제외** |

배포본에 함께 들어가는 문서: `assets/CREDITS.md`, `assets/audio/LICENSE-Kenney.txt`, `assets/fonts/NanumSquareNeo-OFL.txt`. 데이터 파일(`manifest.json`, `world-map.json`, `manifest.webmanifest`)은 그림·소리가 아니라 장부에서 뺐다.

## CREDITS.md와 어긋나거나 빠진 것 (고치지 않고 적기만 함)

- `og-image.jpg`: CREDITS 52행은 2026-10-19 합성본(1200×630). 지금 파일은 2026-10-29에 바꾼 1200×600 그림이고 기록이 없다.
- 도토리 박사 `npc/guide·wave·think·point`: CREDITS 25·26행은 "출처 기록 필요"라고 적었지만 `references/pixel-village-v1/GENERATION.json`의 `npc-guide` 프롬프트로 이어진다.
- CREDITS에 줄이 없는 것: 나눔스퀘어 네오 글꼴, 마을 대화 목소리 14개·채움 목소리 61개·옛 Qwen3 인사 1개, `run-stage/` 16장, `village/dialogue/` 초상 6장, `village/encounters/wheel-lock-atlas.webp`.
- CREDITS 49행은 Jua를 "제목·버튼 글꼴"이라고 적었지만 지금은 화면에서 쓰지 않고 배포에서도 빠진다(영상 자막에만 그림으로 남음).
- 마을 팩 생성 기록(`GENERATION.json` 4행)에 화풍 참고로 상업 게임 이름(Farland Tactics)이 적혀 있다. 판매 전에 알아 둘 내용으로 적어 둔다.

## 개수

- 장부 줄: **46줄**
- 확인됨 **28줄** · 근거 약함 **12줄** · **출처 미확인 6줄**(3·10·11·16·25·36번, 그림 **22장**)
- 이 중 배포 제외 3줄(2·45·46번)

## 사용자가 줘야 하는 자료

1. **`village/dialogue/` 대화 초상 6장**(2026-11-13): 만든 도구·날짜·프롬프트. 없으면 3-3단계에서 새로 만들어 교체(`docs/reviews/IMAGE-NEEDS-20261121.md` 가-1~6).
2. **`og-image.jpg`(2026-10-29 교체본)**: 만든 도구와 기록.
3. **첫 커밋(2026-10-17) 전에 만든 그림 15장**: `backgrounds/balance-tilt·rescue-lab·ending-village`, `game/student-cargo-push·pull`, `game/workshop-direct-*·workshop-lever-easy·hard·workshop-ramp-*`, `game/balance-*-v2`·`balance-lock-pin`. 만든 도구와 원본. 업체(아이스크림미디어)에게서 받은 그림이면 계약서나 메일.
4. **`references/images/`의 「ChatGPT Image 2026년 9월 22일」 원본 148장**: 사용자가 직접 ChatGPT로 만들었는지, 업체가 준 "보유 자료"인지. 업체 자료면 계약서나 메일, 직접 만들었으면 그때의 ChatGPT 요금제 화면. 배경 6장·캐릭터 시트·제목·소품 등 근거 약함 줄 대부분이 여기에 걸려 있다.
5. **ChatGPT 요금제 화면**(내장 이미지 생성·Codex `gpt-imagegen`): 2026-09-22 마을 팩, 10-08 동력실 배경, 11-17 작업장 그림, 11-18 성취 카드.
6. **Higgsfield 요금제 화면·이용 약관**(2026-10-17~20 생성분: 의뢰인 NPC, 도구 카드, 생활 도구, 부품, 공방 표정, 의뢰 게시판).
7. **Google Flow(Veo 3.1 Fast) 요금제 화면·이용 조건**(2026-10-12 이야기 영상 2편). 워터마크를 남긴 채 판매해도 되는지, 워터마크 없는 판이 있는지.
8. **Meshy 요금제 화면·상업 이용 조건**(2026-10-08 코어·중앙 장치, 2026-10-18 공방 받침대·화물). 공방 GLB 2개의 Meshy 원본.
9. **Suno Premier 요금제 화면과 곡 링크**(2026-10-19 생성 배경음 2곡).
10. **ElevenLabs 요금제 화면이나 영수증**: Starter(2026-11-13 생성분)와 Creator(2026-11-18 생성분).
11. **도구 이름만 빠진 것**: 지도 악당 시트(2026-11-14), 이야기 장면 6장·지레 기본 5프레임(2026-10-12 "이미지 생성 서비스"), 공방 빈 배경·나무 결(2026-10-18 "생성형 AI").
12. 위 도구들 약관 원문은 저장소에 한 건도 보관되어 있지 않다(F11 감점 사유와 같음). 받으면 `doc/licenses/`처럼 한곳에 모아 두는 것을 권한다.
