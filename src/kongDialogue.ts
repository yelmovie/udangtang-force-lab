import { mountDialogueText } from './npcDialogue';
import { mountDialogueVoice, setDialoguePortrait } from './npcDialogueVoice';
import type { SaveData } from './state';

const greeting = '안녕! 나는 콩이야. 물건을 밀고 당기면서 힘이 하는 일을 함께 알아보자. 한 번에 한 가지씩 바꾸며 살펴보면 새로운 발견을 할 수 있어!';

export function installKongDialogue(settings: () => Pick<SaveData, 'soundOn' | 'soundVolume'>) {
  let closeCurrent: (() => void) | undefined;
  const ensureButton = () => {
    document.querySelectorAll<HTMLElement>('.corgi-hint-body').forEach(body => {
      if (body.querySelector('[data-npc-voice]') || !body.childElementCount) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'corgi-greeting-button';
      button.dataset.npcVoice = 'true';
      button.textContent = '콩이의 인사 듣기';
      button.addEventListener('click', () => open(body, button));
      body.append(button);
    });
  };
  const observer = new MutationObserver(ensureButton);
  observer.observe(document.body, { childList: true, subtree: true });
  ensureButton();

  function open(body: HTMLElement, trigger: HTMLButtonElement) {
    if (closeCurrent) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'npc-dialogue kong-dialogue';
    dialog.setAttribute('aria-labelledby', 'kong-dialogue-name');
    dialog.innerHTML = `<div class="npc-dialogue-stage"><div class="npc-dialogue-character"><span class="npc-dialogue-frame" aria-hidden="true"></span></div>
      <div class="npc-dialogue-panel"><h2 class="npc-dialogue-name" id="kong-dialogue-name">콩이</h2>
      <button class="npc-dialogue-close" type="button" aria-label="대화 닫기">×</button>
      <p data-dialogue-text></p><div class="npc-dialogue-bottom"><div class="npc-dialogue-meta"><span>탐구 친구</span>
      <button class="npc-dialogue-replay" type="button" data-dialogue-voice hidden>다시 듣기</button></div>
      <button class="npc-dialogue-next" type="button">탐구하러 갈게!</button></div></div></div>`;
    const next = dialog.querySelector<HTMLButtonElement>('.npc-dialogue-next')!;
    const text = mountDialogueText(dialog, next, () => dialog.close());
    const voice = mountDialogueVoice(dialog, settings);
    setDialoguePortrait(dialog.querySelector<HTMLElement>('.npc-dialogue-frame')!, 'kong');
    const removed = new MutationObserver(() => {
      if (!body.isConnected || body.closest('[hidden]')) dialog.close();
    });
    closeCurrent = () => {
      removed.disconnect(); voice.destroy(); text.destroy(); dialog.remove();
      closeCurrent = undefined;
      if (trigger.isConnected && !body.closest('[hidden]')) trigger.focus({ preventScroll: true });
    };
    dialog.querySelector('.npc-dialogue-close')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', closeCurrent, { once: true });
    document.body.append(dialog);
    removed.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    dialog.showModal();
    text.show(greeting, '탐구하러 갈게!', true);
    voice.show('npc-welcome');
    next.focus({ preventScroll: true });
  }
}
