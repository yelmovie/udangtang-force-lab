import type { StageId } from './data';

/** Keep the finish condition visible without showing the internal save rules. */
export function missionProgressMarkup(stage: StageId, labels: string[]): string {
  return `<div class="mission-progress" data-mission-progress="${stage}"><strong class="mission-progress-count">0 / ${labels.length} 발견</strong><div class="mission-progress-steps">${labels.map(label => `<span>○ ${label}</span>`).join('')}</div><em class="mission-progress-next" role="status"></em></div>`;
}

export function setMissionProgress(root: HTMLElement, done: boolean[], next: string): void {
  const progress = root.querySelector<HTMLElement>('.mission-progress');
  if (!progress) return;
  progress.querySelector('.mission-progress-count')!.textContent = `${done.filter(Boolean).length} / ${done.length} 발견`;
  progress.querySelectorAll<HTMLElement>('.mission-progress-steps span').forEach((step, index) => {
    step.classList.toggle('done', done[index]);
    step.textContent = `${done[index] ? '✓' : '○'} ${step.textContent!.replace(/^[✓○]\s*/, '')}`;
  });
  progress.querySelector('.mission-progress-next')!.textContent = next;
  (progress.querySelector('.mission-progress-next') as HTMLElement).hidden = !next;
}
