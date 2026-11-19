// 미션별 개념 클립(tools/concept-clips에서 렌더한 무음 영상) 재생 모달.
// 스포일러 금지: 버튼은 각 미션이 핵심 발견을 확인한 뒤에만 syncConceptButton(..., true)로 보인다.
// 자막은 영상 그림 안에 들어 있다(docs/concept-captions-20261118, 2026-11-18). 화면은 전체 화면(contain)이고,
// 실제로 재생되면 DOM 자막은 스크린리더용으로만 남긴다. 영상 오류·재생 전에는 DOM 자막이 보인다.
import './conceptClip.css';
import './concept-focus.css';
import {bindConceptFocus} from './concept-focus.js';
import {playVoiceLine, stopVoiceLine, voiceLinePlaying} from './npcDialogueVoice';

export type ConceptStage = 'cargo' | 'balance' | 'scale' | 'workshop' | 'rescue';
type Clip = { title: string; cues: { at: number; text: string }[] };

// at은 초. 렌더 장면(tools/concept-clips/clips.mjs)의 프레임 구간과 맞춘다.
const clips: Record<ConceptStage, Clip> = {
  cargo: { title: '같은 힘, 다른 무게', cues: [
    { at: 0, text: '부품 1개 상자와 5개 상자를 밀어요. 두 화살표 길이가 똑같지요? 똑같은 힘이에요.' },
    { at: 2.7, text: '똑같은 힘으로 같은 시간 동안 밀어요!' },
    { at: 4.9, text: '같은 바닥에서 같은 힘·시간으로 밀었더니 가벼운 상자가 더 멀리 갔어요.' },
  ] },
  balance: { title: '수평대가 기우는 까닭', cues: [
    { at: 0, text: '받침점에서 양쪽 접시까지의 거리가 같아요.' },
    { at: 2.0, text: '더 무거운 쪽이 아래로 내려가요.' },
    { at: 4.3, text: '무게가 같으면 수평이 돼요.' },
  ] },
  scale: { title: '영점을 맞추는 까닭', cues: [
    { at: 0, text: '빈 저울이 15 g을 가리켜요. 0 버튼으로 영점을 맞춰요.' },
    { at: 2.0, text: '사과 모형을 올리면 80 g이에요.' },
    { at: 3.7, text: '영점 전에는 95 g, 영점 후에는 80 g! 빈 저울을 먼저 0으로 맞춰요.' },
  ] },
  workshop: { title: '힘이 덜 드는 도구', cues: [
    { at: 0, text: '그냥 들어 올리면 길은 짧지만 큰 힘이 들어요.' },
    { at: 2.7, text: '빗면을 쓰면 힘은 작아지고, 움직이는 길은 길어져요.' },
    { at: 4.6, text: '같은 판자에서 손으로 누르는 자리는 그대로 두고 받침점을 화물 쪽으로 옮기면 힘이 줄어요.' },
  ] },
  rescue: { title: '긴 길로 코어가 도착한 까닭', cues: [
    { at: 0, text: '네 건물에서 모은 힘의 증거가 코어로 모여요.' },
    { at: 2.0, text: '같은 작은 힘으로 밀면 짧고 가파른 길에서는 멈춰요.' },
    { at: 4.6, text: '길고 완만한 길로는 끝까지 도착해요!' },
  ] },
};

export const conceptClipTitle = (stage: ConceptStage) => clips[stage].title;
export const conceptPoster = (stage: ConceptStage) => asset(stage, 'webp');

const asset = (stage: ConceptStage, ext: string) => `${import.meta.env.BASE_URL}assets/concepts/${stage}.${ext}`;

/** 발견 뒤에만 '왜 그럴까?' 버튼을 host 안(before 앞)에 둔다. show가 false면 치운다. */
export function syncConceptButton(host: Element, stage: ConceptStage, show: boolean, before: Element | null = null): void {
  const existing = host.querySelector<HTMLButtonElement>(`:scope > .concept-clip-button[data-concept="${stage}"]`);
  if (!show) { existing?.remove(); return; }
  if (existing) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-secondary concept-clip-button';
  button.dataset.concept = stage;
  button.innerHTML = '<span class="concept-clip-icon" aria-hidden="true">▶</span><span>왜 그럴까? 영상으로 보기</span>';
  button.addEventListener('click', () => openConceptClip(stage));
  host.insertBefore(button, before && before.parentNode === host ? before : null);
}

export function openConceptClip(stage: ConceptStage): void {
  if (document.querySelector('.concept-layer')) return;
  const clip = clips[stage];
  const terms: Record<ConceptStage, string[]> = { cargo:['똑같은 힘','같은 힘','같은 시간','가벼운 상자'], balance:['받침점','거리','무게','수평'], scale:['영점','0','80 g'], workshop:['빗면','힘','받침점'], rescue:['힘의 증거','같은 작은 힘','가파른 길','완만한 길'] };
  const labels: Record<ConceptStage, string[]> = { cargo:['똑같은 힘','같은 시간','움직임 비교'], balance:['같은 거리','무게 비교','수평'], scale:['영점 맞추기','무게 측정','영점의 역할'], workshop:['들어 올리기','빗면','지레의 받침점'], rescue:['힘의 증거','가파른 길','완만한 길'] };
  let releaseFocus = () => {};
  const app = document.querySelector<HTMLElement>('#app');
  const appWasInert = app?.inert ?? false;
  if (app) app.inert = true;
  const opener = document.activeElement as HTMLElement | null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = 'modal-layer concept-layer';
  layer.innerHTML = `<div class="modal-card concept-card" role="dialog" aria-modal="true" aria-labelledby="concept-title" aria-describedby="concept-caption">
    <div class="concept-topbar">
      <div class="concept-heading"><p class="eyebrow">왜 그럴까?</p><h2 id="concept-title">${clip.title}</h2></div>
      <div class="concept-actions"><button type="button" class="button button-secondary" data-concept-action="replay" hidden>↺ 다시 보기</button><button type="button" class="button button-primary" data-concept-action="close">닫기</button></div>
    </div>
    <div class="concept-video-wrap">
      <video class="concept-video" muted playsinline preload="auto" poster="${asset(stage, 'webp')}" aria-label="${clip.title} 설명 영상, 자막 있음, 소리 없음"></video>
      <img class="concept-end-frame" src="${asset(stage, 'webp')}" alt="" hidden>
      <button type="button" class="button button-primary concept-play" data-concept-action="play" hidden>▶ 영상 재생</button>
    </div>
    <p class="concept-caption" id="concept-caption" role="status" aria-live="polite"></p>
    <ol class="concept-cue-list" hidden>${clip.cues.map(cue => `<li>${cue.text}</li>`).join('')}</ol>
    <div class="concept-dots" aria-hidden="true">${clip.cues.map(() => '<i></i>').join('')}</div>
  </div>`;
  document.body.append(layer);
  const video = layer.querySelector<HTMLVideoElement>('video')!;
  const endFrame = layer.querySelector<HTMLImageElement>('.concept-end-frame')!;
  const caption = layer.querySelector<HTMLElement>('#concept-caption')!;
  const playButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="play"]')!;
  const replayButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="replay"]')!;
  const closeButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="close"]')!;
  const card = layer.querySelector<HTMLElement>('.concept-card')!;
  const dots = Array.from(layer.querySelectorAll<HTMLElement>('.concept-dots i'));
  let shown = -1, closed = false, failed = false;
  // Each caption is read aloud (the video stays silent). If a line is still being read when the next cue
  // comes, the video holds on the current caption until the line ends.
  let voiced = -1, holding = false;
  const voice = (index: number) => {
    if (index === voiced || closed || failed) return;
    voiced = index;
    playVoiceLine(`concept/${stage}-${index + 1}`, { onEnd: () => { if (holding && !closed) { holding = false; play(); } } });
  };

  const showCue = (index: number) => {
    if (index === shown) return;
    shown = index;
    caption.textContent = clip.cues[index].text;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
  };
  // The burned caption of a cue fades out from 0.3 s before the next cue starts, so a hold stops the film
  // HOLD_LEAD before the next cue: the frame it rests on still shows the line being read.
  const HOLD_LEAD = 0.4;
  const sync = () => {
    if (holding) return;
    let index = 0;
    clip.cues.forEach((cue, i) => { if (video.currentTime >= cue.at) index = i; });
    const next = clip.cues[shown + 1];
    if (!video.paused && next && index === shown && voiced === shown && voiceLinePlaying() && video.currentTime >= next.at - HOLD_LEAD) { holding = true; video.pause(); return; }
    if (index !== shown && voiced === shown && voiceLinePlaying()) {
      if (!video.paused) { holding = true; video.pause(); if (next && index === shown + 1) video.currentTime = Math.max(0, next.at - HOLD_LEAD); }
      return;
    }
    showCue(index);
    if (!video.paused) voice(index);
  };
  // Timeupdate fires only every ~250 ms; while frames play, check every animation frame so holds land on time.
  let raf = 0;
  const tick = () => { raf = 0; if (closed || failed || video.paused) return; sync(); raf = requestAnimationFrame(tick); };
  // A paused seek to a cue start (step buttons) would rest on the frame where its burned caption is still fading in.
  const settleSeek = () => {
    if (!video.paused || holding || closed || failed) return;
    const cue = clip.cues.find(c => c.at > 0 && video.currentTime >= c.at && video.currentTime < c.at + 0.3);
    if (cue) video.currentTime = cue.at + 0.3;
  };
  const setPlaying = (playing: boolean) => card.classList.toggle('is-playing', playing);
  const play = () => {
    endFrame.hidden = true;
    void video.play().then(() => { playButton.hidden = true; }).catch(() => {
      if (closed || failed) return;
      playButton.hidden = false;
      playButton.focus();
    });
  };
  // 영상을 못 쓰면 포스터(마지막 장면)와 자막 전체로 대신한다.
  const fallback = () => {
    if (closed || failed) return;
    failed = true;
    window.clearTimeout(timer);
    card.classList.remove('film-captions', 'is-playing');
    video.removeAttribute('src'); video.load();
    video.hidden = true; playButton.hidden = true; replayButton.hidden = true;
    endFrame.hidden = false; endFrame.alt = clip.title;
    caption.hidden = true;
    layer.querySelector<HTMLElement>('.concept-cue-list')!.hidden = false;
    layer.querySelector<HTMLElement>('.concept-dots')!.hidden = true;
    closeButton.focus();
  };
  // The film rests on its last frame, which still carries the last burned caption.
  const onEnded = () => {
    setPlaying(false);
    showCue(clip.cues.length - 1);
    replayButton.hidden = false;
    replayButton.focus();
  };
  const onMeta = () => {
    window.clearTimeout(timer);
    if (reduced) { playButton.hidden = false; playButton.focus(); } else play();
  };
  const onPause = () => { if (!holding && !video.ended && !video.seeking && !closed && !failed) { playButton.hidden = false; setPlaying(false); } };
  const timer = window.setTimeout(() => { if (video.readyState < 1) fallback(); }, 6000);
  video.addEventListener('loadedmetadata', onMeta);
  video.addEventListener('error', fallback);
  video.addEventListener('timeupdate', sync);
  video.addEventListener('seeked', sync);
  video.addEventListener('seeked', settleSeek);
  video.addEventListener('play', () => { playButton.hidden = true; replayButton.hidden = true; setPlaying(true); voice(shown); });
  // Frames really play: the burned captions speak for the film, the DOM caption stays for screen readers only.
  video.addEventListener('playing', () => { if (failed || closed) return; card.classList.add('film-captions'); setPlaying(true); if (!raf) raf = requestAnimationFrame(tick); });
  // Tap the film to pause or resume (a tap during a hold stays paused when the line ends).
  video.addEventListener('click', () => {
    if (failed || closed || video.ended) return;
    if (holding) { holding = false; setPlaying(false); playButton.hidden = false; return; }
    if (video.paused) play(); else video.pause();
  });
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.src = asset(stage, video.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4');
  showCue(0);

  const close = () => {
    if (closed) return;
    closed = true;
    stopVoiceLine();
    releaseFocus();
    window.clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true);
    video.pause(); video.removeAttribute('src'); video.load();
    layer.remove();
    if (app) app.inert = appWasInert;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  // 포커스 가두기와 Esc 닫기
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const items = Array.from(layer.querySelectorAll<HTMLButtonElement>('button:not([hidden])'));
    if (!items.length) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? items.length - 1 : 1;
    items[at < 0 ? 0 : (at + step) % items.length].focus();
  };
  document.addEventListener('keydown', onKey, true);
  playButton.addEventListener('click', play);
  replayButton.addEventListener('click', () => { video.currentTime = 0; voiced = -1; holding = false; showCue(0); play(); });
  closeButton.addEventListener('click', close);
  layer.addEventListener('modal-dismiss', close);
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  // The step rail sits in the top bar (after the title), clear of the caption zone at the bottom of the film.
  releaseFocus = bindConceptFocus(card, video, {steps:clip.cues.map((cue,i)=>({at:cue.at,term:labels[stage][i]})),terms:terms[stage],caption,anchor:layer.querySelector<HTMLElement>('.concept-heading')!});
  closeButton.focus();
}
