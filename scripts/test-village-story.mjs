import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// The story module imports only types, so transpiling it leaves no dependencies.
const source = ts.transpileModule(fs.readFileSync('src/villageStory.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getVillageStory, villageRewards } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const stages = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];

test('initial town has no changes and introduces the first experiment', () => {
  assert.deepEqual(getVillageStory([]), {
    next: 'cargo', count: 0, complete: false,
    lines: villageRewards.cargo.beforeLines, changes: [],
  });
});

test('each of the five completions adds only its own town reward and advances the story', () => {
  for (let count = 1; count <= stages.length; count++) {
    const story = getVillageStory(stages.slice(0, count));
    assert.deepEqual(story.changes, stages.slice(0, count));
    assert.equal(story.count, count);
    assert.equal(story.next, stages[count] ?? null);
    assert.equal(story.complete, count === 5);
    assert.ok(story.lines.length >= 2 && story.lines.length <= 3);
    if (story.next) assert.deepEqual(story.lines.slice(-2), villageRewards[story.next].beforeLines);
  }
});

test('replaying and duplicate completion entries do not multiply rewards', () => {
  const completed = Object.freeze(['cargo', 'balance', 'cargo', 'balance']);
  const expected = getVillageStory(['cargo', 'balance']);
  assert.deepEqual(getVillageStory(completed), expected);
  assert.deepEqual(getVillageStory(completed), expected);
  assert.deepEqual(completed, ['cargo', 'balance', 'cargo', 'balance']);
});

test('out-of-order saves apply independent rewards without rewarding missing missions', () => {
  const story = getVillageStory(['rescue', 'scale']);
  assert.deepEqual(story.changes, ['scale', 'rescue']);
  assert.equal(story.next, 'cargo');
  assert.equal(story.count, 2);
  assert.equal(story.complete, false);
  assert.deepEqual(story.lines.slice(-2), villageRewards.cargo.beforeLines);
  for (const missing of ['cargo', 'balance', 'workshop']) assert.ok(!story.changes.includes(missing));
});

test('unknown and malformed runtime entries cannot create rewards or completion', () => {
  assert.deepEqual(getVillageStory(['unknown', 'core', 'constructor', null, {}, 5, 'cargo']), getVillageStory(['cargo']));
  for (const invalid of [null, undefined, 'cargo', {}, 5]) {
    assert.deepEqual(getVillageStory(invalid), getVillageStory([]));
  }
});

test('result arrays can be changed by a renderer without altering future stories or reward dialogue', () => {
  const initial = getVillageStory([]);
  initial.lines.push('changed');
  initial.changes.push('rescue');
  assert.deepEqual(getVillageStory([]).lines, villageRewards.cargo.beforeLines);
  assert.deepEqual(getVillageStory([]).changes, []);
  assert.equal(villageRewards.cargo.beforeLines.length, 2);
});

test('every stage has its own reward and short before/after dialogue; core belongs to rescue', () => {
  assert.deepEqual(Object.keys(villageRewards), stages);
  assert.equal(villageRewards.rescue.name, '중앙 코어');
  for (const reward of Object.values(villageRewards)) {
    for (const key of ['name', 'changeTitle', 'changeDescription']) assert.ok(reward[key].trim());
    for (const lines of [reward.beforeLines, reward.afterLines]) {
      assert.ok(lines.length >= 2 && lines.length <= 3);
      assert.ok(lines.every(line => typeof line === 'string' && line.trim()));
    }
  }
});
