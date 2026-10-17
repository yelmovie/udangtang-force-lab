import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// Review-only output. Never resize, trim, remove a background, or write to public/.
const packRoot = resolve(import.meta.dirname, '../references/pixel-village-v1');
const rawRoot = resolve(packRoot, 'raw');
const outputRoot = resolve(packRoot, 'prepared');
const directions = ['down', 'left', 'right', 'up'];
const buildings = ['cargo', 'balance', 'scale', 'workshop', 'core', 'empty'];
const specs = [
  { file: 'terrain.png', columns: 1, rows: 1, names: ['terrain'], alphaExpected: false },
  { file: 'buildings.png', columns: 3, rows: 2, names: buildings.map(name => `buildings/${name}`), alphaExpected: true },
  ...['student', 'corgi'].map(name => ({ file: `${name}-walk.png`, columns: 4, rows: 4,
    names: directions.flatMap(direction => Array.from({ length: 4 }, (_, index) => `${name}/${direction}-${index + 1}`)), alphaExpected: true })),
  ...buildings.slice(0, 5).map(name => ({ file: `interior-${name}.png`, columns: 1, rows: 1, names: [`interiors/${name}`], alphaExpected: false })),
  { file: 'props.png', columns: 4, rows: 3, names: Array.from({ length: 12 }, (_, index) => `props/prop-${String(index + 1).padStart(2, '0')}`), alphaExpected: true },
  { file: 'npc-guide.png', columns: 2, rows: 2, names: ['npc/guide', 'npc/wave', 'npc/think', 'npc/point'], alphaExpected: true },
];
const expectedOutputs = specs.reduce((sum, spec) => sum + spec.names.length, 0);
const manifest = { schemaVersion: 3, generatedAt: new Date().toISOString(), reviewStatus: 'UNVERIFIED',
  policy: 'Extract full grid cells without trim/resize/background removal. Lossless WebP. Not approved for production.',
  sources: [], outputs: [], warnings: [], errors: [] };
await mkdir(outputRoot, { recursive: true });
for (const spec of specs) {
  try {
    const buffer = await readFile(resolve(rawRoot, spec.file));
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;
    if (!width || !height) throw new Error('픽셀 크기를 읽을 수 없습니다.');
    if (width < spec.columns || height < spec.rows) throw new Error('시트 크기가 칸 수보다 작습니다.');
    const xBounds = Array.from({ length: spec.columns + 1 }, (_, i) => Math.floor(i * width / spec.columns));
    const yBounds = Array.from({ length: spec.rows + 1 }, (_, i) => Math.floor(i * height / spec.rows));
    const cellWidths = xBounds.slice(1).map((edge, i) => edge - xBounds[i]);
    const cellHeights = yBounds.slice(1).map((edge, i) => edge - yBounds[i]);
    const stats = await sharp(buffer).stats();
    const pixels = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const opaque = !metadata.hasAlpha || stats.isOpaque;
    const source = { file: `raw/${spec.file}`, width, height, columns: spec.columns, rows: spec.rows,
      xBounds, yBounds, cellWidths, cellHeights, variableCellSize: width % spec.columns !== 0 || height % spec.rows !== 0,
      hasAlpha: !!metadata.hasAlpha, opaque,
      sha256: createHash('sha256').update(buffer).digest('hex') };
    manifest.sources.push(source);
    if (source.variableCellSize) manifest.warnings.push(`${spec.file}: floor 경계 분할, 칸 너비 ${cellWidths.join('/')}px·높이 ${cellHeights.join('/')}px. 원본 픽셀을 빠짐없이 보존했습니다.`);
    if (spec.alphaExpected && opaque) manifest.warnings.push(`${spec.file}: 투명 배경을 기대했지만 완전 불투명합니다. 배경을 임의 제거하지 않았습니다.`);
    if (metadata.orientation && metadata.orientation !== 1) manifest.warnings.push(`${spec.file}: 방향 메타데이터 ${metadata.orientation}. 자동 회전 없이 원시 픽셀 좌표를 사용했습니다.`);
    for (let index = 0; index < spec.names.length; index++) {
      const row = Math.floor(index / spec.columns);
      const column = index % spec.columns;
      const crop = { left: xBounds[column], top: yBounds[row], width: cellWidths[column], height: cellHeights[row] };
      let minX = crop.width, minY = crop.height, maxX = -1, maxY = -1;
      for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
        const alphaIndex = ((crop.top + y) * pixels.info.width + crop.left + x) * pixels.info.channels + pixels.info.channels - 1;
        if (pixels.data[alphaIndex] < 128) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      const alphaBounds = maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      const pivot = alphaBounds ? { x: minX + alphaBounds.width / 2, y: maxY + 1 } : { x: crop.width / 2, y: crop.height };
      const relativeOutput = `${spec.names[index]}.webp`;
      const destination = resolve(outputRoot, relativeOutput);
      await mkdir(dirname(destination), { recursive: true });
      const result = await sharp(buffer).extract(crop).webp({ lossless: true, effort: 6 }).toFile(destination);
      if (!alphaBounds) manifest.warnings.push(`${relativeOutput}: alpha >= 128인 픽셀이 없어 셀 아래쪽 중심을 임시 기준점으로 기록했습니다.`);
      manifest.outputs.push({ source: source.file, file: relativeOutput, index, row, column, crop, width: result.width, height: result.height, bytes: result.size, alphaThreshold: 128, alphaBounds, pivot });
    }
  } catch (error) {
    const message = `${spec.file}: ${error.code === 'ENOENT' ? '원본이 아직 없습니다.' : error.message}`;
    if (error.code === 'ENOENT') manifest.warnings.push(message);
    else manifest.errors.push(message);
  }
}
manifest.complete = manifest.sources.length === specs.length && manifest.errors.length === 0 && manifest.outputs.length === expectedOutputs;
await writeFile(resolve(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`검토용 추출 ${manifest.outputs.length}/${expectedOutputs}개, 원본 ${manifest.sources.length}/${specs.length}개. 좌표·접지·프레임 연속성은 시각 검증이 필요합니다.`);
for (const warning of manifest.warnings) console.warn(`주의: ${warning}`);
for (const error of manifest.errors) console.error(`오류: ${error}`);
if (manifest.errors.length) process.exitCode = 1;
