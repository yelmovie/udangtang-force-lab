# 인수인계 — 「중앙 코어」 걷는 3D 스테이지 · 2026-11-17 12:35 (13:02 갱신)

> **13:02 갱신:** 장식 그림 2장의 원본이 13:00~13:01에 생성됐다(`references/images/run-stage-20261117/decor-barrels.png`, `decor-bench.png`). 뒤에서 돌던 생성 스크립트는 모두 끝났다. 가공과 화면 적용은 아직 하지 않았다. 원본 13장 생성은 끝났고 더 만들 그림은 없다.

01 우당탕 힘 실험실의 마지막 미션을 걸어 다니는 3D 작업장으로 바꾸는 작업이다. 구현과 그림 적용은 거의 끝났고 **커밋·푸시·운영 배포는 아직 하지 않았다.** 새 세션은 이 문서의 「다음에 할 일」부터 이어서 하면 된다.

- 규격·결정: [공통 지침](../../_shared/RUN-STAGE-3D-IMPLEMENT-GUIDE-20261117.md), [공통 계획](../../_shared/RUN-STAGE-3D-PLAN-20261117.md), [이 프로젝트 계획·코스 설계표·이미지 기록](RUN-STAGE-3D-PLAN-20261117.md)
- 프로젝트 규칙: 루트 `AGENTS.md`(E-1 자동 진행 보호 포함)
- 사용자 지시(2026-11-17, 순서대로): ① 프로젝트마다 구현 → 커밋 → 운영 배포까지 ② "구현한 화면을 GPT 이미지로 고도화, 배경도 아기자기하게, 겹침·잘림·물리적으로 이상한 것 확인·수정" ③ "새 창에서 Opus로 이어가게 인계 문서만"

## 새 세션에 붙여 넣을 말

```
/Volumes/T7 Shield/iscreammedia_sc34/1udangtangtang 의 docs/RUN-STAGE-3D-HANDOFF-20261117.md 를 읽고
「다음에 할 일」 1번부터 이어서 해 줘. 커밋·푸시·운영 배포와 기록까지 끝내 줘.
```

## 완료한 작업

- 「중앙 코어」(`rescue`)가 처음에 걷는 3D 작업장으로 열린다. 저울 → 턱(점프) → 막힌 문(상자) → 부품 더미·방해꾼 → 두 빗면 → 중앙 장치 순서의 한 방향 코스다.
- 조작: 왼쪽 아래 방향판, 오른쪽 아래 동작 버튼(0 맞추기 / 코어 올리기·내리기 / 숫자 확인 / 밀기 / 당기기 / 다시 시험 / 코어 끼우기)과 점프, 가운데 아래 힘 버튼 3개. 키보드는 방향키·WASD, Space(점프), E·Enter(그 자리의 첫 버튼, 밀기·당기기는 누르고 있기).
- 판정은 기존 함수가 한다. 걷는 화면은 `rescue.ts`의 `recordWeight` · `finishTravel` · `recordRun` · `selectRoute` · `slideBack`을 그대로 부르고, 저장은 기존 `rescue` 필드(`zeroed, loaded, measured, gate, route, force, runs[], delivered`)에 남는다. 저장 형식은 바꾸지 않았다.
- 「▶ 자동으로 보기」를 누르면 걷는 화면을 닫고 기존 화면에서 기존 `autoPlay()`가 그대로 돈다. 자동 진행 중에는 전환 버튼을 숨긴다.
- 「기존 방식으로 하기」/「걸어서 하기」 버튼으로 언제든 바꾼다. `prefers-reduced-motion`이면 처음부터 기존 화면, WebGL·그림 불러오기 실패 때는 안내 문구와 함께 기존 화면으로 간다.
- '코어 확대'는 남겼다. 누르면 그때 `core.glb`를 불러와 가까이 보여 주고, 방향판 좌우로 코어 자체를 돌린다. 시점 돌리기 버튼은 걷는 화면에 없다.
- 같은 곳에서 세 번 막히면 콩이 말풍선에 기존 힌트가 뜨고 「기존 방식으로 하기」 버튼이 강조된다.
- GPT 이미지 13장을 만들었고 그중 11장을 적용했다(탐구자 걷기·밀기·당기기, 콩이, 바닥, 부품 더미, 배경 벽, 방해꾼, 중앙 장치, 벽 무늬, 선반). 프롬프트·경로는 계획 문서의 「이미지 기록」에 있다(뒤 5장은 아직 표에 없다 → 아래 「다음에 할 일」 5번).
- 고친 어색한 점: 세운 그림이 뒤 물체에 잘림(카메라 쪽으로 기우는 스프라이트 → 똑바로 선 평면), 코어가 사람을 뚫고 내려옴(되돌아올 때 탐구자가 잡고 같이 내려옴), 콩이가 턱을 통과, 탁자·가구·받침 위로 점프해 올라섬, 빗면 아래 끼임·옆 추락, 멈출 때 미끄러짐, 사람만 한 저울, 이름표 잘림·기록판에 가림, 이어하기 위치가 방해꾼 옆, 장착 뒤 카메라가 장치에 붙어 있음.

## 수정한 파일 (`git status` 실측, 2026-11-17 12:32 · 커밋 전)

| 파일 | 상태 | 내용 |
|---|---|---|
| `src/rescueWalkModel.ts` | 새 파일 | 코스 좌표, 구간 판별(`walkZone`), 구간·상태별 버튼(`walkActions`), 빗면 고르기 규칙, 코어 위치(`corePlace`), 체크포인트. 판정은 `rescueModel`의 `canLift` 등을 그대로 부른다 |
| `scripts/test-rescue-walk.mjs` | 새 파일 | 위 모델 테스트 11건 |
| `src/three/walkStage.ts` | 새 파일 | 무대·캐릭터·고정 추적 카메라·걷기(three 부속 `Octree`·`Capsule`)·방해꾼·레일·장착 연출. 지연 로딩된다(빌드 조각 약 21 kB) |
| `src/screens/rescueWalk.css` | 새 파일 | 방향판·동작·힘 버튼·이름표·저울 숫자, 1600px 이상 화면용 확대 |
| `src/screens/rescue.ts` | 수정 (+211 −24, CRLF 유지) | 걷는 화면 전환과 기존 함수 연결. 기존 Enter 누르고 있기 코드를 `beginHold()`로 뽑았다(동작 같음) |
| `scripts/prepare-run-stage.mjs` | 새 파일 | 생성 원본 → 실행용 WebP 가공 |
| `public/assets/run-stage/*.webp` | 새 폴더 16개, 합계 약 914 kB | 실행용 그림. **`decor-barrels.webp`·`decor-bench.webp` 두 개는 아직 임시 그림(나무 상자)이다**(원본은 생성됨, 가공 전) |
| `package.json` | 수정 | `test`에 `scripts/test-rescue-walk.mjs` 추가 |
| `README.md` | 수정 (CRLF 유지) | 걷는 화면 설명 한 단락 |
| `AGENTS.md` | 수정 | 지휘 세션이 고친 한 줄(운영 배포 자동 승인). 이번 커밋에 함께 넣는다 |
| `docs/RUN-STAGE-3D-PLAN-20261117.md` | 새 파일 | 계획·확정 내용·코스 설계표·이미지 기록·진행 메모 |
| `docs/RUN-STAGE-3D-HANDOFF-20261117.md` | 새 파일 | 이 문서 |
| `HANDOFF.md` | 수정 | 맨 위에 이 문서로 가는 안내 한 줄 |

저장소 밖(SSD에만 있음): 원본 그림 `references/images/run-stage-20261117/`, 생성·정리 스크립트와 로그 `.tmp/run-stage/`, `.project-memory/PROJECT_STATE.md`.

## 테스트·빌드 결과

| 명령 | 결과 |
|---|---|
| `npm test` | 209건 통과, 실패 0 (2026-11-17 12:33, 지금 코드 기준) |
| `npx tsc --noEmit` | 오류 없음 (12:33) |
| `npm run build` | 11:32에 통과. **그 뒤 `walkStage.ts`·`rescue.ts`·그림이 바뀌었고 다시 돌리지 않았다** → 배포 전에 다시 실행 |
| `graphify update .` | 11:39에 실행. 그 뒤 코드가 바뀌어 다시 실행 필요 |

브라우저 확인(개발 서버 `http://localhost:5190`, 검증용 저장 주입, Mac Chrome 계열):

| 항목 | 결과 |
|---|---|
| 키보드로 처음부터 끝까지(0 맞추기 → 180 g → 턱 점프 → 밀기 막힘 → 당기기 → 짧은 빗면 멈춤 → 긴 빗면 도착 → 코어 끼우기 → 결과·문제 화면) | 통과. `rescue` 필드와 `pendingStage` 요약이 기존 형식으로 저장됨 |
| 화면 버튼(터치 이벤트)으로 방향판·점프·당기기·밀기·힘 바꾸기 | 1024×768에서 통과 |
| 자동으로 보기: 운영본(변경 전 `6bfd203` 빌드)과 대조 | 12줄 기록과 저장 결과가 줄 단위로 일치(3D 작업대). 그림 작업대(WebGL 끔) 자동 시연도 끝까지 진행. **단, 이 대조 뒤에 `rescue.ts`를 더 고쳤다** → 아래 「다음에 할 일」 3번 |
| 움직임 줄이기 | 기존 화면이 먼저 뜨고 「걸어서 하기」로 전환됨 |
| WebGL 실패 | 안내 문구와 함께 기존 화면으로 전환됨 |
| 기존 방식 ↔ 걷기 전환 | 기록 유지, 캔버스 1개만 유지 |
| 새로고침 뒤 이어하기 | 단계에 맞는 위치에서 시작 |
| 세 번 막힘 힌트, 코어 확대, 장착 뒤 다시 시험 | 통과 |
| 버튼·안내 겹침과 화면 밖 넘침 | 1024×768, 1180×757, 1280×800, 1920×1080에서 없음(새 그림 적용 전 측정. 버튼 배치는 그 뒤 바뀌지 않음) |
| 삼각형 수 | 평소 약 300~620개. '코어 확대' 중에는 `core.glb` 때문에 약 5만 개 |
| 실물 태블릿(iPad·Android), 전체 5미션 연속 플레이 | **미검증** |

## 확정된 결정

- 걷는 화면은 기존 화면 안의 세 번째 그리기·입력 방식이다. 새 판정·새 저장 필드를 만들지 않는다.
- 자동 진행은 항상 기존 화면에서 돈다(`AGENTS.md` E-1).
- 걷는 화면의 코어는 기존 그림(`props/core-cargo.webp`)을 세워 쓴다. `core.glb`(49,974 삼각형)를 그대로 올리면 공통 목표 3만을 넘기 때문이다. '코어 확대' 때만 모형을 불러온다.
- 캐릭터·소품은 카메라를 향해 기울어지는 스프라이트가 아니라 바닥에 똑바로 선 평면이다. 높은 시점에서 스프라이트가 뒤로 누워 뒤 물체에 잘렸기 때문이다.
- 대기·점프·기뻐하기 그림은 기존 `characters/student_poses.webp`에서 잘라 쓴다. 시작 카드 그림은 만들지 않는다(기존 미션 카드 사용).
- 구멍·낭떠러지는 두지 않았다(계획대로 점프는 턱과 부품 더미에만). 체크포인트 복귀는 바닥 아래로 빠졌을 때의 안전장치로만 있다.
- 방해꾼은 지도 악당(픽셀 그림)을 작업장 그림체로 다시 그린 `bot-walk`를 쓴다. 사용자가 그림 고도화를 요청해서 바꿨다.

## 남은 문제

| 등급 | 문제 | 재현·확인 방법 | 상태 |
|---|---|---|---|
| 배포 전 필수 | 장식 그림 2장(`decor-barrels`, `decor-bench`)의 원본은 나왔지만(13:01) 가공·적용을 안 했다. `public/assets/run-stage/`의 두 파일은 아직 나무 상자 임시 그림이고 뒷벽 두 곳(x≈−11.3, x≈−4.6)에 서 있다 | 걷는 화면에서 턱 오른쪽 뒤, 빗면 왼쪽 뒤 | `node scripts/prepare-run-stage.mjs` 실행과 화면 확인이 남음 |
| 배포 전 필수 | 내장 임시 원본 7장이 남아 있다. 화면 적용을 확인한 5장(`bot-walk`, `wall`, `dock`, `panel`, `decor-shelf`)과 아직 적용 전인 2장(`decor-barrels`, `decor-bench`) | `gpt-image.sh -l`에 이 프로젝트 경로 7줄(13:01 실측) | 정리 안 함. 뒤 2장은 화면 확인 뒤에 정리 |
| 확인 필요 | 자동으로 보기 대조를 마지막 `rescue.ts` 수정 전에 했다 | 아래 3번 | 다시 확인 필요 |
| 낮음 | 빗면 이름표 A·B가 오른쪽 위 기록판 근처에 가깝게 모인다 | 빗면 구간에서 화면 오른쪽 위 | 읽는 데는 문제 없음. 손보면 좋음 |
| 낮음 | Git이 `non-monotonic index` 경고를 낸다 | `git status` | `.git` 안의 `._*` 파일 때문. 전역 지시대로 커밋 전에 `find . -name '._*' -delete` |

## 다음에 할 일

1. **장식 그림 2장 가공·적용.** 원본은 이미 있다. 먼저 두 원본을 직접 열어 글자·로고·잘림·투명 배경을 본 뒤 가공한다.

   ```bash
   cd "/Volumes/T7 Shield/iscreammedia_sc34/1udangtangtang" && node scripts/prepare-run-stage.mjs
   ```

   `public/assets/run-stage/decor-barrels.webp`, `decor-bench.webp`가 새 그림으로 바뀌었는지 열어 보고, 걷는 화면에서 크기와 자리를 확인한다(크기·위치는 `src/three/walkStage.ts`의 가구 배열: 통 너비 1.7·x=−11.3, 작업대 너비 2.3·x=−4.6). 그림이 쓸 수 없는 상태면 그 두 항목을 가구 배열과 `pictures`에서 빼고 WebP 두 개를 지운다. 임시 그림을 그대로 배포하지 않는다.

2. **내장 임시 원본 정리.** 화면 확인이 끝난 그림만 넣는다.

   ```bash
   cd "/Volumes/T7 Shield/iscreammedia_sc34/1udangtangtang" && ./.tmp/run-stage/clean-images.sh bot-walk wall dock panel decor-shelf decor-barrels decor-bench
   ```

   끝나고 `"/Volumes/T7 Shield/AI-Skills/custom/gpt-imagegen/scripts/gpt-image.sh" -l`에 이 프로젝트 경로가 없는지 본다. 다른 세션의 줄은 건드리지 않는다.

3. **자동으로 보기 다시 대조.** 개발 서버에서 새 저장으로 「▶ 자동으로 보기」를 눌러 아래 12줄(안내 문구 | 피드백 | 버튼 글자 | 화면 종류 | 팝업)과 같은지 본다. 운영본은 배포하면 새 버전이 되므로 이 목록이 변경 전 기준이다.

   ```
   ① 코어를 저울에 올려요 | 빈 저울이 0 g이에요. 다시 코어를 올려요. | 직접 해보기
   ① 숫자를 확인하고 무게를 기록해요 | 코어를 올렸어요. 영점과 숫자를 확인해요. | 직접 해보기
   (같은 줄) + 팝업 「저울의 숫자는 180 g」
   ② 상자를 직접 당겨요 | 코어는 180 g! 이제 벽 옆 상자를 움직여 길을 열어요. | 직접 해보기
   ② 상자를 직접 당겨요 | 내 쪽으로 당겨 봐요. | 직접 해보기
   ③ 빗면을 따라 코어를 옮겨요 | 내 쪽으로 당겨 길이 열렸어요! 이제 코어를 빗면으로 옮겨요. | 직접 해보기 | is-core-3d
   ③ … | 짧고 가파른 빗면을 골랐어요. 코어를 길을 따라 끌어 봐요. | 직접 해보기 | is-core-3d
   ③ … | 이 힘으로는 올라가지 못했어요. 손가락을 더 세게 누를 필요는 없어요. 힘은 그대로 두고 길만 바꾸면 어떻게 될까요? | 직접 해보기 | is-core-3d
   ③ … | 길고 완만한 빗면을 골랐어요. 코어를 길을 따라 끌어 봐요. | 직접 해보기 | is-core-3d
   ③ … | 코어 도착! 작은 힘에서 A 짧은 빗면은 멈추고 B 긴 빗면은 도착했어요. 이제 중앙 장치에 코어를 다시 끼워요! | 직접 해보기 | is-core-3d core-delivered
   (같은 줄) | ▶ 자동으로 보기 | is-core-3d core-delivered
   (같은 줄) + 팝업 「다 했어요! 멋져요」
   ```

   끝난 저장값: `runs = [{short,1,false},{long,1,true}]`, `route: long`, `force: 1`, `delivered: true`.

4. **최종 검증.** `npm test` → `npm run build` → 개발 서버에서 1280×800과 1024×768로 처음부터 끝까지(화면 버튼, 키보드), 대체 화면, 콘솔 오류 확인. 빌드 전에 영상 7개가 있는지 본다(`public/assets/story/*.mp4` 2개, `public/assets/concepts/*.mp4` 5개. 이 세션을 시작할 때 확인했을 때 모두 있었다). 없으면 배포하지 않는다.

5. **기록 채우기.** 계획 문서 「이미지 기록」 표에 뒤 그림을 더하고(프롬프트는 `.tmp/run-stage/gen-images-2.sh`, `gen-images-3.sh`에 있다. `bot-walk`의 참고 그림은 `references/images/run-stage-20261117/ref-bot-pixel.png`와 `student_poses.webp`), 문서 끝에 「구현 결과」(바뀐 파일, 검증과 결과, 커밋 해시, 배포 버전, 확인 못 한 것)를 적는다. 진행 표시의 5~7번도 채운다.

6. **커밋·푸시.** `find . -name '._*' -delete` → 이번 작업 파일만 스테이징(위 표의 파일. `.tmp/`, `references/`, `dist/`는 원래 제외됨) → `main`에 푸시. Git 명령마다 `-c safe.directory="$(pwd)"`를 붙인다. 강제 푸시는 하지 않는다. 커밋 메시지 끝에 세션이 알려 주는 Co-Authored-By 줄을 넣는다.

7. **운영 배포.** `docs/DEPLOY-LOG.md` 절차(테스트 → 빌드 → wrangler 배포). wrangler는 공통 지침의 SSD 경로 것을 쓰고 `TMPDIR`·`XDG_CACHE_HOME`·`WRANGLER_LOG_PATH`를 이 폴더의 `.tmp/` 아래로 둔다.

   ```bash
   HOME="/Volumes/T7 Shield/DevCaches/tools/wrangler-home" node "/Volumes/T7 Shield/DevCaches/tools/wrangler-4.154.0/node_modules/wrangler/bin/wrangler.js" whoami
   ```

   배포는 같은 실행 파일에 `deploy`(저장소의 `wrangler.jsonc`가 `./dist`를 올린다). 운영 배포는 자동 승인이다(전역 지시 2026-11-16).

8. **운영 확인과 마무리 기록.** https://udangtang-force-lab.yelsam.workers.dev 에서 응답 200, 활성 버전, `index-*.js` 이름이 `dist/assets/`와 같은지, `assets/run-stage/wall.webp` 등 핵심 파일 해시(서비스워커가 있으니 `curl`로), 「중앙 코어」가 걷는 화면으로 열리는지 확인한다. 그 뒤 `docs/DEPLOY-LOG.md` 표 맨 위에 한 줄, `.project-memory/PROJECT_STATE.md` 맨 위 기록 갱신, `graphify update .`, 마지막 보고.

## 확인할 때 쓰는 방법

- 개발 서버: `.claude/launch.json`의 `dev`(5190 포트). 확인이 끝나면 바로 끈다(같은 맥에서 세션 여러 개가 돈다). 12:33 현재 꺼져 있다.
- 「중앙 코어」를 바로 열 검증용 저장(개발 서버 주소에서만 쓴다):

  ```js
  localStorage.setItem('udangtang-force-lab-save-v1', JSON.stringify({version:1,currentPage:'rescue',completed:['cargo','balance','scale','workshop'],evidence:{},soundOn:false,musicOn:false,soundVolume:0.3,savedAt:Date.now()})); location.reload();
  ```

  새로고침 뒤 첫 화면의 「이어 하기」는 실제 클릭이어야 넘어간다. 단계별로 보려면 저장에 `rescue:{zeroed:true,loaded:true,measured:true,gate:false,…}`처럼 넣는다.
- 캔버스 `.walk-host canvas`의 `dataset.spot`(탐구자 위치 x,y,z)과 `dataset.triangles`로 위치·삼각형 수를 읽을 수 있다.
- 키 입력은 `document`에 `KeyboardEvent`를 보내도 받는다(`KeyD`, `Space`, `KeyE`). 백그라운드 탭에서는 애니메이션이 멈추니 탭을 앞에 둔다.
- 운영 주소에서 검증용 저장을 넣을 때는 기존 값을 따로 보관했다가 되돌린다(자동 시연 대조 때 그렇게 했다).

## 건드리면 안 되는 것

- `src/cargoModel.ts`(첫 미션, "축소 금지"), 다섯 미션의 자동 진행 순서·문구·속도(`AGENTS.md` E-1).
- 저장 키 `udangtang-force-lab-save-v1`와 기존 필드. 새 필드를 더하지 않는다.
- `src/three/coreScene.ts`(기존 3D 작업대). 걷는 화면은 이 파일을 고치지 않고 따로 만들었다.
- `rescue.ts`는 CRLF, `README.md`도 CRLF 위주다. 줄바꿈을 바꾸지 않는다.
- `_shared/`와 다른 프로젝트 폴더는 읽기만 한다. 이미지 생성·정리는 반드시 `_shared/run-stage-lock.sh image …`로 한 장씩 한다.
- Git에 없는 영상(`*.mp4`), `references/`, `.tmp/`의 기록.
