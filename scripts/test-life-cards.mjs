import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import ts from 'typescript';

// Import the actual TypeScript module without producing build files (same approach as test-model.mjs).
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
const life = await import(moduleUrl('src/lifeObservation.ts'));
const byTool = tool => life.lifeCards.filter(card => card.tool === tool);
const sortAll = () => life.lifeCards.reduce((record, card) => life.dropLifeCard(record, card.id, card.tool).record, life.emptyLifeObservation());

test('eight picture cards: four levers and four ramps, mixed in the tray, each with generated webp art', async () => {
  assert.equal(life.lifeCards.length, 8);
  assert.equal(new Set(life.lifeCards.map(card => card.id)).size, 8);
  assert.equal(byTool('lever').length, 4);
  assert.equal(byTool('ramp').length, 4);
  const tools = life.lifeCards.map(card => card.tool);
  assert.ok(tools.slice(0, 4).includes('lever') && tools.slice(0, 4).includes('ramp'), 'first row shows both kinds');
  for (const card of life.lifeCards) {
    assert.match(card.id, /^[a-z]+(-[a-z]+)*$/, card.id);
    const file = `public/assets/life-tools/${card.id}.webp`;
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'webp', file);
    assert.ok(meta.width <= 320 && meta.height <= 240, `${file} stays within twice the 160x120 card size`);
    assert.equal(meta.hasAlpha, true, file);
    assert.match(card.why, card.tool === 'lever' ? /받침점/ : /비스듬/, card.id);
    assert.ok(card.hint.length > 0, card.id);
  }
  assert.match(life.lifeBaskets.lever.idea, /받침점/);
  assert.match(life.lifeBaskets.ramp.idea, /비스듬/);
});

test('a drop files the card only in its own basket; the other basket is a retry with no penalty', () => {
  let record = life.emptyLifeObservation();
  const wrong = life.dropLifeCard(record, 'seesaw', 'ramp');
  assert.equal(wrong.result, 'retry');
  assert.deepEqual(wrong.record.sorted, []);
  assert.deepEqual(wrong.record.missed, ['seesaw']);
  assert.deepEqual(life.dropLifeCard(wrong.record, 'seesaw', 'ramp').record.missed, ['seesaw'], 'a second miss is not counted again');
  const right = life.dropLifeCard(wrong.record, 'seesaw', 'lever');
  assert.equal(right.result, 'correct');
  record = right.record;
  assert.deepEqual(record.sorted, ['seesaw']);
  assert.deepEqual(record.missed, ['seesaw'], 'the teacher still sees which card needed a second look');
  assert.equal(record.object, '지레: 시소');
  assert.equal(record.use, '빗면: 아직 없어요');
  assert.equal(life.dropLifeCard(record, 'seesaw', 'lever'), undefined, 'a filed card cannot be dropped again');
  assert.equal(life.dropLifeCard(record, 'rocket', 'ramp'), undefined);
  assert.equal(life.lifeSortDone(record), false);
});

test('sorting all eight finishes with readable lists for the result screen and evidence', () => {
  const record = sortAll();
  assert.equal(life.lifeSortDone(record), true);
  assert.equal(record.object, '지레: 병따개, 시소, 장도리, 가위');
  assert.equal(record.use, '빗면: 미끄럼틀, 휠체어 경사로, 지그재그 산길, 트럭 경사판');
  assert.equal(record.shared, false);
  assert.match(life.lifeSummary, /움직이는 거리는 길어져요/, 'the summary names the trade-off, not a free lunch');
  assert.match(life.lifeSummary, /지레와 빗면/);
});

test('feedback: a right drop says why in one line, a retry only gives a hint', () => {
  assert.equal(life.lifeDropMessage('seesaw', 'correct'), `맞아요! 시소는 지레예요. ${life.lifeCard('seesaw').why}`);
  assert.match(life.lifeDropMessage('slide', 'correct'), /^맞아요! 미끄럼틀은 빗면이에요\. /);
  assert.match(life.lifeDropMessage('wheelchair-ramp', 'correct'), /^맞아요! 휠체어 경사로는 빗면이에요\. /);
  for (const card of life.lifeCards) {
    const retry = life.lifeDropMessage(card.id, 'retry');
    assert.match(retry, /^다시 생각해요\. /);
    assert.doesNotMatch(retry, /지레예요|빗면이에요/, card.id);
  }
  assert.equal(life.lifePickMessage('bottle-opener'), '병따개를 골랐어요. 이제 지레 바구니나 빗면 바구니를 눌러요.');
  assert.equal(life.lifePickMessage('slide'), '미끄럼틀을 골랐어요. 이제 지레 바구니나 빗면 바구니를 눌러요.');
});

test('saved progress survives a reload; forged ids and text are dropped', () => {
  const partial = life.dropLifeCard(life.dropLifeCard(life.emptyLifeObservation(), 'slide', 'lever').record, 'slide', 'ramp').record;
  assert.deepEqual(life.retainLifeObservation(JSON.parse(JSON.stringify(partial))), partial);
  assert.deepEqual(life.retainLifeObservation(JSON.parse(JSON.stringify(sortAll()))), sortAll());
  const forged = life.retainLifeObservation({ sorted: ['seesaw', 'seesaw', 'rocket', 3], missed: ['slide', 'nope'], object: '다 했어요', use: 'x', shared: 'yes' });
  assert.deepEqual(forged, { sorted: ['seesaw'], missed: ['slide'], object: '지레: 시소', use: '빗면: 아직 없어요', shared: false });
});

test('older 3-step records stay readable until the student sorts again', () => {
  const older = { tool: 'lever', source: 'around', object: ' 학교 · 병따개 ', use: '병뚜껑을 딸 때', shared: true };
  const kept = life.retainLifeObservation(older);
  assert.deepEqual(kept, { sorted: [], missed: [], object: '학교 · 병따개', use: '병뚜껑을 딸 때', shared: true });
  assert.deepEqual(life.retainLifeObservation(JSON.parse(JSON.stringify(kept))), kept, 'a migrated record reloads unchanged');
  assert.equal(life.lifeSortDone(kept), false, 'an old record opens the sorting board fresh');
  assert.equal(life.retainLifeObservation({ ...older, object: 'a'.repeat(200), use: 'b'.repeat(1000) }).use.length, 160);
  assert.equal(life.retainLifeObservation({ ...older, object: 'a'.repeat(200) }).object.length, 80);
  assert.equal(life.retainLifeObservation({ tool: 'ramp', source: 'example', object: '  ', use: ' ', shared: true }), undefined);
  assert.equal(life.retainLifeObservation({ tool: 'alien' }), undefined);
  assert.equal(life.retainLifeObservation('병따개'), undefined);
  assert.equal(life.retainLifeObservation(null), undefined);
  const resorted = life.dropLifeCard(kept, 'scissors', 'lever').record;
  assert.equal(resorted.object, '지레: 가위', 'the first new drop replaces the old words with the sorted lists');
  assert.equal(resorted.shared, false, 'the old self-report checkbox does not carry over to the new sorting');
});
