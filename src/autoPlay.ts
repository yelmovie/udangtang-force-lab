import './autoPlay.css';

// Shared pieces of each stage's "자동으로 보기": the stage runs its hands-on steps by itself
// (placing, measuring, pulling, pushing), while predictions and answers stay with the student.
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A pause between automatic steps, so each result can be seen. */
export function autoPause(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, reducedMotion() ? Math.min(ms, 250) : ms));
}

/** Waits until `ready()` holds; false if `alive()` turns false first (stopped or left the stage). */
export async function autoWait(ready: () => boolean, alive: () => boolean): Promise<boolean> {
  while (alive()) {
    if (ready()) return true;
    await new Promise(resolve => window.setTimeout(resolve, 80));
  }
  return false;
}

/** Shows the button while there is something left to run, and locks the stage (all but the button and popups) while it runs. */
export function syncAutoButton(button: HTMLButtonElement, screen: HTMLElement, playing: boolean, available: boolean, blocked: boolean) {
  button.hidden = !playing && !available;
  button.disabled = !playing && blocked;
  button.textContent = playing ? '■ 자동 멈추기' : '▶ 자동으로 보기';
  button.setAttribute('aria-pressed', String(playing));
  screen.classList.toggle('is-autoplaying', playing);
}
