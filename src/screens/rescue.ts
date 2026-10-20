import type { AppContext } from '../appTypes';
import { icons } from '../icons';
import { canLift, stallTravel, comparisonHint, comparisonSummary, coreWeight, firstFairComparison, forceNames, hasFairComparison, rescueReady, retainRescueRuns, routeNames } from '../rescueModel';
import type { RescueRun } from '../state';
import { mountCompanion } from '../sprites';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { showPredictionChip } from '../predictionChip';
import { coreDragProgress } from '../coreSceneModel';
import type { CoreScene, CoreProjection } from '../three/coreScene';
import './rescue.css';
import './coreStudio.css';

export function mountRescue(root: HTMLElement, context: AppContext): () => void {
  const state = context.save.rescue, previous = context.save;
  const events = new AbortController();
  let active = true, busy = false, gateAction: 'push' | 'pull' = 'pull';
  let held: number | null = null, keyHeld = false, frame = 0, buttonPointer: number | null = null, buttonFrame = 0;
  let start = new DOMPoint(), current = new DOMPoint(), travel = 0, restProgress = 0;
  let usedClue = '';
  let feedback = '';
  let lastScaleReading:number|null=null;
  let weightDialog: HTMLDialogElement | null = null, wasLoaded = false;
  // A short lock after each stage change so a repeated tap on the same button does not start the next stage.
  let stageLock = false, lastStep = -1, stageTimer = 0, stopTimer = 0, slideFrame = 0, flashRecord = false;
  let scene: CoreScene | undefined, sceneTried = false, sceneLoading = false, sceneFailed = false, use2D = false;
  let inspecting = false, mounted3D = false;
  let corePointer: number | null = null, suppressGripClick = false, coreStart = { x: 0, y: 0 }, projection: CoreProjection | undefined;
  root.innerHTML = `<section class="experiment-screen rescue-screen rescue-redesign core-studio">
    <div class="experiment-heading"><div class="core-title"><span class="core-eyebrow">배터리 다시 끼우기 · 마지막 작전</span><h1>중앙 코어</h1></div>${missionProgressMarkup('rescue',['무게 확인','길 열기','같은 힘 비교','코어 도착'])}</div>
    <div class="rescue-stage"><div class="rescue-stage-head"><strong id="rescue-phase"></strong><span id="rescue-readout"></span><details class="rescue-notebook"><summary>내 발견 꺼내 쓰기 ▾</summary><div class="rescue-notes-body"><div id="rescue-clues"></div><p id="rescue-used-clue"></p><div id="rescue-checks" class="rescue-checks"></div><div id="rescue-runs" class="result-list"></div><p id="rescue-insight"></p></div></details></div>
      <div class="rescue-playfield">
        <svg class="rescue-world" viewBox="0 90 720 350" aria-label="코어와 장애물을 직접 움직이는 운반 작업대">
          <defs><linearGradient id="rescue-platform" x2="0" y2="1"><stop stop-color="#cda776"/><stop offset="1" stop-color="#77593e"/></linearGradient></defs>
          <path id="rescue-ground" d="M225 406H686" stroke="#d2b47e" stroke-width="24" stroke-linecap="round"/>
          <g id="route-art"><path d="M588 218H686V410H588Z" fill="url(#rescue-platform)"/>
            <path id="long-path" data-route="long" d="M100 390L608 220" fill="none" stroke="#4a9d8e" stroke-width="22" stroke-linecap="round"/>
            <path id="short-path" data-route="short" d="M407 390L608 220" fill="none" stroke="#c58243" stroke-width="22" stroke-linecap="round"/>
            <path d="M100 390L608 220M407 390L608 220" fill="none" stroke="#fff8d6" stroke-width="3" stroke-dasharray="7 14" pointer-events="none"/>
            <g class="rescue-route-label" data-route="long"><rect x="142" y="278" width="178" height="38" rx="12"/><text x="231" y="304">길고 완만한 빗면</text></g>
            <g class="rescue-route-label" data-route="short"><rect x="412" y="337" width="174" height="38" rx="12"/><text x="499" y="363">짧고 가파른 빗면</text></g>
            <g class="receiver"><ellipse cx="628" cy="217" rx="48" ry="17" fill="#205d63"/><path d="M589 213V135Q628 110 667 135V213" fill="#14494bc9" stroke="#cda866" stroke-width="9"/><ellipse cx="628" cy="135" rx="39" ry="12" fill="#d2b577"/><circle cx="628" cy="179" r="23" fill="#16484d" stroke="#76c4bb" stroke-width="4"/><text x="628" y="186" text-anchor="middle" fill="#edce84" font-size="24">✦</text></g>
          </g>
          <g id="scale-art"><g id="rescue-scale-device"><image href="/assets/game/scale.webp" x="235" y="225" width="270" height="200" preserveAspectRatio="none"/><rect x="279" y="337" width="119" height="43" rx="5" fill="#9ecfbc"/><text id="rescue-scale-value" x="339" y="368" text-anchor="middle" fill="#163f48" font-family="monospace" font-size="25" font-weight="800"></text><g id="rescue-scale-zero" tabindex="0" role="button" aria-label="빈 저울을 0으로 맞추기"><circle cx="465.5" cy="351" r="30" fill="transparent"/><circle cx="465.5" cy="351" r="16.5" fill="#1f63b6" stroke="#0f3f7c" stroke-width="1.5"/><ellipse cx="465.5" cy="345" rx="10" ry="5" fill="#ffffff" opacity=".22"/><text x="465.5" y="357.5" text-anchor="middle" fill="white" font-size="18" font-weight="900">0</text><title>빈 저울을 0 g으로 맞춰요</title></g></g><rect id="scale-drop-zone" x="245" y="162" width="240" height="132" rx="22" fill="transparent" stroke="#ffe09a" stroke-width="3" stroke-dasharray="8 8"/><text x="367" y="149" text-anchor="middle" fill="#fff6dd" font-size="22">코어를 저울 위로</text></g>
          <g id="gate-art"><image href="/assets/props/wood-crate.webp" x="23" y="298" width="83" height="101"/><image href="/assets/props/wood-crate.webp" x="23" y="223" width="83" height="101"/><g class="gate-stop-label"><rect x="13" y="193" width="104" height="29" rx="9" fill="#fff1cb"/><text x="65" y="214" text-anchor="middle" fill="#574022" font-size="17" font-weight="800">이쪽은 막혔어</text></g><path id="gate-rope" d="M216 345L294 345" stroke="#c79a53" stroke-width="7" stroke-linecap="round"/><g id="gate-crate" tabindex="0" role="button" aria-label="장애물 상자. 잡고 오른쪽으로 당기기"><ellipse cx="147" cy="398" rx="62" ry="9" fill="#34261766"/><image href="/assets/props/wood-crate.webp" x="89" y="279" width="135" height="119"/><rect x="82" y="271" width="145" height="134" rx="15" fill="transparent" stroke="#ffd984" stroke-width="2" stroke-dasharray="6 5"/></g><g id="gate-actor"><g id="gate-actor-lean"><image href="/assets/game/student-cargo-pull.webp" x="244" y="237" width="185" height="165"/></g></g><g class="gate-pull-label"><rect x="242" y="199" width="199" height="31" rx="10" fill="#fff1cb"/><text x="341" y="221" text-anchor="middle" fill="#284e48" font-size="18" font-weight="800">상자를 잡고 내 쪽으로 →</text></g></g>
          <g id="core-art" tabindex="0" role="button" aria-label="코어. 저울이나 선택한 빗면을 따라 끌기"><ellipse cx="0" cy="17" rx="38" ry="10" fill="#0b373a44"/><image href="/assets/props/core-cargo.webp" x="-46" y="-62" width="92" height="77"/></g>
        </svg><div id="core-scene-host" class="core-scene-host" hidden>
          <div id="core-loading" class="core-loading" role="status">코어 작업대를 준비하고 있어요…</div>
          <button id="core-grip" class="core-grip" aria-label="코어 움직이기. 빗면을 따라 끌거나 Enter를 누르고 있기" hidden><span>끌어서 운반</span></button>
          <div class="core-conditions"><i aria-hidden="true"></i>같은 코어 · 같은 힘 · 같은 도착 높이</div>
          <button class="core-route-tag long" id="core-long-tag" data-scene-route="long">B <span>길고 완만한 빗면</span></button><button class="core-route-tag short" id="core-short-tag" data-scene-route="short">A <span>짧고 가파른 빗면</span></button>
          <div class="core-view-tools" aria-label="3D 시점"><button data-core-view="left" aria-label="시점 왼쪽으로 돌리기">${icons.rotateLeft}</button><button data-core-view="inspect" aria-pressed="false">코어 확대</button><button data-core-view="right" aria-label="시점 오른쪽으로 돌리기">${icons.rotateRight}</button></div>
          <p class="core-view-hint">시점을 돌려 두 빗면을 살펴보세요.</p>
        </div><aside id="core-records" class="core-records" hidden><span class="core-panel-kicker">운반할 코어</span><div class="core-mass"><strong>${coreWeight}<small>g</small></strong><span>영점 확인<br>측정 완료</span></div><h2>비교 기록</h2><p id="core-force-note"></p><div id="core-comparison"></div><p id="core-recent" class="core-record-recent" hidden></p><p class="core-record-help">같은 힘으로 두 길을 시험하고<br>도착 여부를 비교하세요.</p></aside>
        <div id="rescue-companion" class="rescue-companion" aria-hidden="true"></div><div class="rescue-corgi-tip" id="rescue-corgi-tip" role="status"></div><div id="rescue-stop-mark" class="rescue-stop-mark" aria-hidden="true" hidden>멈춤!</div><div class="rescue-progress-track" aria-hidden="true"><i id="rescue-progress"></i></div><div class="rescue-world-note">같은 코어 · 같은 도착 높이</div>
      </div>
      <div class="rescue-bottom"><div id="rescue-controls" class="rescue-controls"></div><button class="rescue-step-button" id="core-handle">상자 조금 움직이기 →</button><p id="rescue-gesture-help"></p></div>
    </div><div class="experiment-footer"><span class="feedback" id="rescue-feedback" role="status"></span><button class="button button-primary" id="rescue-finish" disabled>코어 다시 장착하기 <span aria-hidden="true">→</span></button></div></section>`;
  const svg = root.querySelector<SVGSVGElement>('.rescue-world')!;
  const art = root.querySelector<SVGGElement>('#core-art')!;
  const gate = root.querySelector<SVGGElement>('#gate-crate')!;
  const controls = root.querySelector<HTMLElement>('#rescue-controls')!;
  const handle = root.querySelector<HTMLButtonElement>('#core-handle')!;
  const finish = root.querySelector<HTMLButtonElement>('#rescue-finish')!;
  const companion = mountCompanion(root.querySelector<HTMLElement>('#rescue-companion')!);
  const sceneHost = root.querySelector<HTMLElement>('#core-scene-host')!;
  const grip = root.querySelector<HTMLButtonElement>('#core-grip')!;
  const loading = root.querySelector<HTMLElement>('#core-loading')!;
  const viewTools = root.querySelector<HTMLElement>('.core-view-tools')!;
  const stopMark = root.querySelector<HTMLElement>('#rescue-stop-mark')!;
  const signal = events.signal;
  function phase() { return !state.measured ? 0 : !state.gate ? 1 : 2; }
  function point(event: PointerEvent) { const matrix = svg.getScreenCTM(); return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null; }
  function corePosition() { return phase() === 0 ? state.loaded ? { x:370,y:253 } : { x:585,y:380 } : { x:state.route === 'long' ? 100 : 407,y:381 }; }
  function pose(t = restProgress) {
    sceneHost.classList.toggle('has-core-travel', phase() === 2 && (t > 0 || state.delivered));
    const origin = corePosition();
    const x = phase() === 2 ? origin.x + (628 - origin.x) * t : origin.x;
    const y = phase() === 2 ? origin.y - 166 * t : origin.y;
    art.setAttribute('transform', `translate(${x},${y})`);
    gate.setAttribute('transform', `translate(${phase() === 1 ? Math.max(-10, Math.min(145, t * 145)) : 0},0)`);
    const gateShift=phase()===1?Math.max(-10,Math.min(145,t*145)):0;
    root.querySelector('#gate-actor')!.setAttribute('transform',`translate(${gateShift},0)`);
    const lean=-Math.max(0,t)*3;
    root.querySelector('#gate-actor-lean')!.setAttribute('transform',`rotate(${lean},335,400)`);
    const radians=lean*Math.PI/180;
    const handX=335-23*Math.cos(radians)+68*Math.sin(radians),handY=400-23*Math.sin(radians)-68*Math.cos(radians);
    root.querySelector('#gate-rope')!.setAttribute('d',`M${216+gateShift} 345L${handX+gateShift} ${handY}`);
    root.querySelector<HTMLElement>('#rescue-progress')!.style.width = `${Math.max(0, Math.min(1, t)) * 100}%`;
    scene?.configure(state.route, t, state.delivered);
  }
  function placeGrip(next: CoreProjection) {
    projection = next; grip.style.left = `${next.core.x}px`; grip.style.top = `${next.core.y}px`;
    // At the long ramp's left edge, keep the drag hint inside the work area.
    grip.classList.toggle('hint-right', next.core.x < 180);
    for (const route of ['long', 'short'] as const) {
      const label = root.querySelector<HTMLElement>(`#core-${route}-tag`)!;
      label.style.left = `${next[route].x}px`; label.style.top = `${next[route].y}px`;
    }
  }
  function syncView() {
    sceneHost.classList.toggle('is-inspecting', inspecting);
    sceneHost.classList.toggle('is-mounted', mounted3D);
    grip.hidden = inspecting || mounted3D || phase() !== 2 || use2D || !scene || sceneFailed;
    finish.innerHTML = `${mounted3D ? '발견 확인하기' : '코어 다시 장착하기'} <span aria-hidden="true">→</span>`;
    const button = viewTools.querySelector<HTMLButtonElement>('[data-core-view="inspect"]')!;
    button.textContent = inspecting ? '전체 보기' : '코어 확대'; button.setAttribute('aria-pressed', String(inspecting));
    viewTools.inert = busy || !scene;
    root.querySelector('.core-view-hint')!.textContent = inspecting ? '좌우로 돌려 코어의 모양을 관찰하세요.' : mounted3D ? '코어를 다시 끼웠어요 · 마을 전기 복구' : '시점을 돌려 두 빗면을 살펴보세요.';
  }
  function overview() { inspecting = false; scene?.setView('overview'); syncView(); }
  sceneHost.addEventListener('click', event => {
    if (busy || !scene) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (button?.dataset.sceneRoute) { selectRoute(button.dataset.sceneRoute as RescueRun['route']); return; }
    const action = button?.dataset.coreView;
    if (action === 'left' || action === 'right') scene.orbit(action === 'left' ? -1 : 1);
    if (action === 'inspect') { inspecting = !inspecting; scene.setView(inspecting ? 'inspect' : 'overview'); syncView(); }
  }, { signal });
  function prepareScene() {
    if (!active || sceneLoading || use2D) return;
    sceneTried = true; sceneLoading = true; sceneFailed = false; loading.hidden = false;
    loading.textContent = '코어와 중앙 장치를 준비하고 있어요…';
    import('../three/coreScene').then(module => {
      if (!active) return;
      return module.createCoreScene(sceneHost, signal, placeGrip);
    }).then(loaded => {
      if (!loaded) return;
      if (!active) { loaded.dispose(); return; }
      scene = loaded; sceneLoading = false; loading.hidden = true; update();
    }).catch(() => {
      if (!active) return;
      sceneLoading = false; sceneFailed = true;
      loading.innerHTML = '<p>3D 작업대를 준비하지 못했어요.</p><button data-core-load="retry">다시 불러오기</button><button data-core-load="fallback">그림으로 계속하기</button>';
      update();
    });
  }
  loading.addEventListener('click', event => {
    const action = (event.target as Element).closest<HTMLButtonElement>('[data-core-load]')?.dataset.coreLoad;
    if (action === 'retry') prepareScene();
    if (action === 'fallback') { use2D = true; scene?.dispose(); scene = undefined; tell('그림 작업대에서 같은 실험을 이어가요.'); update(); }
  }, { signal });
  function tell(message: string) { feedback = message; root.querySelector('#rescue-feedback')!.textContent = feedback; }
  function renderClues() {
    const zeroed = [...previous.scale.runs].reverse().find(run => run.zeroed);
    const cargo = previous.cargo.runs.find(run => run.action === 'pull');
    const ramps = previous.workshop.trials.filter(run => run.tool === 'ramp');
    root.querySelector('#rescue-clues')!.innerHTML = `${zeroed ? `<button data-clue="scale"><strong>내 저울 기록 · ${zeroed.reading} g</strong><span>영점을 맞추고 잰 기록을 다시 써요</span></button>` : ''}${cargo ? `<button data-clue="cargo"><strong>내 당기기 · 부품 ${cargo.parts}개, ${cargo.distance}칸</strong><span>내 쪽으로 당기는 방법 떠올리기</span></button>` : ''}${ramps.map(run => `<button data-clue="${run.setting === 1 ? 'long' : 'short'}"><strong>내 공방 · ${run.setting === 1 ? '긴 빗면' : '짧은 빗면'}</strong><span>${run.setting === 1 ? '더 긴 길에서 더 작은 힘을 관찰했어요' : '같은 높이를 더 짧은 길로 올렸어요'} · 이 길로 시험하기</span></button>`).join('')}` || '<p>앞선 탐구 기록이 아직 없어요. 지금 직접 비교해도 좋아요.</p>';
  }
  function nextHint() { return hasFairComparison(state.runs) ? '도착하는 길로 코어를 끝까지 옮겨요.' : comparisonHint(state.runs, state.force); }
  // Once a fair comparison exists, its two runs stay in the table; later trials only appear as "최근 시험".
  function renderRecords() {
    const found = firstFairComparison(state.runs), force = found?.force ?? state.force, latest = state.runs.at(-1);
    root.querySelector('#core-force-note')!.textContent = `${forceNames[force - 1]}으로 ${found ? '비교한' : '시험한'} 결과`;
    root.querySelector('#core-comparison')!.innerHTML = (['short', 'long'] as const).map(route => {
      const run = found ? [found.stopped, found.arrived].find(item => item.route === route) : [...state.runs].reverse().find(item => item.route === route && item.force === force);
      const fresh = flashRecord && !!run && run === latest ? ' is-fresh' : '';
      return `<div class="core-record-row ${route}${fresh}" data-result="${run ? run.success ? 'success' : 'stopped' : 'empty'}"><strong><b>${route === 'long' ? 'B' : 'A'}</b>${route === 'long' ? '긴 빗면' : '짧은 빗면'}</strong><span>${run ? run.success ? '도착 ✓' : '멈춤' : '시험 전'}</span></div>`;
    }).join('');
    const recent = root.querySelector<HTMLElement>('#core-recent')!;
    recent.hidden = !found || !latest || latest.force === found.force;
    recent.textContent = latest ? `최근 시험 · ${forceNames[latest.force - 1]} · ${latest.route === 'long' ? 'B 긴 빗면' : 'A 짧은 빗면'} ${latest.success ? '도착 ✓' : '멈춤'}` : '';
    root.querySelector('.core-record-help')!.textContent = comparisonHint(state.runs, state.force);
    flashRecord = false;
  }
  function lockStage() {
    stageLock = true; clearTimeout(stageTimer);
    const head = root.querySelector<HTMLElement>('.rescue-stage-head')!;
    for (const item of [head, handle]) { item.classList.remove('is-new-stage'); void item.offsetWidth; item.classList.add('is-new-stage'); }
    stageTimer = window.setTimeout(() => { stageLock = false; head.classList.remove('is-new-stage'); handle.classList.remove('is-new-stage'); if (active) update(); }, 700);
  }
  function update() {
    const step = phase();
    if (step !== lastStep) { if (lastStep !== -1) lockStage(); lastStep = step; }
    root.querySelector('#rescue-ground')!.setAttribute('d',step===0?'M225 406H686':'M35 406H686');
    const coreMode = step === 2 && !use2D;
    root.querySelector('.rescue-playfield')!.classList.toggle('is-core-3d', coreMode);
    sceneHost.hidden = !coreMode;
    root.querySelector<HTMLElement>('#core-records')!.hidden = !coreMode;
    syncView();
    grip.querySelector('span')!.textContent = state.delivered ? '장착 준비' : '끌어서 운반';
    grip.setAttribute('aria-label', state.delivered && rescueReady(state) ? '코어 다시 장착하기' : '코어 움직이기. 빗면을 따라 끌거나 Enter를 누르고 있기');
    renderRecords();
    for (const route of ['long', 'short']) root.querySelector(`#core-${route}-tag`)!.setAttribute('aria-pressed', String(state.route === route));
    if (coreMode && !sceneTried) prepareScene();
    setMissionProgress(root,[state.measured,state.gate,hasFairComparison(state.runs),state.delivered],!state.measured ? '코어의 무게를 확인해요' : !state.gate ? '상자를 내 쪽으로 당겨요' : !hasFairComparison(state.runs) ? '같은 힘으로 두 길을 시험해요' : !state.delivered ? '도착하는 길로 옮겨요' : '점등할 준비가 됐어요!');
    root.querySelector<HTMLElement>('.rescue-stage')!.dataset.phase = String(step);
    root.querySelector<HTMLElement>('.rescue-playfield')!.classList.toggle('core-delivered', state.delivered);
    root.querySelector('#rescue-corgi-tip')!.textContent = step === 0 ? state.zeroed ? '0을 맞췄어. 코어의 무게를 확인하자!' : '아무것도 없을 때 0이어야 해!' : step === 1 ? '코기 단서: 벽의 반대쪽으로 당기면?' : hasFairComparison(state.runs) ? '코기 단서: 같은 힘일 때 두 길의 결과가 달랐어!' : '코기 단서: 같은 힘으로 짧은 길과 긴 길을 비교해 봐!';
    root.querySelector('#rescue-phase')!.textContent = [state.loaded ? state.zeroed ? '① 숫자를 확인하고 무게를 기록해요' : '① 코어를 내리고 빈 저울을 0으로 맞춰요' : state.zeroed ? '① 코어를 저울에 올려요' : '① 빈 저울을 0으로 맞춰요','② 상자를 직접 당겨요','③ 빗면을 따라 코어를 옮겨요'][step];
    root.querySelector('#rescue-readout')!.textContent = state.measured ? `코어 ${coreWeight} g · ${state.delivered ? '도착!' : '작전 진행 중'}` : state.loaded ? '저울의 숫자를 읽어요' : state.zeroed ? '빈 저울 0 g 확인 ✓' : '빈 저울이 20 g이에요';
    root.querySelector<SVGElement>('#scale-art')!.style.display = step === 0 ? '' : 'none';
    root.querySelector<SVGElement>('#gate-art')!.style.display = step === 1 ? '' : 'none';
    root.querySelector<SVGElement>('#route-art')!.style.display = step === 2 ? '' : 'none';
    art.style.display = step === 1 ? 'none' : '';
    const reading=(state.loaded ? coreWeight : 0) + (state.zeroed ? 0 : 20);
    const digits=root.querySelector('#rescue-scale-value')!;
    digits.textContent=`${reading} g`;
    if(lastScaleReading!==null&&lastScaleReading!==reading) digits.animate([{opacity:.35},{opacity:1}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:180});
    lastScaleReading=reading;
    root.querySelector('#rescue-scale-zero')!.setAttribute('aria-disabled',String(busy));
    if (step === 0) controls.innerHTML = `<button data-rescue="load">${state.loaded ? '코어 내려놓기' : '코어 올려놓기'}</button><button data-rescue="zero">0 맞추기</button>${state.loaded ? '<button data-rescue="reading">측정값 다시 보기</button>' : ''}`;
    if (step === 1) controls.innerHTML = `<span>나는 상자의 오른쪽!</span><button data-rescue="push" aria-pressed="${gateAction === 'push'}">← 벽 쪽으로 밀기</button><button data-rescue="pull" aria-pressed="${gateAction === 'pull'}">내 쪽으로 당기기 →</button>`;
    if (step === 2) controls.innerHTML = `<div class="rescue-route-controls">${(['short','long'] as const).map(route => `<button data-route="${route}" aria-label="${route === 'short' ? '짧은 빗면' : '긴 빗면'}" aria-pressed="${state.route === route}"><span>${route === 'short' ? 'A' : 'B'}</span>${route === 'short' ? '짧은 빗면' : '긴 빗면'}</button>`).join('')}</div><label class="rescue-force-control" for="rescue-force">미는 힘 <strong>${forceNames[state.force - 1]}</strong><i class="force-step-arrow" style="--level:${state.force}" aria-hidden="true"></i><input id="rescue-force" type="range" min="1" max="3" step="1" value="${state.force}" aria-label="게임 속 미는 힘"></label><button data-rescue="retry">다시 출발</button>`;
    controls.inert = busy;
    handle.hidden = step === 0; handle.disabled = busy || stageLock || state.delivered || (coreMode && !scene);
    handle.textContent = step === 2 ? '코어 눌러서 밀기' : '상자 조금 움직이기 →';
    root.querySelector('#rescue-gesture-help')!.textContent = ['코어를 저울 위로 끌어요 · 아래 버튼으로도 옮길 수 있어요','상자를 오른쪽으로 끌어요 · Enter를 누르고 있거나 버튼으로 조금씩 움직여요','그림의 길을 고르고 코어를 따라 끌어요 · Enter 누르기 / 버튼도 가능해요'][step];
    root.querySelector('#rescue-checks')!.innerHTML = [[state.measured,'무게 확인'],[state.gate,'길 열기'],[hasFairComparison(state.runs),'같은 힘 비교'],[state.delivered,'코어 도착']].map(([done,label])=>`<span class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${label}</span>`).join('');
    root.querySelector('#rescue-runs')!.innerHTML = state.runs.slice(-4).map(run=>`<div class="result-row"><span>${run.route === 'long' ? '긴 길' : '짧은 길'} · ${forceNames[run.force-1]}</span><strong>${run.success ? '도착 ✓' : '멈춤'}</strong></div>`).join('');
    root.querySelector('#rescue-insight')!.textContent = hasFairComparison(state.runs) ? `발견! ${comparisonHint(state.runs, state.force)}` : comparisonHint(state.runs, state.force);
    root.querySelector('#rescue-used-clue')!.textContent = usedClue;
    for (const route of ['short','long']) root.querySelector(`#${route}-path`)!.classList.toggle('route-selected', state.route === route);
    finish.disabled = busy || !rescueReady(state) || (coreMode && !scene); pose(state.delivered ? 1 : restProgress); tell(feedback);
    const justLoaded = state.loaded && !wasLoaded;
    wasLoaded = state.loaded;
    if (step !== 0 || !state.loaded) closeWeightDialog();
    else if (justLoaded) openWeightDialog();
  }
  function closeWeightDialog() {
    const dialog = weightDialog;
    weightDialog = null;
    if (dialog) { dialog.close(); dialog.remove(); }
  }
  function openWeightDialog() {
    if (!active || busy || phase() !== 0 || !state.loaded || weightDialog) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'stage-popup rescue-weight-popup';
    dialog.setAttribute('aria-labelledby', 'rescue-weight-title');
    dialog.setAttribute('aria-describedby', 'rescue-weight-description');
    dialog.innerHTML = `<div class="stage-popup-card"><button class="stage-popup-close" type="button" aria-label="닫기">×</button><p class="stage-popup-label">코어 무게 확인</p><h2 id="rescue-weight-title">저울의 숫자는 ${coreWeight + (state.zeroed ? 0 : 20)} g</h2><div class="stage-popup-body"><p id="rescue-weight-description">${state.zeroed ? '코어의 무게를 기록하고 다음 작전을 시작해요.' : '빈 저울이 20 g이었어요. 코어를 내리고 0을 맞춘 뒤 다시 재요.'}</p></div><div class="stage-popup-actions">${state.zeroed ? '' : '<button class="button" type="button" data-weight="unload">코어 내려놓기</button>'}<button class="button button-primary" type="button" data-weight="record"${state.zeroed ? '' : ' disabled'}>무게 기록</button></div></div>`;
    dialog.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (button.classList.contains('stage-popup-close')) { closeWeightDialog(); return; }
      if (button.dataset.weight === 'unload') {
        closeWeightDialog();
        controls.querySelector<HTMLButtonElement>('[data-rescue="load"]')?.click();
        controls.querySelector<HTMLButtonElement>('[data-rescue="zero"]')?.focus();
      }
      if (button.dataset.weight === 'record' && state.loaded && state.zeroed && phase() === 0) {
        closeWeightDialog();
        state.measured = true; restProgress = 0;
        tell('코어는 180 g! 이제 벽 옆 상자를 움직여 길을 열어요.');
        companion.setMood('success'); context.sound(470); commit();
        controls.querySelector<HTMLButtonElement>('[data-rescue="pull"]')?.focus();
      }
    }, { signal });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeWeightDialog(); }, { signal });
    root.append(dialog); weightDialog = dialog; dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(state.zeroed ? '[data-weight="record"]' : '[data-weight="unload"]')?.focus();
  }
  function commit() { context.commit(); update(); }
  function reset() { mounted3D = false; overview(); restProgress = 0; travel = 0; state.delivered = false; pose(0); }
  function selectRoute(route: RescueRun['route']) { state.route = route; reset(); tell(`${routeNames[route]}을 골랐어요. 코어를 길을 따라 끌어 봐요.`); companion.setMood('observe'); commit(); }
  controls.addEventListener('click', event => {
    if (busy) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
    const action = button.dataset.rescue;
    if (action === 'load') { state.loaded = !state.loaded; tell(state.loaded ? '코어를 올렸어요. 영점과 숫자를 확인해요.' : '코어를 내렸어요. 빈 저울이 0 g일까요?'); }
    if (action === 'zero') { if (state.loaded) tell('코어를 먼저 내려놓고 빈 저울의 영점을 맞춰요.'); else { state.zeroed = true; tell('빈 저울이 0 g이에요. 다시 코어를 올려요.'); } }
    if (action === 'reading') { openWeightDialog(); return; }
    if (action === 'push' || action === 'pull') { gateAction = action; restProgress = 0; tell(action === 'push' ? '벽 쪽으로 밀면 움직일 수 있을까요?' : '내 쪽으로 당겨 봐요.'); }
    if (button.dataset.route) { selectRoute(button.dataset.route as RescueRun['route']); return; }
    if (action === 'retry') { reset(); tell(`출발점으로 돌아왔어요. ${nextHint()}`); }
    context.sound(470); commit();
  }, { signal });
  const scaleZero=root.querySelector<SVGElement>('#rescue-scale-zero')!;
  const pressZero=()=>{if(!busy&&phase()===0)controls.querySelector<HTMLButtonElement>('[data-rescue="zero"]')?.click();};
  scaleZero.addEventListener('click',pressZero,{signal});
  scaleZero.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pressZero();}},{signal});
  controls.addEventListener('input', event => {
    if (busy || (event.target as Element).id !== 'rescue-force') return;
    state.force = Number((event.target as HTMLInputElement).value); reset();
    controls.querySelector('.rescue-force-control strong')!.textContent = forceNames[state.force - 1];
    controls.querySelector<HTMLElement>('.force-step-arrow')?.style.setProperty('--level', String(state.force));
    handle.disabled = stageLock || (!use2D && !scene); finish.disabled = true;
    renderRecords();
    tell(`힘을 바꿨어요. ${nextHint()}`); context.commit();
  }, { signal });
  root.querySelector('#rescue-clues')!.addEventListener('click', event => {
    if (busy) return;
    const clue = (event.target as Element).closest<HTMLButtonElement>('[data-clue]')?.dataset.clue; if (!clue) return;
    usedClue = clue === 'scale' ? '내 저울 기록 활용: 빈 저울의 영점부터 확인해요.' : clue === 'cargo' ? '내 당기기 기록 활용: 내 쪽으로 상자를 당겨요.' : `내 공방 기록 활용: ${clue === 'long' ? '긴' : '짧은'} 빗면을 작은 힘으로 시험해요.`;
    if (clue === 'cargo') gateAction = 'pull';
    if (clue === 'short' || clue === 'long') { state.route = clue; state.force = 1; reset(); }
    tell(usedClue); companion.setMood('observe'); (root.querySelector('.rescue-notebook') as HTMLDetailsElement).open = false; commit();
    if (clue === 'scale' && phase() === 0) controls.querySelector<HTMLButtonElement>('[data-rescue="zero"]')?.focus();
  }, { signal });
  function recordRun(success: boolean) {
    const knew = hasFairComparison(state.runs);
    state.runs = retainRescueRuns([...state.runs,{ route:state.route, force:state.force, success }]); state.delivered = success; flashRecord = true;
    restProgress = success ? 1 : stallTravel; // the same point the input stopped at: no jump at the verdict
    const found = !knew && hasFairComparison(state.runs), hint = comparisonHint(state.runs, state.force);
    if (success) tell(found ? `코어 도착! ${hint} 이제 중앙 장치에 코어를 다시 끼워요!` : knew ? '코어 도착! 이제 중앙 장치에 코어를 다시 끼워요!' : `도착했어요! ${hint}`);
    else tell(found ? `이 힘으로는 올라가지 못했어요! ${hint} 이제 도착하는 길로 옮겨요.` : knew ? '이 힘으로는 올라가지 못했어요. 도착하는 길로 코어를 옮겨요.' : `이 힘으로는 올라가지 못했어요. 손가락을 더 세게 누를 필요는 없어요. ${hint}`);
    companion.setMood(success ? 'success' : 'observe'); context.sound(success ? 740 : 350);
    if (!success) { showStopMark(); slideBack(); }
    if (found) showPredictionChip(root.querySelector<HTMLElement>('.rescue-playfield')!, context.save, 'rescue');
  }
  // A stopped core pauses at the stop point, then slides back to the start so the next push is a new trial.
  function slideBack() {
    const stopAt = restProgress, hold = 650, slide = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500, started = performance.now();
    busy = true; cancelAnimationFrame(slideFrame);
    const tick = (now: number) => {
      if (!active) return;
      const elapsed = now - started - hold;
      if (elapsed < 0) { slideFrame = requestAnimationFrame(tick); return; }
      if (elapsed < slide) { const k = elapsed / slide; pose(stopAt * (1 - k * k)); slideFrame = requestAnimationFrame(tick); return; }
      busy = false; restProgress = 0; travel = 0; update();
    };
    slideFrame = requestAnimationFrame(tick);
  }
  function showStopMark() {
    const field = root.querySelector<HTMLElement>('.rescue-playfield')!.getBoundingClientRect();
    let x: number, y: number;
    if (scene && !use2D && projection) { const host = sceneHost.getBoundingClientRect(); x = host.left - field.left + projection.core.x; y = host.top - field.top + projection.core.y; }
    else {
      const matrix = svg.getScreenCTM(); if (!matrix) return;
      const origin = corePosition(), p = new DOMPoint(origin.x + (628 - origin.x) * restProgress, origin.y - 166 * restProgress - 70).matrixTransform(matrix);
      x = p.x - field.left; y = p.y - field.top;
    }
    stopMark.style.left = `${x}px`; stopMark.style.top = `${y}px`; stopMark.hidden = false;
    stopMark.classList.remove('is-showing'); void stopMark.offsetWidth; stopMark.classList.add('is-showing');
    clearTimeout(stopTimer); stopTimer = window.setTimeout(() => { stopMark.hidden = true; }, 1800);
  }
  function drawTravel(amount: number) {
    travel = amount;
    if (phase() === 1) { pose(Math.max(-.07, Math.min(1, amount))); return; }
    pose(Math.max(0, Math.min(canLift(state.route,state.force) ? 1 : stallTravel, amount)));
  }
  function finishTravel(cancelled = false) {
    if (cancelled) { restProgress = 0; tell('조작이 멈춰 출발점으로 돌아왔어요. 다시 움직여 봐요.'); companion.setMood('observe'); }
    else if (phase() === 1) {
      if (travel >= .95) { state.gate = true; restProgress = 0; tell('내 쪽으로 당겨 길이 열렸어요! 이제 코어를 빗면으로 옮겨요.'); companion.setMood('success'); context.sound(730); }
      else { restProgress = 0; tell(travel < 0 ? '왼쪽은 벽이라 막혔어요. 내 쪽인 오른쪽으로 당겨 봐요.' : '오른쪽으로 조금 더 당겨 길을 열어요.'); companion.setMood('observe'); }
    } else if (phase() === 2) {
      if (canLift(state.route,state.force) && travel >= .95) recordRun(true);
      else if (!canLift(state.route,state.force) && travel >= stallTravel) recordRun(false);
      else { restProgress = 0; tell('아직 도착하지 않았어요. 코어를 빗면을 따라 조금 더 끌어 봐요.'); companion.setMood('observe'); }
    }
  }
  function endPointer(event: Pick<PointerEvent, 'pointerId'>, cancelled: boolean) {
    if (held !== event.pointerId) return;
    held = null; busy = false;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (phase() === 0) {
      if (!cancelled) { state.loaded = current.x >= 245 && current.x <= 485 && current.y >= 162 && current.y <= 300; tell(state.loaded ? '저울 위에 놓았어요. 숫자를 확인하고 무게를 기록해요.' : '코어를 내려놓았어요. 빈 저울부터 살펴봐요.'); }
      companion.setMood('observe');
    } else finishTravel(cancelled);
    commit();
  }
  svg.addEventListener('pointerdown', event => {
    if (busy || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const target = event.target as Element;
    const route = target.closest('[data-route]')?.getAttribute('data-route');
    if (route && phase() === 2) { selectRoute(route as RescueRun['route']); return; }
    if (state.delivered) return;
    if (!target.closest(phase() === 1 ? '#gate-crate' : '#core-art')) return;
    const p = point(event); if (!p) return;
    event.preventDefault(); start = p; current = p; held = event.pointerId; busy = true; travel = 0;
    svg.setPointerCapture(event.pointerId); restProgress = 0; companion.setMood('effort'); controls.inert = true; handle.disabled = true; finish.disabled = true;
  }, { signal });
  svg.addEventListener('pointermove', event => {
    if (held !== event.pointerId) return; const p = point(event); if (!p) return;
    const origin = corePosition(); current = new DOMPoint(origin.x + p.x - start.x, origin.y + p.y - start.y);
    if (phase() === 0) art.setAttribute('transform', `translate(${Math.max(48,Math.min(670,current.x))},${Math.max(70,Math.min(400,current.y))})`);
    else if (phase() === 1) drawTravel((p.x - start.x) / 145);
    else { const dx = 628-origin.x, dy = -166; drawTravel(((p.x-start.x)*dx + (p.y-start.y)*dy)/(dx*dx+dy*dy)); }
  }, { signal });
  svg.addEventListener('pointerup', event=>endPointer(event,false), { signal });
  svg.addEventListener('pointercancel', event=>endPointer(event,true), { signal });
  svg.addEventListener('lostpointercapture', event=>endPointer(event,true), { signal });
  function stopCorePointer(event: Pick<PointerEvent, 'pointerId'>, cancelled: boolean) {
    if (corePointer !== event.pointerId) return;
    corePointer = null; busy = false;
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    finishTravel(cancelled); commit();
  }
  grip.addEventListener('pointerdown', event => {
    if (!scene || busy || state.delivered || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); grip.focus(); corePointer = event.pointerId; coreStart = { x: event.clientX, y: event.clientY };
    suppressGripClick = true;
    projection = scene.project(); busy = true; travel = 0; restProgress = 0; grip.setPointerCapture(event.pointerId);
    controls.inert = true; handle.disabled = true; finish.disabled = true;
  }, { signal });
  grip.addEventListener('pointermove', event => {
    if (corePointer !== event.pointerId || !projection) return;
    drawTravel(coreDragProgress({ x: event.clientX - coreStart.x, y: event.clientY - coreStart.y }, projection.start, projection.end));
  }, { signal });
  grip.addEventListener('pointerup', event => stopCorePointer(event, false), { signal });
  grip.addEventListener('pointercancel', event => stopCorePointer(event, true), { signal });
  grip.addEventListener('lostpointercapture', event => stopCorePointer(event, true), { signal });
  grip.addEventListener('click', () => {
    if (suppressGripClick) { suppressGripClick = false; return; }
    if (!busy && state.delivered && rescueReady(state)) finish.click();
  }, { signal });
  function stepAlternative() {
    if (busy || stageLock || phase() === 0 || state.delivered) return;
    if (inspecting) overview();
    if (phase() === 1 && gateAction === 'push') { drawTravel(-.07); finishTravel(); commit(); return; }
    restProgress = Math.min(1, restProgress + .2); drawTravel(restProgress); companion.setMood('effort');
    const threshold = phase() === 1 || canLift(state.route,state.force) ? .95 : stallTravel;
    if (travel >= threshold) { finishTravel(); commit(); }
  }
  handle.addEventListener('click', event => { if (phase() === 2 && scene && event.detail > 0) return; stepAlternative(); }, { signal });
  function stopButton(cancelled: boolean, tap = false) {
    if (buttonPointer === null) return;
    const pointer = buttonPointer; buttonPointer = null; busy = false; cancelAnimationFrame(buttonFrame);
    if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    if (cancelled) finishTravel(true);
    else {
      if (tap) drawTravel(Math.min(1, restProgress + .2));
      const threshold = canLift(state.route, state.force) ? .95 : stallTravel;
      if (travel >= threshold) finishTravel();
      else { restProgress = travel; tell('코어가 움직였어요. 눌러서 조금 더 밀어 봐요.'); }
    }
    commit();
  }
  let buttonStarted = 0;
  handle.addEventListener('pointerdown', event => {
    if (phase() !== 2 || !scene || busy || stageLock || state.delivered || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (inspecting) overview();
    event.preventDefault(); handle.focus(); buttonPointer = event.pointerId; handle.setPointerCapture(event.pointerId);
    busy = true; controls.inert = true; finish.disabled = true; buttonStarted = performance.now();
    const initial = restProgress, duration = state.route === 'long' ? 2500 : 1400;
    const tick = (now: number) => {
      if (!active || buttonPointer === null) return;
      drawTravel(initial + (now - buttonStarted) / duration);
      const threshold = canLift(state.route, state.force) ? .95 : stallTravel;
      if (travel >= threshold) stopButton(false); else buttonFrame = requestAnimationFrame(tick);
    };
    buttonFrame = requestAnimationFrame(tick);
  }, { signal });
  handle.addEventListener('pointerup', () => stopButton(false, performance.now() - buttonStarted < 250), { signal });
  handle.addEventListener('pointercancel', () => stopButton(true), { signal });
  handle.addEventListener('lostpointercapture', () => stopButton(true), { signal });
  function stopKey(cancelled: boolean) { if (!keyHeld) return; keyHeld = false; busy = false; cancelAnimationFrame(frame); finishTravel(cancelled); commit(); }
  root.addEventListener('keydown', event => {
    if (!['Enter',' '].includes(event.key) || ![art,gate,handle,grip].includes(event.target as typeof art)) return;
    if (phase() === 2 && state.delivered) { event.preventDefault(); if (rescueReady(state)) finish.click(); return; }
    if (phase() === 2 && !use2D && !scene) return;
    if (phase() === 0) { if (!event.repeat) { state.loaded = !state.loaded; tell(state.loaded ? '코어를 올렸어요.' : '코어를 내렸어요.'); commit(); } event.preventDefault(); return; }
    event.preventDefault(); if (busy || stageLock || state.delivered || event.repeat) return;
    if (inspecting) overview();
    keyHeld = true; busy = true; restProgress = 0; travel = 0; companion.setMood('effort'); controls.inert = true; finish.disabled = true;
    const started = performance.now(), duration = phase() === 1 ? 1000 : state.route === 'long' ? 2500 : 1400;
    const tick = (now: number) => { if (!active || !keyHeld) return; drawTravel(phase() === 1 && gateAction === 'push' ? -.07 : (now-started)/duration); const threshold = phase() === 1 || canLift(state.route,state.force) ? .95 : stallTravel; if (travel >= threshold || travel < 0) stopKey(false); else frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
  }, { signal });
  root.addEventListener('keyup', event=>{ if (['Enter',' '].includes(event.key) && (keyHeld || [art,gate,handle,grip].includes(event.target as typeof art))) { event.preventDefault(); if (keyHeld) stopKey(false); } }, { signal });
  root.addEventListener('focusout', event=>{ if (keyHeld && [art,gate,handle,grip].includes(event.target as typeof art)) stopKey(true); }, { signal });
  function cancelInput() {
    stopKey(true); stopButton(true);
    if (held !== null) endPointer({ pointerId: held }, true);
    if (corePointer !== null) stopCorePointer({ pointerId: corePointer }, true);
  }
  window.addEventListener('blur', cancelInput, { signal });
  window.addEventListener('resize', cancelInput, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput(); }, { signal });
  finish.addEventListener('click', async () => {
    if (busy || !rescueReady(state) || (!use2D && !scene)) return;
    if (!mounted3D) {
      inspecting = false; syncView();
      busy = true; controls.inert = true; finish.disabled = true; handle.disabled = true;
      viewTools.inert = true; sceneHost.classList.add('is-docking');
      tell('배터리 코어를 중앙 장치에 다시 끼워 마을의 전원을 연결하고 있어요…');
      const mounted = scene ? await scene.dock() : true;
      if (!active || !mounted) return;
      busy = false; controls.inert = false; finish.disabled = false; mounted3D = true;
      sceneHost.classList.remove('is-docking'); syncView();
      tell('코어를 다시 끼웠어요! 마을에 전기가 돌아왔어요. 두 길의 비교 기록을 다시 확인해요.');
      context.sound(840);
    }
    context.finish('rescue', `영점을 맞춰 코어 ${coreWeight} g을 확인하고 상자를 내 쪽으로 당겨 길을 열었어요. ${state.runs.length}번 운반을 시험했어요. ${comparisonSummary(state.runs)} ${routeNames[state.route]}에서 ${forceNames[state.force-1]}으로 운반하고 중앙 장치에 배터리 코어를 다시 장착해 마을의 전기를 되찾았어요.${usedClue ? ` ${usedClue}` : ''}`);
  }, { signal });
  tell(state.delivered ? '코어가 도착했어요. 비교 기록을 확인하고 중앙 장치에 다시 끼워요.' : state.gate ? '같은 힘으로 두 빗면을 비교해요. 길을 고른 뒤 코어를 직접 끌어 보세요.' : state.measured ? '코어는 180 g! 벽 옆 상자를 직접 움직여 길을 열어요.' : '빠진 배터리 코어를 다시 끼울 거예요. 먼저 빈 저울을 0으로 맞추고 코어의 무게를 재요.');
  renderClues(); update();
  return () => { active = false; closeWeightDialog(); cancelAnimationFrame(frame); cancelAnimationFrame(buttonFrame); cancelAnimationFrame(slideFrame); clearTimeout(stageTimer); clearTimeout(stopTimer); events.abort(); scene?.dispose(); companion.dispose(); };
}
