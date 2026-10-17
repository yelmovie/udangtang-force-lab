export type LifeObservation = {
  tool: 'lever' | 'ramp'; source: 'around' | 'example'; object: string; use: string; shared: boolean;
};
export function retainLifeObservation(value: unknown): LifeObservation | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Partial<LifeObservation>;
  if (!['lever', 'ramp'].includes(raw.tool ?? '') || !['around', 'example'].includes(raw.source ?? '')) return;
  return { tool: raw.tool!, source: raw.source!, object: typeof raw.object === 'string' ? raw.object.slice(0, 80) : '', use: typeof raw.use === 'string' ? raw.use.slice(0, 160) : '', shared: raw.shared === true };
}
export function hasLifeObservation(value: LifeObservation | undefined): boolean {
  return !!value && !!value.object.trim() && !!value.use.trim();
}

/* ===== Picture cards: the student picks what they saw, the principle comes with the card. ===== */
export type LifeCard = { id: string; name: string; tool: LifeObservation['tool']; how: string; uses: string[]; svg: string };
export const LIFE_OTHER = 'other';
export const lifeToolNames: Record<LifeObservation['tool'], string> = { lever: '지레', ramp: '빗면' };
const lifeToolIs: Record<LifeObservation['tool'], string> = { lever: '지레예요', ramp: '빗면이에요' };
export const lifeCards: LifeCard[] = [
  { id: 'opener', name: '병따개', tool: 'lever', how: '받침점에 대고 손잡이를 들면 뚜껑이 올라와요.', uses: ['병뚜껑을 딸 때', '캔 뚜껑을 들어 올릴 때'],
    svg: '<rect x="16" y="42" width="28" height="34" rx="5" fill="#9dbdae"/><rect x="22" y="30" width="16" height="14" fill="#9dbdae"/><rect x="19" y="25" width="22" height="7" fill="#d99b35"/><path d="M22 24L108 12L110 21L40 31Z" fill="#527c83"/><circle cx="30" cy="27" r="3.5" fill="#b64d32"/>' },
  { id: 'scissors', name: '가위', tool: 'lever', how: '가운데 못이 받침점이 되어 날이 종이를 눌러요.', uses: ['종이를 자를 때', '끈이나 테이프를 자를 때'],
    svg: '<path d="M60 40L112 18M60 40L112 62" stroke="#7d8d94" stroke-width="6" stroke-linecap="round"/><path d="M36 30L60 40L36 50" fill="none" stroke="#d26b4a" stroke-width="6"/><circle cx="25" cy="26" r="12" fill="none" stroke="#d26b4a" stroke-width="6"/><circle cx="25" cy="54" r="12" fill="none" stroke="#d26b4a" stroke-width="6"/><circle cx="60" cy="40" r="4" fill="#344849"/>' },
  { id: 'seesaw', name: '시소', tool: 'lever', how: '가운데 받침점을 두고 한쪽을 누르면 다른 쪽이 올라가요.', uses: ['친구와 오르내리며 놀 때', '무거운 쪽과 가벼운 쪽을 비교할 때'],
    svg: '<path d="M4 75H116" stroke="#9dbdae" stroke-width="4"/><path d="M49 74L60 50L71 74Z" fill="#d99b35"/><path d="M10 62L110 38" stroke="#5986a2" stroke-width="8" stroke-linecap="round"/><circle cx="20" cy="48" r="8" fill="#e08c6a"/><circle cx="100" cy="24" r="8" fill="#7aa86b"/>' },
  { id: 'hammer', name: '장도리', tool: 'lever', how: '머리를 받침점으로 삼아 손잡이를 당기면 못이 뽑혀요.', uses: ['못을 뽑을 때', '붙은 판자를 떼어 낼 때'],
    svg: '<rect x="6" y="62" width="108" height="12" rx="2" fill="#d7b37b"/><path d="M78 62V48" stroke="#7d8d94" stroke-width="4"/><path d="M24 18L80 52" stroke="#b8794b" stroke-width="9" stroke-linecap="round"/><path d="M72 40L98 46L94 60L80 62L70 52Z" fill="#527c83"/>' },
  { id: 'wheelbarrow', name: '손수레', tool: 'lever', how: '바퀴가 받침점이 되어 손잡이를 들면 짐이 가볍게 들려요.', uses: ['무거운 짐을 옮길 때', '흙이나 모래를 나를 때'],
    svg: '<path d="M18 28H80L72 50H28Z" fill="#5986a2"/><path d="M30 50L114 38" stroke="#b8794b" stroke-width="6" stroke-linecap="round"/><path d="M84 46L88 72" stroke="#b8794b" stroke-width="5"/><circle cx="28" cy="62" r="12" fill="#344849"/><circle cx="28" cy="62" r="4" fill="#e6e6e6"/>' },
  { id: 'wheelchair-ramp', name: '휠체어 경사로', tool: 'ramp', how: '높은 턱까지 비스듬한 길을 따라 조금씩 올라가요.', uses: ['휠체어로 턱을 오를 때', '유모차를 밀어 올릴 때'],
    svg: '<path d="M4 74L84 38V74Z" fill="#d7b37b"/><rect x="84" y="38" width="32" height="36" fill="#799b8f"/><path d="M38 34V54H54" fill="none" stroke="#5986a2" stroke-width="5" stroke-linejoin="round"/><circle cx="46" cy="58" r="10" fill="none" stroke="#344849" stroke-width="4"/>' },
  { id: 'stair-slide', name: '계단 옆 미끄럼판', tool: 'ramp', how: '계단 대신 비스듬한 판을 따라 바퀴를 굴려 올려요.', uses: ['자전거를 끌고 올라갈 때', '수레를 밀어 올릴 때'],
    svg: '<path d="M8 76H32V64H52V52H72V40H92V28H114V76Z" fill="#c9c2b2"/><path d="M8 68L112 20" stroke="#d99b35" stroke-width="7" stroke-linecap="round"/>' },
  { id: 'screw', name: '나사', tool: 'ramp', how: '빙글빙글 감긴 빗면을 따라 돌리면 조금씩 들어가요.', uses: ['나무에 단단히 박을 때', '두 물건을 붙여 고정할 때'],
    svg: '<rect x="12" y="28" width="16" height="24" rx="3" fill="#7d8d94"/><path d="M28 33H96L112 40L96 47H28Z" fill="#a9b6bb"/><path d="M38 32L45 48M50 32L57 48M62 32L69 48M74 32L81 48M86 32L93 48" stroke="#527c83" stroke-width="3"/>' },
];
export type LifePlace = { id: string; label: string; tag: string; source: LifeObservation['source'] };
export const lifePlaces: LifePlace[] = [
  { id: 'school', label: '학교', tag: '학교', source: 'around' },
  { id: 'home', label: '집', tag: '집', source: 'around' },
  { id: 'playground', label: '놀이터', tag: '놀이터', source: 'around' },
  { id: 'street', label: '길', tag: '길', source: 'around' },
  { id: 'picture', label: '그림에서 봤어요', tag: '그림', source: 'example' },
];

/** What the student has picked so far; `useChoice` is a card's preset use, `customUse` a typed one. */
export type LifeDraft = {
  cardId: string; otherName: string; otherTool?: LifeObservation['tool'];
  placeId: string; useChoice: string; customUse: string; shared: boolean;
};
export const emptyLifeDraft = (): LifeDraft => ({ cardId: '', otherName: '', placeId: '', useChoice: '', customUse: '', shared: false });
export const lifeCard = (id: string) => lifeCards.find(card => card.id === id);
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export function lifeDraftName(draft: LifeDraft): string {
  return draft.cardId === LIFE_OTHER ? clean(draft.otherName) : lifeCard(draft.cardId)?.name ?? '';
}
/** A listed card decides lever or ramp; only "목록에 없어요" asks the student. */
export function lifeDraftTool(draft: LifeDraft): LifeObservation['tool'] | undefined {
  return draft.cardId === LIFE_OTHER ? draft.otherTool : lifeCard(draft.cardId)?.tool;
}
export function lifeDraftUse(draft: LifeDraft): string {
  return clean(draft.useChoice || draft.customUse).replace(/[.。]+$/, '');
}
export function lifeStepDone(draft: LifeDraft, step: 1 | 2 | 3): boolean {
  if (step === 1) return !!lifeDraftName(draft) && !!lifeDraftTool(draft);
  if (step === 2) return lifePlaces.some(place => place.id === draft.placeId);
  return !!lifeDraftUse(draft);
}
/** Picking a picture alone is not an observation: tool, place and use are all required. */
export function canFinishLifeDraft(draft: LifeDraft): boolean {
  return lifeStepDone(draft, 1) && lifeStepDone(draft, 2) && lifeStepDone(draft, 3);
}

/** Stored as readable text ("학교 · 병따개") so the result screen and old records keep working. */
export function lifeDraftToObservation(draft: LifeDraft): LifeObservation {
  const place = lifePlaces.find(item => item.id === draft.placeId);
  return {
    tool: lifeDraftTool(draft) ?? 'ramp',
    source: place?.source ?? 'around',
    object: [place?.tag ?? '', lifeDraftName(draft)].filter(Boolean).join(' · ').slice(0, 80),
    use: lifeDraftUse(draft).slice(0, 160),
    shared: draft.shared,
  };
}
/** Reads card-made records back into picks; free-typed (older) text becomes an editable "목록에 없어요" entry. */
export function lifeDraftFromObservation(value: LifeObservation | undefined): LifeDraft {
  const draft = emptyLifeDraft();
  if (!value) return draft;
  draft.shared = value.shared;
  let name = clean(value.object);
  const [head, ...rest] = name.split(' · ');
  const place = lifePlaces.find(item => item.tag === head);
  if (place) { draft.placeId = place.id; name = rest.join(' · '); }
  else if (value.source === 'example') draft.placeId = 'picture';
  const card = lifeCards.find(item => item.name === name);
  if (card) draft.cardId = card.id;
  else if (name) { draft.cardId = LIFE_OTHER; draft.otherName = name; draft.otherTool = value.tool; }
  const use = clean(value.use);
  if (card?.uses.includes(use)) draft.useChoice = use;
  else draft.customUse = use;
  return draft;
}
export function lifeShareSentence(draft: LifeDraft): string {
  const name = lifeDraftName(draft) || '__';
  const use = lifeDraftUse(draft);
  const usePart = !use ? '__할 때' : use.endsWith('때') ? use : `“${use}” 할 때`;
  return `내가 본 도구는 ${name}이고, ${usePart} 써요.`;
}
export function lifeFirstOpenStep(draft: LifeDraft): 1 | 2 | 3 {
  return !lifeStepDone(draft, 1) ? 1 : !lifeStepDone(draft, 2) ? 2 : 3;
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const cardSvg = (svg: string) => `<svg viewBox="0 0 120 80" aria-hidden="true" focusable="false">${svg}</svg>`;
const stepTitles = ['내가 본 도구를 골라요', '어디서 봤어요?', '무엇을 할 때 쓰나요?'];

/** A student's description and self-reported sharing; never an automatic mastery grade. */
export function openLifeObservation(options: {
  app: HTMLElement; value?: LifeObservation; onSave: (value: LifeObservation) => void; onDone: () => void;
}): void {
  const draft = lifeDraftFromObservation(options.value);
  let step = lifeFirstOpenStep(draft);
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  const wasInert = options.app.inert;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  options.app.inert = true;
  modal.innerHTML = `<section class="modal-card life-card" role="dialog" aria-modal="true" aria-labelledby="life-title">
    <div class="settings-heading"><h2 id="life-title">생활 속 도구를 찾아요</h2><button type="button" id="life-close" aria-label="공방으로 돌아가기">×</button></div>
    <ol class="life-steps">${['도구', '장소', '쓰임'].map((label, i) => `<li data-step="${i + 1}"><span aria-hidden="true">${i + 1}</span>${label}</li>`).join('')}</ol>
    <p class="life-picked" id="life-picked" hidden></p>
    <div class="life-step" data-step="1">
      <h3 tabindex="-1">${stepTitles[0]}</h3>
      <div class="life-card-grid">${lifeCards.map(card => `<button type="button" class="life-pick" data-card="${card.id}" aria-pressed="false">${cardSvg(card.svg)}<span>${card.name}</span></button>`).join('')}</div>
      <div class="life-other">
        <button type="button" class="life-pick life-other-pick" data-card="${LIFE_OTHER}" aria-pressed="false">목록에 없어요</button>
        <div class="life-other-fields" id="life-other-fields" hidden>
          <input id="life-other-name" maxlength="30" aria-label="내가 본 도구 이름" placeholder="도구 이름 (예: 손톱깎이)">
          <div class="life-other-tool" role="group" aria-label="어떤 원리인가요?">${(['lever', 'ramp'] as const).map(tool => `<button type="button" class="life-pick" data-other-tool="${tool}" aria-pressed="false">${lifeToolNames[tool]}</button>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="life-step" data-step="2" hidden>
      <h3 tabindex="-1">${stepTitles[1]}</h3>
      <div class="life-place-grid">${lifePlaces.map(place => `<button type="button" class="life-pick" data-place="${place.id}" aria-pressed="false">${place.label}</button>`).join('')}</div>
    </div>
    <div class="life-step" data-step="3" hidden>
      <h3 tabindex="-1">${stepTitles[2]}</h3>
      <div class="life-use-grid" id="life-use-grid"></div>
      <label class="life-label" id="life-custom-label">직접 짧게 써요<input id="life-custom-use" maxlength="60" placeholder="예: 물건을 들어 올릴 때"></label>
      <p class="life-share" id="life-share" aria-live="polite"></p>
      <label class="life-shared"><input type="checkbox" id="life-shared">친구나 선생님에게 설명했어요 (선택)</label>
    </div>
    <p id="life-status" role="status"></p>
    <div class="life-nav"><button type="button" class="button button-secondary" id="life-back">이전</button><button type="button" class="button button-primary" id="life-next">다음</button><button type="button" class="button button-primary" id="life-done">관찰 기록으로 마치기</button></div>
  </section>`;
  const field = <T extends HTMLElement>(id: string) => modal.querySelector<T>(`#${id}`)!;
  const all = <T extends HTMLElement>(selector: string) => [...modal.querySelectorAll<T>(selector)];
  const save = () => options.onSave(lifeDraftToObservation(draft));
  const statusText = (): string => {
    if (step === 1) {
      if (draft.cardId === LIFE_OTHER) return lifeStepDone(draft, 1) ? `고른 원리: ${lifeToolNames[draft.otherTool!]}` : '도구 이름을 쓰고 지레인지 빗면인지 골라요.';
      const card = lifeCard(draft.cardId);
      return card ? `${card.how} ${lifeToolIs[card.tool]}.` : '주변에서 본 도구와 닮은 그림을 골라요.';
    }
    if (step === 2) return lifeStepDone(draft, 2) ? '좋아요. 이제 쓰임을 골라요.' : '도구를 본 곳을 골라요.';
    return canFinishLifeDraft(draft) ? '내가 본 도구와 쓰임을 기록했어요.' : '쓰임을 하나 고르거나 짧게 써요.';
  };
  const render = () => {
    const card = lifeCard(draft.cardId);
    const pressed = (selector: string, key: string, value: string | undefined) =>
      all<HTMLButtonElement>(selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[key] === value)));
    pressed('[data-card]', 'card', draft.cardId);
    pressed('[data-other-tool]', 'otherTool', draft.otherTool);
    pressed('[data-place]', 'place', draft.placeId);
    pressed('[data-use]', 'use', draft.useChoice);
    field('life-other-fields').hidden = draft.cardId !== LIFE_OTHER;
    all<HTMLElement>('.life-step').forEach(panel => { panel.hidden = Number(panel.dataset.step) !== step; });
    all<HTMLElement>('.life-steps li').forEach(item => {
      const n = Number(item.dataset.step) as 1 | 2 | 3;
      item.classList.toggle('is-current', n === step);
      item.classList.toggle('is-done', n !== step && lifeStepDone(draft, n));
      if (n === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    const tool = lifeDraftTool(draft);
    const place = lifePlaces.find(item => item.id === draft.placeId);
    field('life-picked').hidden = step === 1 || !lifeDraftName(draft);
    field('life-picked').textContent = `내가 고른 도구: ${lifeDraftName(draft)}${tool ? ` (${lifeToolNames[tool]})` : ''}`
      + (step === 3 && place ? ` · ${place.id === 'picture' ? place.label : `${place.label}에서 봤어요`}` : '');
    field('life-custom-label').firstChild!.textContent = card ? '보기에 없으면 직접 짧게 써요 (선택)' : '무엇을 할 때 쓰는지 짧게 써요';
    field('life-share').textContent = `친구에게 이렇게 말해요: ${lifeShareSentence(draft)}`;
    field('life-status').textContent = statusText();
    field<HTMLButtonElement>('life-back').hidden = step === 1;
    field<HTMLButtonElement>('life-next').hidden = step === 3;
    field<HTMLButtonElement>('life-next').disabled = step !== 3 && !lifeStepDone(draft, step);
    field<HTMLButtonElement>('life-done').hidden = step !== 3;
    field<HTMLButtonElement>('life-done').disabled = !canFinishLifeDraft(draft);
  };
  const renderUses = () => {
    const card = lifeCard(draft.cardId);
    field('life-use-grid').innerHTML = card ? card.uses.map(use => `<button type="button" class="life-pick" data-use="${escape(use)}" aria-pressed="false">${escape(use)}</button>`).join('') : '';
    field('life-use-grid').hidden = !card;
    field<HTMLInputElement>('life-custom-use').value = draft.customUse;
  };
  const goTo = (next: 1 | 2 | 3) => {
    step = next;
    if (step === 3) renderUses();
    render();
    modal.querySelector<HTMLElement>(`.life-step[data-step="${step}"] h3`)!.focus();
  };
  const close = () => { options.app.inert = wasInert; modal.remove(); if (previous?.isConnected) previous.focus(); };

  modal.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    const { card, otherTool, place, use } = button.dataset;
    if (button.id === 'life-close') { close(); return; }
    if (button.id === 'life-back') { goTo((step - 1) as 1 | 2); return; }
    if (button.id === 'life-next') { if (lifeStepDone(draft, step)) goTo((step + 1) as 2 | 3); return; }
    if (button.id === 'life-done') { if (!canFinishLifeDraft(draft)) return; save(); close(); options.onDone(); return; }
    if (card !== undefined) { if (card !== draft.cardId) draft.useChoice = ''; draft.cardId = card; }
    else if (otherTool === 'lever' || otherTool === 'ramp') draft.otherTool = otherTool;
    else if (place !== undefined) draft.placeId = place;
    else if (use !== undefined) {
      draft.useChoice = draft.useChoice === use ? '' : use;
      if (draft.useChoice) { draft.customUse = ''; field<HTMLInputElement>('life-custom-use').value = ''; }
    } else return;
    save(); render();
    if (card === LIFE_OTHER && !draft.otherName) field('life-other-name').focus();
  });
  modal.addEventListener('input', event => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'life-other-name') draft.otherName = target.value;
    else if (target.id === 'life-custom-use') { draft.customUse = target.value; if (target.value.trim()) draft.useChoice = ''; }
    else if (target.id === 'life-shared') draft.shared = target.checked;
    else return;
    save(); render();
  });
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key !== 'Tab') return;
    const controls = all<HTMLElement>('button:not(:disabled), input').filter(el => el.getClientRects().length);
    if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus(); }
  });

  field<HTMLInputElement>('life-other-name').value = draft.otherName;
  field<HTMLInputElement>('life-shared').checked = draft.shared;
  if (step === 3) renderUses();
  render();
  document.body.append(modal); field('life-close').focus();
}
