import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
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
const draftOf = patch => ({ ...life.emptyLifeDraft(), ...patch });

test('picture cards: about eight, both principles, short preset uses and inline SVG only', () => {
  assert.ok(life.lifeCards.length >= 6 && life.lifeCards.length <= 10);
  assert.equal(new Set(life.lifeCards.map(card => card.id)).size, life.lifeCards.length);
  assert.ok(life.lifeCards.some(card => card.tool === 'lever'));
  assert.ok(life.lifeCards.some(card => card.tool === 'ramp'));
  for (const card of life.lifeCards) {
    assert.ok(['lever', 'ramp'].includes(card.tool), card.id);
    assert.ok(card.uses.length >= 2 && card.uses.length <= 3, card.id);
    assert.ok(card.uses.every(use => use.endsWith('때')), card.id);
    assert.match(card.svg, /^<(path|rect|circle)/, card.id);
    assert.doesNotMatch(card.svg + card.name, /\p{Extended_Pictographic}|<image|href=/u, card.id);
  }
  assert.deepEqual(life.lifePlaces.map(place => place.source), ['around', 'around', 'around', 'around', 'example']);
});

test('a listed card decides lever or ramp; "목록에 없어요" waits for the student', () => {
  assert.equal(life.lifeDraftTool(draftOf({ cardId: 'opener' })), 'lever');
  assert.equal(life.lifeDraftTool(draftOf({ cardId: 'screw' })), 'ramp');
  assert.equal(life.lifeDraftTool(draftOf({ cardId: 'screw', otherTool: 'lever' })), 'ramp');
  assert.equal(life.lifeDraftTool(draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이' })), undefined);
  assert.equal(life.lifeDraftTool(draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이', otherTool: 'lever' })), 'lever');
  assert.equal(life.lifeDraftTool(draftOf({})), undefined);
});

test('finishing needs tool, place and use; a picture alone is not enough', () => {
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener', placeId: 'home' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener', placeId: 'home', customUse: '   ' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener', placeId: 'nowhere', useChoice: '병뚜껑을 딸 때' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener', placeId: 'home', useChoice: '병뚜껑을 딸 때' })), true);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: 'opener', placeId: 'home', customUse: '잼 뚜껑을 열 때' })), true);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이', placeId: 'home', customUse: '손톱을 자를 때' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: life.LIFE_OTHER, otherName: ' ', otherTool: 'lever', placeId: 'home', customUse: '손톱을 자를 때' })), false);
  assert.equal(life.canFinishLifeDraft(draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이', otherTool: 'lever', placeId: 'home', customUse: '손톱을 자를 때' })), true);
  assert.equal(life.lifeStepDone(draftOf({ cardId: 'opener' }), 1), true);
  assert.equal(life.lifeStepDone(draftOf({ cardId: 'opener' }), 2), false);
});

test('saved record keeps the LifeObservation shape with readable "장소 · 도구" text', () => {
  const saved = life.lifeDraftToObservation(draftOf({ cardId: 'opener', placeId: 'school', useChoice: '병뚜껑을 딸 때', shared: true }));
  assert.deepEqual(saved, { tool: 'lever', source: 'around', object: '학교 · 병따개', use: '병뚜껑을 딸 때', shared: true });
  assert.deepEqual(life.retainLifeObservation(saved), saved);
  assert.equal(life.hasLifeObservation(saved), true);
  const picture = life.lifeDraftToObservation(draftOf({ cardId: 'screw', placeId: 'picture', customUse: '  의자를 고칠 때.  ' }));
  assert.deepEqual(picture, { tool: 'ramp', source: 'example', object: '그림 · 나사', use: '의자를 고칠 때', shared: false });
  // A half-done draft is still storable, so closing the window keeps it.
  assert.deepEqual(life.lifeDraftToObservation(draftOf({ cardId: 'seesaw' })), { tool: 'lever', source: 'around', object: '시소', use: '', shared: false });
});

test('card records and drafts read back into the same picks', () => {
  const drafts = [
    draftOf({ cardId: 'opener', placeId: 'school', useChoice: '병뚜껑을 딸 때', shared: true }),
    draftOf({ cardId: 'wheelchair-ramp', placeId: 'street', customUse: '택배 수레를 올릴 때' }),
    draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이', otherTool: 'lever', placeId: 'home', customUse: '손톱을 자를 때' }),
    draftOf({ cardId: 'stair-slide', placeId: 'picture', useChoice: '수레를 밀어 올릴 때' }),
    draftOf({ cardId: 'seesaw' }),
    draftOf({ placeId: 'playground' }),
  ];
  for (const draft of drafts) {
    const restored = life.lifeDraftFromObservation(life.retainLifeObservation(life.lifeDraftToObservation(draft)));
    const expected = { ...draft };
    if (expected.cardId !== life.LIFE_OTHER) delete expected.otherTool;
    if (restored.otherTool === undefined) delete restored.otherTool;
    assert.deepEqual(restored, expected);
  }
  assert.deepEqual(life.lifeDraftFromObservation(undefined), life.emptyLifeDraft());
});

test('older free-typed records stay visible and editable', () => {
  const older = { tool: 'ramp', source: 'around', object: '학교 입구의 경사판', use: '수레를 높은 턱에 올려요', shared: false };
  const draft = life.lifeDraftFromObservation(older);
  assert.equal(draft.cardId, life.LIFE_OTHER);
  assert.equal(draft.otherName, '학교 입구의 경사판');
  assert.equal(draft.otherTool, 'ramp');
  assert.equal(draft.customUse, '수레를 높은 턱에 올려요');
  assert.equal(draft.placeId, '');
  assert.equal(life.lifeFirstOpenStep(draft), 2);
  draft.placeId = 'school';
  assert.equal(life.canFinishLifeDraft(draft), true);
  assert.deepEqual(life.lifeDraftToObservation(draft), { ...older, object: '학교 · 학교 입구의 경사판' });

  const fromPicture = life.lifeDraftFromObservation({ tool: 'lever', source: 'example', object: '병따개 그림', use: '뚜껑 열기', shared: true });
  assert.equal(fromPicture.placeId, 'picture');
  assert.equal(fromPicture.otherTool, 'lever');
  assert.equal(fromPicture.shared, true);
  assert.equal(life.lifeFirstOpenStep(fromPicture), 3);
  // A typed name that matches a card becomes that card, and a typed use stays as typed.
  const typedCard = life.lifeDraftFromObservation({ tool: 'ramp', source: 'around', object: '가위', use: '색종이를 자를 때', shared: false });
  assert.equal(typedCard.cardId, 'scissors');
  assert.equal(typedCard.customUse, '색종이를 자를 때');
});

test('share sentence fills in the picks', () => {
  assert.equal(life.lifeShareSentence(draftOf({ cardId: 'opener', useChoice: '병뚜껑을 딸 때' })), '내가 본 도구는 병따개이고, 병뚜껑을 딸 때 써요.');
  assert.equal(life.lifeShareSentence(draftOf({ cardId: 'screw', customUse: '의자 고치기' })), '내가 본 도구는 나사이고, “의자 고치기” 할 때 써요.');
  assert.equal(life.lifeShareSentence(draftOf({})), '내가 본 도구는 __이고, __할 때 써요.');
});

test('the window opens at the first unfinished step', () => {
  assert.equal(life.lifeFirstOpenStep(draftOf({})), 1);
  assert.equal(life.lifeFirstOpenStep(draftOf({ cardId: life.LIFE_OTHER, otherName: '손톱깎이' })), 1);
  assert.equal(life.lifeFirstOpenStep(draftOf({ cardId: 'opener' })), 2);
  assert.equal(life.lifeFirstOpenStep(draftOf({ cardId: 'opener', placeId: 'home' })), 3);
});
