import fs from 'node:fs';
function edit(file, pairs) {
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to] of pairs) {
    if (!text.includes(from)) throw new Error(`${file}: missing ${from.slice(0,100)}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text);
}
edit('src/main.ts', [
  ["import './storyVideo.css';", "import './storyVideo.css';\nimport './studentUx.css';\nimport { openLifeObservation } from './lifeObservation';"],
  [`  if (closeLearningReview) return;
  closeLearningReview = openLearningReview({
    app, save: adminSave ?? save, stage: stageId,
    commit: () => { if (!adminUnlocked) persist(); },
    onClose: () => { closeLearningReview = null; },
    onDone: () => { closeLearningReview = null; finishWithEvidence(stageId, summary); },
  });
  if (!closeLearningReview) toast('비교할 기록이 더 필요해요. 두 조건을 다시 시험해 주세요.');`,
  `  if (closeLearningReview) return;
  if (stageId === 'workshop') {
    const activeSave = adminSave ?? save;
    openLifeObservation({ app, value: activeSave.lifeObservation,
      onSave: value => { activeSave.lifeObservation = value; if (!adminUnlocked) persist(); },
      onDone: () => {
        const observation = activeSave.lifeObservation!;
        finishWithEvidence(stageId, summary + ' 생활 속 관찰: ' + observation.object.trim() + ' — ' + observation.use.trim() + (observation.shared ? ' (설명했다고 스스로 표시함)' : ' (친구와 나눌 기록)'));
      },
    });
  } else finishWithEvidence(stageId, summary);`],
  ['<p class="discovery-challenge">${challenge.done ? `★ 추가 탐구 성공 · ${challenge.label}` : `☆ 다시 도전할 수 있어 · ${challenge.hint}`}</p>', '<details class="discovery-detail"><summary>더 탐구하기 (선택)</summary><p>${challenge.done ? `★ ${challenge.label}` : challenge.hint}</p>${learningTask(activeSave, stageId) ? \'<button class="button button-secondary" id="optional-review">내 기록으로 문제 풀기</button>\' : \'\'}</details>'],
  [`  modal.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); next.focus(); }
  });`, `  modal.querySelector('#optional-review')?.addEventListener('click', () => {
    modal.hidden = true;
    const restore = () => { closeLearningReview = null; modal.hidden = false; next.focus(); };
    closeLearningReview = openLearningReview({ app, save: activeSave, stage: stageId, commit: () => { if (!adminUnlocked) persist(); }, onClose: restore, onDone: restore });
    if (!closeLearningReview) restore();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll<HTMLElement>('button,summary')].filter(el => el.getClientRects().length);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  });`],
  ['<div class="mission-guide"><img src="/assets/game/corgi-observe.webp" alt=""><p>단서 탐지견 <strong>코기 콩이</strong><br>실험 전에 예상하고, 결과와 다시 비교하자!</p></div>', ''],
  ['<div class="mission-promise"><div><span>알게 되는 것</span><strong>${missionLearn[stageId]}</strong></div><div><span>끝내면 얻는 것</span><strong>${villageRewards[stageId].name} 복구 · ${stage.evidence}</strong></div></div>', '<p class="mission-purpose">${missionLearn[stageId]}</p>'],
  ['<details class="mission-extra"><summary>☆ 콩이의 추가 탐구 (선택)</summary><p>${challenges(activeSave).find(item => item.id === stageId)!.hint}</p></details>', ''],
  ['<span class="question-label">먼저 생각해 볼 문제</span>', '<span class="question-label">먼저 예상해요 (선택)</span>'],
  ['<p class="answer-label">${fingerIcon} 아래에서 내 생각을 하나 골라요</p>', ''],
  ['<p class="mission-observe">콩이의 관찰 단서 · ${plan.observation}</p>', ''],
  ['<button class="button button-primary" id="mission-start" ${selected ? \'\' : \'disabled\'}>내 예상과 함께 실험 시작 →</button>', '<button class="button button-primary" id="mission-start">실험 시작 →</button>'],
  ['    if (!selected) return;\n    activeSave.inquiryPlans ??= {};\n    activeSave.inquiryPlans[stageId] = selected;', '    activeSave.inquiryPlans ??= {};\n    if (selected) activeSave.inquiryPlans[stageId] = selected;'],
  ['id="new-start">시작하기</button>', 'id="new-start">${readSave() ? \'새로 시작\' : \'시작하기\'}</button>'],
  ["scale: '저울의 영점을 맞추고 무게를 정확히 재는 법'", "scale: '겉모습으로 헷갈리는 무게를 저울로 비교해요.'"],
  ['<div class="complete-hero"><span class="eyebrow">나만의 힘 연구 기록</span><h1>${adminUnlocked ? \'학생 기록 미리보기\' : \'나는 근거를 찾는 힘 연구원!\'}</h1><p>빠른 정답보다, 조건을 바꾸고 다시 실험한 과정이 소중해요.</p><div class="complete-count"><strong>${completed} / 5</strong><span>미션 완료</span><strong>${progress}%</strong><span>실험실 복구</span></div></div>', '<details class="complete-details"><summary>내 실험과 발견 살펴보기 · ${completed} / 5</summary>'],
  ['<div class="ability-card"><h2>', '</details><details class="complete-details"><summary>스스로 돌아보기 · 더 탐구하기 (선택)</summary><div class="ability-card"><h2>'],
  ['<div class="transfer-card"><h2>실험실 밖에서도 힘 연구원!</h2>', '</details><div class="transfer-card"><h2>내가 찾은 생활 속 도구</h2>'],
  ['<p>도서관의 무거운 책 수레를 높은 곳으로 옮긴다면? 오늘 비교한 두 빗면 중 어떤 길을 만들지, 가족이나 친구에게 네 실험 기록으로 설명해 봐요.</p>', '<p>${save.lifeObservation ? escapeHtml(save.lifeObservation.object) + \' · \' + escapeHtml(save.lifeObservation.use) : \'주변에서 지레나 빗면을 찾아 어떻게 쓰이는지 살펴봐요.\'}</p><p>이 기록을 보며 친구에게 도구의 쓰임을 설명해요.</p>'],
  ['learning: save.learning ?? {} }, null, 2)', 'learning: save.learning ?? {}, lifeObservation: save.lifeObservation }, null, 2)'],
  ['<button data-settings="help"><span>?</span> 학생 가이드</button><button data-settings="teacher">', '<button data-settings="help"><span>?</span> 학생 가이드</button><button data-settings="save"><span>✓</span> 지금 저장</button></div><details class="teacher-tools"><summary>선생님 도구 · 정보</summary><div class="settings-links"><button data-settings="teacher">'],
  ['<button data-settings="save"><span>✓</span> 지금 저장</button><button data-settings="admin">', '<button data-settings="admin">'],
  ['<button class="settings-danger" data-settings="reset"><span>↺</span> 기록 초기화</button></div>', '<button class="settings-danger" data-settings="reset"><span>↺</span> 기록 초기화</button></div></details>'],
]);
edit('src/screens/balance.ts', [
  ['02 · 기울기 예측 실험', '02 · 균형 다리'],
  ['잠금핀을 뽑으면, 어느 쪽이 내려갈까?', '어느 물체가 더 무거울까?'],
  ['<em id="balance-goal-hint"></em>', ''],
  ["'<span class=\"pan-drop-hint\">여기에 놓기</span>'", "''"],
  ["root.querySelector('#balance-goal-hint')!.textContent = canFinish() ? '완료! 발전기 연결을 눌러요' : hasTilt() ? '다음은 나무와 도자기를 비교해 봐요' : hasLevel() ? '다음은 금속과 다른 물체를 비교해 봐요' : '물체를 놓고 예상 → 핀을 뽑아 관찰';", ""],
  ["busy ? '찰칵! 핀이 빠졌어요. 기울기를 살펴봐요.' : !state.left", "busy ? '기울기를 살펴봐요' : visibleOutcome ? canFinish() ? '두 결과를 발견했어요! 마칠 수 있어요' : '한 물체를 바꾸어 다시 비교해요' : !state.left"],
  ['③ 가운데 잠금핀 고리를 뽑아요', '③ 고리를 누르거나 오른쪽으로 뽑아요'],
  ["'고리를 잡고 뽑기 →'", "'누르거나 뽑기 →'"],
  ['<span class="question-label">② 예상할 문제</span>', ''],
  ['발전기 연결 →', '발견 저장 →'],
]);
edit('src/screens/village.ts', [
  ["'방향키·WASD·방향판으로 걸어 봐. 열린 문에 닿으면 자동 입장!'", "'불이 켜진 건물 이름을 누르면 실험하러 걸어가요.'"],
  ['문 앞이나 박사님 곁으로', '건물 이름을 눌러요'],
  ["'문 앞이나 박사님 곁으로'", "'건물 이름을 눌러요'"],
]);
edit('src/data.ts', [
  ["title: '짐을 옮겨라'", "title: '물자 배송소'"], ["title: '기울기를 예측하라'", "title: '균형 다리'"],
  ["title: '목표 무게를 맞춰라'", "title: '재료 보급소'"], ["title: '장치를 만들어라'", "title: '운반 공방'"], ["title: '잠든 코어를 깨워라'", "title: '중앙 코어'"],
  ['균형 비교 데이터', '무게를 비교한 기록'], ['힘 비교 관찰 기록', '밀고 당긴 기록'], ['정확 측정 기록', '저울로 비교한 기록'],
]);
edit('src/inquiryPlan.ts', [
  ["prompt: '빈 저울에 15 g이 보이면 무엇을 먼저 할까?'", "prompt: '사과 모형과 책 모형, 겉모습만 보고 무게를 정확히 알 수 있을까?'"],
  ["choices: [{ id: 'zero', label: '빈 저울을 0 g으로 맞춰' }, { id: 'weigh', label: '재료를 바로 올려서 재' }]", "choices: [{ id: 'looks', label: '겉모습으로 알 수 있을 것 같아' }, { id: 'compare', label: '저울로 재 봐야 알 것 같아' }]"],
]);
edit('src/screens/rescue.ts', [
  ["['① 코어를 저울에 올려요','② 상자를 직접 당겨요','③ 빗면을 따라 코어를 옮겨요'][step]", "[state.loaded ? state.zeroed ? '① 숫자를 확인하고 무게를 기록해요' : '① 코어를 내리고 빈 저울을 0으로 맞춰요' : state.zeroed ? '① 코어를 저울에 올려요' : '① 빈 저울을 0으로 맞춰요','② 상자를 직접 당겨요','③ 빗면을 따라 코어를 옮겨요'][step]"],
  [" : '빈 저울부터 살펴봐요';", " : state.loaded ? '저울의 숫자를 읽어요' : state.zeroed ? '빈 저울 0 g 확인 ✓' : '빈 저울이 20 g이에요';"],
  ['빈 저울 영점 맞추기</button>', '0 맞추기</button>'],
  ["'먼저 코어를 저울로 끌어 놓아요. 빈 저울도 살펴봐요.'", "'빈 저울의 숫자를 0으로 맞춘 뒤 코어를 올려요.'"],
  ["step === 0 ? '코기 단서: 빈 저울의 숫자가 0인지 먼저 봐!'", "step === 0 ? state.zeroed ? '0을 맞췄어. 코어의 무게를 확인하자!' : '아무것도 없을 때 0이어야 해!'"],
]);
