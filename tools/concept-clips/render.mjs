// Renders the concept clips without Remotion: SVG per frame → sharp (librsvg) → raw RGBA piped into FFmpeg.
// Output per clip: WebM (VP9), MP4 (H.264), poster WebP of the last frame. Silent.
// Usage: node tools/concept-clips/render.mjs [cargo balance …] [--out <dir>] [--still <frame>]
//        FFmpeg: $FFMPEG, else .tools/ffmpeg/ffmpeg.exe, else ffmpeg on PATH.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { clips } from './clips.mjs';
import { FPS, H, W } from './theme.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return undefined; const value = args[i + 1]; args.splice(i, 2); return value; };
const out = resolve(flag('--out') ?? join(root, 'public/assets/concepts'));
const still = flag('--still');
const only = args;
const localFfmpeg = join(root, '.tools/ffmpeg/ffmpeg.exe');
const ffmpeg = process.env.FFMPEG ?? (existsSync(localFfmpeg) ? localFfmpeg : 'ffmpeg');

function encoder(file, codecArgs) {
  const proc = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    ...codecArgs, '-pix_fmt', 'yuv420p', '-an', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => proc.on('close', code => (code === 0 ? ok() : fail(new Error(`ffmpeg ${file} 종료 코드 ${code}`)))));
  const write = buffer => new Promise(ok => (proc.stdin.write(buffer) ? ok() : proc.stdin.once('drain', ok)));
  return { write, end: () => { proc.stdin.end(); return done; } };
}

const raster = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();

mkdirSync(out, { recursive: true });
for (const [id, clip] of Object.entries(clips)) {
  if (only.length && !only.includes(id)) continue;
  const frames = clip.seconds * FPS;
  if (still !== undefined) {
    const frame = Math.min(frames - 1, Number(still));
    await sharp(Buffer.from(clip.frame(frame))).png().toFile(join(out, `${id}-${frame}.png`));
    console.log(`${id}-${frame}.png`);
    continue;
  }
  const started = Date.now();
  const webm = encoder(join(out, `${id}.webm`), ['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2']);
  const mp4 = encoder(join(out, `${id}.mp4`), ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-movflags', '+faststart']);
  for (let f = 0; f < frames; f++) {
    const rgba = await raster(clip.frame(f));
    await Promise.all([webm.write(rgba), mp4.write(rgba)]);
  }
  await Promise.all([webm.end(), mp4.end()]);
  await sharp(Buffer.from(clip.frame(frames - 1))).webp({ quality: 82 }).toFile(join(out, `${id}.webp`));
  const sizes = ['webm', 'mp4', 'webp'].map(ext => `${ext} ${(statSync(join(out, `${id}.${ext}`)).size / 1024).toFixed(0)} KB`).join(' · ');
  console.log(`${id}: ${frames}프레임 ${((Date.now() - started) / 1000).toFixed(1)}초 · ${sizes}`);
}
