// E2 (2026-11-21): markup moved out of main.ts unchanged — the title screen, the completion screen and the
// prediction lines both the completion screen and the mission result window show.
import { abilityStatements, challenges } from './challenges';
import { stages } from './data';
import { escapeHtml } from './escapeHtml';
import { predictionRecap, predictionVerdict, type PredictionRecap } from './inquiryPlan';
import { learningRecordComplete, learningSummary, learningTask, missionReviewTask } from './learningModel';
import { readSave, type SaveData } from './state';
import { toolCardRowMarkup } from './toolBag';
import { villageRewards } from './villageStory';

/** One line for the completion modal: the student's guess and whether the records agreed. */
export function guessMarkup(recap: PredictionRecap): string {
  if (!recap.predicted) return '';
  return `<p class="discovery-guess" data-matched="${recap.matched}"><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted)}<b>${recap.matched ? '✓ 처음 생각과 같아요!' : '실험으로 새로 알았어!'}</b></p>`;
}

/** First thought, what the records showed, and whether they matched — never a score. */
export function predictionMarkup(recap: PredictionRecap, className = 'discovery-prediction'): string {
  const verdict = predictionVerdict(recap);
  return `<div class="${className} prediction-recap" data-matched="${recap.matched ?? 'none'}"><p><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted ?? '기록된 예상이 없어')}</p><p><span class="prediction-tag is-result">실제 결과</span>${escapeHtml(recap.result)}</p>${verdict ? `<strong class="prediction-verdict">${verdict}</strong>` : ''}</div>`;
}

/** Title screen markup; the sound state and icons come from main.ts. */
export function titleScreenMarkup(hasSave: boolean, anySound: () => boolean, soundIcon: () => string, settingsIcon: () => string): string {
  return `<section class="title-screen">
    <div class="title-actions">
      <button class="icon-button" data-top="sound" aria-label="소리 ${anySound() ? '끄기' : '켜기'}" aria-pressed="${anySound()}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
    <div class="character" data-pose="title-student" role="img" aria-label="청록 고글을 쓰고 멜빵바지를 입은 학생 탐구자"></div>
    <div class="character" data-pose="title-corgi" role="img" aria-label="청록 스카프를 두른 코기 실험 파트너"></div>
    <div class="title-panel">
      <h1 class="illustrated-title"><img src="/assets/ui/title.webp" alt="우당탕 힘 실험실" width="1000" height="375"></h1>
    </div>
    <div class="title-buttons">
      <button class="button button-primary" id="new-start">${readSave() ? '새로 시작' : '시작하기'}</button>
      <button class="button button-secondary" id="continue" ${hasSave ? '' : 'disabled'}>이어 하기</button>
    </div>
    <div class="character" data-pose="title-squirrel" role="img" aria-label="기록판을 든 다람쥐 연구 기록관"></div>
    <p class="title-credit">기획·제작: 옐샘 &amp; ⓒ 아이스크림미디어</p>
  </section>`;
}

/** Completion screen markup for the given save. */
export function completeScreenMarkup(save: SaveData, completed: number, adminUnlocked: boolean): string {
  return `<section class="complete-screen">
    <div class="ending-world" aria-label="다시 빛나는 힘 마을"><div class="ending-rays"></div><div class="ending-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기' : '배터리를 다시 끼웠어 · 마을에 전기가 돌아왔어'}</span><h1>네가 마을을 살렸어!</h1><p>실험에서 찾은 방법으로 배터리 코어를 옮겨 다시 끼웠어.<br>전기가 돌아와 우당탕 마을에 다시 불이 켜졌어.</p><div class="ending-actions"> ${!adminUnlocked && save.completed.length === stages.length ? '<button class="button button-primary" id="get-certificate">인증서 받기</button>' : ''} ${adminUnlocked || save.completed.length === stages.length ? '<button class="button button-primary" id="replay-ending">마을 점등식 다시 보기 ✦</button>' : `<p>다섯 미션을 모두 마치면 점등식 영상이 열려요. 지금 ${save.completed.length} / ${stages.length}</p>`}<button class="button button-primary" id="restart-ending">처음부터 다시 해보기 ↻</button></div></div></div>
    <details class="complete-details"><summary>내 실험과 발견 살펴보기 · ${completed} / 5</summary>
    <div class="report-grid">${stages.map(stage => {
      const record = save.learning?.[stage.id];
      const candidates = [missionReviewTask(save, stage.id), learningTask(save, stage.id)];
      const task = candidates.find(item => item && item.signature === record?.signature);
      const checked = task && record && learningRecordComplete(task, record);
      return `<article class="report-card"><span>MISSION 0${stage.mission} · ${stage.concept}</span><h2>${stage.evidence}</h2><p class="report-card-insight">${escapeHtml(villageRewards[stage.id].afterLines[1])}</p>${predictionMarkup(predictionRecap(save, stage.id), 'report-first')}${save.completed.includes(stage.id) ? `<button type="button" class="report-concept" data-concept="${stage.id}">▶ 개념 영상 보기</button>` : ''}<details class="report-detail"><summary>내 실험과 답변 살펴보기</summary><p>${escapeHtml(save.evidence[stage.id] ?? '아직 기록이 없습니다.')}</p>${checked ? `<p>${escapeHtml(learningSummary(task, record))}</p>` : ''}</details></article>`;
    }).join('')}</div>
    </details><details class="complete-details"><summary>스스로 돌아보기 · 더 탐구하기 (선택)</summary><div class="ability-card"><h2>나는 이제 할 수 있어요!</h2><p>할 수 있게 된 것을 눌러 골라 봐. 연구 기록에 함께 저장돼.</p><div class="ability-list">${abilityStatements.map((text, i) => `<button class="ability-item" data-ability="${i}" aria-pressed="${(save.abilities ?? []).includes(i)}"><span>${(save.abilities ?? []).includes(i) ? '✓' : ''}</span>${text}</button>`).join('')}</div></div>
    <div class="challenge-card"><h2>도전 과제 <small id="challenge-count"></small></h2><p>실험실로 돌아가서 더 시험해 봐. 해 본 과제는 완료로 표시돼.</p><div class="challenge-list">${challenges(save).map(item => `<div class="challenge-item ${item.done ? 'done' : ''}"><span aria-hidden="true">${item.done ? '✓' : '○'}</span><div><strong>${item.label}</strong><small>${item.done ? '완료' : item.hint}</small></div></div>`).join('')}</div></div>
    </details>${toolCardRowMarkup(save)}<div class="transfer-card"><h2>내가 찾은 생활 속 도구</h2><p>${save.lifeObservation ? escapeHtml(save.lifeObservation.object) + ' · ' + escapeHtml(save.lifeObservation.use) : '주변에서 지레나 빗면을 찾아 어떻게 쓰이는지 살펴봐요.'}</p><p>이 기록을 보며 친구에게 도구의 쓰임을 설명해요.</p></div>
    <div class="complete-footer"><p>${adminUnlocked ? '관리자 미리보기 결과는 학생의 기록에 반영되지 않아요.' : ''}</p><button class="button button-secondary" id="back-map">작전 지도로</button></div>
  </section>`;
}
