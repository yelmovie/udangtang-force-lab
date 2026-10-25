import type { AppContext } from '../appTypes';
import { cargoRunKey, keepEvidence } from '../runHistory';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { showPredictionChip } from '../predictionChip';
import { showRequestLetter } from '../requestLetter';
import { cargoActionCompared, cargoExplorationReady, cargoDistance, cargoForceNames, cargoOrders, orderHint, orderResult, ordersComplete, type ForceLevel } from '../cargoModel';
import type { CargoRun } from '../state';
import '../cargo.css';
const imagePath = (name: string) => `${import.meta.env.BASE_URL}assets/game/${name}.webp`;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function mountCargo(root: HTMLElement, context: AppContext): () => void {
    const state = context.save.cargo;
    // Level 1 always uses the medium step; older saves stored distances from an earlier model.
    for (const run of state.runs) run.distance = cargoDistance(run.parts, 2);
    const events = new AbortController();
    let active = true, busy = false, waiting = false, needsSetup = false;
    let animation: Animation | null = null;
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
    // Once every order is delivered the stage reopens as free level 1 experimenting, so it never locks.
    let level: 1 | 2 = finding && !ordersComplete(state.orders) ? 2 : 1;
    let force: ForceLevel | null = null;
    let misses = 0;
    let findingTried = false;
    // After a wrong pick the two choices stay off for a moment, so the next pick follows a look at the bars.
    const findingLockMs = 1500;
    let findingLockUntil = 0;
    let findingLockTimer = 0;
    let ghosts: { distance: number; force: ForceLevel }[] = [];
    // Level 1 rail traces: only tries made in the current direction since entering or switching,
    // because push and pull stop at the same spot and older traces read as leftover crates.
    let railRuns: CargoRun[] = [];
    let orderCards = '';
    const fingerIcon = `<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M11 18V6a3 3 0 0 1 6 0v9l2-1 4 2 3 2v9c0 5-3 7-8 7h-2c-4 0-6-2-8-6l-5-8c-2-3 2-6 4-3l4 5" fill="#fff5d7" stroke="#76512a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 16v6m6-5v6" stroke="#76512a" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    let feedback = level === 1 ? '같은 힘으로 상자를 움직이고, 멈춘 곳을 비교해요.' : '빵집 문 앞 노란 칸에 딱 멈추게 보내요.';
    root.innerHTML = `<section class="experiment-screen cargo-expedition">
    <div class="experiment-heading"><div><p class="eyebrow">01 · 물자 배송소</p><h1>멈춘 화물을 움직여라!</h1><p>같은 힘·시간으로 밀면, 무거운 상자도 같은 곳에 도착할까?</p></div><div class="cargo-tools"><button class="cargo-record-open" id="cargo-record-open">기록 보기 <span id="cargo-record-count">0</span></button><button class="button button-primary cargo-bakery-open" id="cargo-open-orders" hidden>실험 마치고 의뢰 보기 →</button></div>${missionProgressMarkup('cargo', ['밀기 1·3·5개', '당기기 1·3·5개', '더 멀리 간 상자', '빵집 주문 3장'])}</div>
    <div class="cargo-adventure"><div class="cargo-scene" aria-label="화물 실험 무대">
      <div class="cargo-scene-caption"><span class="instrument-phase cargo-step" id="cargo-step" tabindex="-1"></span><button class="button button-primary cargo-tap-go" id="cargo-tap-go">눌러서 밀기 →</button></div>
      <div class="cargo-finding-cta" hidden><p>실험 끝! 1·3·5개 상자를 모두 밀고 당겨 봤어요.</p><button class="button button-primary" id="cargo-finding-go">비교하고 의뢰 받기 →</button></div>
      <div class="cargo-rail"><span class="rail-start">출발</span><span class="rail-end">어디까지 갈까?</span><i class="rail-ticks"></i><div class="cargo-target-zone" hidden><span>빵집 문 앞</span></div><div class="cargo-ghosts" aria-hidden="true"></div><div class="cargo-gesture-guide" aria-hidden="true"><span class="cargo-gesture-arrow">→</span><span class="cargo-gesture-target">같은 힘</span></div><div class="cargo-object" data-mood="idle" aria-label="부품을 담는 상자"><span class="cargo-pull-strap" aria-hidden="true"></span><span class="cargo-force-arrow" aria-hidden="true"><b>같은 힘</b></span><button class="cargo-worker-grip"><img class="cargo-worker cargo-worker-push" src="${imagePath('student-cargo-push')}" alt="" draggable="false"><img class="cargo-worker cargo-worker-pull" src="${imagePath('student-cargo-pull')}" alt="" draggable="false"><span class="cargo-grab-cue">${fingerIcon}</span></button><img class="cargo-box-art" src="${imagePath('crate-empty')}" alt="나무 운반 상자" draggable="false"><div class="cargo-contents"></div><span class="cargo-load-tag"></span></div></div>
      <div class="cargo-distance" role="status"></div>
    </div><div class="cargo-dock"><div class="cargo-inventory" data-level="1"><strong>① 상자에 담을 부품</strong><div class="cargo-load-options">${[1, 3, 5].map(n => `<button data-parts="${n}" aria-label="같은 금속 부품 ${n}개 담기"><img src="${imagePath(`cargo-parts-${n}`)}" alt="" draggable="false"><span>부품 ${n}개</span></button>`).join('')}</div></div><div class="cargo-method" data-level="1"><strong>② 힘을 주는 쪽</strong><div class="segmented"><button data-action="push">뒤에서 밀기 →</button><button data-action="pull">앞에서 당기기 →</button></div></div><div class="cargo-orders" data-level="2"><strong>빵집 주문서</strong><div class="cargo-order-cards"></div></div><div class="cargo-force" data-level="2"><strong>힘 단계</strong><div class="segmented">${([1, 2, 3] as const).map(f => `<button data-force="${f}"><i class="cargo-step-arrow" style="--step:${f}" aria-hidden="true"></i>${cargoForceNames[f - 1]}</button>`).join('')}</div></div></div></div>
    <div class="experiment-footer"><span class="feedback" id="cargo-feedback" role="status"></span><button class="button button-primary" id="cargo-finish" disabled>운반 레일 복구하기 →</button></div></section>`;
    const field = root.querySelector<HTMLElement>('.cargo-scene')!;
    const crate = root.querySelector<HTMLElement>('.cargo-object')!;
    const handle = root.querySelector<HTMLButtonElement>('.cargo-worker-grip')!;
    const finish = root.querySelector<HTMLButtonElement>('#cargo-finish')!;
    const recordOpen = root.querySelector<HTMLButtonElement>('#cargo-record-open')!;
    const ordersOpen = root.querySelector<HTMLButtonElement>('#cargo-open-orders')!;
    const tapGo = root.querySelector<HTMLButtonElement>('#cargo-tap-go')!;
    // Results and the comparison question live in a popup that opens only after a try ends,
    // so the stage itself keeps the full width while the student is operating it.
    let popup: HTMLDialogElement | null = null;
    let popupTimer = 0;
    let pendingPopup: (() => void) | null = null;
    let findingNote = '';
    const step = root.querySelector<HTMLElement>('#cargo-step')!;
    const setActorMood = (mood: 'idle' | 'effort' | 'observe' | 'success') => { crate.dataset.mood = mood; };
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-parts]')];
    const endPosition = (distance: number) => `${17 + distance * .7}%`;
    const forceName = (f: ForceLevel) => cargoForceNames[f - 1];
    const orders = () => state.orders ?? [];
    const deliveredAll = () => ordersComplete(state.orders);
    const currentOrder = () => cargoOrders[Math.min(orders().length, cargoOrders.length - 1)];
    const shownParts = () => level === 2 ? currentOrder().parts : state.parts;
    function latestRun(parts: number, action?: CargoRun['action']) { return [...state.runs].reverse().find(run => run.parts === parts && (!action || run.action === action)); }
    function pushCompared() { return cargoActionCompared(state.runs, 'push'); }
    function pullCompared() { return cargoActionCompared(state.runs, 'pull'); }
    function ready() { return cargoExplorationReady(state.runs); }
    function directionText() {
        const n = [1, 3, 5].find(parts => latestRun(parts, 'push') && latestRun(parts, 'pull'));
        if (!n) return '밀기와 당기기도 해 봐요.';
        const push = latestRun(n, 'push')!.distance, pull = latestRun(n, 'pull')!.distance;
        return `부품 ${n}개 · 밀기 ${push}칸 · 당기기 ${pull}칸. ${push === pull ? '같은 상자에 오른쪽으로 같은 힘을 같은 시간 동안 주어 거리가 같아요.' : '거리가 조금 달라요.'}`;
    }
    const travel = () => Math.max(64, Math.min(120, field.clientWidth * .12));
    const canPush = () => !busy && !waiting && (level === 1 ? !needsSetup : force !== null && !deliveredAll());
    function resetForce() { field.style.setProperty('--charge', '0'); crate.style.transform = ''; field.classList.remove('cargo-dragging'); }
    function resetCrate() { crate.style.transform = ''; crate.style.left = endPosition(0); root.querySelector('.cargo-distance')!.textContent = ''; setActorMood('idle'); }
    function positionGuide() {
        const rail = root.querySelector<HTMLElement>('.cargo-rail')!;
        const actorWidth = handle.offsetWidth;
        const start = rail.clientWidth * .17 + (field.dataset.action !== 'pull' ? -actorWidth / 2 + 29 : crate.offsetWidth + 16 + actorWidth / 2);
        field.style.setProperty('--gesture-start', `${start}px`);
        field.style.setProperty('--gesture-travel', `${travel()}px`);
    }
    function stepText() {
        if (busy) return level === 1 ? '같은 힘으로 출발! 어디서 멈출까?' : `${forceName(force!)}으로 출발!`;
        if (level === 2) {
            if (deliveredAll()) return '배달 완료! 운반 레일 복구하기를 눌러요';
            if (waiting) return misses ? '흔적을 보고 힘을 다시 골라요' : '배달 성공! 다음 주문이 와요';
            const label = `주문 ${orders().length + 1} · 부품 ${currentOrder().parts}개`;
            return force ? `${label} · 아이를 옮기거나 눌러서 밀기` : `${label} · 아래에서 힘을 고른 뒤 움직여 보세요`;
        }
        if (finding && deliveredAll()) return '배달 완료! 부품과 방향을 바꿔 더 실험해 봐요';
        if (finding) return '위의 빵집 배달 가기를 눌러요';
        if (ready()) return '실험은 끝! 가운데 비교하고 의뢰 받기를 눌러요';
        if (needsSetup) return !pushCompared() ? '뒤에서 밀기로 1·3·5개 상자를 모두 비교해요' : '앞에서 당기기로 1·3·5개 상자를 모두 비교해요';
        return '아이를 오른쪽 표시까지 옮기거나 눌러서 움직여요';
    }
    function renderGhosts() {
        // Level 1: where every other load stopped, so 1·3·5 can be compared side by side on the rail.
        const items = level === 2
            ? ghosts.map((g, i) => ({ distance: g.distance, label: `${i === ghosts.length - 1 ? '지난번' : '그 전'} · ${forceName(g.force)}`, age: ghosts.length - 1 - i, parts: 0 }))
            : [1, 3, 5].flatMap(n => { const run = [...railRuns].reverse().find(r => r.parts === n); return run ?[{ distance: run.distance, label: `${n}개 상자가 멈춘 곳`, age: 0, parts: n, current: n === state.parts }] : []; });
        // The crate the student is pushing right now keeps its own picture; only its arrival sign is drawn.
        root.querySelector('.cargo-ghosts')!.innerHTML = items.map(g => `<div class="cargo-ghost" data-age="${g.age}" data-parts="${g.parts}" data-current="${'current' in g && g.current}" style="left:${endPosition(g.distance)}"><img src="${imagePath('crate-empty')}" alt="" draggable="false"><span>${g.label}</span></div>`).join('');
    }
    function update() {
        setMissionProgress(root, [pushCompared(), pullCompared(), finding, deliveredAll()], '');
        const parts = shownParts(), locked = busy || waiting;
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
        root.querySelector<HTMLElement>('.cargo-force')?.toggleAttribute('data-waiting', level === 2 && force === null && !deliveredAll());
        root.querySelectorAll<HTMLButtonElement>('[data-force]').forEach(b => { const f = Number(b.dataset.force); b.classList.toggle('selected', f === force); b.setAttribute('aria-pressed', String(f === force)); b.disabled = locked || deliveredAll(); });
        root.querySelectorAll<HTMLElement>('.cargo-dock [data-level]').forEach(part => { part.hidden = Number(part.dataset.level) !== level; });
        const cards = cargoOrders.map((order, i) => {
            const done = orders()[i] as ForceLevel | undefined, now = !done && i === orders().length;
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
        zone.style.setProperty('--zone-span', `${(hi - lo) * .7}%`);
        handle.disabled = !canPush();
        tapGo.textContent = action === 'pull' ? '눌러서 당기기 →' : '눌러서 밀기 →';
        tapGo.disabled = !canPush() && !needsForce();
        handle.setAttribute('aria-label', level === 1
            ? `남자아이를 잡고 오른쪽 표시까지 ${action === 'push' ? '밀기' : '당기기'}. Enter로도 실험`
            : `남자아이를 잡고 ${forceLabel}으로 오른쪽 표시까지 밀기. Enter로도 실험`);
        field.dataset.busy = String(busy); field.dataset.setup = String(canPush());
        root.querySelector('#cargo-record-count')!.textContent = String(state.runs.length);
        recordOpen.disabled = locked || !state.runs.length;
        // The next step sits in the middle of the stage, where it cannot be missed on a board or tablet.
        const needsFinding = level === 1 && ready() && !finding;
        root.querySelector<HTMLElement>('.cargo-finding-cta')!.hidden = !needsFinding || locked;
        root.querySelector<HTMLElement>('.cargo-scene-caption')!.hidden = needsFinding && !locked;
        ordersOpen.hidden = !finding || level === 2 || deliveredAll();
        step.textContent = stepText();
        root.querySelector('#cargo-feedback')!.textContent = feedback;
        // The request is opened explicitly after the whole exploration, never from update().
        positionGuide();
        renderGhosts();
        finish.disabled = locked || !ready() || !finding || !deliveredAll();
    }
    async function experiment(gesture: number, preview = 0) {
        if (!canPush())
            return;
        busy = true;
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
        busy = false;
        resetForce();
        root.querySelector('.cargo-distance')!.textContent = `${distance}칸 이동`;
        if (level === 1) recordRun({ parts, action: state.action, gesture, distance });
        else deliver(distance, push);
    }
    function recordRun(run: CargoRun) {
        const hadBoth = !!latestRun(1) && !!latestRun(5);
        state.runs.push(run);
        state.runs = keepEvidence(state.runs, cargoRunKey);
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
    function deliver(distance: number, push: ForceLevel) {
        const order = currentOrder(), result = orderResult(order, distance);
        if (result === 'hit') {
            state.orders = [...orders(), push];
            ghosts = [];
            context.commit();
            context.sound(780);
            setActorMood('success');
            feedback = `배달 성공! 부품 ${order.parts}개는 ${forceName(push)}으로 딱 멈췄어요.`;
            if (deliveredAll()) {
                feedback += ' 오븐을 고칠 수 있어요!';
                update();
                schedulePopup(() => openPopup('배달 결과', '배달 완료! 오븐을 고칠 수 있어요', `<p>부품 ${order.parts}개는 ${forceName(push)}으로 빵집 문 앞에 딱 멈췄어요.</p>${ordersMarkup()}<p class="cargo-popup-next"><strong>운반 레일 복구하기</strong>를 누르거나, 더 실험해 봐도 돼요.</p>`, exploreFreely), 700);
                return;
            }
            waiting = true;
            update();
            schedulePopup(() => openPopup('배달 결과', '배달 성공!', `<p>부품 ${order.parts}개는 ${forceName(push)}으로 빵집 문 앞에 딱 멈췄어요.</p>${ordersMarkup()}<p class="cargo-popup-next">다음은 부품 ${currentOrder().parts}개! 더 무거워요.</p>`, () => {
                waiting = false; force = null; misses = 0;
                resetCrate();
                feedback = `다음은 부품 ${currentOrder().parts}개! 더 무거워요.`;
                update();
            }), 700);
            return;
        }
        // A miss leaves a trace, never a penalty: the stop spot stays as a ghost for the next try.
        misses++;
        ghosts = [...ghosts, { distance, force: push }].slice(-2);
        context.sound(600);
        setActorMood('observe');
        feedback = orderHint(result, misses);
        waiting = true;
        update();
        schedulePopup(() => openPopup('배달 결과', result === 'over' ? '노란 칸을 지나쳤어요' : '노란 칸까지 못 갔어요', `<p>${forceName(push)}으로 ${distance}칸 갔어요. 멈춘 자리는 흐린 상자로 남아 있어요.</p><p class="cargo-popup-next">${feedback}</p>`, () => {
            waiting = false;
            resetCrate();
            update();
        }), 700);
    }
    function exploreFreely() {
        if (!active || level === 1) return update();
        level = 1; force = null; misses = 0; ghosts = []; railRuns = []; needsSetup = false;
        resetCrate();
        feedback = '배달 완료! 부품 개수나 힘을 주는 쪽을 바꿔 더 실험해 봐요.';
        update();
    }
    function needsForce() { return level === 2 && force === null && !deliveredAll() && !busy && !waiting; }
    function nudgeForce() {
        const row = root.querySelector<HTMLElement>('.cargo-force')!;
        row.classList.remove('cargo-force-nudge'); void row.offsetWidth; row.classList.add('cargo-force-nudge');
        feedback = '먼저 아래에서 힘(작은 힘 · 중간 힘 · 큰 힘)을 골라요. 그다음 아이를 옮기거나 눌러서 밀어요.'; context.sound(300); update(); step.textContent = '먼저 아래에서 힘을 골라요 ↓';
    }
    function enterOrders() {
        if (!finding || !ready() || busy || waiting || drag || level!==1) return;
        level = 2; force = null; misses = 0; ghosts = []; needsSetup = false;
        closePopup();
        resetCrate();
        feedback = '빵집 문 앞 노란 칸에 딱 멈추게 보내요.';
        context.sound(520);
        update();
        step.focus({ preventScroll: true });
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
    root.querySelectorAll<HTMLButtonElement>('[data-force]').forEach(b => b.addEventListener('click', () => { if (busy || waiting || drag || level !== 2 || deliveredAll())
        return; force = Number(b.dataset.force) as ForceLevel; context.sound(380 + force * 60); update(); }, { signal: events.signal }));
    ordersOpen.addEventListener('click', () => {
        if (busy || waiting || drag || !ready() || !finding || level !== 1) return;
        closePopup(); showRequestLetter(root, 'cargo', enterOrders);
    }, { signal: events.signal });
    recordOpen.addEventListener('click', () => { if (!busy && !waiting && !drag) recordPopup(); }, { signal: events.signal });
    root.querySelector('#cargo-finding-go')!.addEventListener('click', () => { if (!busy && !waiting && !drag) recordPopup(); }, { signal: events.signal });
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
        if (busy || waiting || drag || event.button !== 0)
            return;
        const source = (event.target as Element).closest<HTMLButtonElement>('[data-parts],.cargo-worker-grip');
        if (!source)
            return;
        // Grabbing the child before a force is picked points the student at the force buttons instead of doing nothing.
        if (source === handle && source.disabled && needsForce()) {
            nudgeForce();
            return;
        }
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
                feedback = '아이를 오른쪽 표시까지 옮겨야 출발해요. 위의 눌러서 움직이기 버튼을 눌러도 돼요. 빠르게 옮겨도 천천히 옮겨도 힘은 같아요.';
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
        void experiment(travel()); }, { signal: events.signal });
    // Tap alternative to dragging: the same experiment(), which canPush()/busy already guard against double runs.
    tapGo.addEventListener('click', () => { if (drag) return; if (needsForce()) nudgeForce(); else void experiment(travel()); }, { signal: events.signal });
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
        dialog.innerHTML = `<div class="stage-popup-card"><button class="stage-popup-close" aria-label="닫기">×</button><p class="stage-popup-label">${label}</p><h2 id="cargo-popup-title">${title}</h2><div class="stage-popup-body">${body}</div><div class="stage-popup-actions">${!finish.disabled ? '<button class="button button-secondary stage-popup-continue">계속 실험하기</button><button class="button button-primary stage-result-finish">운반 레일 복구하기 →</button>' : `<button class="button ${needsFinding ? 'button-secondary' : 'button-primary'} stage-popup-continue">${needsFinding ? '더 실험해 보기' : '계속 실험하기'}</button>`}</div></div>`;
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
    function tracesMarkup() {
        return `<div class="cargo-traces">${[1, 3, 5].map(n => { const r = latestRun(n); return `<div class="cargo-trace" data-parts="${n}"><span>${n}개</span><b><i style="width:${r ? Math.min(100, r.distance / 70 * 100) : 0}%"></i></b><strong>${r ? `${r.distance}칸` : '아직'}</strong></div>`; }).join('')}</div><p class="cargo-direction">${directionText()}</p>`;
    }
    function ordersMarkup() {
        return `<div class="cargo-popup-orders">${cargoOrders.map((order, i) => { const done = orders()[i] as ForceLevel | undefined; return `<span data-state="${done ? 'done' : 'wait'}">주문 ${i + 1} · 부품 ${order.parts}개${done ? ` ✓ ${forceName(done)}` : ''}</span>`; }).join('')}</div>`;
    }
    function questionMarkup() {
        if (!ready()) return '';
        return `<div class="cargo-discovery question-zone"><span class="question-label">생각해 볼 문제</span><strong class="question-prompt">같은 힘·시간으로 움직였을 때, 더 멀리 간 상자는?</strong>${finding ? '' : `<div class="question-choices"><button data-finding="light"${performance.now() < findingLockUntil ? ' disabled' : ''}>부품 1개</button><button data-finding="heavy"${performance.now() < findingLockUntil ? ' disabled' : ''}>부품 5개</button></div>`}<p class="cargo-finding" role="status">${findingNote || findingMessage(finding)}</p></div>`;
    }
    function nextHint() {
        if (finding && deliveredAll()) return '배달은 끝났어요. 부품 개수나 힘을 주는 쪽을 바꿔 더 실험해 봐요.';
        if (finding) return level === 1 ? '위의 <strong>빵집 배달 가기</strong>를 눌러 의뢰를 받아요.' : '';
        if (ready()) return '위에서 <strong>더 멀리 간 상자</strong>를 고르면 빵집에서 도와 달라는 부탁(의뢰)이 와요.';
        if (!pushCompared()) return '<strong>뒤에서 밀기</strong>로 1·3·5개 상자를 모두 움직여 봐요.';
        return '<strong>앞에서 당기기</strong>로 1·3·5개 상자를 모두 움직여 봐요.';
    }
    /** Level 1 record card: after a try it leads with that result; once both comparisons exist it asks the question. */
    function recordPopup(run?: CargoRun) {
        const asking = ready() && !finding;
        const label = asking ? '비교하고 의뢰 받기' : run ? '실험 결과' : '내 실험 기록';
        const title = asking ? '더 멀리 간 상자는 어느 쪽일까?' : run ? `부품 ${run.parts}개 상자를 ${run.action === 'push' ? '밀었더니' : '당겼더니'} ${run.distance}칸 갔어요` : '같은 힘으로 몇 칸 갔을까?';
        const hint = nextHint();
        openPopup(label, title, `<div class="cargo-record">${tracesMarkup()}${questionMarkup()}${level === 2 ? ordersMarkup() : ''}${hint ? `<p class="cargo-popup-next">${hint}</p>` : ''}</div>`);
    }
    function findingMessage(correct: boolean) {
        const light = latestRun(1), heavy = latestRun(5);
        if (!light || !heavy) return '1개와 5개를 먼저 해 봐요.';
        if (!ready()) return '밀기와 당기기도 먼저 해 봐요.';
        if (correct) return '맞아요! 같은 힘·시간으로 움직인 이 실험에서는 가벼운 상자가 더 멀리 갔어요.';
        return findingTried ? '부품 5개 막대가 정말 더 길었나요? 두 막대의 끝을 견주어 봐요.' : '막대를 보고 골라 봐요.';
    }
    root.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-finding]');
        if (!button || busy || drag || performance.now() < findingLockUntil) return;
        findingTried = true;
        const light = latestRun(1), heavy = latestRun(5);
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
            feedback = `${findingNote} 위의 ‘실험 마치고 의뢰 보기’를 눌러요.`;
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
        const light = latestRun(1)!;
        const heavy = latestRun(5)!;
        const delivered = cargoOrders.map((order, i) => `${order.parts}개는 ${forceName(orders()[i] as ForceLevel)}`).join(', ');
        context.finish('cargo', `저장된 ${state.runs.length}번의 실험에서 같은 바닥·힘·시간으로 1개 상자는 ${light.distance}칸, 5개 상자는 ${heavy.distance}칸 움직였어요. 밀기·당기기 비교: ${directionText()} 빵집 오븐 수리 부품 배달에서는 ${delivered}으로 같은 노란 칸에 멈춰, 무거운 상자일수록 같은 곳까지 보내려면 더 큰 힘이 필요했어요.`);
    }, { signal: events.signal });
    if (finding) findingNote = findingMessage(true);
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
    };
}
