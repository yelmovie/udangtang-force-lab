# 에셋 출처와 라이선스 — 우당탕 힘 실험실

기획·제작: 옐샘 · ⓒ 2026 옐샘

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
| 제목 로고 | `ui/title.webp` | 생성형 AI 제작 | 앱 제작자 보유 |
| 중앙 동력실 실내 배경 | `backgrounds/core-hall-v2.webp` | 2026-10-08 내장 이미지 생성 도구로 제작. 원본·프롬프트는 `references/design/core-studio-v2/`에 보관 | 프로젝트를 위해 생성한 이미지. 조작 모델과 UI는 별도로 구현 |
| 코어·빈 중앙 장치 3D | `models/core/*.glb` | 사용자가 Meshy로 생성해 전달한 GLB를 폴리곤·텍스처 최적화 | Meshy 계정의 생성·이용 조건은 별도 확인. CC0 등 별도 라이선스를 추정하지 않음 |
| 효과음 3종 (`click_003`, `error_001`, `confirmation_002`) | `audio/*.ogg` | Kenney — Interface Sounds (kenney.nl/assets/interface-sounds) | CC0 1.0. 원문 `doc/licenses/kenney-interface-sounds` |
| 제목·버튼 글꼴 | `fonts/jua-*.woff2` | Jua, Woowahan Brothers Corp. (Google Fonts 배포본) | SIL OFL 1.1. 원문 `fonts/Jua-OFL.txt` 동봉. Reserved Font Name "Jua" |

## 고지

- 생성형 AI로 만든 이미지가 포함되어 있습니다. 실제 인물·기관·상품을 묘사하지 않습니다.
- 앱 화면 캡처·자체 제작 일러스트는 무단 복제·재배포·상업적 이용을 금합니다.
- 외부 자료(효과음·글꼴)의 저작권은 각 제작자에게 있으며 해당 라이선스 조건을 따릅니다. 이 문서는 그 권리를 앱 제작자에게 귀속시키지 않습니다.
- 이용 조건은 배포 플랫폼의 이용약관을 따릅니다.
