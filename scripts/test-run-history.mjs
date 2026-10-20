import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/runHistory.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { keepEvidence, cargoRunKey, balanceRunKey } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('40 free runs keep the first 1-part and 5-part pushes (the required comparison)', () => {
  const runs = [{ parts: 1, action: 'push', id: 'first-1' }, { parts: 5, action: 'push', id: 'first-5' }];
  for (let i = 0; i < 40; i++) runs.push({ parts: 3, action: 'push', id: `free-${i}` });
  const kept = keepEvidence(runs, cargoRunKey);
  assert.equal(kept.length, 20);
  assert.ok(kept.some(r => r.id === 'first-1') && kept.some(r => r.id === 'first-5'));
  assert.equal(kept.at(-1).id, 'free-39', 'latest run stays');
  assert.deepEqual(kept, [...kept].sort((a, b) => runs.indexOf(a) - runs.indexOf(b)), 'chronological order');
});

test('balance keeps its first tilted and first level pairs', () => {
  const runs = [{ left: 'B', right: 'C', id: 'tilt' }, { left: 'A', right: 'C', id: 'level' }];
  for (let i = 0; i < 30; i++) runs.push({ left: 'A', right: 'B', id: `free-${i}` });
  const ids = keepEvidence(runs, balanceRunKey).map(r => r.id);
  assert.ok(ids.includes('tilt') && ids.includes('level'));
});

test('short histories are untouched', () => {
  const runs = [{ parts: 1, action: 'push' }];
  assert.equal(keepEvidence(runs, cargoRunKey), runs);
});
