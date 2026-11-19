import type { SaveData } from './state';
import { duckMusic } from './sound';

type VoiceSettings = Pick<SaveData, 'soundOn' | 'soundVolume'>;
const base = () => `${import.meta.env.BASE_URL}assets/`;

export function setDialoguePortrait(element: HTMLElement, id: string) {
  element.style.setProperty('--npc-portrait', `url("${base()}village/dialogue/${id}.webp")`);
  element.dataset.portrait = id;
}

// One line of popup speech (mission card, concept clip, discovery, map banner, villain bubble) outside a <dialog>.
// A new line replaces the previous one; music is ducked while it plays; mute and volume follow the save.
let lineSettings: () => VoiceSettings = () => ({ soundOn: false, soundVolume: 0 });
let line: HTMLAudioElement | undefined, lineRelease: (() => void) | undefined, lineDone: (() => void) | undefined;
/** The line playing now is a villain's short reaction. Villains never cut another speaker, and a guide line that
 * comes during a villain's reaction waits for it (both at most 2 s). */
let lineIsVillain = false, waiting: ReturnType<typeof setTimeout> | undefined;
const VILLAIN_WAIT = 2000, WAIT_STEP = 100;
const finishLine = () => { lineRelease?.(); lineRelease = undefined; const done = lineDone; lineDone = undefined; done?.(); };
export function configureVoiceLines(settings: () => VoiceSettings) { lineSettings = settings; }
export const voiceLinePlaying = () => !!line && !line.paused && !line.ended;
const villainSpeaking = () => lineIsVillain && voiceLinePlaying();
/** A line is waiting for its turn (see playVoiceLine). */
export const voiceLinePending = () => waiting !== undefined;
export function stopVoiceLine() { clearTimeout(waiting); waiting = undefined; lineDone = undefined; line?.pause(); finishLine(); }
// Dialogue windows that are open now, so switching sound off can silence whichever one is speaking.
const dialogueStops = new Set<() => void>();
/** Sound switched off: the line being spoken stops at once, in a popup or in a dialogue window. */
export function stopAllVoices() { stopVoiceLine(); dialogueStops.forEach(stop => stop()); }
/** Plays assets/audio/<clip>.mp3. polite: skip when another line is still playing. onEnd runs when it ends or fails.
 * villain: a villain's reaction — it waits (at most 2 s) for another speaker's line to end, then is skipped. */
export function playVoiceLine(clip: string, options: { polite?: boolean; villain?: boolean; onEnd?: () => void } = {}, waited = 0): boolean {
  if (options.polite && voiceLinePlaying()) return false;
  const blocked = options.villain ? voiceLinePlaying() && !lineIsVillain : villainSpeaking();
  if (blocked && waited < VILLAIN_WAIT) {
    clearTimeout(waiting);
    waiting = setTimeout(() => { waiting = undefined; playVoiceLine(clip, options, waited + WAIT_STEP); }, WAIT_STEP);
    return true;
  }
  if (blocked && options.villain) return false; // the other speaker is still talking after 2 s: the reaction is dropped
  stopVoiceLine();
  lineIsVillain = !!options.villain;
  const prefs = lineSettings(), volume = prefs.soundVolume ?? .3;
  if (!prefs.soundOn || volume <= 0 || document.hidden) return false;
  if (!line) {
    line = new Audio();
    line.addEventListener('playing', () => { lineRelease ??= duckMusic(); });
    for (const event of ['ended', 'error']) line.addEventListener(event, finishLine);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoiceLine(); });
  }
  line.src = `${base()}audio/${clip}.mp3`;
  line.volume = Math.min(1, volume * 1.9);
  lineDone = options.onEnd;
  void line.play().catch(finishLine);
  return true;
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
  let held: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { epoch++; clearTimeout(held); held = undefined; player.pause(); idle(); };
  dialogueStops.add(stop);
  const play = (waited = 0) => {
    clearTimeout(held); held = undefined;
    if (!src || !dialog.open || document.hidden) return;
    if (villainSpeaking() && waited < VILLAIN_WAIT) { held = setTimeout(() => play(waited + WAIT_STEP), WAIT_STEP); return; }
    const prefs = settings(), volume = prefs.soundVolume ?? .3;
    if (!prefs.soundOn || volume <= 0) return;
    stop();
    stopVoiceLine();
    const request = epoch;
    player.currentTime = 0;
    player.volume = Math.min(1, Math.max(0, volume) * 1.9);
    void player.play().catch(() => { if (epoch === request) idle(); });
  };
  replay.addEventListener('click', () => { if (player.paused) play(); else stop(); }, { signal });
  signal.addEventListener('abort', () => clearTimeout(held));
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
      stop(); dialogueStops.delete(stop); events.abort(); player.removeAttribute('src'); player.load(); player.remove();
    },
  };
}
