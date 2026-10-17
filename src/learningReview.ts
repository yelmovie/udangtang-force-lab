import { learningTask, learningRecordComplete, learningSummary, type LearningRecord } from './learningModel';
import type { SaveData } from './state';
import { balanceObjects, type StageId } from './data';
import { inquiryPlans, planLabel } from './inquiryPlan';
import { fingerIcon } from './interactionHints';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const balancePair = (pair: [string, string]) => `<div class="learning-block-pair">${pair.map((id, index) => {
  const object = balanceObjects.find(item => item.id === id);
  return object ? `<div class="learning-block"><small>${index ? '오른쪽' : '왼쪽'}</small><img src="${object.image}" alt=""><strong>${escape(object.label)}</strong></div>` : '';
}).join('')}</div>`;

/** A short observation-to-explanation check. Wrong first thoughts are kept, never penalized. */
export function openLearningReview(options: {
  app: HTMLElement; save: SaveData; stage: StageId; commit: () => void;
  onDone: (summary: string) => void; onClose: () => void;
}): (() => void) | null {
  const task = learningTask(options.save, options.stage);
  if (!task) return null;
  const predicted = planLabel(options.stage, options.save.inquiryPlans?.[options.stage]);
  options.save.learning ??= {};
  const previous = options.save.learning[options.stage];
  const record: LearningRecord = previous?.signature === task.signature
    ? previous : { signature: task.signature, answers: [], completed: false };
  options.save.learning[options.stage] = record;
  let step = 0;
  let closed = false;
  let feedback = '';
  const modal = document.createElement('div');
  modal.className = 'modal-layer learning-layer';
  const wasInert = options.app.inert;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  options.app.inert = true;
  const close = () => { if (closed) return; closed = true; options.app.inert = wasInert; modal.remove(); if (previousFocus?.isConnected) previousFocus.focus(); };
  const draw = () => {
    const q = task.questions[step];
    const answer = record.answers[step];
    const correct = answer?.chosen === q.correct;
    const cards = task.cards.map(card => `<article class="learning-evidence"><strong>${escape(card.title)}</strong>${card.pair ? balancePair(card.pair) : ''}<p>${escape(card.detail)}</p>${card.bars?.map((bar, i) => `<div class="learning-measure"><span>${escape(bar.label)}</span><div class="learning-bar ${i ? 'learning-bar-distance' : ''}" role="img" aria-label="${escape(bar.label)}, 비교 막대"><i style="width:${Math.max(4, Math.min(100, bar.value / bar.maximum * 100))}%"></i></div></div>`).join('') ?? ''}</article>`).join('');
    modal.innerHTML = `<section class="modal-card learning-card" role="dialog" aria-modal="true" aria-labelledby="learning-title">
      <div class="learning-heading"><img src="/assets/village/corgi/down-1.webp" alt=""><div><p class="eyebrow">내 기록으로 설명하기 · ${step + 1} / ${task.questions.length}</p><h2 id="learning-title">${task.stage === 'balance' ? '그림을 보고 생각해 봐요' : '내가 발견한 것을 써볼까요?'}</h2></div><button class="learning-close" aria-label="실험으로 돌아가기">×</button></div>
      ${predicted ? `<p class="learning-first-thought"><strong>콩이가 간직한 내 첫 생각:</strong> ${escape(predicted)} <span>· ${escape(inquiryPlans[options.stage].observation)}</span></p>` : ''}
      <p class="learning-record-label">▤ 내 실험에서 관찰한 기록</p><div class="learning-evidence-grid">${cards}</div>
      <section class="question-zone" aria-labelledby="learning-question"><span class="question-label">생각해 볼 문제 ${step + 1}</span><h3 id="learning-question" class="learning-question question-prompt">${escape(q.prompt)}</h3>
      ${q.pair ? `<div class="learning-question-pair">${balancePair(q.pair)}</div>` : ''}
      <p class="answer-label">${fingerIcon} 아래에서 답을 하나 골라요</p><div class="learning-options">${q.choices.map((choice,index) => `<button data-learning-choice="${choice.id}" class="learning-option ${answer?.chosen === choice.id ? 'is-selected' : ''}" aria-pressed="${answer?.chosen === choice.id}" ${correct ? 'disabled' : ''}><span class="answer-number" aria-hidden="true">${index+1}</span><span>${escape(choice.text)}</span></button>`).join('')}</div></section>
      <p class="learning-feedback ${correct ? 'is-correct' : ''}" role="status"><strong class="feedback-label">${correct ? '✓ 선택 결과 · 내 발견' : answer ? '다시 살펴볼 단서' : '답을 고를 때 살펴봐요'}</strong>${escape(feedback || (correct ? q.explanation : '내 기록을 보고 골라봐요. 처음 생각이 달라도 괜찮아요.'))}</p>
      ${correct && step === task.questions.length - 1 ? `<p class="learning-talk">함께 말해봐요 · ${escape(task.talk)}</p>` : ''}
      <div class="learning-actions"><button class="button button-secondary" data-learning="back">실험으로 돌아가기</button><button class="button button-primary" data-learning="next" ${correct ? '' : 'disabled'}>${step === task.questions.length - 1 ? '내 설명과 발견 저장 →' : '다음 발견 →'}</button></div>
    </section>`;
    modal.querySelector<HTMLButtonElement>(correct ? '[data-learning="next"]' : '[data-learning-choice]')?.focus();
  };
  const abort = () => { close(); options.onClose(); };
  modal.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.classList.contains('learning-close') || button.dataset.learning === 'back') { abort(); return; }
    if (button.dataset.learningChoice) {
      const q = task.questions[step];
      const choice = button.dataset.learningChoice;
      if (!q.choices.some(c => c.id === choice) || record.answers[step]?.chosen === q.correct) return;
      const old = record.answers[step];
      record.answers[step] = { first: old?.first ?? choice, chosen: choice, tries: Math.min(100, (old?.tries ?? 0) + 1) };
      record.completed = learningRecordComplete(task, record);
      options.commit();
      feedback = choice === q.correct ? `✓ ${q.explanation}` : `기록을 다시 살펴봐요. ${q.hint}`;
      draw();
    } else if (button.dataset.learning === 'next' && record.answers[step]?.chosen === task.questions[step].correct) {
      if (step < task.questions.length - 1) { step++; feedback = ''; draw(); }
      else if (learningRecordComplete(task, record)) { record.completed = true; options.commit(); close(); options.onDone(learningSummary(task, record)); }
    }
  });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); abort(); }
    if (event.key !== 'Tab') return;
    const buttons = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.body.append(modal);
  draw();
  return abort;
}
