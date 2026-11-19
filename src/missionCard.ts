// 미션 시작 카드: 이번 미션에서 알아볼 것 + 실험 전 처음 생각(선택) + 실험 시작. main.ts에서 그대로 옮김(2026-11-19, 문구·동작 변경 없음).
import { stages, type StageId } from './data';
import type { SaveData } from './state';
import { inquiryPlans } from './inquiryPlan';
import { playVoiceLine, stopVoiceLine } from './npcDialogueVoice';

export type MissionCardHost = {
  app: HTMLElement;
  /** 관리자 미리보기 중이면 미리보기 저장, 아니면 학생 저장 */
  activeSave(): SaveData;
  adminUnlocked(): boolean;
  tone(frequency?: number): void;
  persist(): boolean;
  render(): void;
};

const missionLearn: Record<StageId, string> = {
  cargo: '무거운 상자와 가벼운 상자를 밀고 당길 때 달라지는 점',
  balance: '수평대에서 어느 쪽이 더 무거운지 알아내는 법',
  scale: '겉모습으로 헷갈리는 무게를 저울로 비교해요.',
  workshop: '지레와 빗면을 쓰면 필요한 힘이 어떻게 달라지는지',
  rescue: '배운 방법으로 배터리 코어를 옮겨 중앙 장치에 다시 끼우기',
};
/** Experiment done, questions open: a card that only leads to the questions (or back to the experiment). */
export function openMissionCard(stageId: StageId, host: MissionCardHost) {
  const { app, tone } = host;
  const stage = stages.find(item => item.id === stageId)!;
  const plan = inquiryPlans[stageId];
  const activeSave = host.activeSave();
  let selected = activeSave.inquiryPlans?.[stageId] ?? '';
  const modal = document.createElement('div');
  modal.className = 'modal-layer story-layer';
  const appWasInert = app.inert; app.inert = true;
  modal.innerHTML = `<div class="modal-card mission-card" role="dialog" aria-modal="true" aria-labelledby="mission-title">

    <p class="eyebrow">MISSION 0${stage.mission} · ${stage.concept}</p>
    <h2 id="mission-title">${stage.title}</h2>
    <p class="mission-purpose">${missionLearn[stageId]}</p>

    <section class="mission-prediction question-zone" aria-labelledby="mission-question"><span class="question-label">실험 전 처음 생각 (선택)</span><h3 class="question-prompt" id="mission-question">${plan.prompt}</h3><div class="mission-answer-grid" style="--answer-count:${plan.choices.length}">${plan.choices.map((choice,index) => `<button type="button" data-plan="${choice.id}" aria-pressed="${selected === choice.id}"><span class="answer-number" aria-hidden="true">${index+1}</span><span>${choice.label}</span></button>`).join('')}</div></section>

    <p class="mission-orientation" role="status">시작하기 전에 태블릿을 가로로 돌려요. 고른 처음 생각은 그대로 있어요.</p>
    <button class="button button-primary" id="mission-start">실험 시작 →</button>
  </div>`;
  const start = modal.querySelector<HTMLButtonElement>('#mission-start')!;
  const orientation = matchMedia('(orientation: portrait)');
  const syncOrientation = () => { start.disabled = orientation.matches; };
  orientation.addEventListener('change', syncOrientation); syncOrientation();
  const close = () => { orientation.removeEventListener('change', syncOrientation); stopVoiceLine(); app.inert = appWasInert; modal.remove(); };
  modal.addEventListener('modal-dismiss', close);
  modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.plan!;
    modal.querySelectorAll<HTMLButtonElement>('[data-plan]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    tone(470);
  }));
  start.addEventListener('click', () => {
    activeSave.inquiryPlans ??= {};
    if (selected) activeSave.inquiryPlans[stageId] = selected;
    if (stageId === 'rescue' && (selected === 'short' || selected === 'long') && !activeSave.rescue.runs.length) activeSave.rescue.route = selected;
    if (!host.adminUnlocked()) host.persist();
    tone(470); close();
    if (stageId === 'rescue' || stageId === 'workshop') host.render();
  }, { once: true });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.body.append(modal); modal.querySelector<HTMLButtonElement>('[data-plan]')?.focus();
  playVoiceLine(`npc-dialogue/${stageId}-mission`);
}
