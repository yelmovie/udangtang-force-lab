import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
test('intro and ending videos use 16s cue plans and every entry point', () => {
  assert.match(main, /intro\.mp4', cues: \[0, 6, 12\], duration: 16/);
  assert.match(main, /ending\.mp4', cues: \[0, 4, 10\], duration: 16/);
  assert.equal((main.match(/video: introVideo/g) ?? []).length, 2);
  assert.match(main, /video: endingVideo/);
});
test('video modal has fallback, play button, cleanup and reduced-motion handling', () => {
  assert.match(main, /playsinline controls/);
  assert.match(main, /addEventListener\('error', fallback\)/);
  assert.match(main, /data-story="play"/);
  assert.match(main, /removeAttribute\('src'\)/);
  assert.match(main, /prefers-reduced-motion: reduce/);
});
