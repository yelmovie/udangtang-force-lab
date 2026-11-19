// Cloudflare static assets answer a Range request with the whole file (200). Browsers then cannot seek
// (Chrome reports seekable [0,0], so scene buttons jump to 0) and iPad Safari will not play an mp4 at all.
// Video requests come through here and get 206 slices. Files are under 10 MB, so buffering is fine.
const VIDEO = /\.(mp4|webm|m4v)$/i;

export async function mediaRange(request, assets) {
  if (!VIDEO.test(new URL(request.url).pathname) || !['GET', 'HEAD'].includes(request.method)) {
    return assets.fetch(request);
  }
  const assetHeaders = new Headers(request.headers);
  assetHeaders.delete('Range');
  assetHeaders.delete('If-Range');
  assetHeaders.set('Accept-Encoding', 'identity');
  const asset = await assets.fetch(new Request(request.url, { method: 'GET', headers: assetHeaders }));
  // Missing files may come back as the SPA's index.html; never slice anything that is not a video.
  if (asset.status !== 200 || !/^video\//.test(asset.headers.get('Content-Type') || '')) {
    return request.method === 'HEAD' ? new Response(null, asset) : asset;
  }

  const bytes = await asset.arrayBuffer();
  const size = bytes.byteLength;
  const headers = new Headers(asset.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(size));

  const validator = request.headers.get('If-Range');
  const fresh = !validator || (!validator.startsWith('W/')
    && (validator === headers.get('ETag') || validator === headers.get('Last-Modified')));
  const range = fresh && /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!range || (!range[1] && !range[2])) {
    return new Response(request.method === 'HEAD' ? null : bytes, { headers });
  }

  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end || (!range[1] && Number(range[2]) === 0)) {
    headers.set('Content-Range', `bytes */${size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : bytes.slice(start, end + 1), { status: 206, headers });
}

export default { fetch: (request, env) => mediaRange(request, env.ASSETS) };
