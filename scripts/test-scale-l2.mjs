import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

// Import the actual TypeScript modules without producing build files or adding dependencies.
const moduleUrls = new Map();
function moduleUrl(filename) {
  const absolute = path.resolve(filename);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(/(from\s*|import\s*)(['"])(\.\.?\/[^'"]+)\2/g, (_match, prefix, quote, relative) => {
    const dependency = path.resolve(path.dirname(absolute), relative);
    return `${prefix}${quote}${moduleUrl(path.extname(dependency) ? dependency : `${dependency}.ts`)}${quote}`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  moduleUrls.set(absolute, url);
  return url;
}
const state = await import(moduleUrl('src/state.ts'));
const scale = await import(moduleUrl('src/scaleModel.ts'));

let stored = new Map();
beforeEach(() => {
  stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
});
const restore = save => { localStorage.setItem(state.SAVE_KEY, JSON.stringify(save)); return state.readSave(); };
const seeds = Array.from({ length: 300 }, (_, i) => i);

test('each round hides exactly one part with a different weight among identical-looking parts', () => {
  assert.deepEqual(scale.fakeRounds.map(r => r.count), [4, 5]);
  for (const [round, r] of scale.fakeRounds.entries()) {
    for (const seed of seeds) {
      const layout = scale.fakeLayout(round, seed);
      assert.equal(layout.length, r.count);
      assert.equal(layout.filter(w => w === r.fake).length, 1, `round ${round} seed ${seed}`);
      assert.equal(layout.filter(w => w === r.real).length, r.count - 1);
      assert.equal(layout.indexOf(r.fake), scale.fakeSlot(round, seed));
    }
  }
  assert.ok(scale.fakeLabels.length >= Math.max(...scale.fakeRounds.map(r => r.count)), 'every slot has a label');
});

test('round 2 is a little harder: more parts, smaller gap, and the fake is heavier', () => {
  const [one, two] = scale.fakeRounds;
  assert.ok(two.count > one.count);
  assert.ok(Math.abs(two.fake - two.real) < Math.abs(one.fake - one.real));
  assert.ok(one.fake < one.real, 'round 1 fake is lighter');
  assert.ok(two.fake > two.real, 'round 2 fake is heavier');
});

test('numbers stay at grade 3 level: whole grams, small values, a visible gap', () => {
  for (const r of scale.fakeRounds) {
    for (const w of [r.real, r.fake]) assert.ok(Number.isInteger(w) && w > 0 && w <= 100, `${w}`);
    assert.ok(Math.abs(r.fake - r.real) >= 2, 'the scale shows a difference of at least 2 g');
  }
});

test('the seed decides positions: the same seed repeats, different seeds shuffle every slot', () => {
  for (const [round, r] of scale.fakeRounds.entries()) {
    assert.equal(scale.fakeSlot(round, 42), scale.fakeSlot(round, 42));
    const slots = new Set(seeds.map(seed => scale.fakeSlot(round, seed)));
    assert.equal(slots.size, r.count, `round ${round} reaches every slot`);
  }
  assert.ok(seeds.some(seed => scale.fakeSlot(0, seed) !== scale.fakeSlot(1, seed)), 'rounds are shuffled separately');
});

test('before zeroing every part shows 15 g more, but the difference between parts is still visible', () => {
  assert.equal(scale.emptyScaleReading, 15);
  for (const [round, r] of scale.fakeRounds.entries()) {
    const seed = 7, fake = scale.fakeSlot(round, seed), real = (fake + 1) % r.count;
    assert.equal(scale.fakeReading(round, seed, real, true), r.real);
    assert.equal(scale.fakeReading(round, seed, fake, true), r.fake);
    assert.equal(scale.fakeReading(round, seed, real, false), r.real + 15);
    assert.equal(scale.fakeReading(round, seed, fake, false), r.fake + 15);
    assert.notEqual(scale.fakeReading(round, seed, real, false), r.real, 'unzeroed reading does not match the real weight');
    assert.equal(scale.fakeReading(round, seed, real, false) - scale.fakeReading(round, seed, fake, false), r.real - r.fake);
  }
});

test('a pick is judged only from scale measurements', () => {
  const seed = 11, fake = scale.fakeSlot(0, seed), real = (fake + 1) % 4;
  assert.equal(scale.judgeFakePick(0, seed, fake, []), 'unmeasured', 'cannot accuse a part that was never weighed');
  assert.equal(scale.judgeFakePick(0, seed, fake, [real]), 'unmeasured');
  assert.equal(scale.judgeFakePick(0, seed, real, [real]), 'real');
  assert.equal(scale.judgeFakePick(0, seed, fake, [real, fake]), 'found');
});

test('judged picks count attempts and clear rounds; unmeasured picks change nothing', () => {
  let record = { cleared: [], attempts: 0 };
  assert.equal(scale.recordFakePick(record, 0, 'unmeasured'), record);
  record = scale.recordFakePick(record, 0, 'real');
  assert.deepEqual(record, { cleared: [], attempts: 1 });
  record = scale.recordFakePick(record, 0, 'found');
  assert.deepEqual(record, { cleared: [0], attempts: 2 });
  record = scale.recordFakePick(record, 0, 'found');
  assert.deepEqual(record.cleared, [0], 'no duplicate rounds');
  record = scale.recordFakePick(record, 1, 'found');
  assert.deepEqual(record, { cleared: [0, 1], attempts: 4 });
  assert.equal(scale.recordFakePick({ cleared: [], attempts: 999 }, 0, 'real').attempts, 999);
});

test('progress: the next round is the first one not cleared; both rounds finish the request', () => {
  assert.equal(scale.nextFakeRound(undefined), 0);
  assert.equal(scale.nextFakeRound({ cleared: [], attempts: 0 }), 0);
  assert.equal(scale.nextFakeRound({ cleared: [0], attempts: 1 }), 1);
  assert.equal(scale.nextFakeRound({ cleared: [1], attempts: 1 }), 0);
  assert.equal(scale.nextFakeRound({ cleared: [0, 1], attempts: 2 }), 2);
  assert.equal(scale.fakeRequestComplete(undefined), false);
  assert.equal(scale.fakeRequestComplete({ cleared: [0], attempts: 3 }), false);
  assert.equal(scale.fakeRequestComplete({ cleared: [0, 1], attempts: 2 }), true);
});

test('hints climb from where to look to what to compare, without blame', () => {
  const first = scale.fakeHint(1, true), second = scale.fakeHint(2, true);
  assert.match(first, /저울 화면의 숫자/);
  assert.match(second, /같은 숫자/);
  assert.notEqual(first, second);
  assert.equal(scale.fakeHint(5, true), second);
  assert.match(scale.fakeHint(1, false), /0으로 맞추면/);
  assert.doesNotMatch(scale.fakeHint(1, true), /0으로 맞추면/);
  for (const hint of [first, second, scale.fakeHint(1, false)]) assert.doesNotMatch(hint, /틀렸|실패|땡|벌점/);
});

test('the finish summary adds one line about the request', () => {
  const line = scale.fakeSummary({ cleared: [0, 1], attempts: 3 });
  assert.match(line, /가짜/);
  assert.match(line, /판정 3번/);
  assert.match(line, /4개, 5개/);
});

test('saved level records round-trip; old completed saves keep their completion without a record', () => {
  const save = state.freshSave();
  save.completed = ['cargo', 'balance', 'scale'];
  save.evidence = { cargo: 'a', balance: 'b', scale: '예전 저울 기록' };
  const old = restore(save);
  assert.ok(old.completed.includes('scale'));
  assert.equal(old.evidence.scale, '예전 저울 기록');
  assert.equal(old.levels.scale, undefined);
  assert.equal(scale.fakeRequestComplete(old.levels.scale), false, 'the request is still open to play');

  save.levels = { scale: { cleared: [1, 0, 0], attempts: 4 } };
  const withRecord = restore(save);
  assert.deepEqual(withRecord.levels.scale, { cleared: [0, 1], attempts: 4 });
  assert.equal(scale.fakeRequestComplete(withRecord.levels.scale), true);
});

test('level 1 rules are unchanged: zeroed single apple and book measurements complete the comparison', () => {
  const runs = [
    { parts: ['orange'], reading: 95, zeroed: false },
    { parts: ['orange'], reading: 80, zeroed: true },
    { parts: ['blue'], reading: 70, zeroed: true },
  ];
  assert.equal(scale.canCompleteScale({ zeroed: true, runs }), true);
  assert.equal(scale.canCompleteScale({ zeroed: true, runs: runs.slice(0, 2) }), false);
});
