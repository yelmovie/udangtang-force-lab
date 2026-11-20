# 에셋 출처와 라이선스 — 우당탕 힘 실험실

기획·제작: 옐샘 & ⓒ 아이스크림미디어

| 구분 | 경로 | 출처 · 제작 방식 | 라이선스 · 조건 |
|---|---|---|---|
| 배경 그림 (첫 이야기·실험실·배송실·균형실·측정실·공방·코어·마지막 마을) | `backgrounds/*.webp` | 생성형 AI로 제작한 보유 이미지, WebP 최적화 | 앱 제작자 보유. 재배포·상업적 이용 금지 |
| 캐릭터 포즈 시트 (학생·코기·다람쥐) | `characters/*.webp` | 생성형 AI 제작 시트를 분할 | 앱 제작자 보유 |
| 실험 소품 (상자·부품·저울·수평대·모형·잠금핀·공방 조작 장면) | `game/*.webp`, `props/*.webp` | 기존 생성형 AI 제작 시트에서 분리하거나 이번 화면에 맞춰 새로 생성 | 앱 제작자 보유 |
| 마을 지도·건물·NPC·걷기 프레임 | `village/**` | 생성형 AI 픽셀아트 (원본 `raw/`는 `doc/asset-review` 기록) | 앱 제작자 보유 |
| 빵집 주인 NPC | `village/npc/baker.webp` | 2026-10-17 Higgsfield GPT Image 2.5로 생성(도토리 박사 그림을 화풍 참고로 사용) 후 627px 칸·발끝 기준점에 맞춤 | 프로젝트를 위해 생성한 이미지 |
| 다리 점검원·보급소 직원·공방 친구 NPC | `village/npc/inspector.webp`, `clerk.webp`, `crafter.webp` | 2026-10-17 Higgsfield GPT Image 2.5로 세 명을 한 장의 시트로 생성(도토리 박사·빵집 주인 그림을 화풍 참고) 후 흰 배경 제거, 627px 칸·발끝 기준점에 맞춰 분할 | 프로젝트를 위해 생성한 이미지 |
| 운반 공방 지레 표정 변형 | `game/workshop-lever-press-{0,1,2}-hard.webp`, `game/workshop-lever-press-{3,4}-easy.webp` | 2026-10-18 Higgsfield GPT Image 2.5로 기존 자세 그림의 표정만 편집한 뒤, 원본 윤곽(투명도)에 머리 부분만 합성 | 프로젝트를 위해 생성한 이미지 |
| 운반 공방 배경·나무 결 | `backgrounds/workshop-clear.webp`, `textures/workshop-wood.webp` | 2026-10-18 생성형 AI로 기존 공방 배경에서 시소·지렛대 그림을 지우고 새로 만든 나무 결 텍스처 | 프로젝트를 위해 생성한 이미지 |
| 운반 공방 받침대·화물 3D | `models/workshop/fulcrum.glb`, `crate.glb` | 2026-10-18 컨셉 그림을 Meshy image-to-3D로 변환 후 블렌더로 삼각형 2,500개·텍스처 512로 축소 | Meshy 계정의 생성·이용 조건은 별도 확인. CC0 등 별도 라이선스를 추정하지 않음 |
| 배송소 금속 부품(1·3·5개) | `game/cargo-part.webp`, `game/cargo-parts-{1,3,5}.webp` | 2026-10-18 Higgsfield GPT Image 2.5로 너트·볼트 한 개를 투명 배경으로 생성한 뒤 PIL로 1·3·5개 배치 합성 | 프로젝트를 위해 생성한 이미지 |
| 도구 카드 그림 5종 (밀기 장갑·수평대·전자저울·지레와 빗면 판·코어) | `game/toolcard-{cargo,balance,scale,workshop,rescue}.webp` | 2026-10-18 Higgsfield GPT Image 2.5로 투명 배경 생성(배송소 부품·코기 그림을 화풍 참고) 후 PIL로 알파 기준 크롭, 256px WebP | 프로젝트를 위해 생성한 이미지 |
| 생활 속 도구 그림 카드 8장 (빗면: 미끄럼틀·휠체어 경사로·지그재그 산길·트럭 경사판 / 지레: 병따개·시소·장도리·가위) | `life-tools/{slide,wheelchair-ramp,mountain-road,truck-ramp,bottle-opener,seesaw,claw-hammer,scissors}.webp` | 2026-10-19 Higgsfield GPT Image 2.5(high, 투명 배경)로 생성(도구 카드 `toolcard-workshop`·`toolcard-cargo` 그림을 화풍 참고). 받침점처럼 보이던 경사로·트럭 경사판, 자세가 틀린 장도리, 렌치처럼 보이던 병따개는 다시 생성. 알파 기준 크롭 후 sharp로 320×240 WebP. 그림에 글자 없음(이름은 화면 DOM 라벨) | 프로젝트를 위해 생성한 이미지 |
| 균형 다리 동반자(양손 무게 비교 학생·앞발 벌린 코기) | `game/balance-student.webp`, `game/balance-corgi.webp` | 2026-10-18 Higgsfield GPT Image 2.5로 기존 학생·코기 그림을 참고 이미지로 넣어 같은 캐릭터의 새 자세를 투명 배경으로 생성, PIL로 알파 크롭·600px 축소 | 프로젝트를 위해 생성한 이미지 |
| 첫 이야기·마지막 이야기 장면 그림 6장 | `story/intro-01~03.webp`, `story/final-01~03.webp` | 2026-10-12 이미지 생성 서비스로 제작한 PNG(인물 기준표 포함)를 WebP로 변환. 원본·프롬프트는 `references/video/20261012/` (생성 모델명은 기록 없음 — 출처 기록 필요) | 앱 제작자 보유 |
| 프롤로그 영상 `intro.mp4`·점등식 영상 `ending.mp4` | `story/intro.mp4`, `story/ending.mp4` | 2026-10-12 Google Flow(Veo 3.1 Fast)로 위 장면 PNG를 시작 프레임 삼아 생성·편집(각 16초). 화면 오른쪽 아래에 Veo 워터마크가 남아 있음. 2026-10-18 H.264 crf 26·1280px·AAC 96k로 재인코딩(원본은 `_scratch/video-orig/`) | 생성형 AI 영상. Google Flow·Veo 이용 조건과 워터마크 표기를 따름 |
| 이야기 영상 대사 음성(2026-11-18 교체) | `story/intro.mp4`, `story/ending.mp4`의 소리 | ElevenLabs eleven_v4로 생성. 도토리 박사는 `Grandfather Namchun`(마을 대화와 같은 목소리), 콩이는 `sena - Friendly, Cheerful`. 장면을 대사 길이에 맞춰 늘리고(18초·21.2초) 내레이션 전 배경 소리와 합침. 대본·생성 ID·음성 인식 대조는 `docs/story-voice-20261118.json` | ElevenLabs 유료 요금제 이용 조건을 따름 |
| 개념 클립 5편(배송소·균형·저울·공방·코어) | `concepts/{cargo,balance,scale,workshop,rescue}.{webp,mp4,webm}` (15개) | 2026-10-16 직접 코딩한 SVG 장면. 2026-10-19 Remotion 없이 다시 렌더: SVG 프레임 → sharp(Apache-2.0, librsvg) → FFmpeg(로컬 개발 도구, 배포물에 미포함)로 WebM·MP4 인코딩(`tools/concept-clips/`, `npm run concepts:render`). webp는 마지막 프레임 포스터 | 앱 제작자 보유. 제작 도구에 상업 제한 라이선스 없음 |
| 의뢰 게시판 | `village/props/request-board.webp` | 2026-10-20 Higgsfield GPT Image 2.5(high, 투명 배경)로 생성(마을 소품 그림 4종을 화풍 참고). 알파 기준 크롭 후 240px WebP. 글자 없음, 의뢰 쪽지는 코드로 그림 | 프로젝트를 위해 생성한 이미지 |
| 도토리 박사 NPC | `village/npc/guide.webp` | 마을 픽셀아트 NPC 시트에서 분리(생성형 AI 제작 추정). 원본 시트 검수 기록은 `doc/asset-review` — 출처 기록 필요 | 앱 제작자 보유 |
| 도토리 박사 손 흔들기·생각·가리키기 변형 | `village/npc/wave.webp`, `think.webp`, `point.webp` | 도토리 박사 그림의 자세 변형(생성형 AI 제작 추정). 개별 생성 기록 없음 — 출처 기록 필요 | 앱 제작자 보유 |
| 제목 로고 | `ui/title.webp` | 생성형 AI 제작 | 앱 제작자 보유 |
| 중앙 동력실 실내 배경 | `backgrounds/core-hall-v2.webp` | 2026-10-08 내장 이미지 생성 도구로 제작. 원본·프롬프트는 `references/design/core-studio-v2/`에 보관 | 프로젝트를 위해 생성한 이미지. 조작 모델과 UI는 별도로 구현 |
| 코어·빈 중앙 장치 3D | `models/core/*.glb` | 사용자가 Meshy로 생성해 전달한 GLB를 폴리곤·텍스처 최적화(2026-10-20 UV 경계를 고정해 다시 축소: 코어 5만·장치 1.2만 삼각형, 2048 텍스처. `npm run assets:core`) | Meshy 계정의 생성·이용 조건은 별도 확인. CC0 등 별도 라이선스를 추정하지 않음 |
| 배경음악 2곡 (스테이지 반복 `Curious Discovery`·점등식 `Magical Power-Up`) | `audio/bgm-stage.mp3`, `audio/bgm-ending.mp3` | 2026-10-19 사용자가 Suno로 생성해 전달(연주곡) | 생성형 AI 음악. 생성 당시 Suno Premier 유료 요금제(상업 이용 가능, 2026-11-18 사용자 확인) |
| 효과음 3종 (`click_003`, `error_001`, `confirmation_002`) | `audio/*.ogg` | Kenney — Interface Sounds (kenney.nl/assets/interface-sounds) | CC0 1.0. 원문 `audio/LICENSE-Kenney.txt` 동봉 |
| 효과음 · 지도 공격 휙 | `audio/sfx/attack-swing-03.mp3` | qubodup — SWOSH-01 (freesound.org/people/qubodup/sounds/59988). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 1타 톡 | `audio/sfx/wood-knock-01.mp3` | Raclure — Wood knock (freesound.org/people/Raclure/sounds/405549). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 2타 덜컹 | `audio/sfx/metal-clank-01.mp3` | Kenney — Impact Sounds `impactMetal_medium_000` (kenney.nl/assets/impact-sounds). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 3타 쿵 | `audio/sfx/hit-heavy-02.mp3` | saturdaysoundguy — Loud Pillow Hit 2 (freesound.org/people/saturdaysoundguy/sounds/388035). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 악당 퇴장 | `audio/sfx/villain-exit-01.mp3` | martian — classic dizzy take slide whistle (freesound.org/people/martian/sounds/403002). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 악당 등장 | `audio/sfx/villain-appear-01.mp3` | javapimp — Pop 5 (freesound.org/people/javapimp/sounds/439186). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도 접촉 피격 퉁 | `audio/sfx/hurt-bump-03.mp3` | Kenney — Impact Sounds `impactSoft_heavy_000` (kenney.nl/assets/impact-sounds). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 성취 카드 날아오기 휙 | `audio/sfx/wind-whoosh-03.mp3` | qubodup — Slow Swosh 40 (freesound.org/people/qubodup/sounds/60027). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 성취 카드 공개 반짝 | `audio/sfx/reward-01.mp3` | ZenithInfinitiveStudios — Fantasy_ui_Button_3 (freesound.org/people/ZenithInfinitiveStudios/sounds/376745). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 성취 카드 공개(홀로·레전드) | `audio/sfx/reward-03.mp3` | CogFireStudios — Achievement Happy Beeps Jingle (freesound.org/people/CogFireStudios/sounds/619838). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 성취 카드 슬롯 도착 | `audio/sfx/pickup-01.mp3` | DeltaCode — item-pickup-v1 (freesound.org/people/DeltaCode/sounds/678384). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 성취 카드 5장 완성 | `audio/sfx/victory-jingle-01.mp3` | el_boss — Game Success Fanfare Short (freesound.org/people/el_boss/sounds/677858). 2026-11-17 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도·구조 걷기 발자국 1 | `audio/sfx/step-01.mp3` | sgossner — Footstep on Stone (freesound.org/people/sgossner/sounds/197778). 2026-11-19 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 지도·구조 걷기 발자국 2 | `audio/sfx/step-02.mp3` | Yoyodaman234 — concrete footstep 4 (freesound.org/people/Yoyodaman234/sounds/166506). 2026-11-19 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 효과음 · 실험실 열림 딸깍 | `audio/sfx/open-02.mp3` | Kenney — Interface Sounds `open_001` (kenney.nl/assets/interface-sounds). 2026-11-19 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (2026-11-17 재확인) |
| 효과음 · 실험실 열림 반짝 | `audio/sfx/twinkle-02.mp3` | 1urker — anime.wav (freesound.org/people/1urker/sounds/457306). 2026-11-19 과학34 공통 효과음 라이브러리(`_shared/sfx-library-20261117`)에서 복사: 앞뒤 무음 제거·음량 정규화·모노 MP3 | CC0 1.0 (원본 페이지에서 2026-11-17 재확인) |
| 성취 카드 그림 5종 (지도 악당 격퇴 보상) | `reward-cards/card-{1..5}-*.webp`, `reward-cards/thumb-{1..5}-*.webp` | 2026-11-18 ChatGPT 앱의 Codex 내장 이미지 도구(GPT 이미지)로 생성. 주인공·코기 자세 그림과 각 장소 배경을 화풍 참고로 붙임. 글자 없이 생성하고 테두리·별·이름은 코드로 올림. 640×960·96×144 WebP로 변환 | 프로젝트를 위해 생성한 이미지 |
| 제목·버튼 글꼴 | `fonts/jua-*.woff2` | Jua, Woowahan Brothers Corp. (Google Fonts 배포본) | SIL OFL 1.1. 원문 `fonts/Jua-OFL.txt` 동봉. Reserved Font Name "Jua" |
| 앱 아이콘·파비콘 | `/favicon.svg`, `/icons/icon-192.png`, `/icons/icon-512.png` | 직접 그린 SVG 플라스크 아이콘(PNG는 같은 그림을 변환) | 앱 제작자 보유 |
| 화면 아이콘(홈·소리·설정·재생·별 등) | `src/icons.ts` (코드 안 SVG) | 직접 그린 SVG 선 아이콘 | 앱 제작자 보유 |
| 공유 썸네일 | `/og-image.jpg` (1200×630) | 2026-10-19 위 `backgrounds/lab.webp`와 `ui/title.webp`를 sharp로 합성 | 앱 제작자 보유 |

## 고지

- 생성형 AI로 만든 이미지가 포함되어 있습니다. 실제 인물·기관·상품을 묘사하지 않습니다.
- 앱 화면 캡처·자체 제작 일러스트는 무단 복제·재배포·상업적 이용을 금합니다.
- 외부 자료(효과음·글꼴)의 저작권은 각 제작자에게 있으며 해당 라이선스 조건을 따릅니다. 이 문서는 그 권리를 앱 제작자에게 귀속시키지 않습니다.
- 이용 조건은 배포 플랫폼의 이용약관을 따릅니다.
