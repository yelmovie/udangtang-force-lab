import './requestLetter.css';
import { villageRequests, type RequestStage } from './requestBoard';
import { villageRewards } from './villageStory';
import { mountDialogueText } from './npcDialogue';
import { mountDialogueVoice, setDialoguePortrait } from './npcDialogueVoice';
import type { SaveData } from './state';

/** Label of the button that ends level 1 and opens the letter. Guide lines quote this, so they never name a button that is not there. */
export const requestOpenLabel = '실험 마치고 의뢰 보기';

/** The client's letter that arrives when a request opens on a mission screen.
 * "의뢰 받기" runs the screen's own entry function; closing keeps the screen's request bar as it was. */
export function showRequestLetter(root: HTMLElement, stage: RequestStage, accept: () => void, settings: () => Pick<SaveData, 'soundOn' | 'soundVolume'> = () => ({ soundOn: false })): HTMLDialogElement {
  const existing = root.querySelector<HTMLDialogElement>('.request-letter[open]');
  if (existing) return existing;
  const request = villageRequests[stage];
  const dialog = document.createElement('dialog');
  dialog.className = 'request-letter npc-dialogue';
  dialog.setAttribute('aria-labelledby', 'request-letter-title');
  dialog.innerHTML = `<div class="npc-dialogue-stage"><div class="npc-dialogue-character"><span class="npc-dialogue-frame" aria-hidden="true"></span></div><div class="request-letter-paper npc-dialogue-panel">
    <h2 class="npc-dialogue-name" id="request-letter-title">${request.client}</h2>
    <button class="npc-dialogue-close" id="request-letter-close" aria-label="의뢰 대화 닫기">×</button>
    <p class="request-letter-body" data-dialogue-text></p>
    <div class="npc-dialogue-bottom"><div class="npc-dialogue-meta"><span>${villageRewards[stage].name} 의뢰인</span><button class="npc-dialogue-replay" type="button" data-dialogue-voice hidden>다시 듣기</button></div>
    <div class="request-letter-actions"><button class="request-letter-later" id="request-letter-later">나중에 볼게요</button><button class="npc-dialogue-next" id="request-letter-accept">의뢰 받기</button></div></div>
  </div></div>`;
  setDialoguePortrait(dialog.querySelector<HTMLElement>('.npc-dialogue-frame')!, request.pose);
  const voice = mountDialogueVoice(dialog, settings);
  let accepted = false;
  const next = dialog.querySelector<HTMLButtonElement>('#request-letter-accept')!;
  const text = mountDialogueText(dialog, next, fromPanel => {
    if (fromPanel) { next.focus(); return; }
    if (accepted) return;
    accepted = true;
    voice.stop();
    dialog.close();
    accept();
  });
  function showLine() {
    text.show(request.quote, '의뢰 받기', true);
    voice.show(`npc-dialogue/${stage}-request`);
  }
  dialog.querySelector('#request-letter-later')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('#request-letter-close')!.addEventListener('click', () => dialog.close());
  // A whole-screen render can remove an open native dialog without firing close.
  const removal = new MutationObserver(() => {
    if (!dialog.isConnected) { voice.destroy(); text.destroy(); removal.disconnect(); }
  });
  dialog.addEventListener('close', () => { voice.destroy(); text.destroy(); removal.disconnect(); dialog.remove(); }, { once: true });
  root.append(dialog);
  removal.observe(root, { childList: true });
  if (root.parentElement) removal.observe(root.parentElement, { childList: true });
  dialog.showModal();
  showLine();
  next.focus();
  return dialog;
}
