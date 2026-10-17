import type { AppContext } from '../appTypes';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { showPredictionChip } from '../predictionChip';
import { cargoDistance, cargoForceNames, cargoOrders, orderHint, orderResult, ordersComplete, type ForceLevel } from '../cargoModel';
import type { CargoRun } from '../state';
import { requestsEnabled } from '../state';
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
    let timer = 0;
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
    let level: 1 | 2 = finding ? 2 : 1;
    let force: ForceLevel | null = null;
    let misses = 0;
    let findingTried = false;
    let ghosts: { distance: number; force: ForceLevel }[] = [];
    let orderCards = '';
    const fingerIcon = `<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M11 18V6a3 3 0 0 1 6 0v9l2-1 4 2 3 2v9c0 5-3 7-8 7h-2c-4 0-6-2-8-6l-5-8c-2-3 2-6 4-3l4 5" fill="#fff5d7" stroke="#76512a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 16v6m6-5v6" stroke="#76512a" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    let feedback = level === 1 ? '같은 힘으로 상자를 움직이고, 멈춘 곳을 비교해요.' : '빵집 문 앞 노란 칸에 딱 멈추게 보내요.';
    root.innerHTML = `<section class="experiment-screen cargo-expedition">
    <div class="experiment-heading"><div><p class="eyebrow">01 · 물자 배송소</p><h1>멈춘 화물을 움직여라!</h1><p>같은 힘을 주면, 무거운 상자도 같은 곳에 도착할까?</p></div>${missionProgressMarkup('cargo', ['1개·5개', '밀기·당기기', '더 멀리 간 상자', '빵집 주문 3장'])}</div>
    <div class="cargo-adventure"><div class="cargo-scene" aria-label="화물 실험 무대">
      <div class="cargo-scene-caption"><span class="instrument-phase cargo-step" id="cargo-step" tabindex="-1"></span></div>
      <div class="cargo-rail"><span class="rail-start">출발</span><span class="rail-end">어디까지 갈까?</span><i class="rail-ticks"></i><div class="cargo-target-zone" hidden><span>빵집 문 앞</span></div><div class="cargo-ghosts" aria-hidden="true"></div><div class="cargo-gesture-guide" aria-hidden="true"><span class="cargo-gesture-arrow">→</span><span class="cargo-gesture-target">같은 힘</span></div><div class="cargo-object" data-mood="idle" aria-label="부품을 담는 상자"><span class="cargo-pull-strap" aria-hidden="true"></span><span class="cargo-force-arrow" aria-hidden="true"><b>같은 힘</b></span><button class="cargo-worker-grip"><img class="cargo-worker cargo-worker-push" src="${imagePath('student-cargo-push')}" alt="" draggable="false"><img class="cargo-worker cargo-worker-pull" src="${imagePath('student-cargo-pull')}" alt="" draggable="false"><span class="cargo-grab-cue">${fingerIcon}</span></button><img class="cargo-box-art" src="${imagePath('crate-empty')}" alt="나무 운반 상자" draggable="false"><div class="cargo-contents"></div><span class="cargo-load-tag"></span></div></div>
      <div class="cargo-distance" role="status"></div>
    </div><div class="cargo-dock"><div class="cargo-inventory" data-level="1"><strong>① 부품을 담아요</strong><div class="cargo-load-options">${[1, 3, 5].map(n => `<button data-parts="${n}" aria-label="같은 금속 부품 ${n}개 담기"><img src="${imagePath('cargo-metal')}" alt="" draggable="false"><span>${n}개</span></button>`).join('')}</div></div><div class="cargo-method" data-level="1"><strong>② 힘을 주는 쪽</strong><div class="segmented"><button data-action="push">뒤에서 밀기 →</button><button data-action="pull">앞에서 당기기 →</button></div></div><div class="cargo-orders" data-level="2"><strong>빵집 주문서</strong><div class="cargo-order-cards"></div></div><div class="cargo-force" data-level="2"><strong>힘 단계</strong><div class="segmented">${([1, 2, 3] as const).map(f => `<button data-force="${f}"><i class="cargo-step-arrow" style="--step:${f}" aria-hidden="true"></i>${cargoForceNames[f - 1]}</button>`).join('')}</div></div><button class="cargo-notebook-toggle" aria-expanded="false">나란히 비교 <span id="cargo-record-count">0</span></button></div>
    <div class="cargo-notebook" hidden><div><h2>같은 힘으로 몇 칸 갔을까?</h2><div id="cargo-traces"></div><p id="cargo-direction"></p></div><div class="cargo-discovery"><strong>더 멀리 간 상자는?</strong><div><button data-finding="light">부품 1개</button><button data-finding="heavy">부품 5개</button></div><p id="cargo-finding" role="status"></p><div class="cargo-bakery-call" id="cargo-bakery-call" hidden><p><strong>빵집 오븐이 고장 났대요!</strong> 수리 부품을 빵집 문 앞에 멈춰 주세요.</p><button class="button button-primary" id="cargo-open-orders">빵집 배달 가기 →</button></div></div></div></div>
    <div class="experiment-footer"><span class="feedback" id="cargo-feedback" role="status"></span><button class="button button-primary" id="cargo-finish" disabled>운반 레일 복구하기 →</button></div></section>`;
    const field = root.querySelector<HTMLElement>('.cargo-scene')!;
    const crate = root.querySelector<HTMLElement>('.cargo-object')!;
    const handle = root.querySelector<HTMLButtonElement>('.cargo-worker-grip')!;
    const finish = root.querySelector<HTMLButtonElement>('#cargo-finish')!;
    const notebook = root.querySelector<HTMLElement>('.cargo-notebook')!;
    const toggle = root.querySelector<HTMLButtonElement>('.cargo-notebook-toggle')!;
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
    function weightCompared() { return state.runs.some(r => r.parts === 1 && state.runs.some(h => h.parts === 5 && h.action === r.action)); }
    function directionCompared() { return [1, 3, 5].some(n => state.runs.some(r => r.parts === n && r.action === 'push') && state.runs.some(r => r.parts === n && r.action === 'pull')); }
    function ready() { return weightCompared() && directionCompared(); }
    function directionText() {
        const n = [1, 3, 5].find(parts => latestRun(parts, 'push') && latestRun(parts, 'pull'));
        if (!n) return '밀기와 당기기도 해 봐요.';
        const push = latestRun(n, 'push')!.distance, pull = latestRun(n, 'pull')!.distance;
        return `밀기 ${push}칸 · 당기기 ${pull}칸 → ${push === pull ? '거리가 같아요' : '거리가 조금 달라요'}`;
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
            return force ? `${label} · 아이를 잡고 오른쪽으로 옮겨요` : `${label} · 힘을 골라요`;
        }
        if (finding) return '나란히 비교에서 빵집 배달을 시작해요';
        if (ready()) return '나란히 비교에서 더 멀리 간 상자를 골라요';
        if (needsSetup) return !weightCompared() ? '부품 개수를 바꿔 같은 쪽에서 다시 움직여요' : '같은 개수로 미는 쪽을 바꿔 봐요';
        return '아이를 잡고 오른쪽 표시까지 옮긴 뒤 손을 놓아요';
    }
    function renderGhosts() {
        // Level 1: where every other load stopped, so 1·3·5 can be compared side by side on the rail.
        const items = level === 2
            ? ghosts.map((g, i) => ({ distance: g.distance, label: `${i === ghosts.length - 1 ? '지난번' : '그 전'} · ${forceName(g.force)}`, age: ghosts.length - 1 - i, parts: 0 }))
            : [1, 3, 5].filter(n => n !== state.parts).flatMap(n => { const run = latestRun(n); return run ? [{ distance: run.distance, label: `${n}개 도착`, age: 0, parts: n }] : []; });
        root.querySelector('.cargo-ghosts')!.innerHTML = items.map(g => `<div class="cargo-ghost" data-age="${g.age}" data-parts="${g.parts}" style="left:${endPosition(g.distance)}"><img src="${imagePath('crate-empty')}" alt="" draggable="false"><span>${g.label}</span></div>`).join('');
    }
    function update() {
        setMissionProgress(root, [weightCompared(), directionCompared(), finding, deliveredAll()], '');
        const parts = shownParts(), locked = busy || waiting;
        root.querySelector('.cargo-load-tag')!.textContent = `부품 ${parts}개`;
        const contents = root.querySelector<HTMLElement>('.cargo-contents')!;
        if (contents.childElementCount !== parts) contents.innerHTML = Array.from({ length: parts }, (_, i) => `<img src="${imagePath('cargo-metal')}" alt="" draggable="false" style="--part:${i}">`).join('');
        buttons.forEach(b => {
            const n = Number(b.dataset.parts), selected = n === state.parts;
            const suggest = !locked && state.parts === 1 && n !== 1;
            b.classList.toggle('selected', selected); b.classList.toggle('cargo-next-choice', suggest);
            b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', `같은 금속 부품 ${n}개 담기${suggest ? '. 다음에 비교해 봐요' : ''}`); b.disabled = locked;
            if (suggest && !b.querySelector('.cargo-choice-finger')) b.insertAdjacentHTML('beforeend', `<span class="cargo-choice-finger">${fingerIcon}</span>`);
            if (!suggest) b.querySelector('.cargo-choice-finger')?.remove();
        });
        root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => { b.classList.toggle('selected', b.dataset.action === state.action); b.setAttribute('aria-pressed', String(b.dataset.action === state.action)); b.disabled = locked; });
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
        handle.setAttribute('aria-label', level === 1
            ? `남자아이를 잡고 오른쪽 표시까지 ${action === 'push' ? '밀기' : '당기기'}. Enter로도 실험`
            : `남자아이를 잡고 ${forceLabel}으로 오른쪽 표시까지 밀기. Enter로도 실험`);
        field.dataset.busy = String(busy); field.dataset.setup = String(canPush());
        root.querySelector('#cargo-record-count')!.textContent = String(state.runs.length);
        step.textContent = stepText();
        root.querySelector('#cargo-feedback')!.textContent = feedback;
        root.querySelector('#cargo-traces')!.innerHTML = [1, 3, 5].map(n => { const r = latestRun(n); return `<div class="cargo-trace" data-parts="${n}"><span>${n}개</span><b><i style="width:${r ? Math.min(100, r.distance / 70 * 100) : 0}%"></i></b><strong>${r ? `${r.distance}칸` : '아직'}</strong></div>`; }).join('');
        root.querySelector('#cargo-direction')!.textContent = directionText();
        if (!finding && !findingTried) root.querySelector('#cargo-finding')!.textContent = findingMessage(false);
        root.querySelector<HTMLElement>('#cargo-bakery-call')!.hidden = !finding || level === 2;
        positionGuide();
        renderGhosts();
        finish.disabled = locked || !ready() || !finding || !(deliveredAll() || !requestsEnabled(context.save));
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
        state.runs = state.runs.slice(-20);
        needsSetup = true;
        context.commit();
        context.sound(710);
        setActorMood('observe');
        feedback = `부품 ${run.parts}개 상자는 ${run.distance}칸 갔어요.`;
        if (!hadBoth && latestRun(1) && latestRun(5))
            showPredictionChip(field, context.save, 'cargo');
        if (ready() && !finding) {
            notebook.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            feedback += ' 나란히 비교에서 정리해 봐요.';
        }
        update();
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
                return;
            }
            waiting = true;
            update();
            timer = window.setTimeout(() => {
                if (!active) return;
                waiting = false; force = null; misses = 0;
                resetCrate();
                feedback = `다음은 부품 ${currentOrder().parts}개! 더 무거워요.`;
                update();
            }, 1400);
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
        timer = window.setTimeout(() => {
            if (!active) return;
            waiting = false;
            resetCrate();
            update();
        }, reducedMotion() ? 400 : 1000);
    }
    function enterOrders() {
        if (!finding || busy) return;
        level = 2; force = null; misses = 0; ghosts = []; needsSetup = false;
        notebook.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
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
        return; state.action = b.dataset.action as 'push' | 'pull'; needsSetup = false; resetCrate(); context.commit(); feedback = state.action === 'push' ? '뒤에서 미는 쪽으로 바꿨어요.' : '앞에서 당기는 쪽으로 바꿨어요.'; update(); }, { signal: events.signal }));
    root.querySelectorAll<HTMLButtonElement>('[data-force]').forEach(b => b.addEventListener('click', () => { if (busy || waiting || drag || level !== 2 || deliveredAll())
        return; force = Number(b.dataset.force) as ForceLevel; context.sound(380 + force * 60); update(); }, { signal: events.signal }));
    root.querySelector('#cargo-open-orders')!.addEventListener('click', enterOrders, { signal: events.signal });
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
    }
    root.addEventListener('pointerdown', event => {
        if (busy || waiting || drag || event.button !== 0)
            return;
        const source = (event.target as Element).closest<HTMLButtonElement>('[data-parts],.cargo-worker-grip');
        if (!source || source.disabled)
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
            drag.ghost.innerHTML = `<img src="${imagePath('cargo-metal')}" alt="" draggable="false"><b>${drag.source.dataset.parts}개</b>`;
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
                feedback = '아이를 오른쪽 표시까지 옮겨야 출발해요. 빠르게 옮겨도 천천히 옮겨도 힘은 같아요.';
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
    window.addEventListener('resize', positionGuide, { signal: events.signal });
    handle.addEventListener('click', event => { if (event.detail === 0 && !drag)
        void experiment(travel()); }, { signal: events.signal });
    toggle.addEventListener('click', () => {
        notebook.hidden = !notebook.hidden;
        toggle.setAttribute('aria-expanded', String(!notebook.hidden));
    }, { signal: events.signal });
    function findingMessage(correct: boolean) {
        const light = latestRun(1), heavy = latestRun(5);
        if (!light || !heavy) return '1개와 5개를 먼저 해 봐요.';
        if (!ready()) return '밀기와 당기기도 먼저 해 봐요.';
        if (correct) return '맞아요! 가벼운 상자가 더 멀리 가요.';
        return findingTried ? '막대 길이를 다시 비교해 봐요.' : '막대를 보고 골라 봐요.';
    }
    root.querySelectorAll<HTMLButtonElement>('[data-finding]').forEach(button => {
        button.addEventListener('click', () => {
            if (busy || drag) return;
            findingTried = true;
            const light = latestRun(1), heavy = latestRun(5);
            const correct = ready() && !!light && !!heavy && light.distance > heavy.distance && button.dataset.finding === 'light';
            // Once found, the finding stays: level 2 builds on it.
            if (correct && !finding) {
                finding = true;
                state.orders ??= [];
                context.commit();
            }
            root.querySelector('#cargo-finding')!.textContent = findingMessage(correct);
            if (level === 1) setActorMood(correct ? 'success' : 'observe');
            context.sound(correct ? 720 : 520);
            update();
        }, { signal: events.signal });
    });
    finish.addEventListener('click', () => {
        if (!ready() || !finding || !(deliveredAll() || !requestsEnabled(context.save)) || busy || waiting) return;
        const light = latestRun(1)!;
        const heavy = latestRun(5)!;
        const delivered = cargoOrders.map((order, i) => `${order.parts}개는 ${forceName(orders()[i] as ForceLevel)}`).join(', ');
        context.finish('cargo', `저장된 ${state.runs.length}번의 실험에서 같은 힘으로 1개 상자는 ${light.distance}칸, 5개 상자는 ${heavy.distance}칸 움직였어요. 밀기·당기기 비교: ${directionText()}. 빵집 오븐 수리 부품 배달에서는 ${delivered}으로 같은 노란 칸에 멈춰, 무거운 상자일수록 같은 곳까지 보내려면 더 큰 힘이 필요했어요.`);
    }, { signal: events.signal });
    if (finding) root.querySelector('#cargo-finding')!.textContent = findingMessage(true);
    update();
    return () => {
        active = false;
        clearTimeout(timer);
        clearDrag();
        events.abort();
        animation?.cancel();
    };
}
