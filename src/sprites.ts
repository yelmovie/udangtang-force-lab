import './sprites.css';

export type CompanionMood = 'idle' | 'effort' | 'observe' | 'success';
export interface CompanionController {
  setMood(mood: CompanionMood): void;
  dispose(): void;
}

/** Fixed sprite names (without .webp) that replace the per-mood art; the reaction animations still play. */
export interface CompanionArt { student?: string; corgi?: string }

/** A reaction to a real experiment event, not a looping walk animation.
 * With `onCorgiButton` the corgi becomes a button (the stage's hint), and the rest stays decorative. */
export function mountCompanion(host: HTMLElement, initial: CompanionMood = 'idle', art: CompanionArt = {}, onCorgiButton?: (button: HTMLButtonElement) => void): CompanionController {
  const element = document.createElement('div');
  element.className = 'game-companion';
  const student = document.createElement('img');
  student.className = 'game-companion-student';
  const corgi = document.createElement('img');
  for (const image of [student, corgi]) {
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
  }
  if (onCorgiButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-companion-corgi game-companion-corgi-button';
    button.append(corgi);
    host.removeAttribute('aria-hidden');
    element.append(student, button);
    onCorgiButton(button);
  } else {
    corgi.className = 'game-companion-corgi';
    element.setAttribute('aria-hidden', 'true');
    element.append(student, corgi);
  }
  host.append(element);
  let disposed = false;
  const setMood = (mood: CompanionMood) => {
    if (disposed) return;
    student.src = `${import.meta.env.BASE_URL}assets/game/${art.student ?? `student-${mood}`}.webp`;
    corgi.src = `${import.meta.env.BASE_URL}assets/game/${art.corgi ?? `corgi-${mood}`}.webp`;
    element.dataset.mood = mood;
    // Restart one short reaction on repeated attempts without a persistent timer.
    element.classList.remove('game-companion-react');
    void element.offsetWidth;
    element.classList.add('game-companion-react');
  };
  setMood(initial);
  return { setMood, dispose() { disposed = true; element.remove(); } };
}
