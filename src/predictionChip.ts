import type { StageId } from './data';
import type { SaveData } from './state';
import { predictionRecap } from './inquiryPlan';
import './predictionChip.css';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Flies the student's first prediction next to the result they just observed.
 * Call it once, at the moment the mission's key comparison first appears.
 * A missing prediction shows nothing; a different result is never framed as a mistake. */
export function showPredictionChip(host: HTMLElement, save: SaveData, stage: StageId): void {
  const recap = predictionRecap(save, stage);
  if (!recap.predicted || recap.matched === null) return;
  host.querySelector('.prediction-chip')?.remove();
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'prediction-chip';
  chip.dataset.matched = String(recap.matched);
  chip.setAttribute('aria-label', `내 예상 ${recap.predicted}. ${recap.matched ? '예상과 같아요' : '예상과 달라요'}. 눌러서 닫기`);
  chip.innerHTML = `<span class="prediction-chip-label">내 예상</span><strong>${escape(recap.predicted)}</strong><span class="prediction-chip-stamp" aria-hidden="true">${recap.matched ? '✓ 예상과 같아요!' : '어? 예상과 달라요!'}</span>`;
  host.append(chip);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    chip.animate([
      { transform: 'translate(-46vw, -6px) scale(.72) rotate(-6deg)', opacity: 0 },
      { transform: 'translate(-8px, 4px) scale(1.06) rotate(2deg)', opacity: 1, offset: .75 },
      { transform: 'none', opacity: 1 },
    ], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' });
    chip.querySelector('.prediction-chip-stamp')!.animate([
      { transform: 'scale(1.8) rotate(-12deg)', opacity: 0 },
      { transform: 'scale(.94) rotate(-4deg)', opacity: 1, offset: .7 },
      { transform: 'rotate(-4deg)', opacity: 1 },
    ], { duration: 360, delay: 600, easing: 'ease-out', fill: 'backwards' });
  }
  const timer = window.setTimeout(() => chip.remove(), 7000);
  chip.addEventListener('click', () => { clearTimeout(timer); chip.remove(); }, { once: true });
}
