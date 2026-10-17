import './requestLetter.css';
import { villageRequests, type RequestStage } from './requestBoard';
import { villageRewards } from './villageStory';
import { withParticle } from './screens/village';

/** The client's letter that arrives when a request opens on a mission screen.
 * "의뢰 받기" runs the screen's own entry function; closing keeps the screen's request bar as it was. */
export function showRequestLetter(root: HTMLElement, stage: RequestStage, accept: () => void): HTMLDialogElement {
  const request = villageRequests[stage];
  const dialog = document.createElement('dialog');
  dialog.className = 'request-letter';
  dialog.setAttribute('aria-labelledby', 'request-letter-title');
  dialog.innerHTML = `<div class="request-letter-paper">
    <span class="request-letter-stamp" aria-hidden="true">의뢰</span>
    <div class="request-letter-heading"><img class="request-letter-portrait" alt="" draggable="false"><div><span class="request-letter-role">${villageRewards[stage].name} 의뢰인</span><h2 id="request-letter-title">${withParticle(request.client, '이', '가')} 보낸 편지</h2></div></div>
    <p class="request-letter-body">${request.quote}</p>
    <p class="request-letter-sign">— ${request.client}</p>
    <div class="request-letter-actions"><button class="request-letter-later" id="request-letter-later">나중에 볼게요</button><button class="button button-primary" id="request-letter-accept">의뢰 받기 →</button></div>
  </div>`;
  const portrait = dialog.querySelector<HTMLImageElement>('.request-letter-portrait')!;
  portrait.src = `${import.meta.env.BASE_URL}assets/village/npc/${request.pose}.webp`;
  portrait.style.filter = request.hue ? `hue-rotate(${request.hue}deg) saturate(1.2)` : '';
  dialog.querySelector('#request-letter-later')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('#request-letter-accept')!.addEventListener('click', () => { dialog.close(); accept(); });
  dialog.addEventListener('close', () => dialog.remove());
  root.append(dialog);
  dialog.showModal();
  return dialog;
}

/** Shows the letter once per stage per app session so a screen re-render does not repeat it. */
const shown = new Set<RequestStage>();
export function letterOnce(root: HTMLElement, stage: RequestStage, accept: () => void): void {
  if (shown.has(stage)) return;
  shown.add(stage);
  // The mission card (or another modal) may still be open on entry; the letter waits its turn instead of stacking on top.
  const open = () => { if (!root.isConnected) return; if (document.querySelector('.modal-layer, dialog[open]')) { window.setTimeout(open, 400); return; } showRequestLetter(root, stage, accept); };
  open();
}
