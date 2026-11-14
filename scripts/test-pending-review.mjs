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
const learning = await import(moduleUrl('src/learningModel.ts'));

let stored = new Map();
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: k => stored.delete(k) };
beforeEach(() => { stored = new Map(); });

test('the merged result keeps the answered legacy question and its first choice', () => {
  const save = state.freshSave();
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 66 }, { parts: 5, action: 'push', gesture: 1, distance: 22 }];
  const oldTask = learning.learningTask(save, 'cargo');
  const answer = { first: 'weight', chosen: 'force-time', tries: 2 };
  save.learning = { cargo: { signature: oldTask.signature, answers: [answer], completed: false } };
  state.markExperimentDone(save, 'cargo', '요약');
  const restored = state.readSave();
  const task = learning.missionReviewTask(restored, 'cargo');
  const record = learning.missionReviewRecord(restored, task);
  assert.equal(task.questions.length, 1);
  assert.deepEqual(record.answers, [answer]);
  assert.equal(learning.learningRecordComplete(task, record), true);
  assert.equal(restored.pendingStage.id, 'cargo');
});

test('request proof replaces the scale review only after both measured rounds', () => {
  const save = state.freshSave();
  save.scale = { zeroed: true, parts: [], runs: [{ parts: ['orange'], reading: 80, zeroed: true }, { parts: ['blue'], reading: 70, zeroed: true }] };
  save.levels = { scale: { cleared: [0], attempts: 1 } };
  assert.equal(learning.missionReviewTask(save, 'scale').questions.length, 1);
  save.levels.scale.cleared.push(1);
  assert.equal(learning.missionReviewTask(save, 'scale'), null);
});

test('the restored workshop requires both original questions even with all tools sorted', () => {
  const save = state.freshSave();
  save.workshop.trials = [{ tool: 'ramp', setting: 0, force: 56, distance: 2.5 }, { tool: 'ramp', setting: 1, force: 32, distance: 4.4 }];
  save.levels = { workshop: { cleared: [0, 1, 2], attempts: 3 } };
  save.lifeObservation = { sorted: ['slide', 'bottle-opener', 'seesaw', 'wheelchair-ramp', 'mountain-road', 'claw-hammer', 'truck-ramp', 'scissors'] };
  const task = learning.missionReviewTask(save, 'workshop');
  assert.deepEqual(task.questions.map(q => q.id), ['design', 'daily-tool']);
  assert.equal(task.signature, learning.learningTask(save, 'workshop').signature, 'old answers keep their original signature');
  assert.equal(learning.learningRecordComplete(task, {signature: task.signature, answers: [{chosen:'best'}]}), false);
});

test('finished experiment with open questions is not a completion, and survives a reload', () => {
  const save = state.freshSave();
  assert.equal(state.markExperimentDone(save, 'cargo', '요약'), true);
  const restored = state.readSave();
  assert.deepEqual(restored.completed, []);
  assert.deepEqual(restored.pendingStage, { id: 'cargo', summary: '요약' });
  assert.equal(restored.currentPage, 'cargo', 'reload resumes on the stage, where the questions reopen');
  assert.equal(state.stageIsOpen(restored, 'balance'), false, 'next mission stays locked');
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
