import type { AppContext } from '../appTypes';
import { icons } from '../icons';
import { balanceObjects } from '../data';
import type { BalanceRun } from '../state';
import { requestsEnabled } from '../state';
import { mountCompanion } from '../sprites';
import { setTapHint } from '../interactionHints';
import { letterOnce } from '../requestLetter';
import { showPredictionChip } from '../predictionChip';
import { isThrifty, judgePick, mysteryComplete, mysteryRound, mysteryRoundCount, nextMysteryRound, pickHint, relationText, thriftyBudget, weigh, type MysteryRecord, type MysteryRound } from '../balanceModel';
import '../instruments.css';
import '../balance.css';

const names: Record<BalanceRun['prediction'], string> = { left: '왼쪽이 내려감', right: '오른쪽이 내려감', level: '수평' };
const objectName = (id: string) => balanceObjects.find(object => object.id === id)?.label ?? id;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** After the pin comes out the beam overshoots a few times, each swing smaller, then rests. */
function wobble(angle: number): Keyframe[] {
  const swing = angle || 5;
  const swings = [0, .35, -.22, .12, -.05, 0], offsets = [0, .3, .5, .68, .84, 1];
  return swings.map((k, i) => ({ transform: `rotate(${i === 0 ? 0 : angle + swing * k}deg)`, offset: offsets[i], easing: 'ease-in-out' }));
}

export function mountBalance(root: HTMLElement, context: AppContext): () => void {
  const state = context.save.balance;
  const events = new AbortController();
  let selectedObject: string | null = null;
  let active = true;
  let busy = false;
  let waiting = false;
  let animation: Animation | null = null;
  let timer = 0;
  let suppressClickUntil = 0;
  const last = state.runs.at(-1);
  let visibleOutcome: BalanceRun['actual'] | null = last && last.left === state.left && last.right === state.right && state.prediction === null ? last.actual : null;
  let shownRun: BalanceRun | null = visibleOutcome ? last! : null;
  const hasLevel = () => state.runs.some(run => run.actual === 'level');
  const hasTilt = () => state.runs.some(run => run.actual !== 'level');
  const canFinish = () => hasLevel() && hasTilt();
  // Level 2 (mystery boxes) is session play; only levels.balance { cleared, attempts } is saved.
  const levelRecord = () => context.save.levels?.balance;
  const mysteryDone = () => mysteryComplete(levelRecord());
  let level: 1 | 2 = canFinish() && levelRecord() ? 2 : 1;
  let roundIndex = 0;
  let round: MysteryRound | null = null;
  const mystery: { left: string | null; right: string | null } = { left: null, right: null };
  let records: MysteryRecord[] = [];
  let shownRecord: MysteryRecord | null = null;
  let uses = 0, clue = -1, thrifty = false, found: string | null = null;
  const pans = (): { left: string | null; right: string | null } => level === 1 ? state : mystery;
  const itemIds = (): readonly string[] => level === 1 ? balanceObjects.map(object => object.id) : round?.boxes ?? [];
  const itemName = (id: string) => level === 1 ? objectName(id) : `${id} 상자`;
  const requestOpen = () => level === 1 && canFinish();
  const frozen = () => busy || waiting || (level === 2 && (!round || mysteryDone()));
  const canSave = () => !busy && !waiting && canFinish() && (mysteryDone() || !requestsEnabled(context.save));
  // Level 1 asks for a prediction once both pans hold an object and nothing has been observed yet.
  const predictPending = () => level === 1 && !requestOpen() && !!state.left && !!state.right && !state.prediction && !visibleOutcome;
  let feedback = level === 2
    ? mysteryDone() ? '의뢰를 모두 해결했어요. 발견 저장을 눌러요.' : '수수께끼 상자 의뢰를 이어서 해요. 두 상자를 양쪽에 놓고 비교해요.'
    : canFinish() ? '다리 점검원의 의뢰가 도착했어요. 의뢰를 받아 수수께끼 상자를 풀어요.' : '같은 크기의 물체 두 개를 놓고, 잠금핀을 뽑기 전에 예상해 봐요.';

  const objectArt = (id: string) => `<span class="instrument-object object-${id}" aria-hidden="true"><img src="${balanceObjects.find(object => object.id === id)!.image}" alt="" draggable="false"></span>`;
  // Every mystery box uses the same wrapping; only the letter tag tells them apart.
  const mysteryArt = (id: string) => `<span class="instrument-object mystery-box" aria-hidden="true"><span class="mystery-wrap"><b>${id}</b></span></span>`;
  const itemArt = (id: string) => level === 1 ? objectArt(id) : mysteryArt(id);
  // Full-width bench: title, progress chips and the record button share one top row; results and questions open as a popup.
  root.innerHTML = `<section class="experiment-screen instrument-screen balance-screen">
    <div class="experiment-heading balance-topbar"><div><p class="eyebrow">02 · 균형 다리</p><h1>어느 물체가 더 무거울까?</h1></div>
      <div class="balance-goal" role="status" aria-live="polite"><span id="balance-tilt-goal">○ 기울기 발견</span><span id="balance-level-goal">○ 수평 발견</span><span id="balance-mystery-goal">○ 수수께끼 상자 0/${mysteryRoundCount}</span><span id="balance-uses" hidden></span></div>
      <div class="balance-top-tools"><button class="button button-primary" id="balance-request-open" hidden>의뢰 받기 →</button><button class="balance-record-button" id="balance-record" aria-haspopup="dialog"><span id="balance-record-label">기록 보기</span><b id="balance-count">0</b></button></div>
    </div>
    <div class="instrument-stage game-panel balance-field">
      <div class="instrument-phase" id="balance-phase"></div>
      <div class="balance-apparatus"><div class="balance-board" id="balance-board">
        <button class="balance-pan left" data-pan="left" aria-label="왼쪽 자리"><span class="balance-side">왼쪽</span><div class="pan-object" id="left-object"></div><strong class="balance-pan-name" id="left-name">물체 놓기</strong></button>
        <div class="balance-beam"></div>
        <button class="balance-pan right" data-pan="right" aria-label="오른쪽 자리"><span class="balance-side">오른쪽</span><div class="pan-object" id="right-object"></div><strong class="balance-pan-name" id="right-name">물체 놓기</strong></button>
      </div><div class="balance-pivot"></div><div class="balance-stand"></div></div>
      <div class="balance-lock" id="balance-lock"><span class="balance-lock-socket" aria-hidden="true"></span><button id="balance-test" class="balance-pin" aria-label="고리에 달린 잠금핀을 오른쪽으로 뽑아 기울기 확인"><img src="/assets/game/balance-lock-pin.webp" alt=""></button><span class="balance-lock-callout" id="balance-lock-callout">고리를 잡고 뽑기 →</span></div>
      <div class="balance-result" id="balance-result" role="status"></div>
      <div class="instrument-companion" id="balance-companion" aria-hidden="true"></div>
    </div>
    <div class="instrument-dock balance-dock">
      <div class="instrument-tools" data-level="1"><span class="dock-label">① 물체 두 개를 놓아요</span><div class="object-options">${balanceObjects.map(object => `<button class="object-card" data-object="${object.id}" aria-label="${object.label} 선택 또는 자리로 끌기">${objectArt(object.id)}<strong>${object.label}</strong></button>`).join('')}</div></div>
      <div class="instrument-tools" data-level="2"><span class="dock-label">① 상자 두 개를 놓아요 <small>겉모습은 모두 같아요</small></span><div class="object-options mystery-options" id="mystery-options"></div></div>
    </div>
    <div class="experiment-footer"><span class="feedback" id="balance-feedback" role="status"></span><button class="button button-primary" id="balance-finish" disabled>발견 저장 →</button></div>
  </section>`;
  const board = root.querySelector<HTMLElement>('#balance-board')!;
  const result = root.querySelector<HTMLElement>('#balance-result')!;
  const pin = root.querySelector<HTMLButtonElement>('#balance-test')!;
  const lock = root.querySelector<HTMLElement>('#balance-lock')!;
  const finish = root.querySelector<HTMLButtonElement>('#balance-finish')!;
  const requestButton = root.querySelector<HTMLButtonElement>('#balance-request-open')!;
  const recordButton = root.querySelector<HTMLButtonElement>('#balance-record')!;
  let popup: HTMLDialogElement | null = null;
  let popupKind: 'predict' | 'record' = 'record';
  let popupTimer = 0;
  // Weighing pose (one object in each hand) instead of the scale-holding art the other stages use.
  const companion = mountCompanion(root.querySelector<HTMLElement>('#balance-companion')!, 'idle', { student: 'balance-student', corgi: 'balance-corgi' });
  const tilt = (outcome: BalanceRun['actual'] | null) => outcome === 'left' ? -9 : outcome === 'right' ? 9 : 0;
  function reason(run: BalanceRun) {
    return run.actual === 'level' ? `${objectName(run.left)}과 ${objectName(run.right)}의 무게가 같아서 수평이에요.` : `${objectName(run.actual === 'left' ? run.left : run.right)}이 더 무거워서 그쪽이 내려갔어요.`;
  }
  function recordReason(record: MysteryRecord) {
    if (record.actual === 'level') return `${record.left} 상자와 ${record.right} 상자의 무게가 같아요.`;
    const [heavy, light] = record.actual === 'left' ? [record.left, record.right] : [record.right, record.left];
    return `${heavy} 상자가 ${light} 상자보다 무거워요.`;
  }
  function phaseText() {
    const p = pans();
    if (busy) return '기울기를 살펴봐요';
    if (level === 1) {
      if (canFinish()) return visibleOutcome ? '두 결과를 발견했어요! 의뢰를 받아요' : '다리 점검원의 의뢰를 받아요';
      return visibleOutcome ? '한 물체를 바꾸어 다시 비교해요' : !p.left || !p.right ? '① 양쪽에 물체를 하나씩 놓아요' : !state.prediction ? '② 어느 쪽이 내려갈지 예상해요' : '③ 고리를 누르거나 오른쪽으로 뽑아요';
    }
    if (mysteryDone()) return '의뢰 완료! 발견 저장을 눌러요';
    if (waiting) return '찾았어요! 다음 상자 꾸러미를 준비해요';
    const tag = `수수께끼 ${roundIndex + 1}/${mysteryRoundCount}`;
    return !p.left || !p.right ? `${tag} · 상자 두 개를 양쪽에 놓아요` : visibleOutcome ? `${tag} · 다시 비교하거나 제일 무거운 상자를 골라요` : `${tag} · 고리를 누르거나 오른쪽으로 뽑아요`;
  }
  function resultText() {
    const p = pans();
    if (level === 1) return shownRun ? `예상 ${names[shownRun.prediction]} → 관찰 ${names[shownRun.actual]} · ${reason(shownRun)}` : p.left && p.right ? state.prediction ? '예상을 골랐어요. 잠금핀을 뽑아 확인해요.' : '아직 잠겨 있어요. 예상한 뒤 핀을 뽑아 확인해요.' : '같은 크기, 다른 재질! 무게를 비교해요.';
    if (mysteryDone()) return '진짜 기둥 부품을 모두 찾았어요!';
    if (shownRecord) return `기록 「${relationText(shownRecord)}」 · ${recordReason(shownRecord)}`;
    return p.left && p.right ? '잠금핀을 뽑아 어느 상자가 무거운지 확인해요.' : '상자는 모두 똑같이 생겼어요. 수평대로만 알 수 있어요.';
  }
  function update() {
    const p = pans(), locked = frozen();
    for (const side of ['left','right'] as const) {
      const id = p[side];
      root.querySelector(`#${side}-object`)!.innerHTML = id ? itemArt(id) : '';
      root.querySelector(`#${side}-name`)!.textContent = id ? itemName(id) : level === 1 ? '물체 놓기' : '상자 놓기';
      const pan = root.querySelector<HTMLButtonElement>(`[data-pan="${side}"]`)!;
      pan.disabled = locked;
      pan.setAttribute('aria-label', `${side === 'left' ? '왼쪽' : '오른쪽'} 자리${id ? `, ${itemName(id)}` : ', 비어 있음'}`);
      setTapHint(pan, !locked && !!selectedObject && (!id || !!(p.left && p.right)));
    }
    board.style.setProperty('--tilt-deg', `${tilt(visibleOutcome)}deg`);
    root.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => { const id = button.dataset.object; button.disabled = locked; button.classList.toggle('selected',id === selectedObject); button.classList.toggle('is-found',level === 2 && id === found); setTapHint(button, !locked && !selectedObject && (!p.left || !p.right || !!visibleOutcome) && id !== p.left && id !== p.right); });
    pin.disabled = locked || !p.left || !p.right || (level === 1 && !state.prediction);
    lock.classList.toggle('is-open',!!visibleOutcome);
    lock.classList.toggle('is-ready',!pin.disabled);
    setTapHint(pin, !pin.disabled && !visibleOutcome);
    root.querySelectorAll<HTMLElement>('.instrument-dock > [data-level]').forEach(part => { part.hidden = Number(part.dataset.level) !== level; });
    requestButton.hidden = !requestOpen();
    if (requestOpen() && !busy) letterOnce(root, 'balance', enterMystery);
    requestButton.disabled = busy;
    setTapHint(requestButton, requestOpen() && !busy);
    recordButton.disabled = busy;
    root.querySelector('#balance-record-label')!.textContent = predictPending() ? '② 예상 고르기' : '기록 보기';
    setTapHint(recordButton, !busy && predictPending());
    finish.disabled = !canSave();
    root.querySelector('#balance-phase')!.textContent = phaseText();
    result.textContent = resultText();
    root.querySelector('#balance-tilt-goal')!.textContent = `${hasTilt() ? '✓' : '○'} 기울기 발견`;
    root.querySelector('#balance-level-goal')!.textContent = `${hasLevel() ? '✓' : '○'} 수평 발견`;
    root.querySelector('#balance-mystery-goal')!.textContent = `${mysteryDone() ? '✓' : '○'} 수수께끼 상자 ${Math.min(nextMysteryRound(levelRecord()), mysteryRoundCount)}/${mysteryRoundCount}`;
    root.querySelector('#balance-tilt-goal')!.classList.toggle('done',hasTilt());
    root.querySelector('#balance-level-goal')!.classList.toggle('done',hasLevel());
    root.querySelector('#balance-mystery-goal')!.classList.toggle('done',mysteryDone());
    root.querySelector('#balance-lock-callout')!.textContent = busy ? '잠금 해제!' : visibleOutcome ? '관찰 완료' : pin.disabled ? level === 1 ? '예상하면 뽑을 수 있어요' : '상자를 놓으면 뽑을 수 있어요' : '누르거나 뽑기 →';
    root.querySelector('#balance-feedback')!.textContent = feedback;
    root.querySelector('#balance-count')!.textContent = String(level === 1 ? state.runs.length : records.length);
    const usesChip = root.querySelector<HTMLElement>('#balance-uses')!;
    usesChip.hidden = level !== 2 || !round;
    usesChip.textContent = `수평대 ${uses}번${thrifty ? ' · 알뜰 탐정' : roundIndex === 0 ? ` · ${thriftyBudget}번 안에 알뜰 탐정` : ''}`;
    usesChip.classList.toggle('done', thrifty);
    if (popup) renderPopup();
  }
  /** One stage popup at a time: 'predict' asks before the pin comes out; 'record' shows the result, the records and the next question. */
  function popupContent(kind: 'predict' | 'record') {
    if (kind === 'predict') {
      const off = busy || !state.left || !state.right;
      return {
        label: '예상하기', title: '어느 쪽이 내려갈까?',
        lead: `왼쪽 ${objectName(state.left!)} · 오른쪽 ${objectName(state.right!)}. 잠금핀을 뽑기 전에 골라요.`,
        body: `<div class="predict-options balance-popup-predict">${(['left','level','right'] as const).map(id => `<button data-predict="${id}" aria-pressed="${id === state.prediction}" aria-label="${names[id]} 예상"${off ? ' disabled' : ''}>${id === 'left' ? icons.arrowDownLeft : id === 'right' ? icons.arrowDownRight : '═'} <span>${id === 'left' ? '왼쪽' : id === 'right' ? '오른쪽' : '수평'}</span></button>`).join('')}</div><button class="instrument-text-button" id="balance-swap"${off ? ' disabled' : ''}>${icons.swap} 두 물체 자리 바꾸기</button>`,
        actions: '<button class="button button-secondary" id="balance-popup-close">물체 다시 고르기</button>',
      };
    }
    const save = canSave() ? '<button class="button button-primary" id="balance-popup-finish">발견 저장 →</button>' : '';
    const keepGoing = (primary: boolean) => `<button class="button ${primary ? 'button-primary' : 'button-secondary'}" id="balance-popup-close">계속 실험하기</button>`;
    if (level === 1) {
      const run = shownRun;
      const next = canFinish() ? '무거운 쪽은 내려가고, 무게가 같으면 수평이에요.' : hasTilt() ? '이제 수평인 짝을 찾아봐요. 어떤 두 물체를 놓아 볼까요?' : hasLevel() ? '이제 기울어진 짝을 찾아봐요. 어떤 두 물체를 놓아 볼까요?' : '기울어진 짝과 수평인 짝을 하나씩 찾아요.';
      const rows = state.runs.slice(-5).reverse().map(item => `<div class="result-row"><span>${objectName(item.left)} : ${objectName(item.right)}</span><strong>${names[item.actual]}</strong></div>`).join('') || '<p>첫 발견을 기다리고 있어요.</p>';
      const request = requestOpen() ? '<div class="balance-request"><p class="balance-request-from">다리 점검원의 의뢰</p><p class="balance-request-text">똑같이 생긴 상자 중에 진짜 무거운 기둥 부품이 섞였어요. 찾아 주세요!</p></div>' : '';
      return {
        label: run ? '실험 결과' : '나의 발견',
        title: run ? run.prediction === run.actual ? '예상과 같아요!' : '예상과 달라도 괜찮아요!' : '지금까지의 발견',
        lead: run ? `예상 ${names[run.prediction]} → 관찰 ${names[run.actual]}. ${reason(run)}` : phaseText(),
        body: `<div class="balance-popup-runs"><strong>나의 발견 ${state.runs.length}</strong><div class="result-list">${rows}</div></div><p class="balance-popup-next">${next}</p>${request}`,
        actions: requestOpen() ? `${keepGoing(false)}<button class="button button-primary" id="balance-popup-request"${busy ? ' disabled' : ''}>의뢰 받기 →</button>` : `${save ? keepGoing(false) : keepGoing(true)}${save}`,
      };
    }
    const cards = records.map((record, i) => `<span class="mystery-record${i === clue ? ' is-clue' : ''}" data-actual="${record.actual === 'level' ? 'level' : 'tilt'}" aria-label="기록 ${i + 1}: ${recordReason(record)}">${relationText(record)}</span>`).join('') || `<p>${round ? '수평대로 비교하면 기록 카드가 쌓여요.' : '모든 상자 꾸러미를 해결했어요.'}</p>`;
    const picks = round && !mysteryDone() ? `<div class="mystery-pick"><span>② 어느 상자가 제일 무거울까요?</span><div class="mystery-picks">${round.boxes.map(id => `<button data-pick="${id}" aria-label="${id} 상자가 제일 무거워요"${frozen() || !records.length ? ' disabled' : ''}>${id}</button>`).join('')}</div></div>` : '';
    return {
      label: '의뢰 기록',
      title: mysteryDone() ? '의뢰를 모두 해결했어요!' : waiting && found ? `찾았어요! ${found} 상자` : shownRecord ? `기록 「${relationText(shownRecord)}」` : '비교 기록 카드',
      lead: feedback,
      body: `<div class="mystery-panel"><div class="mystery-panel-head"><strong>비교 기록 카드</strong><span>${round ? `수평대 ${uses}번` : '의뢰 완료'}</span>${thrifty ? '<span class="mystery-badge">알뜰 탐정</span>' : ''}</div><div class="mystery-records">${cards}</div>${picks}</div>`,
      actions: `${save ? keepGoing(false) : keepGoing(true)}${save}`,
    };
  }
  function renderPopup() {
    if (!popup) return;
    // Keep keyboard focus on the same control across a re-render.
    const focused = document.activeElement instanceof HTMLElement && popup.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = !focused ? '' : focused.id ? `#${focused.id}` : focused.dataset.pick ? `[data-pick="${focused.dataset.pick}"]` : focused.dataset.predict ? `[data-predict="${focused.dataset.predict}"]` : '';
    const kind = popupKind === 'predict' && predictPending() ? 'predict' : 'record';
    const content = popupContent(kind);
    popup.dataset.kind = kind;
    popup.innerHTML = `<div class="stage-popup-card"><button class="stage-popup-close" aria-label="닫기">×</button><span class="stage-popup-label">${content.label}</span><h2 id="balance-popup-title">${content.title}</h2><div class="stage-popup-body"><p class="stage-popup-lead">${content.lead}</p>${content.body}</div><div class="stage-popup-actions">${content.actions}</div></div>`;
    if (focusKey) popup.querySelector<HTMLElement>(focusKey)?.focus();
  }
  function openPopup(kind: 'predict' | 'record') {
    clearTimeout(popupTimer);
    // Never over a drag, the pin animation, or the client's letter.
    if (!active || busy || drag || document.querySelector('dialog.request-letter[open]')) return;
    popupKind = kind;
    if (!popup) {
      const dialog = popup = document.createElement('dialog');
      dialog.className = 'stage-popup balance-popup';
      dialog.setAttribute('aria-labelledby', 'balance-popup-title');
      dialog.addEventListener('click', event => { if (event.target === dialog || (event.target as Element).closest('.stage-popup-close, #balance-popup-close')) dialog.close(); });
      dialog.addEventListener('close', () => { dialog.remove(); if (popup === dialog) popup = null; });
      root.querySelector('.balance-screen')!.append(dialog);
      renderPopup();
      dialog.showModal();
    } else renderPopup();
    popup.querySelector<HTMLButtonElement>(popup.dataset.kind === 'predict' ? '[data-predict]:not(:disabled)' : '.stage-popup-actions .button-primary, #balance-popup-close')?.focus();
  }
  const closePopup = () => { clearTimeout(popupTimer); popup?.close(); };
  function startRound() {
    roundIndex = nextMysteryRound(levelRecord());
    round = roundIndex < mysteryRoundCount ? mysteryRound(roundIndex, Math.floor(Math.random() * 2 ** 31)) : null;
    mystery.left = mystery.right = null;
    records = []; shownRecord = null; visibleOutcome = null; uses = 0; clue = -1; found = null; selectedObject = null;
    const options = root.querySelector<HTMLElement>('#mystery-options')!;
    options.style.setProperty('--count', String(round?.boxes.length ?? 3));
    options.innerHTML = round ? round.boxes.map(id => `<button class="object-card mystery-card" data-object="${id}" aria-label="${id} 상자 선택 또는 자리로 끌기">${mysteryArt(id)}<strong>${id} 상자</strong></button>`).join('') : '<p class="mystery-empty">의뢰를 모두 해결했어요!</p>';
  }
  function enterMystery() {
    if (busy || level !== 1 || !canFinish()) return;
    closePopup();
    context.save.levels ??= {};
    context.save.levels.balance ??= { cleared: [], attempts: 0 };
    level = 2; shownRun = null;
    startRound();
    feedback = round ? `똑같이 생긴 상자 ${round.boxes.length}개 중 진짜 기둥 부품을 찾아요. 두 상자를 양쪽에 놓고 잠금핀을 뽑아 비교해요.` : '의뢰를 모두 해결했어요. 발견 저장을 눌러요.';
    context.commit(); context.sound(520); update();
    root.querySelector<HTMLButtonElement>('.mystery-card')?.focus({ preventScroll: true });
  }
  function countAttempt() {
    const record = levelRecord();
    if (record) record.attempts = Math.min(999, record.attempts + 1);
  }
  function recordMystery(record: MysteryRecord) {
    records = [...records, record]; uses++; shownRecord = record; visibleOutcome = record.actual; clue = -1;
    countAttempt();
    feedback = `「${relationText(record)}」 기록 카드가 생겼어요. ${recordReason(record)} 다른 상자와 더 비교하거나, 제일 무거운 상자를 골라요.`;
    busy = false; companion.setMood('observe'); context.commit(); context.sound(record.actual === 'level' ? 700 : 520); update();
    openPopup('record');
  }
  function pick(id: string) {
    if (frozen() || level !== 2 || !round || !records.length) return;
    countAttempt();
    const verdict = judgePick(round.boxes, records, id);
    if (verdict.result !== 'found') {
      // No penalty: point at the record that already answers it, or at the boxes not compared yet.
      clue = verdict.result === 'ruled-out' ? verdict.clue : -1;
      feedback = pickHint(verdict, id, records);
      companion.setMood('observe'); context.commit(); context.sound(520); update();
      return;
    }
    const record = levelRecord()!;
    record.cleared = [...new Set([...record.cleared, roundIndex])].sort((a, b) => a - b);
    const saving = isThrifty(roundIndex, uses);
    thrifty ||= saving;
    found = id; clue = -1;
    feedback = `찾았어요! ${id} 상자가 진짜 기둥 부품이에요. 수평대 ${uses}번의 기록을 이어서 알아냈어요.${saving ? ' 알뜰 탐정이에요!' : ''}`;
    companion.setMood('success'); context.commit(); context.sound(780);
    if (mysteryDone()) { feedback += ' 의뢰를 모두 해결했어요. 발견 저장을 눌러요.'; update(); return; }
    waiting = true; update();
    timer = window.setTimeout(() => {
      if (!active) return;
      waiting = false;
      startRound();
      feedback = `다음 꾸러미는 상자가 ${round?.boxes.length ?? 4}개예요. 무게가 같은 상자도 섞여 있어요.`;
      companion.setMood('observe'); update();
      // The old cards were replaced; keep keyboard users on the new boxes.
      if (!root.contains(document.activeElement)) root.querySelector<HTMLButtonElement>('.mystery-card')?.focus({ preventScroll: true });
    }, reducedMotion() ? 600 : 1800);
  }
  function resetObservation() { if (level === 1) state.prediction = null; visibleOutcome = null; shownRun = null; shownRecord = null; pin.style.setProperty('--pin-x','0px'); lock.classList.remove('is-open'); }
  function place(id: string, side: 'left'|'right') {
    if (frozen() || !itemIds().includes(id)) return;
    const p = pans();
    if (side === 'left' && p.right === id) p.right = null;
    if (side === 'right' && p.left === id) p.left = null;
    p[side] = id; selectedObject = null; resetObservation();
    feedback = `${itemName(id)}${level === 1 ? '을' : '를'} ${side === 'left' ? '왼쪽' : '오른쪽'}에 놓았어요. ${p.left && p.right ? level === 1 ? '어느 쪽이 내려갈지 예상해요.' : '잠금핀을 뽑아 비교해요.' : `반대쪽에도 ${level === 1 ? '물체' : '상자'}를 놓아요.`}`;
    companion.setMood('effort'); context.commit(); context.sound(470); update();
    root.querySelector(`[data-pan="${side}"] .instrument-object`)?.animate([{transform:'translateY(-22px) scale(.9)'},{transform:'translateY(3px) scale(1.06)'},{transform:'translateY(0) scale(1)'}],{duration:reducedMotion() ? 1 : 320});
    // Both pans are set: let the object land, then ask for the prediction.
    if (predictPending()) { clearTimeout(popupTimer); popupTimer = window.setTimeout(() => { if (predictPending()) openPopup('predict'); }, reducedMotion() ? 0 : 380); }
  }
  async function release(fromX = 0) {
    const p = pans();
    if (frozen() || !p.left || !p.right || (level === 1 && !state.prediction)) return;
    const mode = level, left = p.left, right = p.right, prediction = state.prediction;
    let actual: BalanceRun['actual'];
    if (mode === 2) actual = weigh(round!, left, right);
    else {
      const lw = balanceObjects.find(item=>item.id===left)!.weight;
      const rw = balanceObjects.find(item=>item.id===right)!.weight;
      actual = lw > rw ? 'left' : lw < rw ? 'right' : 'level';
    }
    busy = true; shownRun = null; shownRecord = null; clue = -1; companion.setMood('observe'); update(); context.sound(470);
    const reduced = reducedMotion();
    animation = pin.animate([
      { transform: `translateX(${fromX}px) rotate(0deg)`, opacity: 1 },
      { transform: 'translateX(105px) rotate(-4deg)', opacity: 1, offset: .7 },
      { transform: 'translate(150px, 34px) rotate(20deg)', opacity: 0 },
    ], { duration: reduced ? 1 : 650, fill: 'forwards', easing: 'ease-out' });
    try { await animation.finished; } catch { return; }
    if (!active) return;
    lock.classList.add('is-open');
    pin.style.setProperty('--pin-x','0px');
    animation.cancel();
    animation = null;
    context.sound(650);
    animation = board.animate(wobble(tilt(actual)),{duration:reduced ? 1 : 1400,fill:'forwards'});
    try { await animation.finished; } catch { return; }
    if (!active) return;
    if (mode === 2) recordMystery({ left, right, actual });
    else {
      const firstTilt = actual !== 'level' && !hasTilt();
      const run = {left,right,prediction:prediction!,actual};
      state.runs = [...state.runs,run].slice(-20); state.prediction = null; visibleOutcome = actual; shownRun = run;
      feedback = `${prediction === actual ? '예상과 같아요!' : '예상과 달라도 괜찮아요!'} ${reason(run)} ${canFinish() ? '두 가지를 모두 발견했어요. 다리 점검원의 의뢰가 도착했어요!' : hasTilt() ? '이제 수평인 짝을 찾아봐요.' : '이제 기울어진 짝을 찾아봐요.'}`;
      busy = false; companion.setMood(canFinish() ? 'success' : 'observe'); context.commit(); context.sound(actual === 'level' ? 700 : 520); update();
      if (firstTilt) showPredictionChip(root.querySelector<HTMLElement>('.instrument-stage')!, context.save, 'balance');
      openPopup('record'); // skipped while the client's letter is open
    }
    animation.cancel(); animation = null;
  }
  root.addEventListener('click', event => {
    if (busy || (event.detail > 0 && performance.now() < suppressClickUntil)) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.object) { selectedObject = button.dataset.object; feedback = `${itemName(selectedObject!)} 선택! 놓을 자리를 눌러요. 끌어서 놓아도 돼요.`; update(); }
    if (button.dataset.pan) { if (selectedObject) place(selectedObject,button.dataset.pan as 'left'|'right'); else { feedback=`아래 ${level === 1 ? '물체' : '상자'}를 고른 다음 왼쪽 또는 오른쪽 자리를 눌러요.`; update(); } }
    if (button.dataset.predict) { state.prediction=button.dataset.predict as BalanceRun['prediction']; visibleOutcome=null; shownRun=null; feedback=`${names[state.prediction]}을 예상했어요. 가운데 잠금핀 고리를 뽑아 확인해요.`; context.commit(); closePopup(); update(); }
    if (button.dataset.pick) pick(button.dataset.pick);
    if (button.id==='balance-request-open' || button.id==='balance-popup-request') enterMystery();
    if (button.id==='balance-record') openPopup(predictPending() ? 'predict' : 'record');
    if (button.id==='balance-swap') { [state.left,state.right]=[state.right,state.left]; resetObservation(); feedback='두 물체의 자리를 바꿨어요. 무거운 물체가 바뀌었을까요, 위치만 바뀌었을까요?'; context.commit(); update(); }
    if (button.id==='balance-test') void release();
    if ((button.id==='balance-finish' || button.id==='balance-popup-finish') && canFinish() && (mysteryDone() || !requestsEnabled(context.save))) {
      closePopup();
      const levelRun = state.runs.find(run=>run.actual==='level')!;
      const tilted = state.runs.find(run=>run.actual!=='level')!;
      context.finish('balance',`${objectName(levelRun.left)}과 ${objectName(levelRun.right)}가 수평임을 관찰했어요. ${reason(tilted)} 예상과 관찰을 ${state.runs.length}번 비교하며 잠금핀을 뽑아 확인했어요. 똑같이 생긴 수수께끼 상자 3개와 4개에서는 수평대 비교 기록을 이어 보고 진짜 기둥 부품을 찾아냈어요.`);
    }
  },{signal:events.signal});

  let drag: {pointer:number; source:HTMLElement; startX:number; startY:number; id:string|null; pin:boolean; moved:boolean; ghost:HTMLElement|null} | null = null;
  function dropPan(x:number,y:number) {
    const hit=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('[data-pan]');
    if(hit && root.contains(hit)) return hit;
    return [...root.querySelectorAll<HTMLButtonElement>('[data-pan]')].find(pan=>{const b=pan.getBoundingClientRect();return x>=b.left-20&&x<=b.right+20&&y>=b.top-20&&y<=b.bottom+20;});
  }
  function endDrag() { if (!drag) return; const current=drag; drag=null; current.ghost?.remove(); root.querySelectorAll('.is-drop-target').forEach(pan=>pan.classList.remove('is-drop-target')); if(current.source.hasPointerCapture(current.pointer)) current.source.releasePointerCapture(current.pointer); pin.style.setProperty('--pin-x','0px'); }
  root.addEventListener('dragstart',event=>event.preventDefault(),{signal:events.signal});
  root.addEventListener('pointerdown',event=>{
    if(frozen() || event.button!==0 || drag) return;
    const source=(event.target as Element).closest<HTMLElement>('[data-object], [data-pan], #balance-test');
    if(!source || (source as HTMLButtonElement).disabled) return;
    const isPin=source===pin;
    const id=source.dataset.object ?? (source.dataset.pan ? pans()[source.dataset.pan as 'left'|'right'] : null);
    if(!isPin && !id) return;
    event.preventDefault(); source.focus({preventScroll:true});
    drag={pointer:event.pointerId,source,startX:event.clientX,startY:event.clientY,id:id??null,pin:isPin,moved:false,ghost:null};
    source.setPointerCapture(event.pointerId);
  },{signal:events.signal});
  root.addEventListener('pointermove',event=>{
    if(!drag || drag.pointer!==event.pointerId) return;
    const dx=event.clientX-drag.startX;
    drag.moved ||= Math.hypot(dx,event.clientY-drag.startY)>7;
    if(drag.pin) { pin.style.setProperty('--pin-x',`${Math.max(0,Math.min(95,dx))}px`); return; }
    if(!drag.moved) return;
    if(!drag.ghost) { drag.ghost=document.createElement('div'); drag.ghost.className='instrument-drag-ghost balance-drag-ghost'; drag.ghost.innerHTML=itemArt(drag.id!); document.body.append(drag.ghost); }
    drag.ghost.style.left=`${event.clientX}px`; drag.ghost.style.top=`${event.clientY}px`;
    const target=dropPan(event.clientX,event.clientY);
    root.querySelectorAll<HTMLElement>('[data-pan]').forEach(pan=>pan.classList.toggle('is-drop-target',pan===target));
  },{signal:events.signal});
  root.addEventListener('pointerup',event=>{
    if(!drag || drag.pointer!==event.pointerId) return;
    const current=drag; const dx=event.clientX-current.startX;
    const target=dropPan(event.clientX,event.clientY);
    if(current.moved) suppressClickUntil=performance.now()+350;
    endDrag();
    if(current.pin && dx>=62) void release(Math.min(95,dx));
    else if(!current.pin && current.moved && target?.dataset.pan) place(current.id!,target.dataset.pan as 'left'|'right');
    else if(!current.pin && current.moved) { feedback=`${level === 1 ? '물체' : '상자'}를 수평대의 왼쪽이나 오른쪽 받침에 놓아 봐요. ${level === 1 ? '물체' : '상자'}를 누른 다음 받침을 눌러도 돼요.`; update(); }
  },{signal:events.signal});
  root.addEventListener('pointercancel',endDrag,{signal:events.signal});
  root.addEventListener('lostpointercapture',()=>{if(drag) endDrag();},{signal:events.signal});
  window.addEventListener('blur',endDrag,{signal:events.signal});
  window.addEventListener('resize',endDrag,{signal:events.signal});
  if (level === 2) startRound();
  update();
  return()=>{active=false; clearTimeout(timer); closePopup(); endDrag(); events.abort(); animation?.cancel(); companion.dispose();};
}