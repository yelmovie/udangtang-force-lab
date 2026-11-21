import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

// F15 (2026-11-21): a completion is trusted only when the stage left proof — the summary written by
// completeStage (every save since the first release has one) or the stage's finished records.
// A genuine save never loses a mission; a completion typed in by hand alone opens nothing.
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
const stages = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
let stored = new Map();
beforeEach(() => { stored = new Map(); globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: k => stored.delete(k) }; });
const restore = value => { stored.set(state.SAVE_KEY, typeof value === 'string' ? value : JSON.stringify(value)); return state.readSave(); };
const prod = JSON.parse(fs.readFileSync('scripts/fixtures/save-prod-20261121.json', 'utf8'));

test('a production save from a full play (2026-11-21) restores every mission, evidence and page unchanged', () => {
  const restored = restore(prod);
  assert.deepEqual(restored.completed, stages);
  assert.deepEqual(restored.evidence, prod.evidence);
  assert.equal(restored.currentPage, prod.currentPage);
  assert.equal(state.nextIncomplete(restored), 'complete');
});

test('an older save that has summaries but none of the later records keeps its missions', () => {
  const legacy = state.freshSave();
  legacy.completed = stages.slice(0, 4);
  legacy.evidence = Object.fromEntries(legacy.completed.map(id => [id, `${id} evidence`]));
  delete legacy.levels; delete legacy.cargo.orders;
  const restored = restore(legacy);
  assert.deepEqual(restored.completed, stages.slice(0, 4));
  assert.equal(state.stageIsOpen(restored, 'rescue'), true);
});

test('recomputing never opens fewer missions than a genuine save made by completeStage', () => {
  for (let n = 1; n <= 4; n++) {
    const save = state.freshSave();
    for (const id of stages.slice(0, n)) state.completeStage(save, id, `${id} summary`);
    const restored = state.readSave();
    assert.deepEqual(restored.completed, stages.slice(0, n), `after ${n} missions`);
  }
});

test('a completion typed in by hand without its summary or records opens nothing', () => {
  const save = state.freshSave();
  save.completed = ['cargo', 'balance', 'scale'];
  const restored = restore(save);
  assert.deepEqual(restored.completed, []);
  assert.equal(state.stageIsOpen(restored, 'balance'), false);
  assert.equal(state.stageIsOpen(restored, 'workshop'), false);
});

test('only the unproven tail is closed: earlier proven missions stay open', () => {
  const save = state.freshSave();
  save.completed = ['cargo', 'balance', 'scale'];
  save.evidence = { cargo: 'cargo summary' };
  const restored = restore(save);
  assert.deepEqual(restored.completed, ['cargo']);
  assert.deepEqual(Object.keys(restored.evidence), ['cargo']);
  assert.equal(state.stageIsOpen(restored, 'balance'), true);
  assert.equal(state.stageIsOpen(restored, 'scale'), false);
});

test('finished records prove a completion whose summary is missing', () => {
  const save = structuredClone(prod);
  save.completed = ['cargo', 'balance', 'scale', 'workshop'];
  save.evidence = {};
  save.currentPage = 'map';
  const restored = restore(save);
  assert.deepEqual(restored.completed, ['cargo', 'balance', 'scale', 'workshop']);
});

test('a summary that is not text, or empty, does not count as proof', () => {
  const save = state.freshSave();
  save.completed = ['cargo', 'balance'];
  save.evidence = { cargo: 12, balance: '' };
  assert.deepEqual(restore(save).completed, []);
});

test('the core still needs its own fair comparison even with a summary', () => {
  const save = structuredClone(prod);
  save.rescue.runs = [];
  const restored = restore(save);
  assert.deepEqual(restored.completed, stages.slice(0, 4));
  assert.equal(restored.currentPage, 'map');
});

test('a damaged save still opens without throwing and starts from the map or the title', () => {
  for (const raw of ['{"version":1,"completed":["cargo"', '{"version":1,"completed":"cargo","evidence":5}', '{"version":1,"completed":[null,{},"cargo"],"evidence":{"cargo":"x"}}']) {
    const restored = restore(raw);
    if (restored) assert.ok(Array.isArray(restored.completed));
  }
});
