import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Same loader as test-model.mjs: import the real TypeScript module without build output.
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
const model = await import(moduleUrl('src/rescueModel.ts'));

const shortStop = force => ({ route: 'short', force, success: false });
const longArrive = force => ({ route: 'long', force, success: true });
const shortArrive = { route: 'short', force: 3, success: true };

test('no fair comparison until the same force gives different results on the two routes', () => {
  assert.equal(model.firstFairComparison([]), null);
  assert.equal(model.firstFairComparison([shortStop(1)]), null);
  assert.equal(model.firstFairComparison([shortStop(1), longArrive(2)]), null, 'different forces are not a fair comparison');
  assert.equal(model.firstFairComparison([shortArrive, longArrive(3)]), null, 'both arriving shows no difference');
  assert.equal(model.firstFairComparison([{ route: 'short', force: 1, success: true }, longArrive(1)]), null, 'impossible results are ignored');
});

test('the first fair comparison stays fixed after trying other forces', () => {
  const runs = [shortStop(1), longArrive(1)];
  const found = model.firstFairComparison(runs);
  assert.equal(found.force, 1);
  assert.deepEqual(found.stopped, shortStop(1));
  assert.deepEqual(found.arrived, longArrive(1));
  const later = [...runs, shortArrive, longArrive(3), shortStop(2), longArrive(2)];
  assert.equal(model.firstFairComparison(later).force, 1, 'a later comparison at another force does not replace the first');
  assert.equal(model.hasFairComparison(later), true);
  // Arrived first, stopped second: still reported as stopped/arrived.
  const reversed = model.firstFairComparison([longArrive(2), shortStop(2)]);
  assert.equal(reversed.force, 2);
  assert.equal(reversed.stopped.route, 'short');
  assert.equal(reversed.arrived.route, 'long');
});

test('the fixed comparison survives save trimming', () => {
  const runs = [shortArrive, shortStop(1), longArrive(1)];
  for (let i = 0; i < 30; i++) runs.push(i % 2 ? shortArrive : longArrive(3));
  const kept = model.retainRescueRuns(runs);
  assert.ok(kept.length <= 20);
  assert.equal(model.firstFairComparison(kept).force, 1);
});

test('next-step hint keeps the force fixed without naming the route that arrives', () => {
  assert.match(model.comparisonHint([], 1), /작은 힘으로 두 길을 모두 시험해야 공정하게/);
  for (const hint of [model.comparisonHint([shortStop(1)], 1), model.comparisonHint([longArrive(2)], 2)]) {
    assert.equal(hint, '힘은 그대로 두고 길만 바꾸면 어떻게 될까요?');
    assert.doesNotMatch(hint, /[AB] |짧은|긴|작은|중간|큰/, 'no route or force named before the discovery');
  }
  const same = model.comparisonHint([shortArrive, longArrive(3)], 3);
  assert.match(same, /두 길 모두 도착해서 차이가 보이지 않아요. 다른 힘으로/);
  assert.doesNotMatch(same, /줄여|키워/, 'does not say which way to change the force');
  assert.match(model.comparisonHint([shortStop(1)], 3), /큰 힘으로 두 길을 모두 시험해야/, 'runs at another force do not count');
  const found = model.comparisonHint([shortStop(1), longArrive(1), shortArrive], 3);
  assert.match(found, /작은 힘에서 A 짧은 빗면은 멈추고 B 긴 빗면은 도착/, 'after the discovery the hint names the comparison force, not the selected one');
});

test('a second force with the same difference is counted and nudged once', () => {
  assert.deepEqual(model.fairComparisonForces([shortStop(1), longArrive(2)]), []);
  assert.deepEqual(model.fairComparisonForces([shortStop(1), longArrive(1), shortArrive, longArrive(3)]), [1], 'big force shows no difference');
  assert.deepEqual(model.fairComparisonForces([shortStop(1), longArrive(1), longArrive(2), shortStop(2)]), [1, 2]);
  assert.equal(model.secondComparisonHint([shortStop(1)]), '');
  assert.match(model.secondComparisonHint([shortStop(1), longArrive(1)]), /다른 힘에서도 같은 차이가 날까요/);
  assert.equal(model.secondComparisonHint([shortStop(1), longArrive(1), shortStop(2), longArrive(2)]), '');
});

test('every force on both routes is the core challenge', () => {
  const four = [shortStop(1), longArrive(1), shortStop(2), longArrive(2)];
  assert.equal(model.triedEveryForce(four), false);
  assert.equal(model.triedEveryForce([...four, shortArrive]), false);
  assert.equal(model.triedEveryForce([...four, shortArrive, longArrive(3)]), true);
  assert.equal(model.triedEveryForce([...four, { route: 'short', force: 3, success: false }, longArrive(3)]), false, 'impossible results are ignored');
});

test('trimming keeps the second-force comparison too', () => {
  const runs = [shortStop(1), longArrive(1), shortStop(2), longArrive(2)];
  for (let i = 0; i < 30; i++) runs.push(longArrive(1));
  const kept = model.retainRescueRuns(runs);
  assert.equal(kept.length, 20);
  assert.deepEqual(model.fairComparisonForces(kept), [1, 2]);
  assert.deepEqual(kept.slice(0, 4), runs.slice(0, 4));
});

test('the finish summary names the force and which route stopped or arrived', () => {
  assert.equal(model.comparisonSummary([shortStop(1)]), '');
  const summary = model.comparisonSummary([shortArrive, longArrive(3), shortStop(2), longArrive(2), shortStop(1)]);
  assert.match(summary, /^중간 힘으로 똑같이 밀었을 때/);
  assert.match(summary, /짧고 가파른 빗면에서는 코어가 올라가지 못하고/);
  assert.match(summary, /길고 완만한 빗면에서는 끝까지 도착했어요\.$/);
});

test('first comparison starts on the short ramp with small force',()=>{
  assert.equal(model.needsShortRampTrial([]),true);
  assert.equal(model.needsShortRampTrial([longArrive(1)]),true);
  assert.equal(model.needsShortRampTrial([shortStop(1)]),false);
  assert.equal(model.needsShortRampTrial([shortStop(2),longArrive(2)]),false);
});
