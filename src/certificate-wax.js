// Shared certificate finishing, 2026-11-23. The supplied wax artwork stays raster;
// project-specific wording remains live text and is also drawn by the PNG exporter.
const controllers = new WeakMap();
const CSS = `
html body [data-cert-wax]{position:relative!important;display:block!important;flex:0 0 var(--cert-wax-size,9.4cqw)!important;width:var(--cert-wax-size,9.4cqw)!important;height:var(--cert-wax-size,9.4cqw)!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;transform:none!important;animation:none!important;isolation:isolate;color:#ffe4a4!important}
html body [data-cert-wax] .cert-wax-art{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:contain!important;pointer-events:none;filter:drop-shadow(0 .24cqw .2cqw #43271355);transform-origin:50% 62%}
html body [data-cert-wax] .cert-wax-label{position:absolute!important;left:19%!important;top:52%!important;display:block!important;width:62%!important;margin:0!important;padding:0!important;font-family:inherit!important;font-size:var(--cert-wax-font,.96cqw)!important;line-height:1.2!important;font-weight:900!important;letter-spacing:-.03em!important;text-align:center!important;color:#ffdfa0!important;text-shadow:0 1px 0 #70401a,0 -1px 0 #fff1c04d!important;-webkit-text-stroke:0!important;white-space:normal!important;word-break:keep-all!important;transform-origin:50% 35%;z-index:1}
html body [data-cert-wax] .cert-wax-press{position:absolute!important;left:9%!important;bottom:43%!important;width:82%!important;height:150%!important;display:block!important;opacity:0;pointer-events:none;z-index:3;transform-origin:50% 100%;filter:drop-shadow(0 .35cqw .22cqw #24140855)}
.cert-wax-press i{position:absolute;display:block;box-sizing:border-box}
.cert-wax-handle{left:29%;top:0;width:42%;height:62%;border-radius:46% 46% 24% 24%;background:linear-gradient(90deg,#45241b 0%,#985439 23%,#c38458 40%,#6b3527 70%,#311b17 100%);box-shadow:inset 1px 0 0 #e9a56b55,inset -1px 0 0 #150b0b80}
.cert-wax-neck{left:41%;top:53%;width:18%;height:24%;border-radius:12%;background:linear-gradient(90deg,#956124,#ffe49b 36%,#d5a144 66%,#7b4b18)}
.cert-wax-foot{left:3%;bottom:0;width:94%;height:28%;border-radius:32% 32% 22% 22%;background:linear-gradient(#ffefbb 0%,#b88434 15%,#f0ce80 25%,#ab722b 71%,#634316 95%);box-shadow:inset 0 -2px 0 #513416,inset 1px 0 0 #fff5bd}
html body [data-cert-wax] .cert-wax-impact{position:absolute;inset:3%;display:block;border:2px solid #edc66c;border-radius:50%;opacity:0;pointer-events:none}
html body [data-cert-wax-paper][data-cert-wax-motion="playing"] .cert-wax-press{animation:cert-wax-press 920ms cubic-bezier(.2,.7,.3,1) both}
html body [data-cert-wax-paper][data-cert-wax-motion="playing"] .cert-wax-art,html body [data-cert-wax-paper][data-cert-wax-motion="playing"] .cert-wax-label{animation:cert-wax-imprint 920ms linear both}
html body [data-cert-wax-paper][data-cert-wax-motion="playing"] .cert-wax-impact{animation:cert-wax-impact 280ms ease-out 420ms both}
html body [data-cert-wax-paper][data-cert-wax-motion="playing"] .cert-content{animation:cert-wax-paper-tap 180ms ease-out 420ms both}
@keyframes cert-wax-press{0%,13%{opacity:0;transform:translateY(-125%) rotate(-9deg) scale(1.08)}26%{opacity:1;transform:translateY(-95%) rotate(-5deg) scale(1.05)}45%{opacity:1;transform:translateY(0) rotate(0) scale(1)}49%{opacity:1;transform:translateY(3%) scale(1.015,.97)}60%{opacity:1;transform:translateY(0) scale(1)}86%,100%{opacity:0;transform:translateY(-108%) rotate(5deg) scale(1.03)}}
@keyframes cert-wax-imprint{0%,42%{opacity:0;transform:scale(1.08)}46%{opacity:1;transform:scale(1.08,.87)}57%{opacity:1;transform:scale(.97,1.04)}76%,100%{opacity:1;transform:scale(1)}}
@keyframes cert-wax-impact{from{opacity:.6;transform:scale(.86)}to{opacity:0;transform:scale(1.3)}}
@keyframes cert-wax-paper-tap{0%,100%{transform:translateY(0)}25%{transform:translateY(3px)}52%{transform:translateY(-1.5px)}76%{transform:translateY(.5px)}}
@media(prefers-reduced-motion:reduce){html body [data-cert-wax-paper] .cert-wax-press,html body [data-cert-wax-paper] .cert-wax-impact{display:none!important}html body [data-cert-wax-paper] .cert-wax-art,html body [data-cert-wax-paper] .cert-wax-label,html body [data-cert-wax-paper] .cert-content{animation:none!important;opacity:1!important;transform:none!important}}
@media print{html body [data-cert-wax-paper],html body [data-cert-wax-paper] .cert-content,html body [data-cert-wax-paper] .cert-wax-art,html body [data-cert-wax-paper] .cert-wax-label{animation:none!important;opacity:1!important;transform:none!important}html body [data-cert-wax-paper] .cert-wax-press,html body [data-cert-wax-paper] .cert-wax-impact{display:none!important}html body [data-cert-wax]{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;

/** @param {HTMLElement} paper @param {{label?:string,onImpact?:()=>void,reduced?:boolean,selector?:string,art?:string}} options */
export function mountCertificateWax(paper, options = {}) {
  controllers.get(paper)?.();
  const doc = paper.ownerDocument;
  if (!doc.querySelector('style[data-certificate-wax-style]')) {
    const style = doc.createElement('style'); style.dataset.certificateWaxStyle = ''; style.textContent = CSS; doc.head.append(style);
  }
  const seal = paper.querySelector(options.selector || '.cert-stamp');
  if (!seal) return () => {};
  const oldLabel = seal.querySelector('strong');
  const label = options.label || oldLabel?.innerText?.trim() || '탐구 완료\n인증';
  seal.replaceChildren(); seal.setAttribute('data-cert-wax', ''); seal.setAttribute('role', 'img'); seal.setAttribute('aria-label', label.replace(/\n/g, ' ') + ' 도장');
  const art = doc.createElement('img'); art.className = 'cert-wax-art'; art.src = options.art || 'assets/ui/certificate-wax-seal-20261123.webp'; art.alt = ''; art.setAttribute('aria-hidden', 'true'); art.draggable = false; seal.append(art);
  const text = doc.createElement('strong'); text.className = 'cert-wax-label'; text.setAttribute('aria-hidden', 'true');
  label.split('\n').forEach((line, i) => { if (i) text.append(doc.createElement('br')); text.append(doc.createTextNode(line)); }); seal.append(text);
  const press = doc.createElement('span'); press.className = 'cert-wax-press'; press.setAttribute('aria-hidden', 'true'); press.dataset.certExportIgnore = '';
  press.innerHTML = '<i class="cert-wax-handle"></i><i class="cert-wax-neck"></i><i class="cert-wax-foot"></i>'; seal.append(press);
  const ring = doc.createElement('span'); ring.className = 'cert-wax-impact'; ring.setAttribute('aria-hidden', 'true'); ring.dataset.certExportIgnore = ''; seal.append(ring);
  paper.dataset.certWaxPaper = '';
  let finished = false, startFrame = 0, impactTimer = 0, endTimer = 0;
  const finish = () => {
    if (finished) return; finished = true;
    cancelAnimationFrame(startFrame); clearTimeout(impactTimer); clearTimeout(endTimer);
    paper.dataset.certWaxMotion = 'finished';
    doc.defaultView?.removeEventListener('beforeprint', finish);
    dialog?.removeEventListener('close', finish);
    observer.disconnect(); controllers.delete(paper);
  };
  const dialog = paper.closest('dialog');
  const observer = new MutationObserver(() => { if (!paper.isConnected) finish(); });
  controllers.set(paper, finish);
  doc.defaultView?.addEventListener('beforeprint', finish);
  dialog?.addEventListener('close', finish, {once:true});
  observer.observe(doc.body, {childList:true, subtree:true});
  const reduced = options.reduced || doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
  paper.dataset.certWaxMotion = 'finished';
  if (reduced) { finish(); return finish; }
  startFrame = requestAnimationFrame(() => {
    if (!paper.isConnected) { finish(); return; }
    paper.dataset.certWaxMotion = 'playing';
    impactTimer = setTimeout(() => {
      if (paper.isConnected && !doc.hidden && (!dialog || dialog.open)) { try { options.onImpact?.(); } catch { /* Audio never blocks certificate output. */ } }
    }, 420);
    endTimer = setTimeout(finish, 950);
  });
  return finish;
}

/** Settle before measuring or exporting; exporting must never replay the impact. */
export function finishCertificateWax(paper) {
  controllers.get(paper)?.();
  if (paper.hasAttribute('data-cert-wax-paper')) paper.dataset.certWaxMotion = 'finished';
}
