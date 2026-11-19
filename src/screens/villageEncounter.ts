import { villainPatrol } from '../map-villain-patrol.js';
import { canPlayMapFinale } from '../map-villains.js';
import { attackRange, contactRange, encounterLines, facingToward, type Encounter } from '../villageEncounters';
import { revealRewardCard } from '../rewardCards';
import { voiceLinePending, voiceLinePlaying } from '../npcDialogueVoice';
import { distance, requesterSpots, stageIds, createVillageNavigation } from './villageMap';
import type { Point, VillageMap } from './villageMap';
import type { VillageScene } from './villageScene';

/** Wheel-lock villains on the map: where they stand, their patrol, the alert box and attack button, hits and the card. */
export function createVillageEncounters(v: VillageScene) {
  const { root, context, options, story, reduced, shell, canvas, hint, reveal, encounterHud, attack, encounterPips } = v;
  // The card timer shares the hit-sound timers, so leaving the map cancels both.
  const cueTimers = v.cueTimers;
  let lastEncounterLayout = -Infinity;
  let clearReady: number | null = null, clearUntil = 0, clearShown = false;
  let cardDue = false; // an achievement card is waiting to open or is open
  let studentTouching = false, dogTouching = false;
  function layoutEncounterHud(now: number) {
    if (encounterHud.hidden || now - lastEncounterLayout < 100) return;
    lastEncounterLayout = now;
    const bounds = shell.getBoundingClientRect(), w = shell.clientWidth, h = shell.clientHeight;
    const pw = encounterHud.offsetWidth, ph = encounterHud.offsetHeight;
    if (!w || !h || !pw || !ph) return;
    const sx = bounds.width/w, sy = bounds.height/h;
    const boxes = [...root.ownerDocument.querySelectorAll('button, a[href], .village-reveal, .village-hint')]
      .filter(el => !encounterHud.contains(el) && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden')
      .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height && r.right > bounds.left && r.left < bounds.right && r.bottom > bounds.top && r.top < bounds.bottom)
      .map(r => ({ l:(r.left-bounds.left)/sx-8, t:(r.top-bounds.top)/sy-8, r:(r.right-bounds.left)/sx+8, b:(r.bottom-bounds.top)/sy+8 }));
    const map = v.map;
    if (map) for (const p of [v.actor,v.dog,...map.npcs]) {
      const x = v.camera.x + p.x/map.width*v.frameWidth, y = v.camera.y + p.y/map.height*v.frameHeight;
      boxes.push({l:x-45,r:x+45,t:y-88,b:y+12});
    }
    const ideal = {x:Math.max(8,w-pw-18),y:Math.min(72,Math.max(8,h-ph-8))};
    const score = (x:number,y:number) => boxes.reduce((s,r) => s + Math.max(0,Math.min(x+pw,r.r)-Math.max(x,r.l))*Math.max(0,Math.min(y+ph,r.b)-Math.max(y,r.t)),0)*1000+Math.hypot(x-ideal.x,y-ideal.y);
    const best = {...ideal}; let cost = score(best.x,best.y);
    for (let y=8; y<=h-ph-8; y+=18) for (let i=0;i<=14;i++) {
      const x=8+Math.max(0,w-pw-16)*i/14, current=score(x,y);
      if(current<cost){cost=current;best.x=x;best.y=y;}
    }
    encounterHud.style.left=`${Math.round(best.x)}px`;
    encounterHud.style.top=`${Math.round(best.y)}px`;
    encounterHud.style.right='auto';
  }
  const hitCount = (enemy: Encounter) => context.save.mapVillains[enemy.index] ?? 0;
  function clearOfVillageResidents(point: Point) {
    const neighbors: Point[] = [...(v.map?.npcs ?? []), ...v.visibleClients().map(stage=>requesterSpots[stage])];
    // Feet can differ vertically while the visible character silhouettes still overlap.
    return neighbors.every(n=>Math.hypot((n.x-point.x)/48,(n.y-point.y)/60)>=1);
  }
  function updateEnemyPatrol(now: number, dt: number) {
    const navigation = v.navigation;
    if (reduced.matches || !navigation) return;
    for (const enemy of v.encounters) {
      if (hitCount(enemy)>=3 || now-enemy.hitAt<500 || now<enemy.clampUntil) continue;
      const p=villainPatrol(now,enemy.index);
      const large=distance(v.actor,enemy.home)>attackRange*.75;
      const xRadius=large?32:13;
      const goal={x:enemy.home.x+p.x*xRadius,y:enemy.home.y+p.y*xRadius*.25};
      const blend=1-Math.exp(-dt*7);
      const next={x:enemy.x+(goal.x-enemy.x)*blend,y:enemy.y+(goal.y-enemy.y)*blend};
      if (navigation.stand(next) && navigation.segment(enemy,next) && clearOfVillageResidents(next)) {enemy.x=next.x;enemy.y=next.y;}
      if (large) enemy.facing=p.direction<0?-1:1;
    }
  }
  function updateEncounters(now: number) {
    v.encounterClock = now;
    const previous = v.nearbyEnemy, actor = v.actor;
    let closest = attackRange + 1;
    v.nearbyEnemy = undefined;
    for (const enemy of v.encounters) {
      const d = distance(actor, enemy);
      if (hitCount(enemy) >= 3) continue;
      if (d<=attackRange && enemy.hitAt + 385 < now && enemy.clampUntil < now) enemy.facing = facingToward(enemy, actor, enemy.facing);
      if (d <= attackRange && d < closest && v.navigation!.segment(actor, enemy)) {
        v.nearbyEnemy = enemy; closest = d;
      }
    }
    const nearbyEnemy = v.nearbyEnemy, attackTarget = v.attackTarget;
    const fading = attackTarget && hitCount(attackTarget) === 3 && now - v.lastHitAt < 2400;
    if (v.finaleAt && now>=v.finaleAt && !v.paused() && !cardDue) { v.finaleAt=0; if (!options.adminUnlocked && canPlayMapFinale(context.save)) options.onFinale(); }
    const wasFocused = document.activeElement === attack;
    const isPaused = v.paused();
    attack.hidden = !(v.syncAttackDock() && !isPaused);
    const target = !v.panView && !v.overview && !isPaused ? nearbyEnemy : undefined;
    const locked = !target || now - v.lastHitAt < 290;
    const label = target ? `공격 · ${3-hitCount(target)}번 남음`
      : fading ? '공격 · 물리쳤어요!' : '공격 · 가까이 가요';
    if (attack.getAttribute('aria-label') !== label) {
      attack.setAttribute('aria-label', label);
      attack.title = target ? `${label} · 스페이스바` : label;
    }
    if (attack.getAttribute('aria-disabled') !== String(locked)) attack.setAttribute('aria-disabled', String(locked));
    if(attack.hidden && wasFocused && !v.paused()) (v.focusBeforeAttack?.isConnected ? v.focusBeforeAttack : canvas).focus({preventScroll:true});
    if(v.paused())clearReady=null;else clearReady??=now;
    if(options.newlyCompleted&&!options.adminUnlocked&&!clearShown&&clearReady!==null&&now-clearReady>=1250){clearShown=true;clearUntil=now+4200;if(v.encounters.some(e=>e.id===options.newlyCompleted))context.cue('villainAppear');}
    if(clearUntil>now&&!v.paused()&&options.newlyCompleted){
      encounterHud.hidden=false;encounterPips.hidden=true;
      v.villainSay(options.newlyCompleted, 0, '바퀴 잠금 악당 · “'+encounterLines[options.newlyCompleted][0]+'”');
      layoutEncounterHud(now);
      return;
    }
    encounterPips.hidden=false;
    const hudEnemy = nearbyEnemy ?? (fading ? attackTarget : undefined);
    const hidden = !hudEnemy || !!v.panView || v.overview || v.paused();
    encounterHud.hidden = hidden;
    if (!hudEnemy || hidden) return;
    if (hudEnemy !== previous && hudEnemy === nearbyEnemy) {
      v.villainSay(hudEnemy.id, hudEnemy.visits % 2, encounterLines[hudEnemy.id][hudEnemy.visits % 2]);
      hudEnemy.visits++;
    }
    const hits = hitCount(hudEnemy);
    if (encounterHud.dataset.stage !== hudEnemy.id || encounterHud.dataset.hits !== String(hits)) {
      encounterHud.dataset.stage = hudEnemy.id;
      encounterHud.dataset.hits = String(hits);
      encounterPips.setAttribute('aria-label', `남은 공격 ${3-hits}회`);
      Array.from(encounterPips.children).forEach((pip, index) => pip.classList.toggle('is-spent', index >= 3 - hits));
    }
    layoutEncounterHud(now);
  }
  function updateContact(now: number) {
    const { actor, dog } = v;
    const collision = (p: Point) => v.encounters.find(e => hitCount(e) < 3 && distance(e, p) <= contactRange);
    const nearStudent = collision(actor), nearDog = collision(dog);
    const hurtStudent = nearStudent && !studentTouching && now - v.studentHurt > 920;
    const hurtDog = nearDog && !dogTouching && now - v.dogHurt > 920;
    studentTouching = !!nearStudent; dogTouching = !!nearDog;
    if (now - v.lastHitAt < 385 || (!hurtStudent && !hurtDog)) return;
    if (hurtStudent) { v.studentHurt = now; v.studentHurtFacing = facingToward(actor, nearStudent, v.studentHurtFacing); }
    if (hurtDog) { v.dogHurt = now; v.dogHurtFacing = facingToward(dog, nearDog, v.dogHurtFacing); }
    if (hurtDog) { nearDog.clampUntil = now + 220; nearDog.facing = facingToward(nearDog, dog, nearDog.facing); }
    if (hurtStudent) { nearStudent.clampUntil = now + 220; nearStudent.facing = facingToward(nearStudent, actor, nearStudent.facing); }
    context.cue('hurt');
  }
  function hitEnemy() {
    if (!v.map || v.paused() || v.panView || v.overview) return;
    const now = performance.now();
    updateEncounters(now);
    const enemy = v.nearbyEnemy;
    if (!enemy || now - v.lastHitAt < 290) return;
    v.stopRoute(); v.clearInput();
    v.lastHitAt = enemy.hitAt = now;
    if (!reveal.hidden) reveal.classList.add('is-compact');
    v.attackTarget = enemy;
    v.studentAttackFacing = facingToward(v.actor, enemy, v.studentAttackFacing);
    enemy.facing = facingToward(enemy, v.actor, enemy.facing);
    const hits = hitCount(enemy) + 1;
    context.save.mapVillains[enemy.index] = hits;
    if (!options.adminUnlocked) {
      if (hits===3 && canPlayMapFinale(context.save)) {
        context.save.mapFinalePending=true;
        v.finaleAt=now+(reduced.matches ? 850 : 2300);
      }
      context.commit();
    }
    // The villain answers 300 ms after the hit sound (which lands 80 ms after the press).
    v.villainSay(enemy.id, hits + 1, encounterLines[enemy.id][hits+1], 380);
    if (hits===3 && story.complete) hint.textContent=v.restHint();
    context.cue('attack');
    v.cueLater(hits === 3 ? 'hit3' : hits === 2 ? 'hit2' : 'hit1', 80);
    if (hits === 3) v.cueLater('villainExit', 480);
    if (hits === 3) {
      // The card waits for the villain's exit, and for any open dialog. Opening it pauses the map; `cardDue` keeps the
      // finale behind the card even when a dialog closes in between.
      cardDue = true;
      const show = () => {
        cueTimers.delete(id);
        const map = v.map;
        if (!v.alive || !map) { cardDue = false; return; }
        // The card also waits for the villain's exit line to finish (at most 6 s after the hit).
        if (v.paused() || ((voiceLinePlaying() || voiceLinePending()) && performance.now() - now < 6000)) { id = window.setTimeout(show, v.paused() ? 300 : 150); cueTimers.add(id); return; }
        const bounds = canvas.getBoundingClientRect();
        void revealRewardCard(enemy.index, { x: bounds.left + enemy.x / map.width * bounds.width, y: bounds.top + (enemy.y - 30) / map.height * bounds.height }, context.save).finally(() => { cardDue = false; });
      };
      let id = window.setTimeout(show, reduced.matches ? 520 : 760);
      cueTimers.add(id);
    }
    updateEncounters(now);
    v.draw();
  }
  /** One villain per restored building that still has hits left, beside its door and clear of residents and each other. */
  function placeEncounters(candidate: VillageMap, nav: ReturnType<typeof createVillageNavigation>, spawn: Point) {
    const used: Point[] = [];
    const offsets = [[-42,48],[42,48],[-54,24],[54,24],[-30,65],[30,65],[0,65],[-77,50],[77,50]];
    v.encounterClock=performance.now();
    v.encounters=candidate.buildings.flatMap(building=>{
      if(!context.save.completed.includes(building.id))return [];
      const index=stageIds.indexOf(building.id);
      if(context.save.mapVillains[index]>=3)return [];
      const home={x:building.entry.x,y:building.entry.y+36};
      const exit=nav.stand(home)?home:nav.nearest(home,100);
      const spots=offsets.map(([dx,dy])=>nav.nearest({x:building.entry.x+dx,y:building.entry.y+dy},24))
        .filter((p): p is Point => !!p && distance(p,building.entry)>34 && distance(p,home)<100 && clearOfVillageResidents(p) &&
          used.every(q=>distance(p,q)>100));
      const point=spots.find(p=>exit && nav.segment(exit,p)) ?? spots.find(p=>nav.route(spawn,p));
      if(!point)return [];
      used.push(point);
      return [{...point,home:{...point},id:building.id,index,facing:facingToward(point,v.actor,-1),hitAt:-Infinity,clampUntil:0,visits:0,appearedAt:v.encounterClock}];
    });
  }
  return { hitCount, clearOfVillageResidents, updateEnemyPatrol, updateEncounters, updateContact, hitEnemy, placeEncounters };
}
