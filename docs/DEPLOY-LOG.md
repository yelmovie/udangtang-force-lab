# 배포 기록 — 우당탕 힘 실험실

배포 주소: https://udangtang-force-lab.yelsam.workers.dev (Cloudflare Workers 정적 에셋, `wrangler.jsonc`)

## 배포하는 법

```bash
npm test && npm run build && npx wrangler deploy
```

- 배포 뒤 이 표 맨 위에 한 줄 추가: 날짜 · 커밋 · Cloudflare Version ID · 무엇이 바뀌었나.
- 확인: 주소가 200인지, 주소의 `index-*.js` 이름이 `dist/assets/` 의 것과 같은지, 바뀐 파일(예: `assets/concepts/cargo.webm`) 용량이 로컬과 같은지.
- `npm run build` 는 공용 `dist/` 를 다시 만든다. 다른 작업이 동시에 빌드 중이면 섞인 결과가 올라갈 수 있으니 한 번에 하나만 배포한다.

## 되돌리기

```bash
npx wrangler deployments list
npx wrangler rollback <Version ID>
```

## 기록 (최신이 위)

| 날짜 | 커밋 | Version ID | 내용 |
|---|---|---|---|
| 2026-10-19 | `6c2e9da` | `5f2aac69-2e9e-4457-8afe-7162006b5031` | 10-19 최종점검 남은 항목(터치·글자 크기, 저장 안전, 새로 시작 확인창, 교사용 확인 코드, 공유 썸네일)과 학습 문구 다듬기(과학 표현, 오답 이유, 근거 설명 버튼). 테스트 170/170, 배포 번들 `index-nE8j6ix6.js` 일치 확인 |
| 2026-10-19 | `da217bf` | `3561d2c5-8d0d-4f4c-853a-faa67c7039d6` | 개념 클립 리모션 없이 다시 렌더, 저작권 표기, 균형 다리·배송소·뒤로가기 수정 |
| 2026-10-19 | `de2c047` | `31ccec9a-9da4-49b5-b174-023b7ec351b4` | 10-19 최종점검 시점 운영본 |
| (이전) | `9fc90f4` | `79ccc780-53bc-4574-9425-c5889efde179` | |
| (이전) | `98e1536` | `87a1baef-7dd4-4978-a8d2-7990c0766d08` | |
