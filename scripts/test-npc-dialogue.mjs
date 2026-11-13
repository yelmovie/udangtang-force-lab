import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../src/npcDialogue.ts', import.meta.url), 'utf8').replace("import './npcDialogue.css';", ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function dialogueHarness({ reduce = false } = {}) {
  class Element extends EventTarget {
    textContent = '';
    children = [];
    setAttribute() {}
    replaceChildren(...children) { this.children = children; }
    closest(selector) { return selector.includes('button') && this === next ? this : null; }
  }
  const document = new EventTarget(), window = new EventTarget(), reduced = new EventTarget();
  document.hidden = false;
  document.createElement = () => new Element();
  reduced.matches = reduce;
  const paragraph = new Element(), next = new Element(), dialog = new Element();
  let cancelledAnimations = 0, advances = 0, now = 0, nextFrame = 0;
  const frames = new Map();
  const portrait = { animate: () => ({ cancel: () => cancelledAnimations++ }) };
  Object.assign(dialog, { open: true, isConnected: true, dataset: {}, querySelector: selector => selector === '[data-dialogue-text]' ? paragraph : portrait });
  const exports = {};
  vm.runInNewContext(source, {
    exports, document, window, matchMedia: () => reduced, AbortController,
    performance: { now: () => now },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const controller = exports.mountDialogueText(dialog, next, () => advances++);
  return {
    controller, dialog, document, reduced, next, paragraph, frames,
    sentences: exports.dialogueSentences,
    get advances() { return advances; },
    get cancelledAnimations() { return cancelledAnimations; },
    click: () => next.dispatchEvent(new Event('click')),
    tick(time) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
  };
}

test('click one completes the current sentence, click two advances exactly once', () => {
  const h = dialogueHarness();
  h.controller.show('박사가 함께 생각해 보자고 말했어.', '다음 문장', true);
  h.tick(28);
  assert.equal(h.dialog.dataset.typing, 'true');
  assert.notEqual(h.paragraph.children[0].textContent, '박사가 함께 생각해 보자고 말했어.');
  assert.equal(h.paragraph.children[1].textContent, '박사가 함께 생각해 보자고 말했어.');
  h.click();
  assert.equal(h.advances, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.next.textContent, '다음 문장');
  h.click();
  assert.equal(h.advances, 1);
  h.controller.destroy();
});

test('replacing a line cancels the previous frame and closing prevents repeated acceptance', () => {
  const h = dialogueHarness();
  h.controller.show('첫 문장', '다음');
  h.controller.show('마지막 문장', '의뢰 받기');
  assert.equal(h.frames.size, 1);
  h.tick(500);
  assert.equal(h.paragraph.children[0].textContent, '마지막 문장');
  h.click();
  h.dialog.open = false;
  h.click();
  assert.equal(h.advances, 1);
  h.controller.destroy();
  assert.equal(h.frames.size, 0);
});

test('hidden tabs and reduced motion finish text and cancel portrait motion', () => {
  const h = dialogueHarness();
  h.controller.show('숨긴 화면에서도 같은 대사를 유지해.', '다음');
  h.document.hidden = true;
  h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size, 0);
  assert.equal(h.dialog.dataset.typing, 'false');
  assert.equal(h.cancelledAnimations, 1);
  h.document.hidden = false;
  h.controller.show('다음 문장도 한 번만 보여 줘.', '다음');
  h.reduced.matches = true;
  h.reduced.dispatchEvent(new Event('change'));
  assert.equal(h.frames.size, 0);
  h.controller.destroy();
  h.click();
  assert.equal(h.advances, 0);
  const reduced = dialogueHarness({ reduce: true });
  reduced.controller.show('처음부터 전체 문장', '다음');
  assert.equal(reduced.frames.size, 0);
  assert.equal(reduced.paragraph.children[0].textContent, '처음부터 전체 문장');
  reduced.controller.destroy();
});

test('sentence beats preserve the original wording and empty lines add no beats', () => {
  const h = dialogueHarness();
  const original = ['오븐이 고장 났어요! 상자를 옮겨 줄래요?', '', '고마워요.'];
  assert.deepEqual(Array.from(h.sentences(original)), ['오븐이 고장 났어요!', '상자를 옮겨 줄래요?', '고마워요.']);
  h.controller.destroy();
});
