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
const cargo = await import(moduleUrl('src/cargoModel.ts'));

let stored = new Map();
beforeEach(() => {
  stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
});
const saveWith = cargoPatch => {
  const save = state.freshSave();
  Object.assign(save.cargo, cargoPatch);
  return save;
};
const restore = save => { localStorage.setItem(state.SAVE_KEY, JSON.stringify(save)); return state.readSave(); };

test('each bakery order has exactly one force step that stops in the yellow zone', () => {
  assert.equal(cargo.cargoOrders.length, 3);
  for (const order of cargo.cargoOrders) {
    const hits = [1, 2, 3].filter(force => cargo.orderResult(order, cargo.cargoDistance(order.parts, force)) === 'hit');
    assert.equal(hits.length, 1, `parts ${order.parts}: ${hits}`);
    assert.equal(cargo.orderSolution(order), hits[0]);
  }
});

test('heavier orders need a bigger force step to reach the same place', () => {
  const solutions = cargo.cargoOrders.map(cargo.orderSolution);
  assert.deepEqual(solutions, [1, 2, 3]);
  const parts = cargo.cargoOrders.map(order => order.parts);
  assert.deepEqual(parts, [...parts].sort((a, b) => a - b), 'orders get heavier');
  assert.ok(cargo.cargoOrders.every(order => order.target[0] === cargo.cargoOrders[0].target[0] && order.target[1] === cargo.cargoOrders[0].target[1]), 'same bakery door every time');
});

test('distance grows with force and shrinks with load, and stays on the rail', () => {
  for (const parts of [1, 3, 5]) {
    const steps = [1, 2, 3].map(force => cargo.cargoDistance(parts, force));
    assert.ok(steps[0] < steps[1] && steps[1] < steps[2], `parts ${parts}: ${steps}`);
    assert.ok(steps.every(d => d > 0 && d <= 100));
  }
  for (const force of [1, 2, 3]) assert.ok(cargo.cargoDistance(1, force) > cargo.cargoDistance(3, force) && cargo.cargoDistance(3, force) > cargo.cargoDistance(5, force));
});

test('the medium step is the level 1 "same push", so level 1 distances do not change', () => {
  assert.deepEqual([1, 3, 5].map(parts => cargo.cargoDistance(parts)), [66, 44, 22]);
  assert.deepEqual([1, 3, 5].map(parts => cargo.cargoDistance(parts, 2)), [66, 44, 22]);
});

test('misses say over or short; the second miss on an order names which way to change', () => {
  const [light, , heavy] = cargo.cargoOrders;
  assert.equal(cargo.orderResult(light, cargo.cargoDistance(1, 2)), 'over');
  assert.equal(cargo.orderResult(heavy, cargo.cargoDistance(5, 2)), 'short');
  const first = cargo.orderHint('short', 1), second = cargo.orderHint('short', 2);
  assert.match(first, /한 단계/);
  assert.notEqual(first, second);
  assert.match(second, /더 큰 힘/);
  assert.match(cargo.orderHint('over', 2), /더 작게/);
  for (const hint of [first, second, cargo.orderHint('over', 1)]) assert.doesNotMatch(hint, /틀렸|실패|땡/);
});

test('old saves without orders keep their cargo completion and stay in the old shape', () => {
  const save = saveWith({ runs: [{ parts: 1, action: 'push', gesture: 100, distance: 60 }, { parts: 5, action: 'push', gesture: 100, distance: 36 }] });
  save.completed = ['cargo'];
  save.evidence = { cargo: '예전 기록' };
  const restored = restore(save);
  assert.deepEqual(restored.completed, ['cargo']);
  assert.equal(restored.evidence.cargo, '예전 기록');
  assert.equal('orders' in restored.cargo, false);
  assert.equal(restored.cargo.runs.length, 2);
});

test('saved orders keep only the valid delivered prefix', () => {
  assert.deepEqual(restore(saveWith({ orders: [] })).cargo.orders, []);
  assert.deepEqual(restore(saveWith({ orders: [1, 2, 3] })).cargo.orders, [1, 2, 3]);
  assert.deepEqual(restore(saveWith({ orders: [1, 2] })).cargo.orders, [1, 2]);
  assert.deepEqual(restore(saveWith({ orders: [1, 3, 3] })).cargo.orders, [1], 'a forged step stops the prefix');
  assert.deepEqual(restore(saveWith({ orders: [3, 2, 1] })).cargo.orders, []);
  assert.deepEqual(restore(saveWith({ orders: [1, 2, 3, 3, 3] })).cargo.orders, [1, 2, 3]);
  assert.equal('orders' in restore(saveWith({ orders: 'all' })).cargo, false);
  assert.equal(cargo.ordersComplete([1, 2, 3]), true);
  assert.equal(cargo.ordersComplete([1, 2]), false);
  assert.equal(cargo.ordersComplete(undefined), false);
});

test('finishing cargo again after free experimenting does not add a second completion', () => {
  const save = state.freshSave();
  state.completeStage(save, 'cargo', 'first');
  state.completeStage(save, 'cargo', 'again');
  assert.deepEqual(save.completed.filter(id => id === 'cargo'), ['cargo']);
  assert.equal(save.evidence.cargo, 'again');
});
