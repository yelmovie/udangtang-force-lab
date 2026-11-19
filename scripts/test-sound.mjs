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
  const made = [], policy = { allowed: true }, timers = new Map();
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
    exports, document, Audio,
    setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: id => { timers.delete(id); },
  });
  const tick = (times = 1) => { for (let n = 0; n < times; n++) [...timers.values()].forEach(fn => fn()); };
  const track = name => made.find(audio => audio.src.endsWith(`bgm-${name}.mp3`));
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} ≠ ${expected}`);
  return { sound: exports, document, policy, tick, track, near, timers };
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
  const { sound, track } = soundHarness();
  sound.playMusic('stage');
  sound.playMusic('ending');
  const stage = track('stage'), ending = track('ending');
  assert.deepEqual([stage.paused, ending.paused, ending.loop, stage.loop], [true, false, false, true]);
  sound.playMusic('ending');
  assert.equal(ending.starts, 1, 'asking again does not restart it');
  ending.finish();
  assert.equal(stage.paused, false, 'the stage loop carries on');
  stage.currentTime = 12;
  sound.playMusic('ending');
  assert.deepEqual([ending.starts, stage.paused], [1, false], 'the finished track is not started over');
  sound.playMusic('stage');
  assert.equal(stage.currentTime, 12, 'the loop already running keeps its place');
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
