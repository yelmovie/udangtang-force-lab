import type { SaveData } from './state';
import { duckMusic } from './sound';

type VoiceSettings = Pick<SaveData, 'soundOn' | 'soundVolume'>;
const base = () => `${import.meta.env.BASE_URL}assets/`;

export function setDialoguePortrait(element: HTMLElement, id: string) {
  element.style.setProperty('--npc-portrait', `url("${base()}village/dialogue/${id}.webp")`);
  element.dataset.portrait = id;
}

export function mountDialogueVoice(dialog: HTMLDialogElement, settings: () => VoiceSettings) {
  const events = new AbortController();
  const { signal } = events;
  const player = document.createElement('audio');
  player.preload = 'none';
  player.hidden = true;
  dialog.append(player);
  const replay = dialog.querySelector<HTMLButtonElement>('[data-dialogue-voice]')!;
  let src: string | undefined, epoch = 0, release: (() => void) | undefined;
  const idle = () => {
    dialog.dataset.speaking = 'false';
    release?.();
    release = undefined;
    replay.textContent = '다시 듣기';
  };
  const stop = () => { epoch++; player.pause(); idle(); };
  const play = () => {
    if (!src || !dialog.open || document.hidden) return;
    const prefs = settings(), volume = prefs.soundVolume ?? .3;
    if (!prefs.soundOn || volume <= 0) return;
    stop();
    const request = epoch;
    player.currentTime = 0;
    player.volume = Math.min(1, Math.max(0, volume) * 1.9);
    void player.play().catch(() => { if (epoch === request) idle(); });
  };
  replay.addEventListener('click', () => { if (player.paused) play(); else stop(); }, { signal });
  player.addEventListener('playing', () => {
    if (!dialog.open || player.paused) { stop(); return; }
    release ??= duckMusic();
    dialog.dataset.speaking = 'true';
    replay.textContent = '음성 멈추기';
  }, { signal });
  for (const event of ['ended', 'error', 'waiting']) player.addEventListener(event, idle, { signal });
  player.addEventListener('pause', () => { if (player.paused) idle(); }, { signal });
  dialog.addEventListener('cancel', stop, { signal });
  dialog.addEventListener('close', () => { if (!dialog.open) stop(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
  window.addEventListener('pagehide', stop, { signal });
  return {
    show(clip?: string) {
      stop();
      src = clip ? `${base()}audio/${clip}.mp3` : undefined;
      replay.hidden = !src || !settings().soundOn || (settings().soundVolume ?? .3) <= 0;
      if (!src || replay.hidden) return;
      player.src = src;
      play();
    },
    stop,
    destroy() {
      stop(); events.abort(); player.removeAttribute('src'); player.load(); player.remove();
    },
  };
}
