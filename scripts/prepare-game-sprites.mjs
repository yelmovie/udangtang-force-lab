import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// These are independent poses and objects, not animation in-between frames.
// Only crop and resize existing transparent originals; never overwrite them.
const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'public/assets/game');
await mkdir(destination, { recursive: true });
const crops = [
  ['scale', '02_08_02 (1)', 0, 65, 388, 287, 520],
  ['tray', '02_08_02 (1)', 776, 142, 338, 201, 440],
  ['wood-block', '02_08_02 (1)', 1214, 647, 212, 190, 180],
  ['nut', '02_08_02 (1)', 39, 662, 197, 183, 180],
  ['book', '02_08_02 (1)', 526, 630, 292, 222, 180],
  ['apple', '02_08_02 (1)', 900, 370, 246, 259, 180],
  ['eraser', '02_08_02 (1)', 342, 399, 210, 211, 180],
  ['rock', '02_08_22 (1)', 776, 591, 164, 164, 180],
  ['balance-pan', '02_08_22 (1)', 43, 354, 448, 197, 400],
  ['balance-base', '02_08_22 (1)', 545, 352, 353, 216, 320],
  ['balance-beam', '02_08_22 (1)', 445, 128, 163, 51, 320],
  ['crate-empty', '02_08_41 (1)', 24, 117, 457, 373, 480],
  ['cargo-metal', '02_08_41 (1)', 1100, 529, 337, 215, 180],
  ['student-idle', '02_08_03 (3)', 47, 0, 294, 435, 220],
  ['student-effort', '02_08_03 (3)', 392, 8, 331, 425, 220],
  ['student-observe', '02_08_03 (3)', 726, 42, 364, 387, 220],
  ['student-success', '02_08_03 (3)', 1110, 0, 329, 437, 220],
  ['corgi-idle', '02_08_03 (3)', 41, 440, 306, 307, 190],
  ['corgi-effort', '02_08_03 (3)', 388, 428, 341, 319, 190],
  ['corgi-observe', '02_08_03 (3)', 1121, 438, 325, 310, 190],
  ['corgi-success', '02_08_03 (3)', 760, 430, 337, 326, 190],
];
const manifest = [];
for (const [name, source, left, top, width, height, targetWidth] of crops) {
  const sourceName = `ChatGPT Image 2026년 9월 22일 오후 ${source}.png`;
  const output = await sharp(resolve(root, 'references/images', sourceName))
    .extract({ left, top, width, height })
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toFile(resolve(destination, `${name}.webp`));
  manifest.push({ name, source: sourceName, crop: { left, top, width, height }, width: output.width, height: output.height, bytes: output.size });
}
await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${manifest.length} existing-image crops: ${manifest.reduce((sum, item) => sum + item.bytes, 0)} bytes`);
