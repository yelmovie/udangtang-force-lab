type SoundName = 'click' | 'bump' | 'success';
export type MusicName = 'stage' | 'ending';
const files: Record<SoundName, string> = { click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg' };
const musicFiles: Record<MusicName, string> = { stage: 'bgm-stage.mp3', ending: 'bgm-ending.mp3' };
const players = new Map<SoundName, HTMLAudioElement>();
const tracks = new Map<MusicName, HTMLAudioElement>();
let volume = 0.3;
let wanted: MusicName | null = null;
// Music sits under the effects so feedback sounds stay easy to hear.
const musicVolume = () => volume * 0.7;
export function setVolume(value: number) {
  volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  players.forEach(audio => { audio.volume = volume; });
  tracks.forEach(audio => { audio.volume = musicVolume(); });
  if (volume === 0) stopSounds();
}
export function stopSounds() { players.forEach(audio => { audio.pause(); audio.currentTime = 0; }); }
export function playSound(name: SoundName) {
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopSounds(); tracks.forEach(audio => audio.pause()); }
  else if (wanted) playMusic(wanted);
});
