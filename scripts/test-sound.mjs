import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../src/sound.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', "'/'"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** sound.ts with stand-in audio elements, a document and hand-driven timers. */
function soundHarness() {
  const made = [], policy = { allowed: true }, timers = new Map(), clock = { now: 0 };
  // Fixed "random" pitch so footstep rates can be checked.
  const rng = Object.create(Math); rng.random = () => rng.next ?? .5;
  let nextTimer = 0;
  class Audio extends EventTarget {
    paused = true; ended = false; volume = 1; loop = false; starts = 0; #time = 0;
    constructor(src) { super(); this.src = src; made.push(this); }
    get currentTime() { return this.#time; }
    // Seeking away from the end clears `ended`, as a real media element does.
    set currentTime(value) { this.#time = value; this.ended = false; }
    play() {
      if (!policy.allowed) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false; this.starts += 1;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    finish() { this.paused = true; this.ended = true; this.dispatchEvent(new Event('ended')); }
  }
  const document = new EventTarget();
  document.hidden = false;
  const exports = {};
  vm.runInNewContext(source, {
    exports, document, Audio, performance: { now: () => clock.now }, Math: rng,
    setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: id => { timers.delete(id); },
  });
  const tick = (times = 1) => { for (let n = 0; n < times; n++) [...timers.values()].forEach(fn => fn()); };
  const track = name => made.find(audio => audio.src.endsWith(`bgm-${name}.mp3`));
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} ≠ ${expected}`);
  const effect = file => made.filter(audio => audio.src.endsWith(file));
  return { sound: exports, document, policy, tick, track, near, timers, clock, effect, rng };
}

test('music is turned down by reason and returns only when every holder has let go', () => {
  const { sound, tick, track, near } = soundHarness();
  sound.playMusic('stage');
  const stage = track('stage');
  near(stage.volume, .3 * .7, 'plain level');
  const voice = sound.duckMusic('voice'); tick(6);
  near(stage.volume, .3 * .7 * .25, 'under a spoken line');
  const film = sound.duckMusic('film'); tick(6);
  near(stage.volume, .3 * .7 * .25, 'the lowest level wins while both hold');
  const second = sound.duckMusic(); tick(6);
  voice(); tick(6);
  near(stage.volume, .3 * .7 * .25, 'another line still holds it down');
  second(); tick(6);
  near(stage.volume, .3 * .7 * .45, 'only the film holds it now');
  voice(); second(); tick(6);
  near(stage.volume, .3 * .7 * .45, 'letting go twice changes nothing');
  film(); tick(6);
  near(stage.volume, .3 * .7, 'back to the plain level');
  assert.equal(stage.paused, false, 'the music never stopped');
});

test('the level glides over six short steps and the volume slider still jumps', () => {
  const { sound, tick, track, near, timers } = soundHarness();
  sound.playMusic('stage');
  const stage = track('stage'), release = sound.duckMusic('film');
  near(stage.volume, .21, 'not changed before the first step');
  const seen = [];
  for (let n = 0; n < 6; n++) { tick(); seen.push(stage.volume); }
  assert.deepEqual([...seen].sort((a, b) => b - a), seen, 'falls step by step');
  near(seen.at(-1), .21 * .45);
  assert.equal(timers.size, 0, 'the timer is cleared at the end');
  sound.setVolume(.6);
  near(stage.volume, .6 * .7 * .45, 'a new overall volume applies at once and keeps the duck');
  release(); tick(6);
  near(stage.volume, .6 * .7);
});

test('the ending track plays once and hands over to the stage loop', () => {
  const { sound, track, near } = soundHarness();
  sound.playMusic('stage');
  sound.playMusic('ending');
  const stage = track('stage'), ending = track('ending');
  assert.deepEqual([stage.paused, ending.paused, ending.loop, stage.loop], [true, false, false, true]);
  sound.playMusic('ending');
  assert.equal(ending.starts, 1, 'asking again does not restart it');
  ending.finish();
  assert.equal(stage.paused, false, 'the stage loop carries on');
  near(stage.volume, .3 * .7 * .45, 'quietly, while the ceremony screens stay open');
  stage.currentTime = 12;
  sound.playMusic('ending');
  assert.deepEqual([ending.starts, stage.paused], [1, false], 'the finished track is not started over');
  sound.playMusic('stage');
  assert.equal(stage.currentTime, 12, 'the loop already running keeps its place');
  near(stage.volume, .3 * .7, 'back to the usual level once the screens are left');
  sound.playMusic('ending');
  assert.deepEqual([stage.paused, ending.paused, ending.currentTime], [true, false, 0], 'a new visit starts the ending again');
  sound.stopMusic();
  assert.deepEqual([stage.paused, ending.paused], [true, true]);
});

test('a start the browser refuses is tried again on the next tap or key', async () => {
  const { sound, document, policy, track } = soundHarness();
  policy.allowed = false;
  sound.playMusic('stage');
  await new Promise(resolve => setTimeout(resolve));
  const stage = track('stage');
  assert.equal(stage.paused, true);
  document.dispatchEvent(new Event('pointerdown'));
  await new Promise(resolve => setTimeout(resolve));
  assert.equal(stage.paused, true, 'still refused: keeps waiting');
  policy.allowed = true;
  document.dispatchEvent(new Event('keydown'));
  assert.equal(stage.paused, false, 'the key press starts the music');
  policy.allowed = false;
  sound.stopMusic(); sound.playMusic('stage');
  await new Promise(resolve => setTimeout(resolve));
  sound.stopMusic();
  policy.allowed = true;
  document.dispatchEvent(new Event('pointerup'));
  assert.equal(stage.paused, true, 'music switched off in the meantime stays off');
});

test('a tap cuts only the last tap sound: swing, hit and card sounds play on together', () => {
  const { sound, effect } = soundHarness();
  sound.setVolume(.3);
  sound.playSound('attack'); sound.playSound('hit1');
  const [swing] = effect('attack-swing-03.mp3'), [hit] = effect('wood-knock-01.mp3');
  assert.deepEqual([swing.paused, hit.paused], [false, false], 'the hit no longer cuts the swing');
  sound.playSound('cardComplete');
  sound.playSound('click');
  const [jingle] = effect('victory-jingle-01.mp3'), [click] = effect('click_003.ogg');
  assert.deepEqual([jingle.paused, swing.paused, click.paused], [false, false, false], 'a tap leaves the fight and card sounds alone');
  sound.playSound('success');
  assert.deepEqual([click.paused, effect('confirmation_002.ogg')[0].paused, jingle.paused], [true, false, false], 'a new tap sound cuts the old one only');
  sound.playSound('step');
  assert.equal(jingle.paused, false, 'a footstep cuts nothing');
  sound.stopSounds();
  assert.ok([swing, hit, jingle, ...effect('step-01.mp3')].every(audio => audio.paused), 'mute stops everything');
});

test('at most four layered sounds: the oldest gives way to a fifth', () => {
  const { sound, effect, clock } = soundHarness();
  sound.setVolume(.3);
  for (const name of ['attack', 'hit1', 'hit2', 'hit3', 'villainExit']) { clock.now += 10; sound.playSound(name); }
  assert.equal(effect('attack-swing-03.mp3')[0].paused, true, 'the first one stopped');
  assert.equal(effect('villain-exit-01.mp3')[0].paused, false);
  assert.equal(['wood-knock-01.mp3', 'metal-clank-01.mp3', 'hit-heavy-02.mp3', 'villain-exit-01.mp3'].filter(file => !effect(file)[0].paused).length, 4);
});

test('footsteps take turns, wander in pitch and duck under a spoken line', () => {
  const { sound, effect, rng, near } = soundHarness();
  sound.setVolume(.3);
  rng.next = 0; sound.playSound('step');
  rng.next = 1; sound.playSound('step');
  const [one] = effect('step-01.mp3'), [two] = effect('step-02.mp3');
  assert.deepEqual([one.paused, two.paused], [false, false], 'the second step does not cut the first');
  near(one.playbackRate, .94); near(two.playbackRate, 1.06);
  near(one.volume, .3 * sound.STEP_LEVEL, 'plain level');
  near(sound.STEP_LEVEL, 1.9 * .18, '0.18 of a spoken line');
  const release = sound.duckMusic('voice');
  sound.playSound('step');
  near(one.volume, .3 * sound.STEP_LEVEL * .5, 'half under a line');
  release(); sound.setVolume(0); sound.setVolume(.3);
  const film = sound.duckMusic('film'); sound.playSound('step');
  near(two.volume, .3 * sound.STEP_LEVEL, 'a film does not halve them');
  film();
});

test('the effects level scales every effect and footstep, leaves music alone, and is the old level at 100 %', () => {
  const { sound, effect, track, near } = soundHarness();
  sound.setVolume(.3); sound.playMusic('stage');
  sound.playSound('hit1'); sound.playSound('villainExit'); sound.playSound('step');
  const [hit] = effect('wood-knock-01.mp3'), [exit] = effect('villain-exit-01.mp3'), [step] = effect('step-01.mp3');
  near(hit.volume, .3, 'default: unchanged'); near(exit.volume, .3 * .8); near(step.volume, .3 * sound.STEP_LEVEL);
  sound.setEffectVolume(.5);
  near(hit.volume, .15, 'a playing effect follows at once'); near(exit.volume, .3 * .8 * .5);
  sound.playSound('step'); sound.playSound('step');
  near(step.volume, .3 * sound.STEP_LEVEL * .5, 'footsteps too');
  near(track('stage').volume, .3 * .7, 'music keeps its level');
  sound.setEffectVolume(0);
  assert.ok([hit, exit, step].every(audio => audio.paused), 'zero stops the effects');
  sound.playSound('click');
  assert.equal(effect('click_003.ogg').length, 0, 'and plays none');
  assert.equal(track('stage').paused, false, 'music plays on');
  sound.setEffectVolume(1); sound.playSound('hit1');
  near(hit.volume, .3, 'back to the old level');
});

test('soundLeft tells how long an effect still has to play', () => {
  const { sound, effect } = soundHarness();
  sound.setVolume(.3);
  assert.equal(sound.soundLeft('cardComplete'), 0, 'not playing');
  sound.playSound('cardComplete');
  const [jingle] = effect('victory-jingle-01.mp3');
  jingle.duration = 2.4; jingle.currentTime = .4; jingle.playbackRate = 1;
  assert.ok(Math.abs(sound.soundLeft('cardComplete') - 2000) < 1e-6);
  jingle.finish();
  assert.equal(sound.soundLeft('cardComplete'), 0, 'finished');
});
