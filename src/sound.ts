/** Map villain moments: swing on the press, hits on the impact frame, then the roll-away exit. */
export type MapSound = 'attack' | 'hit1' | 'hit2' | 'hit3' | 'villainExit' | 'villainAppear' | 'hurt' | 'cardWhoosh' | 'cardReveal' | 'cardEpic' | 'cardSlot' | 'cardComplete';
type SoundName = 'click' | 'bump' | 'success' | MapSound;
export type MusicName = 'stage' | 'ending';
/** Why the music is turned down: a spoken line, or a story film that carries its own voices. */
export type DuckReason = 'voice' | 'film';
const files: Record<SoundName, string> = {
  click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg',
  attack: 'sfx/attack-swing-03.mp3', hit1: 'sfx/wood-knock-01.mp3', hit2: 'sfx/metal-clank-01.mp3', hit3: 'sfx/hit-heavy-02.mp3',
  villainExit: 'sfx/villain-exit-01.mp3', villainAppear: 'sfx/villain-appear-01.mp3', hurt: 'sfx/hurt-bump-03.mp3',
  // Achievement card: fly in, reveal (the two rarest use the longer jingle), land in the slot, full set.
  cardWhoosh: 'sfx/wind-whoosh-03.mp3', cardReveal: 'sfx/reward-01.mp3', cardEpic: 'sfx/reward-03.mp3', cardSlot: 'sfx/pickup-01.mp3', cardComplete: 'sfx/victory-jingle-01.mp3',
};
/** Per-role loudness under the effects volume. The map files are already quieter than the interface sounds, so only the entrance and exit are lowered. */
const levels: Partial<Record<SoundName, number>> = { villainExit: .8, villainAppear: .7 };
const level = (name: SoundName) => volume * (levels[name] ?? 1);
const musicFiles: Record<MusicName, string> = { stage: 'bgm-stage.mp3', ending: 'bgm-ending.mp3' };
const players = new Map<SoundName, HTMLAudioElement>();
const tracks = new Map<MusicName, HTMLAudioElement>();
let volume = 0.3;
/** The track the app asked for, and the one really running: the ending plays once, then the stage loop carries on. */
let wanted: MusicName | null = null, current: MusicName | null = null;
// Every holder that turns the music down keeps its own token, so it comes back only when all of them have let go.
const duckLevels: Record<DuckReason, number> = { voice: .25, film: .45 };
const musicDucks = new Map<symbol, DuckReason>();
// Music sits under the effects so feedback sounds stay easy to hear.
const musicVolume = () => volume * 0.7 * Math.min(1, ...[...musicDucks.values()].map(reason => duckLevels[reason]));
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
export function stopSounds() { players.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
export function playSound(name: SoundName) {
  if (volume === 0 || document.hidden) return;
  stopSounds();
  let audio = players.get(name);
  if (!audio) { audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${files[name]}`); players.set(name, audio); }
  audio.volume = level(name);
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
    if (current === 'ending') audio.addEventListener('ended', () => { if (wanted === 'ending' && current === 'ending') { current = 'stage'; startMusic(); } });
    tracks.set(current, audio);
  }
  if (audio.paused && !audio.ended && !document.hidden) void audio.play().catch(retryOnInput);
}
/** Starts one background track (the stage track loops); asking again for the track already playing changes nothing. */
export function playMusic(name: MusicName) {
  if (wanted !== name) {
    wanted = name;
    if (current !== name) { tracks.forEach(audio => { audio.pause(); audio.currentTime = 0; }); current = name; }
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
