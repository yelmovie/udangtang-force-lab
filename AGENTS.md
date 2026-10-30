# AGENTS.md — 우당탕 힘 실험실

이 문서는 사람과 AI 에이전트(Claude Code·Codex 등)가 이 저장소에서 작업할 때 따르는 프로젝트 지침이다.
Claude Code는 루트의 `CLAUDE.md`가 이 파일을 `@AGENTS.md`로 불러온다.
작성 기준일: 2026-10-30 (Windows 11, Git Bash에서 저장소를 읽고 정리. 설치·테스트·빌드는 실행하지 않음).

## 0. 작업 시작 전 확인

- 프로젝트 루트는 `1udangtangtang/`(이 파일이 있는 폴더, 자체 `.git`)이다. 상위 폴더 `iscreammedia_sc34/`는 여러 프로젝트를 묶은 폴더이므로 그 안의 다른 프로젝트나 상위 `AGENTS.md`·`CLAUDE.md`를 이 프로젝트 작업 중에 수정하지 않는다. 상위 지침(graphify 사용 규칙)은 그대로 따른다.
- 현재 OS·셸·CPU 아키텍처(`node -p "process.platform + ' ' + process.arch"`), 프로젝트 루트, Git 상태를 먼저 확인한다.
- 외장 SSD(exFAT)는 파일 소유권을 기록하지 않아 Git이 "dubious ownership"으로 거부한다. 전역 설정을 바꾸지 말고 명령마다 붙인다.
  - Windows: `git -c safe.directory=F:/iscreammedia_sc34/1udangtangtang status`
  - Mac: `git -c safe.directory="$(pwd)" status` (Mac의 마운트 경로는 이 문서에 고정하지 않는다. 실제 경로를 확인해서 쓴다)
- 미커밋·미추적 파일은 사용자 작업으로 보고 보존한다. 되돌리기·stash·reset·브랜치 전환은 요청이 있을 때만 한다.
- 최신 진행 상황과 다음 할 일은 `.project-memory/PROJECT_STATE.md` 맨 위 작업 기록, 그다음 `HANDOFF.md`에 있다.

## A. 프로젝트 개요

- 목적: 초등 3학년 과학 「힘과 우리 생활」([4과01-01~04]) 탐구 게임. 가로형 태블릿·전자칠판용 정적 웹앱. 미션 5개(물자 배송소·균형 다리·재료 보급소·운반 공방·중앙 코어)와 픽셀 마을, 별·도구 카드·마을 복구, 이어하기.
- 실제 기술 스택: TypeScript + Vite 7(바닐라 DOM, 프레임워크 없음), three.js 0.180(코어·공방 3D, 실패 시 2D 대체), Node 내장 테스트 러너(`node --test`), Cloudflare Workers 정적 에셋 배포(wrangler 4), 빌드 시 서비스워커 생성(`scripts/offline-plugin.mjs`).
- 백엔드·로그인 없음. 진행 기록은 브라우저 `localStorage`(키 `udangtang-force-lab-save-v1`)에만 저장된다.

### 주요 폴더

| 경로 | 내용 | 구분 |
| --- | --- | --- |
| `src/` | 게임 코드(`main.ts`, `state.ts`, `*Model.ts`), 화면(`screens/`), 3D(`three/`), CSS | 사용자 작성 원본 |
| `public/` | 서비스 에셋(`assets/` 이미지·효과음·글꼴·GLB·영상), `manifest.webmanifest`, `og-image.jpg` | 원본(일부는 스크립트로 생성했지만 재생성에 `references/` 원본이 필요) |
| `public/assets/story/*.mp4`, `public/assets/concepts/*.mp4` | 인트로·엔딩·개념 영상 | **git에 없음**(`.gitignore`의 `*.mp4`). SSD에만 있는 유일본 |
| `scripts/` | 에셋 변환(`prepare-*.mjs`), 테스트(`test-*.mjs`), 빌드 플러그인, UI 픽스처 | 원본 |
| `tools/concept-clips/` | 개념 클립 렌더러(`npm run concepts:render`) | 원본 |
| `tools/remotion-concepts/` | 예전 Remotion 실험. `src/`만 남아 있고 git 추적 안 됨 | 보존 |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc`, `package.json`, `package-lock.json` | 설정 | 원본 |
| `PRD_*.md`, `TRD_*.md`, `02~05_*`, `page_design_prompts_*.json`, `files/` | 기획·설계 문서 | 원본 |
| `README.md`, `HANDOFF.md`, `docs/`(배포 기록·점검 보고) | 문서 | 원본 |
| `doc/`, `references/`, `image/`, `_unused/` | 작업 문서, 원본 이미지·모델·오디오, 삭제 후보 목록 | **git 제외, SSD에만 있음** |
| `.project-memory/` | 작업 기록(PROJECT_STATE.md) | git 제외, SSD에만 있음 |
| `.claude/` | `launch.json`(dev 5190, preview 5191), `settings.local.json` | git 제외 |
| `.tools/ffmpeg/` | Windows용 `ffmpeg.exe`·`ffprobe.exe` | git 제외, Windows 전용 |
| `dist/` | 빌드 결과 | 자동 생성 |
| `graphify-out/` | 지식 그래프(`graph.json` 등)와 날짜별 하위 폴더 | 자동 생성 + 기록 혼재 |
| `.tmp/`, `output/` | 빌드·테스트·배포 로그, 패치, 스크린샷, 캐시 | 작업 산출물 혼재 |

## B. 실행 환경

- Node.js 버전: **미지정**. `.nvmrc`·`.node-version`·`.tool-versions`·`package.json`의 `engines`가 없다. 임의로 버전을 고정하지 않는다. (참고: 2026-10-30 Windows에서 확인한 값은 Node v24.14.0, npm 11.9.0이며 이것이 요구 버전이라는 뜻은 아니다. Vite 7·wrangler 4가 요구하는 최소 Node 버전은 각 패키지 문서에서 확인한다.)
- 패키지 관리자: **npm**. 기준 lockfile은 `package-lock.json`. yarn·pnpm·bun으로 바꾸지 않고, 오류가 나도 lockfile을 지우지 않는다.
- `.npmrc` 없음. 루트의 `.npm-cache/`는 예전에 `npm_config_cache`로 지정해 쓴 캐시다(git 제외).
- Python·Flutter: 이 프로젝트는 사용하지 않는다(`graphify` 도구가 Python으로 실행되는 것은 저장소 밖 도구다).
- 네이티브 의존성: `sharp`(에셋 변환 스크립트용)는 OS·CPU별 바이너리를 쓴다. 현재 `node_modules/@img/`에는 `sharp-win32-x64`만 있으므로 Mac에서는 그대로 쓸 수 없다. `wrangler`·`vite`(esbuild·rollup)도 플랫폼별 바이너리를 포함한다.

## C. 명령어

`package.json`에 실제로 있는 스크립트만 적는다. npm 스크립트는 Mac·Windows 공통으로 같은 명령이다.

| 목적 | 명령 | 비고 |
| --- | --- | --- |
| 개발 서버 | `npm run dev` | `vite --host 0.0.0.0`(같은 와이파이의 태블릿에서 접속 가능). Claude 미리보기는 `.claude/launch.json`의 `dev`(5190 포트) |
| 테스트 | `npm test` | `node --test scripts/test-*.mjs` 14개 파일(모델·흐름 단위 테스트, 브라우저 없음) |
| 타입 검사 | `npx tsc --noEmit` | 별도 스크립트는 없고 `npm run build` 첫 단계에 포함 |
| 빌드 | `npm run build` | `tsc --noEmit && vite build` → `dist/`와 `dist/sw.js` 생성. 공용 `dist/`를 덮어쓰므로 동시에 두 빌드를 돌리지 않는다 |
| 빌드 미리보기 | `npm run preview` | `vite preview --host 0.0.0.0`. launch.json의 `preview`는 5191 포트 |
| 린트 | 없음 | ESLint·Prettier 설정과 스크립트가 없다. 있는 것처럼 실행하지 않는다 |
| 에셋 준비 | `npm run assets:prepare`, `npm run assets:core` | `references/` 원본과 `sharp`·`meshoptimizer` 필요. `assets:core`는 `CORE_OUT_DIR` 환경변수로 출력 폴더를 바꿀 수 있음 |
| 개념 클립 렌더 | `npm run concepts:render` | ffmpeg 필요: `FFMPEG` 환경변수 → `.tools/ffmpeg/ffmpeg.exe` → PATH의 `ffmpeg` 순서로 찾음 |
| 그 밖의 스크립트 | `node scripts/prepare-game-sprites.mjs`, `node scripts/prepare-pixel-village.mjs`, `node scripts/render-story-videos.mjs` | README에 언급된 수동 실행 스크립트 |

설치·배포 명령은 설명만 적는다(요청 없이 실행하지 않는다).

- 설치: `npm ci`는 lockfile 그대로 설치하지만 **기존 `node_modules`를 통째로 지우고 다시 만든다**. 다른 OS에서 넘어와 의존성을 다시 깔 때 쓴다. `npm install`은 lockfile을 바꿀 수 있다.
- 배포: Cloudflare Workers 정적 에셋(`wrangler.jsonc`가 `./dist`를 올림). 절차·기록·되돌리기는 `docs/DEPLOY-LOG.md`(`npm test && npm run build && npx wrangler deploy`, 배포 뒤 기록 표에 한 줄 추가). 운영 주소 https://udangtang-force-lab.yelsam.workers.dev . 배포는 사용자 승인 없이 하지 않는다.
- wrangler는 git이 아니라 로컬 `dist/`를 올린다. mp4 영상이 없는 컴퓨터에서 빌드·배포하면 영상이 빠진 채 운영본이 바뀐다.

### OS별로 다른 것

| 항목 | Windows | Mac |
| --- | --- | --- |
| git 소유권 우회 | `git -c safe.directory=F:/iscreammedia_sc34/1udangtangtang ...` | `git -c safe.directory="$(pwd)" ...` |
| ffmpeg | `.tools/ffmpeg/ffmpeg.exe` 사용 | `.exe`는 실행 불가. PATH의 ffmpeg 또는 `FFMPEG=/경로/ffmpeg` 지정(`concepts:render`만 해당) |
| `scripts/render-story-videos.mjs` | 동작(`.tools/ffmpeg/*.exe` 고정 경로) | **그대로는 동작하지 않음**(Windows 전용 경로 하드코딩). 필요하면 수정 여부를 먼저 사용자와 정한다 |
| `scripts/set-gemini-key.ps1` | PowerShell로 사용자 환경변수 `GEMINI_API_KEY` 저장 | 해당 없음. 필요하면 셸 프로필에 직접 설정(값을 출력·커밋하지 않음) |
| 셸 | PowerShell 5.1 또는 Git Bash | zsh/bash |

## D. 두 OS를 오갈 때의 규칙

### 유지하는 것(두 OS 공유)
`src/`, `public/`, `scripts/`, `tools/`, 설정 파일, `package.json`, `package-lock.json`, 기획·문서, `references/`, `doc/`, `image/`, `.project-memory/`.

### 다른 OS 것을 재사용하지 않는 것(재생성 가능)

| 폴더 | 재생성 방법 | 메모 |
| --- | --- | --- |
| `node_modules/` | `npm ci`(기존 폴더를 교체함을 알고 실행) | 현재 내용은 Windows x64용 |
| `dist/` | `npm run build` | 배포 직전에는 반드시 현재 컴퓨터에서 새로 빌드 |
| `.npm-cache/` | npm이 다시 만듦 | |
| `.wrangler/` | wrangler가 다시 만듦 | |
| `graphify-out/graph.json`·`GRAPH_REPORT.md`·`graph.html`·`cache/` | `graphify update .` | 날짜별 하위 폴더(`2026-10-18` 등)는 내용 확인 전 삭제하지 않는다 |
| `.tmp/node-compile-cache`, `.tmp/pip-cache` | 자동 생성 캐시 | `.tmp/`의 나머지(로그·패치·`darwin-bins` 등)는 작업 기록이므로 임의로 지우지 않는다 |

### 절대 삭제하지 않는 것
`src/`, `public/`(특히 git에 없는 `public/assets/**/*.mp4`), `scripts/`, `tools/`, `references/`, `doc/`, `image/`, `files/`, `_unused/`, `.project-memory/`, `docs/`, 기획 md·json, `package.json`, `package-lock.json`, `.claude/launch.json`.
설치·빌드 오류가 나도 소스·lockfile·원본 에셋을 지우거나 되돌려서 해결하지 않는다. `node_modules`를 다시 만드는 것은 대상 경로와 영향을 먼저 설명한 뒤 한다.

### 주의점(2026-10-30 확인)

- 절대경로 하드코딩: `src/`, `scripts/`, `tools/`, `index.html`, `vite.config.ts`에서 드라이브 문자·`/Volumes`·사용자 홈 경로는 찾지 못했다(검색에 걸린 것은 SVG 네임스페이스와 운영 주소 URL뿐). 예외는 `scripts/render-story-videos.mjs`의 `.tools/ffmpeg/*.exe` 상대경로(Windows 전용). `HANDOFF.md`·`PROJECT_STATE.md`의 `D:/…/_scratch` 같은 경로는 기록일 뿐 코드가 아니다. 새 코드에 드라이브 문자·`/Volumes`·사용자 홈을 넣지 않는다.
- import 대소문자: git 추적 파일 기준으로 `src/`·`scripts/`·`tools/concept-clips/`의 상대 import가 실제 파일명과 대소문자까지 일치함을 확인했다. Windows·Mac 기본 파일시스템은 대소문자를 구분하지 않아 틀려도 로컬에선 통과하므로 새 import도 파일명과 정확히 맞춘다(`.git/config`에 `core.ignorecase=true`).
- macOS `._*` 파일: Mac이 exFAT에 쓰면 `._파일명` AppleDouble 파일이 생긴다. 현재 `.git/objects/pack/._pack-*.idx` 때문에 Windows Git이 `non-monotonic index` 경고를 낸다(동작은 함). `scripts/offline-plugin.mjs`는 이미 `._` 파일을 캐시 목록에서 뺀다. `.git` 안의 `._*` 정리는 사용자 확인 후에만 한다. Mac에서 SSD를 쓴 뒤 `dot_clean`을 쓸지도 사용자가 정한다.
- 줄바꿈: `.gitattributes`·`.editorconfig`가 없다. 저장소 `.git/config`는 `core.autocrlf=false`(Windows 시스템 기본값 `true`보다 우선). 현재 추적 파일은 LF 135개, CRLF 29개, 혼합 8개(`src/main.ts`, `src/requestLetter.ts`, `src/screens/balance.ts`, `src/screens/scale.ts`, `README.md`, `.gitignore` 등)다. 수정할 때는 그 파일의 기존 줄바꿈을 유지하고 전체 변환을 하지 않는다. 2026-10-30 기준 미커밋 변경인 `scripts/prepare-story-assets.mjs`는 한 줄이 LF→CRLF로 바뀐 것뿐이다(사용자 판단 전까지 보존).
  - 제안(미적용): 정리하려면 `.gitattributes`에 `* text=auto eol=lf`와 바이너리 지정을 넣고 별도 커밋으로 `git add --renormalize .`를 한다. 사용자 승인 전에는 하지 않는다.
- Windows 전용 의존: `.tools/ffmpeg/*.exe`, `scripts/set-gemini-key.ps1`, `scripts/render-story-videos.mjs`. 나머지 npm 스크립트는 셸 문법을 쓰지 않아 두 OS에서 같은 명령이다(Mac에서는 미검증).
- 포트: dev 5190, preview 5191(`--strictPort`). 포트가 이미 쓰이고 있으면 다른 세션의 서버일 수 있으니 끄기 전에 확인한다.
- 같은 폴더에서 여러 에이전트 세션이 동시에 작업할 수 있다. 내가 바꾸지 않은 파일은 커밋하지 않고, 공용 `dist/` 빌드는 한 번에 하나만 한다.

## E. 환경변수·저장 데이터

- 환경변수(이름만 기록, 값은 출력·커밋하지 않음)
  - `GEMINI_API_KEY`: `scripts/set-gemini-key.ps1`이 Windows 사용자 환경변수로 저장한다. 저장소 코드에서 이 값을 읽는 곳은 찾지 못했다(외부 이미지 생성 작업용으로 보이나 미확인).
  - `FFMPEG`: `tools/concept-clips/render.mjs`의 ffmpeg 경로(선택).
  - `CORE_OUT_DIR`: `scripts/prepare-core-models.mjs` 출력 폴더(선택).
  - `import.meta.env.BASE_URL`·`DEV`: Vite 내장값. 앱용 `.env` 변수는 쓰지 않는다.
- `.env` 파일은 현재 없다. `.gitignore`가 `.env`, `.env.*`를 막고 `.env.example`만 허용한다. 기존 `.env`가 생기면 덮어쓰지 않는다.
- Cloudflare 로그인 정보는 wrangler가 저장소 밖에 보관한다. 토큰을 출력하거나 파일로 남기지 않는다.
- 학생 데이터: 진행 기록은 학생 브라우저의 `localStorage`에만 있고 서버로 보내지 않는다. 저장 키·저장 버전(1)·기존 필드 호환을 바꾸면 학생 기록이 사라질 수 있으므로 하위 호환을 유지하고 테스트로 확인한다. 저장은 origin(프로토콜·호스트·포트)별로 분리되어 개발 주소와 운영 주소의 기록이 섞이지 않는다.
- 실제 학생·운영 기기의 기록을 테스트용으로 초기화하지 않는다. 검증은 개발 서버 주소나 새 브라우저 프로필에서 한다.

## F. 검증과 작업 종료

- 코드를 고친 뒤에는 `npm test`와 `npm run build`(타입 검사 포함)를 실행하고 결과를 그대로 보고한다. 화면 변경은 개발 서버를 띄워 실제 화면으로 확인한다. 코드를 바꿨으면 `graphify update .`로 그래프를 갱신한다(상위 폴더 지침).
- 현재 OS에서 통과한 결과를 다른 OS의 성공으로 보고하지 않는다. "Windows에서 통과, Mac 미검증"처럼 구분한다.
- 태블릿 웹앱이므로 다음을 구분해서 보고한다.
  - 화면 크기 에뮬레이션 검사: 1024×768, 1180×757, 1280×800, 1920×1080(전자칠판), 세로 회전 안내.
  - 실제 기기 검사: iPad Safari·Android Chrome의 터치·드래그·회전·백그라운드 복귀·오프라인. 실기기로 하지 않았으면 "미검증"으로 남긴다.
  - 3D(코어·공방)는 정상 경로와 2D 대체 경로를 따로 확인한다.
- 저장 주입·관리자 해금으로 건너뛴 검사는 전체 플레이 통과로 보고하지 않는다.
- SSD 분리 전: 실행 중인 dev/preview 서버(5190·5191), 빌드, `vite`·`node --test`·`wrangler` 프로세스, 파일 감시, 다른 에이전트 세션이 남았는지 확인하고 끈 뒤 OS의 안전 제거를 쓴다.
- 작업을 마칠 때 변경 파일, 실제 실행한 검사, 남은 문제, 다음 컴퓨터에서 할 일을 짧게 남긴다. 긴 기록은 `.project-memory/PROJECT_STATE.md` 맨 위에 추가한다.

### 다음 컴퓨터에서 이어갈 때 최소 작업

1. OS·아키텍처·Node 버전 확인, `git -c safe.directory=<루트> status`로 미커밋 변경 확인.
2. `node_modules`가 다른 OS에서 설치된 것이면 영향을 확인한 뒤 `npm ci`로 다시 설치(Windows→Mac, Mac→Windows 모두 해당).
3. `npm test`, `npm run build`로 현재 OS에서 기준 상태 확인.
4. 배포할 컴퓨터라면 `public/assets/story/*.mp4`, `public/assets/concepts/*.mp4`가 있는지 확인.
5. `.project-memory/PROJECT_STATE.md` 맨 위 작업 기록부터 읽고 이어간다.
