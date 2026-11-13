import './npcDialogue.css';

/** Keep existing story wording while giving each sentence its own portrait beat. */
export function dialogueSentences(lines: readonly string[]): string[] {
  return lines.flatMap(text => text.split(/(?<=[.!?])\s+/).filter(Boolean));
}

/** One text animation per open dialogue. The caller retains all progression and reward logic. */
export function mountDialogueText(dialog: HTMLDialogElement, next: HTMLButtonElement, advance: (fromPanel: boolean) => void) {
  const paragraph = dialog.querySelector<HTMLElement>('[data-dialogue-text]')!;
  const visible = document.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  const readable = document.createElement('span');
  readable.className = 'npc-dialogue-readable';
  readable.setAttribute('role', 'status');
  const reserve = document.createElement('span');
  reserve.className = 'npc-dialogue-reserve';
  reserve.setAttribute('aria-hidden', 'true');
  paragraph.replaceChildren(visible, readable, reserve);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let frame = 0, text = '', label = '', typing = false;
  let reaction: Animation | undefined;

  function finish() {
    cancelAnimationFrame(frame);
    frame = 0;
    typing = false;
    visible.textContent = text;
    next.textContent = label;
    dialog.dataset.typing = 'false';
  }
  function proceed(fromPanel = false) {
    if (!dialog.open) return;
    if (typing) finish();
    else advance(fromPanel);
  }
  function stopMotion() {
    finish();
    reaction?.cancel();
  }
  next.addEventListener('click', () => proceed(), { signal: events.signal });
  dialog.addEventListener('click', event => {
    const target = event.target as Element;
    if (target.closest('.npc-dialogue-panel') && !target.closest('button, a')) proceed(true);
  }, { signal: events.signal });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.repeat || !(event.target as Element).closest('button, a')) {
      event.preventDefault();
      if (!event.repeat) proceed(true);
    }
  }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMotion();
  }, { signal: events.signal });
  window.addEventListener('pagehide', stopMotion, { signal: events.signal });
  reduced.addEventListener('change', () => {
    if (reduced.matches) stopMotion();
  }, { signal: events.signal });

  return {
    finish: stopMotion,
    show(fullText: string, nextLabel: string, entering = false) {
      finish();
      reaction?.cancel();
      text = fullText;
      label = nextLabel;
      readable.textContent = fullText;
      reserve.textContent = fullText;
      if (reduced.matches || document.hidden) { finish(); return; }
      visible.textContent = '';
      typing = true;
      dialog.dataset.typing = 'true';
      next.textContent = '문장 바로 보기';
      const characters = Array.from(fullText), start = performance.now();
      function tick(now: number) {
        if (!dialog.isConnected || !dialog.open) { finish(); return; }
        const count = Math.floor((now - start) / 28) + 1;
        visible.textContent = characters.slice(0, count).join('');
        if (count >= characters.length) finish();
        else frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
      const character = dialog.querySelector<HTMLElement>('.npc-dialogue-character');
      reaction = character?.animate(
        entering
          ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }]
          : [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)', offset: .4 }, { transform: 'translateY(0)' }],
        { duration: entering ? 280 : 240, easing: 'ease-out' },
      );
    },
    destroy() {
      stopMotion();
      events.abort();
    },
  };
}
