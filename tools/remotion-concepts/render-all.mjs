// 개념 클립 5개를 한 번에 렌더한다: WebM(VP9)·MP4(H.264)·포스터(마지막 프레임 WebP).
// 사용: npm run render            (전부)
//       npm run render -- cargo   (하나만)
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const out = resolve('../../public/assets/concepts');
const clips = { cargo: 7, balance: 7, scale: 7, workshop: 8, rescue: 7 };
const only = process.argv.slice(2);
// 번들은 앱 폴더 밖(임시 폴더)에 만든다. 앱 개발 서버의 파일 감시가 폴더를 붙잡아 다시 만들지 못하는 일을 피한다.
const bundle = join(tmpdir(), 'udangtang-remotion-bundle');
const run = args => {
  const result = spawnSync(['npx remotion', ...args.map(a => JSON.stringify(a))].join(' '), { stdio: 'inherit', shell: true });
  if (result.status !== 0) throw new Error(`remotion ${args.join(' ')} 실패`);
};
mkdirSync(out, { recursive: true });
run(['bundle', 'src/index.ts', `--out-dir=${bundle}`]);
for (const [id, seconds] of Object.entries(clips)) {
  if (only.length && !only.includes(id)) continue;
  run(['render', bundle, id, join(out, `${id}.webm`), '--codec=vp9', '--crf=28', '--muted', '--overwrite']);
  run(['render', bundle, id, join(out, `${id}.mp4`), '--codec=h264', '--crf=23', '--muted', '--overwrite']);
  run(['still', bundle, id, join(out, `${id}.webp`), `--frame=${seconds * 30 - 1}`, '--image-format=webp', '--quality=82', '--overwrite']);
  for (const ext of ['webm', 'mp4', 'webp']) console.log(`${id}.${ext}  ${(statSync(join(out, `${id}.${ext}`)).size / 1024).toFixed(0)} KB`);
}
