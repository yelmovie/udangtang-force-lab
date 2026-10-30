import './corgiHint.css';

/** What a stage tells the student when they tap 콩이. Both come from the stage's own step logic. */
export interface CorgiHintSource {
  /** One line: the next thing to do right now. */
  now(): string;
  /** Optional detail, e.g. which comparisons are still missing. */
  missing?(): string;
}

export interface CorgiHint {
  /** Makes a corgi (the companion's or a standalone one) open the hint when tapped. */
  attach(button: HTMLButtonElement): void;
  dispose(): void;
}

const idleNudgeMs = 12000;

/** A corgi-only button for stages without a student-and-corgi companion. */
export function corgiHintButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'corgi-hint-solo';
  button.innerHTML = `<img src="${import.meta.env.BASE_URL}assets/game/corgi-observe.webp" alt="" draggable="false"><span class="corgi-hint-tag">힌트</span>`;
  return button;
}

/**
 * Tap 콩이 → a bubble with the next step, the stage checklist (✓ done / ○ left) and, while the
 * finish button is still off, what turns it on. The checklist is read from the stage's own
 * progress markup, so it can never disagree with the rules that unlock the stage.
 */
export function mountCorgiHint(root: HTMLElement, source: CorgiHintSource): CorgiHint {
  const events = new AbortController();
  const { signal } = events;
  const triggers: HTMLButtonElement[] = [];
  const bubble = document.createElement('div');
  bubble.className = 'corgi-hint-bubble';
  bubble.id = `corgi-hint-${Math.random().toString(36).slice(2, 8)}`;
  bubble.setAttribute('role', 'status');
  bubble.hidden = true;
  // The body scrolls on short screens; the bubble itself does not, so its tail is never clipped.
  const body = document.createElement('div');
  body.className = 'corgi-hint-body';
  bubble.append(body);
  root.append(bubble);
  let anchor: HTMLButtonElement | null = null;
  let lastInput = performance.now();

  function steps() {
    return [...root.querySelectorAll<HTMLElement>('.mission-progress-steps span, .balance-goal > span[id$="-goal"]')]
      .map(step => ({ label: step.textContent!.replace(/^[✓○]\s*/, '').trim(), done: step.classList.contains('done') }))
      .filter(step => step.label);
  }
  function finishLine(left: number) {
    const finish = root.querySelector<HTMLButtonElement>('.experiment-footer .button-primary');
    if (!finish || !finish.disabled || !left) return '';
    return `‘${finish.textContent!.replace(/[→\s]+$/, '')}’ 버튼은 ○ 표시를 모두 끝내면 눌러져요.`;
  }
  function render() {
    const list = steps(), left = list.filter(step => !step.done).length;
    const paragraph = (className: string, text: string) => { const p = document.createElement('p'); p.className = className; p.textContent = text; return p; };
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'corgi-hint-close'; close.setAttribute('aria-label', '힌트 닫기'); close.textContent = '×';
    close.addEventListener('click', hide);
    const title = document.createElement('strong');
    title.className = 'corgi-hint-title'; title.textContent = '콩이의 힌트';
    const parts: HTMLElement[] = [close, title, paragraph('corgi-hint-now', `지금 할 일: ${source.now()}`)];
    if (list.length) {
      const ul = document.createElement('ul');
      ul.className = 'corgi-hint-steps';
      ul.setAttribute('aria-label', `할 일 ${list.length}개 중 ${list.length - left}개 끝`);
      for (const step of list) { const li = document.createElement('li'); li.className = step.done ? 'done' : ''; li.textContent = `${step.done ? '✓' : '○'} ${step.label}`; ul.append(li); }
      parts.push(ul);
    }
    const missing = source.missing?.() ?? '';
    if (missing) parts.push(paragraph('corgi-hint-missing', missing));
    const finish = finishLine(left);
    if (finish) parts.push(paragraph('corgi-hint-finish', finish));
    body.replaceChildren(...parts);
  }
  function place() {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect(), gap = 10, margin = 8;
    body.style.maxHeight = `${Math.max(160, rect.top - gap - margin - 36)}px`;
    const width = bubble.offsetWidth;
    bubble.style.left = `${Math.max(margin, Math.min(innerWidth - width - margin, rect.left + rect.width / 2 - 36))}px`;
    bubble.style.bottom = `${Math.max(margin, innerHeight - rect.top + gap)}px`;
    bubble.style.setProperty('--tail-x', `${Math.max(18, rect.left + rect.width / 2 - parseFloat(bubble.style.left))}px`);
  }
  function show(from: HTMLButtonElement) {
    anchor = from;
    render();
    bubble.hidden = false;
    place();
    triggers.forEach(trigger => { trigger.classList.remove('is-nudging'); trigger.setAttribute('aria-expanded', String(trigger === from)); });
    from.classList.remove('is-talking'); void from.offsetWidth; from.classList.add('is-talking');
  }
  function hide() {
    if (bubble.hidden) return;
    bubble.hidden = true;
    triggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    anchor = null;
  }
  // Any other touch or key closes the bubble and counts as activity for the idle nudge.
  root.addEventListener('pointerdown', event => {
    lastInput = performance.now();
    triggers.forEach(trigger => trigger.classList.remove('is-nudging'));
    const target = event.target as Node;
    if (!bubble.contains(target) && !triggers.some(trigger => trigger.contains(target))) hide();
  }, { signal, capture: true });
  root.addEventListener('keydown', event => { lastInput = performance.now(); if (event.key === 'Escape') hide(); }, { signal });
  window.addEventListener('resize', hide, { signal });
  // After a quiet spell 콩이 waves once in a while; it never opens the bubble by itself.
  const idle = window.setInterval(() => {
    const quiet = performance.now() - lastInput > idleNudgeMs && bubble.hidden && !document.querySelector('dialog[open]');
    triggers.forEach(trigger => trigger.classList.toggle('is-nudging', quiet));
  }, 1000);
  return {
    attach(button) {
      triggers.push(button);
      button.setAttribute('aria-label', '콩이에게 힌트 듣기. 다음에 할 일을 알려줘요');
      button.setAttribute('aria-controls', bubble.id);
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => { if (anchor === button) hide(); else show(button); }, { signal });
      button.addEventListener('animationend', event => { if (event.target === button) button.classList.remove('is-talking'); }, { signal });
    },
    dispose() { clearInterval(idle); events.abort(); bubble.remove(); },
  };
}
