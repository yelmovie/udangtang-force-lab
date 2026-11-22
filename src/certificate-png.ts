// 인증서 PNG 저장: 화면의 인증서 종이(.cert-paper)를 그대로 캔버스에 옮겨 그린다(새 의존성 없음).
// 테두리 그림 → 상자(배경·테두리·둥근 모서리) → 글자를 줄 단위로, 화면에서 잰 위치에 비례해 놓는다.
const LONG_SIDE = 2400;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

// 글자 한 덩어리(텍스트 노드)를 화면 줄바꿈 그대로 줄마다 나눈다.
function lines(node: Text): {text: string; rect: DOMRect}[] {
  const out: {text: string; rect: DOMRect}[] = []; const range = document.createRange(); const value = node.data;
  let cur = '', top = NaN, left = 0, right = 0, bottom = 0, ctop = 0;
  for (let i = 0; i < value.length; i++) {
    range.setStart(node, i); range.setEnd(node, i + 1); const r = range.getClientRects()[0];
    if (!r) continue;
    if (!Number.isNaN(top) && Math.abs(r.top - top) > r.height / 2) { out.push({text: cur, rect: new DOMRect(left, ctop, right - left, bottom - ctop)}); cur = ''; top = NaN; }
    if (Number.isNaN(top)) { top = r.top; ctop = r.top; left = r.left; bottom = r.bottom; }
    cur += value[i]; right = r.right; bottom = Math.max(bottom, r.bottom);
  }
  if (cur.trim()) out.push({text: cur, rect: new DOMRect(left, ctop, right - left, bottom - ctop)});
  return out.filter(l => l.text.trim());
}

export async function drawCertificate(paper: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  for (const animation of paper.getAnimations({ subtree: true })) animation.finish();
  const box = paper.getBoundingClientRect(); const scale = LONG_SIDE / box.width;
  const canvas = document.createElement('canvas'); canvas.width = LONG_SIDE; canvas.height = Math.round(box.height * scale);
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const X = (v: number) => (v - box.left) * scale, Y = (v: number) => (v - box.top) * scale;
  const frame = paper.querySelector<HTMLImageElement>('.cert-frame');
  if (frame?.src) { const img = await loadImage(frame.src); const r = frame.getBoundingClientRect(); ctx.drawImage(img, X(r.left), Y(r.top), r.width * scale, r.height * scale); }
  // 상자: 배경색·테두리가 있는 요소(성취 배지, 도장, 이름 밑줄 등)
  for (const el of paper.querySelectorAll<HTMLElement>('.cert-content *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const radius = (cs.borderTopLeftRadius.endsWith('%') ? Math.min(r.width, r.height) * parseFloat(cs.borderTopLeftRadius) / 100 : parseFloat(cs.borderTopLeftRadius)) * scale || 0;
    const bg = cs.backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { ctx.fillStyle = bg; roundRect(ctx, X(r.left), Y(r.top), r.width * scale, r.height * scale, radius); ctx.fill(); }
    const bw = parseFloat(cs.borderTopWidth); if (bw > 0 && cs.borderTopStyle !== 'none') { ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = bw * scale; roundRect(ctx, X(r.left) + bw * scale / 2, Y(r.top) + bw * scale / 2, (r.width - bw) * scale, (r.height - bw) * scale, radius); ctx.stroke(); }
    else { const bb = parseFloat(cs.borderBottomWidth); if (bb > 0 && cs.borderBottomStyle !== 'none') { ctx.fillStyle = cs.borderBottomColor; ctx.fillRect(X(r.left), Y(r.bottom) - bb * scale, r.width * scale, bb * scale); } }
  }
  // 글자: 화면에서 잰 줄 위치에 같은 글꼴·크기·색으로
  const walker = document.createTreeWalker(paper.querySelector('.cert-content')!, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const el = n.parentElement!; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`; ctx.fillStyle = cs.color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const spacing = parseFloat(cs.letterSpacing) || 0;
    for (const line of lines(n)) {
      const y = Y(line.rect.top + line.rect.height / 2);
      if (spacing) { let x = X(line.rect.left); for (const ch of line.text) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing * scale; } }
      else ctx.fillText(line.text, X(line.rect.left), y, line.rect.width * scale + 2);
    }
  }
  return canvas;
}

export async function saveCertificatePng(paper: HTMLElement, filename: string) {
  const canvas = await drawCertificate(paper);
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png');
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
