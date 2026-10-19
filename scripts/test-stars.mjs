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
const stars = await import(moduleUrl('src/stars.ts'));
const cargo = await import(moduleUrl('src/cargoModel.ts'));
const balance = await import(moduleUrl('src/balanceModel.ts'));
const scale = await import(moduleUrl('src/scaleModel.ts'));
const workshop = await import(moduleUrl('src/workshopModel.ts'));

let stored = new Map();
beforeEach(() => {
  stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
});
const stageIds = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
const range = n => Array.from({ length: n }, (_, i) => i);
const allRequestsDone = save => {
  save.cargo.orders = cargo.cargoOrders.map(order => cargo.orderSolution(order));
  save.levels = {
    balance: { cleared: range(balance.mysteryRoundCount), attempts: 4 },
    scale: { cleared: range(scale.fakeRounds.length), attempts: 3 },
    workshop: { cleared: range(workshop.workshopCargos.length), attempts: 5 },
  };
  return save;
};
const fairRescue = [{ route: 'short', force: 1, success: false }, { route: 'long', force: 1, success: true }];

test('an empty save has no stars and 15 reachable', () => {
  const save = state.freshSave();
  for (const id of stageIds) {
    const result = stars.stageStars(save, id);
    assert.equal(result.earned, 0);
    assert.equal(result.slots.length, 3);
    assert.ok(result.slots.every(slot => !slot.done && !slot.off));
  }
  assert.deepEqual(stars.totalStars(save), { earned: 0, max: 15 });
});

test('finishing a mission alone gives its first star only', () => {
  const save = state.freshSave();
  save.completed = ['cargo'];
  assert.deepEqual(stars.stageStars(save, 'cargo').slots.map(slot => slot.done), [true, false, false]);
  assert.equal(stars.stageStars(save, 'balance').earned, 0);
  assert.deepEqual(stars.totalStars(save), { earned: 1, max: 15 });
});

test('each finished level 2 request adds the second star', () => {
  const save = allRequestsDone(state.freshSave());
  save.completed = ['cargo', 'balance', 'scale', 'workshop'];
  for (const id of ['cargo', 'balance', 'scale', 'workshop']) {
    assert.deepEqual(stars.stageStars(save, id).slots.map(slot => slot.done), [true, true, false], id);
  }
  // A request half done is not a star yet.
  save.cargo.orders = save.cargo.orders.slice(0, 2);
  save.levels.balance.cleared = [0];
  assert.equal(stars.stageStars(save, 'cargo').earned, 1);
  assert.equal(stars.stageStars(save, 'balance').earned, 1);
});

test('the core has no request: its second star is the same-force route comparison', () => {
  const save = state.freshSave();
  assert.equal(stars.stageStars(save, 'rescue').slots[1].label, '같은 힘 비교 발견');
  save.rescue.runs = [fairRescue[0]];
  assert.equal(stars.stageStars(save, 'rescue').slots[1].done, false);
  save.rescue.runs = fairRescue;
  assert.equal(stars.stageStars(save, 'rescue').slots[1].done, true);
});

test('the third star is the mission challenge', () => {
  const save = state.freshSave();
  save.completed = ['cargo'];
  save.cargo.runs = [1, 3, 5].map(parts => ({ parts, action: 'push', gesture: 1, distance: 10 }));
  assert.deepEqual(stars.stageStars(save, 'cargo').slots.map(slot => slot.done), [true, false, true]);
  assert.equal(stars.stageStars(save, 'balance').slots[2].done, false);
});

test('stars are computed, never written into the save', () => {
  const save = allRequestsDone(state.freshSave());
  save.completed = [...stageIds];
  save.rescue.runs = fairRescue;
  const before = JSON.stringify(save);
  assert.deepEqual(stars.totalStars(save), { earned: 10, max: 15 });
  assert.equal(JSON.stringify(save), before);
});

test('older saves without levels, teacher options or cargo orders still load and count', () => {
  const legacy = state.freshSave();
  legacy.completed = ['cargo', 'balance'];
  legacy.evidence = { cargo: 'x', balance: 'y' };
  legacy.currentPage = 'map';
  delete legacy.levels; delete legacy.teacherOptions; delete legacy.inquiryPlans;
  stored.set(state.SAVE_KEY, JSON.stringify(legacy));
  const restored = state.readSave();
  assert.ok(restored);
  assert.equal(stars.stageStars(restored, 'cargo').earned, 1);
  assert.ok(stars.stageStars(restored, 'cargo').slots.every(slot => !slot.off));
  assert.deepEqual(stars.totalStars(restored), { earned: 2, max: 15 });
  // The raw object before readSave fills defaults works too.
  assert.deepEqual(stars.totalStars(legacy), { earned: 2, max: 15 });
});
