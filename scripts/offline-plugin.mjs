import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

export function offlinePlugin() {
  let outputDirectory;
  let built = false;
  return {
    name: 'force-lab-offline',
    apply: 'build',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir); },
    buildStart() { built = false; },
    generateBundle() { built = true; },
    async closeBundle() {
      if (!built) return;
      const paths = (await filesIn(outputDirectory))
        .filter(path => /\.(?:html|css|js|json|webmanifest|webp|png|ogg|svg|woff2?|glb)$/i.test(path) && !path.endsWith(`${sep}sw.js`)).sort();
      const hash = createHash('sha256');
      const urls = [];
      for (const path of paths) {
        const name = relative(outputDirectory, path).split(sep).join('/');
        hash.update(name).update(await readFile(path));
        urls.push(name);
      }
      const version = hash.digest('hex').slice(0, 16);
      // First-screen set only: everything else is cached the first time a screen asks for it.
      const core = urls.filter(name => /^(?:index\.html|manifest\.webmanifest|favicon\.svg|icons\/.*|assets\/index-[^/]+\.(?:js|css)|assets\/fonts\/.*\.woff2|assets\/ui\/title\.webp|assets\/backgrounds\/lab\.webp|assets\/characters\/.*\.webp)$/.test(name));
      const runtimePattern = '/\\.(?:html|css|js|json|webmanifest|webp|png|ogg|svg|woff2?|glb)$/i';
      const code = `// Generated from this production build. Do not edit by hand.
const ROOT = new URL('./', self.location.href);
const PREFIX = 'udangtang-force-lab:' + ROOT.href + ':';
const CACHE = PREFIX + '${version}';
const CORE = ${JSON.stringify(core)}.map(file => new URL(file, ROOT).href);
const ALLOWED = new Set(${JSON.stringify(urls)}.map(file => new URL(file, ROOT).href));
const RUNTIME = ${runtimePattern};
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(CORE.map(url => new Request(url, {cache: 'reload'}))); }
    catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin) return;
  const isStart = request.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + 'index.html');
  const lookup = isStart ? new URL('index.html', ROOT).href : url.origin + url.pathname;
  // Only files that exist in this build are cached, so a stale URL never shadows a newer deploy.
  if (!ALLOWED.has(lookup) || !RUNTIME.test(lookup)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(lookup);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') void cache.put(lookup, response.clone()).catch(() => {});
    return response;
  })());
});
`;
      await writeFile(join(outputDirectory, 'sw.js'), code);
      console.log(`Offline precache: ${core.length} of ${urls.length} files; ${version}`);
    },
  };
}
