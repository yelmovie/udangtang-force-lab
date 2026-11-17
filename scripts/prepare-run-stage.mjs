// Turns the generated originals in references/images/run-stage-20261117/ into the runtime pictures of the
// walking core mission (public/assets/run-stage/). Run: node scripts/prepare-run-stage.mjs
// Strips become one row of 256x256 cells: specks removed, every frame at one scale, feet on one baseline.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const source = 'references/images/run-stage-20261117', out = 'public/assets/run-stage', cell = 256, baseline = 248;
fs.mkdirSync(out, { recursive: true });

/** Keeps the figure and drops stray specks: connected groups of visible pixels far smaller than the largest one. */
function clean(data, width, height, cut = 40) {
  const label = new Int32Array(width * height), sizes = [0], stack = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] || data[start * 4 + 3] < cut) continue;
    const id = sizes.length; let size = 0; label[start] = id; stack.push(start);
    while (stack.length) {
      const at = stack.pop(), x = at % width, y = (at - x) / width; size++;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!label[next] && data[next * 4 + 3] >= cut) { label[next] = id; stack.push(next); }
      }
    }
    sizes.push(size);
  }
  const keepFrom = Math.max(...sizes) * .04;
  let left = width, right = -1, top = height, bottom = -1;
  for (let at = 0; at < width * height; at++) {
    if (!label[at] || sizes[label[at]] < keepFrom) { data[at * 4 + 3] = 0; continue; }
    const x = at % width, y = (at - x) / width;
    if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function frames(file, columns, rows = 1, picks = null, cut = 40) {
  const image = sharp(file).ensureAlpha(), { width, height } = await image.metadata();
  const w = Math.floor(width / columns), h = Math.floor(height / rows), list = [];
  for (const [column, row] of picks ?? Array.from({ length: columns }, (_unused, i) => [i, 0])) {
    const { data } = await sharp(file).ensureAlpha().extract({ left: column * w, top: row * h, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
    const box = clean(data, w, h, cut);
    list.push({ buffer: await sharp(data, { raw: { width: w, height: h, channels: 4 } }).extract(box).png().toBuffer(), ...box });
  }
  return list;
}

/** One row of cells. `tall` is the height in pixels of the tallest frame; `scale` overrides it to keep two sheets alike. */
async function strip(name, list, tall, scale = tall / Math.max(...list.map(frame => frame.height))) {
  const layers = [];
  for (const [index, frame] of list.entries()) {
    const width = Math.min(cell, Math.round(frame.width * scale)), height = Math.min(baseline, Math.round(frame.height * scale));
    layers.push({ input: await sharp(frame.buffer).resize(width, height, { fit: 'fill' }).toBuffer(), left: index * cell + Math.round((cell - width) / 2), top: baseline - height });
  }
  const file = path.join(out, `${name}.webp`);
  await sharp({ create: { width: cell * list.length, height: cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).webp({ quality: 88, alphaQuality: 90 }).toFile(file);
  console.log(name, `${list.length} frame(s)`, fs.statSync(file).size, 'bytes');
  return scale;
}

const has = name => fs.existsSync(path.join(source, `${name}.png`));
if (has('explorer-walk')) await strip('explorer-walk', await frames(path.join(source, 'explorer-walk.png'), 6), 222);
if (has('explorer-push')) await strip('explorer-push', await frames(path.join(source, 'explorer-push.png'), 6), 200);
// The fifth pull frame crosses its cell edge in the original, so the cycle uses the other five.
if (has('explorer-pull')) await strip('explorer-pull', await frames(path.join(source, 'explorer-pull.png'), 6, 1, [[0, 0], [1, 0], [2, 0], [3, 0], [5, 0]]), 204);
// The corgi original keeps a faint haze around the fur; a higher alpha cut removes it.
if (has('corgi-walk')) await strip('corgi-walk', await frames(path.join(source, 'corgi-walk.png'), 6, 1, null, 150), 200);
// Standing, jumping and cheering come from the project's own pose sheet (4 x 2), at one shared scale.
const poses = 'public/assets/characters/student_poses.webp';
const [idle, cheer, jump] = await frames(poses, 4, 2, [[0, 0], [1, 1], [3, 1]]);
const poseScale = await strip('explorer-idle', [idle], 222);
await strip('explorer-cheer', [cheer], 0, poseScale);
await strip('explorer-jump', [jump], 0, poseScale);
if (has('floor')) {
  await sharp(path.join(source, 'floor.png')).resize(512, 512).webp({ quality: 82 }).toFile(path.join(out, 'floor.webp'));
  console.log('floor', fs.statSync(path.join(out, 'floor.webp')).size, 'bytes');
}
/** A single prop: specks removed, cropped to the object, scaled to `width` pixels. */
async function prop(name, width, cut = 40) {
  if (!has(name)) return;
  const { data, info } = await sharp(path.join(source, `${name}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = clean(data, info.width, info.height, cut), file = path.join(out, `${name}.webp`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box).resize({ width }).webp({ quality: 86, alphaQuality: 90 }).toFile(file);
  console.log(name, fs.statSync(file).size, 'bytes');
}
await prop('parts-pile', 512);
await prop('dock', 768);
for (const name of ['decor-shelf', 'decor-barrels', 'decor-bench']) await prop(name, 512);
if (has('bot-walk')) await strip('bot-walk', await frames(path.join(source, 'bot-walk.png'), 6), 206);
for (const [name, width, height] of [['wall', 1536, 1024], ['panel', 512, 512]]) {
  if (!has(name)) continue;
  await sharp(path.join(source, `${name}.png`)).resize(width, height, { fit: 'fill' }).webp({ quality: 80 }).toFile(path.join(out, `${name}.webp`));
  console.log(name, fs.statSync(path.join(out, `${name}.webp`)).size, 'bytes');
}
