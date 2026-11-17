/** Map villain moments: swing on the press, hits on the impact frame, then the roll-away exit. */
export type MapSound = 'attack' | 'hit1' | 'hit2' | 'hit3' | 'villainExit' | 'villainAppear' | 'hurt';
type SoundName = 'click' | 'bump' | 'success' | MapSound;
export type MusicName = 'stage' | 'ending';
const files: Record<SoundName, string> = {
  click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg',
  attack: 'sfx/attack-swing-03.mp3', hit1: 'sfx/wood-knock-01.mp3', hit2: 'sfx/metal-clank-01.mp3', hit3: 'sfx/hit-heavy-02.mp3',
  villainExit: 'sfx/villain-exit-01.mp3', villainAppear: 'sfx/villain-appear-01.mp3', hurt: 'sfx/hurt-bump-03.mp3',
};
/** Per-role loudness under the effects volume. The map files are already quieter than the interface sounds, so only the entrance and exit are lowered. */
const levels: Partial<Record<SoundName, number>> = { villainExit: .8, villainAppear: .7 };
const level = (name: SoundName) => volume * (levels[name] ?? 1);
const musicFiles: Record<MusicName, string> = { stage: 'bgm-stage.mp3', ending: 'bgm-ending.mp3' };
const players = new Map<SoundName, HTMLAudioElement>();
const tracks = new Map<MusicName, HTMLAudioElement>();
let volume = 0.3;
let wanted: MusicName | null = null;
// Music sits under the effects so feedback sounds stay easy to hear.
const musicVolume = () => volume * 0.7 * (musicDucks.size ? .32 : 1);
export function setVolume(value: number) {
  volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  players.forEach((audio, name) => { audio.volume = level(name); });
  tracks.forEach(audio => { audio.volume = musicVolume(); });
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
/** Starts one background track (the stage track loops); asking again for the track already playing changes nothing. */
export function playMusic(name: MusicName) {
  if (wanted !== name) tracks.forEach(audio => { audio.pause(); audio.currentTime = 0; });
  wanted = name;
  let audio = tracks.get(name);
  if (!audio) { audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${musicFiles[name]}`); audio.loop = name === 'stage'; tracks.set(name, audio); }
  audio.volume = musicVolume();
  if (audio.paused && !audio.ended && !document.hidden) void audio.play().catch(() => { /* Autoplay waits for the first tap. */ });
}
export function stopMusic() { wanted = null; tracks.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopSounds(); tracks.forEach(audio => audio.pause()); }
  else if (wanted) playMusic(wanted);
});

// Reduce music under a line of dialogue without restarting the track.
const musicDucks = new Set<symbol>();
export function duckMusic() {
  const token = Symbol();
  musicDucks.add(token);
  tracks.forEach(audio => { audio.volume = musicVolume(); });
  return () => {
    musicDucks.delete(token);
    tracks.forEach(audio => { audio.volume = musicVolume(); });
  };
}
