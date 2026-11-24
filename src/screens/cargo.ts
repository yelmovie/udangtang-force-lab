import type { AppContext } from '../appTypes';
import { cargoRunKey, keepEvidence } from '../runHistory';
import { setMissionProgress } from '../missionProgress';
import { autoDemoSettingChange } from '../autoPlay';
import { showPredictionChip } from '../predictionChip';
import { requestOpenLabel, showRequestLetter } from '../requestLetter';
import { corgiHintButton, mountCorgiHint } from '../corgiHint';
import { cargoActionCompared, cargoExplorationReady, cargoLoads, cargoManualEvidence, cargoDistance, cargoForceNames, cargoOrders, orderHint, orderResult, orderSolution, ordersComplete, type ForceLevel, type OrderResult } from '../cargoModel';
import type { CargoRun } from '../state';
import '../cargo.css';
import { cargoOrdersMarkup, cargoPopupMarkup, cargoScreenMarkup, cargoTracesMarkup, cargoTrackCells, imagePath } from './cargoMarkup';
import { fingerIcon } from '../interactionHints';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function mountCargo(root: HTMLElement, context: AppContext): () => void {
    const state = context.save.cargo;
    // Level 1 always uses the medium step; older saves stored distances from an earlier model.
    for (const run of state.runs) run.distance = cargoDistance(run.parts, 2);
    const events = new AbortController();
    let active = true, busy = false, waiting = false, needsSetup = false;
    // "자동으로 보기" runs the missing level 1 tries, or delivers the open level 2 orders, by itself; the student only watches.
    let autoPlaying = false;
    let autoRunId = 0;
    let showDemo = false;
    let deliveryResult: { distance: number; outcome: OrderResult } | null = null;
    let demoDeliveryAttempt = false;
    let demoDeliveryResult = false;
    let nextOrderReady = false;
    let animation: Animation | null = null;
    let comparisons: Animation[] = [];
    let lastComparison = [...state.runs].reverse().find(run => cargoActionCompared(state.runs, run.action))?.action;
    let suppressClickUntil = 0;
    let drag: {
        pointer: number;
        source: HTMLButtonElement;
        type: 'card' | 'force';
        x: number;
        y: number;
        travel: number;
        moved: boolean;
        ghost: HTMLElement | null;
    } | null = null;
    // Level 2 (bakery orders) is session play on top of the saved level 1 records.
    let finding = ready() && Array.isArray(state.orders);
    // A student who reloads before restoring the rail still sees the delivery result.
    let level: 1 | 2 = finding && (!ordersComplete(state.orders) || !context.save.completed.includes('cargo')) ? 2 : 1;
    let force: ForceLevel | null = null;
    let findingTried = false;
    // After a wrong pick the two choices stay off for a moment, so the next pick follows a look at the bars.
    const findingLockMs = 1500;
    let findingLockUntil = 0;
    let findingLockTimer = 0;
    // Level 1 rail traces: only tries made in the current direction since entering or switching,
    // because push and pull stop at the same spot and older traces read as leftover crates.
    let railRuns: CargoRun[] = [];
    let orderCards = '';
    let feedback = level === 1 ? '같은 힘으로 상자를 움직이고, 멈춘 곳을 비교해요.' : '빵집 문 앞 노란 칸에 딱 멈추게 보내요.';
    root.innerHTML = cargoScreenMarkup(fingerIcon);
    const field = root.querySelector<HTMLElement>('.cargo-scene')!;
    const compare = root.querySelector<HTMLElement>('.cargo-compare')!;
    const compareNote = compare.querySelector<HTMLElement>('.cargo-compare-note')!;
    const compareControls = root.querySelector<HTMLElement>('.cargo-compare-controls')!;
    const compareNext = compareControls.querySelector<HTMLButtonElement>('.cargo-compare-next')!;
    const compareButtons = [...compareControls.querySelectorAll<HTMLButtonElement>('[data-compare]')];
    const compareRows = [...compare.querySelectorAll<HTMLElement>('.cargo-compare-row')].map(row => ({
        parts: Number(row.dataset.load),
        motion: row.querySelector<HTMLElement>('.cargo-compare-motion')!,
        result: row.querySelector<HTMLElement>('.cargo-compare-result')!,
    }));
    const manualComparison = () => level === 1 && !showDemo && !animation;
    const crate = root.querySelector<HTMLElement>('.cargo-object')!;
    const handle = root.querySelector<HTMLButtonElement>('.cargo-worker-grip')!;
    const finish = root.querySelector<HTMLButtonElement>('#cargo-finish')!;
    const recordOpen = root.querySelector<HTMLButtonElement>('#cargo-record-open')!;
    const ordersOpen = root.querySelector<HTMLButtonElement>('#cargo-open-orders')!;
    const requestCta = root.querySelector<HTMLElement>('.cargo-request-cta')!;
    const tapGo = root.querySelector<HTMLButtonElement>('#cargo-tap-go')!;
    const autoGo = root.querySelector<HTMLButtonElement>('#cargo-auto-go')!;
    const deliveryPanel = root.querySelector<HTMLElement>('.cargo-delivery')!;
    const deliveryLoad = deliveryPanel.querySelector('.cargo-delivery-load')!;
    const deliveryProgress = deliveryPanel.querySelector('.cargo-delivery-progress')!;
    const deliveryTitle = deliveryPanel.querySelector('h2')!;
    const deliveryReport = deliveryPanel.querySelector<HTMLElement>('.cargo-delivery-report')!;
    const deliveryNote = deliveryPanel.querySelector('.cargo-delivery-note')!;
    const deliveryCount = deliveryPanel.querySelector<HTMLElement>('.cargo-delivery-count')!;
    const deliverySummary = deliveryPanel.querySelector<HTMLElement>('.cargo-delivery-summary')!;
    const deliveryTrail = root.querySelector<HTMLElement>('.cargo-delivery-trail')!;
    const railStart = root.querySelector('.rail-start')!;
    const deliveryActions = root.querySelector<HTMLElement>('.cargo-delivery-actions')!;
    const nextOrder = root.querySelector<HTMLButtonElement>('#cargo-next-order')!;
    const deliveryFinish = root.querySelector<HTMLButtonElement>('#cargo-delivery-finish')!;
    const forceGroup = root.querySelector<HTMLElement>('.cargo-force')!;
    const forceButtons = [...forceGroup.querySelectorAll<HTMLButtonElement>('[data-force]')];
    const manualDelivery = () => level === 2 && !autoPlaying && !demoDeliveryAttempt && !demoDeliveryResult;
    const hint = mountCorgiHint(root, {
        now: () => stepText(),
        missing: () => {
            if (level !== 1 || ready()) return '';
            if (!showDemo) return manualHint();
            const left = (['push', 'pull'] as const).map(action => [action, missingTries().filter(step => step.action === action).map(step => step.parts)] as const).filter(([, parts]) => parts.length);
            return `아직 안 한 실험: ${left.map(([action, parts]) => `${action === 'push' ? '밀기' : '당기기'} ${parts.join('·')}개`).join(', ')}`;
        },
    });
    const hintCorgi = corgiHintButton();
    hintCorgi.classList.add('cargo-hint-corgi');
    root.querySelector('.cargo-dock')!.append(hintCorgi);
    hint.attach(hintCorgi);
    // Results and the comparison question live in a popup that opens only after a try ends,
    // so the stage itself keeps the full width while the student is operating it.
    let popup: HTMLDialogElement | null = null;
    let popupTimer = 0;
    let pendingPopup: (() => void) | null = null;
    let findingNote = '';
    const step = root.querySelector<HTMLElement>('#cargo-step')!;
    const setActorMood = (mood: 'idle' | 'effort' | 'observe' | 'success') => { crate.dataset.mood = mood; };
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-parts]')];
    const trailSpan = (distance: number) => `${distance * .7}%`;
    const endPosition = (distance: number) => `${17 + distance * .7}%`;
    const forceName = (f: ForceLevel) => cargoForceNames[f - 1];
    const orders = () => state.orders ?? [];
    const deliveredAll = () => ordersComplete(state.orders);
    const currentOrder = () => cargoOrders[Math.min(orders().length - Number(nextOrderReady), cargoOrders.length - 1)];
    const shownParts = () => level === 2 ? currentOrder().parts : state.parts;
    /** The tap button's own words, also quoted by the drag hint. Level 2 always pushes. */
    const tapLabel = () => level === 1 && state.action === 'pull' ? '눌러서 당기기' : '눌러서 밀기';
    function latestRun(parts: number, action?: CargoRun['action']) { return [...state.runs].reverse().find(run => run.parts === parts && (!action || run.action === action)); }
    function pushCompared() { return cargoActionCompared(state.runs, 'push'); }
    function pullCompared() { return cargoActionCompared(state.runs, 'pull'); }
    function manualEvidence() { return cargoManualEvidence(state.runs); }
    function ready() { return showDemo ? cargoExplorationReady(state.runs) : manualEvidence().ready; }
    function manualHint() {
        if (pushCompared() && !pullCompared()) return '이번엔 ‘당겨서 보기’를 눌러 멈춘 곳을 비교해요.';
        if (pullCompared() && !pushCompared()) return '이번엔 ‘밀어서 보기’를 눌러 멈춘 곳을 비교해요.';
        return '아래 버튼을 눌러 세 상자를 같은 힘으로 움직여요.';
    }
    function comparisonRun(parts: number) {
        return latestRun(parts, showDemo ? undefined : manualEvidence().comparison);
    }
    function directionText() {
        const n = [1, 3, 5].find(parts => latestRun(parts, 'push') && latestRun(parts, 'pull'));
        if (!n) return '밀기와 당기기도 해 봐요.';
        const push = latestRun(n, 'push')!.distance, pull = latestRun(n, 'pull')!.distance;
        return `부품 ${n}개 · 밀기 ${push}칸 · 당기기 ${pull}칸. ${push === pull ? '같은 상자에 오른쪽으로 같은 힘을 같은 시간 동안 주어 거리가 같아요.' : '거리가 조금 달라요.'}`;
    }
    const trackWidth = (distance: number) => `${distance / cargoTrackCells * 100}%`;
    function updateComparison(needsFinding: boolean) {
        const showing = manualComparison();
        compare.hidden = compareControls.hidden = !showing;
        field.toggleAttribute('data-compare', showing);
        if (!showing) return;
        compareNext.hidden = !needsFinding;
        compareNext.disabled = busy;
        for (const button of compareButtons) {
            button.hidden = needsFinding;
            button.disabled = busy;
            button.toggleAttribute('data-seen', cargoActionCompared(state.runs, button.dataset.compare as CargoRun['action']));
        }
        compare.dataset.action = lastComparison ?? 'push';
        const moving = comparisons.length > 0;
        const note = moving ? '세 상자가 같은 출발점에서 움직여요.'
            : finding && !deliveredAll() ? '빵집에서 부탁이 왔어요.'
            : pushCompared() && pullCompared() ? '같은 상자는 밀어도 당겨도 같은 곳에 멈췄어요.'
            : needsFinding ? '어느 상자가 출발점에서 가장 멀리 갔나요?'
            : lastComparison ? manualHint() : '같은 출발점에서 똑같은 시간 동안 힘을 줘요.';
        if (compareNote.textContent !== note) compareNote.textContent = note;
        for (const { parts, motion, result } of compareRows) {
            const run = lastComparison && latestRun(parts, lastComparison);
            if (!moving) motion.style.width = trackWidth(run ? run.distance : 0);
            result.hidden = moving || !run;
            if (run) result.querySelector('b')!.textContent = `${run.distance}칸`;
        }
    }
    async function runComparison(action: CargoRun['action'], keyboard: boolean) {
        if (!manualComparison() || busy || waiting || autoPlaying) return;
        busy = true;
        lastComparison = action;
        compare.dataset.action = action;
        const runs = cargoLoads.map(parts => ({ parts, action, gesture: travel(), distance: cargoDistance(parts) }));
        const startTime = document.timeline.currentTime;
        comparisons = compareRows.map(({ motion }, i) => {
            const move = motion.animate([{ width: '0%' }, { width: trackWidth(runs[i].distance) }], {
                duration: reducedMotion() ? 1 : 1300, easing: 'cubic-bezier(.18,.65,.48,1)', fill: 'forwards',
            });
            move.startTime = startTime;
            return move;
        });
        update();
        try { await Promise.all(comparisons.map(move => move.finished)); } catch { return; }
        if (!active) return;
        for (const move of comparisons) move.cancel();
        comparisons = [];
        state.action = action;
        state.runs = keepEvidence([...state.runs, ...runs], cargoRunKey);
        context.commit();
        context.sound(710);
        busy = false;
        update();
        if (keyboard) (ready() && !finding ? compareNext : compareButtons.find(b => !b.hasAttribute('data-seen')))?.focus({ preventScroll: true });
    }
    const travel = () => Math.max(64, Math.min(120, field.clientWidth * .12));
    const canPush = () => !busy && !waiting && !autoPlaying && (level === 1 ? !manualComparison() && !needsSetup : force !== null && !deliveredAll());
    // 1단계에서 한 번 실험한 뒤에도 아이·「눌러서 밀기/당기기」를 바로 다시 누를 수 있다. 누르는 순간 같은 상자를 출발점으로 되돌린다(상자를 다시 고르지 않아도 됨).
    const canRearm = () => level === 1 && !manualComparison() && needsSetup && !busy && !waiting && !autoPlaying;
    function rearm() { if (!canRearm()) return; needsSetup = false; resetCrate(); update(); }
    function resetForce() { field.style.setProperty('--charge', '0'); crate.style.transform = ''; field.classList.remove('cargo-dragging'); }
    function resetCrate() { crate.style.transform = ''; crate.style.left = endPosition(0); root.querySelector('.cargo-distance')!.textContent = ''; setActorMood('idle'); }
    function positionGuide() {
        const rail = root.querySelector<HTMLElement>('.cargo-rail')!;
        const actorWidth = handle.offsetWidth;
        const start = rail.clientWidth * .17 + (field.dataset.action !== 'pull' ? -actorWidth / 2 + 29 : crate.offsetWidth + 16 + actorWidth / 2);
        field.style.setProperty('--gesture-start', `${start}px`);
        field.style.setProperty('--gesture-travel', `${travel()}px`);
    }
    function deliveryHint() {
        if (deliveredAll()) return '같은 곳까지 보내려면 무거운 상자에 더 큰 힘이 필요해요.';
        if (busy) return `${forceName(force!)}으로 출발했어요!`;
        if (deliveryResult?.outcome === 'hit') return '배달 성공! 상자가 노란 칸에 멈췄어요.';
        if (deliveryResult) return orderHint(deliveryResult.outcome);
        return '어떤 힘으로 밀면 노란 칸에 멈출까요?';
    }
    function updateDelivery() {
        const showing = manualDelivery(), done = deliveredAll();
        field.toggleAttribute('data-delivery', showing);
        railStart.textContent = showing ? '출발 · 0칸' : '출발';
        deliveryPanel.hidden = !showing;
        deliveryActions.hidden = !showing || (!nextOrderReady && !done);
        nextOrder.hidden = !nextOrderReady;
        deliveryFinish.hidden = !done;
        deliveryFinish.disabled = finish.disabled;
        deliveryTrail.hidden = !showing || !deliveryResult;
        if (!showing) return;

        const hint = deliveryHint();
        deliveryTitle.textContent = done ? '빵집 배달 완료!' : '빵집 문 앞에 세워요';
        deliveryLoad.textContent = `부품 ${currentOrder().parts}개 상자`;
        deliveryProgress.textContent = `배달 ${orders().length} / ${cargoOrders.length}`;
        if (deliveryNote.textContent !== hint) deliveryNote.textContent = hint;
        deliveryReport.dataset.outcome = deliveryResult?.outcome ?? '';
        deliveryCount.hidden = !deliveryResult;
        if (deliveryResult) {
            deliveryCount.querySelector('b')!.textContent = `${deliveryResult.distance}칸`;
            deliveryTrail.style.width = trailSpan(deliveryResult.distance);
        }
        deliverySummary.hidden = !done;
        if (done) deliverySummary.textContent = cargoOrders.map((order, i) => `${order.parts}개 → ${forceName(orders()[i] as ForceLevel)}`).join('  ·  ');
    }
    function stepText() {
        if (busy) return level === 1 ? '같은 힘으로 출발! 어디서 멈출까?' : `${forceName(force!)}으로 출발!`;
        if (autoPlaying) return level === 1
            ? `자동 실험 중 · 다음은 ${state.action === 'push' ? '밀기' : '당기기'} 부품 ${state.parts}개`
            : `자동 배달 중 · 주문 ${orders().length + 1} · 부품 ${currentOrder().parts}개${force ? ` · ${forceName(force)}` : ''}`;
        if (level === 2) {
            if (manualDelivery()) return nextOrderReady ? '배달 성공! 다음 상자를 눌러요' : deliveryHint();
            if (deliveredAll()) return '배달 완료! 운반 레일 복구하기를 눌러요';
            const label = `주문 ${orders().length + 1} · 부품 ${currentOrder().parts}개`;
            return force ? `${label} · ‘눌러서 밀기’를 눌러요. 끌어서 밀어도 돼요.` : `${label} · 힘을 고르고 ‘눌러서 밀기’를 눌러요`;
        }
        if (manualComparison() && !ready()) return manualHint();
        if (finding && deliveredAll()) return '배달 완료! 부품과 방향을 바꿔 더 실험해 봐요';
        if (finding) return `가운데 ‘${requestOpenLabel}’를 눌러요`;
        if (ready()) return '실험은 끝! 가운데 비교하고 의뢰 받기를 눌러요';
        if (needsSetup && !showDemo) return manualHint();
        if (needsSetup) return !pushCompared() ? '밀기로 1·3·5개 상자를 모두 비교해요' : '당기기로 1·3·5개 상자를 모두 비교해요';
        return `‘${tapLabel()}’를 눌러요. 아이를 오른쪽 표시까지 끌어도 돼요.`;
    }
    function renderGhosts() {
        // Level 1: where every other load stopped, so 1·3·5 can be compared side by side on the rail.
        const items = level === 2 ? [] : cargoLoads.flatMap(n => {
            const run = [...railRuns].reverse().find(r => r.parts === n);
            return run ? [{ distance: run.distance, label: `${n}개 상자가 멈춘 곳`, parts: n, current: n === state.parts }] : [];
        });
        // The crate the student is pushing right now keeps its own picture; only its arrival sign is drawn.
        root.querySelector('.cargo-ghosts')!.innerHTML = items.map(g => `<div class="cargo-ghost" data-age="0" data-parts="${g.parts}" data-current="${g.current}" style="left:${endPosition(g.distance)}"><img src="${imagePath('crate-empty')}" alt="" draggable="false"><span>${g.label}</span></div>`).join('');
    }
    function update() {
        const evidence = manualEvidence();
        const steps = root.querySelectorAll<HTMLElement>('.mission-progress-steps span');
        steps[0].textContent = showDemo ? '밀기 1·3·5개' : '같은 방식으로 1·3·5개';
        steps[1].textContent = showDemo ? '당기기 1·3·5개' : '같은 상자로 밀기·당기기';
        setMissionProgress(root, [showDemo ? pushCompared() : !!evidence.comparison, showDemo ? pullCompared() : evidence.sameLoad, finding, deliveredAll()], '');
        const delivering = manualDelivery();
        const parts = shownParts(), locked = busy || waiting || autoPlaying;
        root.querySelector('.cargo-load-tag')!.textContent = `부품 ${parts}개 상자`;
        const contents = root.querySelector<HTMLElement>('.cargo-contents')!;
        contents.dataset.count = String(parts);
        if (contents.childElementCount !== parts) contents.innerHTML = Array.from({ length: parts }, (_, i) => `<img src="${imagePath('cargo-part')}" alt="" draggable="false" style="--part:${i}">`).join('');
        buttons.forEach(b => {
            const n = Number(b.dataset.parts), selected = n === state.parts;
            const suggest = !locked && state.parts === 1 && n !== 1;
            b.classList.toggle('selected', selected); b.classList.toggle('cargo-next-choice', suggest);
            b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', `같은 금속 부품 ${n}개 담기${suggest ? '. 다음에 비교해 봐요' : ''}`); b.disabled = locked;
            if (suggest && !b.querySelector('.cargo-choice-finger')) b.insertAdjacentHTML('beforeend', `<span class="cargo-choice-finger">${fingerIcon}</span>`);
            if (!suggest) b.querySelector('.cargo-choice-finger')?.remove();
        });
        root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => { b.classList.toggle('selected', b.dataset.action === state.action); b.setAttribute('aria-pressed', String(b.dataset.action === state.action)); b.disabled = locked; });
        forceGroup.toggleAttribute('data-waiting', !delivering && level === 2 && force === null && !deliveredAll());
        for (const button of forceButtons) {
            const selected = Number(button.dataset.force) === force;
            button.classList.toggle('selected', selected);
            if (delivering) button.removeAttribute('aria-pressed');
            else button.setAttribute('aria-pressed', String(selected));
            button.disabled = locked || deliveredAll();
        }
        const comparing = manualComparison();
        root.querySelectorAll<HTMLElement>('.cargo-dock [data-level]').forEach(part => { part.hidden = comparing || Number(part.dataset.level) !== level; });
        if (delivering) forceGroup.hidden = nextOrderReady || deliveredAll();
        const cards = cargoOrders.map((order, i) => {
            const done = orders()[i] as ForceLevel | undefined, now = !done && !nextOrderReady && i === orders().length;
            return `<span class="cargo-order-card" data-state="${done ? 'done' : now ? 'now' : 'wait'}" aria-label="주문 ${i + 1}, 부품 ${order.parts}개${done ? `, ${forceName(done)}으로 배달 완료` : now ? ', 지금 배달할 주문' : ''}"><small>주문 ${i + 1}</small><b>부품 ${order.parts}개</b>${done ? `<em>✓ ${forceName(done)}</em>` : ''}</span>`;
        }).join('');
        // Re-render only on change so the current order's pop animation plays once.
        if (cards !== orderCards) root.querySelector('.cargo-order-cards')!.innerHTML = orderCards = cards;
        const action = level === 2 ? 'push' : state.action;
        field.dataset.action = action;
        field.dataset.level = String(level);
        field.style.setProperty('--force-step', String(level === 2 ? force ?? 2 : 2));
        const forceLabel = level === 2 ? force ? forceName(force) : '힘 단계' : '같은 힘';
        root.querySelector('.cargo-force-arrow b')!.textContent = forceLabel;
        root.querySelector('.cargo-gesture-target')!.textContent = forceLabel;
        root.querySelector<HTMLElement>('.rail-end')!.hidden = level === 2;
        const zone = root.querySelector<HTMLElement>('.cargo-target-zone')!;
        const [lo, hi] = currentOrder().target;
        zone.hidden = level !== 2;
        zone.style.left = endPosition(lo);
        zone.style.setProperty('--zone-span', trailSpan(hi - lo));
        handle.disabled = comparing || delivering || (!canPush() && !canRearm());
        if (delivering) handle.setAttribute('aria-hidden', 'true');
        else handle.removeAttribute('aria-hidden');
        tapGo.textContent = `${tapLabel()} →`;
        tapGo.disabled = !canPush() && !canRearm();
        autoGo.hidden = !autoPlaying && (!context.autoDemoEnabled() || (level === 1 ? cargoExplorationReady(state.runs) || finding : deliveredAll()));
        autoGo.disabled = !autoPlaying && (busy || waiting || !!drag);
        autoGo.textContent = autoPlaying ? '직접 해보기' : '▶ 자동으로 보기';
        autoGo.setAttribute('aria-pressed', String(autoPlaying));
        handle.setAttribute('aria-label', level === 1
            ? `남자아이를 잡고 오른쪽 표시까지 ${action === 'push' ? '밀기' : '당기기'}. Enter로도 실험`
            : `남자아이를 잡고 ${forceLabel}으로 오른쪽 표시까지 밀기. Enter로도 실험`);
        field.dataset.busy = String(busy); field.dataset.setup = String(canPush());
        root.querySelector('#cargo-record-count')!.textContent = String(state.runs.length);
        recordOpen.hidden = comparing && !state.runs.length;
        recordOpen.disabled = locked || !state.runs.length;
        // The next step sits in the middle of the stage, where it cannot be missed on a board or tablet.
        const needsFinding = level === 1 && ready() && !finding;
        updateComparison(needsFinding);
        root.querySelector<HTMLElement>('.cargo-finding-cta')!.hidden = comparing || !needsFinding || locked;
        root.querySelector('.cargo-finding-cta p')!.textContent = showDemo ? '실험 끝! 1·3·5개 상자를 모두 밀고 당겨 봤어요.' : '상자 세 개의 멈춘 곳과 밀기·당기기 기록을 비교해요.';
        tapGo.hidden = step.hidden = comparing || delivering || (needsFinding && !locked);
        root.querySelector<HTMLElement>('.cargo-scene-caption')!.hidden = step.hidden && autoGo.hidden;
        root.querySelector<HTMLButtonElement>('#cargo-finding-go')!.disabled = locked;
        const showRequest = level === 1 && finding && !deliveredAll() && !locked && !root.querySelector('.request-letter[open]');
        const revealRequest = requestCta.hidden && showRequest;
        requestCta.hidden = !showRequest;
        if (revealRequest && !popup?.open) ordersOpen.focus({ preventScroll: true });
        step.textContent = stepText();
        root.querySelector('#cargo-feedback')!.textContent = feedback;
        // The request is opened explicitly after the whole exploration, never from update().
        positionGuide();
        renderGhosts();
        finish.disabled = locked || !ready() || !finding || !deliveredAll();
        updateDelivery();
    }
    async function experiment(gesture: number, preview = 0, auto = false) {
        if (auto ? busy || waiting || (level === 2 && force === null) : !canPush())
            return;
        busy = true;
        demoDeliveryAttempt = auto && level === 2;
        if (level === 2) deliveryResult = null;
        const parts = shownParts(), push: ForceLevel = level === 2 ? force! : 2, distance = cargoDistance(parts, push);
        feedback = level === 1 ? '같은 힘으로 출발! 어디서 멈추는지 봐요.' : `${forceName(push)}으로 출발!`;
        field.style.setProperty('--charge', '1');
        update();
        setActorMood('effort');
        // Both the current crate and its comparison trace use rail-relative positions,
        // so resizing the viewport cannot change the observed relative distance.
        crate.style.transform = '';
        crate.style.left = endPosition(0);
        animation = crate.animate([{ left: `calc(${endPosition(0)} + ${preview}px)` }, { left: endPosition(distance) }], { duration: reducedMotion() ? 1 : 1000, easing: 'cubic-bezier(.16,.65,.45,1)', fill: 'forwards' });
        try {
            await animation.finished;
        }
        catch {
            setActorMood('idle');
            return;
        }
        if (!active)
            return;
        crate.style.left = endPosition(distance);
        animation.cancel();
        animation = null;
        demoDeliveryAttempt = false;
        busy = false;
        resetForce();
        root.querySelector('.cargo-distance')!.textContent = `${distance}칸 이동`;
        if (level === 1) recordRun({ parts, action: state.action, gesture, distance });
        else deliver(distance, push, auto);
    }
    function recordRun(run: CargoRun) {
        const hadBoth = !!latestRun(1) && !!latestRun(5);
        state.runs.push(run);
        state.runs = keepEvidence(state.runs, cargoRunKey);
        if (cargoActionCompared(state.runs, run.action)) lastComparison = run.action;
        railRuns.push(run);
        needsSetup = !deliveredAll();
        context.commit();
        context.sound(710);
        setActorMood('observe');
        feedback = `부품 ${run.parts}개 상자는 ${run.distance}칸 갔어요.`;
        const chip = !hadBoth && !!latestRun(1) && !!latestRun(5);
        if (chip)
            showPredictionChip(field, context.save, 'cargo');
        if (ready() && !finding)
            feedback += ' 가운데 비교하고 의뢰 받기를 눌러요.';
        update();
        // Let the stop spot (and the prediction chip) be seen before the result card covers the stage.
        if (ready() && !finding) schedulePopup(() => recordPopup(run), chip ? 2200 : 700);
    }
    function deliver(distance: number, push: ForceLevel, auto: boolean) {
        const order = currentOrder(), result = orderResult(order, distance);
        if (!auto) deliveryResult = { distance, outcome: result };
        if (result === 'hit') {
            state.orders = [...orders(), push];
            context.commit();
            context.sound(780);
            setActorMood('success');
            feedback = `배달 성공! 부품 ${order.parts}개는 ${forceName(push)}으로 딱 멈췄어요.`;
            if (deliveredAll()) {
                feedback += ' 오븐을 고칠 수 있어요!';
                demoDeliveryResult = auto;
                update();
                if (auto) schedulePopup(() => openPopup('배달 결과', '배달 완료! 오븐을 고칠 수 있어요', `<p>부품 ${order.parts}개는 ${forceName(push)}으로 빵집 문 앞에 딱 멈췄어요.</p>${cargoOrdersMarkup(orders(), forceName)}<p class="cargo-popup-next"><strong>운반 레일 복구하기</strong>를 누르거나, 더 실험해 봐도 돼요.</p>`, exploreFreely), 700);
                else deliveryFinish.focus({ preventScroll: true });
                return;
            }
            // Keep a hands-on delivery at the door until the student brings in the next order.
            if (auto) {
                if (!autoPlaying) resetCrate();
                update();
                return;
            }
            waiting = true;
            nextOrderReady = true;
            update();
            nextOrder.focus({ preventScroll: true });
            return;
        }
        context.sound(600);
        setActorMood('observe');
        feedback = deliveryHint();
        update();
        if (!auto) forceButtons[push - 1].focus({ preventScroll: true });
    }
    nextOrder.addEventListener('click', () => {
        if (!nextOrderReady || busy || autoPlaying) return;
        nextOrderReady = waiting = false;
        force = null; deliveryResult = null;
        resetCrate();
        feedback = `다음은 부품 ${currentOrder().parts}개! 더 무거워요.`;
        update();
        deliveryTitle.focus({ preventScroll: true });
    }, { signal: events.signal });
    deliveryFinish.addEventListener('click', () => finish.click(), { signal: events.signal });
    function exploreFreely() {
        if (!active || level === 1) return update();
        level = 1; force = null; railRuns = []; needsSetup = false; deliveryResult = null; demoDeliveryResult = false;
        showDemo = false;
        resetCrate();
        feedback = '배달 완료! 세 상자를 다시 움직여 봐요.';
        update();
    }
    function enterOrders() {
        if (!finding || !ready() || busy || waiting || drag || level!==1) return;
        level = 2; force = null; deliveryResult = null; needsSetup = false;
        closePopup();
        resetCrate();
        feedback = '빵집 문 앞 노란 칸에 딱 멈추게 보내요.';
        context.sound(520);
        update();
        deliveryTitle.focus({ preventScroll: true });
    }
    function setParts(n: number) { if (busy || waiting || level !== 1 || ![1, 3, 5].includes(n))
        return; state.parts = n; needsSetup = false; resetCrate(); feedback = `같은 금속 부품 ${n}개를 담았어요.`; context.commit(); context.sound(470); update(); if (!reducedMotion())
        crate.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220 }); }
    for (const button of buttons) {
        button.addEventListener('click', event => { if (drag || (event.detail > 0 && performance.now() < suppressClickUntil))
            return; setParts(Number(button.dataset.parts)); }, { signal: events.signal });
    }
    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.addEventListener('click', () => { if (busy || waiting || drag || level !== 1)
        return; if (b.dataset.action !== state.action) railRuns = []; state.action = b.dataset.action as 'push' | 'pull'; needsSetup = false; resetCrate(); context.commit(); feedback = state.action === 'push' ? '뒤에서 미는 쪽으로 바꿨어요.' : '앞에서 당기는 쪽으로 바꿨어요.'; update(); }, { signal: events.signal }));
    for (const button of forceButtons) {
        button.addEventListener('click', () => {
            if (!manualDelivery() || busy || waiting || deliveredAll()) return;
            force = Number(button.dataset.force) as ForceLevel;
            context.sound(380 + force * 60);
            void experiment(travel());
        }, { signal: events.signal });
    }
    ordersOpen.addEventListener('click', () => {
        if (requestCta.hidden || drag || !ready()) return;
        closePopup();
        const letter = showRequestLetter(root, 'cargo', enterOrders, () => context.save);
        requestCta.hidden = true;
        letter.addEventListener('close', update, { once: true, signal: events.signal });
    }, { signal: events.signal });
    recordOpen.addEventListener('click', () => { if (!busy && !waiting && !drag) recordPopup(); }, { signal: events.signal });
    for (const button of root.querySelectorAll('#cargo-finding-go,.cargo-compare-next')) {
        button.addEventListener('click', () => { if (!busy && !waiting && !drag) recordPopup(); }, { signal: events.signal });
    }
    for (const button of compareButtons) {
        button.addEventListener('click', event => {
            void runComparison(button.dataset.compare as CargoRun['action'], event.detail === 0);
        }, { signal: events.signal });
    }
    function clearDrag() {
        if (!drag)
            return;
        const current = drag;
        drag = null;
        current.ghost?.remove();
        crate.classList.remove('drop-ready');
        resetForce();
        if (current.source.hasPointerCapture(current.pointer))
            current.source.releasePointerCapture(current.pointer);
        // A result that arrived mid-drag waits until the finger is lifted.
        if (pendingPopup) schedulePopup(pendingPopup, 300);
    }
    root.addEventListener('pointerdown', event => {
        if (manualComparison() || manualDelivery() || busy || waiting || drag || event.button !== 0)
            return;
        const source = (event.target as Element).closest<HTMLButtonElement>('[data-parts],.cargo-worker-grip');
        if (!source)
            return;
        if (source === handle) rearm();
        if (source.disabled)
            return;
        drag = { pointer: event.pointerId, source, type: source === handle ? 'force' : 'card', x: event.clientX, y: event.clientY, travel: travel(), moved: false, ghost: null };
        source.setPointerCapture(event.pointerId);
        if (source === handle) {
            field.classList.add('cargo-dragging');
            setActorMood('effort');
        }
    }, { signal: events.signal });
    root.addEventListener('pointermove', event => {
        if (!drag || drag.pointer !== event.pointerId)
            return;
        const dx = event.clientX - drag.x;
        drag.moved ||= Math.hypot(dx, event.clientY - drag.y) > 10;
        if (drag.type === 'force') {
            const charge = Math.max(0, Math.min(1, dx / drag.travel));
            field.style.setProperty('--charge', String(charge));
            crate.style.transform = `translateX(${charge * drag.travel}px)`;
            const text = charge >= .94 ? '준비 완료! 손을 놓으면 출발해요' : '오른쪽 표시까지 옮겨요 →';
            if (step.textContent !== text) step.textContent = text;
            return;
        }
        if (!drag.moved)
            return;
        if (!drag.ghost) {
            drag.ghost = document.createElement('div');
            drag.ghost.className = 'cargo-load-ghost';
            drag.ghost.innerHTML = `<img src="${imagePath(`cargo-parts-${drag.source.dataset.parts}`)}" alt="" draggable="false"><b>${drag.source.dataset.parts}개</b>`;
            document.body.append(drag.ghost);
        }
        drag.ghost.style.left = `${event.clientX}px`;
        drag.ghost.style.top = `${event.clientY}px`;
        crate.classList.add('drop-ready');
    }, { signal: events.signal });
    root.addEventListener('pointerup', event => {
        if (!drag || drag.pointer !== event.pointerId)
            return;
        const current = drag;
        const dx = event.clientX - current.x;
        if (current.moved)
            suppressClickUntil = performance.now() + 350;
        clearDrag();
        if (current.type === 'force') {
            if (dx >= current.travel * .94)
                void experiment(current.travel, Math.min(dx, current.travel));
            else {
                setActorMood('idle');
                feedback = `아이를 오른쪽 표시까지 옮겨야 출발해요. 위의 ‘${tapLabel()}’ 버튼을 눌러도 돼요. 빠르게 옮겨도 천천히 옮겨도 힘은 같아요.`;
                update();
            }
        }
        else if (current.moved) {
            const bounds = crate.getBoundingClientRect();
            if (event.clientX >= bounds.left - 35 && event.clientX <= bounds.right + 35 && event.clientY >= bounds.top - 40 && event.clientY <= bounds.bottom + 30)
                setParts(Number(current.source.dataset.parts));
            else {
                feedback = '부품을 나무 상자 안에 놓아 봐요.';
                update();
            }
        }
    }, { signal: events.signal });
    const cancelDrag = () => {
        if (!drag) return;
        clearDrag();
        setActorMood('idle');
        update();
    };
    root.addEventListener('pointercancel', event => { if (drag?.pointer === event.pointerId)
        cancelDrag(); }, { signal: events.signal });
    root.addEventListener('lostpointercapture', event => { if (drag?.pointer === event.pointerId)
        cancelDrag(); }, { signal: events.signal });
    window.addEventListener('blur', cancelDrag, { signal: events.signal });
    window.addEventListener('resize', cancelDrag, { signal: events.signal });
    // The guide is sized from the stage box itself, so any width change (window, gutters, side panels) re-measures it.
    const stageResize = new ResizeObserver(() => positionGuide());
    stageResize.observe(field);
    handle.addEventListener('click', event => { if (event.detail === 0 && !drag)
        { rearm(); void experiment(travel()); } }, { signal: events.signal });
    // Tap alternative to dragging: the same experiment(), which canPush()/busy already guard against double runs.
    tapGo.addEventListener('click', () => { if (drag || manualDelivery()) return; rearm(); void experiment(travel()); }, { signal: events.signal });
    /** Level 1 tries not yet in the record, push before pull, light to heavy. */
    function missingTries() {
        return (['push', 'pull'] as const).flatMap(action => cargoLoads.map(parts => ({ action, parts })))
            .filter(step => !state.runs.some(run => run.parts === step.parts && run.action === step.action));
    }
    /** Runs the missing tries (level 1) or the open orders with their fitting force (level 2)
     * through the same experiment() as a drag, one after another, with a pause to look. */
    async function autoPlay() {
        if (!context.autoDemoEnabled() || autoPlaying || busy || waiting || drag || (level === 2 && deliveredAll())) return;
        const runId = ++autoRunId;
        const running = () => active && autoPlaying && runId === autoRunId;
        autoPlaying = true;
        if (level === 1) showDemo = true;
        deliveryResult = null;
        closePopup();
        clearTimeout(popupTimer); pendingPopup = null;
        feedback = level === 1 ? '자동으로 실험해요. 상자가 어디서 멈추는지 지켜봐요.' : '자동으로 배달해요. 부품 개수마다 어떤 힘을 고르는지 지켜봐요.';
        update();
        const pause = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion() ? Math.min(ms, 250) : ms));
        while (running() && level === 2 && !deliveredAll()) {
            force = null;
            resetCrate();
            update();
            await pause(700);
            if (!running()) break;
            force = orderSolution(currentOrder());
            if (force) context.sound(380 + force * 60);
            update();
            await pause(700);
            if (!running()) break;
            await experiment(travel(), 0, true);
            // The last delivery ends auto mode at once, so its result card offers the finish button.
            if (deliveredAll()) break;
            await pause(1100);
        }
        for (const step of level === 1 ? missingTries() : []) {
            if (!running()) break;
            if (state.action !== step.action) railRuns = [];
            state.action = step.action;
            state.parts = step.parts;
            needsSetup = false;
            resetCrate();
            context.commit();
            update();
            await pause(700);
            if (!running()) break;
            await experiment(travel(), 0, true);
            await pause(1100);
        }
        if (runId !== autoRunId) return;
        autoPlaying = false;
        if (active) update();
    }
    function stopAutoPlay() {
        autoRunId++;
        autoPlaying = showDemo = false;
        feedback = '자동 실험을 멈췄어요. 직접 이어서 해도 돼요.';
        needsSetup = false;
        if (level === 2 && !busy) {
            force = null;
            resetCrate();
        }
        update();
    }
    autoGo.addEventListener('click', () => {
        if (autoPlaying) stopAutoPlay();
        else void autoPlay();
    }, { signal: events.signal });
    window.addEventListener(autoDemoSettingChange, () => {
        if (autoPlaying && !context.autoDemoEnabled()) stopAutoPlay();
        else update();
    }, { signal: events.signal });
    function schedulePopup(show: () => void, delay: number) {
        clearTimeout(popupTimer);
        pendingPopup = show;
        popupTimer = window.setTimeout(() => {
            if (!active || drag || busy) return; // clearDrag reschedules a result held back by a drag
            pendingPopup = null;
            show();
        }, reducedMotion() ? Math.min(delay, 300) : delay);
    }
    function closePopup() { popup?.close(); }
    function openPopup(label: string, title: string, body: string, onClose?: () => void) {
        closePopup();
        const dialog = document.createElement('dialog');
        dialog.className = 'stage-popup cargo-popup';
        dialog.setAttribute('aria-labelledby', 'cargo-popup-title');
        const needsFinding = level === 1 && ready() && !finding;
        dialog.innerHTML = cargoPopupMarkup(label, title, body, needsFinding, finish.disabled);
        dialog.querySelector('.stage-result-finish')?.addEventListener('click', () => { if (!finish.disabled) { dialog.close(); finish.click(); } });
        dialog.querySelectorAll('.stage-popup-close,.stage-popup-continue').forEach(b => b.addEventListener('click', () => dialog.close()));
        dialog.addEventListener('close', () => {
            dialog.remove();
            if (popup === dialog) popup = null;
            if (!active) return;
            if (onClose) onClose();
            else update();
        });
        popup = dialog;
        root.append(dialog);
        dialog.showModal();
        return dialog;
    }
    function questionMarkup() {
        if (!ready()) return '';
        return `<div class="cargo-discovery question-zone"><span class="question-label">생각해 볼 문제</span><strong class="question-prompt">같은 힘·시간으로 움직였을 때, 더 멀리 간 상자는?</strong>${finding ? '' : `<div class="question-choices"><button data-finding="light"${performance.now() < findingLockUntil ? ' disabled' : ''}>부품 1개</button><button data-finding="heavy"${performance.now() < findingLockUntil ? ' disabled' : ''}>부품 5개</button></div>`}<p class="cargo-finding" role="status">${findingNote || findingMessage(finding)}</p></div>`;
    }
    function nextHint() {
        if (finding && deliveredAll()) return '배달은 끝났어요. 두 버튼으로 세 상자를 다시 움직여 봐요.';
        if (finding) return level === 1 ? `이 창을 닫고 가운데 <strong>${requestOpenLabel}</strong>를 눌러 의뢰를 받아요.` : '';
        if (ready()) return '위에서 <strong>더 멀리 간 상자</strong>를 고르면 빵집에서 도와 달라는 부탁(의뢰)이 와요.';
        if (!showDemo) return manualHint();
        if (!pushCompared()) return '<strong>밀기</strong>로 1·3·5개 상자를 모두 움직여 봐요.';
        return '<strong>당기기</strong>로 1·3·5개 상자를 모두 움직여 봐요.';
    }
    /** Level 1 record card: after a try it leads with that result; once both comparisons exist it asks the question. */
    function recordPopup(run?: CargoRun) {
        const asking = ready() && !finding;
        const label = asking ? '비교하고 의뢰 받기' : run ? '실험 결과' : '내 실험 기록';
        const title = asking ? '더 멀리 간 상자는 어느 쪽일까?' : run ? `부품 ${run.parts}개 상자를 ${run.action === 'push' ? '밀었더니' : '당겼더니'} ${run.distance}칸 갔어요` : '같은 힘으로 몇 칸 갔을까?';
        const hint = nextHint();
        const leavingDemo = showDemo && asking;
        openPopup(label, title, `<div class="cargo-record">${cargoTracesMarkup(comparisonRun, directionText)}${questionMarkup()}${level === 2 ? cargoOrdersMarkup(orders(), forceName) : ''}${hint ? `<p class="cargo-popup-next">${hint}</p>` : ''}</div>`, leavingDemo ? () => {
            showDemo = false;
            update();
        } : undefined);
    }
    function findingMessage(correct: boolean) {
        const light = comparisonRun(1), heavy = comparisonRun(5);
        if (!light || !heavy) return '1개와 5개를 먼저 해 봐요.';
        if (!ready()) return '밀기와 당기기도 먼저 해 봐요.';
        if (correct) return '맞아요! 같은 힘·시간이면 가벼운 상자가 더 멀리 갔어요. 몇 칸 차이였나요?';
        return findingTried ? '부품 5개 막대가 정말 더 길었나요? 두 막대의 끝을 견주어 봐요.' : '막대를 보고 골라 봐요.';
    }
    root.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-finding]');
        if (!button || busy || drag || performance.now() < findingLockUntil) return;
        findingTried = true;
        const light = comparisonRun(1), heavy = comparisonRun(5);
        const correct = ready() && !!light && !!heavy && light.distance > heavy.distance && button.dataset.finding === 'light';
        // Once found, the finding stays: level 2 builds on it.
        if (correct && !finding) {
            finding = true;
            state.orders ??= [];
            context.commit();
        }
        findingNote = findingMessage(correct);
        if (level === 1) setActorMood(correct ? 'success' : 'observe');
        context.sound(correct ? 720 : 520);
        if (correct) {
            // Leave the stage free; the student opens the request when ready.
            feedback = `${findingNote} 가운데 ‘${requestOpenLabel}’를 눌러요.`;
            closePopup();
            return;
        }
        const note = popup?.querySelector('.cargo-finding');
        if (note) note.textContent = findingNote;
        findingLockUntil = performance.now() + findingLockMs;
        const choices = [...(popup?.querySelectorAll<HTMLButtonElement>('[data-finding]') ?? [])];
        choices.forEach(choice => { choice.disabled = true; });
        clearTimeout(findingLockTimer);
        findingLockTimer = window.setTimeout(() => { if (active) choices.forEach(choice => { choice.disabled = false; }); }, findingLockMs);
        update();
    }, { signal: events.signal });
    finish.addEventListener('click', () => {
        if (!ready() || !finding || !deliveredAll() || busy || waiting) return;
        const light = comparisonRun(1)!;
        const heavy = comparisonRun(5)!;
        const delivered = cargoOrders.map((order, i) => `${order.parts}개는 ${forceName(orders()[i] as ForceLevel)}`).join(', ');
        context.finish('cargo', `저장된 ${state.runs.length}번의 실험에서 같은 바닥·힘·시간으로 1개 상자는 ${light.distance}칸, 5개 상자는 ${heavy.distance}칸 움직였어요. 밀기·당기기 비교: ${directionText()} 빵집 오븐 수리 부품 배달에서는 ${delivered}으로 같은 노란 칸에 멈춰, 무거운 상자일수록 같은 곳까지 보내려면 더 큰 힘이 필요했어요.`);
    }, { signal: events.signal });
    if (finding) findingNote = findingMessage(true);
    if (level === 2 && deliveredAll()) {
        const distance = cargoDistance(currentOrder().parts, orders().at(-1) as ForceLevel);
        deliveryResult = { distance, outcome: 'hit' };
        crate.style.left = endPosition(distance);
        setActorMood('success');
    }
    update();
    return () => {
        active = false;
        clearTimeout(popupTimer);
        clearTimeout(findingLockTimer);
        closePopup();
        stageResize.disconnect();
        clearDrag();
        events.abort();
        animation?.cancel();
        for (const move of comparisons) move.cancel();
        hint.dispose();
    };
}
