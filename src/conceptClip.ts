// 미션별 개념 클립(tools/remotion-concepts에서 렌더한 무음 영상) 재생 모달.
// 스포일러 금지: 버튼은 각 미션이 핵심 발견을 확인한 뒤에만 syncConceptButton(..., true)로 보인다.
// 영상에는 글자가 없고, 자막은 장면 시간에 맞춰 DOM으로 얹는다.
import './conceptClip.css';

export type ConceptStage = 'cargo' | 'balance' | 'scale' | 'workshop' | 'rescue';
type Clip = { title: string; cues: { at: number; text: string }[] };

// at은 초. 렌더 장면(tools/remotion-concepts/src/clips)의 프레임 구간과 맞춘다.
const clips: Record<ConceptStage, Clip> = {
  cargo: { title: '같은 힘, 다른 무게', cues: [
    { at: 0, text: '같은 힘으로 부품 1개 상자와 5개 상자를 밀어요.' },
    { at: 2.9, text: '가벼운 상자가 더 멀리 갔어요. 흔적 막대의 길이를 비교해 봐요.' },
    { at: 5.2, text: '두 힘 화살표를 겹치면 길이가 같아요. 힘은 같았어요!' },
  ] },
  balance: { title: '수평대가 기우는 까닭', cues: [
    { at: 0, text: '받침점에서 양쪽 접시까지의 거리가 같아요.' },
    { at: 2.0, text: '더 무거운 쪽이 아래로 내려가요.' },
    { at: 4.3, text: '무게가 같으면 수평이 돼요.' },
  ] },
  scale: { title: '영점을 맞추는 까닭', cues: [
    { at: 0, text: '빈 저울이 15 g을 가리켜요. 0 버튼으로 영점을 맞춰요.' },
    { at: 2.0, text: '사과를 올리면 80 g이에요.' },
    { at: 3.7, text: '영점 전에는 95 g, 영점 후에는 80 g! 빈 저울을 먼저 0으로 맞춰요.' },
  ] },
  workshop: { title: '힘을 덜 드는 도구', cues: [
    { at: 0, text: '그냥 들어 올리면 길은 짧지만 큰 힘이 들어요.' },
    { at: 2.7, text: '빗면을 쓰면 힘은 작아지고, 움직이는 길은 길어져요.' },
    { at: 4.6, text: '지레는 받침점이 화물에 가까울수록 작은 힘으로 들 수 있어요.' },
  ] },
  rescue: { title: '긴 길로 코어가 도착한 까닭', cues: [
    { at: 0, text: '네 건물에서 모은 힘의 증거가 코어로 모여요.' },
    { at: 2.0, text: '같은 작은 힘으로 밀면 짧고 가파른 길에서는 멈춰요.' },
    { at: 4.6, text: '길고 완만한 길로는 끝까지 도착해요!' },
  ] },
};

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
  const app = document.querySelector<HTMLElement>('#app');
  const appWasInert = app?.inert ?? false;
  if (app) app.inert = true;
  const opener = document.activeElement as HTMLElement | null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = 'modal-layer concept-layer';
  layer.innerHTML = `<div class="modal-card concept-card" role="dialog" aria-modal="true" aria-labelledby="concept-title" aria-describedby="concept-caption">
    <p class="eyebrow">왜 그럴까?</p>
    <h2 id="concept-title">${clip.title}</h2>
    <div class="concept-video-wrap">
      <video class="concept-video" muted playsinline preload="auto" poster="${asset(stage, 'webp')}" aria-label="${clip.title} 설명 영상, 소리 없음"></video>
      <img class="concept-end-frame" src="${asset(stage, 'webp')}" alt="" hidden>
      <button type="button" class="button button-primary concept-play" data-concept-action="play" hidden>▶ 영상 재생</button>
    </div>
    <p class="concept-caption" id="concept-caption" role="status" aria-live="polite"></p>
    <ol class="concept-cue-list" hidden>${clip.cues.map(cue => `<li>${cue.text}</li>`).join('')}</ol>
    <div class="concept-dots" aria-hidden="true">${clip.cues.map(() => '<i></i>').join('')}</div>
    <div class="concept-actions"><button type="button" class="button button-secondary" data-concept-action="replay" hidden>↺ 다시 보기</button><button type="button" class="button button-primary" data-concept-action="close">닫기</button></div>
  </div>`;
  document.body.append(layer);
  const video = layer.querySelector<HTMLVideoElement>('video')!;
  const endFrame = layer.querySelector<HTMLImageElement>('.concept-end-frame')!;
  const caption = layer.querySelector<HTMLElement>('#concept-caption')!;
  const playButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="play"]')!;
  const replayButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="replay"]')!;
  const closeButton = layer.querySelector<HTMLButtonElement>('[data-concept-action="close"]')!;
  const dots = Array.from(layer.querySelectorAll<HTMLElement>('.concept-dots i'));
  let shown = -1, closed = false, failed = false;

  const showCue = (index: number) => {
    if (index === shown) return;
    shown = index;
    caption.textContent = clip.cues[index].text;
    dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
  };
  const sync = () => {
    let index = 0;
    clip.cues.forEach((cue, i) => { if (video.currentTime >= cue.at) index = i; });
    showCue(index);
  };
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
    video.removeAttribute('src'); video.load();
    video.hidden = true; playButton.hidden = true; replayButton.hidden = true;
    endFrame.hidden = false; endFrame.alt = clip.title;
    caption.hidden = true;
    layer.querySelector<HTMLElement>('.concept-cue-list')!.hidden = false;
    layer.querySelector<HTMLElement>('.concept-dots')!.hidden = true;
    closeButton.focus();
  };
  const onEnded = () => {
    endFrame.hidden = false;
    showCue(clip.cues.length - 1);
    replayButton.hidden = false;
    replayButton.focus();
  };
  const onMeta = () => {
    window.clearTimeout(timer);
    if (reduced) { playButton.hidden = false; playButton.focus(); } else play();
  };
  const onPause = () => { if (!video.ended && !video.seeking && !closed && !failed) playButton.hidden = false; };
  const timer = window.setTimeout(() => { if (video.readyState < 1) fallback(); }, 6000);
  video.addEventListener('loadedmetadata', onMeta);
  video.addEventListener('error', fallback);
  video.addEventListener('timeupdate', sync);
  video.addEventListener('seeked', sync);
  video.addEventListener('play', () => { playButton.hidden = true; replayButton.hidden = true; });
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.src = asset(stage, video.canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4');
  showCue(0);

  const close = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(timer);
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
  replayButton.addEventListener('click', () => { video.currentTime = 0; showCue(0); play(); });
  closeButton.addEventListener('click', close);
  layer.addEventListener('click', event => { if (event.target === layer) close(); });
  closeButton.focus();
}
