# 납품 안내 — 우당탕 힘 실험실

기존 인계 문서: [`HANDOFF.md`](../HANDOFF.md), 배포 기록 [`DEPLOY-LOG.md`](DEPLOY-LOG.md), 프로젝트 지침 [`AGENTS.md`](../AGENTS.md).

## 1. 한눈에
- 프로젝트 이름: 우당탕 힘 실험실 (`udangtang-force-lab`)
- 운영 주소: https://udangtang-force-lab.yelsam.workers.dev
- 저장소: https://github.com/yelmovie/udangtang-force-lab (브랜치 `main`)
- 현재 앱 커밋: `66aa421` (2026-11-21). 이후 커밋은 문서 기록입니다. 운영 배포 Version `9e15f095`.

## 2. 폴더 구조
배포되는 것
- `src/`: 게임 코드(TypeScript, 바닐라 DOM, three.js)
- `public/`: 그림·소리·글꼴·3D 모델·영상(`public/assets/`), `manifest.webmanifest`, `og-image.jpg`
- `worker/media-range.js`: 영상 요청 처리
- `index.html`, `vite.config.ts`, `wrangler.jsonc`, `package.json`

보관용(배포되지 않음)
- `docs/`: 배포 기록, 점검 보고, 권리 장부, 교사 검수표
- `scripts/`: 그림 변환과 테스트, `tools/concept-clips/`: 개념 클립 렌더러
- `references/`, `doc/`, `image/`, `_unused/`: 원본 자료(저장소에 없고 외장 SSD에만 있음)

## 3. 실행·빌드·검사 명령 (`package.json` 기준)
- 개발 서버: `npm run dev`
- 테스트: `npm test` (Node 내장 테스트 러너, 브라우저 없음)
- 빌드: `npm run build` (`tsc --noEmit && vite build`, 결과는 `dist/`와 `dist/sw.js`)
- 미리보기: `npm run preview`
- 린트 스크립트는 없습니다.

## 4. 배포
- 호스팅: Cloudflare Workers 정적 에셋(`wrangler.jsonc`, 이름 `udangtang-force-lab`).
- 명령(`docs/DEPLOY-LOG.md`): `npm test && npm run build && npx wrangler deploy`
- 되돌리기: `npx wrangler deployments list` 뒤 `npx wrangler rollback <Version ID>`
- 영상 탐색(Range) 처리: `worker/media-range.js`. `wrangler.jsonc`의 `run_worker_first`가 `/assets/concepts/*`와 `/assets/story/*`만 이 워커로 보냅니다.
- 배포는 git이 아니라 로컬 `dist/` 폴더를 올립니다. 푸시가 배포를 실행하는 워크플로(`.github`)는 없습니다.

## 5. 다른 호스팅으로 옮길 때 챙길 것
- 정적 파일 폴더: `npm run build`가 만든 `dist/` 전체.
- 서비스 워커: 빌드가 `dist/sw.js`를 만듭니다(`scripts/offline-plugin.mjs`). 같은 경로 루트에서 제공해야 합니다.
- Range 처리: `dist/assets/story/*`, `dist/assets/concepts/*`의 mp4·webm이 바이트 범위 요청(206)을 지원해야 합니다. 지원하지 않으면 영상 탐색과 iPad Safari 재생이 어긋납니다.
- 없는 주소는 `index.html`로 돌려주는 설정(SPA)이 필요합니다.
- 환경 값: 앱에 쓰는 `.env` 변수는 없습니다. 서버와 로그인도 없습니다.
- 진행 기록은 브라우저 `localStorage`라 주소(origin)가 바뀌면 기존 기록은 이어지지 않습니다.
- 영상은 현재 git에도 들어 있지만(`.gitignore` 예외), 빌드하는 컴퓨터에 mp4가 없으면 영상이 빠진 채 배포됩니다.

## 6. 버전과 변경 이력 (`git log`, 2026-11-21)
- `66aa421` 300자 넘는 논리 줄 14개 나눔
- `0c79fd7` 물자 배송소 화면 HTML을 `cargoMarkup.ts`로 이동
- `a07d8b2` `main.ts` 화면 HTML 이동
- `b094003` 균형 다리 화면 HTML을 `balanceMarkup.ts`로 이동
- `5ab53d5` 배포 그림 이름 규칙 맞춤
- `117af2a` 창 9곳의 포커스 가두기를 한 곳으로 모음
- `a68459b` 3-2b 기록 (운영 `524c1676`)
- `52de16e` 학습 문구 적용, 성취기준 필드, 대사 2줄 새 녹음
- `3215cf5` 완료 표시는 증거가 있을 때만 인정
- `1305136` 시작 화면 그림 해상도 정리

## 7. 권리·출처
[`RIGHTS-LEDGER-20261121.md`](RIGHTS-LEDGER-20261121.md): 46줄 모두 출처 기록이 있습니다(그림은 Codex, 영상은 구글 제미나이·Flow, 사용자 확인 2026-11-21). 요금제 화면과 약관 원문은 보관되어 있지 않습니다.

## 8. 알려진 한계와 남은 일 (`docs/reviews/SCORE-20261121.md`)
- 점수 94/100(실기기 제외 96).
- 교사 검수 표시 대기(−1), 개념 영상 자막(−1).
- 생성 도구 요금제·약관 원문 미보관(−1).
- 40분 수업 미확인(−1), 저사양 태블릿 흐림 효과 미확인(−1).

## 운영 대조 기록 (2026-11-22 12:56)

- 조율 세션이 운영 주소의 `index`와 스크립트·스타일 파일 9개를 저장소 `origin/main`과 대조했습니다. 결과는 모두 일치입니다(불일치 0).
- 위 본문에 「운영 반영 확인 필요」로 적힌 칸은 이 대조로 확인된 것입니다. 이후 앱을 다시 배포하면 `_scratch/final-recheck-20261120/prodcmp.sh 01`로 다시 대조합니다.
