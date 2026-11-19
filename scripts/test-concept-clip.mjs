import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ts = readFileSync(new URL('../src/conceptClip.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/conceptClip.css', import.meta.url), 'utf8');
const stages = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];

test('concept films are full screen, contained, with controls in the top bar', () => {
  assert.match(css, /\.concept-layer \.modal-card\.concept-card \{[^}]*width:100dvw;[^}]*height:var\(--app-height, 100dvh\)/);
  assert.match(css, /\.concept-video, \.concept-end-frame \{[^}]*object-fit:contain/);
  assert.doesNotMatch(css, /\.concept-(video|end-frame)[^{]*\{[^}]*object-fit:cover/, 'cover would cut the burned-in captions');
  assert.match(ts, /<div class="concept-topbar">[\s\S]*data-concept-action="replay"[\s\S]*data-concept-action="close"[\s\S]*<\/div>\s*<div class="concept-video-wrap">/);
  assert.match(ts, /anchor:layer\.querySelector<HTMLElement>\('\.concept-heading'\)/, 'step rail goes in the top bar');
  assert.doesNotMatch(ts, /<video[^>]*\scontrols/, 'native controls would cover the caption zone');
});

test('DOM caption is hidden visually only once frames play, and comes back on failure', () => {
  assert.match(ts, /addEventListener\('playing', \(\) => \{[^\n]*classList\.add\('film-captions'\)/);
  assert.match(css, /\.concept-layer \.concept-card\.film-captions \.concept-caption \{[^}]*clip-path:inset\(50%\)/);
  assert.match(ts, /id="concept-caption" role="status" aria-live="polite"/);
  assert.match(ts, /classList\.remove\('film-captions', 'is-playing'\)/);
});

test('voice holds stop before the burned caption of the line fades out', () => {
  assert.match(ts, /const HOLD_LEAD = 0\.4;/);
  assert.match(ts, /video\.currentTime >= next\.at - HOLD_LEAD\) \{ holding = true; video\.pause\(\); return; \}/);
  assert.match(ts, /requestAnimationFrame\(tick\)/);
});

test('every concept film has captioned mp4 and webm plus the cue record', () => {
  for (const stage of stages) {
    for (const ext of ['mp4', 'webm', 'webp']) assert.ok(existsSync(new URL(`../public/assets/concepts/${stage}.${ext}`, import.meta.url)), `${stage}.${ext}`);
    const film = JSON.parse(readFileSync(new URL(`../docs/concept-captions-20261118/${stage}.json`, import.meta.url), 'utf8'));
    const block = ts.match(new RegExp(`${stage}: \\{ title: '[^']+', cues: \\[([\\s\\S]*?)\\] \\}`))[1];
    const cues = [...block.matchAll(/\{ at: ([\d.]+), text: '([^']+)' \}/g)].map(m => ({ at: Number(m[1]), text: m[2] }));
    assert.equal(film.cues.length, cues.length, stage);
    film.cues.forEach((cue, i) => {
      assert.equal(cue.s, cues[i].at, `${stage} cue ${i} start`);
      assert.equal(cue.text.replace(/[[\]]/g, '').replace('\n', ' '), cues[i].text, `${stage} cue ${i} text`);
    });
  }
});
