# 우당탕탕 실험실 인계

- 목표: 초3 태블릿 UI/UX 개선. 기존 에셋·세계관·과학 판단 유지, 전면 재설계 금지.
- 위치: D:/iscreammedia_sc34/1udangtangtang. main 기준 5979580, 수정은 미커밋. 커밋·푸시·병합·배포 금지.
- 완료: 미션2 기록 버튼 겹침·단계 불일치 수정, 처음 생각/이번 비교 구분, 미션1·3 결과창 직접 완료 버튼, 미측정 제출 이유 표시, 시작 전 회전 안내, 그래픽 실패 분류·재시도·지도 복귀, 입력 취소·예약 모달 정리, 미션5 경로 안내 겹침 수정.
- 검증: 빌드 성공, 기존 테스트 170개·브라우저 회귀 21개 통과. 로컬 미리보기에서 미션1~5 완료·지도 복귀. 가로 1024×768·1180×820·1280×800 대표 상태와 세로 768×1024·820×1180 확인.
- 관련 파일: src/main.ts, tabletUx.css, predictionChip.ts, requestLetter.ts, screens/{balance,cargo,scale,workshop,rescue}.ts, three/workshopScene.ts. src/ 생략 경로는 그 아래.
- 자료: docs/reviews/tablet-ui-2026-10-18/README.md에 변경·검증 범위·제한, 같은 폴더에 전후 JPG·치수 JSON·검사 로그. scripts/tablet-ui.fixture.{html,js}는 npm run dev 후 브라우저에서 실행.
- 다음: 실제 태블릿 터치·iPad Safari, 영구 저장/새로고침/재진입, 모달별 뒤로가기, 모듈 다운로드 실패 검증. 모든 분기·결과창을 모든 크기에서 완주한 것은 아님.
- 주의: 합성 포인터 검사를 실제 터치로 보고하지 않기. 기존 .tmp/·graphify-out/ 보존. 산출물·임시는 D: 사용. 한국어 반말.
