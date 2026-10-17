import type { AppContext } from '../appTypes';
import { icons } from '../icons';
import type { WorkshopScene } from '../three/workshopScene';
import { requestsEnabled } from '../state';
import { applyWorkshopL2Attempt, canFinishWorkshopExploration, workshopFinishSteps, getWorkshopDesign, hasWorkshopComparison, isBestWorkshopDesign, judgeWorkshopL2, recordWorkshopTrial, workshopBudget, workshopCargos, workshopL2Complete, workshopL2Current, workshopL2Force, workshopL2Hint, workshopL2HintLevel, type LeverSetting, type RampSetting, type WorkshopL2Result, type WorkshopTool } from '../workshopModel';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { fingerIcon } from '../interactionHints';
import { showPredictionChip } from '../predictionChip';
import { letterOnce } from '../requestLetter';
import '../workshop.css';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const budgetCellCount = 12;

export function mountWorkshop(root: HTMLElement, context: AppContext): () => void {
  const state = context.save.workshop;
  const events = new AbortController();
  let active = true, scene: WorkshopScene | null = null;
  let tool: WorkshopTool | 'direct' = state.direct ? 'lever' : 'direct';
  let toolChangedAt = 0;
  let progress = 0, heldPointer: number | null = null, keyHeld = false, frame = 0, startX = 0, startY = 0, completedGesture = false;
  let designPointer: number | null = null, designStartX = 0, designAnchorX = 0;
  let designInitialSetting: LeverSetting = state.fulcrumPosition;
  // Level 2 (force budget) opens after the three level 1 findings. Its record is
  // save.levels.workshop; misses and traces are session play for the current cargo.
  const levelRecord = () => context.save.levels?.workshop;
  let level: 1 | 2 = canFinishWorkshopExploration(state) && !!levelRecord() && !workshopL2Complete(levelRecord()) ? 2 : 1;
  let misses = 0, waiting = false, sliding = false, stalled = false, slideFrame = 0, waitTimer = 0;
  let traces: { label: string; tool: WorkshopTool | 'direct'; result: WorkshopL2Result }[] = [];
  // One try (handle reaches the top, or the cargo stalls) opens the record popup once the scene is idle.
  let recordPending: { label: string; lead: string; tryMarkup: string } | null = null;
  let lastRun: { tool: WorkshopTool | 'direct'; setting: number } | null = null;
  // The cargo on the bench only changes after the success pause, not the moment it is saved.
  const savedCargo = () => Math.min(workshopCargos.length - 1, workshopL2Current(levelRecord()));
  let cargo = savedCargo();
  const cargoIndex = () => cargo;
  let feedback = level === 2 ? '콩이 힘은 6칸까지예요. 필요한 힘이 6칸보다 많으면 화물이 멈춰요. 빨간 칸만큼 힘이 모자란 거예요.' : state.direct ? '설계를 바꾸고 필요한 힘을 비교해 봐요.' : '먼저 화물을 직접 들어 봐요.';
  root.innerHTML = `<section class="experiment-screen workshop-screen workshop-redesign">
    <div class="experiment-heading"><div><p class="eyebrow">04 · 운반 공방</p><h1>내 손으로 바꾸는 도구</h1></div>${missionProgressMarkup('workshop',['직접 들기','지레 비교','빗면 비교'])}</div>
    <div class="workshop-studio">
      <div class="workshop-stage">
        <div class="workshop-drawer" role="group" aria-label="실험 도구"><button data-tool="direct">① 직접 들기</button><button data-tool="lever">② 지레</button><button data-tool="ramp">③ 빗면</button><span class="workshop-cargo-chip" id="workshop-cargo-chip" hidden></span><p class="workshop-instruction" id="workshop-instruction">${fingerIcon}<span></span></p><button id="workshop-open-record" class="workshop-record-button" aria-haspopup="dialog">기록 보기</button><div class="workshop-view"><button class="camera-button" id="turn-left" aria-label="시점 왼쪽">${icons.rotateLeft}</button><button class="camera-button" id="turn-right" aria-label="시점 오른쪽">${icons.rotateRight}</button></div></div>
        <div class="workshop-world" data-tool="direct"><div class="workshop-budget" id="workshop-budget" role="img" hidden><div class="budget-head"><img src="/assets/game/corgi-effort.webp" alt="" draggable="false"><strong>콩이가 낼 수 있는 힘</strong><span class="budget-status"></span></div><div class="budget-cells">${'<i></i>'.repeat(budgetCellCount)}</div><div class="budget-scale"><span>콩이 힘 끝</span><span class="budget-more"></span></div></div><div id="workshop-canvas" class="workshop-canvas"><div class="scene-loading">작업대 준비 중…</div></div><button id="workshop-fulcrum" class="workshop-fulcrum-grip" aria-label="그림의 받침대. 잡고 좌우로 옮기기. 방향키로도 위치 변경" hidden><span class="fulcrum-grab-label">${fingerIcon} 받침대 옮기기</span></button><div class="workshop-actor" id="workshop-actor" role="img" aria-label="아이가 직접 화물을 들어 올려요"><img id="workshop-actor-main" src="/assets/game/workshop-direct-start.webp" alt="" draggable="false"><img id="workshop-actor-lift" src="/assets/game/workshop-direct-lift.webp" alt="" draggable="false"><div class="workshop-effort" aria-hidden="true"><span class="effort-face"><i></i><i></i></span><b class="effort-word"></b></div></div><button id="workshop-handle" class="workshop-handle" aria-label="손잡이를 움직여 실험하기"><i class="handle-force" aria-hidden="true"></i><i class="handle-budget" aria-hidden="true"></i><span class="handle-arrow">↑</span><span class="handle-label">상자를 잡고 위로</span></button><div class="workshop-height-ruler" aria-label="화물이 올라갈 높이 눈금자"><div class="height-ruler-track"><i class="height-current-marker"></i></div><span class="height-arrival" hidden>✓ 도착</span></div><div class="workshop-move-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="목표 지점까지 이동"><div class="workshop-travel"><i id="workshop-progress"></i></div><strong id="workshop-move-text">0%</strong></div></div>
        <div class="workshop-design-dock" id="design-adjustment"><span class="design-stop-label">짧고 가파르게</span><input type="range" id="workshop-design" min="0" max="1" step="1" value="0" aria-label="빗면 길이 조절"><span class="design-stop-label">길고 완만하게</span></div>
      </div>
      <div class="workshop-record-store" hidden><aside class="workshop-notebook"><div class="notebook-heading"><span>필요한 힘</span><strong id="workshop-evidence-count">0 / 2</strong></div><div class="workshop-quiz-prompt" hidden><h2 id="workshop-observation-help"></h2><p id="workshop-answer-help" class="answer-label"></p></div><div class="workshop-records" id="workshop-records"></div><div id="workshop-choice" class="workshop-choice"></div><p class="workshop-model-note" hidden></p></aside></div>
    </div><div class="experiment-footer"><span id="workshop-feedback" class="feedback" role="status"></span><button id="workshop-finish" class="button button-primary" disabled>생활 속 도구 찾기 →</button></div>
  </section>`;
  const canvas = root.querySelector<HTMLElement>('#workshop-canvas')!;
  const handle = root.querySelector<HTMLButtonElement>('#workshop-handle')!;
  const slider = root.querySelector<HTMLInputElement>('#workshop-design')!;
  const finish = root.querySelector<HTMLButtonElement>('#workshop-finish')!;
  const world = root.querySelector<HTMLElement>('.workshop-world')!;
  const actor = root.querySelector<HTMLImageElement>('#workshop-actor-main')!;
  const actorLift = root.querySelector<HTMLImageElement>('#workshop-actor-lift')!;
  const actorWrap = root.querySelector<HTMLElement>('#workshop-actor')!;
  const fulcrum = root.querySelector<HTMLButtonElement>('#workshop-fulcrum')!;
  const heightRuler = root.querySelector<HTMLElement>('.workshop-height-ruler')!;
  const notebookStore = root.querySelector<HTMLElement>('.workshop-record-store')!;
  const notebookBoard = root.querySelector<HTMLElement>('.workshop-notebook')!;
  const recordButton = root.querySelector<HTMLButtonElement>('#workshop-open-record')!;
  let recordDialog: HTMLDialogElement | null = null;
  for(let index=0;index<5;index++) { const image=new Image();image.src=`/assets/game/workshop-lever-press-${index}.webp`; const face=new Image();face.src=`/assets/game/workshop-lever-press-${index}${index<3?'-hard':'-easy'}.webp`; }
  const signal = events.signal;
  const currentSetting = () => tool === 'lever' ? state.fulcrumPosition : state.rampLength;
  const judge = () => judgeWorkshopL2(cargoIndex(), tool, currentSetting());
  const designName = () => tool === 'direct' ? '직접 들기' : `${tool === 'lever' ? '지레' : '빗면'} · ${getWorkshopDesign(tool, currentSetting()).label}`;
  const toolForce = () => level === 2 ? workshopL2Force(cargoIndex(), tool, currentSetting()) : tool === 'direct' ? 100 : getWorkshopDesign(tool, currentSetting()).force;
  /** Green cells up to the budget; red cells are how much force was missing. */
  function cellClasses(result: WorkshopL2Result | null, showOver: boolean): string[] {
    return Array.from({ length: budgetCellCount }, (_cell, index) => !result ? '' : index < Math.min(result.needCells, result.budgetCells) ? 'is-fill' : showOver && index >= result.budgetCells && index < result.budgetCells + result.overCells ? 'is-over' : '');
  }
  /** Red cells past the bar's 12 still count: say how many the bar could not show. */
  const missingText = (result: WorkshopL2Result) => { const outside = Math.max(0, result.budgetCells + result.overCells - budgetCellCount); return `모자란 힘 ${result.overCells}칸${outside ? ` (막대 밖 ${outside}칸 더)` : ''}`; };
  const cellsMarkup = (result: WorkshopL2Result) => cellClasses(result, true).map(name => `<i class="${name}"></i>`).join('');
  const budgetNextStep = (used: WorkshopTool | 'direct') => used === 'lever' ? '받침대를 화물 쪽으로 옮겨 봐요' : used === 'ramp' ? '빗면을 길게 해 봐요' : '지레나 빗면을 골라 봐요';
  function renderBudget() {
    const bar = root.querySelector<HTMLElement>('#workshop-budget')!;
    bar.hidden = level !== 2;
    if (level !== 2) return;
    const pushing = heldPointer !== null || keyHeld || progress > 0;
    const live = pushing && !completedGesture;
    const result = live ? judge() : traces.at(-1)?.result ?? null;
    const showOver = !!result && !live && !result.success;
    const classes = cellClasses(result, showOver);
    bar.querySelectorAll<HTMLElement>('.budget-cells i').forEach((cell, index) => { cell.className = classes[index]; });
    bar.querySelector('.budget-more')!.textContent = showOver && result ? missingText(result) : '';
    const status = !result ? '콩이는 6칸까지 힘을 낼 수 있어요' : live ? '힘을 주는 중…' : result.success ? '✓ 콩이 힘으로 충분해요' : `${result.overCells}칸 모자라요 · ${budgetNextStep(traces.at(-1)?.tool ?? tool)}`;
    bar.querySelector('.budget-status')!.textContent = status;
    bar.dataset.state = showOver ? 'over' : result?.success && !live ? 'ok' : 'idle';
    bar.setAttribute('aria-label', `콩이가 낼 수 있는 힘 막대. 콩이 힘은 6칸까지예요. 빨간 칸은 모자란 힘이에요. ${status}`);
  }
  const forceWord = (force: number) => force < 40 ? '아주 작은 힘' : force < 80 ? '작은 힘' : force > 120 ? '큰 힘' : '직접 들 때의 힘';
  function travelPixels() {
    if (tool === 'direct') return 110;
    const design = getWorkshopDesign(tool, currentSetting());
    return tool === 'lever' ? 42 + design.distance * 62 : 50 + design.distance * 24;
  }
  function gesturePixels() {
    if (tool === 'direct') return 150;
    const design = getWorkshopDesign(tool, currentSetting());
    return Math.min(250, travelPixels() * (design.force >= 80 ? 1.55 : design.force >= 50 ? 1.28 : 1));
  }
  function positionHandle() {
    if(!active) return;
    const travel = travelPixels() * progress;
    handle.style.transform = tool === 'lever' ? '' : tool === 'direct' ? `translateY(${-travel}px)` : `translateX(${travel}px)`;
    root.querySelector<HTMLElement>('#workshop-progress')!.style.width = `${progress * 100}%`;
    root.querySelector<HTMLElement>('#workshop-move-text')!.textContent = `${Math.round(progress * 100)}%`;
    root.querySelector<HTMLElement>('.workshop-move-meter')!.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    actorLift.style.opacity = tool === 'direct' ? String(Math.min(1, progress * 1.7)) : '0';
    scene?.setProgress(progress);
    if(scene) {
      const layout=scene.layout(), yOffset=canvas.offsetTop;
      fulcrum.style.left=`${layout.support.x}px`; fulcrum.style.top=`${layout.support.y+yOffset}px`;
      if(tool==='lever') {
        // Each pose presses lower while both feet stay on the projected floor.
        const h=(layout.actorFloor.y-layout.effortRest.y)/.61;
        const handY=.995-(layout.actorFloor.y-layout.effort.y)/h;
        const poses=[.385,.59,.665,.755,.90];
        const pose=poses.reduce((best,y,i)=>Math.abs(y-handY)<Math.abs(poses[best]-handY)?i:best,0);
        // Same pose, face swapped to match the design's force (pose alone follows the hand).
        const effort=effortLevel(), face=effort==='hard'&&pose<3?'-hard':effort==='easy'&&pose>=3?'-easy':'';
        const source=`/assets/game/workshop-lever-press-${pose}${face}.webp`;
        if(!actor.src.endsWith(source)) actor.src=source;
        actorWrap.style.width=`${h}px`; actorWrap.style.height=`${h}px`;
        actorWrap.style.left=`${layout.effort.x-h*.87}px`; actorWrap.style.top=`${layout.actorFloor.y+yOffset-h*.995}px`; actorWrap.style.bottom='auto';
        actor.style.transform=`scaleY(${(.995-handY)/(.995-poses[pose])})`;
        handle.style.left=`${layout.effort.x-25}px`; handle.style.top=`${layout.effort.y+yOffset+8}px`; handle.style.bottom='auto';
      } else { actorWrap.style.left='';actorWrap.style.top='';actorWrap.style.bottom='';actorWrap.style.width='';actorWrap.style.height='';actor.style.transform='';handle.style.left='';handle.style.top='';handle.style.bottom=''; }
      heightRuler.style.left=`${Math.min(world.clientWidth-126,Math.max(20,layout.heightGoal.x+6))}px`;
      heightRuler.style.top=`${layout.heightGoal.y+yOffset}px`;
      heightRuler.style.setProperty('--height-span',`${Math.max(30,layout.heightStart.y-layout.heightGoal.y)}px`);
      heightRuler.style.setProperty('--height-progress',String(progress));
      heightRuler.classList.toggle('has-arrived',progress>=1);
      heightRuler.querySelector<HTMLElement>('.height-arrival')!.hidden=progress<1;
    }
    actorWrap.dataset.active=String(heldPointer!==null||keyHeld);
    // Arrow size shows the game's force step for this design, never finger pressure.
    const force = toolForce();
    handle.style.setProperty('--budget-len', `${Math.round(44 + workshopBudget * .6)}px`);
    handle.dataset.budget = String(level === 2);
    handle.dataset.over = String(level === 2 && stalled);
    handle.style.setProperty('--force-len', `${Math.round(Math.min(150, 44 + force * .6))}px`);
    handle.style.setProperty('--force-width', `${Math.round(Math.min(24, 9 + force / 14))}px`);
    handle.dataset.pushing = String(heldPointer!==null||keyHeld||progress>0);
    renderBudget();
  }
  function effortLevel() { const force = toolForce(); return level === 2 ? (force > workshopBudget ? 'hard' : 'easy') : force >= 100 ? 'hard' : force >= 50 ? 'mid' : 'easy'; }
  /** The shared stage popup: this try's line on top, then the record board (force bars, question, request invite). */
  function openRecord(label: string, lead: string, tryMarkup = '') {
    recordPending = null;
    if (recordDialog) { recordDialog.querySelector('.stage-popup-label')!.textContent = label; recordDialog.querySelector('.stage-popup-lead')!.textContent = lead; return; }
    const dialog = recordDialog = document.createElement('dialog');
    dialog.className = 'stage-popup workshop-record-popup';
    dialog.setAttribute('aria-labelledby', 'workshop-record-title');
    dialog.innerHTML = `<div class="stage-popup-card"><button class="stage-popup-close" aria-label="닫기">×</button><span class="stage-popup-label"></span><h2 id="workshop-record-title">${level === 2 ? '공방 친구의 의뢰' : '힘 막대 기록'}</h2><div class="stage-popup-body"><p class="stage-popup-lead"></p>${tryMarkup ? `<div class="workshop-record-try">${tryMarkup}</div>` : ''}<div class="workshop-record-slot"></div></div><div class="stage-popup-actions"><button class="button button-primary" id="workshop-record-close">계속 실험하기</button></div></div>`;
    dialog.querySelector('.stage-popup-label')!.textContent = label;
    dialog.querySelector('.stage-popup-lead')!.textContent = lead;
    dialog.querySelector('.workshop-record-slot')!.replaceWith(notebookBoard);
    dialog.querySelectorAll('.stage-popup-close, #workshop-record-close').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { notebookStore.append(notebookBoard); dialog.remove(); if (recordDialog === dialog) recordDialog = null; });
    root.querySelector('.workshop-redesign')!.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('#workshop-record-close')!.focus();
  }
  const queueRecord = (lead: string, tryMarkup = '') => { recordPending = { label: level === 2 ? '의뢰 결과' : '실험 결과', lead, tryMarkup }; };
  const traceMarkup = (label: string, result: WorkshopL2Result) => `<div class="workshop-trace" data-ok="${result.success}" data-age="0"><strong>${label}</strong><span class="trace-cells" aria-hidden="true">${cellsMarkup(result)}</span><span>${result.success ? '✓ 콩이 힘 6칸 안에서 올렸어요' : `${missingText(result)} · 멈춤`}</span></div>`;
  function setFeedback(message: string) { feedback = message; root.querySelector<HTMLElement>('#workshop-feedback')!.textContent = feedback; }
  function resetGesture() {
    cancelAnimationFrame(frame); cancelAnimationFrame(slideFrame); keyHeld = false; sliding = false; stalled = false;
    if (heldPointer !== null && handle.hasPointerCapture(heldPointer)) handle.releasePointerCapture(heldPointer);
    heldPointer = null; completedGesture = false; progress = 0; positionHandle();
  }
  function update() {
    const busy = heldPointer !== null || keyHeld || designPointer !== null || waiting || sliding;
    if (recordPending && !busy) openRecord(recordPending.label, recordPending.lead, recordPending.tryMarkup);
    recordButton.disabled = busy;
    root.querySelectorAll<HTMLButtonElement>('.workshop-drawer > [data-tool]').forEach(button => { button.disabled = !scene || busy; button.setAttribute('aria-pressed', String(button.dataset.tool === tool)); });
    slider.disabled = !scene || busy || tool!=='ramp';
    handle.disabled = !scene;
    fulcrum.hidden=tool!=='lever'; fulcrum.disabled=!scene||heldPointer!==null||keyHeld||waiting||sliding;
    heightRuler.hidden=tool==='direct';
    fulcrum.setAttribute('aria-valuetext',getWorkshopDesign('lever',state.fulcrumPosition).label);
    handle.dataset.tool = tool;
    world.dataset.tool = tool;
    const force = toolForce();
    if(tool!=='lever') actor.src = tool === 'direct' ? '/assets/game/workshop-direct-start.webp' : `/assets/game/workshop-ramp-${force >= 50 ? 'hard' : 'easy'}.webp`;
    actor.parentElement!.setAttribute('aria-label', tool === 'direct' ? '아이가 직접 화물을 들어 올려요' : tool === 'lever' ? '아이가 지레 손잡이를 눌러 화물을 들어 올려요' : '아이가 빗면을 따라 화물을 밀어 올려요');
    handle.querySelector('.handle-arrow')!.textContent = tool === 'lever' ? '↓' : tool === 'ramp' ? '→' : '↑';
    handle.querySelector('.handle-label')!.textContent = tool === 'lever' ? '아래로 누르기' : tool === 'ramp' ? '오른쪽으로 밀기' : '위로 들기';
    handle.setAttribute('aria-label', `${tool === 'lever' ? '지레 손잡이를 아래로 누르기' : tool === 'ramp' ? '빗면을 따라 화물을 오른쪽으로 밀기' : '화물을 위로 들기'}. 손잡이를 움직이거나 키보드는 Enter 또는 스페이스를 누르고 있기`);
    root.querySelector<HTMLElement>('#design-adjustment')!.hidden = tool !== 'ramp';
    if (tool === 'ramp') { slider.value = String(state.rampLength); slider.setAttribute('aria-valuetext', getWorkshopDesign('ramp', state.rampLength).label); }
    // Face, sweat and word follow the design's force only, never how far the hand travels.
    const effort = effortLevel();
    actorWrap.dataset.effort = effort;
    actorWrap.querySelector('.effort-word')!.textContent = effort === 'hard' ? '끙! 힘들어' : effort === 'mid' ? '으쌰!' : '가뿐해!';
    actorWrap.setAttribute('aria-label', `${actorWrap.getAttribute('aria-label')} · ${effort === 'hard' ? '힘이 많이 들어요' : effort === 'mid' ? '힘이 조금 들어요' : '힘이 적게 들어요'}`);
    root.querySelector<HTMLElement>('#workshop-instruction span')!.textContent = instruction();
    const steps = workshopFinishSteps(state);
    const notebook=root.querySelector<HTMLElement>('.workshop-notebook')!;
    const quiz=root.querySelector<HTMLElement>('.workshop-quiz-prompt')!;
    const note=root.querySelector<HTMLElement>('.workshop-model-note')!;
    notebook.classList.toggle('is-request', level === 2);
    root.querySelector<HTMLElement>('.notebook-heading span')!.textContent = level === 2 ? '공방 친구의 의뢰' : '필요한 힘';
    note.textContent = level === 2 ? '힘 막대 한 칸은 화면 속 힘의 단계예요. 실제 무게나 단위가 아니에요.' : '화면 속 힘이에요. 손가락으로 누르는 세기와는 달라요.';
    const chip = root.querySelector<HTMLElement>('#workshop-cargo-chip')!;
    chip.hidden = level !== 2;
    chip.textContent = workshopL2Complete(levelRecord()) ? `✓ 화물 ${workshopCargos.length}/${workshopCargos.length}` : `화물 ${cargoIndex() + 1}/${workshopCargos.length} · ${workshopCargos[cargoIndex()].label}`;
    recordButton.textContent = level === 2 ? '의뢰 보기' : '기록 보기';
    recordButton.dataset.attention = 'false';
    if (level === 2) { quiz.hidden = false; note.hidden = false; renderRequest(); notebook.classList.remove('quiz-ready', 'quiz-done'); } else {
    root.querySelector<HTMLElement>('#workshop-evidence-count')!.textContent = `비교한 도구 ${Number(steps.lever) + Number(steps.ramp)} / 2`;
    const entries = state.trials.filter(run => run.tool === tool);
    const forceScale = Math.max(100, ...entries.map(run => run.force));
    const distanceScale = Math.max(Number.EPSILON, ...entries.map(run => run.distance));
    const distanceLabel = tool === 'lever' ? '손잡이가 움직인 길' : '화물이 움직인 길';
    const finding = tool === 'lever' ? state.leverFinding : state.rampFinding;
    const choosing = tool !== 'direct' && hasWorkshopComparison(state.trials, tool) && !finding;
    // While experimenting the board is only force bars; the question waits for two records.
    quiz.hidden = !choosing; note.hidden = !finding || tool === 'direct';
    root.querySelector<HTMLElement>('#workshop-observation-help')!.textContent = '어느 쪽이 힘이 덜 들었나요?';
    root.querySelector<HTMLElement>('#workshop-answer-help')!.textContent = '짧은 막대를 눌러요';
    notebook.classList.toggle('quiz-ready',choosing); notebook.classList.toggle('quiz-done',tool!=='direct'&&finding);
    recordButton.dataset.attention = String(choosing || (canFinishWorkshopExploration(state) && !workshopL2Complete(levelRecord())));
    const isLatest = (runTool: WorkshopTool | 'direct', setting = 0) => lastRun?.tool === runTool && lastRun.setting === setting;
    const latestMark = (runTool: WorkshopTool | 'direct', setting = 0) => isLatest(runTool, setting) ? '<em class="workshop-latest">방금</em>' : '';
    const bar = (force: number) => `<div class="workshop-force" aria-hidden="true"><i style="width:${force / forceScale * 100}%"></i></div>`;
    root.querySelector<HTMLElement>('#workshop-records')!.innerHTML = (state.direct ? `<article class="workshop-run baseline-run${isLatest('direct') ? ' is-latest' : ''}"><strong>${latestMark('direct')}직접 들기</strong>${bar(100)}<span>${forceWord(100)}</span></article>` : '') + entries.map((run,index) => {
      const content = `<strong>${latestMark(run.tool, run.setting)}${getWorkshopDesign(run.tool, run.setting).label}</strong>${bar(run.force)}<span>${forceWord(run.force)}</span>${finding ? `<span class="workshop-metric-label">${distanceLabel}</span><div class="workshop-distance" aria-hidden="true"><i style="width:${run.distance / distanceScale * 100}%"></i></div>` : ''}`;
      const latest = isLatest(run.tool, run.setting) ? ' is-latest' : '';
      return choosing ? `<button class="workshop-run workshop-run-choice${latest}" data-finding="${run.setting}" ${busy ? 'disabled' : ''}><span class="workshop-answer-number">${index+1}</span>${content}</button>` : `<article class="workshop-run${latest}">${content}</article>`;
    }).join('') || (state.direct ? '' : '<div class="workshop-empty">직접 들면<br>힘 막대가 생겨요</div>');
    root.querySelector<HTMLElement>('#workshop-choice')!.innerHTML = finding && tool !== 'direct' ? `<p class="finding-earned">✓ 작은 힘, 더 먼 길!</p><p class="workshop-finding">${tool === 'lever' ? '받침대가 화물에 가까울수록 힘은 작게 들고, 손잡이는 더 멀리 움직여요.' : '빗면이 길고 완만할수록 힘은 작게 들고, 화물은 더 먼 길을 가요.'}</p>` : '';
    if (canFinishWorkshopExploration(state) && !busy && !workshopL2Complete(levelRecord())) letterOnce(root, 'workshop', enterRequest);
    if (canFinishWorkshopExploration(state)) root.querySelector<HTMLElement>('#workshop-choice')!.insertAdjacentHTML('beforeend', workshopL2Complete(levelRecord()) ? '<p class="finding-earned">✓ 공방 친구의 의뢰도 끝냈어요</p>' : `<div class="workshop-request-invite"><img src="/assets/game/corgi-observe.webp" alt="" draggable="false"><p><strong>공방 친구의 의뢰가 왔어요!</strong>콩이 힘으로 화물 3개를 올려 줄래요?</p><button id="workshop-open-request" class="button button-primary" ${busy ? 'disabled' : ''}>의뢰 받기 →</button></div>`);
    }
    finish.disabled = busy || !canFinishWorkshopExploration(state) || !(workshopL2Complete(levelRecord()) || !requestsEnabled(context.save));
    const leverRuns=state.trials.filter(r=>r.tool==='lever'), rampRuns=state.trials.filter(r=>r.tool==='ramp');
    setMissionProgress(root,[steps.direct,steps.lever,steps.ramp],
      !steps.direct?'먼저 직접 들어요'
      :!steps.lever?(leverRuns.length===0?'받침대를 옮기고 지레로 들어 봐요':leverRuns.length===1?'받침대를 다른 곳으로 옮겨 한 번 더 들어 봐요':'직접 들 때보다 힘이 작게 드는 받침대 위치를 찾아요')
      :!steps.ramp?(rampRuns.length===0?'빗면으로도 같은 높이까지 올려 봐요':'이번엔 길이를 바꿔 같은 높이까지 올려 봐요')
      :level === 1 && !levelRecord() ? '공방 친구의 의뢰를 받아요'
      :!workshopL2Complete(levelRecord()) ? `의뢰 화물 ${levelRecord()?.cleared.length ?? 0} / ${workshopCargos.length} · 콩이의 힘 안에서 올려요`
      :'생활 속 도구를 찾아요');
    setFeedback(feedback);
    positionHandle();
  }
  function renderRequest() {
    const record = levelRecord(), current = workshopL2Current(record), done = workshopL2Complete(record);
    root.querySelector<HTMLElement>('#workshop-evidence-count')!.textContent = `올린 화물 ${record?.cleared.length ?? 0} / ${workshopCargos.length}`;
    root.querySelector<HTMLElement>('#workshop-observation-help')!.textContent = '“콩이 힘 6칸으로는 이 화물을 못 들어요. 장치를 바꿔 볼까요?”';
    root.querySelector<HTMLElement>('#workshop-answer-help')!.textContent = '콩이 힘은 6칸까지예요. 빨간 칸은 모자란 힘이에요.';
    root.querySelector<HTMLElement>('#workshop-records')!.innerHTML = workshopCargos.map((cargo, index) => {
      const cleared = !!record?.cleared.includes(index), now = !done && index === current;
      return `<article class="workshop-cargo-card" data-state="${cleared ? 'done' : now ? 'now' : 'next'}"><i class="cargo-weight" style="--weight:${cargo.weight}" aria-hidden="true"></i><strong>${index + 1}. ${cargo.label}</strong><span>${cleared ? '✓ 올렸어요' : now ? '지금 올릴 화물' : '다음 화물'}</span></article>`;
    }).join('');
    root.querySelector<HTMLElement>('#workshop-choice')!.innerHTML = done
      ? '<p class="finding-earned">✓ 의뢰 완료!</p><p class="workshop-finding">무거운 화물일수록 받침대를 화물 가까이, 빗면을 더 길게 하면 콩이의 힘으로도 올릴 수 있었어요.</p>'
      : traces.length
        ? '<p class="workshop-trace-title">이 화물에서 해 본 설계</p>' + traces.map((trace, index) => `<div class="workshop-trace" data-ok="${trace.result.success}" data-age="${traces.length - 1 - index}"><strong>${index === traces.length - 1 ? '<em class="workshop-latest">방금</em>' : ''}${trace.label}</strong><span class="trace-cells" aria-hidden="true">${cellsMarkup(trace.result)}</span><span>${trace.result.success ? '✓ 올렸어요' : `${missingText(trace.result)} · 멈춤`}</span></div>`).join('')
        : '<p>도구와 설계를 고른 뒤 손잡이를 움직여요. 필요한 힘이 콩이 힘 6칸보다 많으면 화물이 멈추고, 모자란 힘이 빨간 칸으로 남아요.</p>';
  }
  function enterRequest() {
    if (!canFinishWorkshopExploration(state) || heldPointer !== null || keyHeld || designPointer !== null) return;
    recordPending = null; recordDialog?.close();
    context.save.levels = { ...context.save.levels, workshop: levelRecord() ?? { cleared: [], attempts: 0 } };
    context.commit(); context.sound(520);
    level = 2; misses = 0; traces = []; cargo = savedCargo();
    configure(tool === 'direct' ? 'lever' : tool);
    setFeedback(`공방 친구의 의뢰! 먼저 ${workshopCargos[cargoIndex()].label}이에요. 지레나 빗면 설계를 골라 콩이의 힘 안에서 올려 봐요.`);
  }
  /** One level 2 try: success clears the cargo; a miss stalls, slides back and leaves red cells. */
  function recordL2(result: WorkshopL2Result) {
    const name = workshopCargos[cargo].label, label = designName();
    context.save.levels = { ...context.save.levels, workshop: applyWorkshopL2Attempt(levelRecord(), cargo, result.success) };
    traces = [...traces, { label, tool, result }].slice(-3);
    context.commit();
    if (!result.success) {
      misses++;
      setFeedback(`${name}이 중간에 멈췄다가 미끄러져 내려왔어요. 힘이 ${result.overCells}칸 모자랐어요. ${workshopL2Hint(workshopL2HintLevel(misses), tool)}`);
      queueRecord(feedback); slideBack(); return;
    }
    misses = 0; context.sound(780);
    if (workshopL2Complete(levelRecord())) { setFeedback(`${name}도 '${label}' 설계로 올렸어요! 세 화물을 모두 옮겼어요. 이제 생활 속 도구를 찾아요.`); queueRecord(feedback, traceMarkup(label, result)); update(); return; }
    setFeedback(`${name}을 '${label}' 설계로 콩이의 힘 안에서 올렸어요!`);
    waiting = true; update();
    waitTimer = window.setTimeout(() => {
      if (!active) return;
      waiting = false; traces = []; cargo = savedCargo(); resetGesture(); scene?.setCargoWeight(workshopCargos[cargoIndex()].weight);
      setFeedback(`다음은 ${workshopCargos[cargoIndex()].label}이에요. 지난번보다 무거워요! 같은 설계로 될까요?`);
      queueRecord(`${name}을 '${label}' 설계로 올렸어요! ${feedback}`, traceMarkup(label, result)); update();
    }, reducedMotion() ? 700 : 1400);
  }
  function slideBack() {
    sliding = true; update();
    const from = progress, started = performance.now(), hold = 450, duration = reducedMotion() ? 0 : 650;
    const step = (now: number) => {
      if (!active) return;
      const t = duration ? Math.max(0, Math.min(1, (now - started - hold) / duration)) : now - started >= hold ? 1 : 0;
      progress = from * (1 - t * t); positionHandle();
      if (t < 1) { slideFrame = requestAnimationFrame(step); return; }
      sliding = false; stalled = false; progress = 0; positionHandle(); update();
    };
    slideFrame = requestAnimationFrame(step);
  }
  function stall() { completedGesture = true; stalled = true; positionHandle(); recordL2(judge()); }
  function configure(next: WorkshopTool | 'direct') {
    resetGesture(); tool = next; toolChangedAt = performance.now(); scene?.configure(tool, currentSetting());
    scene?.setCargoWeight(level === 2 ? workshopCargos[cargoIndex()].weight : 1);
    if (level === 2) { setFeedback(tool === 'direct' ? '콩이 혼자 들어 볼까요? 손잡이를 위로 움직여요.' : tool === 'lever' ? '받침대를 옮기고 손잡이를 아래로 눌러요. 힘 막대를 지켜봐요.' : '빗면 길이를 고르고 오른쪽으로 밀어요. 힘 막대를 지켜봐요.'); update(); return; }
    setFeedback(tool === 'direct' ? '손잡이를 위로 움직여 화물을 들어 봐요.' : tool === 'lever' ? '받침대 위치에 따라 힘이 어떻게 달라질까요?' : '빗면 길이에 따라 힘이 어떻게 달라질까요?');
    update();
  }
  /** One line telling the student the next physical action. */
  function instruction() {
    if (level === 2) return tool === 'direct' ? '지레나 빗면을 골라요' : tool === 'lever' ? '받침대를 옮기고, 손잡이를 아래로 눌러요' : '길이를 고르고, 손잡이를 오른쪽으로 밀어요';
    const steps = workshopFinishSteps(state);
    if (tool === 'direct') return state.direct ? '② 지레를 눌러 이어서 해요' : '손잡이를 위로 끝까지 끌어요';
    const tried = state.trials.some(run => run.tool === tool && run.setting === currentSetting());
    const finding = tool === 'lever' ? state.leverFinding : state.rampFinding;
    if (hasWorkshopComparison(state.trials, tool) && !finding) return '기록 보기를 눌러 질문에 답해요';
    const allDone = workshopL2Complete(levelRecord()) || !requestsEnabled(context.save) ? '모두 했어요!' : '기록 보기에서 의뢰를 받아요';
    if (tool === 'lever') return steps.lever && tried ? (steps.ramp ? allDone : '③ 빗면을 눌러 이어서 해요') : tried ? '받침대를 다른 곳으로 옮겨요' : '손잡이를 아래로 끝까지 눌러요';
    return steps.ramp && tried ? (steps.lever ? allDone : '② 지레로 돌아가 비교해요') : tried ? '아래에서 빗면 길이를 바꿔요' : '손잡이를 오른쪽 끝까지 밀어요';
  }
  function nextHint() {
    const steps = workshopFinishSteps(state);
    if (tool === 'lever' && !hasWorkshopComparison(state.trials, 'lever')) return '받침대를 다른 곳으로 옮겨 한 번 더 들어 봐요.';
    if (tool === 'lever' && !steps.lever) return '직접 들 때보다 힘이 작게 드는 받침대 위치를 더 찾아봐요.';
    if (tool === 'ramp' && !steps.ramp) return '이번엔 길이를 바꿔 같은 높이까지 올려 봐요.';
    if (!steps.lever) return '지레도 두 위치에서 비교해 봐요.';
    if (!steps.ramp) return '빗면도 두 길이로 올려 봐요.';
    return '세 발견을 모두 했어요! 공방 친구의 의뢰를 받아요.';
  }
  function completeGesture() {
    if (completedGesture || !active) return;
    completedGesture = true;
    if (level === 2) { recordL2(judge()); return; }
    context.sound(730);
    if (tool === 'direct') { state.direct = true; lastRun = { tool: 'direct', setting: 0 }; setFeedback('직접 들어 봤어요! 이제 지레로 들어 봐요.'); queueRecord('직접 들어 봤어요! 이 힘 막대가 비교의 기준이에요. 이제 ② 지레로 들어 봐요.'); }
    else {
      const setting = currentSetting();
      const design = getWorkshopDesign(tool, setting);
      const easierBefore = state.trials.some(run => run.force < 100);
      const needsNewChoice = recordWorkshopTrial(state, tool, setting);
      if (!easierBefore && design.force < 100) showPredictionChip(world, context.save, 'workshop');
      state.fulcrumSnapped = state.plankSnapped = state.rampSnapped = true;
      lastRun = { tool, setting };
      const result = `'${design.label}' 설계로 움직였어요. ${forceWord(design.force)}이 들었어요.`;
      setFeedback(`${result} ${needsNewChoice ? '더 작은 힘이 드는 새 설계를 발견했어요! 기록에서 다시 골라요.' : nextHint()}`);
      queueRecord(hasWorkshopComparison(state.trials, tool) && !(tool === 'lever' ? state.leverFinding : state.rampFinding) ? `${result} 두 힘 막대를 비교해 아래 질문에 답해요.` : feedback);
    }
    context.commit(); update();
  }
  function advance(next: number) {
    if (completedGesture) return;
    // Over budget the cargo only gets as far as 콩이's force carries it.
    const limit = level === 2 ? judge().stallAt : 1;
    progress = Math.max(0, Math.min(limit, next)); positionHandle();
    if (progress >= limit) { if (limit < 1) stall(); else completeGesture(); }
  }
  function begin() { progress = 0; completedGesture = false; positionHandle(); }
  function end(cancelled: boolean) {
    cancelAnimationFrame(frame); keyHeld = false;
    const wasComplete = completedGesture;
    const captured = heldPointer; heldPointer = null;
    if (captured !== null && handle.hasPointerCapture(captured)) handle.releasePointerCapture(captured);
    if (!wasComplete) { progress = 0; positionHandle(); setFeedback(cancelled ? '조작이 멈춰 출발점으로 돌아왔어요. 다시 움직여 봐요.' : '아직 도착하지 않았어요. 화살표 방향으로 조금 더 끌어 봐요.'); }
    if (wasComplete && tool === 'direct' && level === 1) { configure('lever'); return; }
    update();
  }
  handle.addEventListener('pointerdown', event => {
    if (!scene || heldPointer !== null || keyHeld || designPointer!==null || waiting || sliding || (event.pointerType === 'mouse' && event.button !== 0) || performance.now() - toolChangedAt < 350) return;
    event.preventDefault(); handle.focus({ preventScroll: true }); heldPointer = event.pointerId; startX = event.clientX; startY = event.clientY;
    handle.setPointerCapture(event.pointerId); begin(); update();
  }, { signal });
  handle.addEventListener('pointermove', event => {
    if (heldPointer !== event.pointerId) return;
    const moved = tool === 'lever' ? event.clientY - startY : tool === 'direct' ? startY - event.clientY : event.clientX - startX;
    advance(moved / gesturePixels());
  }, { signal });
  handle.addEventListener('pointerup', event => { if (heldPointer === event.pointerId) end(false); }, { signal });
  handle.addEventListener('pointercancel', event => { if (heldPointer === event.pointerId) end(true); }, { signal });
  handle.addEventListener('lostpointercapture', event => { if (heldPointer === event.pointerId) end(true); }, { signal });
  handle.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); if (!scene || keyHeld || heldPointer !== null || designPointer!==null || waiting || sliding || event.repeat) return;
    keyHeld = true; begin(); update();
    const started = performance.now();
    const step = (now: number) => { if (!active || !keyHeld) return; advance((now - started) / Math.max(700, gesturePixels() * 9)); if (!completedGesture) frame = requestAnimationFrame(step); };
    frame = requestAnimationFrame(step);
  }, { signal });
  handle.addEventListener('keyup', event => { if ((event.key === 'Enter' || event.key === ' ') && keyHeld) { event.preventDefault(); end(false); } }, { signal });
  handle.addEventListener('blur', () => { if (keyHeld) end(true); }, { signal });
  window.addEventListener('blur', () => { if (keyHeld || heldPointer !== null) end(true); }, { signal });
  root.querySelectorAll<HTMLButtonElement>('.workshop-drawer > [data-tool]').forEach(button => button.addEventListener('click', () => configure(button.dataset.tool as WorkshopTool | 'direct'), { signal }));
  slider.addEventListener('input', () => {
    if(tool!=='ramp') return;
    resetGesture();
    state.rampLength = Number(slider.value) as RampSetting;
    scene?.configure(tool, currentSetting());
    setFeedback(`빗면: ${getWorkshopDesign('ramp',state.rampLength).label}`); context.commit(); update();
  }, { signal });
  function changeFulcrum(next:LeverSetting) {
    if(next===state.fulcrumPosition) return;
    state.fulcrumPosition=next; progress=0; completedGesture=false; scene?.configure('lever',next);
    setFeedback(`받침대: ${getWorkshopDesign('lever',next).label}`); update();
  }
  function endDesign(cancelled:boolean) {
    if(designPointer===null) return;
    const pointer=designPointer; designPointer=null;
    if(fulcrum.hasPointerCapture(pointer)) fulcrum.releasePointerCapture(pointer);
    if(cancelled) changeFulcrum(designInitialSetting); else context.commit();
    world.classList.remove('is-moving-fulcrum'); update();
  }
  fulcrum.addEventListener('pointerdown',event=>{
    if(!scene||tool!=='lever'||designPointer!==null||heldPointer!==null||keyHeld||waiting||sliding||event.button!==0) return;
    event.preventDefault(); resetGesture(); fulcrum.focus({preventScroll:true});
    designPointer=event.pointerId; designStartX=event.clientX; designAnchorX=scene.layout().support.x; designInitialSetting=state.fulcrumPosition;
    fulcrum.setPointerCapture(event.pointerId); world.classList.add('is-moving-fulcrum'); update();
  },{signal});
  fulcrum.addEventListener('pointermove',event=>{
    if(designPointer!==event.pointerId||!scene) return;
    changeFulcrum(scene.leverSettingAt(designAnchorX+event.clientX-designStartX));
  },{signal});
  fulcrum.addEventListener('pointerup',event=>{if(designPointer===event.pointerId)endDesign(false);},{signal});
  fulcrum.addEventListener('pointercancel',event=>{if(designPointer===event.pointerId)endDesign(true);},{signal});
  fulcrum.addEventListener('lostpointercapture',event=>{if(designPointer===event.pointerId)endDesign(true);},{signal});
  fulcrum.addEventListener('keydown',event=>{
    if(tool!=='lever'||!scene||heldPointer!==null||keyHeld||designPointer!==null||waiting||sliding||!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); resetGesture(); changeFulcrum(Math.max(0,Math.min(2,state.fulcrumPosition+(event.key==='ArrowLeft'?1:-1))) as LeverSetting); context.commit();
  },{signal});
  window.addEventListener('blur',()=>endDesign(true),{signal});
  const resizeObserver=new ResizeObserver(()=>{if(active)requestAnimationFrame(positionHandle);}); resizeObserver.observe(world);
  notebookBoard.addEventListener('click', event => {
    if ((event.target as Element).closest('#workshop-open-request')) { enterRequest(); return; }
    if (level === 2) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-finding]');
    if (!button || tool === 'direct' || keyHeld || heldPointer !== null || designPointer!==null) return;
    if (isBestWorkshopDesign(state.trials, tool, Number(button.dataset.finding))) {
      if (tool === 'lever') state.leverFinding = state.lever = true; else state.rampFinding = state.ramp = true;
      setFeedback(tool === 'lever' ? '관찰한 힘을 잘 비교했어요! 작은 힘을 쓰는 설계에서는 누르는 쪽이 더 멀리 움직였어요.' : '발견했어요! 같은 높이까지 더 긴 빗면으로 움직이면 더 작은 힘이 들어요.');
      context.sound(740); context.commit(); update();
    } else { const message='힘 막대가 더 짧은 설계를 찾아봐요. 다시 움직여 비교해도 좋아요.'; setFeedback(message); root.querySelector('#workshop-choice')!.textContent=message; }
  }, { signal });
  recordButton.addEventListener('click', () => { if (!recordButton.disabled) openRecord(level === 2 ? '의뢰 보기' : '기록 보기', feedback); }, { signal });
  root.querySelector('#turn-left')!.addEventListener('click', () => {scene?.turn(-1);positionHandle();}, { signal });
  root.querySelector('#turn-right')!.addEventListener('click', () => {scene?.turn(1);positionHandle();}, { signal });
  finish.addEventListener('click', () => {
    if (heldPointer !== null || keyHeld || designPointer!==null || waiting || sliding || !canFinishWorkshopExploration(state) || !(workshopL2Complete(levelRecord()) || !requestsEnabled(context.save))) return;
    const summaries = (['lever', 'ramp'] as WorkshopTool[]).map(name => {
      const runs = state.trials.filter(run => run.tool === name);
      const best = runs.reduce((a, b) => a.force < b.force ? a : b);
      return `${name === 'lever' ? '지레' : '빗면'}에서 ${runs.map(run => getWorkshopDesign(name, run.setting).label).join(' / ')}를 시험했고, ${getWorkshopDesign(name, best.setting).label}에서 직접 들 때보다 작은 힘이 들었어요.`;
    });
    const attempts = levelRecord()?.attempts ?? 0;
    context.finish('workshop', `직접 들기와 두 도구를 같은 화물·같은 도착 높이에서 비교했어요. ${summaries.join(' ')} 힘 예산 의뢰에서는 콩이의 작은 힘 안에서 화물 3개를 ${attempts}번 시도해 모두 올렸고, 무거운 화물일수록 받침대를 화물 가까이 두거나 빗면을 길게 해야 했어요.`);
  }, { signal });
  import('../three/workshopScene').then(module => {
    if (!active) return;
    canvas.replaceChildren(); scene = module.createWorkshopScene(canvas); scene.configure(tool, currentSetting()); scene.setCargoWeight(level === 2 ? workshopCargos[cargoIndex()].weight : 1); update();
  }).catch(() => { if (active) { canvas.innerHTML = '<div class="scene-error">작업대를 준비하지 못했어요. 새로고침해 다시 열어 주세요.</div>'; setFeedback('3D 작업대를 다시 열어야 해요.'); update(); } });
  update();
  return () => { active = false; recordDialog?.close(); clearTimeout(waitTimer); endDesign(true); resetGesture(); resizeObserver.disconnect(); events.abort(); scene?.dispose(); };
}
