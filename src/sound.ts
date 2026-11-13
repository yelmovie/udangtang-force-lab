type SoundName = 'click' | 'bump' | 'success';
export type MusicName = 'stage' | 'ending';
const files: Record<SoundName, string> = { click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg' };
const musicFiles: Record<MusicName, string> = { stage: 'bgm-stage.mp3', ending: 'bgm-ending.mp3' };
const players = new Map<SoundName, HTMLAudioElement>();
const tracks = new Map<MusicName, HTMLAudioElement>();
let volume = 0.3;
let wanted: MusicName | null = null;
// Music sits under the effects so feedback sounds stay easy to hear.
const musicVolume = () => volume * 0.7 * (musicDucks.size ? .32 : 1);
export function setVolume(value: number) {
  volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  players.forEach(audio => { audio.volume = volume; });
  tracks.forEach(audio => { audio.volume = musicVolume(); });
  if (volume === 0) stopSounds();
}
export function stopSounds() { players.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
export function playSound(name: SoundName) {
  if (volume === 0 || document.hidden) return;
  stopSounds();
  let audio = players.get(name);
  if (!audio) { audio = new Audio(`${import.meta.env.BASE_URL}assets/audio/${files[name]}`); players.set(name, audio); }
  audio.volume = volume;
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
