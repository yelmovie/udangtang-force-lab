type SoundName = 'click' | 'bump' | 'success';
const files: Record<SoundName, string> = { click: 'click_003.ogg', bump: 'error_001.ogg', success: 'confirmation_002.ogg' };
const players = new Map<SoundName, HTMLAudioElement>();
let volume = 0.3;
export function setVolume(value: number) {
  volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  players.forEach(audio => { audio.volume = volume; });
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
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSounds(); });
