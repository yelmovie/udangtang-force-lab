import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'public', 'assets', 'characters');
await mkdir(destination, { recursive: true });

const selected = [
  ['ChatGPT Image 2026년 9월 22일 오후 03_26_49 (3).png', 'student_poses.webp'],
  ['ChatGPT Image 2026년 9월 22일 오후 03_26_48 (1).png', 'corgi_poses.webp'],
  ['ChatGPT Image 2026년 9월 22일 오후 03_26_48 (2).png', 'squirrel_poses.webp'],
];

for (const [source, target] of selected) {
  const result = await sharp(resolve(root, 'references/images', source)).webp({ quality: 86, effort: 6 }).toFile(resolve(destination, target));
  process.stdout.write(`${target}: ${(result.size / 1024).toFixed(0)} KiB\n`);
}

const backgrounds = [
  ['02_09_04 (1)', 'lab'], ['02_09_35 (2)', 'islands'],
  ['02_09_37 (3)', 'cargo'], ['02_09_39 (5)', 'balance'],
  ['02_09_40 (7)', 'scale'], ['02_09_41 (9)', 'workshop'],
  ['02_09_42 (10)', 'core'],
];
await mkdir(resolve(root, 'public/assets/ui'), { recursive: true });
await sharp(resolve(root, 'references/images/ChatGPT Image 2026년 9월 22일 오후 02_09_24 (2).png'))
  .resize({ width: 1000 }).webp({ quality: 86 }).toFile(resolve(root, 'public/assets/ui/title.webp'));
await mkdir(resolve(root, 'public/assets/props'), { recursive: true });
const propSheet = resolve(root, 'references/images/ChatGPT Image 2026년 9월 22일 오후 02_07_38 (1).png');
for (const [name, region] of [
  ['core-cargo', { left: 20, top: 5, width: 545, height: 455 }],
  ['wood-crate', { left: 580, top: 135, width: 330, height: 310 }],
]) {
  await sharp(propSheet).extract(region).resize({ width: 320 }).webp({ quality: 86 }).toFile(resolve(root, 'public/assets/props', `${name}.webp`));
}
await mkdir(resolve(root, 'public/assets/backgrounds'), { recursive: true });
for (const [source, name] of backgrounds) {
  const result = await sharp(resolve(root, 'references/images', `ChatGPT Image 2026년 9월 22일 오후 ${source}.png`))
    .resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 82, effort: 5 })
    .toFile(resolve(root, 'public/assets/backgrounds', `${name}.webp`));
  console.log(`${name}.webp: ${Math.round(result.size / 1024)} KiB`);
}
