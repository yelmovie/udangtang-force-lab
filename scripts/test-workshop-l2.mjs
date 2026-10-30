import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
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
const model = await import(moduleUrl('src/workshopModel.ts'));
const state = await import(moduleUrl('src/state.ts'));

const designs = [['direct', 0], ['lever', 0], ['lever', 1], ['lever', 2], ['ramp', 0], ['ramp', 1]];
const passing = cargo => designs.filter(([tool, setting]) => model.judgeWorkshopL2(cargo, tool, setting).success).map(([tool, setting]) => `${tool}:${setting}`);

test('direct lifting never fits the budget', () => {
  for (const [cargo] of model.workshopCargos.entries()) assert.equal(model.judgeWorkshopL2(cargo, 'direct', 0).success, false);
});

test('every cargo has a passing design, and heavier cargo leaves fewer', () => {
  assert.deepEqual(passing(0), ['lever:0', 'ramp:0', 'ramp:1']);
  assert.deepEqual(passing(1), ['lever:0', 'ramp:0', 'ramp:1']);
  assert.deepEqual(passing(2), ['ramp:1']);
});

test('only the long ramp carries every cargo: a lever student must change tools once', () => {
  const always = designs.filter(([tool, setting]) => [0, 1, 2].every(cargo => model.judgeWorkshopL2(cargo, tool, setting).success));
  assert.deepEqual(always, [['ramp', 1]], 'the request opens on the lever, so the usual path meets one forced redesign');
  assert.equal(model.judgeWorkshopL2(2, 'ramp', 1).success, true);
  assert.equal(model.judgeWorkshopL2(2, 'lever', 0).success, false);
  assert.equal(model.judgeWorkshopL2(2, 'lever', 0).overCells, 1, 'the lever misses by one cell, not by a mile');
  assert.equal(model.judgeWorkshopL2(2, 'ramp', 0).success, false);
  assert.equal(model.judgeWorkshopL2(2, 'lever', 1).success, false);
  assert.equal(model.judgeWorkshopL2(2, 'lever', 2).success, false);
});

test('force reuses getWorkshopDesign times the cargo weight', () => {
  for (const [cargo, { weight }] of model.workshopCargos.entries()) {
    assert.equal(model.workshopL2Force(cargo, 'lever', 0), model.getWorkshopDesign('lever', 0).force * weight);
    assert.equal(model.workshopL2Force(cargo, 'ramp', 1), model.getWorkshopDesign('ramp', 1).force * weight);
    assert.equal(model.workshopL2Force(cargo, 'direct', 0), 100 * weight);
  }
  assert.ok(model.workshopL2Force(2, 'ramp', 0) > model.workshopL2Force(1, 'ramp', 0));
});

test('a miss reports how many cells overflowed and barely moves the cargo', () => {
  const miss = model.judgeWorkshopL2(2, 'ramp', 0);
  assert.equal(miss.budgetCells, 6);
  assert.equal(miss.needCells, 11);
  assert.equal(miss.overCells, 5);
  assert.ok(miss.stallAt > 0 && miss.stallAt < 1);
  assert.equal(model.judgeWorkshopL2(2, 'lever', 2).stallAt, miss.stallAt, 'force is not a fuel: any shortfall only twitches the cargo');
  const hit = model.judgeWorkshopL2(2, 'ramp', 1);
  assert.equal(hit.overCells, 0);
  assert.ok(hit.needCells <= hit.budgetCells);
  assert.equal(hit.stallAt, 1);
});

test('cargo is cleared in order and the record counts attempts', () => {
  let record;
  assert.equal(model.workshopL2Current(record), 0);
  record = model.applyWorkshopL2Attempt(record, 0, false);
  assert.deepEqual(record, { cleared: [], attempts: 1 });
  record = model.applyWorkshopL2Attempt(record, 0, true);
  assert.deepEqual(record, { cleared: [0], attempts: 2 });
  assert.equal(model.workshopL2Current(record), 1);
  record = model.applyWorkshopL2Attempt(record, 1, true);
  assert.equal(model.workshopL2Complete(record), false);
  record = model.applyWorkshopL2Attempt(record, 2, true);
  assert.deepEqual(record, { cleared: [0, 1, 2], attempts: 4 });
  assert.equal(model.workshopL2Complete(record), true);
  assert.equal(model.workshopL2Current(record), 3);
});

test('the clue gets one step more specific every two misses', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(model.workshopL2HintLevel), [0, 0, 1, 1, 2, 2, 3, 3]);
  const hints = [0, 1, 2, 3].map(level => model.workshopL2Hint(level, 'ramp'));
  assert.equal(new Set(hints).size, 4);
  assert.match(model.workshopL2Hint(2, 'lever'), /받침대/);
  assert.match(model.workshopL2Hint(3, 'lever'), /앞 화물을 올렸던 설계/);
  assert.doesNotMatch(model.workshopL2Hint(3, 'lever'), /화물 가까이|길고 완만/, 'the last clue still never names the answer setting');
  assert.match(model.workshopL2Hint(0, 'direct'), /지레나 빗면/);
  assert.match(model.workshopL2Hint(1, 'lever', 0), /빗면으로 바꿔/, 'when the best fulcrum still misses, the clue points at the other tool');
  assert.doesNotMatch(model.workshopL2Hint(1, 'lever', 0), /길고 완만/);
  assert.match(model.workshopL2Hint(1, 'lever', 1), /빨간 칸/, 'other fulcrum positions keep the ordinary clue');
});

test('saved workshop level records survive a reload as plain cleared/attempts', () => {
  const kept = state.retainLevels({ workshop: { cleared: [2, 0, 0, 'x'], attempts: 7 } });
  assert.deepEqual(kept.workshop, { cleared: [0, 2], attempts: 7 });
  assert.equal(model.workshopL2Current(kept.workshop), 1);
});

test('the request recap describes only the designs the student actually tried', () => {
  const play = steps => steps.reduce((record, [cargo, tool, setting]) => model.applyWorkshopL2Attempt(record, cargo, model.judgeWorkshopL2(cargo, tool, setting).success, { tool, setting }), undefined);
  // Kept the long ramp from level 1 and pressed run three times: no change, no comparison.
  const kept = play([[0, 'ramp', 1], [1, 'ramp', 1], [2, 'ramp', 1]]);
  assert.equal(model.workshopL2Recap(kept), "화물 3개를 모두 '빗면 · 길고 완만하게' 설계로 올렸어요.");
  assert.doesNotMatch(model.workshopL2Recap(kept), /더 길게|바꿔|무거운 화물일수록/);
  // Lever for the first two, a stall on the heavy cargo, then the long ramp: name exactly that.
  const changed = play([[0, 'lever', 0], [1, 'lever', 0], [2, 'lever', 0], [2, 'lever', 0], [2, 'ramp', 1]]);
  assert.equal(model.workshopL2Recap(changed), "가벼운 화물은 '지레 · 화물 가까이'로 올렸어요. 보통 화물은 '지레 · 화물 가까이'로 올렸어요. 무거운 화물은 '지레 · 화물 가까이'로는 멈췄고 '빗면 · 길고 완만하게'로 올렸어요.");
  assert.deepEqual(changed.tries.filter(t => t.cargo === 2).length, 2, 'a retried design is kept once');
  // Saves from before tries were recorded give no recap, so the screen falls back to a neutral line.
  assert.equal(model.workshopL2Recap({ cleared: [0, 1, 2], attempts: 3 }), '');
  const reloaded = state.retainLevels({ workshop: { ...changed, tries: [...changed.tries, { cargo: 9, tool: 'ramp', setting: 1, success: true }, { cargo: 0, tool: 'lever', setting: 5, success: true }] } });
  assert.deepEqual(reloaded.workshop.tries, changed.tries, 'invalid saved tries are dropped on reload');
});

test('level 1 finish rule is unchanged: level 2 never gates canFinishWorkshopExploration', () => {
  const save = state.freshSave();
  Object.assign(save.workshop, { direct: true, trials: model.retainWorkshopRuns([{ tool: 'lever', setting: 0 }, { tool: 'lever', setting: 1 }, { tool: 'ramp', setting: 0 }, { tool: 'ramp', setting: 1 }]) });
  assert.equal(model.canFinishWorkshopExploration(save.workshop), true);
  assert.equal(model.workshopL2Complete(save.levels?.workshop), false);
});
