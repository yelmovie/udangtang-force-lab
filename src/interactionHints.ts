export const fingerIcon = `<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M11 18V6a3 3 0 0 1 6 0v9l2-1 4 2 3 2v9c0 5-3 7-8 7h-2c-4 0-6-2-8-6l-5-8c-2-3 2-6 4-3l4 5" fill="#fff5d7" stroke="#76512a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 16v6m6-5v6" stroke="#76512a" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/** Point out available actions without revealing a correct prediction. */
export function setTapHint(button: HTMLElement, visible: boolean): void {
  button.classList.toggle('has-tap-hint', visible);
  const hint = button.querySelector('.tap-hint-icon');
  if (!visible) hint?.remove();
  else if (!hint) button.insertAdjacentHTML('beforeend', `<span class="tap-hint-icon" aria-hidden="true">${fingerIcon}</span>`);
}
