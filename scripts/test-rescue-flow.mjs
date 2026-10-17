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

test('next-step hint follows what has been tried at the selected force', () => {
  assert.match(model.comparisonHint([], 1), /작은 힘으로 A 짧은 빗면과 B 긴 빗면을 하나씩/);
  assert.match(model.comparisonHint([shortStop(1)], 1), /같은 작은 힘으로 B 긴 빗면도/);
  assert.match(model.comparisonHint([longArrive(2)], 2), /같은 중간 힘으로 A 짧은 빗면도/);
  assert.match(model.comparisonHint([shortArrive, longArrive(3)], 3), /두 길 모두 도착했어요\. 힘을 줄여서/);
  assert.match(model.comparisonHint([shortStop(1)], 3), /큰 힘으로 A 짧은 빗면과 B 긴 빗면을/, 'runs at another force do not count');
  const found = model.comparisonHint([shortStop(1), longArrive(1), shortArrive], 3);
  assert.match(found, /작은 힘에서 A 짧은 빗면은 멈추고 B 긴 빗면은 도착/, 'after the discovery the hint names the comparison force, not the selected one');
});

test('the finish summary names the force and which route stopped or arrived', () => {
  assert.equal(model.comparisonSummary([shortStop(1)]), '');
  const summary = model.comparisonSummary([shortArrive, longArrive(3), shortStop(2), longArrive(2), shortStop(1)]);
  assert.match(summary, /^중간 힘으로 똑같이 밀었을 때/);
  assert.match(summary, /짧고 가파른 빗면에서는 코어가 중간에 멈추고/);
  assert.match(summary, /길고 완만한 빗면에서는 끝까지 도착했어요\.$/);
});
