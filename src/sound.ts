/** Map villain moments: swing on the press, hits on the impact frame, then the roll-away exit. */
export type MapSound = 'attack' | 'hit1' | 'hit2' | 'hit3' | 'villainExit' | 'villainAppear' | 'hurt' | 'cardWhoosh' | 'cardReveal' | 'cardEpic' | 'cardSlot' | 'cardComplete'
  | 'jump' | 'labOpen' | 'labSparkle' | 'step';
type SoundName = 'click' | 'bump' | 'success' | MapSound;
/** Interface sounds: a new one cuts only the previous interface sound. Fight, card and lab-opening sounds overlap
 * (at most four at once) and are never cut by a tap; footsteps run on their own two players. */
const uiSounds: ReadonlySet<SoundName> = new Set(['click', 'bump', 'success']);
const MAX_LAYERED = 4;
export type MusicName = 'stage' | 'ending';
/** Why the music is turned down: a spoken line, or a story film that carries its own voices. */
export type DuckReason = 'voice' | 'film';
const files: Record<SoundName, string> = {
  click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg',
  attack: 'sfx/attack-swing-03.mp3', hit1: 'sfx/wood-knock-01.mp3', hit2: 'sfx/metal-clank-01.mp3', hit3: 'sfx/hit-heavy-02.mp3',
  villainExit: 'sfx/villain-exit-01.mp3', villainAppear: 'sfx/villain-appear-01.mp3', hurt: 'sfx/hurt-bump-03.mp3',
  // Achievement card: fly in, reveal (the two rarest use the longer jingle), land in the slot, full set.
  cardWhoosh: 'sfx/wind-whoosh-03.mp3', cardReveal: 'sfx/reward-01.mp3', cardEpic: 'sfx/reward-03.mp3', cardSlot: 'sfx/pickup-01.mp3', cardComplete: 'sfx/victory-jingle-01.mp3',
  // Rescue walk hop; a newly opened lab: the latch clicks, then a short sparkle 0.12 s later.
  jump: 'sfx/wind-whoosh-03.mp3', labOpen: 'sfx/open-02.mp3', labSparkle: 'sfx/twinkle-02.mp3',
  step: 'sfx/step-01.mp3', // played through stepPlayers (step-01 and step-02 in turn)
};
/** Per-role loudness under the effects volume. The map files are already quieter than the interface sounds, so only the entrance and exit are lowered. */
const levels: Partial<Record<SoundName, number>> = { villainExit: .8, villainAppear: .7, jump: .6 };
const level = (name: SoundName) => volume * effectLevel * (levels[name] ?? 1);
const musicFiles: Record<MusicName, string> = { stage: 'bgm-stage.mp3', ending: 'bgm-ending.mp3' };
const players = new Map<SoundName, HTMLAudioElement>();
const startedAt = new Map<SoundName, number>();
/** Footsteps: two files in turn, each on its own player so one step never cuts the last. 0.18 of a spoken line
 * (lines play at volume × 1.9), half that while a line is speaking; pitch wanders up to ±6 %. */
const stepFiles = ['sfx/step-01.mp3', 'sfx/step-02.mp3'];
const stepPlayers: HTMLAudioElement[] = [];
let stepTurn = 0;
export const STEP_LEVEL = 1.9 * .18;
const tracks = new Map<MusicName, HTMLAudioElement>();
let volume = 0.3;
/** The settings' effects level (0–1, default 1) on every effect and footstep; music and voices do not follow it. */
let effectLevel = 1;
/** The track the app asked for, and the one really running: the ending plays once, then the stage loop carries on. */
let wanted: MusicName | null = null, current: MusicName | null = null;
// Every holder that turns the music down keeps its own token, so it comes back only when all of them have let go.
const duckLevels: Record<DuckReason, number> = { voice: .25, film: .45 };
const musicDucks = new Map<symbol, DuckReason>();
// Music sits under the effects so feedback sounds stay easy to hear.
// After the ceremony track has ended, the stage loop carries on under the ceremony screens at 0.45 of its usual level.
const afterEnding = () => wanted === 'ending' && current === 'stage' ? .45 : 1;
const musicVolume = () => volume * 0.7 * afterEnding() * Math.min(1, ...[...musicDucks.values()].map(reason => duckLevels[reason]));
let fade: ReturnType<typeof setInterval> | undefined;
/** Brings every track to the level it should have now. glide: take about 0.18 s instead of jumping. */
function levelMusic(glide = false) {
  clearInterval(fade);
  const target = musicVolume(), from = (current && tracks.get(current)?.volume) ?? target;
  if (!glide || from === target) { tracks.forEach(audio => { audio.volume = target; }); return; }
  let step = 0;
  fade = setInterval(() => {
    step += 1;
    const now = step >= 6 ? target : from + (target - from) * step / 6;
    tracks.forEach(audio => { audio.volume = now; });
    if (step >= 6) clearInterval(fade);
  }, 30);
}
export function setVolume(value: number) {
  const next = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  if (next === volume) return;
  volume = next;
  players.forEach((audio, name) => { audio.volume = level(name); });
  levelMusic();
  if (volume === 0) stopSounds();
}
export function setEffectVolume(value: number) {
  const next = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  if (next === effectLevel) return;
  effectLevel = next;
  players.forEach((audio, name) => { audio.volume = level(name); });
  if (effectLevel === 0) stopSounds();
}
const halt = (audio: HTMLAudioElement | undefined) => { if (audio) { audio.pause(); audio.currentTime = 0; } };
const sounding = (audio: HTMLAudioElement | undefined) => !!audio && !audio.paused && !audio.ended;
/** Mute, a hidden tab or the finale: every effect and footstep stops. */
export function stopSounds() { players.forEach(halt); stepPlayers.forEach(halt); }
/** Milliseconds left of an effect that is playing now (0 when it is not). */
export function soundLeft(name: SoundName) {
  const audio = players.get(name);
  if (!sounding(audio)) return 0;
  const { duration, currentTime, playbackRate } = audio!;
  return Number.isFinite(duration) ? Math.max(0, (duration - currentTime) / (playbackRate || 1) * 1000) : 2500;
}
const voiceSpeaking = () => [...musicDucks.values()].includes('voice');
function playStep() {
  const turn = stepTurn++ % stepFiles.length;
  const audio = stepPlayers[turn] ??= new Audio(`${import.meta.env.BASE_URL}assets/audio/${stepFiles[turn]}`);
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
  audio.playbackRate = .94 + Math.random() * .12;
  audio.volume = Math.min(1, volume * effectLevel * STEP_LEVEL * (voiceSpeaking() ? .5 : 1));
  audio.currentTime = 0;
  void audio.play().catch(() => { /* Silent mode or browser audio policy must not block play. */ });
}
export function playSound(name: SoundName) {
  if (volume === 0 || effectLevel === 0 || document.hidden) return;
  if (name === 'step') { playStep(); return; }
  if (uiSounds.has(name)) uiSounds.forEach(other => halt(players.get(other)));
  else {
    // Layered sounds overlap; past four at once, the oldest one gives way.
    const layered = [...players].filter(([other, audio]) => other !== name && !uiSounds.has(other) && sounding(audio));
    if (layered.length >= MAX_LAYERED) {
      const [oldest] = layered.sort(([a], [b]) => (startedAt.get(a) ?? 0) - (startedAt.get(b) ?? 0))[0];
      halt(players.get(oldest));
    }
  }
  let audio = players.get(name);
  if (!audio) { audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${files[name]}`); players.set(name, audio); }
  audio.volume = level(name);
  audio.currentTime = 0;
  startedAt.set(name, performance.now());
  void audio.play().catch(() => { /* Silent mode or browser audio policy must not block play. */ });
}
// Browsers refuse audio until the page has been tapped or a key pressed, so a refused start tries again on the next one.
const inputs = ['pointerdown', 'pointerup', 'keydown'] as const;
let waitingForInput = false;
function retryOnInput() {
  if (waitingForInput) return;
  waitingForInput = true;
  const retry = () => {
    waitingForInput = false;
    inputs.forEach(type => document.removeEventListener(type, retry, true));
    if (wanted) playMusic(wanted);
  };
  inputs.forEach(type => document.addEventListener(type, retry, true));
}
function startMusic() {
  if (!current) return;
  let audio = tracks.get(current);
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${musicFiles[current]}`);
    audio.loop = current === 'stage';
    audio.volume = musicVolume();
    // The ceremony track plays once; the stage loop takes over so the screen never falls silent.
    if (current === 'ending') audio.addEventListener('ended', () => { if (wanted === 'ending' && current === 'ending') { current = 'stage'; levelMusic(); startMusic(); } });
    tracks.set(current, audio);
  }
  if (audio.paused && !audio.ended && !document.hidden) void audio.play().catch(retryOnInput);
}
/** Starts one background track (the stage track loops); asking again for the track already playing changes nothing. */
export function playMusic(name: MusicName) {
  if (wanted !== name) {
    wanted = name;
    if (current !== name) { tracks.forEach(audio => { audio.pause(); audio.currentTime = 0; }); current = name; }
    levelMusic();
  }
  startMusic();
}
export function stopMusic() { wanted = null; current = null; tracks.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopSounds(); tracks.forEach(audio => audio.pause()); }
  else if (wanted) playMusic(wanted);
});

/** Turns the music down (never off) under a spoken line or a story film. The returned function lets go again. */
export function duckMusic(reason: DuckReason = 'voice') {
  const token = Symbol(reason);
  musicDucks.set(token, reason);
  levelMusic(true);
  return () => { if (musicDucks.delete(token)) levelMusic(true); };
}
