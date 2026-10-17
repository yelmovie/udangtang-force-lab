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
const cards = await import(moduleUrl('src/toolCards.ts'));

const stageIds = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
const done = (...ids) => { const save = state.freshSave(); save.completed = ids; return save; };
const record = (save, id) => cards.toolCards(save).find(card => card.stage === id).record;

test('an empty save has five locked cards and no record lines', () => {
  const list = cards.toolCards(state.freshSave());
  assert.deepEqual(list.map(card => card.stage), stageIds);
  assert.deepEqual(list.map(card => card.name), ['밀기 장갑', '수평대', '전자저울', '지레와 빗면 판', '코어 운반 기록']);
  assert.ok(list.every(card => !card.earned && card.record === null && card.idea.length > 0));
  assert.equal(cards.earnedToolCards(state.freshSave()).length, 0);
  assert.match(cards.toolCardsText(state.freshSave()), /내 도구 카드 0\/5\n- \(아직 받은 카드가 없어요\)/);
});

test('a card is earned by completing that mission level 1, and the record line hides without runs', () => {
  const save = done('cargo');
  const [glove, ...rest] = cards.toolCards(save);
  assert.equal(glove.earned, true);
  assert.equal(glove.record, null);
  assert.ok(rest.every(card => !card.earned));
});

test('a locked card shows no record even when runs exist', () => {
  const save = state.freshSave();
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 60 }];
  assert.equal(record(save, 'cargo'), null);
  assert.equal(cards.toolCardRecord(save, 'cargo'), '1개 상자 60칸');
});

test('cargo record uses the latest 1-part and 5-part distances', () => {
  const save = done('cargo');
  save.cargo.runs = [
    { parts: 1, action: 'push', gesture: 1, distance: 50 },
    { parts: 5, action: 'push', gesture: 1, distance: 36 },
    { parts: 3, action: 'push', gesture: 1, distance: 45 },
    { parts: 1, action: 'push', gesture: 1, distance: 60 },
  ];
  assert.equal(record(save, 'cargo'), '1개 상자 60칸, 5개 상자 36칸');
});

test('balance record names the tilted pair and the level pair', () => {
  const save = done('cargo', 'balance');
  save.balance.runs = [
    { left: 'A', right: 'B', prediction: 'level', actual: 'right' },
    { left: 'A', right: 'C', prediction: 'left', actual: 'level' },
  ];
  assert.equal(record(save, 'balance'), '나무 블록과 금속 블록: 금속 블록 쪽이 내려감 · 나무 블록과 도자기 블록: 수평');
  save.balance.runs = [{ left: 'B', right: 'C', prediction: 'left', actual: 'left' }];
  assert.equal(record(save, 'balance'), '도자기 블록과 금속 블록: 금속 블록 쪽이 내려감');
});

test('scale record keeps only zeroed single readings of the apple and book models', () => {
  const save = done('cargo', 'balance', 'scale');
  save.scale.runs = [
    { parts: ['orange'], reading: 95, zeroed: false },
    { parts: ['orange', 'blue'], reading: 150, zeroed: true },
    { parts: ['blue'], reading: 70, zeroed: true },
  ];
  assert.equal(record(save, 'scale'), '책 모형 70 g');
  save.scale.runs.push({ parts: ['orange'], reading: 80, zeroed: true });
  assert.equal(record(save, 'scale'), '사과 모형 80 g, 책 모형 70 g');
});

test('workshop record names the design that needed the least force compared with lifting directly', () => {
  const save = done('cargo', 'balance', 'scale', 'workshop');
  save.workshop.trials = [{ tool: 'lever', setting: 1 }, { tool: 'lever', setting: 2 }];
  assert.equal(record(save, 'workshop'), null, 'no design easier than lifting directly');
  save.workshop.trials.push({ tool: 'lever', setting: 0 });
  assert.equal(record(save, 'workshop'), "직접 들 때보다 힘이 가장 적게 든 설계: 지레 '화물 가까이'");
  save.workshop.trials.push({ tool: 'ramp', setting: 0 }, { tool: 'ramp', setting: 1 });
  assert.equal(record(save, 'workshop'), "직접 들 때보다 힘이 가장 적게 든 설계: 빗면 '길고 완만하게'");
});

test('core record states the same-force comparison', () => {
  const save = done(...stageIds);
  assert.equal(record(save, 'rescue'), null);
  save.rescue.runs = [{ route: 'long', force: 1, success: true }, { route: 'short', force: 1, success: false }];
  assert.equal(record(save, 'rescue'), '작은 힘으로 짧고 가파른 빗면은 멈춤, 길고 완만한 빗면은 도착');
});

test('cards are computed without changing or storing anything in the save', () => {
  const save = done('cargo', 'balance');
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 60 }];
  const before = JSON.stringify(save);
  cards.toolCards(save); cards.earnedToolCards(save); cards.toolCardsText(save);
  assert.equal(JSON.stringify(save), before);
  assert.ok(!/toolCard|도구 카드/.test(before));
});

test('the research record text lists earned card names with their record lines', () => {
  const save = done('cargo', 'balance');
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 60 }, { parts: 5, action: 'push', gesture: 1, distance: 36 }];
  assert.equal(cards.toolCardsText(save), '내 도구 카드 2/5\n- 밀기 장갑: 1개 상자 60칸, 5개 상자 36칸\n- 수평대');
});
