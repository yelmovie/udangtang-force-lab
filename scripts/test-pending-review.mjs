import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

// Same in-memory TypeScript import as the other model tests.
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
const stars = await import(moduleUrl('src/stars.ts'));

let stored = new Map();
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: k => stored.delete(k) };
beforeEach(() => { stored = new Map(); });

test('finished experiment with open questions is not a completion, and survives a reload', () => {
  const save = state.freshSave();
  assert.equal(state.markExperimentDone(save, 'cargo', '요약'), true);
  const restored = state.readSave();
  assert.deepEqual(restored.completed, []);
  assert.deepEqual(restored.pendingStage, { id: 'cargo', summary: '요약' });
  assert.equal(restored.currentPage, 'cargo', 'reload resumes on the stage, where the questions reopen');
  assert.equal(state.stageIsOpen(restored, 'balance'), false, 'next mission stays locked');
  assert.equal(stars.stageStars(restored, 'cargo').slots[0].done, false, 'no mission star yet');
});

test('solving completes once, clears the pending mark, and a repeat completion adds nothing', () => {
  const save = state.freshSave();
  state.markExperimentDone(save, 'cargo', '요약');
  state.completeStage(save, 'cargo', '요약');
  state.completeStage(save, 'cargo', '요약');
  const restored = state.readSave();
  assert.deepEqual(restored.completed, ['cargo']);
  assert.equal('pendingStage' in restored, false);
  assert.equal(state.stageIsOpen(restored, 'balance'), true);
});

test('existing completed saves keep their completion; a stale pending mark on a completed stage is dropped', () => {
  const old = { ...state.freshSave(), completed: ['cargo'], evidence: { cargo: '예전 기록' }, pendingStage: { id: 'cargo', summary: 'x' } };
  stored.set(state.SAVE_KEY, JSON.stringify(old));
  const restored = state.readSave();
  assert.deepEqual(restored.completed, ['cargo']);
  assert.equal(restored.evidence.cargo, '예전 기록');
  assert.equal('pendingStage' in restored, false);
});

test('a forged pending mark is ignored', () => {
  stored.set(state.SAVE_KEY, JSON.stringify({ ...state.freshSave(), pendingStage: { id: 'nope', summary: 1 } }));
  assert.equal('pendingStage' in state.readSave(), false);
});
