import './style.css';
import './adventure.css';
import './display.css';
import './settings.css';
import './polish.css';
import './learning.css';
import './missionProgress.css';
import './questionUI.css';
import './storyVideo.css';
import { openLifeObservation } from './lifeObservation';
import { stages, type PageId, type StageId } from './data';
import { completeStage, freshSave, readSave, requestsEnabled, stageIsOpen, writeSave, type SaveData } from './state';
import { mountCargo } from './screens/cargo';
import { mountBalance } from './screens/balance';
import { mountScale } from './screens/scale';
import { mountWorkshop } from './screens/workshop';
import { mountRescue } from './screens/rescue';
import { mountVillage } from './screens/village';
import { villageRewards } from './villageStory';
import { playSound, stopSounds, setVolume } from './sound';
import { infoContent, type InfoSection } from './info';
import { offlineMessage, prepareOffline, watchOffline } from './offline';
import { diagnosticMarkup } from './diagnostics';
import type { AppContext } from './appTypes';
import { abilityStatements, challenges } from './challenges';
import { openLearningReview } from './learningReview';
import { learningTask, learningRecordComplete, learningSummary } from './learningModel';
import { stageStars, totalStars, type StageStars } from './stars';
import { inquiryPlans, predictionRecap, predictionVerdict, type PredictionRecap } from './inquiryPlan';
import { earnedToolCards, toolCardInfo, toolCards, toolCardsText } from './toolCards';
import { bagIcon, openToolBag, toolCardRevealMarkup, toolCardRowMarkup } from './toolBag';
import './studentUx.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
let save: SaveData = readSave() ?? freshSave();
let viewPage: PageId = 'title';
let cleanup: (() => void) | void;
let adminUnlocked = false;
let adminSave: SaveData | null = null;
let villageReturn: StageId | undefined;
let villageCelebration: StageId | undefined;
let closeLearningReview: (() => void) | null = null;
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
  playSound(frequency >= 680 ? 'success' : frequency < 400 ? 'bump' : 'click');
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
  closeLearningReview?.(); closeLearningReview = null;
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
  if (closeLearningReview) return;
  if (stageId === 'workshop') {
    const activeSave = adminSave ?? save;
    openLifeObservation({ app, value: activeSave.lifeObservation,
      onSave: value => { activeSave.lifeObservation = value; if (!adminUnlocked) persist(); },
      onDone: () => {
        const observation = activeSave.lifeObservation!;
        finishWithEvidence(stageId, summary + ' 생활 속 관찰: ' + observation.object.trim() + ' — ' + observation.use.trim() + (observation.shared ? ' (설명했다고 스스로 표시함)' : ' (친구와 나눌 기록)'));
      },
    });
  } else finishWithEvidence(stageId, summary);
}

function finishWithEvidence(stageId: StageId, summary: string) {
  const activeSave = adminSave ?? save;
  const firstCompletion = !activeSave.completed.includes(stageId);
  if (adminUnlocked && adminSave) {
    // Preview the village restoration in memory without writing a student's save.
    if (!adminSave.completed.includes(stageId)) adminSave.completed.push(stageId);
    adminSave.evidence[stageId] = summary;
  }
  if (!adminUnlocked && !completeStage(save, stageId, summary)) toast('기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.');
  if (firstCompletion && activeSave.completed.includes(stageId)) villageCelebration = stageId;
  tone(710);
  const stage = stages.find(item => item.id === stageId)!;
  const challenge = challenges(activeSave).find(item => item.id === stageId)!;
  // A tool card is shown only the first time a mission is completed; it is recomputed, never stored.
  const newCard = firstCompletion && activeSave.completed.includes(stageId) ? toolCards(activeSave).find(card => card.stage === stageId) : undefined;
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="world-title">
      <div class="modal-emblem">✦</div>
      <p class="eyebrow">${adminUnlocked ? '관리자 미리보기 · 실험 결과' : '새로운 발견 · 실험실 복구!'}</p>
      <h2 id="world-title">${stage.evidence}</h2>${starRow(stageStars(activeSave, stageId), true)}
      ${newCard ? toolCardRevealMarkup(newCard) : ''}
      <div class="discovery-recap"><img src="/assets/game/corgi-success.webp" alt=""><div><strong class="discovery-key">${escapeHtml(toolCardInfo[stageId].idea)}</strong>${guessMarkup(predictionRecap(activeSave, stageId))}</div></div>
      <details class="discovery-detail"><summary>더 해 보기 (선택)</summary><p>${challenge.done ? `★ ${challenge.label}` : challenge.hint}</p>${learningTask(activeSave, stageId) ? '<button class="button button-secondary" id="optional-review">내 기록으로 문제 풀기</button>' : ''}<p class="discovery-record">${escapeHtml(summary)}</p></details>
      ${adminUnlocked ? '<p class="small-note">미리보기 결과는 학생 진행 기록에 반영되지 않습니다.</p>' : `<div class="world-meter"><span style="width:${save.completed.length * 20}%"></span></div><p class="small-note">전체 실험실 복구 ${save.completed.length * 20}% · 미션 ${save.completed.length}/5 완료</p>`}
      <button class="button button-primary" id="world-continue">${stageId === 'rescue' ? '마을 점등식 보러 가기 ✦' : '달라진 마을 보러 가기'}</button>
    </div>`;
  document.body.append(modal);
  const appWasInert = app.inert;
  app.inert = true;
  const next = modal.querySelector<HTMLButtonElement>('#world-continue')!;
  const close = () => { app.inert = appWasInert; modal.remove(); navigate('map'); if(stageId==='rescue'&&activeSave.completed.length===stages.length)openEndingCeremony(); };
  modal.querySelector('#optional-review')?.addEventListener('click', () => {
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
  });
  next.addEventListener('click', close, { once: true });
  next.focus();
}

const context: AppContext = { save, commit: persist, navigate, finish, toast, sound: tone };

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
  return `<p class="discovery-guess" data-matched="${recap.matched}"><span class="prediction-tag">내 예상</span>${escapeHtml(recap.predicted)}<b>${recap.matched ? '✓ 맞았어!' : '실험으로 새로 알았어!'}</b></p>`;
}

/** First thought, what the records showed, and whether they matched — never a score. */
function predictionMarkup(recap: PredictionRecap, className = 'discovery-prediction'): string {
  const verdict = predictionVerdict(recap);
  return `<div class="${className} prediction-recap" data-matched="${recap.matched ?? 'none'}"><p><span class="prediction-tag">내 예상</span>${escapeHtml(recap.predicted ?? '기록된 예상이 없어')}</p><p><span class="prediction-tag is-result">실제 결과</span>${escapeHtml(recap.result)}</p>${verdict ? `<strong class="prediction-verdict">${verdict}</strong>` : ''}</div>`;
}
/** Teacher-facing label: requests (level 2) are required by default and can be made optional for short lessons. */
function requestsLabel(): string {
  return requestsEnabled(save) ? '의뢰 레벨 필수 <small>눌러서 선택으로</small>' : '의뢰 레벨 선택 <small>눌러서 필수로</small>';
}
/** Three star slots per mission: completed, level 2 request, challenge. Teacher-off slots read "꺼짐", never as missing. */
function starRow(stars: StageStars, celebrate = false): string {
  return `<ul class="star-row${celebrate ? ' is-celebrating' : ''}" aria-label="별 ${stars.earned}개">${stars.slots.map((slot, i) => `<li class="${slot.done ? 'is-done' : slot.off ? 'is-off' : ''}" style="--i:${i}"><span aria-hidden="true">${slot.done ? '★' : '☆'}</span>${escapeHtml(slot.label)}${slot.off && !slot.done ? ' · 꺼짐' : ''}</li>`).join('')}</ul>`;
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}


const prologueLines = [
  { who: '도토리 박사', text: '큰일이야! 실험실의 동력이 멈춰서 마을의 불이 다 꺼졌어.' },
  { who: '도토리 박사', text: '다섯 건물에서 힘의 증거를 모아 줘. 그 기록으로 마지막 코어를 옮길 길을 찾을 수 있어.' },
  { who: '코기 콩이', text: '킁킁! 내가 실험 단서를 찾아줄게. 너는 먼저 예상하고, 직접 움직인 뒤 결과를 비교해 줘!' },
];
type StoryVideo = { src: string; cues: number[]; duration: number; poster?: string };
type StoryOptions = { lines: { who: string; text: string }[]; finishLabel: string; onDone?: () => void; skippable?: boolean; scenes?: string[]; video?: StoryVideo };
const introVideo: StoryVideo = { src: '/assets/story/intro.mp4', cues: [0, 6, 12], duration: 16 };
const endingVideo: StoryVideo = { src: '/assets/story/ending.mp4', cues: [0, 4, 10], duration: 16 };
function storyCueIndex(cues: number[], time: number): number {
  let found = 0;
  cues.forEach((start, i) => { if (time >= start) found = i; });
  return found;
}
function openStoryModal(options: StoryOptions) {
  const modal = document.createElement('div');
  modal.className = 'modal-layer story-layer';
  const appWasInert = app.inert; app.inert = true;
  const opener = document.activeElement as HTMLElement | null;
  let index = 0;
  let closed = false;
  let teardownVideo: (() => void) | null = null;
  const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && modal.querySelector('.story-video-card')) { event.preventDefault(); tone(470); close(); } };
  const close = () => {
    if (closed) return; closed = true;
    teardownVideo?.(); teardownVideo = null;
    document.removeEventListener('keydown', onEscape, true);
    app.inert = appWasInert; modal.remove();
    if (opener?.isConnected) opener.focus?.();
    options.onDone?.();
  };
  const draw = () => {
    const line = options.lines[index];
    const last = index === options.lines.length - 1;
    modal.innerHTML = `<div class="modal-card story-card" role="dialog" aria-modal="true" aria-labelledby="story-title">
      <div class="story-scene cinematic-scene" data-scene="${index}"><img class="story-frame" src="${options.scenes?.[index] ?? `/assets/story/intro-0${index+1}.webp`}" alt="${options.scenes?'다섯 실험으로 다시 빛나는 힘 마을':'동력이 멈춰 불이 꺼진 힘 마을'}"></div>
      <p class="eyebrow" id="story-title">${line.who}</p>
      <p class="story-text">${line.text}</p>
      <div class="story-dots">${options.lines.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>
      <div class="story-actions">${options.skippable && !last ? '<button class="button button-secondary" data-story="skip">건너뛰기</button>' : ''}<button class="button button-primary" data-story="next">${last ? options.finishLabel : '다음 →'}</button></div>
    </div>`;
    modal.querySelector<HTMLButtonElement>('[data-story="next"]')!.focus();
  };
  const drawVideo = (video: StoryVideo) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dots = options.lines.map(() => '<i></i>').join('');
    modal.innerHTML = `<div class="modal-card story-card story-video-card" role="dialog" aria-modal="true" aria-labelledby="story-title" aria-describedby="story-caption">
      <div class="story-scene cinematic-scene story-video-wrap">
        <video class="story-video" playsinline controls preload="auto" ${video.poster ? `poster="${video.poster}"` : ''} aria-label="${options.scenes ? '엔딩 영상' : '프롤로그 영상'}" src="${video.src}"></video>
        <img class="story-end-frame" src="${options.scenes?.at(-1) ?? `/assets/story/intro-0${options.lines.length}.webp`}" alt="" hidden>
        <button type="button" class="button button-primary story-play" data-story="play" hidden>▶ 영상 재생</button>
      </div>
      <p class="eyebrow" id="story-title"></p>
      <p class="story-text story-caption" id="story-caption" role="status" aria-live="polite"></p>
      <div class="story-dots" aria-hidden="true">${dots}</div>
      <div class="story-actions"><button class="button button-secondary" data-story="skip">건너뛰기</button><button class="button button-primary" data-story="done" hidden>${options.finishLabel}</button></div>
    </div>`;
    const el = modal.querySelector<HTMLVideoElement>('video')!;
    const who = modal.querySelector<HTMLElement>('#story-title')!;
    const caption = modal.querySelector<HTMLElement>('#story-caption')!;
    const dotNodes = Array.from(modal.querySelectorAll<HTMLElement>('.story-dots i'));
    const playBtn = modal.querySelector<HTMLButtonElement>('[data-story="play"]')!;
    const skipBtn = modal.querySelector<HTMLButtonElement>('[data-story="skip"]')!;
    const doneBtn = modal.querySelector<HTMLButtonElement>('[data-story="done"]')!;
    let shown = -1;
    let settled = false;
    const showCue = (i: number) => {
      if (i === shown) return; shown = i;
      who.textContent = options.lines[i].who; caption.textContent = options.lines[i].text;
      dotNodes.forEach((dot, n) => dot.classList.toggle('on', n === i));
    };
    const sync = () => showCue(storyCueIndex(video.cues, el.currentTime));
    const endFrame = modal.querySelector<HTMLImageElement>('.story-end-frame')!;
    const finishUi = () => { el.controls = false; endFrame.hidden = false; showCue(options.lines.length - 1); skipBtn.hidden = true; doneBtn.hidden = false; playBtn.hidden = true; doneBtn.focus(); };
    const tryPlay = () => {
      const result = el.play();
      if (result && typeof result.then === 'function') result.then(() => { playBtn.hidden = true; }).catch(() => { if (!closed) { playBtn.hidden = false; playBtn.focus(); } });
    };
    const fallback = () => {
      if (closed) return;
      teardownVideo?.(); teardownVideo = null;
      draw();
    };
    const timer = window.setTimeout(() => { if (!settled && el.readyState < 1) fallback(); }, 8000);
    const onMeta = () => { window.clearTimeout(timer); settled = true; if (reduced) playBtn.hidden = false; else tryPlay(); };
    const onPlay = () => { playBtn.hidden = true; };
    const onPause = () => { if (!el.ended && !el.seeking) playBtn.hidden = false; };
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('error', fallback);
    el.addEventListener('timeupdate', sync);
    el.addEventListener('seeked', sync);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', finishUi);
    teardownVideo = () => {
      window.clearTimeout(timer);
      el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('error', fallback);
      el.removeEventListener('timeupdate', sync); el.removeEventListener('seeked', sync);
      el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); el.removeEventListener('ended', finishUi);
      el.pause(); el.removeAttribute('src'); el.load();
    };
    playBtn.addEventListener('click', () => { tone(470); tryPlay(); });
    showCue(0);
    skipBtn.focus();
  };
  modal.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-story]');
    if (!button || button.dataset.story === 'play') return;
    tone(470);
    if (button.dataset.story === 'skip' || button.dataset.story === 'done' || index === options.lines.length - 1) { close(); return; }
    index += 1; draw();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    if (modal.querySelector('.story-video-card')) {
      const items = Array.from(modal.querySelectorAll<HTMLElement>('button:not([hidden]), video[controls]'));
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      items[(at + (event.shiftKey ? items.length - 1 : 1)) % items.length].focus();
      return;
    }
    event.preventDefault(); modal.querySelector<HTMLButtonElement>('[data-story="next"]')?.focus();
  });
  document.addEventListener('keydown', onEscape, true);
  document.body.append(modal);
  if (options.video) drawVideo(options.video); else draw();
}
function openEndingCeremony() {
  openStoryModal({
    video: endingVideo,
    scenes:[1,2,3].map(i=>`/assets/story/final-0${i}.webp`),
    lines:[
      {who:'코기 콩이',text:'딸깍! 네가 직접 재고, 당기고, 비교해서 옮긴 코어가 마을의 동력이 됐어!'},
      {who:'도토리 박사',text:'배송소의 물자, 균형 다리, 재료 보급소, 운반 공방, 중앙 코어까지. 네 다섯 발견이 모두 연결됐어.'},
      {who:'코기 콩이',text:'봐, 마을 전체에 불이 켜졌어! 네 예상과 실험으로 우리가 사는 마을을 살린 거야. 정말 뿌듯해!'},
    ],finishLabel:'내가 살린 마을 둘러보기 ✦',onDone:()=>navigate('map'),
  });
}
const missionLearn: Record<StageId, string> = {
  cargo: '무거운 상자와 가벼운 상자를 밀고 당길 때 달라지는 점',
  balance: '수평대에서 어느 쪽이 더 무거운지 알아내는 법',
  scale: '겉모습으로 헷갈리는 무게를 저울로 비교해요.',
  workshop: '지레와 빗면을 쓰면 필요한 힘이 어떻게 달라지는지',
  rescue: '지금까지 배운 것을 모두 써서 코어를 옮기는 법',
};
const missionCardShown = new Set<StageId>();
function openMissionCard(stageId: StageId) {
  const stage = stages.find(item => item.id === stageId)!;
  const plan = inquiryPlans[stageId];
  const activeSave = adminSave ?? save;
  let selected = activeSave.inquiryPlans?.[stageId] ?? '';
  const modal = document.createElement('div');
  modal.className = 'modal-layer story-layer';
  const appWasInert = app.inert; app.inert = true;
  modal.innerHTML = `<div class="modal-card mission-card" role="dialog" aria-modal="true" aria-labelledby="mission-title">
    
    <p class="eyebrow">MISSION 0${stage.mission} · ${stage.concept}</p>
    <h2 id="mission-title">${stage.title}</h2>
    <p class="mission-purpose">${missionLearn[stageId]}</p>
    
    <section class="mission-prediction question-zone" aria-labelledby="mission-question"><span class="question-label">먼저 예상해요 (선택)</span><h3 class="question-prompt" id="mission-question">${plan.prompt}</h3><div class="mission-answer-grid" style="--answer-count:${plan.choices.length}">${plan.choices.map((choice,index) => `<button type="button" data-plan="${choice.id}" aria-pressed="${selected === choice.id}"><span class="answer-number" aria-hidden="true">${index+1}</span><span>${choice.label}</span></button>`).join('')}</div></section>
    
    <button class="button button-primary" id="mission-start">실험 시작 →</button>
  </div>`;
  const start = modal.querySelector<HTMLButtonElement>('#mission-start')!;
  const close = () => { app.inert = appWasInert; modal.remove(); };
  modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.plan!;
    modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    start.disabled = false;
    tone(470);
  }));
  start.addEventListener('click', () => {
    activeSave.inquiryPlans ??= {};
    if (selected) activeSave.inquiryPlans[stageId] = selected;
    if (stageId === 'rescue' && (selected === 'short' || selected === 'long') && !activeSave.rescue.runs.length) activeSave.rescue.route = selected;
    if (!adminUnlocked) persist();
    tone(470); close();
    if (stageId === 'rescue' || stageId === 'workshop') render();
  }, { once: true });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.body.append(modal); modal.querySelector<HTMLButtonElement>('[data-plan]')?.focus();
}

let backNavigation = false;
window.addEventListener('popstate', event => {
  const page = (event.state as { page?: PageId } | null)?.page;
  if (!page || page === viewPage) return;
  closeLearningReview?.(); closeLearningReview = null;
  document.querySelectorAll('.modal-layer').forEach(node => node.remove()); app.inert = false;
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
  return `<header class="topbar">
    <div class="top-nav">
      <button class="icon-button" data-top="back" aria-label="이전 페이지로" title="이전"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5l-7 7 7 7"/></svg></button>
      <button class="icon-button" data-top="home" aria-label="작전 지도로" title="작전 지도"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></button>
    </div>
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="34" height="34"><path d="M18 5h12M21 6v13L11 35a5 5 0 0 0 4 8h18a5 5 0 0 0 4-8L27 19V6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 32h18l4 6-3 5H14l-3-5z" fill="#73bba2"/><circle cx="20" cy="35" r="2" fill="#f6b45e"/><circle cx="28" cy="38" r="2" fill="#f6b45e"/></svg></span><span>우당탕<br><strong>힘 실험실</strong></span></div>
    <div class="topbar-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기 · 학생 기록과 분리' : '초등 3학년 과학 · 힘과 우리 생활'}</span><strong>${title}</strong><span>${subtitle}</span></div>
    <div class="top-actions">
      ${(count => `<button class="icon-button" data-top="bag" aria-label="도구 가방 열기, 카드 ${count}장" aria-haspopup="dialog" title="도구 가방">${bagIcon()}${count ? `<span class="toolbag-count" aria-hidden="true">${count}</span>` : ''}</button>`)(earnedToolCards(adminSave ?? save).length)}
      <button class="icon-button" data-top="sound" aria-label="소리 ${save.soundOn ? '끄기' : '켜기'}" aria-pressed="${save.soundOn}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
  </header>`;
}

function settingsIcon() {
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 14 5l2.5-.3.8 2.4 2.2 1.2-.8 2.4.8 2.4-2.2 1.2-.8 2.4-2.5-.3-2 1.5-2-1.5-2.5.3-.8-2.4-2.2-1.2.8-2.4-.8-2.4 2.2-1.2.8-2.4L10 5z"/><circle cx="12" cy="11.2" r="2.6"/></svg>`;
}

function soundIcon() {
  return `<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${save.soundOn ? '<path d="M17 8a5 5 0 0 1 0 8M19.5 5a9 9 0 0 1 0 14"/>' : '<path d="m17 9 4 6m0-6-4 6"/>'}</svg>`;
}

function renderTitle(root: HTMLElement) {
  const hasSave = readSave() !== null;
  root.innerHTML = `<section class="title-screen">
    <div class="title-actions">
      <button class="icon-button" data-top="sound" aria-label="소리 ${save.soundOn ? '끄기' : '켜기'}" aria-pressed="${save.soundOn}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
    <div class="character title-student" role="img" aria-label="청록 고글과 멜빵바지를 입은 학생 탐구자"></div>
    <div class="character title-corgi" role="img" aria-label="청록 스카프를 두른 코기 실험 파트너"></div>
    <div class="title-panel">
      <h1 class="illustrated-title"><img src="/assets/ui/title.webp" alt="우당탕 힘 실험실" width="1000" height="375"></h1>
    </div>
    <div class="title-buttons">
      <button class="button button-primary" id="new-start">${readSave() ? '새로 시작' : '시작하기'}</button>
      <button class="button button-secondary" id="continue" ${hasSave ? '' : 'disabled'}>이어하기</button>
    </div>
    <div class="character title-squirrel" role="img" aria-label="기록판을 든 다람쥐 연구 기록관"></div>
  </section>`;
  bindHeader();
  root.querySelector<HTMLButtonElement>('#new-start')?.addEventListener('click', () => {
    if (hasSave && !window.confirm('기존 탐구 기록을 지우고 새로 시작할까요?')) return;
    adminUnlocked = false;
    adminSave = null;
    save = freshSave();
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
    const resume = save.currentPage === 'title' || (save.currentPage === 'complete' && save.completed.length < stages.length) ? 'map' : save.currentPage;
    navigate(resume);
  });
}

function renderComplete(root: HTMLElement) {
  const save = adminSave ?? context.save;
  const completed = save.completed.length;
  const progress = completed * 20;
  root.innerHTML = `<section class="complete-screen">
    <div class="ending-world" aria-label="다시 빛나는 힘 마을"><div class="ending-rays"></div><div class="ending-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기' : '복구 작전 성공 · 다섯 발견이 마을을 밝혔어'}</span><h1>네가 마을을 살렸어!</h1>${(({ earned, max }) => `<p class="ending-stars" aria-label="모은 별 ${earned}개, 전체 ${max}개">★ ${earned} / ${max}</p>`)(totalStars(save))}<p>직접 움직이고, 재고, 비교한 네 다섯 발견으로<br>마을 전체에 다시 불이 켜졌어.</p><button class="button button-primary" id="replay-ending">마을 점등식 다시 보기 ✦</button></div></div>
    <details class="complete-details"><summary>내 실험과 발견 살펴보기 · ${completed} / 5</summary>
    <div class="report-grid">${stages.map(stage => {
      const task = learningTask(save, stage.id), record = save.learning?.[stage.id];
      const checked = task && record && learningRecordComplete(task, record);
      return `<article class="report-card"><span>MISSION 0${stage.mission} · ${stage.concept}</span><h2>${stage.evidence}</h2>${starRow(stageStars(save, stage.id))}<p class="report-card-insight">${escapeHtml(villageRewards[stage.id].afterLines[1])}</p>${predictionMarkup(predictionRecap(save, stage.id), 'report-first')}<details class="report-detail"><summary>내 실험과 답변 살펴보기</summary><p>${escapeHtml(save.evidence[stage.id] ?? '아직 기록이 없습니다.')}</p>${checked ? `<p>${escapeHtml(learningSummary(task, record))}</p>` : ''}</details></article>`;
    }).join('')}</div>
    </details><details class="complete-details"><summary>스스로 돌아보기 · 더 탐구하기 (선택)</summary><div class="ability-card"><h2>나는 이제 할 수 있어요!</h2><p>할 수 있게 된 것을 눌러 골라 봐. 연구 기록에 함께 저장돼.</p><div class="ability-list">${abilityStatements.map((text, i) => `<button class="ability-item" data-ability="${i}" aria-pressed="${(save.abilities ?? []).includes(i)}"><span>${(save.abilities ?? []).includes(i) ? '✓' : ''}</span>${text}</button>`).join('')}</div></div>
    <div class="challenge-card"><h2>도전 과제 <small id="challenge-count"></small></h2><p>실험실로 돌아가서 더 시험해 보면 배지가 켜져.</p><div class="challenge-list">${challenges(save).map(item => `<div class="challenge-item ${item.done ? 'done' : ''}"><span>${item.done ? '★' : '☆'}</span><div><strong>${item.label}</strong><small>${item.hint}</small></div></div>`).join('')}</div></div>
    </details>${toolCardRowMarkup(save)}<div class="transfer-card"><h2>내가 찾은 생활 속 도구</h2><p>${save.lifeObservation ? escapeHtml(save.lifeObservation.object) + ' · ' + escapeHtml(save.lifeObservation.use) : '주변에서 지레나 빗면을 찾아 어떻게 쓰이는지 살펴봐요.'}</p><p>이 기록을 보며 친구에게 도구의 쓰임을 설명해요.</p></div>
    <div class="complete-footer"><p>${adminUnlocked ? '관리자 미리보기 결과는 학생의 기록에 반영되지 않아요.' : '이 기록을 가지고 교실에서 실제 도구도 관찰해 보세요.'}</p><button class="button button-secondary" id="download-report" ${adminUnlocked ? 'disabled' : ''}>내 연구 기록 저장 ↓</button><button class="button button-secondary" id="back-map">작전 지도로</button></div>
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
  root.querySelector('#download-report')?.addEventListener('click', () => {
    const descriptions = stages.map(s => {
      const task = learningTask(save, s.id), record = save.learning?.[s.id];
      const answers = task && record && learningRecordComplete(task, record) ? `\n내 기록 확인과 새 문제 답변\n${learningSummary(task, record)}` : '';
      return `${s.mission}. ${s.evidence}\n${save.evidence[s.id] ?? '아직 기록이 없어요.'}${answers}`;
    }).join('\n\n');
    const content = `우당탕 힘 실험실 · 나의 연구 기록\n실험실 복구 ${progress}%\n\n나는 이제 할 수 있어요\n` + (save.abilities?.length ? save.abilities.map(i => `- ${abilityStatements[i]}`).join('\n') : '- (아직 고르지 않았어요)') + `\n\n도전 과제 ${challenges(save).filter(item => item.done).length}/5\n` + challenges(save).map(item => `${item.done ? '★' : '☆'} ${item.label}`).join('\n') + '\n\n' + toolCardsText(save) + '\n\n' + descriptions + '\n\n나의 실제 실험 기록과 답변 과정\n' + JSON.stringify({ cargo: save.cargo.runs, balance: save.balance.runs, scale: save.scale.runs, workshop: save.workshop.trials, rescue: save.rescue.runs, learning: save.learning ?? {}, lifeObservation: save.lifeObservation }, null, 2);
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '나의-힘-연구-기록.txt'; link.hidden = true;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  replay();
}

function openSettings() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-layer settings-layer';
  const appWasInert = app.inert;
  app.inert = true;
  const unwatch = watchOffline(() => { const status = overlay.querySelector('#offline-status'); if (status) status.textContent = offlineMessage(); });
  const close = () => { unwatch(); app.inert = appWasInert; overlay.remove(); app.querySelector<HTMLButtonElement>('[data-top="settings"]')?.focus(); };
  type Section = 'menu' | 'admin' | 'reset' | InfoSection;
  const headings: Record<Section, string> = { menu: '설정', help: '학생 탐구 가이드', teacher: '교사 운영 가이드', curriculum: '교육과정 연결', info: '정보와 출처', admin: '관리자 해금', reset: '탐구 기록 초기화' };
  const show = (section: Section) => {
    let content: string;
    if (section === 'menu') {
      content = `<div class="settings-links">
        <button data-settings="home"><span>⌂</span> 메인 화면</button>
        <button data-settings="help"><span>?</span> 학생 가이드</button><button data-settings="save"><span>✓</span> 지금 저장</button></div><details class="teacher-tools"><summary>선생님 도구 · 정보</summary><div class="settings-links"><button data-settings="teacher"><span>▤</span> 교사 가이드</button>
        <button data-settings="curriculum"><span>◎</span> 교육과정</button><button data-settings="info"><span>ⓘ</span> 정보와 출처</button>
        <button data-settings="requests" aria-pressed="${requestsEnabled(save)}"><span>★</span> ${requestsLabel()}</button>
        <button data-settings="admin"><span>⚙</span> 관리자 해금 <small>${adminUnlocked ? '사용 중' : ''}</small></button>
        <button data-settings="prologue"><span>▶</span> 프롤로그 다시 보기</button>
        ${save.completed.length === stages.length || adminUnlocked ? '<button data-settings="ending"><span>✦</span> 점등식 다시 보기</button>' : ''}
        <button class="settings-danger" data-settings="reset"><span>↺</span> 기록 초기화</button></div></details>
        <div class="settings-audio"><button class="button button-secondary" data-settings="sound" aria-pressed="${save.soundOn}">효과음 ${save.soundOn ? '켜짐 · 끄기' : '꺼짐 · 켜기'}</button><label for="sound-volume">효과음 크기 <output id="volume-value">${Math.round((save.soundVolume ?? 0.3) * 100)}%</output></label><input id="sound-volume" type="range" min="0" max="100" step="5" value="${Math.round((save.soundVolume ?? 0.3) * 100)}" aria-label="효과음 크기"></div>
        <p class="settings-offline" id="offline-status" role="status">${offlineMessage()}</p>`;
    } else if (section === 'admin') {
      content = `<p class="settings-lead">${adminUnlocked ? '실험 5개가 모두 열려 있어요.' : '실험 5개와 결과 화면을 미리 볼 수 있어요.'} 미리보기 조작은 학생 기록에 반영되지 않아요.</p><button class="button button-primary full" data-settings="toggle-admin">${adminUnlocked ? '관리자 해금 종료' : '전체 화면 한꺼번에 해금'}</button><p class="settings-lead">해금은 이 탭에서만 유지되고 새로고침하면 종료돼요.</p>`;
      if (adminUnlocked) content += `<div class="settings-links" aria-label="미리 볼 실험">${stages.map(stage=>`<button data-preview-stage="${stage.id}">${stage.mission}. ${stage.title}</button>`).join('')}<button data-preview-stage="complete">결과 화면</button></div>`;
    } else if (section === 'reset') {
      content = '<p class="settings-lead">이 브라우저의 모든 실험 기록과 복구 진행을 지울까요? 지운 기록은 되돌릴 수 없어요. 소리 설정은 유지해요.</p><button class="button button-secondary settings-danger" data-settings="confirm-reset">기록을 지우고 처음으로</button>';
    } else content = infoContent[section] + (section === 'teacher' ? diagnosticMarkup() + `<p class="settings-offline" id="offline-status" role="status">${offlineMessage()}</p>` : '');
    overlay.innerHTML = `<div class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-heading"><h2 id="settings-title">${headings[section]}</h2><button class="settings-close" data-settings="close" aria-label="설정 닫기">×</button></div>
      ${content}${section === 'menu' ? '' : '<button class="button button-secondary settings-back" data-settings="back">설정으로 돌아가기</button>'}
    </div>`;
    overlay.querySelector<HTMLButtonElement>('[data-settings="close"]')?.focus();
  };
  overlay.addEventListener('click', event => {
    if (event.target === overlay) { close(); return; }
    const preview = (event.target as Element).closest<HTMLButtonElement>('[data-preview-stage]')?.dataset.previewStage;
    if (preview && adminUnlocked) { close(); navigate(preview as PageId); return; }
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-settings]');
    if (!button) return;
    const action = button.dataset.settings;
    if (action === 'close') close();
    else if (action === 'back') show('menu');
    else if (['help', 'teacher', 'curriculum', 'info', 'admin', 'reset'].includes(action ?? '')) show(action as Section);
    else if (action === 'sound') {
      save.soundOn = !save.soundOn;
      persist();
      button.setAttribute('aria-pressed', String(save.soundOn));
      button.textContent = `효과음 ${save.soundOn ? '켜짐 · 끄기' : '꺼짐 · 켜기'}`;
      updateSoundButton();
      if (save.soundOn) tone(520); else stopSounds();
    }
    else if (action === 'confirm-reset') {
      const sound = { soundOn: save.soundOn, soundVolume: save.soundVolume };
      close(); adminUnlocked = false; adminSave = null;
      save = { ...freshSave(), ...sound }; context.save = save;
      persist(); viewPage = 'title'; render();
    }
    else if (action === 'ending') { close(); navigate('complete'); openEndingCeremony(); }
    else if (action === 'prologue') { close(); openStoryModal({ lines: prologueLines, finishLabel: '닫기', video: introVideo }); }
    else if (action === 'toggle-admin') { const enable = !adminUnlocked; close(); setAdminMode(enable); navigate('map'); }
    else if (action === 'requests') {
      const requests = !requestsEnabled(save);
      save.teacherOptions = { requests };
      if (adminSave) adminSave.teacherOptions = { requests };
      persist();
      button.setAttribute('aria-pressed', String(requests));
      button.innerHTML = `<span>★</span> ${requestsLabel()}`;
      toast(requests ? '의뢰 레벨을 마쳐야 다음 미션이 끝나요.' : '의뢰 레벨은 선택이에요. 실험만 마쳐도 미션을 끝낼 수 있어요.');
      render();
    }
    else if (action === 'save') { if (persist()) toast('진행 기록을 저장했어요.'); }
    else if (action === 'home') { close(); setAdminMode(false); viewPage = 'title'; render(); }
  });
  overlay.addEventListener('input', event => {
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'sound-volume') return;
    save.soundVolume = Number(event.target.value) / 100;
    setVolume(save.soundVolume);
    overlay.querySelector('#volume-value')!.textContent = `${event.target.value}%`;
  });
  overlay.addEventListener('change', event => {
    if ((event.target as HTMLElement).id === 'sound-volume') { persist(); tone(520); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  document.body.append(overlay);
  show('menu');
}

function updateSoundButton() {
  const button = app.querySelector<HTMLButtonElement>('[data-top="sound"]');
  if (!button) return;
  button.innerHTML = soundIcon();
  button.setAttribute('aria-pressed', String(save.soundOn));
  button.setAttribute('aria-label', `소리 ${save.soundOn ? '끄기' : '켜기'}`);
}

function bindHeader() {
  app.querySelector<HTMLButtonElement>('[data-top="sound"]')?.addEventListener('click', () => {
    save.soundOn = !save.soundOn;
    persist();
    updateSoundButton();
    if (save.soundOn) tone(620); else stopSounds();
  });
  app.querySelector<HTMLButtonElement>('[data-top="settings"]')?.addEventListener('click', openSettings);
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
  app.innerHTML = `${viewPage === 'title' ? '' : header(title, subtitle)}<main id="screen" class="screen"></main><aside class="orientation-hint" role="status"><span aria-hidden="true">↶ ▱</span><h2>가로로 펼치면 실험실이 보여요!</h2><p>태블릿은 가로로 돌리고,<br>웹에서는 창을 가로로 넓혀 주세요.</p><small>진행 중인 실험은 그대로 이어져요.</small></aside>`;
  bindHeader();
  const screen = app.querySelector<HTMLElement>('#screen')!;
  switch (viewPage) {
    case 'title': renderTitle(screen); break;
    case 'map': {
      cleanup = mountVillage(screen, context, { adminUnlocked, returnedFrom: villageReturn, newlyCompleted: villageCelebration });
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
  if (entered && !missionCardShown.has(entered.id)) { missionCardShown.add(entered.id); openMissionCard(entered.id); }
}

render();
performance.mark('force-lab-ready');
prepareOffline();

