import './style.css';
import './adventure.css';
import './display.css';
import './settings.css';
import './polish.css';
import './learning.css';
import './missionProgress.css';
import './questionUI.css';
import './storyVideo.css';
import './stagePopup.css';
import { openLifeObservation } from './lifeObservation';
import { stages, type PageId, type StageId } from './data';
import { completeStage, freshSave, readSave, stageIsOpen, writeSave, type SaveData } from './state';
import { mountCargo } from './screens/cargo';
import { mountBalance } from './screens/balance';
import { mountScale } from './screens/scale';
import { mountWorkshop } from './screens/workshop';
import { mountRescue } from './screens/rescue';
import { mountVillage } from './screens/village';
import { villageRewards } from './villageStory';
import { playMusic, playSound, stopMusic, stopSounds, setVolume, type MusicName } from './sound';
import { infoContent, type InfoSection } from './info';
import { prepareOffline } from './offline';
import type { AppContext } from './appTypes';
import { abilityStatements, challenges } from './challenges';
import { openLearningReview } from './learningReview';
import { learningTask, learningRecordComplete, learningSummary } from './learningModel';
import { stageStars, totalStars, type StageStars } from './stars';
import { inquiryPlans, predictionRecap, predictionVerdict, type PredictionRecap } from './inquiryPlan';
import { earnedToolCards, toolCardInfo, toolCards, toolCardsText } from './toolCards';
import { bagIcon, openToolBag, toolCardRevealMarkup, toolCardRowMarkup } from './toolBag';
import './studentUx.css';
import './tabletUx.css';
import { icons } from './icons';

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
/** While a story video is open it decides the music: the ending plays its own track, the prologue keeps quiet for its own sound. */
let storyMusic: MusicName | 'quiet' | null = null;
/** Background music has its own switch in settings; the header button turns music and effects on or off together. */
function syncMusic() {
  if (!save.musicOn || storyMusic === 'quiet') { stopMusic(); return; }
  setVolume(save.soundVolume ?? 0.3);
  playMusic(storyMusic ?? 'stage');
}
// Browsers only start audio after a tap, so the first tap anywhere retries the music.
document.addEventListener('pointerdown', syncMusic, { once: true });

/** Confetti burst: 28 pieces with their own drift, delay and colour. Skipped under reduced motion. */
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
  if (closeLearningReview || document.querySelector('#world-title, #life-title')) return;
  if (stageId === 'workshop') {
    const activeSave = adminSave ?? save;
    openLifeObservation({ app, value: activeSave.lifeObservation,
      onSave: value => { activeSave.lifeObservation = value; if (!adminUnlocked) persist(); },
      onDone: () => {
        const observation = activeSave.lifeObservation!;
        finishWithEvidence(stageId, `${summary} 생활 속 도구 분류: ${observation.object.trim()} / ${observation.use.trim()}`);
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
      <h2 id="world-title">${stage.evidence}</h2>${starRow(stageStars(activeSave, stageId), true)}
      ${newCard ? toolCardRevealMarkup(newCard) : ''}
      <div class="discovery-recap"><img src="/assets/game/corgi-success.webp" alt=""><div><strong class="discovery-key">${escapeHtml(toolCardInfo[stageId].idea)}</strong>${guessMarkup(predictionRecap(activeSave, stageId))}</div></div>
      ${reviewTask ? `<section class="world-review question-zone question-zone-compact"><span class="question-label">마을로 가기 전 문제</span><p class="question-prompt">내 실험 기록을 보고 문제를 풀어요</p><button class="button button-primary" id="world-review">문제 풀기</button></section>` : ''}<details class="discovery-detail"><summary>도전 과제 (선택)</summary><p>${challenge.done ? `★ ${challenge.label}` : challenge.hint}</p><p class="discovery-record">${escapeHtml(summary)}</p></details>
      ${adminUnlocked ? '<p class="small-note">미리보기 결과는 학생 진행 기록에 반영되지 않습니다.</p>' : `<div class="world-meter"><span style="width:${save.completed.length * 20}%"></span></div><p class="small-note">전체 실험실 복구 ${save.completed.length * 20}% · 미션 ${save.completed.length}/5 완료</p>`}
      <button class="button button-primary" id="world-continue">${stageId === 'rescue' ? '마을 점등식 보러 가기 ✦' : '달라진 마을 보러 가기'}</button><p class="world-lock-note" id="world-lock-note" role="status"></p>
    </div>`;
  document.body.append(modal);
  confetti(modal.querySelector<HTMLElement>('.modal-card')!);
  const appWasInert = app.inert;
  app.inert = true;
  const next = modal.querySelector<HTMLButtonElement>('#world-continue')!;
  const reviewButton = modal.querySelector<HTMLButtonElement>('#world-review');
  const syncLock = () => {
    const solved = reviewSolved() || adminUnlocked;
    next.disabled = !solved;
    modal.querySelector<HTMLElement>('#world-lock-note')!.textContent = solved ? '' : '위의 문제를 풀면 달라진 마을을 볼 수 있어요.';
    modal.querySelector('.world-review')?.classList.toggle('is-solved', solved);
    if (reviewButton) { reviewButton.textContent = solved ? '✓ 문제 다시 보기' : '문제 풀기'; reviewButton.className = `button ${solved ? 'button-secondary' : 'button-primary'}`; }
  };
  syncLock();
  const close = () => { app.inert = appWasInert; modal.remove(); navigate('map'); if(stageId==='rescue'&&activeSave.completed.length===stages.length)openEndingCeremony(); };
  reviewButton?.addEventListener('click', () => {
    modal.hidden = true;
    const restore = () => { closeLearningReview = null; modal.hidden = false; syncLock(); (next.disabled ? reviewButton : next).focus(); };
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
  (next.disabled && reviewButton ? reviewButton : next).focus();
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
  return `<p class="discovery-guess" data-matched="${recap.matched}"><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted)}<b>${recap.matched ? '✓ 처음 생각과 같아요!' : '실험으로 새로 알았어!'}</b></p>`;
}

/** First thought, what the records showed, and whether they matched — never a score. */
function predictionMarkup(recap: PredictionRecap, className = 'discovery-prediction'): string {
  const verdict = predictionVerdict(recap);
  return `<div class="${className} prediction-recap" data-matched="${recap.matched ?? 'none'}"><p><span class="prediction-tag">처음 생각</span>${escapeHtml(recap.predicted ?? '기록된 예상이 없어')}</p><p><span class="prediction-tag is-result">실제 결과</span>${escapeHtml(recap.result)}</p>${verdict ? `<strong class="prediction-verdict">${verdict}</strong>` : ''}</div>`;
}
/** Three star slots per mission: completed, level 2 request, challenge. */
function starRow(stars: StageStars, celebrate = false): string {
  return `<ul class="star-row${celebrate ? ' is-celebrating' : ''}" aria-label="별 ${stars.earned}개">${stars.slots.map((slot, i) => `<li class="${slot.done ? 'is-done' : ''}" style="--i:${i}"><span aria-hidden="true">${slot.done ? '★' : '☆'}</span>${escapeHtml(slot.label)}</li>`).join('')}</ul>`;
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}


const prologueLines = [
  { who: '도토리 박사', text: '우당탕 마을에 전기 전원이 모두 나갔어! 무슨 일이 생긴 걸까?' },
  { who: '도토리 박사', text: '원인을 찾았어! 마을의 배터리 ‘코어’가 중앙 장치에서 분리돼 있어. 다시 끼워야 전기가 돌아와.' },
  { who: '코기 콩이', text: '그런데 코어가 너무 무거워! 네 건물에서 밀고 당기기, 무게 비교, 도구 쓰는 법을 익혀서 다시 장착할 방법을 찾자!' },
];
type StoryVideo = { src: string; cues: number[]; duration: number; poster?: string };
type StoryOptions = { lines: { who: string; text: string }[]; finishLabel: string; onDone?: () => void; skippable?: boolean; scenes?: string[]; video?: StoryVideo; music?: MusicName };
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
  // dismissed: the back button removed the modal, so tear down without running onDone.
  const close = (dismissed = false) => {
    if (closed) return; closed = true;
    teardownVideo?.(); teardownVideo = null;
    document.removeEventListener('keydown', onEscape, true);
    app.inert = appWasInert; modal.remove();
    storyMusic = null; syncMusic();
    if (opener?.isConnected) opener.focus?.();
    if (!dismissed) options.onDone?.();
  };
  modal.addEventListener('modal-dismiss', () => close(true));
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
        <button type="button" class="button button-primary story-play" data-story="play" hidden>${icons.play} 영상 재생</button>
      </div>
      <div class="story-finish-banner" aria-hidden="true"><span>★</span>${options.scenes ? '마을에 불이 켜졌어!' : '코어를 옮길 방법을 찾자!'}<span>★</span></div>
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
      // Replay the pop-in so each new line jumps out like a comic caption.
      for (const node of [who, caption]) { node.classList.remove('is-new'); void node.offsetWidth; node.classList.add('is-new'); }
      dotNodes.forEach((dot, n) => dot.classList.toggle('on', n === i));
    };
    const card = modal.querySelector<HTMLElement>('.story-video-card')!;
    if (options.scenes) card.classList.add('is-ending');
    // Confetti burst for the finish: 28 pieces with their own drift, delay and colour.
    const celebrate = () => {
      confetti(card);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      [0, 160, 320].forEach((ms, k) => window.setTimeout(() => tone(680 + k * 60), ms));
    };
    const sync = () => showCue(storyCueIndex(video.cues, el.currentTime));
    const endFrame = modal.querySelector<HTMLImageElement>('.story-end-frame')!;
    const finishUi = () => { el.controls = false; endFrame.hidden = false; showCue(options.lines.length - 1); skipBtn.hidden = true; doneBtn.hidden = false; playBtn.hidden = true; card.classList.add('is-finished'); celebrate(); doneBtn.focus(); };
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
  storyMusic = options.music ?? (options.video ? 'quiet' : null); syncMusic();
  if (options.video) drawVideo(options.video); else draw();
}
function openEndingCeremony() {
  openStoryModal({
    video: endingVideo,
    music: 'ending',
    scenes:[1,2,3].map(i=>`/assets/story/final-0${i}.webp`),
    lines:[
      {who:'코기 콩이',text:'딸깍! 떨어져 있던 배터리 코어를 중앙 장치에 다시 끼웠어!'},
      {who:'도토리 박사',text:'무게를 확인하고, 막힌 길을 열고, 도구를 비교했지. 네 건물에서 배운 방법으로 무거운 코어를 옮긴 거야.'},
      {who:'코기 콩이',text:'와, 코어가 다시 연결되니까 마을 전체에 전기가 돌아왔어! 우리가 힘을 모아 우당탕 마을을 다시 밝혔네!'},
    ],finishLabel:'내가 살린 마을 둘러보기 ✦',onDone:()=>navigate('map'),
  });
}
const missionLearn: Record<StageId, string> = {
  cargo: '무거운 상자와 가벼운 상자를 밀고 당길 때 달라지는 점',
  balance: '수평대에서 어느 쪽이 더 무거운지 알아내는 법',
  scale: '겉모습으로 헷갈리는 무게를 저울로 비교해요.',
  workshop: '지레와 빗면을 쓰면 필요한 힘이 어떻게 달라지는지',
  rescue: '배운 방법으로 배터리 코어를 옮겨 중앙 장치에 다시 끼우기',
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

    <section class="mission-prediction question-zone" aria-labelledby="mission-question"><span class="question-label">실험 전 처음 생각 (선택)</span><h3 class="question-prompt" id="mission-question">${plan.prompt}</h3><div class="mission-answer-grid" style="--answer-count:${plan.choices.length}">${plan.choices.map((choice,index) => `<button type="button" data-plan="${choice.id}" aria-pressed="${selected === choice.id}"><span class="answer-number" aria-hidden="true">${index+1}</span><span>${choice.label}</span></button>`).join('')}</div></section>

    <p class="mission-orientation" role="status">시작하기 전에 태블릿을 가로로 돌려요. 고른 처음 생각은 그대로 있어요.</p>
    <button class="button button-primary" id="mission-start">실험 시작 →</button>
  </div>`;
  const start = modal.querySelector<HTMLButtonElement>('#mission-start')!;
  const orientation = matchMedia('(orientation: portrait)');
  const syncOrientation = () => { start.disabled = orientation.matches; };
  orientation.addEventListener('change', syncOrientation); syncOrientation();
  const close = () => { orientation.removeEventListener('change', syncOrientation); app.inert = appWasInert; modal.remove(); };
  modal.addEventListener('modal-dismiss', close);
  modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.plan!;
    modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
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
  return `<header class="topbar">
    <div class="top-nav">
      <button class="icon-button" data-top="back" aria-label="이전 페이지로" title="이전"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5l-7 7 7 7"/></svg></button>
      <button class="icon-button" data-top="home" aria-label="작전 지도로" title="작전 지도"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></button>
    </div>
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="34" height="34"><path d="M18 5h12M21 6v13L11 35a5 5 0 0 0 4 8h18a5 5 0 0 0 4-8L27 19V6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 32h18l4 6-3 5H14l-3-5z" fill="#73bba2"/><circle cx="20" cy="35" r="2" fill="#f6b45e"/><circle cx="28" cy="38" r="2" fill="#f6b45e"/></svg></span><span>우당탕<br><strong>힘 실험실</strong></span></div>
    <div class="topbar-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기 · 학생 기록과 분리' : '초등 3학년 과학 · 힘과 우리 생활'}</span><strong>${title}</strong><span>${subtitle}</span></div>
    <div class="top-actions">
      ${(count => `<button class="icon-button" data-top="bag" aria-label="도구 가방 열기, 카드 ${count}장" aria-haspopup="dialog" title="도구 가방">${bagIcon()}${count ? `<span class="toolbag-count" aria-hidden="true">${count}</span>` : ''}</button>`)(earnedToolCards(adminSave ?? save).length)}
      <button class="icon-button" data-top="sound" aria-label="소리 ${anySound() ? '끄기' : '켜기'}" aria-pressed="${anySound()}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
  </header>`;
}

function settingsIcon() {
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 14 5l2.5-.3.8 2.4 2.2 1.2-.8 2.4.8 2.4-2.2 1.2-.8 2.4-2.5-.3-2 1.5-2-1.5-2.5.3-.8-2.4-2.2-1.2.8-2.4-.8-2.4 2.2-1.2.8-2.4L10 5z"/><circle cx="12" cy="11.2" r="2.6"/></svg>`;
}

/** True while effects or music are on: the header speaker shows sound and mutes both. */
function anySound() { return save.soundOn || save.musicOn === true; }
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
const TEACHER_CODE = 'yelsam';

function renderTitle(root: HTMLElement) {
  const hasSave = readSave() !== null;
  root.innerHTML = `<section class="title-screen">
    <div class="title-actions">
      <button class="icon-button" data-top="sound" aria-label="소리 ${anySound() ? '끄기' : '켜기'}" aria-pressed="${anySound()}">${soundIcon()}</button>
      <button class="icon-button" data-top="settings" aria-label="설정 열기" aria-haspopup="dialog" title="설정">${settingsIcon()}</button>
    </div>
    <div class="character" data-pose="title-student" role="img" aria-label="청록 고글과 멜빵바지를 입은 학생 탐구자"></div>
    <div class="character" data-pose="title-corgi" role="img" aria-label="청록 스카프를 두른 코기 실험 파트너"></div>
    <div class="title-panel">
      <h1 class="illustrated-title"><img src="/assets/ui/title.webp" alt="우당탕 힘 실험실" width="1000" height="375"></h1>
    </div>
    <div class="title-buttons">
      <button class="button button-primary" id="new-start">${readSave() ? '새로 시작' : '시작하기'}</button>
      <button class="button button-secondary" id="continue" ${hasSave ? '' : 'disabled'}>이어하기</button>
    </div>
    <div class="character" data-pose="title-squirrel" role="img" aria-label="기록판을 든 다람쥐 연구 기록관"></div>
  </section>`;
  // The three pose sheets (~1MB) take their class — and start downloading — only after the title logo and buttons have painted.
  const reveal = () => root.querySelectorAll<HTMLElement>('[data-pose]').forEach(node => node.classList.add(node.dataset.pose!));
  if (document.readyState === 'complete') requestAnimationFrame(reveal);
  else window.addEventListener('load', () => window.setTimeout(reveal, 250), { once: true });
  bindHeader();
  root.querySelector<HTMLButtonElement>('#new-start')?.addEventListener('click', async () => {
    if (hasSave && !await confirmBox('기존 탐구 기록을 지우고 새로 시작할까요?', '별, 도구 카드, 실험 기록이 이 기기에서 모두 지워져요. 소리 설정은 그대로예요.', '기록 지우고 시작')) return;
    adminUnlocked = false;
    adminSave = null;
    save = { ...freshSave(), soundOn: save.soundOn, musicOn: save.musicOn, soundVolume: save.soundVolume };
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
    const resume = save.currentPage === 'title' || (save.currentPage === 'complete' && save.completed.length < stages.length) ? 'map' : save.currentPage;
    navigate(resume);
  });
}

function renderComplete(root: HTMLElement) {
  const save = adminSave ?? context.save;
  const completed = save.completed.length;
  const progress = completed * 20;
  root.innerHTML = `<section class="complete-screen">
    <div class="ending-world" aria-label="다시 빛나는 힘 마을"><div class="ending-rays"></div><div class="ending-title"><span class="eyebrow">${adminUnlocked ? '관리자 미리보기' : '배터리를 다시 끼웠어 · 마을에 전기가 돌아왔어'}</span><h1>네가 마을을 살렸어!</h1>${(({ earned, max }) => `<p class="ending-stars" aria-label="모은 별 ${earned}개, 전체 ${max}개">★ ${earned} / ${max}</p>`)(totalStars(save))}<p>실험에서 찾은 방법으로 배터리 코어를 옮겨 다시 장착했어.<br>전기가 돌아와 우당탕 마을에 다시 불이 켜졌어.</p><button class="button button-primary" id="replay-ending">마을 점등식 다시 보기 ✦</button></div></div>
    <details class="complete-details"><summary>내 실험과 발견 살펴보기 · ${completed} / 5</summary>
    <div class="report-grid">${stages.map(stage => {
      const task = learningTask(save, stage.id), record = save.learning?.[stage.id];
      const checked = task && record && learningRecordComplete(task, record);
      return `<article class="report-card"><span>MISSION 0${stage.mission} · ${stage.concept}</span><h2>${stage.evidence}</h2>${starRow(stageStars(save, stage.id))}<p class="report-card-insight">${escapeHtml(villageRewards[stage.id].afterLines[1])}</p>${predictionMarkup(predictionRecap(save, stage.id), 'report-first')}<details class="report-detail"><summary>내 실험과 답변 살펴보기</summary><p>${escapeHtml(save.evidence[stage.id] ?? '아직 기록이 없습니다.')}</p>${checked ? `<p>${escapeHtml(learningSummary(task, record))}</p>` : ''}</details></article>`;
    }).join('')}</div>
    </details><details class="complete-details"><summary>스스로 돌아보기 · 더 탐구하기 (선택)</summary><div class="ability-card"><h2>나는 이제 할 수 있어요!</h2><p>할 수 있게 된 것을 눌러 골라 봐. 연구 기록에 함께 저장돼.</p><div class="ability-list">${abilityStatements.map((text, i) => `<button class="ability-item" data-ability="${i}" aria-pressed="${(save.abilities ?? []).includes(i)}"><span>${(save.abilities ?? []).includes(i) ? '✓' : ''}</span>${text}</button>`).join('')}</div></div>
    <div class="challenge-card"><h2>도전 과제 <small id="challenge-count"></small></h2><p>실험실로 돌아가서 더 시험해 보면 배지가 켜져.</p><div class="challenge-list">${challenges(save).map(item => `<div class="challenge-item ${item.done ? 'done' : ''}"><span>${item.done ? '★' : '☆'}</span><div><strong>${item.label}</strong><small>${item.hint}</small></div></div>`).join('')}</div></div>
    </details>${toolCardRowMarkup(save)}<div class="transfer-card"><h2>내가 찾은 생활 속 도구</h2><p>${save.lifeObservation ? escapeHtml(save.lifeObservation.object) + ' · ' + escapeHtml(save.lifeObservation.use) : '주변에서 지레나 빗면을 찾아 어떻게 쓰이는지 살펴봐요.'}</p><p>이 기록을 보며 친구에게 도구의 쓰임을 설명해요.</p></div>
    <div class="complete-footer"><p>${adminUnlocked ? '관리자 미리보기 결과는 학생의 기록에 반영되지 않아요.' : '이 기록을 가지고 교실에서 실제 도구도 관찰해 보세요.'}</p><button class="button button-secondary" id="download-report" ${adminUnlocked ? 'disabled' : ''}>내 연구 기록 저장 ${icons.download}</button><button class="button button-secondary" id="back-map">작전 지도로</button></div>
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
  const close = () => { app.inert = appWasInert; overlay.remove(); app.querySelector<HTMLButtonElement>('[data-top="settings"]')?.focus(); };
  type Section = 'menu' | 'admin' | 'reset' | InfoSection;
  const headings: Record<Section, string> = { menu: '설정', help: '학생 탐구 가이드', teacher: '교사 가이드', curriculum: '교육과정', info: '정보와 출처', admin: '관리자 해금', reset: '탐구 기록 초기화' };
  const show = (section: Section) => {
    let content: string;
    if (section === 'menu') {
      content = `<div class="settings-links">
        <button data-settings="home"><span>${icons.home}</span> 메인 화면</button>
        <button data-settings="help"><span>?</span> 학생 가이드</button><button data-settings="save"><span>${icons.check}</span> 지금 저장</button></div><details class="teacher-tools"><summary>선생님 도구 · 정보</summary><div class="settings-links"><button data-settings="teacher"><span>${icons.book}</span> 교사 가이드</button>
        <button data-settings="curriculum"><span>${icons.target}</span> 교육과정</button><button data-settings="info"><span>${icons.info}</span> 정보와 출처</button>
        <button data-settings="admin"><span>${icons.gear}</span> 관리자 해금 <small>${adminUnlocked ? '사용 중' : ''}</small></button>
        <button data-settings="prologue"><span>${icons.play}</span> 프롤로그 다시 보기</button>
        ${save.completed.length === stages.length || adminUnlocked ? `<button data-settings="ending"><span>${icons.sparkle}</span> 점등식 다시 보기</button>` : ''}
        <button class="settings-danger" data-settings="reset"><span>${icons.reset}</span> 기록 초기화</button></div></details>
        <div class="settings-audio"><div class="settings-audio-switches"><button class="button button-secondary" data-settings="music" aria-pressed="${save.musicOn === true}">${switchLabel('배경음', save.musicOn === true)}</button><button class="button button-secondary" data-settings="sound" aria-pressed="${save.soundOn}">${switchLabel('효과음', save.soundOn)}</button></div><label for="sound-volume">소리 크기 <output id="volume-value">${Math.round((save.soundVolume ?? 0.3) * 100)}%</output></label><input id="sound-volume" type="range" min="0" max="100" step="5" value="${Math.round((save.soundVolume ?? 0.3) * 100)}" aria-label="소리 크기"></div>`;
    } else if (section === 'admin') {
      content = `<p class="settings-lead">${adminUnlocked ? '실험 5개가 모두 열려 있어요.' : '실험 5개와 결과 화면을 미리 볼 수 있어요.'} 미리보기 조작은 학생 기록에 반영되지 않아요.</p>${adminUnlocked ? '' : '<label class="settings-code"><span>교사용 확인 코드</span><input id="teacher-code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label>'}<button class="button button-primary full" data-settings="toggle-admin">${adminUnlocked ? '관리자 해금 종료' : '전체 화면 한꺼번에 해금'}</button><p class="settings-lead">해금은 이 탭에서만 유지되고 새로고침하면 종료돼요.${adminUnlocked ? '' : ' 확인 코드는 저장되지 않으며 이 화면에서만 검사해요. 계정이나 개인정보를 보호하는 보안 비밀번호는 아니에요.'}</p>`;
      if (adminUnlocked) content += `<div class="settings-links" aria-label="미리 볼 실험">${stages.map(stage=>`<button data-preview-stage="${stage.id}">${stage.mission}. ${stage.title}</button>`).join('')}<button data-preview-stage="complete">결과 화면</button></div>`;
    } else if (section === 'reset') {
      content = '<p class="settings-lead">이 브라우저의 모든 실험 기록과 복구 진행을 지울까요? 지운 기록은 되돌릴 수 없어요. 소리 설정은 유지해요.</p><button class="button button-secondary settings-danger" data-settings="confirm-reset">기록을 지우고 처음으로</button>';
    } else content = infoContent[section];
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
      button.textContent = switchLabel('효과음', save.soundOn);
      updateSoundButton();
      if (save.soundOn) tone(520); else stopSounds();
    }
    else if (action === 'music') {
      save.musicOn = !save.musicOn;
      persist();
      button.setAttribute('aria-pressed', String(save.musicOn));
      button.textContent = switchLabel('배경음', save.musicOn);
      updateSoundButton();
      syncMusic();
    }
    else if (action === 'confirm-reset') {
      const sound = { soundOn: save.soundOn, musicOn: save.musicOn, soundVolume: save.soundVolume };
      close(); adminUnlocked = false; adminSave = null;
      save = { ...freshSave(), ...sound }; context.save = save; missionCardShown.clear();
      persist(); viewPage = 'title'; render();
    }
    else if (action === 'ending') { close(); navigate('complete'); openEndingCeremony(); }
    else if (action === 'prologue') { close(); openStoryModal({ lines: prologueLines, finishLabel: '닫기', video: introVideo }); }
    else if (action === 'toggle-admin') {
      const enable = !adminUnlocked;
      if (enable && overlay.querySelector<HTMLInputElement>('#teacher-code')?.value.trim() !== TEACHER_CODE) { toast('교사용 확인 코드가 맞지 않아요.'); overlay.querySelector<HTMLInputElement>('#teacher-code')?.focus(); return; }
      close(); setAdminMode(enable); navigate('map');
    }
    else if (action === 'save') { if (persist()) toast('진행 기록을 저장했어요.'); }
    else if (action === 'home') { close(); setAdminMode(false); viewPage = 'title'; render(); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.target as Element).id === 'teacher-code') overlay.querySelector<HTMLButtonElement>('[data-settings="toggle-admin"]')?.click();
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
  button.setAttribute('aria-pressed', String(anySound()));
  button.setAttribute('aria-label', `소리 ${anySound() ? '끄기' : '켜기'}`);
}
/** Settings switch text: what is on now, then what a press does. */
function switchLabel(name: string, on: boolean): string {
  return `${name} ${on ? '켜짐 · 끄기' : '꺼짐 · 켜기'}`;
}

function bindHeader() {
  // One quick switch for the classroom: it mutes everything, or brings back music and effects together.
  app.querySelector<HTMLButtonElement>('[data-top="sound"]')?.addEventListener('click', () => {
    const on = !anySound();
    save.soundOn = on; save.musicOn = on;
    persist();
    updateSoundButton();
    if (on) tone(620); else stopSounds();
    syncMusic();
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
  app.innerHTML = `${viewPage === 'title' ? '' : header(title, subtitle)}<main id="screen" class="screen"></main><aside class="orientation-hint" role="status"><span aria-hidden="true">${icons.rotateLeft}${icons.landscape}</span><h2>가로로 펼치면 실험실이 보여요!</h2><p>태블릿은 가로로 돌리고,<br>웹에서는 창을 가로로 넓혀 주세요.</p><small>진행 중인 실험은 그대로 이어져요.</small></aside>`;
  bindHeader();
  syncMusic();
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
    dialog.innerHTML = `<div class="stage-popup-card"><span class="stage-popup-label">MISSION 0${stages.find(item => item.id === stageId)!.mission} 완료</span><span class="stage-stamp" aria-hidden="true">★ 완료</span><h2>다 했어요! 멋져요 ★</h2><button class="stage-popup-close" aria-label="닫기">×</button><div class="stage-popup-body"><p>${finishLines[stageId]}</p></div><div class="stage-popup-actions"><button class="stage-finish-later">조금 더 실험할래요</button><button class="button button-primary stage-finish-go">${button.textContent}</button></div></div>`;
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

