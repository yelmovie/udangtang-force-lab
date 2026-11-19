import './style.css';
import { escapeHtml } from './escapeHtml';
import './adventure.css';
import './display.css';
import './settings.css';
import './polish.css';
import './learning.css';
import './missionProgress.css';
import './questionUI.css';
import './storyVideo.css';
import './stagePopup.css';
import { introSentence, openLifeObservation } from './lifeObservation';
import { stages, type PageId, type StageId } from './data';
import { completeStage, freshSave, markExperimentDone, readSave, stageIsOpen, writeSave, type SaveData } from './state';
import { mountCargo } from './screens/cargo';
import { mountBalance } from './screens/balance';
import { mountScale } from './screens/scale';
import { mountWorkshop } from './screens/workshop';
import { mountRescue } from './screens/rescue';
import { mountVillage } from './screens/village';
import { canPlayMapFinale, defeatedMapVillains } from './map-villains.js';
import { villageRewards } from './villageStory';
import { playMusic, playSound, soundLeft, stopMusic, stopSounds, setVolume, setEffectVolume, type MapSound, type MusicName } from './sound';
import { installKongDialogue } from './kongDialogue';
import { configureVoiceLines, playVoiceLine, stopAllVoices, stopVoiceLine } from './npcDialogueVoice';
installKongDialogue(() => save);
configureVoiceLines(() => save);
import { prepareOffline } from './offline';
import type { AppContext } from './appTypes';
import { abilityStatements, challenges } from './challenges';
import { mountMissionReview, openLearningReview } from './learningReview';
import { openConceptClip, syncConceptButton } from './conceptClip';
import { learningTask, missionReviewTask, missionReviewRecord, learningRecordComplete, learningSummary } from './learningModel';
import { predictionRecap, predictionVerdict, type PredictionRecap } from './inquiryPlan';
import { earnedToolCards, toolCardInfo, toolCards } from './toolCards';
import { bagIcon, openToolBag, toolCardRevealMarkup, toolCardRowMarkup } from './toolBag';
import './studentUx.css';
import './tabletUx.css';
import './glass-ui.css';
import './layoutBalance.css';
import { icons } from './icons';
import { bindRewardSound, rewardSlotsHtml } from './rewardCards';
import { configureStoryModal, endingVideo, introVideo, openStoryModal, prologueLines } from './storyModal';
import { openSettings as openSettingsPanel, type SettingsHost } from './settingsPanel';
import { openMissionCard as openMissionCardPanel } from './missionCard';

const app = document.querySelector<HTMLDivElement>('#app')!;
let save: SaveData = readSave() ?? freshSave();
let viewPage: PageId = 'title';
let cleanup: (() => void) | void;
let adminUnlocked = false;
let adminSave: SaveData | null = null;
let villageReturn: StageId | undefined;
let villageCelebration: StageId | undefined;
let closeMissionResult: (() => void) | null = null;
let closeWorkshopReview: (() => void) | null = null;
const pageHistory: PageId[] = [];

function setHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.visualViewport?.height ?? window.innerHeight}px`);
}
setHeight();
window.visualViewport?.addEventListener('resize', setHeight);
window.addEventListener('resize', setHeight);

function tone(frequency = 520) {
  if (!save.soundOn) return;
  setVolume(save.soundVolume ?? 0.3);
  setEffectVolume(save.effectVolume ?? 1);
  playSound(frequency >= 680 ? 'success' : frequency < 400 ? 'bump' : 'click');
}
function cue(name: MapSound) {
  if (!save.soundOn) return;
  setVolume(save.soundVolume ?? 0.3);
  setEffectVolume(save.effectVolume ?? 1);
  playSound(name);
}
bindRewardSound(cue);
/** The lighting ceremony asks for its own track while it is open; a story film turns the music down itself instead of stopping it. */
let storyMusic: MusicName | null = null;
/** Background music has its own switch in settings; the header button turns music and effects on or off together.
 * The research record (the screen after the ceremony) plays the ending track. A start the browser refuses is retried by sound.ts on the first tap or key. */
function syncMusic() {
  if (!save.musicOn) { stopMusic(); return; }
  setVolume(save.soundVolume ?? 0.3);
  playMusic(storyMusic ?? (viewPage === 'complete' ? 'ending' : 'stage'));
}

/** Confetti burst: 28 pieces with their own drift, delay and colour. Skipped under reduced motion. */
configureStoryModal({ app, tone, confetti, soundOn: () => anySound(), voiceOn: () => save.voiceOn ?? save.soundOn, volume: () => save.soundVolume ?? .3, setMusic: music => { storyMusic = music; syncMusic(); } });
function confetti(host: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const burst = document.createElement('div'); burst.className = 'story-confetti'; burst.setAttribute('aria-hidden', 'true');
  for (let n = 0; n < 28; n++) { const bit = document.createElement('i'); bit.style.setProperty('--x', `${Math.random() * 100}%`); bit.style.setProperty('--d', `${(Math.random() * 1.2).toFixed(2)}s`); bit.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`); bit.style.setProperty('--c', ['#ffd27a', '#ff8a65', '#7fd7c4', '#fff6d8', '#ffb3c7'][n % 5]); burst.append(bit); }
  host.append(burst);
}

function toast(message: string) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 2600);
}

function persist() {
  const saved = writeSave(save);
  if (!saved) toast('이 기기에서 저장할 수 없어요. 브라우저 저장 설정을 확인해 주세요.');
  return saved;
}

function navigate(page: PageId) {
  if (!adminUnlocked && stages.some(stage => stage.id === page && !stageIsOpen(save, stage.id))) {
    toast('앞의 실험을 마치면 열 수 있어요.');
    return;
  }
  if (!adminUnlocked && page === 'complete' && save.completed.length < stages.length) {
    toast('다섯 미션을 마치면 연구 기록을 볼 수 있어요.');
    return;
  }
  closeWorkshopReview?.();
  closeMissionResult?.();
  if (page === 'map' && stages.some(stage => stage.id === viewPage)) villageReturn = viewPage as StageId;
  if (!backNavigation && page !== viewPage) { pageHistory.push(viewPage); if (pageHistory.length > 20) pageHistory.shift(); history.pushState({ page }, ''); }
  viewPage = page;
  if (!adminUnlocked) {
    save.currentPage = page;
    persist();
  }
  render();
  window.scrollTo(0, 0);
}

function finish(stageId: StageId, summary: string) {
  if (closeMissionResult || document.querySelector('#life-title')) return;
  if (stageId === 'workshop') {
    const activeSave = adminSave ?? save;
    openLifeObservation({ app, value: activeSave.lifeObservation,
      onSave: value => { activeSave.lifeObservation = value; if (!adminUnlocked) persist(); },
      onDone: () => {
        const observation = activeSave.lifeObservation!;
        const intro = introSentence(observation.intro);
        finishWorkshopWithEvidence(stageId, `${summary} 생활 속 도구 분류: ${observation.object.trim()} / ${observation.use.trim()}${intro ? ` 짝에게 소개할 말: ${intro}` : ''}`);
      },
    });
  } else finishWithEvidence(stageId, summary);
}

/** The workshop keeps its original questions before the discovery screen. */
function questionsSolved(target: SaveData, stageId: StageId) {
  const task = learningTask(target, stageId);
  return !task || learningRecordComplete(task, target.learning?.[stageId]);
}

function finishWorkshopWithEvidence(stageId: StageId, summary: string) {
  const activeSave = adminSave ?? save;
  if (!adminUnlocked && !activeSave.completed.includes(stageId) && !questionsSolved(activeSave, stageId)) {
    if (!markExperimentDone(save, stageId, summary)) toast('기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
    openWorkshopReviewGate(stageId);
    return;
  }
  const firstCompletion = !activeSave.completed.includes(stageId);
  if (adminUnlocked && adminSave) {
    // Preview the village restoration in memory without writing a student's save.
    if (!adminSave.completed.includes(stageId)) adminSave.completed.push(stageId);
    adminSave.evidence[stageId] = summary;
  }
  if (!adminUnlocked && !completeStage(save, stageId, summary)) toast('기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
  if (firstCompletion && activeSave.completed.includes(stageId)) villageCelebration = stageId;
  tone(710); window.setTimeout(() => tone(780), 200);
  const stage = stages.find(item => item.id === stageId)!;
  const challenge = challenges(activeSave).find(item => item.id === stageId)!;
  // A tool card is shown only the first time a mission is completed; it is recomputed, never stored.
  const newCard = firstCompletion && activeSave.completed.includes(stageId) ? toolCards(activeSave).find(card => card.stage === stageId) : undefined;
  // The changed village opens only after the stage's questions are solved.
  const reviewTask = learningTask(activeSave, stageId);
  const reviewSolved = () => !reviewTask || learningRecordComplete(reviewTask, activeSave.learning?.[stageId] ?? { signature: '', answers: [], completed: false });
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="world-title">
      <div class="modal-emblem">${icons.sparkle}</div>
      <p class="eyebrow">${adminUnlocked ? '관리자 미리보기 · 실험 결과' : '새로운 발견 · 실험실 복구!'}</p>
      <h2 id="world-title">${stage.evidence}</h2>
      ${newCard ? toolCardRevealMarkup(newCard) : ''}
      <div class="discovery-recap"><img src="/assets/game/corgi-success.webp" alt=""><div><strong class="discovery-key">${escapeHtml(toolCardInfo[stageId].idea)}</strong>${guessMarkup(predictionRecap(activeSave, stageId))}</div></div>
      <div class="world-concept"></div>
      ${reviewTask ? `<section class="world-review question-zone question-zone-compact"><span class="question-label">마을로 가기 전 문제</span><p class="question-prompt">내 실험 기록을 보고 문제를 풀어요</p><button class="button button-primary" id="world-review">문제 풀기</button></section>` : ''}<details class="discovery-detail"><summary>도전 과제 (선택)</summary><p>${challenge.done ? `${challenge.label} 완료` : challenge.hint}</p><p class="discovery-record">${escapeHtml(summary)}</p></details>
      ${adminUnlocked ? '<p class="small-note">미리보기 결과는 학생 진행 기록에 반영되지 않습니다.</p>' : `<div class="world-meter"><span style="width:${save.completed.length * 20}%"></span></div><p class="small-note">전체 실험실 복구 ${save.completed.length * 20}% · 미션 ${save.completed.length}/5 완료</p>`}
      <button class="button button-primary" id="world-continue">달라진 마을 보러 가기</button><p class="world-lock-note" id="world-lock-note" role="status"></p>
    </div>`;
  document.body.append(modal);
  playVoiceLine(`npc-dialogue/${stageId}-discovery`);
  confetti(modal.querySelector<HTMLElement>('.modal-card')!);
  const appWasInert = app.inert;
  app.inert = true;
  const next = modal.querySelector<HTMLButtonElement>('#world-continue')!;
  const reviewButton = modal.querySelector<HTMLButtonElement>('#world-review');
  syncConceptButton(modal.querySelector('.world-concept')!, stageId, true);
  const syncLock = () => {
    const solved = reviewSolved() || adminUnlocked;
    next.disabled = !solved;
    modal.querySelector<HTMLElement>('#world-lock-note')!.textContent = solved ? '' : '위의 문제를 풀면 달라진 마을을 볼 수 있어요.';
    modal.querySelector('.world-review')?.classList.toggle('is-solved', solved);
    if (reviewButton) { reviewButton.textContent = solved ? '✓ 문제 다시 보기' : '문제 풀기'; reviewButton.className = `button ${solved ? 'button-secondary' : 'button-primary'}`; }
  };
  syncLock();
  const dismiss = () => { if (closeMissionResult !== dismiss) return; closeMissionResult = null; stopVoiceLine(); app.inert = appWasInert; modal.remove(); };
  closeMissionResult = dismiss;
  modal.addEventListener('modal-dismiss', dismiss);
  const close = () => { dismiss(); navigate('map'); };
  reviewButton?.addEventListener('click', () => {
    modal.hidden = true;
    const restore = () => { closeWorkshopReview = null; modal.hidden = false; syncLock(); (next.disabled ? reviewButton : next).focus(); };
    closeWorkshopReview = openLearningReview({ app, save: activeSave, stage: stageId, commit: () => { if (!adminUnlocked) persist(); }, onClose: restore, onDone: restore });
    if (!closeWorkshopReview) restore();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll<HTMLElement>('button,summary')].filter(el => el.getClientRects().length);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  });
  next.addEventListener('click', close, { once: true });
  (next.disabled && reviewButton ? reviewButton : next).focus();
}

function openWorkshopReviewGate(stageId: StageId) {
  if (closeWorkshopReview || document.querySelector('#world-title')) return;
  const stage = stages.find(item => item.id === stageId)!;
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  modal.innerHTML = `<div class="modal-card review-gate" role="dialog" aria-modal="true" aria-labelledby="world-title">
      <div class="modal-emblem">${icons.check}</div>
      <p class="eyebrow">MISSION 0${stage.mission} · 실험 완료!</p>
      <h2 id="world-title">마지막으로 문제를 풀어요</h2>
      <section class="world-review question-zone question-zone-compact"><span class="question-label">마을로 가기 전 문제</span><p class="question-prompt">내 실험 기록을 보고 문제를 풀어요</p><button class="button button-primary" id="gate-review">문제 풀기</button></section>
      <p class="world-lock-note">문제를 다 풀면 도구 카드를 받고, 달라진 마을을 볼 수 있어요.</p>
      <button class="button button-secondary" id="gate-back">실험 더 해 보기</button>
    </div>`;
  document.body.append(modal);
  const appWasInert = app.inert;
  app.inert = true;
  const review = modal.querySelector<HTMLButtonElement>('#gate-review')!;
  const close = () => { if (closeMissionResult !== close) return; closeMissionResult = null; app.inert = appWasInert; modal.remove(); };
  closeMissionResult = close;
  review.addEventListener('click', () => {
    modal.hidden = true;
    const back = () => {
      closeWorkshopReview = null;
      const pending = save.pendingStage;
      if (pending?.id === stageId && questionsSolved(save, stageId)) { close(); finishWorkshopWithEvidence(stageId, pending.summary); return; }
      modal.hidden = false; review.focus();
    };
    closeWorkshopReview = openLearningReview({ app, save, stage: stageId, commit: () => persist(), onClose: back, onDone: back });
    if (!closeWorkshopReview) back();
  });
  modal.querySelector('#gate-back')!.addEventListener('click', close);
  modal.addEventListener('modal-dismiss', close);
  review.focus();
}

function finishWithEvidence(stageId: StageId, summary: string) {
  if (closeMissionResult) return;
  const activeSave = adminSave ?? save;
  const stage = stages.find(item => item.id === stageId)!;
  const challenge = challenges(activeSave).find(item => item.id === stageId)!;
  const firstCompletion = !activeSave.completed.includes(stageId);
  const task = firstCompletion && !adminUnlocked ? missionReviewTask(activeSave, stageId) : null;
  const record = task ? missionReviewRecord(activeSave, task) : null;
  if (task && record) {
    activeSave.learning ??= {};
    activeSave.learning[stageId] = record;
    if (!learningRecordComplete(task, record) && !markExperimentDone(save, stageId, summary)) toast('기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
  }
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  modal.innerHTML = `<div class="modal-card${task ? ' mission-result-with-review' : ''}" role="dialog" aria-modal="true" aria-labelledby="world-title">
      <div class="modal-emblem">${icons.sparkle}</div>
      <p class="eyebrow" id="world-status" role="status">${adminUnlocked ? '관리자 미리보기 · 실험 결과' : '실험 기록을 모았어요'}</p>
      <h2 id="world-title">${stage.evidence}</h2>
      <section class="mission-result-review" aria-label="내 기록으로 확인하기" ${task ? '' : 'hidden'}></section>
      <div class="mission-result-reward" hidden>
        <div class="mission-card-earned"></div>
        <div class="discovery-recap"><img src="/assets/game/corgi-success.webp" alt=""><div><strong class="discovery-key">${escapeHtml(toolCardInfo[stageId].idea)}</strong>${guessMarkup(predictionRecap(activeSave, stageId))}</div></div>
        <div class="world-concept"></div>
        <details class="discovery-detail"><summary>내 기록과 도전 과제</summary><p>${challenge.done ? `${challenge.label} 완료` : escapeHtml(challenge.hint)}</p><p class="discovery-record">${escapeHtml(summary)}</p></details>
      </div>
      <div class="mission-result-actions"><button type="button" class="button button-secondary" id="world-back"${task ? '' : ' hidden'}>실험 더 해 보기</button><button type="button" class="button button-primary" id="world-continue" disabled>달라진 마을 보러 가기</button></div>
    </div>`;
  const card = modal.querySelector<HTMLElement>('.modal-card')!;
  const review = modal.querySelector<HTMLElement>('.mission-result-review')!;
  const reward = modal.querySelector<HTMLElement>('.mission-result-reward')!;
  const back = modal.querySelector<HTMLButtonElement>('#world-back')!;
  const next = modal.querySelector<HTMLButtonElement>('#world-continue')!;
  const opener = document.activeElement as HTMLElement | null;
  const appWasInert = app.inert;
  const close = () => {
    if (closeMissionResult !== close) return;
    closeMissionResult = null;
    stopVoiceLine();
    app.inert = appWasInert;
    modal.remove();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  closeMissionResult = close;
  app.inert = true;
  document.body.append(modal);
  const unlockResult = () => {
    if (!next.disabled) return;
    if (adminUnlocked && adminSave) {
      if (firstCompletion) adminSave.completed.push(stageId);
      adminSave.evidence[stageId] = summary;
    } else if (!completeStage(save, stageId, summary)) toast('기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
    if (firstCompletion && activeSave.completed.includes(stageId)) {
      villageCelebration = stageId;
      const newCard = toolCards(activeSave).find(item => item.stage === stageId);
      if (newCard) reward.querySelector('.mission-card-earned')!.innerHTML = toolCardRevealMarkup(newCard);
      confetti(card);
      tone(710); window.setTimeout(() => tone(780), 200);
    }
    if (!adminUnlocked) modal.querySelector('#world-status')!.textContent = `실험실 복구 · ${save.completed.length}/5 완료`;
    syncConceptButton(reward.querySelector('.world-concept')!, stageId, true);
    reward.hidden = false;
    playVoiceLine(`npc-dialogue/${stageId}-discovery`);
    back.hidden = true;
    if (task) {
      const message = review.querySelector('.mission-review-feedback')!.textContent;
      const feedback = document.createElement('p');
      feedback.className = 'mission-result-found';
      feedback.textContent = message;
      review.replaceChildren(feedback);
      card.classList.remove('mission-result-with-review');
    }
    next.disabled = false;
    next.focus({ preventScroll: true });
  };
  if (task && record) {
    mountMissionReview(review, task, record, correct => {
      if (correct) unlockResult(); else persist();
    });
    if (learningRecordComplete(task, record)) unlockResult();
    else review.querySelector<HTMLButtonElement>('[data-review-choice]')?.focus({ preventScroll: true });
  } else unlockResult();
  back.addEventListener('click', close);
  modal.addEventListener('modal-dismiss', close);
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape' && next.disabled) { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled),summary')].filter(el => el.getClientRects().length);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  });
  next.addEventListener('click', () => {
    close(); navigate('map');
  }, { once: true });
}

const context: AppContext = { save, commit: persist, navigate, finish, toast, sound: tone, cue };

function setAdminMode(enabled: boolean) {
  adminUnlocked = enabled;
  adminSave = enabled ? JSON.parse(JSON.stringify(save)) as SaveData : null;
  context.save = adminSave ?? save;
  if (!enabled && ((stages.some(stage => stage.id === viewPage && !stageIsOpen(save, stage.id))) ||
    (viewPage === 'complete' && save.completed.length < stages.length))) viewPage = 'map';
}

/** One line for the completion modal: the student's guess and whether the records agreed. */
function guessMarkup(recap: PredictionRecap): string {
  if (!recap.predicted) return '';
  return `<p class="discovery-guess" data-matched="${recap.matched}"><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted)}<b>${recap.matched ? '✓ 처음 생각과 같아요!' : '실험으로 새로 알았어!'}</b></p>`;
}

/** First thought, what the records showed, and whether they matched — never a score. */
function predictionMarkup(recap: PredictionRecap, className = 'discovery-prediction'): string {
  const verdict = predictionVerdict(recap);
  return `<div class="${className} prediction-recap" data-matched="${recap.matched ?? 'none'}"><p><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted ?? '기록된 예상이 없어')}</p><p><span class="prediction-tag is-result">실제 결과</span>${escapeHtml(recap.result)}</p>${verdict ? `<strong class="prediction-verdict">${verdict}</strong>` : ''}</div>`;
}

let ceremonyWait = 0;
function openEndingCeremony() {
  // The card-collection jingle is the "all driven off" cheer: the film and its music wait until it has finished.
  const jingle = soundLeft('cardComplete');
  if (jingle > 0) {
    if (!ceremonyWait) ceremonyWait = window.setTimeout(() => { ceremonyWait = 0; openEndingCeremony(); }, jingle + 150);
    return;
  }
  stopSounds();
  if (!adminUnlocked && !canPlayMapFinale(save)) {
    toast(`지도 악당 5마리를 모두 물리치면 점등식 영상이 열려요. 지금 ${defeatedMapVillains(save)} / 5`);
    return;
  }
  if (document.querySelector('.story-layer')) return;
  const fromMap = viewPage === 'map';
  openStoryModal({
    finale: true,
    video: endingVideo,
    music: 'ending',
    scenes:[1,2,3].map(i=>`/assets/story/final-0${i}.webp`),
    lines:[
      {who:'코기 콩이',text:'딸깍! 떨어져 있던 배터리 코어를 중앙 장치에 다시 끼웠어!'},
      {who:'도토리 박사',text:'무게를 확인하고, 막힌 길을 열고, 도구를 비교했지. 네 건물에서 배운 방법으로 무거운 코어를 옮긴 거야.'},
      {who:'코기 콩이',text:'와, 코어가 다시 연결되니까 마을 전체에 전기가 돌아왔어! 우리가 힘을 모아 우당탕 마을을 다시 밝혔네!'},
    ],finishLabel:'지도로 돌아가기',onDone:()=>{
      if (!adminUnlocked && save.mapFinalePending) { save.mapFinalePending = false; persist(); }
      if (!fromMap) navigate('map');
    },
  });
}
const missionCardShown = new Set<StageId>();
function openMissionCard(stageId: StageId) { openMissionCardPanel(stageId, { app, activeSave: () => adminSave ?? save, adminUnlocked: () => adminUnlocked, tone, persist, render }); }

let backNavigation = false;
window.addEventListener('popstate', event => {
  const page = (event.state as { page?: PageId } | null)?.page;
  if (!page || page === viewPage) return;
  closeWorkshopReview?.();
  closeMissionResult?.();
  // Modals with global listeners or media listen for modal-dismiss and tear themselves down first.
  document.querySelectorAll('.modal-layer').forEach(node => { node.dispatchEvent(new Event('modal-dismiss')); node.remove(); }); app.inert = false;
  backNavigation = true;
  if (page === 'title') { viewPage = 'title'; render(); } else navigate(page);
  backNavigation = false;
});
history.replaceState({ page: 'title' }, '');
function goBack() {
  const target = pageHistory.pop() ?? 'map';
  backNavigation = true;
  navigate(target);
  backNavigation = false;
}

function header(title: string, subtitle: string) {
  const count = earnedToolCards(adminSave ?? save).length;
  const toolBag = `<button class="icon-button" data-top="bag" aria-label="도구 가방 열기, 카드 ${count}장" aria-haspopup="dialog" title="도구 가방">${bagIcon()}${count ? `<span class="toolbag-count" aria-hidden="true">${count}</span>` : ''}</button>`;
  return `<header class="topbar">
    <div class="top-nav">
      <button class="icon-button" data-top="back" aria-label="이전 페이지로" title="이전"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5l-7 7 7 7"/></svg></button>
      ${viewPage === 'map' ? '' : `<button class="icon-button" data-top="home" aria-label="작전 지도로" title="작전 지도"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></button>`}
    </div>
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="34" height="34"><path d="M18 5h12M21 6v13L11 35a5 5 0 0 0 4 8h18a5 5 0 0 0 4-8L27 19V6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 32h18l4 6-3 5H14l-3-5z" fill="#73bba2"/><circle cx="20" cy="35" r="2" fill="#f6b45e"/><circle cx="28" cy="38" r="2" fill="#f6b45e"/></svg></span><span>우당탕<br><strong>힘 실험실</strong></span></div>
    <div class="topbar-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기 · 학생 기록과 분리' : '초등 3학년 과학 · 힘과 우리 생활'}</span><strong>${title}</strong><span>${subtitle}</span></div>
    <div class="top-actions">
      ${viewPage === 'map' ? '' : toolBag}
      ${rewardSlotsHtml(adminSave ?? save)}
      <button class="icon-button" data-top="sound" aria-label="소리 ${anySound() ? '끄기' : '켜기'}" aria-pressed="${anySound()}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
  </header>`;
}

function settingsIcon() {
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 14 5l2.5-.3.8 2.4 2.2 1.2-.8 2.4.8 2.4-2.2 1.2-.8 2.4-2.5-.3-2 1.5-2-1.5-2.5.3-.8-2.4-2.2-1.2.8-2.4-.8-2.4 2.2-1.2.8-2.4L10 5z"/><circle cx="12" cy="11.2" r="2.6"/></svg>`;
}

/** True while effects, music or voices are on: the header speaker shows sound and mutes all three. */
function anySound() { return save.soundOn || save.musicOn === true || save.voiceOn === true; }
/** The sound settings a fresh start keeps. */
function soundPrefs(from: SaveData) { return { soundOn: from.soundOn, musicOn: from.musicOn, voiceOn: from.voiceOn, soundVolume: from.soundVolume, effectVolume: from.effectVolume }; }
function soundIcon() {
  return `<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${anySound() ? '<path d="M17 8a5 5 0 0 1 0 8M19.5 5a9 9 0 0 1 0 14"/>' : '<path d="m17 9 4 6m0-6-4 6"/>'}</svg>`;
}

/** In-app yes/no box; window.confirm looks like a browser error on tablets. Resolves true only on the confirm button. */
function confirmBox(title: string, body: string, okLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'stage-popup confirm-popup';
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    dialog.innerHTML = `<div class="stage-popup-card"><h2 id="confirm-title">${title}</h2><div class="stage-popup-body"><p>${body}</p></div><div class="stage-popup-actions"><button class="button button-secondary" data-confirm="no">취소</button><button class="button button-primary" data-confirm="yes">${okLabel}</button></div></div>`;
    let answer = false;
    dialog.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-confirm]');
      if (button) { answer = button.dataset.confirm === 'yes'; dialog.close(); }
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(answer); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-confirm="no"]')!.focus();
  });
}

/** Teacher check before the admin preview. Not a security feature: the value ships in the client. */

function renderTitle(root: HTMLElement) {
  const hasSave = readSave() !== null;
  root.innerHTML = `<section class="title-screen">
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
  </section>`;
  // The three pose sheets (~1MB) take their class — and start downloading — only after the title logo and buttons have painted.
  const reveal = () => root.querySelectorAll<HTMLElement>('[data-pose]').forEach(node => node.classList.add(node.dataset.pose!));
  if (document.readyState === 'complete') requestAnimationFrame(reveal);
  else window.addEventListener('load', () => window.setTimeout(reveal, 250), { once: true });
  bindHeader();
  root.querySelector<HTMLButtonElement>('#new-start')?.addEventListener('click', async () => {
    if (hasSave && !await confirmBox('기존 탐구 기록을 지우고 새로 시작할까요?', '도구 카드와 실험 기록이 이 기기에서 모두 지워져요. 소리 설정은 그대로예요.', '기록 지우고 시작')) return;
    adminUnlocked = false;
    adminSave = null;
    save = { ...freshSave(), ...soundPrefs(save) };
    missionCardShown.clear();
    villageReturn = undefined;
    villageCelebration = undefined;
    context.save = save;
    tone(460);
    openStoryModal({ lines: prologueLines, finishLabel: '출발!', skippable: true, onDone: () => navigate('map'), video: introVideo });
  });
  root.querySelector<HTMLButtonElement>('#continue')?.addEventListener('click', () => {
    const loaded = readSave();
    if (!loaded) return;
    adminUnlocked = false;
    adminSave = null;
    save = loaded;
    context.save = save;
    const resume = save.mapFinalePending || save.currentPage === 'title' || (save.currentPage === 'complete' && save.completed.length < stages.length) ? 'map' : save.currentPage;
    navigate(resume);
  });
}

async function restartFromBeginning() {
  if(!await confirmBox('처음부터 다시 해볼까요?', '도구 카드와 실험 기록을 지우고 처음부터 시작해요. 소리 설정은 그대로예요.', '처음부터 다시 시작')) return;
  const previous=context.save;
  save={...freshSave(),...soundPrefs(previous)};
  adminUnlocked=false; adminSave=null; context.save=save; missionCardShown.clear(); villageReturn=undefined; villageCelebration=undefined;
  persist(); navigate('title');
  openStoryModal({lines:prologueLines,finishLabel:'출발!',skippable:true,onDone:()=>navigate('map'),video:introVideo});
}

function renderComplete(root: HTMLElement) {
  const save = adminSave ?? context.save;
  const completed = save.completed.length;
  root.innerHTML = `<section class="complete-screen">
    <div class="ending-world" aria-label="다시 빛나는 힘 마을"><div class="ending-rays"></div><div class="ending-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기' : '배터리를 다시 끼웠어 · 마을에 전기가 돌아왔어'}</span><h1>네가 마을을 살렸어!</h1><p>실험에서 찾은 방법으로 배터리 코어를 옮겨 다시 장착했어.<br>전기가 돌아와 우당탕 마을에 다시 불이 켜졌어.</p><div class="ending-actions"> ${adminUnlocked || canPlayMapFinale(save) ? '<button class="button button-primary" id="replay-ending">마을 점등식 다시 보기 ✦</button>' : `<p>지도에서 악당 5마리를 물리치면 점등식 영상이 열려요. 지금 ${defeatedMapVillains(save)} / 5</p>`}<button class="button button-primary" id="restart-ending">처음부터 다시 해보기 ↻</button></div></div></div>
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
  root.querySelector<HTMLButtonElement>('#back-map')?.addEventListener('click', () => navigate('map'));
  root.querySelectorAll<HTMLButtonElement>('[data-toolcard]').forEach(button => button.addEventListener('click', () => {
    tone(470); openToolBag({ app, save, open: button.dataset.toolcard as StageId, sound: () => tone(470), preview: adminUnlocked });
  }));
  root.querySelector('#challenge-count')!.textContent = `${challenges(save).filter(item => item.done).length} / 5`;
  root.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach(button => button.addEventListener('click', () => {
    if (adminUnlocked) return;
    const index = Number(button.dataset.ability);
    const set = new Set(save.abilities ?? []);
    if (set.has(index)) set.delete(index); else set.add(index);
    save.abilities = [...set].sort();
    button.setAttribute('aria-pressed', String(set.has(index)));
    button.querySelector('span')!.textContent = set.has(index) ? '✓' : '';
    tone(set.has(index) ? 700 : 470); persist();
  }));
  const ending = root.querySelector<HTMLElement>('.ending-world')!;
  const replay = () => { ending.classList.remove('lit'); void ending.offsetWidth; ending.classList.add('lit'); tone(760); };
  root.querySelector('#replay-ending')?.addEventListener('click', openEndingCeremony);
  root.querySelector('#restart-ending')?.addEventListener('click', restartFromBeginning);
  root.querySelectorAll<HTMLButtonElement>('.report-concept').forEach(button => button.addEventListener('click', () => openConceptClip(button.dataset.concept as StageId)));
  replay();
}

const settingsHost: SettingsHost = {
  app, save: () => save, adminSave: () => adminSave, adminUnlocked: () => adminUnlocked,
  tone, toast, persist, navigate, setAdminMode, updateSoundButton, syncMusic, openEndingCeremony,
  resetRecords() {
    const sound = soundPrefs(save);
    adminUnlocked = false; adminSave = null;
    save = { ...freshSave(), ...sound }; context.save = save; missionCardShown.clear();
    persist(); viewPage = 'title'; render();
  },
  goTitle() { viewPage = 'title'; render(); },
};
function openSettings(focusAction?: 'bag') { openSettingsPanel(settingsHost, focusAction); }

function updateSoundButton() {
  const button = app.querySelector<HTMLButtonElement>('[data-top="sound"]');
  if (!button) return;
  button.innerHTML = soundIcon();
  button.setAttribute('aria-pressed', String(anySound()));
  button.setAttribute('aria-label', `소리 ${anySound() ? '끄기' : '켜기'}`);
}
function bindHeader() {
  // One quick switch for the classroom: it mutes everything, or brings back music, effects and voices together.
  app.querySelector<HTMLButtonElement>('[data-top="sound"]')?.addEventListener('click', () => {
    const on = !anySound();
    save.soundOn = on; save.musicOn = on; save.voiceOn = on;
    persist();
    updateSoundButton();
    if (on) tone(620); else { stopSounds(); stopAllVoices(); }
    syncMusic();
  });
  app.querySelector<HTMLButtonElement>('[data-top="settings"]')?.addEventListener('click', () => openSettings());
  app.querySelector<HTMLButtonElement>('[data-top="bag"]')?.addEventListener('click', () => { tone(470); openToolBag({ app, save: adminSave ?? save, sound: () => tone(470), preview: adminUnlocked }); });
  app.querySelector<HTMLButtonElement>('[data-top="back"]')?.addEventListener('click', goBack);
  app.querySelector<HTMLButtonElement>('[data-top="home"]')?.addEventListener('click', () => { if (viewPage !== 'map') navigate('map'); });
}

function render() {
  cleanup?.();
  cleanup = undefined;
  let title = '고장 난 실험실을 복구해요';
  let subtitle = '직접 실험해서 힘의 원리를 발견해요';
  const stage = stages.find(item => item.id === viewPage);
  if (stage) { title = stage.title; subtitle = `MISSION 0${stage.mission} · ${stage.concept}`; }
  if (viewPage === 'map') { title = '우당탕 과학 마을'; subtitle = '실험을 마치면 마을이 달라져요'; }
  if (viewPage === 'complete') { title = '나의 탐구 결과'; subtitle = '실험실 복구 완료'; }
  app.innerHTML = `${viewPage === 'title' ? '' : header(title, subtitle)}<main id="screen" class="screen"></main><aside class="orientation-hint" role="status"><span aria-hidden="true">${icons.rotateLeft}${icons.landscape}</span><h2>가로로 펼치면 실험실이 보여요!</h2><p>태블릿은 가로로 돌리고,<br>웹에서는 창을 가로로 넓혀 주세요.</p><small>진행 중인 실험은 그대로 이어져요.</small></aside>`;
  bindHeader();
  syncMusic();
  const screen = app.querySelector<HTMLElement>('#screen')!;
  switch (viewPage) {
    case 'title': renderTitle(screen); break;
    case 'map': {
      cleanup = mountVillage(screen, context, { adminUnlocked, returnedFrom: villageReturn, newlyCompleted: villageCelebration, onFinale: openEndingCeremony });
      villageCelebration = undefined;
      break;
    }
    case 'cargo': cleanup = mountCargo(screen, context); break;
    case 'balance': cleanup = mountBalance(screen, context); break;
    case 'scale': cleanup = mountScale(screen, context); break;
    case 'rescue': cleanup = mountRescue(screen, context); break;
    case 'workshop': cleanup = mountWorkshop(screen, context); break;
    case 'complete': renderComplete(screen); break;
  }
  const entered = stages.find(item => item.id === viewPage);
  // Came back (or reloaded) with the questions still open: resume them before anything else.
  if (entered && !adminUnlocked && save.pendingStage?.id === entered.id && !save.completed.includes(entered.id)) { missionCardShown.add(entered.id);
    if (entered.id === 'workshop') finishWorkshopWithEvidence('workshop', save.pendingStage.summary);
    else finishWithEvidence(entered.id, save.pendingStage.summary); }
  else if (entered && !missionCardShown.has(entered.id)) { missionCardShown.add(entered.id); openMissionCard(entered.id); }
  if (entered) watchFinish(screen, entered.id);
}

/* The stage's own finish button is hidden; when it unlocks, a centred "다 했어요!" popup offers the same action. */
function watchFinish(screen: HTMLElement, stageId: StageId) {
  const button = screen.querySelector<HTMLButtonElement>('.experiment-footer .button');
  if (!button) return;
  let shown = false, stopped = false, retryTimer = 0;
  let finishDialog: HTMLDialogElement | null = null;
  const show = () => {
    if (stopped || shown || button.disabled || !button.isConnected) return;
    if (screen.querySelector('dialog[open] .stage-result-finish')) { shown = true; button.classList.add('is-ready'); return; }
    // Wait for the stage's own result popup or a letter to close so the two never stack.
    if (document.querySelector('dialog[open], .modal-layer')) { clearTimeout(retryTimer); retryTimer = window.setTimeout(show, 400); return; }
    shown = true;
    const dialog = document.createElement('dialog');
    finishDialog = dialog;
    dialog.className = 'stage-popup stage-finish';
    dialog.innerHTML = `<div class="stage-popup-card"><span class="stage-popup-label">MISSION 0${stages.find(item => item.id === stageId)!.mission} 완료</span><span class="stage-stamp" aria-hidden="true">✓ 완료</span><h2>다 했어요! 멋져요</h2><button class="stage-popup-close" aria-label="닫기">×</button><div class="stage-popup-body"><p>${finishLines[stageId]}</p></div><div class="stage-popup-actions"><button class="stage-finish-later">조금 더 실험할래요</button><button class="button button-primary stage-finish-go">${button.textContent}</button></div></div>`;
    dialog.querySelector('.stage-popup-close')!.addEventListener('click', () => dialog.close());
    dialog.querySelector('.stage-finish-later')!.addEventListener('click', () => dialog.close());
    dialog.querySelector('.stage-finish-go')!.addEventListener('click', () => { dialog.close(); button.click(); });
    dialog.addEventListener('close', () => { dialog.remove(); button.classList.add('is-ready'); });
    document.body.append(dialog); dialog.showModal(); tone(700); window.setTimeout(() => tone(760), 160);
    window.setTimeout(() => dialog.querySelector('.stage-stamp')?.classList.add('is-stamped'), 60);
  };
  // Result animations schedule their own popup first; do not race it with a second modal.
  const scheduleShow = () => { clearTimeout(retryTimer); retryTimer = window.setTimeout(show, 900); };
  const observer = new MutationObserver(scheduleShow);
  observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
  const stop = () => { stopped = true; clearTimeout(retryTimer); observer.disconnect(); finishDialog?.close(); finishDialog?.remove(); };
  const previous = cleanup; cleanup = () => { stop(); previous?.(); };
  scheduleShow();
}
const finishLines: Record<StageId, string> = {
  cargo: '빵집 주문을 다 배달했어요. 이제 운반 레일을 고칠 수 있어요!',
  balance: '어느 쪽이 무거운지 수평대로 알아냈어요. 발견을 저장해요!',
  scale: '저울로 무게를 비교했어요. 비교 기록을 저장해요!',
  workshop: '지레와 빗면으로 힘을 줄이는 법을 찾았어요. 생활 속 도구를 찾으러 가요!',
  rescue: '코어가 중앙 장치에 도착했어요. 다시 장착해 마을의 전기를 되찾아요!',
};

render();
// The offline worker installs after the title has settled so its precache never competes with the first paint.
const startOffline = () => { if ('requestIdleCallback' in window) window.requestIdleCallback(prepareOffline, { timeout: 3000 }); else prepareOffline(); };
window.addEventListener('load', () => window.setTimeout(startOffline, 3000), { once: true });
// After a deploy the shell this tab loaded may point at chunks that no longer exist; one reload fetches the fresh shell.
window.addEventListener('vite:preloadError', () => {
  try {
    const last = Number(sessionStorage.getItem('force-lab-reload') ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('force-lab-reload', String(Date.now()));
  } catch { return; }
  location.reload();
});

