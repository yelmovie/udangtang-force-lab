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
const model = await import(moduleUrl('src/balanceModel.ts'));

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
const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);
const heaviest = round => round.boxes.reduce((a, b) => (round.weights[a] >= round.weights[b] ? a : b));
const compare = (round, left, right) => ({ left, right, actual: model.weigh(round, left, right) });

test('two rounds: 3 boxes then 4 boxes, each with exactly one heaviest box', () => {
  assert.equal(model.mysteryRoundCount, 2);
  for (const seed of seeds) {
    const sizes = [0, 1].map(index => {
      const round = model.mysteryRound(index, seed);
      const weights = round.boxes.map(id => round.weights[id]);
      const max = Math.max(...weights);
      assert.equal(weights.filter(w => w === max).length, 1, `round ${index} seed ${seed}`);
      return round.boxes.length;
    });
    assert.deepEqual(sizes, [3, 4]);
  }
  const second = model.mysteryRound(1, 1);
  const weights = second.boxes.map(id => second.weights[id]);
  assert.ok(weights.some((w, i) => weights.indexOf(w) !== i), 'round 2 hides an equal-weight pair');
});

test('the seed decides the arrangement: same seed repeats, different seeds move the heavy box', () => {
  assert.deepEqual(model.mysteryRound(0, 42), model.mysteryRound(0, 42));
  assert.deepEqual(model.mysteryRound(1, 42), model.mysteryRound(1, 42));
  for (const index of [0, 1]) {
    const spots = new Set(seeds.map(seed => heaviest(model.mysteryRound(index, seed))));
    assert.equal(spots.size, model.mysteryRound(index, 0).boxes.length, `round ${index}: heavy box reaches every position`);
  }
});

test('boxes carry no clue but their letter: only hidden weights differ', () => {
  for (const seed of seeds.slice(0, 20)) {
    const round = model.mysteryRound(0, seed);
    assert.deepEqual(Object.keys(round), ['boxes', 'weights']);
    assert.deepEqual(round.boxes, ['가', '나', '다']);
  }
  assert.deepEqual(model.mysteryRound(1, 5).boxes, ['가', '나', '다', '라']);
});

test('the balance shows the heavier side going down, level when equal', () => {
  const round = { boxes: ['가', '나', '다'], weights: { 가: 4, 나: 6, 다: 4 } };
  assert.equal(model.weigh(round, '나', '가'), 'left');
  assert.equal(model.weigh(round, '가', '나'), 'right');
  assert.equal(model.weigh(round, '가', '다'), 'level');
});

test('record cards read heavier first, or with = when level', () => {
  assert.equal(model.relationText({ left: '가', right: '나', actual: 'left' }), '가 > 나');
  assert.equal(model.relationText({ left: '가', right: '나', actual: 'right' }), '나 > 가');
  assert.equal(model.relationText({ left: '나', right: '다', actual: 'level' }), '나 = 다');
});

test('round 1 can always be solved within the thrifty budget of 2 balance uses', () => {
  assert.equal(model.thriftyBudget, 2);
  for (const seed of seeds) {
    const round = model.mysteryRound(0, seed);
    const records = [compare(round, '가', '나')];
    if (model.candidates(round.boxes, records).length > 1) {
      const [winner] = model.candidates(round.boxes, records).filter(id => id !== '다');
      records.push(compare(round, winner, '다'));
    }
    assert.ok(records.length <= 2);
    assert.deepEqual(model.judgePick(round.boxes, records, heaviest(round)), { result: 'found' }, `seed ${seed}`);
    assert.ok(model.isThrifty(0, records.length));
  }
  assert.equal(model.isThrifty(0, 3), false, 'a third use still finishes, just without the badge');
  assert.equal(model.isThrifty(1, 1), false, 'the badge belongs to round 1 only');
});

test('a level result rules out both boxes, so round 1 can be solved in one use', () => {
  const round = { boxes: ['가', '나', '다'], weights: { 가: 4, 나: 4, 다: 6 } };
  const records = [compare(round, '가', '나')];
  assert.deepEqual(model.candidates(round.boxes, records), ['다']);
  assert.deepEqual(model.judgePick(round.boxes, records, '다'), { result: 'found' });
});

test('round 2 is solvable for every arrangement by carrying the winner forward', () => {
  for (const seed of seeds) {
    const round = model.mysteryRound(1, seed);
    const records = [];
    let best = round.boxes[0];
    for (const next of round.boxes.slice(1)) {
      const record = compare(round, best, next);
      records.push(record);
      if (record.actual !== 'left') best = next;
    }
    // A level at the end can leave the true box uncompared; one more look settles it.
    const left = model.candidates(round.boxes, records);
    if (left.length > 1) records.push(compare(round, left[0], left[1]));
    assert.deepEqual(model.candidates(round.boxes, records), [heaviest(round)], `seed ${seed}`);
    assert.ok(records.length <= 4);
  }
});

test('a pick needs proof: guesses without evidence get "not yet", never a reveal', () => {
  const round = { boxes: ['가', '나', '다', '라'], weights: { 가: 4, 나: 6, 다: 5, 라: 4 } };
  const records = [compare(round, '가', '나')];
  const lucky = model.judgePick(round.boxes, records, '나');
  assert.equal(lucky.result, 'unknown', 'the right box is not accepted until the records prove it');
  assert.deepEqual(lucky.others, ['다', '라']);
  assert.match(model.pickHint(lucky, '나', records), /다·라 상자보다 무거운지 아직 몰라요/);
  assert.deepEqual(model.judgePick(round.boxes, [], '가'), { result: 'unknown', others: ['나', '다', '라'] });
  assert.match(model.pickHint({ result: 'unknown', others: ['나'] }, '가', []), /아직 비교 기록이 없어요/);
});

test('a wrong pick points at the record card that already answers it', () => {
  const round = { boxes: ['가', '나', '다', '라'], weights: { 가: 4, 나: 6, 다: 5, 라: 4 } };
  const records = [compare(round, '다', '라'), compare(round, '가', '라'), compare(round, '나', '다')];
  assert.deepEqual(model.judgePick(round.boxes, records, '라'), { result: 'ruled-out', clue: 0 });
  assert.deepEqual(model.judgePick(round.boxes, records, '가'), { result: 'ruled-out', clue: 1 });
  assert.deepEqual(model.judgePick(round.boxes, records, '다'), { result: 'ruled-out', clue: 2 });
  assert.deepEqual(model.judgePick(round.boxes, records, '나'), { result: 'found' });
  const lighter = model.pickHint({ result: 'ruled-out', clue: 2 }, '다', records);
  assert.match(lighter, /「나 > 다」/);
  assert.match(lighter, /다 상자보다 무거운 상자가 있어요/);
  const equal = model.pickHint({ result: 'ruled-out', clue: 1 }, '가', records);
  assert.match(equal, /「가 = 라」/);
  for (const hint of [lighter, equal]) assert.doesNotMatch(hint, /틀렸|실패|땡|벌점/);
});

test('progress: the next round is the first one not cleared, done after both', () => {
  assert.equal(model.nextMysteryRound(undefined), 0);
  assert.equal(model.nextMysteryRound({ cleared: [] }), 0);
  assert.equal(model.nextMysteryRound({ cleared: [0] }), 1);
  assert.equal(model.nextMysteryRound({ cleared: [1] }), 0);
  assert.equal(model.mysteryComplete({ cleared: [0] }), false);
  assert.equal(model.mysteryComplete({ cleared: [0, 1] }), true);
  assert.equal(model.mysteryComplete(undefined), false);
});

test('levels.balance survives a save round trip; old completed saves stay completed', () => {
  const save = state.freshSave();
  save.levels = { balance: { cleared: [0], attempts: 5 } };
  assert.deepEqual(restore(save).levels.balance, { cleared: [0], attempts: 5 });

  const old = state.freshSave();
  old.completed = ['cargo', 'balance'];
  old.evidence = { cargo: '예전 배송 기록', balance: '예전 균형 기록' };
  old.balance.runs = [{ left: 'A', right: 'B', prediction: 'left', actual: 'right' }, { left: 'A', right: 'C', prediction: 'level', actual: 'level' }];
  const restored = restore(old);
  assert.deepEqual(restored.completed, ['cargo', 'balance']);
  assert.equal(restored.evidence.balance, '예전 균형 기록');
  assert.equal(restored.levels.balance, undefined, 'the request opens again only when the student accepts it');
});

test('the question waits until every box was compared and one heaviest is supported', () => {
  const three=['가','나','다'];
  const equal=[{left:'가',right:'나',actual:'level'}];
  assert.deepEqual(model.candidates(three,equal),['다']);
  assert.equal(model.mysteryComparisonReady(three,equal),false,'even an inferable untouched box must be tried before the question');
  assert.equal(model.mysteryComparisonReady(three,[...equal,{left:'나',right:'다',actual:'right'}]),true);
  const four=['가','나','다','라'];
  const pairs=[{left:'가',right:'나',actual:'left'},{left:'다',right:'라',actual:'left'}];
  assert.equal(model.mysteryComparisonReady(four,pairs),false,'all touched is insufficient when two candidates remain');
  assert.equal(model.mysteryComparisonReady(four,[...pairs,{left:'가',right:'다',actual:'right'}]),true);
  assert.equal(model.mysteryComparisonReady([],[]),false);
});

test('both mystery sizes reach a supported question by comparing the winner with every box', () => {
  for(const index of [0,1]) for(const seed of seeds){
    const round=model.mysteryRound(index,seed),records=[];let best=round.boxes[0];
    for(const id of round.boxes.slice(1)){const record=compare(round,best,id);records.push(record);if(record.actual==='right')best=id;}
    assert.equal(model.mysteryComparisonReady(round.boxes,records),true,'round '+index+' seed '+seed);
    assert.deepEqual(model.candidates(round.boxes,records),[heaviest(round)]);
  }
});
