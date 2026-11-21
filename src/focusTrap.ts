// Keeps Tab inside an open window. E1 (2026-11-21): the nine windows share these instead of nine copies;
// each caller still chooses which elements count, exactly as before.

/** Wraps only at the ends: Shift+Tab on the first item goes to the last, Tab on the last goes to the first. */
export function wrapTabAtEnds(event: KeyboardEvent, items: readonly HTMLElement[]): void {
  const first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

/** Moves every Tab one item along the ring. With `fromFirst`, focus outside the ring starts at the first item. */
export function stepTabRing(event: KeyboardEvent, items: readonly HTMLElement[], fromFirst: boolean): void {
  if (!items.length) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const step = event.shiftKey ? items.length - 1 : 1;
  items[fromFirst && at < 0 ? 0 : (at + step) % items.length].focus();
}

/** Elements matching `selector` that are laid out now (hidden ones have no client rects). */
export const shownItems = (root: ParentNode, selector: string): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length);
