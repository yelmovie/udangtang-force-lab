import sharp from 'sharp';
import fs from 'node:fs/promises';
// Rebuild runtime assets from source art stored in this project on D:.
await fs.mkdir('public/assets/story', { recursive: true });
for (const group of ['intro', 'final']) {
  for (let index = 1; index <= 3; index++) {
    const name = `${group}-0${index}`;
    await sharp(`references/video/20261012/${name}.png`)
      .resize(1280, 720, { fit: 'cover' }).webp({ quality: 86 })
      .toFile(`public/assets/story/${name}.webp`);
  }
}
const atlas = 'references/animations/lever-press-atlas.png';
const { width, height } = await sharp(atlas).metadata();
const cellWidth = Math.floor(width / 2), cellHeight = Math.floor(height / 2);
for (let index = 0; index < 4; index++) {
  let frame = await sharp(atlas).extract({
    left: index % 2 * cellWidth, top: Math.floor(index / 2) * cellHeight,
    width: cellWidth, height: cellHeight,
  }).png().toBuffer();
  // Align the lower pair's feet with those in the first pair.
  if (index >= 2) frame = await sharp(frame)
    .extend({ top: 21, bottom: 0, left: 0, right: 0, background: '#00000000' })
    .png().toBuffer();
  await sharp(frame).extract({ left: 0, top: 0, width: cellWidth, height: cellHeight })
    .webp({ lossless: true }).toFile(`public/assets/game/workshop-lever-press-${index}.webp`);
}
await sharp('references/animations/lever-press-low.png').resize(cellWidth,cellHeight)
  .webp({lossless:true}).toFile('public/assets/game/workshop-lever-press-4.webp');
