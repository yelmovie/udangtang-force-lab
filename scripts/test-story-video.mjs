import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
test('intro and ending videos use the narrated cue plans and every entry point', () => {
  assert.match(main, /intro\.mp4', cues: \[0, 6, 13\], duration: 18,/);
  assert.match(main, /ending\.mp4', cues: \[0, 5, 13\], duration: 21\.2,/);
  assert.equal((main.match(/video: introVideo/g) ?? []).length, 2);
  assert.match(main, /video: endingVideo/);
});
test('video modal has fallback, play button, cleanup and reduced-motion handling', () => {
  assert.match(main, /<video class="story-video" playsinline preload/);
  assert.doesNotMatch(main, /playsinline controls/, 'native controls would cover the burned-in captions');
  assert.match(main, /addEventListener\('error', fallback\)/);
  assert.match(main, /data-story="play"/);
  assert.match(main, /removeAttribute\('src'\)/);
  assert.match(main, /prefers-reduced-motion: reduce/);
});
test('full-screen film keeps the caption zone clear and hides the DOM caption once playing', () => {
  const css = readFileSync(new URL('../src/storyVideo.css', import.meta.url), 'utf8');
  assert.match(main, /data-story="pause"/);
  assert.match(main, /data-story="replay"/);
  assert.match(main, /addEventListener\('playing', onPlaying\)/);
  assert.match(main, /classList\.add\('film-captions'\)/);
  assert.match(css, /\.story-video-card \.story-video \{[^}]*object-fit: contain/);
  assert.match(css, /\.film-captions > \.story-caption\.story-text/);
  assert.match(main, /id="story-caption" role="status" aria-live="polite"/);
});
