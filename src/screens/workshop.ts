import type { AppContext } from '../appTypes';
import type { WorkshopScene } from '../three/workshopScene';
import { requestsEnabled } from '../state';
import { applyWorkshopL2Attempt, canFinishWorkshopExploration, workshopFinishSteps, getWorkshopDesign, hasWorkshopComparison, isBestWorkshopDesign, judgeWorkshopL2, recordWorkshopTrial, workshopBudget, workshopCargos, workshopL2Complete, workshopL2Current, workshopL2Force, workshopL2Hint, workshopL2HintLevel, type LeverSetting, type RampSetting, type WorkshopL2Result, type WorkshopTool } from '../workshopModel';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { fingerIcon } from '../interactionHints';
import { showPredictionChip } from '../predictionChip';
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
  let traces: { label: string; result: WorkshopL2Result }[] = [];
  // The cargo on the bench only changes after the success pause, not the moment it is saved.
  const savedCargo = () => Math.min(workshopCargos.length - 1, workshopL2Current(levelRecord()));
  let cargo = savedCargo();
  const cargoIndex = () => cargo;
  let feedback = level === 2 ? '콩이의 힘 막대를 보며 화물을 올려 봐요. 넘친 칸이 빨갛게 남아요.' : state.direct ? '설계를 바꾸고 손잡이를 움직여 필요한 힘을 비교해 봐요.' : '먼저 화물을 직접 들어 봐요. 손잡이를 위로 끌면 화물이 따라 올라와요.';
  root.innerHTML = `<section class="experiment-screen workshop-screen workshop-redesign">
    <div class="experiment-heading"><div><p class="eyebrow">04 · 운반 공방</p><h1>내 손으로 바꾸는 도구</h1><p>같은 화물을 움직여 보고, 힘이 더 적게 드는 설계를 찾아요.</p></div>${missionProgressMarkup('workshop',['직접 들기','지레 두 위치 비교','빗면 두 길이 비교'])}</div>
    <div class="workshop-studio">
      <div class="workshop-stage">
        <div class="workshop-drawer" role="group" aria-label="실험 도구"><button data-tool="direct">① 직접 들기</button><button data-tool="lever">② 지레</button><button data-tool="ramp">③ 빗면</button><div class="workshop-view"><button class="camera-button" id="turn-left" aria-label="시점 왼쪽">↶</button><button class="camera-button" id="turn-right" aria-label="시점 오른쪽">↷</button></div></div>
        <div class="workshop-world" data-tool="direct"><div class="workshop-scene-caption" id="workshop-caption"></div><div class="workshop-budget" id="workshop-budget" role="img" hidden><div class="budget-head"><img src="/assets/game/corgi-effort.webp" alt="" draggable="false"><strong>콩이의 힘</strong><span class="budget-status"></span></div><div class="budget-cells">${'<i></i>'.repeat(budgetCellCount)}</div><div class="budget-scale"><span>작은 힘까지</span><span class="budget-more"></span></div></div><div id="workshop-canvas" class="workshop-canvas"><div class="scene-loading">작업대 준비 중…</div></div><button id="workshop-fulcrum" class="workshop-fulcrum-grip" aria-label="그림의 받침대. 잡고 좌우로 옮기기. 방향키로도 위치 변경" hidden><span class="fulcrum-grab-label">${fingerIcon} 받침대 잡고 ↔</span></button><div class="workshop-actor" id="workshop-actor" role="img" aria-label="아이가 직접 화물을 들어 올려요"><img id="workshop-actor-main" src="/assets/game/workshop-direct-start.webp" alt="" draggable="false"><img id="workshop-actor-lift" src="/assets/game/workshop-direct-lift.webp" alt="" draggable="false"></div><button id="workshop-handle" class="workshop-handle" aria-label="손잡이를 움직여 실험하기"><i class="handle-force" aria-hidden="true"></i><i class="handle-budget" aria-hidden="true"></i><span class="handle-arrow">↑</span><span class="handle-label">상자를 잡고 위로</span></button><div class="workshop-height-ruler" aria-label="출발 높이와 같은 목표 높이를 비교하는 눈금자"><strong class="height-goal-label">같은 목표 높이</strong><div class="height-ruler-track"><i class="height-current-marker"></i></div><span class="height-start-label">출발 높이</span><span class="height-arrival" hidden>✓ 목표 도착</span></div><div class="workshop-move-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="목표 지점까지 이동"><span>출발</span><div class="workshop-travel"><i id="workshop-progress"></i></div><strong id="workshop-move-text">목표까지 0%</strong></div></div>
        <div class="workshop-design-dock"><div class="design-description"><strong id="design-label"></strong><span id="design-value"></span></div><div class="design-adjustment" id="design-adjustment"><input type="range" id="workshop-design" min="0" max="2" step="1" value="1" aria-label="받침대 위치 조절"><div class="design-stops" id="design-stops"></div></div><p id="workshop-gesture-tip" class="workshop-gesture-tip"></p></div>
      </div>
      <aside class="workshop-notebook"><div class="notebook-heading"><span>직접 들 때와 비교해요</span><strong id="workshop-evidence-count">0 / 2</strong></div><div class="workshop-quiz-prompt"><h2 id="workshop-observation-help"></h2><p id="workshop-answer-help" class="answer-label"></p></div><div class="workshop-records" id="workshop-records"></div><div id="workshop-choice" class="workshop-choice"></div><p class="workshop-model-note">힘은 힘끼리, 길은 길끼리 비교해요. 화면 속 힘이며 손가락의 누르는 세기를 재는 것은 아니에요.</p></aside>
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
  for(let index=0;index<5;index++) { const image=new Image();image.src=`/assets/game/workshop-lever-press-${index}.webp`; }
  const signal = events.signal;
  const currentSetting = () => tool === 'lever' ? state.fulcrumPosition : state.rampLength;
  const judge = () => judgeWorkshopL2(cargoIndex(), tool, currentSetting());
  const designName = () => tool === 'direct' ? '직접 들기' : `${tool === 'lever' ? '지레' : '빗면'} · ${getWorkshopDesign(tool, currentSetting()).label}`;
  const toolForce = () => level === 2 ? workshopL2Force(cargoIndex(), tool, currentSetting()) : tool === 'direct' ? 100 : getWorkshopDesign(tool, currentSetting()).force;
  /** Green cells up to the budget; red cells are how much force was missing. */
  function cellClasses(result: WorkshopL2Result | null, showOver: boolean): string[] {
    return Array.from({ length: budgetCellCount }, (_cell, index) => !result ? '' : index < Math.min(result.needCells, result.budgetCells) ? 'is-fill' : showOver && index >= result.budgetCells && index < result.budgetCells + result.overCells ? 'is-over' : '');
  }
  const cellsMarkup = (result: WorkshopL2Result) => cellClasses(result, true).map(name => `<i class="${name}"></i>`).join('');
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
    const hidden = result && showOver ? Math.max(0, result.budgetCells + result.overCells - budgetCellCount) : 0;
    bar.querySelector('.budget-more')!.textContent = showOver ? `넘친 힘${hidden ? ` +${hidden}칸 더` : ''}` : '';
    const status = !result ? '6칸까지 쓸 수 있어요' : live ? '힘을 주는 중…' : result.success ? '✓ 힘이 충분해요' : `${result.overCells}칸 모자라요`;
    bar.querySelector('.budget-status')!.textContent = status;
    bar.dataset.state = showOver ? 'over' : result?.success && !live ? 'ok' : 'idle';
    bar.setAttribute('aria-label', `콩이의 힘 막대: 작은 힘 6칸까지 쓸 수 있어요. ${status}`);
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
    root.querySelector<HTMLElement>('#workshop-move-text')!.textContent = `목표까지 ${Math.round(progress * 100)}%`;
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
        const source=`/assets/game/workshop-lever-press-${pose}.webp`;
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
  function setFeedback(message: string) { feedback = message; root.querySelector<HTMLElement>('#workshop-feedback')!.textContent = feedback; }
  function resetGesture() {
    cancelAnimationFrame(frame); cancelAnimationFrame(slideFrame); keyHeld = false; sliding = false; stalled = false;
    if (heldPointer !== null && handle.hasPointerCapture(heldPointer)) handle.releasePointerCapture(heldPointer);
    heldPointer = null; completedGesture = false; progress = 0; positionHandle();
  }
  function update() {
    const busy = heldPointer !== null || keyHeld || designPointer !== null || waiting || sliding;
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
    const label = root.querySelector<HTMLElement>('#design-label')!;
    const value = root.querySelector<HTMLElement>('#design-value')!;
    const stops = root.querySelector<HTMLElement>('#design-stops')!;
    if (tool === 'direct') { label.textContent = '도구 없이 들어 보기'; value.textContent = state.direct ? '직접 든 힘을 기억했어요 ✓' : '위쪽 표시까지 올려요'; }
    else {
      label.textContent = tool === 'lever' ? '그림 속 받침대를 잡고 좌우로 옮겨요' : '도착 높이는 그대로, 길이만 바꿔요';
      const designLabel = getWorkshopDesign(tool, currentSetting()).label;
      value.textContent = '지금 설계: ' + designLabel;
      slider.max = '1'; slider.value = String(state.rampLength);
      slider.setAttribute('aria-label', '빗면 길이 조절');
      slider.setAttribute('aria-valuetext', designLabel);
      stops.innerHTML = '<span>짧고 가파르게</span><span>길고 완만하게</span>';
    }
    root.querySelector<HTMLElement>('#workshop-caption')!.textContent = level === 2 ? `${workshopCargos[cargoIndex()].label} · 같은 높이까지 올려요` : tool === 'direct' ? '이 화물을 도구로도 움직일 거예요' : tool === 'lever' ? '같은 화물 · 같은 높이까지 들어요' : '같은 화물 · 같은 높이까지 올려요';
    root.querySelector<HTMLElement>('#workshop-gesture-tip')!.textContent = tool==='lever' ? '받침대를 옮긴 뒤 손잡이를 아래로 끝까지 움직여요' : '손잡이를 화살표 방향으로 끝까지 움직여요';
    const steps = workshopFinishSteps(state);
    const notebook=root.querySelector<HTMLElement>('.workshop-notebook')!;
    notebook.classList.toggle('is-request', level === 2);
    root.querySelector<HTMLElement>('.notebook-heading span')!.textContent = level === 2 ? '공방 친구의 의뢰' : '직접 들 때와 비교해요';
    root.querySelector<HTMLElement>('.workshop-model-note')!.textContent = level === 2 ? '힘 막대 한 칸은 화면 속 힘의 단계예요. 실제 무게나 단위가 아니에요.' : '힘은 힘끼리, 길은 길끼리 비교해요. 화면 속 힘이며 손가락의 누르는 세기를 재는 것은 아니에요.';
    if (level === 2) { renderRequest(); notebook.classList.remove('quiz-ready', 'quiz-done'); } else {
    root.querySelector<HTMLElement>('#workshop-evidence-count')!.textContent = `${Number(steps.lever) + Number(steps.ramp)} / 2`;
    const entries = state.trials.filter(run => run.tool === tool);
    const help = root.querySelector<HTMLElement>('#workshop-observation-help')!;
    help.textContent = tool === 'direct' ? '도구 없이 들 때의 힘을 살펴봐요' : entries.length === 0 ? '도구를 쓰면 힘이 어떻게 달라질까요?' : entries.length === 1 ? '다른 설계로 한 번 더 하면 어떻게 달라질까요?' : '두 설계의 힘과 움직인 길을 비교해요';
    const forceScale = Math.max(100, ...entries.map(run => run.force));
    const distanceScale = Math.max(Number.EPSILON, ...entries.map(run => run.distance));
    const shortestDistance = Math.min(...entries.map(run => run.distance));
    const distanceLabel = tool === 'lever' ? '손잡이가 움직인 길' : '화물이 움직인 길';
    const finding = tool === 'lever' ? state.leverFinding : state.rampFinding;
    const choosing = tool !== 'direct' && hasWorkshopComparison(state.trials, tool) && !finding;
    notebook.classList.toggle('quiz-ready',choosing); notebook.classList.toggle('quiz-done',tool!=='direct'&&finding);
    root.querySelector<HTMLElement>('#workshop-answer-help')!.innerHTML=choosing?'더 탐구하기 (선택): 작은 힘이 든 기록 고르기':finding?'✓ 추가 비교를 설명했어요':'같은 화물 · 같은 높이에서 비교해요';
    root.querySelector<HTMLElement>('#workshop-records')!.innerHTML = (state.direct ? `<article class="workshop-run baseline-run"><strong>도구 없이 직접 들기</strong><div class="workshop-force"><i style="width:${100/forceScale*100}%"></i></div><span>기준이 되는 힘</span></article>` : '') + entries.map((run,index) => {
      const distanceWord = entries.length < 2 ? '관찰한 길' : run.distance === shortestDistance ? '더 짧게' : run.distance === distanceScale ? '더 멀리' : '두 길 사이';
      const content = `<strong>${getWorkshopDesign(run.tool, run.setting).label}</strong><div class="workshop-metrics"><div class="workshop-metric"><span class="workshop-metric-label"><b aria-hidden="true">✋</b> 필요한 힘</span><div class="workshop-force" aria-hidden="true"><i style="width:${run.force / forceScale * 100}%"></i></div><span class="workshop-metric-value">${forceWord(run.force)}</span></div><details class="workshop-distance-detail"${entries.length>=2?' open':''}><summary>움직인 길도 보기 (선택)</summary><div class="workshop-metric"><span class="workshop-metric-label"><b aria-hidden="true">↔</b> ${distanceLabel}</span><div class="workshop-distance" aria-hidden="true"><i style="width:${run.distance / distanceScale * 100}%"></i></div><span class="workshop-metric-value">${distanceWord}</span></div></details></div>`;
      return `<article class="workshop-run">${content}${choosing ? `<button class="workshop-run-choice" data-finding="${run.setting}" ${busy ? 'disabled' : ''}><span class="workshop-answer-number">${index+1}</span><span class="workshop-pick-record">${fingerIcon} 작은 힘이 든 기록으로 고르기</span></button>` : ''}</article>`;
    }).join('') || '<div class="workshop-empty">설계를 바꾸고 실험하면<br>힘과 움직인 길이 남아요.</div>';
    root.querySelector<HTMLElement>('#workshop-choice')!.innerHTML = tool !== 'direct' && hasWorkshopComparison(state.trials, tool) ? `<p class="workshop-finding">발견: ${tool === 'lever' ? '받침대가 화물에 가까울수록 힘은 작게 들고, 손잡이가 움직인 길은 길어져요.' : '빗면이 길고 완만할수록 힘은 작게 들고, 화물이 움직인 길은 길어져요.'}</p>` + (finding ? `<p class="finding-earned">✓ 작은 힘, 더 먼 길!</p><p>두 기록의 막대를 비교해요. 작은 힘이 든 설계에서는 ${distanceLabel}도 더 길어요.</p>` : '<p>작은 힘이 든 기록을 눌러요. 움직인 길의 막대도 함께 살펴봐요.</p>') : '';
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
    root.querySelector<HTMLElement>('#workshop-evidence-count')!.textContent = `${record?.cleared.length ?? 0} / ${workshopCargos.length}`;
    root.querySelector<HTMLElement>('#workshop-observation-help')!.textContent = '“콩이 힘으로는 이 화물을 못 들어요. 장치를 바꿔 볼까요?”';
    root.querySelector<HTMLElement>('#workshop-answer-help')!.textContent = '콩이의 힘 막대는 작은 힘 6칸까지만 차요.';
    root.querySelector<HTMLElement>('#workshop-records')!.innerHTML = workshopCargos.map((cargo, index) => {
      const cleared = !!record?.cleared.includes(index), now = !done && index === current;
      return `<article class="workshop-cargo-card" data-state="${cleared ? 'done' : now ? 'now' : 'next'}"><i class="cargo-weight" style="--weight:${cargo.weight}" aria-hidden="true"></i><strong>${index + 1}. ${cargo.label}</strong><span>${cleared ? '✓ 올렸어요' : now ? '지금 올릴 화물' : '다음 화물'}</span></article>`;
    }).join('');
    root.querySelector<HTMLElement>('#workshop-choice')!.innerHTML = done
      ? '<p class="finding-earned">✓ 의뢰 완료!</p><p class="workshop-finding">무거운 화물일수록 받침대를 화물 가까이, 빗면을 더 길게 하면 콩이의 힘으로도 올릴 수 있었어요.</p>'
      : traces.length
        ? '<p class="workshop-trace-title">이 화물에서 해 본 설계</p>' + traces.map((trace, index) => `<div class="workshop-trace" data-ok="${trace.result.success}" data-age="${traces.length - 1 - index}"><strong>${trace.label}</strong><span class="trace-cells" aria-hidden="true">${cellsMarkup(trace.result)}</span><span>${trace.result.success ? '✓ 올렸어요' : `빨간 ${trace.result.overCells}칸 · 멈춤`}</span></div>`).join('')
        : '<p>도구와 설계를 고른 뒤 손잡이를 움직여요. 힘 막대가 6칸을 넘으면 화물이 멈춰요.</p>';
  }
  function enterRequest() {
    if (!canFinishWorkshopExploration(state) || heldPointer !== null || keyHeld || designPointer !== null) return;
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
    traces = [...traces, { label, result }].slice(-3);
    context.commit();
    if (!result.success) {
      misses++;
      setFeedback(`${name}이 중간에 멈췄다가 미끄러져 내려왔어요. 힘이 ${result.overCells}칸 모자랐어요. ${workshopL2Hint(workshopL2HintLevel(misses), tool)}`);
      slideBack(); return;
    }
    misses = 0; context.sound(780);
    if (workshopL2Complete(levelRecord())) { setFeedback(`${name}도 '${label}' 설계로 올렸어요! 세 화물을 모두 옮겼어요. 이제 생활 속 도구를 찾아요.`); update(); return; }
    setFeedback(`${name}을 '${label}' 설계로 콩이의 힘 안에서 올렸어요!`);
    waiting = true; update();
    waitTimer = window.setTimeout(() => {
      if (!active) return;
      waiting = false; traces = []; cargo = savedCargo(); resetGesture(); scene?.setCargoWeight(workshopCargos[cargoIndex()].weight);
      setFeedback(`다음은 ${workshopCargos[cargoIndex()].label}이에요. 지난번보다 무거워요! 같은 설계로 될까요?`); update();
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
    setFeedback(tool === 'direct' ? '손잡이를 위로 움직여 화물을 들어 봐요.' : tool === 'lever' ? '받침대를 옮긴 뒤 손잡이를 아래로 눌러 봐요. 화물과 손잡이가 얼마나 움직일까요?' : '빗면 길이를 바꾼 뒤 오른쪽으로 끌어 봐요. 도착하는 높이는 같아요.');
    update();
  }
  function nextHint() {
    const steps = workshopFinishSteps(state);
    if (tool === 'lever' && !hasWorkshopComparison(state.trials, 'lever')) return '받침대를 다른 곳으로 옮겨 한 번 더 들어 봐요.';
    if (tool === 'lever' && !steps.lever) return '직접 들 때보다 힘이 작게 드는 받침대 위치를 더 찾아봐요.';
    if (tool === 'ramp' && !steps.ramp) return '이번엔 길이를 바꿔 같은 높이까지 올려 봐요.';
    if (!steps.lever) return '관찰 보드에서 발견을 확인하고, 지레도 두 위치에서 비교해 봐요.';
    if (!steps.ramp) return '관찰 보드에서 발견을 확인하고, 빗면도 두 길이로 올려 봐요.';
    return '세 발견을 모두 했어요! 관찰 보드에서 공방 친구의 의뢰를 받아요.';
  }
  function completeGesture() {
    if (completedGesture || !active) return;
    completedGesture = true;
    if (level === 2) { recordL2(judge()); return; }
    context.sound(730);
    if (tool === 'direct') { state.direct = true; setFeedback('직접 들어 봤어요! 이제 지레로 들어 봐요.'); }
    else {
      const setting = currentSetting();
      const design = getWorkshopDesign(tool, setting);
      const easierBefore = state.trials.some(run => run.force < 100);
      const needsNewChoice = recordWorkshopTrial(state, tool, setting);
      if (!easierBefore && design.force < 100) showPredictionChip(world, context.save, 'workshop');
      state.fulcrumSnapped = state.plankSnapped = state.rampSnapped = true;
      setFeedback(`'${design.label}' 설계로 움직였어요. ${forceWord(design.force)}이 들었어요. ${needsNewChoice ? '더 작은 힘이 드는 새 설계를 발견했어요! 관찰 보드에서 다시 골라요.' : nextHint()}`);
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
    setFeedback('설계가 바뀌었어요. 손잡이를 다시 움직여 힘과 이동하는 길을 비교해요.'); context.commit(); update();
  }, { signal });
  function changeFulcrum(next:LeverSetting) {
    if(next===state.fulcrumPosition) return;
    state.fulcrumPosition=next; progress=0; completedGesture=false; scene?.configure('lever',next);
    setFeedback(`받침대를 ${getWorkshopDesign('lever',next).label}에 놓았어요. 이제 아이 곁에서 지레를 아래로 눌러 봐요.`); update();
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
  root.querySelector('.workshop-notebook')!.addEventListener('click', event => {
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
  return () => { active = false; clearTimeout(waitTimer); endDesign(true); resetGesture(); resizeObserver.disconnect(); events.abort(); scene?.dispose(); };
}
