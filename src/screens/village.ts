import {dockMapAttack} from '../map-attack-control.js';
import { canPlayMapFinale } from '../map-villains.js';
import { bindDirectionPad } from '../map-controls.js';
import type { AppContext } from '../appTypes';
import type { MapSound } from '../sound';
import type { StageId } from '../data';
import { getVillageStory, villageRewards } from '../villageStory';
import '../village.css';
import { encounterAtlas } from '../villageEncounters';
import { playVoiceLine, stopVoiceLine } from '../npcDialogueVoice';
import { newlySolved, requestBoard, solvedRequests, villageRequests, type RequestStage } from '../requestBoard';

import { directions, distance, walkingSpeed, createVillageInput, moveVillagePoint, createVillageNavigation, validateMap, withParticle } from './villageMap';
import type { Point, Direction, AssetMeta } from './villageMap';
// 예전처럼 village.ts에서도 꺼내 쓸 수 있게(테스트·다른 모듈).
export { canStandInVillage, createVillageNavigation, createVillageInput, moveVillagePoint, createVillageEntrances, villageLights, villageLightRoutes, withDirectionParticle, withParticle, requestBoardSpot, requesterSpots } from './villageMap';
export type { VillageMap } from './villageMap';
import { renderVillageLights } from './villageLights';
import type { VillageOptions, VillageScene } from './villageScene';
import { createVillageRenderer } from './villageDraw';
import { createVillageEncounters } from './villageEncounter';
import { createVillageCamera } from './villageCamera';
import { createVillageActions } from './villageActions';
/** Requests solved at the last village visit, so a client walks out only once per new solve. */
let seenRequests: RequestStage[] | undefined;

/** The village map screen. The parts live in villageDraw (canvas), villageEncounter (villains), villageCamera
 * (follow, whole map, hand mode, zoom) and villageActions (routes, talk, board, entering); they share `VillageScene`.
 * This function builds the screen, loads the world, runs the walking loop and wires the keys and buttons. */
export function mountVillage(root: HTMLElement, context: AppContext, options: VillageOptions): () => void {
  const story = getVillageStory(context.save.completed);
  const events = new AbortController();
  const base = `${import.meta.env.BASE_URL}assets/village/`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML = `<section class="village-screen"><div class="village-frame"><canvas class="village-canvas" tabindex="0" aria-label="힘 마을. 방향키나 WASD로 걷고, 땅이나 건물 이름을 누르면 길을 따라 이동해요. 장소 이름이나 다음 장소 버튼을 눌러 출발해요. 악당 가까이에서 공격 버튼이나 스페이스바를 눌러요. Enter로 가까운 주민과 이야기하거나 문에 들어갈 수도 있어요."></canvas><svg class="village-lights" aria-hidden="true" focusable="false"></svg><div class="village-labels"></div></div><div class="village-reveal" role="status" hidden></div><div class="village-bottom"><div class="village-pad" role="group" aria-label="이동 방향판"><button data-direction="up" aria-label="위로 걷기">↑</button><button data-direction="left" aria-label="왼쪽으로 걷기">←</button><button data-direction="down" aria-label="아래로 걷기">↓</button><button data-direction="right" aria-label="오른쪽으로 걷기">→</button></div><p class="village-hint" id="village-hint" role="status">길을 누르거나 방향판으로 걸어가 봐!</p><div class="village-actions"><div class="village-camera-tools" role="group" aria-label="지도 보기"><button class="village-pan" id="village-fit" aria-label="지도 전체 보기" title="지도 전체 보기" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"/></svg></button><button class="village-pan" id="village-pan" aria-pressed="false" aria-label="지도 끌어 보기" title="지도 끌어 보기"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 17V8.5a2 2 0 0 1 4 0V15m0-8a2 2 0 0 1 4 0v8m0-6.5a2 2 0 0 1 4 0V16m0-4a2 2 0 0 1 4 0v8.5C26 26 22.5 29 18 29h-1.5c-3.4 0-5.4-1.5-7.3-4.4L5.6 19c-1-1.6 1.2-3.4 2.6-2l1.8 2" fill="#fff5d7" stroke="#5a3d17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><button id="village-results" hidden>내 발견 모아 보기</button><button id="village-action" disabled>건물 이름을 눌러요</button></div></div><div class="village-loading"><strong>마을로 가는 길을 준비해요…</strong><progress max="100" value="0" aria-label="마을 그림 준비"></progress><span id="village-loading-detail">마을 지도를 읽는 중이에요</span><button id="village-retry" hidden>다시 불러오기</button></div><dialog class="village-conversation npc-dialogue" aria-labelledby="village-dialog-title"><div class="npc-dialogue-stage"><div class="npc-dialogue-character"><span class="npc-dialogue-frame" aria-hidden="true"></span></div><div class="npc-dialogue-panel"><h2 class="npc-dialogue-name" id="village-dialog-title"></h2><button class="npc-dialogue-close" id="village-dialog-close" aria-label="대화 닫기">×</button><p id="village-dialog-line" data-dialogue-text></p><div class="npc-dialogue-bottom"><div class="npc-dialogue-meta"><span id="village-dialog-role">마을의 안내원</span><button class="npc-dialogue-replay" type="button" data-dialogue-voice hidden>다시 듣기</button></div><button class="npc-dialogue-next" id="village-dialog-next">이야기 더 듣기</button></div></div></div></dialog><dialog class="village-board" aria-labelledby="village-board-title"><div class="village-board-heading"><h2 id="village-board-title">의뢰 게시판</h2><button id="village-board-close" aria-label="게시판 닫기">×</button></div><p class="village-board-lead"></p><ul class="village-board-cards"></ul></dialog></section>`;
  const shell = root.querySelector<HTMLElement>('.village-screen')!, frame = root.querySelector<HTMLElement>('.village-frame')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.village-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const labels = root.querySelector<HTMLElement>('.village-labels')!;
  const lights = root.querySelector<SVGSVGElement>('.village-lights')!;
  const loading = root.querySelector<HTMLElement>('.village-loading')!;
  const retry = root.querySelector<HTMLButtonElement>('#village-retry')!;
  const action = root.querySelector<HTMLButtonElement>('#village-action')!;
  shell.insertAdjacentHTML('beforeend', '<aside class="village-encounter-hud" aria-label="지도 악당" hidden><strong>바퀴잠금 봇</strong><span class="village-encounter-pips"><i></i><i></i><i></i></span><p role="status"></p><button id="village-attack" type="button" aria-keyshortcuts="Space X" aria-disabled="true" aria-label="공격 · 가까이 가요" hidden>공격</button></aside>');
  const encounterHud = shell.querySelector<HTMLElement>('.village-encounter-hud')!;
  const attack = encounterHud.querySelector<HTMLButtonElement>('#village-attack')!;
  const syncAttackDock=dockMapAttack(attack,()=>root.querySelector('#village-pan'));
  syncAttackDock();
  const encounterPips = encounterHud.querySelector<HTMLElement>('.village-encounter-pips')!;
  const encounterText = encounterHud.querySelector('p')!;
  const hint = root.querySelector<HTMLElement>('#village-hint')!;
  const reveal = root.querySelector<HTMLElement>('.village-reveal')!;
  const dialog = root.querySelector<HTMLDialogElement>('.village-conversation')!;
  const portrait = root.querySelector<HTMLElement>('.npc-dialogue-frame')!;
  const nextLine = root.querySelector<HTMLButtonElement>('#village-dialog-next')!;
  const board = root.querySelector<HTMLDialogElement>('.village-board')!;
  // Level 2 requests: the board shows all four; a solved one brings its client back to the building.
  const cards = requestBoard(context.save), solved = solvedRequests(context.save);
  const boardAvailable=cards.some(card=>card.status!=='locked');
  const arriving = reduced.matches ? [] : newlySolved(seenRequests, solved);
  seenRequests = solved;
  // Give the light reveal room before clients walk out.
  const results = root.querySelector<HTMLButtonElement>('#village-results')!; results.hidden = !story.complete; results.classList.toggle('is-next', story.complete);
  let generation = 0, raf = 0, lastDraw = 0;
  let wasMoving = false, wasDogMoving = false;
  let fetches = new AbortController();
  const revealStage = options.newlyCompleted && story.changes.includes(options.newlyCompleted) ? options.newlyCompleted : undefined;
  // Reveal timeline (seconds): windows light up, then light runs along the road to the core.
  const flowStart = .7, flowTime = 1.3, revealEnd = flowStart + flowTime + .5;
  const arrivalStart = revealStage ? revealEnd + .3 : .5, arrivalTime = .9;
  const cancelImages = new Set<() => void>();
  const input = createVillageInput(), pads = new Map<number,Direction>();
  const padButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-direction]')];
  const pad = root.querySelector<HTMLElement>('.village-pad')!;
  const panButton = root.querySelector<HTMLButtonElement>('#village-pan')!;
  const vectors: Record<Direction,Point> = { up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0} };
  function syncPadFeedback() {
    const active = new Set([...input.directions(), ...pads.values()]);
    for (const button of padButtons) button.classList.toggle('is-held', active.has(button.dataset.direction as Direction));
  }
  function assetURL(file: string) { if(!/^[a-z0-9_./-]+\.webp$/i.test(file)||file.startsWith('/')||file.split('/').includes('..'))throw new Error('asset');return base+file; }
  const v = {
    root, context, options, story, reduced, events: events.signal,
    shell, frame, canvas, ctx, labels, lights, hint, reveal, action, panButton, dialog, portrait, nextLine, board,
    encounterHud, attack, encounterPips, encounterText,
    cards, solved, arriving, boardAvailable, revealStage, flowStart, flowTime, revealEnd, arrivalStart, arrivalTime,
    alive: true, map: null, navigation: null, images: new Map(), metadata: new Map(),
    actor: { x:0,y:0,direction:'down' }, dog: { x:0,y:0,direction:'down' },
    path: [], trail: [], destination: null, guided: undefined, entering: false,
    last: 0, walkingTime: 0, dogTime: 0, revealTime: 0, arrivalShown: !arriving.length,
    nearestBuilding: undefined, nearestNpc: undefined, nearestClient: undefined, nearBoard: false,
    camera: { x: 0, y: 0 }, panView: null, overview: false, frameWidth: 1, frameHeight: 1,
    encounters: [], nearbyEnemy: undefined, attackTarget: undefined, encounterClock: 0,
    lastHitAt: -Infinity, studentHurt: -Infinity, dogHurt: -Infinity, studentAttackFacing: 1, studentHurtFacing: 1, dogHurtFacing: 1,
    finaleAt: 0, focusBeforeAttack: null,
    // Hit sounds wait for the impact frame (the pose changes 80 ms after the press); cleared when the map closes.
    cueTimers: new Set<number>(),
    cueLater(name: MapSound, delay: number) {
      const id = window.setTimeout(() => { v.cueTimers.delete(id); if (v.alive) context.cue(name); }, delay);
      v.cueTimers.add(id);
    },
    // Villain bubble lines are voiced when their text appears; greetings never cut off the doctor's banner line.
    villainSay(id: StageId, index: number, text: string) {
      if (encounterText.textContent === text) return;
      encounterText.textContent = text;
      playVoiceLine(`villain/${id}-${index + 1}`, { polite: index < 2 });
    },
    syncAttackDock,
    paused() { return document.hidden || dialog.open || board.open || !!root.closest('[inert]') || !!document.querySelector('.modal-layer'); },
    clearInput() { input.clear(); pads.clear(); syncPadFeedback(); },
    assetURL,
  } as unknown as VillageScene;
  const art = createVillageRenderer(v), fight = createVillageEncounters(v), view = createVillageCamera(v);
  Object.assign(v, art, fight, view);
  const acts = createVillageActions(v);
  Object.assign(v, acts);
  function loadImage(file: string): Promise<HTMLImageElement> {
    return new Promise((resolve,reject)=>{
      const image = new Image(); image.decoding = 'async';
      let done = false;
      const finish = (error?: Error) => { if(done)return;done=true;window.clearTimeout(timer);cancelImages.delete(cancel);image.onload=image.onerror=null;if(error){image.removeAttribute('src');reject(error);}else resolve(image); };
      const cancel = () => finish(new Error('cancelled'));
      const timer = window.setTimeout(()=>finish(new Error(file)),25000);
      cancelImages.add(cancel); image.onload=()=>finish();image.onerror=()=>finish(new Error(file));
      try { image.src=assetURL(file); } catch { finish(new Error(file)); }
    });
  }
  const observer=new ResizeObserver(v.resize);observer.observe(shell);v.resize();
  /** Lit windows and lamps of restored buildings, drawn once in map pixels over the canvas. A fresh
   * completion plays its reveal with CSS opacity/transform only; reduced motion shows the end state. */
  function setupLights() {
    renderVillageLights(lights, { map: v.map!, navigation: v.navigation!, reveal: revealStage && !reduced.matches ? revealStage : undefined, changes: story.changes, complete: story.complete, solved, arriving, flowStart, flowTime, arrivalStart, arrivalTime });
  }
  function move(dx: number, dy: number): boolean {
    const map = v.map, actor = v.actor;
    if(!map || (!dx && !dy))return false;
    const next = moveVillagePoint(map, actor, { x: dx, y: dy });
    const actualX = next.x - actor.x, actualY = next.y - actor.y;
    const moved = Math.hypot(actualX, actualY) > .001;
    const facingX = moved ? actualX : dx, facingY = moved ? actualY : dy;
    actor.direction = Math.abs(facingX) > Math.abs(facingY) ? facingX < 0 ? 'left' : 'right' : facingY < 0 ? 'up' : 'down';
    actor.x = next.x; actor.y = next.y;
    return moved;
  }
  function tick(now: number) {
    if(!v.alive||!v.map)return;
    const dt=Math.min(.035,Math.max(0,(now-v.last)/1000));v.last=now;
    if(v.paused()){v.clearInput();v.stopRoute();v.updateNearby();v.updateEncounters(now);v.walkingTime=0;v.dogTime=0;raf=requestAnimationFrame(tick);return;}
    const actor=v.actor, dog=v.dog;
    const old={x:actor.x,y:actor.y}, oldFacing=actor.direction;
    const direction = input.vector(pads.values());
    let arrived=false;
    if(direction.x||direction.y){v.stopRoute();move(direction.x*walkingSpeed*dt,direction.y*walkingSpeed*dt);}
    else if(v.path.length){const path=v.path,target=path[0],d=distance(actor,target);if(d<3)path.shift();else move((target.x-actor.x)/d*Math.min(d,walkingSpeed*dt),(target.y-actor.y)/d*Math.min(d,walkingSpeed*dt));if(!path.length){v.destination=null;arrived=true;}}
    const trail=v.trail;
    const moved=distance(old,actor)>.05;if(moved){v.walkingTime+=dt;if(!trail.length||distance(actor,trail.at(-1)!)>9)trail.push({x:actor.x,y:actor.y});}else v.walkingTime=0;
    const guided=v.guided;
    if(guided&&distance(actor,guided.entry)<=Math.min(16,guided.entry.radius)&&v.enterBuilding(guided))return;
    if(arrived)v.guided=undefined;
    let dogMoved=false;
    if(trail.length>5){const target=trail[0],d=distance(dog,target);if(d<4)trail.shift();else{const amount=Math.min(d,(walkingSpeed+40)*dt),next={x:dog.x+(target.x-dog.x)/d*amount,y:dog.y+(target.y-dog.y)/d*amount};if(v.navigation!.stand(next)){dog.direction=Math.abs(target.x-dog.x)>Math.abs(target.y-dog.y)?target.x<dog.x?'left':'right':target.y<dog.y?'up':'down';dog.x=next.x;dog.y=next.y;dogMoved=true;}else trail.shift();}}
    v.dogTime=dogMoved?v.dogTime+dt:0;v.revealTime+=dt;
    if (v.encounters.length) fight.updateEnemyPatrol(now,dt);
    v.updateEncounters(now);
    if (v.encounters.length) fight.updateContact(now);
    if(!v.arrivalShown&&v.revealTime>=arrivalStart+arrivalTime){
      v.arrivalShown=true;
      labels.querySelectorAll('.village-client-bubble.is-waiting').forEach(bubble=>{bubble.classList.remove('is-waiting');bubble.classList.add('is-arrived');});
      hint.textContent=`${withParticle(villageRequests[arriving[0]].client,'이','가')} 가게 앞에 돌아왔어! 말풍선을 누르면 인사를 들을 수 있어.`;
    }
    v.updateNearby();v.follow();
    if(arrived)hint.textContent=v.restHint();
    const revealTime=v.revealTime;
    // The banner shrinks to its title so labels stay readable, then leaves the next step to the hint.
    if(!reveal.hidden&&revealTime>3.6)reveal.classList.add('is-compact');
    if(!reveal.hidden&&revealTime>8){reveal.hidden=true;if(revealStage&&hint.textContent===villageRewards[revealStage].changeDescription)hint.textContent=v.restHint();}
    if(now-v.lastHitAt<650||now-v.studentHurt<365||now-v.dogHurt<365||moved||dogMoved||moved!==wasMoving||dogMoved!==wasDogMoving||actor.direction!==oldFacing||now-lastDraw>180||revealStage&&revealTime<revealEnd+.2||!v.arrivalShown&&revealTime>=arrivalStart-.05){v.draw(moved,dogMoved);lastDraw=now;}
    wasMoving=moved;wasDogMoving=dogMoved;
    raf=requestAnimationFrame(tick);
  }
  async function loadWorld() {
    const token=++generation;cancelAnimationFrame(raf);fetches.abort();fetches=new AbortController();cancelImages.forEach(cancel=>cancel());v.clearInput();v.map=null;v.path=[];v.images.clear();art.clearFacades();labels.replaceChildren();lights.replaceChildren();loading.hidden=false;retry.hidden=true;action.disabled=true;reveal.hidden=true;
    loading.querySelector('strong')!.textContent='마을로 가는 길을 준비해요…';
    const progress=loading.querySelector('progress')!,detail=root.querySelector('#village-loading-detail')!;progress.hidden=false;progress.value=0;detail.textContent='마을 지도를 읽는 중이에요';
    try {
      const readMapData = async (file: string): Promise<unknown> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetch(base + file, {
              signal: AbortSignal.any([fetches.signal, AbortSignal.timeout(25000)]),
            });
            if (!response.ok) throw new Error(file);
            return await response.json();
          } catch (error) {
            if (attempt || !v.alive || token !== generation || fetches.signal.aborted) throw error;
          }
        }
      };
      const [rawMap, rawManifest] = await Promise.all([
        readMapData('world-map.json'),
        readMapData('manifest.json'),
      ]);
      const candidate = validateMap(rawMap);
      const manifest = rawManifest as { outputs: AssetMeta[] };
      if(!v.alive||token!==generation)return;if(!ctx)throw new Error('canvas');
      if(!Array.isArray(manifest.outputs))throw new Error('manifest');v.metadata=new Map(manifest.outputs.map(item=>[item.file,item]));
      const files=[...new Set(['terrain.webp',...candidate.buildings.map(b=>b.asset),...candidate.npcs.map(n=>n.asset),...['guide','wave','think','point','baker','inspector','clerk','crafter'].map(pose=>`npc/${pose}.webp`),...['student','corgi'].flatMap(person=>directions.flatMap(direction=>[1,2,3,4].map(i=>`${person}/${direction}-${i}.webp`))),...[1,4,5,9,10,11,12].map(i=>`props/prop-${String(i).padStart(2,'0')}.webp`),'props/request-board.webp'])];
      let count=0;
      // Start each timeout only when its request has a slot; retry a transient failure once.
      const queue=[...files],loaded:(readonly [string,HTMLImageElement])[]=[];
      await Promise.all(Array.from({length:4},async()=>{while(queue.length){
        const file=queue.shift()!;let image:HTMLImageElement;
        try{image=await loadImage(file);}catch(error){if(!v.alive||token!==generation||fetches.signal.aborted)throw error;image=await loadImage(file);}
        if(!v.alive||token!==generation||fetches.signal.aborted)throw new Error('cancelled');
        count++;progress.value=Math.round(count/files.length*95);detail.textContent='마을 그림을 준비하는 중이에요';loaded.push([file,image]);
      }}));
      if(!v.alive||token!==generation)return;
      detail.textContent='안전하게 걸을 수 있는 길을 찾는 중이에요';
      const nav=createVillageNavigation(candidate);const returned=candidate.buildings.find(b=>b.id===options.returnedFrom);
      const wanted=returned?{x:returned.entry.x,y:returned.entry.y+36}:candidate.spawn;
      const spawn=nav.stand(wanted)?wanted:nav.nearest(wanted,100);if(!spawn)throw new Error('spawn');
      const dogSpawn = [{x:spawn.x+27,y:spawn.y+28},{x:spawn.x-27,y:spawn.y+28},{x:spawn.x,y:spawn.y+40}]
        .find(point => nav.stand(point) && nav.segment(spawn,point)) ?? spawn;
      v.map=candidate;v.navigation=nav;v.images=new Map(loaded);v.actor={...spawn,direction:'down'};v.dog={...dogSpawn,direction:'down'};v.trail=[{...spawn}];
      fight.placeEncounters(candidate, nav, spawn);
      if(v.encounters.length) void loadImage(encounterAtlas).then(image=>{
        if(v.alive&&token===generation){v.images.set(encounterAtlas,image);v.draw();}
      }).catch(()=>{ /* Keep the encounter playable when optional artwork is unavailable. */ });
      v.entering=false;v.stopRoute();
      if (!options.adminUnlocked && context.save.mapFinalePending && canPlayMapFinale(context.save)) v.finaleAt=performance.now()+360;
      v.walkingTime=v.dogTime=v.revealTime=0;v.destination=null;acts.setupLabels();setupLights();loading.hidden=true;v.resize();v.updateNearby();
      if(revealStage){
        reveal.innerHTML=`<strong>${villageRewards[revealStage].changeTitle}</strong><span>도토리 박사: ${villageRewards[revealStage].afterLines[0]}</span>`;
        // The banner sits above the bottom bar; if the next lab's label is low, lean away from it.
        const goal=candidate.buildings.find(b=>b.id===story.next);
        const low=goal&&(goal.y+goal.height*.42)/candidate.height>.45;
        reveal.style.left=low?`${(goal.x+goal.width/2)/candidate.width<.5?57:43}%`:'';
        reveal.classList.remove('is-compact');reveal.hidden=false;hint.textContent=villageRewards[revealStage].changeDescription;playVoiceLine(`npc-dialogue/${revealStage}-return`);
      }
      else hint.textContent=story.complete?v.restHint():returned?`다시 마을이야! 불이 켜진 ${villageRewards[story.next!].name} 이름표를 누르면 걸어가요.`:'불이 켜진 건물 이름을 누르면 실험하러 걸어가요.';
      v.last=performance.now();if(v.encounters.length)v.updateEncounters(v.last);raf=requestAnimationFrame(tick);canvas.focus({preventScroll:true});
    } catch {
      if(!v.alive||token!==generation)return;fetches.abort();cancelImages.forEach(cancel=>cancel());
      loading.querySelector('strong')!.textContent='마을 그림을 불러오지 못했어요';detail.textContent='인터넷 연결을 확인하고 다시 불러와 주세요. 탐구 기록은 그대로예요.';progress.hidden=true;retry.hidden=false;retry.focus();
    }
  }
  view.bindCameraInput(acts.tapMap);
  window.addEventListener('keydown',event=>{
    if(!v.map||v.paused()||event.defaultPrevented||event.isComposing)return;const target=event.target as Element;
    if(event.ctrlKey||event.altKey||event.metaKey||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]'))return;
    const space=event.code==='Space'||event.key===' ';
    if(space&&v.nearbyEnemy&&!v.panView&&!v.overview&&(target===attack||!target.closest('button,a,summary,[role=button]'))){
      event.preventDefault();if(!event.repeat)fight.hitEnemy();return;
    }
    if (event.code === 'KeyX') { if (!event.repeat) fight.hitEnemy(); return; }
    if(input.press(event.key,event.code)){event.preventDefault();v.resumeFollow();v.stopRoute();v.updateNearby();canvas.focus({preventScroll:true});syncPadFeedback();}
    else if((event.key==='Enter'||event.key===' ')&&!event.repeat&&!target.closest('button,a,summary,[role=button]')){event.preventDefault();v.interact();}
  },{signal:events.signal});
  window.addEventListener('keyup',event=>{if(input.release(event.key,event.code)){event.preventDefault();syncPadFeedback();}},{signal:events.signal});
  window.addEventListener('blur',()=>{v.clearInput();view.releasePointers();},{signal:events.signal});
  document.addEventListener('visibilitychange',()=>{v.clearInput();v.last=performance.now();},{signal:events.signal});
  bindDirectionPad(pad, '[data-direction]', b=>b.dataset.direction as Direction, {
    signal:events.signal, blocked:()=>!v.map||v.paused(),
    press:direction=>{v.resumeFollow();canvas.focus({preventScroll:true});v.stopRoute();v.updateNearby();pads.set(-1,direction);const d=vectors[direction];move(d.x*6,d.y*6);syncPadFeedback();},
    release:()=>{pads.delete(-1);syncPadFeedback();},
    tap:direction=>{const d=vectors[direction];v.goTo({x:v.actor.x+d.x*32,y:v.actor.y+d.y*32});}
  });
  attack.addEventListener('pointerdown',()=>{
    v.focusBeforeAttack = document.activeElement instanceof HTMLElement && document.activeElement !== attack ? document.activeElement : null;
  },{signal:events.signal});
  attack.addEventListener('click', () => { if (attack.getAttribute('aria-disabled') !== 'true') fight.hitEnemy(); }, {signal:events.signal});
  action.addEventListener('click',acts.primary,{signal:events.signal});results.addEventListener('click',()=>context.navigate('complete'),{signal:events.signal});
  root.querySelector('#village-board-close')!.addEventListener('click',acts.closeBoard,{signal:events.signal});
  board.addEventListener('cancel',event=>{event.preventDefault();acts.closeBoard();},{signal:events.signal});
  root.querySelector('#village-dialog-close')!.addEventListener('click',v.closeDialogue,{signal:events.signal});
  dialog.addEventListener('cancel',event=>{event.preventDefault();v.closeDialogue();},{signal:events.signal});
  retry.addEventListener('click',()=>void loadWorld(),{signal:events.signal});
  reduced.addEventListener('change',()=>{if(reduced.matches)lights.querySelectorAll('.village-spark').forEach(spark=>spark.remove());v.draw();},{signal:events.signal});
  void loadWorld();
  return()=>{stopVoiceLine();v.cueTimers.forEach(id=>clearTimeout(id));v.cueTimers.clear();acts.destroyDialogue();v.alive=false;generation++;cancelAnimationFrame(raf);fetches.abort();cancelImages.forEach(cancel=>cancel());v.clearInput();events.abort();observer.disconnect();if(dialog.open)dialog.close();if(board.open)board.close();portrait.removeAttribute('style');art.clearTints();v.images.clear();v.metadata.clear();};
}
