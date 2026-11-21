// 이야기 창: 시작 이야기·점등식 영상(자막 큐)과 그림 장면. main.ts에서 그대로 옮김(2026-11-19, 동작 변경 없음).
// 앱 상태(소리 켬·크기, 배경 음악)는 configureStoryModal로 main.ts가 넘겨준다.
import { duckMusic, type MusicName } from './sound';
import { icons } from './icons';
import { stepTabRing } from './focusTrap';

export type StoryModalHost = {
  app: HTMLElement;
  tone(frequency?: number): void;
  confetti(host: HTMLElement): void;
  /** 효과음이나 배경 음악이 하나라도 켜져 있나 */
  soundOn(): boolean;
  /** 설정의 목소리 스위치. 이야기 영상은 대사가 소리 트랙에 섞여 있어 꺼지면 영상을 음소거한다 */
  voiceOn(): boolean;
  /** 저장된 전체 소리 크기(0~1, 기본 .3) */
  volume(): number;
  /** 이야기 창이 원하는 배경 음악(없으면 지금 화면의 곡 그대로, 닫히면 null) */
  setMusic(music: MusicName | null): void;
};
let host: StoryModalHost | null = null;
export function configureStoryModal(next: StoryModalHost) { host = next; }

export const prologueLines = [
  { who: '도토리 박사', text: '우당탕 마을에 전기가 모두 나갔어! 무슨 일이 생긴 걸까?' },
  { who: '도토리 박사', text: '원인을 찾았어! 마을의 배터리 ‘코어’가 중앙 장치에서 분리돼 있어. 다시 끼워야 전기가 돌아와.' },
  { who: '코기 콩이', text: '코어가 너무 무거워! 힘을 쓰는 방법을 배워서 다시 끼우자!' },
];
export type StoryVideo = { src: string; cues: number[]; duration: number; poster?: string };
export type StoryOptions = { lines: { who: string; text: string }[]; finishLabel: string; onDone?: () => void; skippable?: boolean; scenes?: string[]; video?: StoryVideo; music?: MusicName; finale?: boolean };
export const introVideo: StoryVideo = { src: '/assets/story/intro.mp4', cues: [0, 6, 13], duration: 18, poster: '/assets/story/intro-01.webp' };
export const endingVideo: StoryVideo = { src: '/assets/story/ending.mp4', cues: [0, 5, 13], duration: 21.2, poster: '/assets/story/final-01.webp' };
export function storyCueIndex(cues: number[], time: number): number {
  let found = 0;
  cues.forEach((start, i) => { if (time >= start) found = i; });
  return found;
}
export function openStoryModal(options: StoryOptions) {
  const { app, tone, confetti } = host!;
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
    host!.setMusic(null);
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
        <video class="story-video" playsinline preload="auto" ${video.poster ? `poster="${video.poster}"` : ''} aria-label="${options.scenes ? '엔딩 영상' : '프롤로그 영상'}" src="${video.src}"></video>
        <img class="story-end-frame" src="${options.scenes?.at(-1) ?? `/assets/story/intro-0${options.lines.length}.webp`}" alt="" hidden>
        <button type="button" class="button button-primary story-play" data-story="play" hidden>${icons.play} 영상 재생</button>
        <p class="story-video-loading" role="status">영상 준비 중…</p>
      </div>
      <div class="story-finish-banner" aria-hidden="true"><span>★</span>${options.scenes ? '마을에 불이 켜졌어!' : '코어를 옮길 방법을 찾자!'}<span>★</span></div>
      <p class="eyebrow" id="story-title"></p>
      <p class="story-text story-caption" id="story-caption" role="status" aria-live="polite"></p>
      <div class="story-dots" aria-hidden="true">${dots}</div>
      <div class="story-actions"><div class="story-film-controls">${options.finale ? '<button type="button" class="button button-secondary story-audio-toggle" data-story="audio" aria-pressed="false">영상 소리 켜기</button>' : ''}<button type="button" class="button button-secondary story-pause-toggle" data-story="pause" aria-pressed="false">일시정지</button><button type="button" class="button button-secondary story-replay" data-story="replay">처음부터</button></div><button class="button button-secondary" data-story="skip">${options.finale ? '지도로 돌아가기' : '건너뛰기'}</button><button class="button button-primary" data-story="done" hidden>${options.finishLabel}</button></div>
    </div>`;
    const el = modal.querySelector<HTMLVideoElement>('video')!;
    // The film's lines are mixed into its soundtrack, so the voice switch mutes the whole film (the music then plays on at its usual level).
    el.muted = !host!.soundOn() || !host!.voiceOn();
    el.volume = Math.min(1, Math.max(0, host!.volume() * 2.4));
    // The film carries its own voices: the music keeps playing underneath, turned down until the film ends or is silenced.
    let filmOver = false, releaseMusic: (() => void) | undefined;
    const syncFilmMusic = () => {
      if (!filmOver && !el.muted && el.volume > 0) releaseMusic ??= duckMusic('film');
      else { releaseMusic?.(); releaseMusic = undefined; }
    };
    const who = modal.querySelector<HTMLElement>('#story-title')!;
    const caption = modal.querySelector<HTMLElement>('#story-caption')!;
    const dotNodes = Array.from(modal.querySelectorAll<HTMLElement>('.story-dots i'));
    const playBtn = modal.querySelector<HTMLButtonElement>('[data-story="play"]')!;
    const skipBtn = modal.querySelector<HTMLButtonElement>('[data-story="skip"]')!;
    const doneBtn = modal.querySelector<HTMLButtonElement>('[data-story="done"]')!;
    const pauseBtn = modal.querySelector<HTMLButtonElement>('[data-story="pause"]')!;
    const replayBtn = modal.querySelector<HTMLButtonElement>('[data-story="replay"]')!;
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
    const finishUi = () => { filmOver = true;
      syncFilmMusic();
      el.controls = false;
      endFrame.hidden = false;
      showCue(options.lines.length - 1);
      skipBtn.hidden = true;
      pauseBtn.hidden = true;
      doneBtn.hidden = false;
      playBtn.hidden = true;
      card.classList.add('is-finished');
      celebrate();
      doneBtn.focus(); };
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
    // The poster and a "준비 중" note cover the wait; both go once the first frame is ready.
    const loadingNote = modal.querySelector<HTMLElement>('.story-video-loading');
    const onReady = () => { if (loadingNote) loadingNote.hidden = true; };
    el.addEventListener('loadeddata', onReady, { once: true });
    const syncPause = () => { const playing = !el.paused && !el.ended; pauseBtn.textContent = playing ? '일시정지' : '재생'; pauseBtn.setAttribute('aria-pressed', String(!playing)); };
    const onPlay = () => { playBtn.hidden = true; onReady(); syncPause(); };
    // The captions are burned into the film: once frames really play, the DOM caption stays for screen readers only.
    const onPlaying = () => { card.classList.add('film-captions'); };
    const onPause = () => { if (!el.ended && !el.seeking) playBtn.hidden = false; syncPause(); };
    const togglePause = () => { if (el.ended) return; if (el.paused) tryPlay(); else el.pause(); };
    pauseBtn.addEventListener('click', () => { tone(470); togglePause(); });
    el.addEventListener('click', togglePause);
    replayBtn.addEventListener('click', () => {
      tone(470);
      endFrame.hidden = true; card.classList.remove('is-finished'); skipBtn.hidden = false; doneBtn.hidden = true; pauseBtn.hidden = false;
      filmOver = false; syncFilmMusic();
      el.currentTime = 0; sync(); tryPlay();
    });
    const audioToggle = modal.querySelector<HTMLButtonElement>('[data-story="audio"]');
    const syncAudio = () => {
      syncFilmMusic();
      const on = !el.muted && el.volume > 0;
      audioToggle?.setAttribute('aria-pressed', String(on));
      if (audioToggle) audioToggle.textContent = on ? '영상 소리 끄기' : '영상 소리 켜기';
    };
    audioToggle?.addEventListener('click', () => {
      if (el.muted || !el.volume) { if (!el.volume) el.volume = .72; el.muted = false; }
      else el.muted = true;
      syncAudio();
      if (!el.ended && el.paused) tryPlay();
    });
    el.addEventListener('volumechange', syncAudio);
    syncAudio();
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('error', fallback);
    el.addEventListener('timeupdate', sync);
    el.addEventListener('seeked', sync);
    el.addEventListener('play', onPlay);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', finishUi);
    // A hidden tab pauses the film (its voices would play on unseen); it carries on when the tab comes back.
    let resumeOnShow = false;
    const onVisibility = () => {
      if (document.hidden) { if (!el.paused && !el.ended) { resumeOnShow = true; el.pause(); } }
      else if (resumeOnShow) { resumeOnShow = false; tryPlay(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    teardownVideo = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timer);
      el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('error', fallback);
      el.removeEventListener('timeupdate', sync); el.removeEventListener('seeked', sync);
      el.removeEventListener('play', onPlay); el.removeEventListener('playing', onPlaying); el.removeEventListener('pause', onPause); el.removeEventListener('click', togglePause); el.removeEventListener('ended', finishUi); el.removeEventListener('volumechange', syncAudio);
      el.pause(); el.removeAttribute('src'); el.load();
      filmOver = true; syncFilmMusic();
    };
    playBtn.addEventListener('click', () => { tone(470); tryPlay(); });
    showCue(0);
    skipBtn.focus();
  };
  modal.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-story]');
    if (!button || ['play','audio','pause','replay'].includes(button.dataset.story ?? '')) return;
    tone(470);
    if (button.dataset.story === 'skip' || button.dataset.story === 'done' || index === options.lines.length - 1) { close(); return; }
    index += 1; draw();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    if (modal.querySelector('.story-video-card')) {
      stepTabRing(event, Array.from(modal.querySelectorAll<HTMLElement>('button:not([hidden]), video[controls]')), false);
      return;
    }
    event.preventDefault(); modal.querySelector<HTMLButtonElement>('[data-story="next"]')?.focus();
  });
  document.addEventListener('keydown', onEscape, true);
  document.body.append(modal);
  // The film turns the music down first, so a track that starts for it starts quiet.
  if (options.video) drawVideo(options.video); else draw();
  host!.setMusic(options.music ?? null);
}
