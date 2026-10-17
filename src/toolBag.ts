import './toolBag.css';
import { stages, type StageId } from './data';
import type { SaveData } from './state';
import { toolCards, type ToolCard } from './toolCards';

/** Generated card art: public/assets/game/toolcard-{stage}.webp (256x256, transparent). */
export function toolCardIcon(stage: StageId): string {
  return `<img class="toolcard-icon" src="${import.meta.env.BASE_URL}assets/game/toolcard-${stage}.webp" alt="" draggable="false">`;
}

const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, char => htmlEntities[char]);
}
const color = (stage: StageId) => stages.find(item => item.id === stage)!.color;

/** Card front: drawing, name, what the tool taught, and the student's own record (hidden when missing). */
export function toolCardFront(card: ToolCard): string {
  return `<span class="toolcard-art" style="--card-color:${color(card.stage)}">${toolCardIcon(card.stage)}</span><strong class="toolcard-name">${card.name}</strong><span class="toolcard-idea">${card.idea}</span>${card.record ? `<span class="toolcard-record"><b>내 기록</b>${escapeHtml(card.record)}</span>` : ''}`;
}

/** Small card for the result window: flips once on first completion (static with reduced motion). */
export function toolCardRevealMarkup(card: ToolCard): string {
  return `<div class="toolcard-reveal"><div class="toolcard-flip" aria-hidden="true"><div class="toolcard-flip-inner"><div class="toolcard-face toolcard-back">?</div><div class="toolcard-face toolcard-face-front" style="--card-color:${color(card.stage)}">${toolCardIcon(card.stage)}</div></div></div><div class="toolcard-reveal-text"><strong>새 도구 카드를 받았어요!</strong><span class="toolcard-reveal-name">${card.name}</span>${card.record ? `<small>${escapeHtml(card.record)}</small>` : ''}</div></div>`;
}

/** Row of earned cards for the complete screen; each opens the bag on that card. */
export function toolCardRowMarkup(save: SaveData): string {
  const earned = toolCards(save).filter(card => card.earned);
  return `<section class="toolcard-row-card" aria-labelledby="toolcard-row-title"><h2 id="toolcard-row-title">내 도구 카드 <small>${earned.length} / 5</small></h2>${earned.length ? `<div class="toolcard-row">${earned.map(card => `<button type="button" class="toolcard is-mini" data-toolcard="${card.stage}" aria-label="${card.name} 카드 크게 보기">${toolCardFront(card)}</button>`).join('')}</div>` : '<p>미션을 마치면 도구 카드를 받아요.</p>'}</section>`;
}

export function bagIcon(): string {
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M4 12h16M10 12v2h4v-2"/></svg>`;
}

type BagOptions = { app: HTMLElement; save: SaveData; open?: StageId; sound?: () => void; preview?: boolean };

/** Tool bag dialog: five slots, earned cards face up, locked ones say where to get them. */
export function openToolBag(options: BagOptions): () => void {
  const { app, save } = options;
  const cards = toolCards(save);
  const overlay = document.createElement('div');
  overlay.className = 'modal-layer toolbag-layer';
  const opener = document.activeElement as HTMLElement | null;
  const appWasInert = app.inert;
  app.inert = true;
  let closed = false;
  let detail: StageId | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    app.inert = appWasInert;
    overlay.remove();
    if (opener?.isConnected) opener.focus();
  };
  const heading = (id: string, title: string) => `<div class="toolbag-heading"><h2 id="${id}">${title}</h2><button type="button" class="settings-close" data-bag="close" aria-label="도구 가방 닫기">×</button></div>`;
  const slot = (card: ToolCard) => card.earned
    ? `<button type="button" class="toolcard" data-toolcard="${card.stage}" aria-label="${card.name} 카드 크게 보기">${toolCardFront(card)}</button>`
    : `<div class="toolcard is-locked"><span class="toolcard-art">${toolCardIcon(card.stage)}<span class="toolcard-lock" aria-hidden="true">?</span></span><span class="toolcard-where">${card.mission} 미션을 마치면 받아요</span></div>`;
  const showGrid = (focus?: StageId) => {
    detail = null;
    const count = cards.filter(card => card.earned).length;
    const lead = (options.preview ? '관리자 미리보기 기록으로 보여 줘요. ' : '') + (count ? '카드를 누르면 크게 볼 수 있어요.' : '미션을 마칠 때마다 도구 카드를 한 장씩 받아요.');
    overlay.innerHTML = `<div class="modal-card toolbag-card" role="dialog" aria-modal="true" aria-labelledby="toolbag-title">${heading('toolbag-title', `도구 가방 <small>${count} / 5장</small>`)}<p class="toolbag-lead">${lead}</p><ul class="toolbag-grid">${cards.map(card => `<li>${slot(card)}</li>`).join('')}</ul></div>`;
    const target = focus ? overlay.querySelector<HTMLElement>(`[data-toolcard="${focus}"]`) : null;
    (target ?? overlay.querySelector<HTMLElement>('[data-bag="close"]'))!.focus();
  };
  const showDetail = (stage: StageId) => {
    const card = cards.find(item => item.stage === stage && item.earned);
    if (!card) return;
    detail = stage;
    overlay.innerHTML = `<div class="modal-card toolbag-card is-detail" role="dialog" aria-modal="true" aria-labelledby="toolbag-detail-title">${heading('toolbag-detail-title', card.name)}<div class="toolcard is-large">${toolCardFront(card)}<span class="toolcard-from">${card.mission}에서 받은 카드</span></div><button type="button" class="button button-secondary" data-bag="back">가방으로 돌아가기</button></div>`;
    overlay.querySelector<HTMLElement>('[data-bag="back"]')!.focus();
  };
  overlay.addEventListener('click', event => {
    if (event.target === overlay) { close(); return; }
    const target = event.target as Element;
    const action = target.closest<HTMLElement>('[data-bag]')?.dataset.bag;
    if (action === 'close') { options.sound?.(); close(); return; }
    if (action === 'back') { options.sound?.(); showGrid(detail ?? undefined); return; }
    const stage = target.closest<HTMLElement>('[data-toolcard]')?.dataset.toolcard as StageId | undefined;
    if (stage) { options.sound?.(); showDetail(stage); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (detail) showGrid(detail); else close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled)')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.body.append(overlay);
  if (options.open && cards.some(card => card.stage === options.open && card.earned)) showDetail(options.open);
  else showGrid();
  return close;
}
