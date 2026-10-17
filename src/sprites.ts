import './sprites.css';

export type CompanionMood = 'idle' | 'effort' | 'observe' | 'success';
export interface CompanionController {
  setMood(mood: CompanionMood): void;
  dispose(): void;
}

/** Fixed sprite names (without .webp) that replace the per-mood art; the reaction animations still play. */
export interface CompanionArt { student?: string; corgi?: string }

/** A reaction to a real experiment event, not a looping walk animation. */
export function mountCompanion(host: HTMLElement, initial: CompanionMood = 'idle', art: CompanionArt = {}): CompanionController {
  const element = document.createElement('div');
  element.className = 'game-companion';
  element.setAttribute('aria-hidden', 'true');
  const student = document.createElement('img');
  student.className = 'game-companion-student';
  const corgi = document.createElement('img');
  corgi.className = 'game-companion-corgi';
  for (const image of [student, corgi]) {
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
  }
  element.append(student, corgi);
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
