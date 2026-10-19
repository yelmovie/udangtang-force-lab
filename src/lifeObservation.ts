export type LifeTool = 'lever' | 'ramp';
/**
 * Sorting record for "생활 속 도구를 찾아요". `object` / `use` are readable lists rebuilt from `sorted`
 * (main.ts shows them on the result screen and in the workshop evidence). `shared` is the old self-report
 * checkbox: only older records carry it, the sorting board has none.
 */
export type LifeObservation = {
  /** Cards the student put in the right basket. */
  sorted: string[];
  /** Cards first dropped in the other basket: a note for the teacher, never a penalty. */
  missed: string[];
  object: string; use: string; shared: boolean;
};

/* ===== Picture cards: each one is a real use of a lever or a ramp. Art: public/assets/life-tools/{id}.webp (320x240). ===== */
export type LifeCard = { id: string; name: string; tool: LifeTool; why: string; hint: string };
/** Mixed order so the tray never groups levers and ramps together. */
export const lifeCards: LifeCard[] = [
  { id: 'slide', name: '미끄럼틀', tool: 'ramp', why: '비스듬한 면을 따라 내려와서 똑바로 떨어질 때보다 천천히, 안전하게 내려와요.', hint: '미끄럼틀의 타는 면이 어떻게 놓여 있는지 봐요.' },
  { id: 'bottle-opener', name: '병따개', tool: 'lever', why: '뚜껑 위에 닿은 곳이 받침점이 되어, 긴 손잡이를 들면 작은 힘으로 뚜껑이 열려요.', hint: '병따개가 뚜껑에 닿아 받쳐지는 곳을 찾아봐요.' },
  { id: 'seesaw', name: '시소', tool: 'lever', why: '가운데 받침점을 중심으로 움직여요. 받침점에서 멀리 누를수록 작은 힘으로 친구를 들어 올려요.', hint: '시소 가운데를 받치고 있는 곳이 보이나요?' },
  { id: 'wheelchair-ramp', name: '휠체어 경사로', tool: 'ramp', why: '비스듬한 길을 따라 밀면 들어 올리지 않아도 적은 힘으로 문 앞까지 올라가요.', hint: '휠체어가 올라가는 길이 어떤 모양인지 봐요.' },
  { id: 'mountain-road', name: '지그재그 산길', tool: 'ramp', why: '길을 비스듬히 돌려 길게 만들면 덜 가팔라서 적은 힘으로 올라가요.', hint: '산길이 꼭대기까지 곧장 가나요, 비스듬히 돌아가나요?' },
  { id: 'claw-hammer', name: '장도리', tool: 'lever', why: '나무판에 닿은 머리가 받침점이 되어, 긴 손잡이를 당기면 작은 힘으로 못이 뽑혀요.', hint: '장도리 머리가 나무판에 닿아 받쳐지는 곳을 찾아봐요.' },
  { id: 'truck-ramp', name: '트럭 경사판', tool: 'ramp', why: '무거운 짐을 들어 올리지 않고 비스듬한 판을 따라 적은 힘으로 밀어 올려요.', hint: '수레가 올라가는 판이 어떤 모양인지 봐요.' },
  { id: 'scissors', name: '가위', tool: 'lever', why: '가운데 못이 받침점이에요. 종이를 못 가까이에 넣으면 작은 힘으로도 잘 잘려요.', hint: '가위 가운데 동그란 못을 찾아봐요.' },
];
export const lifeBaskets: Record<LifeTool, { name: string; idea: string }> = {
  lever: { name: '지레', idea: '받침점을 중심으로 작은 힘으로 큰 힘을 내요' },
  ramp: { name: '빗면', idea: '비스듬한 면을 따라 적은 힘으로 높이 올려요' },
};
export const lifeSummary = '지레는 받침점을 중심으로, 빗면은 비스듬한 면을 따라 적은 힘으로 일을 하게 도와줘요.';
export const lifeCard = (id: string) => lifeCards.find(card => card.id === id);

const cardIds = (items: unknown): string[] => Array.isArray(items)
  ? [...new Set(items.filter((id): id is string => typeof id === 'string' && !!lifeCard(id)))] : [];
function lifeRecord(sorted: string[], missed: string[]): LifeObservation {
  const list = (tool: LifeTool) => `${lifeBaskets[tool].name}: ${lifeCards.filter(card => card.tool === tool && sorted.includes(card.id)).map(card => card.name).join(', ') || '아직 없어요'}`;
  return { sorted, missed, object: list('lever'), use: list('ramp'), shared: false };
}
export const emptyLifeObservation = (): LifeObservation => lifeRecord([], []);

/** A record with cards is rebuilt from known card ids; older 3-step records ({ tool, source, object, use }) keep their words. */
export function retainLifeObservation(value: unknown): LifeObservation | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Record<string, unknown>;
  const sorted = cardIds(raw.sorted), missed = cardIds(raw.missed);
  if (sorted.length || missed.length) return lifeRecord(sorted, missed);
  const text = (item: unknown, max: number) => typeof item === 'string' ? item.trim().slice(0, max) : '';
  const object = text(raw.object, 80), use = text(raw.use, 160);
  return object || use ? { sorted: [], missed: [], object, use, shared: raw.shared === true } : undefined;
}
export function lifeSortDone(value: LifeObservation | undefined): boolean {
  return !!value && lifeCards.every(card => value.sorted.includes(card.id));
}
/** One drop: the right basket files the card; the other basket only notes it, and the card goes back to try again. */
export function dropLifeCard(record: LifeObservation, cardId: string, basket: LifeTool): { result: 'correct' | 'retry'; record: LifeObservation } | undefined {
  const card = lifeCard(cardId);
  if (!card || record.sorted.includes(cardId)) return;
  if (card.tool === basket) return { result: 'correct', record: lifeRecord([...record.sorted, cardId], record.missed) };
  return { result: 'retry', record: lifeRecord(record.sorted, record.missed.includes(cardId) ? record.missed : [...record.missed, cardId]) };
}

const hasFinal = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code < 11172 && code % 28 !== 0; };
export function lifeDropMessage(cardId: string, result: 'correct' | 'retry'): string {
  const card = lifeCard(cardId);
  if (!card) return '';
  if (result === 'retry') return `다시 생각해요. ${card.hint}`;
  return `맞아요! ${card.name}${hasFinal(card.name) ? '은' : '는'} ${card.tool === 'lever' ? '지레예요' : '빗면이에요'}. ${card.why}`;
}
export function lifePickMessage(cardId: string): string {
  const name = lifeCard(cardId)?.name ?? '';
  return `${name}${hasFinal(name) ? '을' : '를'} 골랐어요. 이제 지레 바구니나 빗면 바구니를 눌러요.`;
}

const toolIcons: Record<LifeTool, string> = {
  lever: '<path d="M6 30L58 14" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M24 37L32 23L40 37Z" fill="currentColor"/>',
  ramp: '<path d="M4 37H60V11Z" fill="currentColor"/><rect x="25" y="11" width="12" height="11" rx="2" transform="rotate(-25 31 22)" fill="#fff"/>',
};

/** Sort picture cards into the lever and ramp baskets: drag, tap a card then a basket, or use the keyboard. */
export function openLifeObservation(options: {
  app: HTMLElement; value?: LifeObservation; onSave: (value: LifeObservation) => void; onDone: () => void;
}): void {
  let record = options.value ?? emptyLifeObservation();
  let selected = '';
  let feedback: { text: string; tone: '' | 'correct' | 'retry' } = { text: '', tone: '' };
  let drag: { pointer: number; card: HTMLButtonElement; x: number; y: number; ghost: HTMLElement | null; over: HTMLElement | null } | null = null;
  let suppressClickUntil = 0;
  const image = (id: string) => `<img src="${import.meta.env.BASE_URL}assets/life-tools/${id}.webp" alt="" width="320" height="240" draggable="false">`;
  const modal = document.createElement('div');
  modal.className = 'modal-layer life-layer';
  const wasInert = options.app.inert;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  options.app.inert = true;
  modal.innerHTML = `<section class="modal-card life-card" role="dialog" aria-modal="true" aria-labelledby="life-title" aria-describedby="life-guide">
    <div class="settings-heading"><h2 id="life-title">생활 속 도구를 찾아요</h2><span class="life-count" id="life-count"></span><button type="button" id="life-close" aria-label="공방으로 돌아가기">×</button></div>
    <p class="life-guide" id="life-guide"><span class="life-guide-intro">공방에서 써 본 지레와 빗면이 우리 생활에도 있어요. </span>그림 카드를 알맞은 바구니로 끌어다 놓아요. <span class="life-guide-tap">카드를 누르고 바구니를 눌러도 돼요.</span></p>
    <div class="life-board">
      <div class="life-middle">
        <div class="life-tray" role="group" aria-label="생활 속 도구 그림 카드">${lifeCards.map(card => `<div class="life-slot"><button type="button" class="life-tool" data-card="${card.id}" aria-pressed="false">${image(card.id)}<span>${card.name}</span></button></div>`).join('')}</div>
        <div class="life-finish" id="life-finish" hidden><p><strong>다 찾았어요!</strong> ${lifeSummary}</p><button type="button" class="button button-primary" id="life-done">관찰 기록으로 마치기</button></div>
      </div>
      ${(['lever', 'ramp'] as const).map(tool => `<div class="life-basket is-${tool}" data-basket="${tool}">
        <button type="button" class="life-basket-head" data-basket="${tool}"><svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">${toolIcons[tool]}</svg><strong>${lifeBaskets[tool].name}</strong><small>${lifeBaskets[tool].idea}</small></button>
        <ul class="life-basket-items" aria-label="${lifeBaskets[tool].name} 바구니에 넣은 카드"></ul>
      </div>`).join('')}
    </div>
    <p class="life-feedback" id="life-feedback" role="status"></p>
  </section>`;
  const field = <T extends HTMLElement>(id: string) => modal.querySelector<T>(`#${id}`)!;
  const cardButton = (id: string) => modal.querySelector<HTMLButtonElement>(`.life-tool[data-card="${id}"]`);
  const basketBox = (tool: LifeTool) => modal.querySelector<HTMLElement>(`.life-basket[data-basket="${tool}"]`)!;
  const flash = (element: Element | null | undefined, name: string) => {
    if (!element) return;
    element.classList.remove(name); void (element as HTMLElement).offsetWidth; element.classList.add(name);
  };

  const render = () => {
    const done = lifeSortDone(record);
    for (const card of lifeCards) {
      // A filed card keeps its slot (dashed outline) so the other cards do not jump around.
      const button = cardButton(card.id)!;
      button.disabled = record.sorted.includes(card.id);
      button.setAttribute('aria-pressed', String(selected === card.id));
    }
    for (const tool of ['lever', 'ramp'] as const) {
      const list = basketBox(tool).querySelector<HTMLElement>('.life-basket-items')!;
      const filed = record.sorted.filter(id => lifeCard(id)?.tool === tool);
      if (list.children.length !== filed.length) list.innerHTML = filed.map(id => `<li data-filed="${id}">${image(id)}<span>${lifeCard(id)!.name}</span></li>`).join('');
      basketBox(tool).classList.toggle('is-ready', !!selected);
    }
    field('life-count').textContent = `찾은 도구 ${record.sorted.length} / ${lifeCards.length}`;
    field('life-finish').hidden = !done;
    modal.querySelector<HTMLElement>('.life-tray')!.hidden = done;
    const status = field('life-feedback');
    const text = feedback.text || (done ? '' : '카드를 골라 지레 바구니나 빗면 바구니에 놓아요.');
    if (status.textContent !== text) status.textContent = text;
    status.dataset.tone = feedback.tone;
  };
  /** Focus stays on something visible: the next card after a filed one, the same card after a retry. */
  const focusAfterDrop = (cardId: string, result: 'correct' | 'retry') => {
    if (result === 'retry') { cardButton(cardId)?.focus({ preventScroll: true }); return; }
    if (lifeSortDone(record)) { field('life-done').focus({ preventScroll: true }); return; }
    const at = lifeCards.findIndex(card => card.id === cardId);
    const next = [...lifeCards.slice(at + 1), ...lifeCards.slice(0, at)].find(card => !record.sorted.includes(card.id));
    if (next) cardButton(next.id)?.focus({ preventScroll: true });
  };
  const drop = (cardId: string, basket: LifeTool) => {
    const outcome = dropLifeCard(record, cardId, basket);
    if (!outcome) return;
    record = outcome.record;
    options.onSave(record);
    selected = '';
    feedback = { text: lifeDropMessage(cardId, outcome.result), tone: outcome.result };
    render();
    if (outcome.result === 'correct') { flash(basketBox(basket), 'is-got'); flash(modal.querySelector(`[data-filed="${cardId}"]`), 'is-new'); }
    else { flash(basketBox(basket), 'is-miss'); flash(cardButton(cardId)?.closest('.life-slot'), 'is-retry'); }
    focusAfterDrop(cardId, outcome.result);
  };
  const pick = (cardId: string) => {
    selected = selected === cardId ? '' : cardId;
    feedback = { text: selected ? lifePickMessage(selected) : '', tone: '' };
    render();
  };
  const clearDrag = () => {
    if (!drag) return;
    drag.ghost?.remove();
    drag.over?.classList.remove('is-over');
    drag.card.classList.remove('is-lifted');
    if (drag.card.hasPointerCapture(drag.pointer)) drag.card.releasePointerCapture(drag.pointer);
    drag = null;
  };
  const basketAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.life-basket') ?? null;
  const close = () => { clearDrag(); options.app.inert = wasInert; modal.remove(); if (previous?.isConnected) previous.focus(); };

  modal.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0) return;
    const card = (event.target as Element).closest<HTMLButtonElement>('.life-tool');
    if (!card || card.disabled) return;
    drag = { pointer: event.pointerId, card, x: event.clientX, y: event.clientY, ghost: null, over: null };
    card.setPointerCapture(event.pointerId);
  });
  modal.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 10) return;
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'life-ghost';
      drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.innerHTML = drag.card.innerHTML;
      modal.append(drag.ghost);
      drag.card.classList.add('is-lifted');
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const over = basketAt(event.clientX, event.clientY);
    if (over !== drag.over) { drag.over?.classList.remove('is-over'); over?.classList.add('is-over'); drag.over = over; }
  });
  modal.addEventListener('pointerup', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const { card, ghost } = drag;
    const basket = ghost ? basketAt(event.clientX, event.clientY)?.dataset.basket : undefined;
    clearDrag();
    if (!ghost) return; // a plain tap: the click handler picks the card
    suppressClickUntil = performance.now() + 350;
    if (basket === 'lever' || basket === 'ramp') drop(card.dataset.card!, basket);
    else { feedback = { text: '바구니 위에서 손을 떼요. 카드를 누르고 바구니를 눌러도 돼요.', tone: '' }; render(); }
  });
  modal.addEventListener('pointercancel', event => { if (drag?.pointer === event.pointerId) clearDrag(); });

  modal.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) return;
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (button?.id === 'life-close') { close(); return; }
    if (button?.id === 'life-done') { if (!lifeSortDone(record)) return; options.onSave(record); close(); options.onDone(); return; }
    const card = target.closest<HTMLButtonElement>('.life-tool');
    if (card) {
      pick(card.dataset.card!);
      // Keyboard: Enter on a card jumps to the lever basket; Tab reaches the ramp basket.
      if (selected && event.detail === 0) basketBox('lever').querySelector<HTMLButtonElement>('button')!.focus();
      return;
    }
    const basket = target.closest<HTMLElement>('.life-basket')?.dataset.basket;
    if (basket !== 'lever' && basket !== 'ramp') return;
    if (selected) { drop(selected, basket); return; }
    if (lifeSortDone(record)) return;
    feedback = { text: '먼저 그림 카드를 하나 골라요. 그다음 바구니를 눌러요.', tone: '' };
    render();
    flash(modal.querySelector('.life-tray'), 'is-nudge');
  });
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (drag) clearDrag();
      else if (selected) { const card = selected; pick(card); cardButton(card)?.focus(); }
      else close();
      return;
    }
    if (e.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled)')].filter(el => el.getClientRects().length);
    if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus(); }
  });

  render();
  document.body.append(modal);
  const first = lifeCards.find(card => !record.sorted.includes(card.id));
  (first ? cardButton(first.id) : field('life-done'))?.focus({ preventScroll: true });
}
