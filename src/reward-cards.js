// Achievement cards for defeated map villains: a spinning reveal in the middle of the screen,
// then the card flies into one of five slots beside the top-right sound button.
// Shared by the science projects; each project passes its own cards, colours and particle shapes.
// No dependencies. Ownership is never stored here: the caller derives it from its own save.

const RARITY = [
  { key: 'bronze', label: '브론즈' },
  { key: 'silver', label: '실버' },
  { key: 'gold', label: '골드' },
  { key: 'holo', label: '홀로' },
  { key: 'legend', label: '레전드' },
];

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {object} config
 * @param {string} config.setName      Collection name, e.g. '힘 실험실 성취 카드'
 * @param {{id:string,title:string,stage:string,art:string,thumb?:string,rarity?:number,bonus?:boolean}[]} config.cards  Cards in stage order (five; a sixth boss card sets `bonus`). `rarity` 0-4 defaults to the position.
 * @param {{accent:string,accent2:string,glow:string,ink?:string,back?:string}} config.theme
 * @param {string[]} config.particles  Shapes: star, spark, circle, gear, bolt, drop, leaf, note, petal, snow, bubble, heart
 * @param {string[]} config.colors     Particle colours.
 * @param {string} [config.emblem]     Inline SVG for the card back.
 * @param {(name:'whoosh'|'reveal'|'epic'|'slot'|'complete')=>void} [config.sound]
 * @param {()=>HTMLElement|null} [config.inertRoot]  Made inert while a card is open (pauses the map).
 */
export function createRewardCards(config) {
  const cards = config.cards;
  const total = cards.length;
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound = name => { try { config.sound?.(name); } catch { /* Sound must never break the reward. */ } };
  const themeStyle = () => {
    const t = config.theme;
    return `--rc-accent:${t.accent};--rc-accent2:${t.accent2};--rc-glow:${t.glow};--rc-ink:${t.ink ?? '#1d2b33'};--rc-back:${t.back ?? t.accent2}`;
  };
  const rarityOf = index => RARITY[Math.max(0, Math.min(RARITY.length - 1, cards[index]?.rarity ?? index))];
  const starsOf = index => RARITY.indexOf(rarityOf(index)) + 1;
  let owned = cards.map(() => false);
  let busy = false;
  const queue = [];

  // ---------- header slots ----------
  function slotsHtml(ownedList) {
    owned = cards.map((_, i) => !!ownedList[i]);
    const count = owned.filter(Boolean).length;
    const slots = cards.map((card, i) => `<span class="rc-slot${owned[i] ? ' is-filled' : ''}${card.bonus ? ' is-bonus' : ''}" data-rarity="${rarityOf(i).key}" data-reward-slot="${i}">${owned[i] ? `<img src="${esc(card.thumb ?? card.art)}" alt="" draggable="false">` : `<i aria-hidden="true">${card.bonus ? '★' : '?'}</i>`}</span>`).join('');
    return `<button type="button" class="rc-slots${count === total ? ' is-complete' : ''}" data-reward-album style="${themeStyle()}" aria-label="${esc(config.setName)} ${count}/${total}장, 카드 보관함 열기" title="성취 카드 ${count}/${total}">${slots}</button>`;
  }
  function syncSlots(ownedList, popIndex) {
    owned = cards.map((_, i) => !!ownedList[i]);
    document.querySelectorAll('[data-reward-album]').forEach(button => {
      const count = owned.filter(Boolean).length;
      button.classList.toggle('is-complete', count === total);
      button.setAttribute('aria-label', `${config.setName} ${count}/${total}장, 카드 보관함 열기`);
      button.title = `성취 카드 ${count}/${total}`;
      button.querySelectorAll('[data-reward-slot]').forEach(slot => {
        const i = Number(slot.dataset.rewardSlot);
        if (owned[i] && !slot.classList.contains('is-filled')) {
          slot.classList.add('is-filled');
          slot.innerHTML = `<img src="${esc(cards[i].thumb ?? cards[i].art)}" alt="" draggable="false">`;
        }
        if (i === popIndex) { slot.classList.remove('is-new'); void slot.offsetWidth; slot.classList.add('is-new'); }
      });
    });
  }
  const visibleSlot = index => [...document.querySelectorAll(`[data-reward-slot="${index}"]`)].find(el => el.getClientRects().length && el.offsetParent !== null);

  // ---------- card markup ----------
  function cardHtml(index, extraClass = '') {
    const card = cards[index];
    const rarity = rarityOf(index);
    const stars = Array.from({ length: starsOf(index) }, (_, s) => `<b style="--s:${s}">★</b>`).join('');
    return `<div class="rc-card ${extraClass}" data-rarity="${rarity.key}">
      <div class="rc-face rc-front">
        <div class="rc-art"><img src="${esc(card.art)}" alt="" draggable="false"></div>
        <div class="rc-shine" aria-hidden="true"></div>
        <div class="rc-top"><span class="rc-stars" aria-label="별 ${starsOf(index)}개">${stars}</span><span class="rc-rarity">${card.bonus ? '보너스' : rarity.label}</span></div>
        <div class="rc-plate"><strong>${esc(card.title)}</strong><span>${esc(card.stage)} · ${index + 1}/${total}</span></div>
      </div>
      <div class="rc-face rc-back" aria-hidden="true"><div class="rc-emblem">${config.emblem ?? '★'}</div></div>
    </div>`;
  }

  // ---------- particles ----------
  function particleField(layer) {
    const canvas = document.createElement('canvas');
    canvas.className = 'rc-particles';
    layer.append(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize();
    addEventListener('resize', resize);
    let bits = [];
    let raf = 0;
    let last = performance.now();
    const shapes = config.particles?.length ? config.particles : ['star', 'spark', 'circle'];
    const colors = config.colors?.length ? config.colors : ['#ffd75e', '#ffffff'];
    function burst(x, y, count, power = 1) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (260 + Math.random() * 520) * power;
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180 * power, r: 6 + Math.random() * 10, rot: Math.random() * 6, vr: (Math.random() - .5) * 10, life: 1.4 + Math.random() * 1.2, age: 0, shape: shapes[i % shapes.length], color: colors[(i * 7 + 3) % colors.length] });
      }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function rain(count) {
      for (let i = 0; i < count; i++) bits.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6, vx: (Math.random() - .5) * 60, vy: 120 + Math.random() * 160, r: 6 + Math.random() * 9, rot: Math.random() * 6, vr: (Math.random() - .5) * 6, life: 3.4 + Math.random(), age: 0, shape: shapes[i % shapes.length], color: colors[i % colors.length], fall: true });
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function tick(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits = bits.filter(b => (b.age += dt) < b.life);
      for (const b of bits) {
        if (!b.fall) { b.vx *= 1 - 1.6 * dt; b.vy = b.vy * (1 - 1.6 * dt) + 520 * dt; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (b.life - b.age) * 1.8));
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        drawShape(ctx, b.shape, b.r, b.color);
        ctx.restore();
      }
      raf = bits.length ? requestAnimationFrame(tick) : 0;
    }
    return { burst, rain, stop() { cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', resize); } };
  }

  // ---------- reveal ----------
  /** Shows the card for `index`. `origin` is the defeated villain's position in client pixels. Resolves when the card sits in its slot. */
  function reveal(index, origin, ownedAfter) {
    return new Promise(resolve => {
      queue.push({ index, origin, ownedAfter, resolve });
      if (!busy) void next();
    });
  }
  async function next() {
    const job = queue.shift();
    if (!job) { busy = false; return; }
    busy = true;
    await play(job.index, job.origin, job.ownedAfter);
    job.resolve();
    void next();
  }

  async function play(index, origin, ownedAfter) {
    const rm = reduced();
    const root = config.inertRoot?.() ?? null;
    const focusBefore = document.activeElement;
    const layer = document.createElement('div');
    layer.className = 'rc-layer';
    layer.style.cssText = themeStyle();
    layer.dataset.rarity = rarityOf(index).key;
    const tier = starsOf(index) - 1; // 0-4: how big the reveal is
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', `새 성취 카드: ${cards[index].title}`);
    layer.innerHTML = `<div class="rc-scrim"></div><div class="rc-rays" aria-hidden="true"></div>
      <div class="rc-stage"><div class="rc-tilt">${cardHtml(index)}</div><div class="rc-ring" aria-hidden="true"></div></div>
      <div class="rc-caption"><span class="rc-new">새 카드 획득!</span><span class="rc-count">${config.setName} ${ownedAfter.filter(Boolean).length}/${total}</span></div>
      <button type="button" class="rc-take">카드 보관함에 넣기</button>
      <p class="rc-sr" aria-live="polite"></p>`;
    document.body.append(layer);
    if (root) root.inert = true;
    const fx = rm ? null : particleField(layer);
    const card = layer.querySelector('.rc-card');
    const tilt = layer.querySelector('.rc-tilt');
    const take = layer.querySelector('.rc-take');
    const center = () => { const r = card.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

    requestAnimationFrame(() => layer.classList.add('is-open'));
    if (rm) {
      card.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out', fill: 'both' });
      layer.classList.add('is-revealed');
      sound(tier >= 3 ? 'epic' : 'reveal');
    } else {
      const c = center();
      const from = origin ? { x: origin.x - c.x, y: origin.y - c.y } : { x: 0, y: innerHeight * .35 };
      sound('whoosh');
      const turns = 1080 + 360 * Math.min(2, Math.floor(tier / 2));
      const spin = card.animate([
        { transform: `translate(${from.x}px,${from.y}px) scale(.12) rotateY(180deg) rotateZ(-25deg)`, opacity: 0 },
        { offset: .12, opacity: 1 },
        { offset: .78, transform: `translate(0,0) scale(1.14) rotateY(${turns - 40}deg) rotateZ(4deg)` },
        { transform: `translate(0,0) scale(1) rotateY(${turns}deg) rotateZ(0deg)`, opacity: 1 },
      ], { duration: 1250 + tier * 90, easing: 'cubic-bezier(.18,.7,.2,1)', fill: 'both' });
      await spin.finished.catch(() => {});
      card.style.transform = 'none';
      spin.cancel();
      layer.classList.add('is-revealed');
      const p = center();
      fx.burst(p.x, p.y, 46 + tier * 22, 1 + tier * .12);
      if (tier >= 3) setTimeout(() => fx.burst(p.x, p.y, 40, 1.4), 260);
      if (tier === 4) fx.rain(70);
      sound(tier >= 3 ? 'epic' : 'reveal');
    }
    layer.querySelector('.rc-sr').textContent = `${cards[index].title} 카드를 얻었어요. 별 ${starsOf(index)}개 ${rarityOf(index).label} 카드.`;

    // Gentle hover tilt while the student looks at the card.
    const onMove = event => {
      if (rm) return;
      const r = card.getBoundingClientRect();
      const dx = ((event.clientX - r.left) / r.width - .5) * 2, dy = ((event.clientY - r.top) / r.height - .5) * 2;
      tilt.style.transform = `rotateY(${Math.max(-1, Math.min(1, dx)) * 14}deg) rotateX(${Math.max(-1, Math.min(1, -dy)) * 12}deg)`;
      card.style.setProperty('--mx', `${(dx + 1) * 50}%`);
    };
    layer.addEventListener('pointermove', onMove);

    await wait(rm ? 200 : 650);
    take.classList.add('is-ready');
    take.focus({ preventScroll: true });
    await new Promise(done => {
      const finish = () => { take.removeEventListener('click', finish); layer.removeEventListener('keydown', onKey); removeEventListener('popstate', finish); done(); };
      const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); finish(); } };
      take.addEventListener('click', finish);
      layer.addEventListener('keydown', onKey);
      addEventListener('popstate', finish);
    });
    layer.removeEventListener('pointermove', onMove);
    take.disabled = true;
    layer.classList.add('is-leaving');

    // Fly into the slot beside the sound button.
    const slot = visibleSlot(index);
    tilt.style.transform = 'none';
    if (slot && !rm) {
      const s = slot.getBoundingClientRect(), r = card.getBoundingClientRect();
      const scale = Math.max(.05, s.width / r.width);
      sound('whoosh');
      const fly = card.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        { offset: .45, transform: `translate(${(s.left + s.width / 2 - (r.left + r.width / 2)) * .45}px,${(s.top - r.top) * .25 - 60}px) scale(.55) rotate(-8deg)`, opacity: 1 },
        { transform: `translate(${s.left + s.width / 2 - (r.left + r.width / 2)}px,${s.top + s.height / 2 - (r.top + r.height / 2)}px) scale(${scale}) rotate(360deg)`, opacity: .9 },
      ], { duration: 640, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
      await fly.finished.catch(() => {});
    } else {
      await card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220, fill: 'forwards' }).finished.catch(() => {});
    }
    syncSlots(ownedAfter, index);
    sound('slot');
    if (slot && fx) { const s = slot.getBoundingClientRect(); fx.burst(s.left + s.width / 2, s.top + s.height / 2, 18, .45); }
    await wait(rm ? 60 : 420);

    if (ownedAfter.every(Boolean)) await celebrate(layer, fx, rm);
    fx?.stop();
    layer.remove();
    if (root) root.inert = false;
    if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus({ preventScroll: true });
  }

  async function celebrate(layer, fx, rm) {
    layer.classList.remove('is-leaving', 'is-revealed');
    layer.classList.add('is-complete');
    const fan = document.createElement('div');
    fan.className = 'rc-fan';
    fan.innerHTML = cards.map((_, i) => `<div class="rc-fan-item" style="--i:${i - (total - 1) / 2}">${cardHtml(i, 'is-mini')}</div>`).join('');
    const title = document.createElement('div');
    title.className = 'rc-complete';
    title.innerHTML = `<strong>컬렉션 완성!</strong><span>${esc(config.setName)} ${total}장을 모두 모았어요</span>`;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'rc-take is-ready';
    ok.textContent = '멋져요!';
    layer.querySelector('.rc-stage').replaceWith(fan);
    layer.querySelector('.rc-caption')?.remove();
    layer.querySelector('.rc-take')?.remove();
    layer.append(title, ok);
    layer.querySelector('.rc-sr').textContent = `${config.setName}를 모두 모았어요!`;
    sound('complete');
    if (fx) { fx.burst(innerWidth / 2, innerHeight * .45, 120, 1.6); fx.rain(110); setTimeout(() => fx.burst(innerWidth * .25, innerHeight * .5, 50, 1.1), 380); setTimeout(() => fx.burst(innerWidth * .75, innerHeight * .5, 50, 1.1), 620); }
    await wait(rm ? 100 : 700);
    ok.focus({ preventScroll: true });
    await new Promise(done => {
      const finish = () => { ok.removeEventListener('click', finish); layer.removeEventListener('keydown', onKey); removeEventListener('popstate', finish); done(); };
      const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); finish(); } };
      ok.addEventListener('click', finish);
      layer.addEventListener('keydown', onKey);
      addEventListener('popstate', finish);
    });
    if (!rm) await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }).finished.catch(() => {});
  }

  // ---------- album ----------
  function openAlbum() {
    if (busy || document.querySelector('.rc-layer')) return;
    const root = config.inertRoot?.() ?? null;
    const focusBefore = document.activeElement;
    const layer = document.createElement('div');
    layer.className = 'rc-layer rc-album is-open is-revealed';
    layer.style.cssText = themeStyle();
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', `${config.setName} 보관함`);
    const count = owned.filter(Boolean).length;
    layer.innerHTML = `<div class="rc-scrim" data-album-close></div>
      <div class="rc-album-panel">
        <div class="rc-album-head"><strong>${esc(config.setName)}</strong><span>${count}/${total}</span><button type="button" class="rc-album-close" data-album-close aria-label="보관함 닫기">✕</button></div>
        <div class="rc-album-row">${cards.map((card, i) => owned[i]
          ? `<button type="button" class="rc-album-item" data-album-card="${i}" aria-label="${esc(card.title)} 크게 보기">${cardHtml(i, 'is-mini')}</button>`
          : `<div class="rc-album-item is-locked" aria-label="아직 못 얻은 카드 ${i + 1}"><div class="rc-locked"><i>?</i><span>${esc(card.stage)}</span><small>악당을 물리치면 열려요</small></div></div>`).join('')}</div>
      </div>`;
    document.body.append(layer);
    if (root) root.inert = true;
    const close = () => {
      layer.remove();
      if (root) root.inert = false;
      removeEventListener('popstate', close);
      if (focusBefore instanceof HTMLElement && focusBefore.isConnected) focusBefore.focus({ preventScroll: true });
    };
    layer.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-album-close]')) { close(); return; }
      const item = target?.closest('[data-album-card]');
      if (item) zoom(layer, Number(item.dataset.albumCard));
    });
    layer.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); const z = layer.querySelector('.rc-zoom'); if (z) z.remove(); else close(); } });
    addEventListener('popstate', close);
    layer.querySelector('.rc-album-close').focus({ preventScroll: true });
  }
  function zoom(layer, index) {
    const z = document.createElement('div');
    z.className = 'rc-zoom';
    z.innerHTML = `<div class="rc-stage"><div class="rc-tilt">${cardHtml(index)}</div></div><button type="button" class="rc-take is-ready">닫기</button>`;
    layer.append(z);
    const card = z.querySelector('.rc-card'), tilt = z.querySelector('.rc-tilt');
    if (!reduced()) card.animate([{ transform: 'rotateY(180deg) scale(.6)' }, { transform: 'rotateY(360deg) scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    z.addEventListener('pointermove', event => {
      if (reduced()) return;
      const r = card.getBoundingClientRect();
      const dx = ((event.clientX - r.left) / r.width - .5) * 2, dy = ((event.clientY - r.top) / r.height - .5) * 2;
      tilt.style.transform = `rotateY(${Math.max(-1, Math.min(1, dx)) * 14}deg) rotateX(${Math.max(-1, Math.min(1, -dy)) * 12}deg)`;
    });
    z.addEventListener('click', event => { if (event.target instanceof Element && (event.target.closest('.rc-take') || !event.target.closest('.rc-card'))) { event.stopPropagation(); z.remove(); } });
    z.querySelector('.rc-take').focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-reward-album]') : null;
    if (button) { event.preventDefault(); openAlbum(); }
  });

  return { slotsHtml, syncSlots, reveal, openAlbum, isBusy: () => busy || queue.length > 0 };
}

function drawShape(ctx, shape, r, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * .28); ctx.lineCap = 'round';
  ctx.beginPath();
  switch (shape) {
    case 'gear': {
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) { const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r * .72 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      return;
    }
    case 'bolt':
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.lineTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7); }
      ctx.closePath(); ctx.fill(); ctx.fillRect(-r * .18, r * .4, r * .36, r * .9); return;
    case 'spark':
      ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r * .6); ctx.lineTo(0, r * .6); ctx.stroke(); return;
    case 'drop':
      ctx.moveTo(0, -r); ctx.bezierCurveTo(r * .8, -r * .1, r * .7, r * .8, 0, r * .8); ctx.bezierCurveTo(-r * .7, r * .8, -r * .8, -r * .1, 0, -r); ctx.fill(); return;
    case 'leaf': case 'petal':
      ctx.ellipse(0, 0, r, r * (shape === 'leaf' ? .45 : .6), 0, 0, Math.PI * 2); ctx.fill(); return;
    case 'note':
      ctx.ellipse(-r * .3, r * .5, r * .45, r * .32, -.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(r * .05, -r, r * .2, r * 1.5); ctx.fillRect(r * .05, -r, r * .7, r * .25); return;
    case 'snow':
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); }
      ctx.stroke(); return;
    case 'bubble':
      ctx.lineWidth = Math.max(1.5, r * .18); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.stroke(); return;
    case 'heart':
      ctx.moveTo(0, r * .8); ctx.bezierCurveTo(-r * 1.2, -r * .1, -r * .5, -r, 0, -r * .35); ctx.bezierCurveTo(r * .5, -r, r * 1.2, -r * .1, 0, r * .8); ctx.fill(); return;
    case 'circle':
      ctx.arc(0, 0, r * .55, 0, Math.PI * 2); ctx.fill(); return;
    default: // star
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .42 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
  }
}
