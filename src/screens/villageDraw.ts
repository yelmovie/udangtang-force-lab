import { villainPatrol } from '../map-villain-patrol.js';
import type { StageId } from '../data';
import { drawEncounterFrame, drawStageProp, drawWrenchSparks, encounterAtlas, type Encounter } from '../villageEncounters';
import { villageRequests, type RequestStage } from '../requestBoard';
import { directions, mapCharacterHeight, requestBoardSpot, requesterSpots, villageLights } from './villageMap';
import type { Building, Point } from './villageMap';
import type { VillageScene } from './villageScene';

/** The map canvas: terrain, buildings, rewards, residents, villains, the student and the corgi, then the dusk fog. */
export function createVillageRenderer(v: VillageScene) {
  const { ctx, canvas, story, reduced } = v;
  // Fog is smooth, so it renders at quarter resolution: a cached static layer plus the walker's own light.
  const fogScale = .25, fogCanvas = document.createElement('canvas'), fogBase = document.createElement('canvas');
  const fogCtx = fogCanvas.getContext('2d')!, fogBaseCtx = fogBase.getContext('2d')!;
  let fogKey = '';
  const tinted = new Map<RequestStage, HTMLCanvasElement>();
  function pivot(file: string, image: HTMLImageElement) { return v.metadata.get(file)?.pivot ?? { x:image.naturalWidth/2,y:image.naturalHeight }; }
  function visibleHeight(file: string) { return v.metadata.get(file)?.alphaBounds?.height || v.images.get(file)?.naturalHeight || 1; }
  function npcHeight() {
    const studentFamilyHeight = Math.max(...directions.flatMap(direction => [1, 2, 3, 4].map(i => visibleHeight(`student/${direction}-${i}.webp`))));
    return mapCharacterHeight * visibleHeight('student/down-1.webp') / studentFamilyHeight;
  }
  // Cache the transparent outline per pose and rounded display scale, never on the map itself.
  const outlinedSprites = new Map<string,HTMLCanvasElement>();
  let outlineRatio = 0;
  function outlinedSprite(file: string, image: HTMLImageElement, width: number, height: number) {
    const ratio=Math.max(.25,Math.round(ctx.getTransform().a/Math.min(devicePixelRatio||1,1.5)*8)/8);
    if(ratio!==outlineRatio){outlinedSprites.clear();outlineRatio=ratio;}
    const key=`${file}:${width}:${height}`;let art=outlinedSprites.get(key);
    if(!art){
      const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
      art=document.createElement('canvas');art.width=w+8;art.height=h+8;
      const ink=art.getContext('2d')!;ink.imageSmoothingEnabled=false;
      for(const [x,y] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,1],[1,-1],[-1,1]])ink.drawImage(image,4+x,4+y,w,h);
      ink.globalCompositeOperation='source-in';ink.fillStyle='#fff4d2';ink.fillRect(0,0,art.width,art.height);ink.globalCompositeOperation='source-over';
      ink.shadowColor='#23392a66';ink.shadowOffsetY=2;ink.shadowBlur=2;ink.drawImage(image,4,4,w,h);
      outlinedSprites.set(key,art);
    }
    return {art,pad:4/ratio};
  }
  function sprite(file: string, p: Point, height: number, familyHeight?: number, outline=false) {
    const image = v.images.get(file); if(!image)return;
    const scale = height/(familyHeight||visibleHeight(file)), anchor=pivot(file,image);
    const x=Math.round(p.x-anchor.x*scale),y=Math.round(p.y-anchor.y*scale),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
    if(outline){const {art,pad}=outlinedSprite(file,image,w,h);ctx.drawImage(art,x-pad,y-pad,w+2*pad,h+2*pad);}
    else ctx.drawImage(image,x,y,w,h);
  }
  function rewardPoint(id: StageId): Point { return id==='rescue'?{x:838,y:243}:id==='balance'?{x:1183,y:282}:id==='cargo'?{x:455,y:374}:id==='scale'?{x:574,y:735}:{x:1344,y:732}; }
  // Light glows live in the SVG overlay (setupLights); the canvas keeps only the reward props.
  function drawRewards(id: StageId, alpha: number) {
    ctx.save();ctx.globalAlpha=alpha;
    if(id==='cargo'){sprite('props/prop-01.webp',{x:455,y:374},70);sprite('props/prop-01.webp',{x:504,y:389},55);ctx.fillStyle='#f8db74';ctx.fillRect(382,389,65,6);}
    if(id==='scale'){sprite('props/prop-05.webp',{x:576,y:735},60);sprite('props/prop-04.webp',{x:613,y:755},39);}
    if(id==='workshop'){sprite('props/prop-11.webp',{x:1344,y:732},50);sprite('props/prop-09.webp',{x:1540,y:738},40);sprite('props/prop-10.webp',{x:1540,y:703},16);}
    if(id==='rescue'){sprite('props/prop-12.webp',{x:838,y:243},55);}
    ctx.restore();
  }
  function clientFilter(stage: RequestStage) { const { hue } = villageRequests[stage]; return hue ? `hue-rotate(${hue}deg) saturate(1.2)` : 'none'; }
  /** The doctor's pose recoloured once per client (canvas filter; browsers without it keep the pose). */
  function tintedClient(stage: RequestStage) {
    const cached = tinted.get(stage); if (cached) return cached;
    const image = v.images.get(`npc/${villageRequests[stage].pose}.webp`); if (!image) return undefined;
    const sheet = document.createElement('canvas'); sheet.width = image.naturalWidth; sheet.height = image.naturalHeight;
    const paint = sheet.getContext('2d')!; paint.filter = clientFilter(stage); paint.drawImage(image, 0, 0);
    tinted.set(stage, sheet); return sheet;
  }
  /** Where a solved client is now: walking out of the door during the arrival, else at their spot. */
  function clientAt(stage: RequestStage): (Point & { alpha: number }) | null {
    const spot = requesterSpots[stage];
    if (v.arrivalShown || !v.arriving.includes(stage)) return { ...spot, alpha: 1 };
    const t = (v.revealTime - v.arrivalStart) / v.arrivalTime; if (t < 0) return null;
    const door = v.map?.buildings.find(b => b.id === stage)?.entry ?? spot, ease = 1 - (1 - Math.min(1, t)) ** 2;
    return { x: door.x + (spot.x - door.x) * ease, y: door.y + (spot.y - door.y) * ease, alpha: Math.min(1, t * 3) };
  }
  function visibleClients() { return v.solved.filter(stage => v.arrivalShown || !v.arriving.includes(stage)); }
  function drawClient(stage: RequestStage, p: Point & { alpha: number }) {
    const file = `npc/${villageRequests[stage].pose}.webp`, image = v.images.get(file), sheet = tintedClient(stage); if (!image || !sheet) return;
    const scale = npcHeight() / visibleHeight(file), anchor = pivot(file, image);
    ctx.save(); ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#1d362c55'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sheet, Math.round(p.x - anchor.x * scale), Math.round(p.y - anchor.y * scale), Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    ctx.restore();
  }
  /** Generated pixel-art notice board; each paper note on its cork panel shows a request: grey locked, cream open, green solved. */
  function drawBoard() {
    const { x, y } = requestBoardSpot, image = v.images.get('props/request-board.webp');
    ctx.fillStyle = '#1d362c55'; ctx.beginPath(); ctx.ellipse(x, y, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (!image) return;
    // Cork panel measured on the source art (fractions of the cropped image).
    const h = 112, w = h * image.naturalWidth / image.naturalHeight, left = x - w / 2, top = y - h;
    ctx.drawImage(image, Math.round(left), Math.round(top), Math.round(w), h);
    const corkX = left + w * .231, corkW = w * .447, corkY = top + h * .371, corkH = h * .31;
    const nw = corkW / 4 - 2, nh = Math.min(corkH - 7, nw * 1.35);
    v.cards.forEach((card, i) => {
      const nx = Math.round(corkX + 1 + i * (nw + 2)), ny = Math.round(corkY + 4 + (i % 2) * 3);
      ctx.fillStyle = '#3b2a1a55'; ctx.fillRect(nx + 1, ny + 1, nw, nh);
      ctx.fillStyle = card.status === 'solved' ? '#cfeebb' : card.status === 'open' ? '#fff6d8' : '#cbc5b3'; ctx.fillRect(nx, ny, nw, nh);
      ctx.fillStyle = ['#d9534f', '#3f7fd0', '#e0a21b', '#8c5bc0'][i]; ctx.fillRect(nx + nw / 2 - 1.5, ny - 2, 3, 3);
      if (card.status === 'solved') { ctx.strokeStyle = '#2f7a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx + nw * .2, ny + nh * .5); ctx.lineTo(nx + nw * .42, ny + nh * .72); ctx.lineTo(nx + nw * .82, ny + nh * .25); ctx.stroke(); }
      else { ctx.fillStyle = '#8b7a5c'; ctx.fillRect(nx + 2, ny + nh * .35, nw - 4, 2); ctx.fillRect(nx + 2, ny + nh * .62, nw - 6, 2); }
    });
  }
  /** 0→1 while the newly restored building's light travels to the core; 1 when nothing plays. */
  function revealProgress() { return v.revealStage && !reduced.matches ? Math.min(1, v.revealTime / v.revealEnd) : 1; }
  function clearAround(target: CanvasRenderingContext2D, point: Point, radius: number) {
    const light = target.createRadialGradient(point.x,point.y,Math.min(20,radius*.3),point.x,point.y,radius);
    light.addColorStop(0,'rgba(0,0,0,1)'); light.addColorStop(.55,'rgba(0,0,0,.85)'); light.addColorStop(1,'rgba(0,0,0,0)');
    target.fillStyle=light;target.fillRect(point.x-radius,point.y-radius,radius*2,radius*2);
  }
  function drawVillageLight() {
    const map = v.map; if (!map) return;
    // Each restored building lifts the dusk a step; the newest step fades in with its reveal.
    const progress = revealProgress(), level = story.count - (v.revealStage ? 1 - progress : 0);
    const darkness = .46 * (1 - level / 5);
    if (darkness < .005) return;
    const width = Math.ceil(map.width * fogScale), height = Math.ceil(map.height * fogScale);
    if (fogBase.width !== width || fogBase.height !== height) { fogBase.width = fogCanvas.width = width; fogBase.height = fogCanvas.height = height; fogKey = ''; }
    const key = `${darkness.toFixed(3)}|${progress.toFixed(2)}`;
    if (key !== fogKey) {
      fogKey = key;
      fogBaseCtx.setTransform(fogScale,0,0,fogScale,0,0);
      fogBaseCtx.globalCompositeOperation = 'source-over';
      fogBaseCtx.clearRect(0,0,map.width,map.height);
      fogBaseCtx.fillStyle = `rgba(9,31,42,${darkness})`;
      fogBaseCtx.fillRect(0,0,map.width,map.height);
      fogBaseCtx.globalCompositeOperation = 'destination-out';
      clearAround(fogBaseCtx, { x: requestBoardSpot.x, y: requestBoardSpot.y - 45 }, 110);
      for (const id of story.changes) {
        const grow = id === v.revealStage ? progress : 1;
        clearAround(fogBaseCtx, rewardPoint(id), Math.max(25, 260 * grow));
        for (const light of villageLights[id]) clearAround(fogBaseCtx, light, Math.max(12, light.r * 2.2 * grow));
      }
      fogBaseCtx.globalCompositeOperation = 'source-over';
    }
    fogCtx.setTransform(1,0,0,1,0,0);fogCtx.clearRect(0,0,width,height);fogCtx.drawImage(fogBase,0,0);
    fogCtx.setTransform(fogScale,0,0,fogScale,0,0);fogCtx.globalCompositeOperation='destination-out';clearAround(fogCtx,v.actor,125);fogCtx.globalCompositeOperation='source-over';
    ctx.imageSmoothingEnabled=true;ctx.drawImage(fogCanvas,0,0,map.width,map.height);ctx.imageSmoothingEnabled=false;
  }
  const sleepingFacades = new Map<string, HTMLCanvasElement>();
  function drawFacade(building: Building) {
    const art=v.images.get(building.asset)!;
    if(story.complete && !v.revealStage){ctx.drawImage(art,building.x,building.y,building.width,building.height);return;}
    let sleeping=sleepingFacades.get(building.asset);
    if(!sleeping){
      sleeping=document.createElement('canvas');sleeping.width=art.naturalWidth;sleeping.height=art.naturalHeight;
      const brush=sleeping.getContext('2d')!;
      brush.filter='grayscale(.55) saturate(.54) brightness(.83)';brush.drawImage(art,0,0);
      sleepingFacades.set(building.asset,sleeping);
    }
    const amount=!story.changes.includes(building.id)?0:building.id===v.revealStage?revealProgress():1;
    const rect=[building.x,building.y,building.width,building.height] as const;
    if(amount<1)ctx.drawImage(sleeping,...rect);
    if(amount>0){ctx.save();ctx.globalAlpha=amount;ctx.drawImage(art,...rect);ctx.restore();}
  }
  const canSeeEnemy = (enemy: Encounter) => v.hitCount(enemy) < 3 || v.encounterClock - enemy.hitAt < (reduced.matches ? 300 : 620);
  function draw(moving = false, dogMoving = false) {
    const map = v.map, images = v.images, { actor, dog, dialog, portrait } = v;
    if(!v.alive||!map||!images.has('terrain.webp'))return;
    v.follow();
    ctx.setTransform(canvas.width/map.width,0,0,canvas.height/map.height,0,0);ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,map.width,map.height);ctx.drawImage(images.get('terrain.webp')!,0,0,map.width,map.height);
    const destination = v.destination;
    if(destination){ctx.strokeStyle='#fff5b1';ctx.lineWidth=4;ctx.setLineDash([5,5]);ctx.beginPath();ctx.ellipse(destination.x,destination.y,15,8,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    for(const building of map.buildings){if(story.next===building.id){ctx.fillStyle='#ffe68799';ctx.beginPath();ctx.ellipse(building.entry.x,building.entry.y+8,26,11,0,0,Math.PI*2);ctx.fill();}}
    const layers:{y:number;draw:()=>void}[]=map.buildings.map(building=>({y:building.y+(v.metadata.get(building.asset)?.pivot?.y??images.get(building.asset)!.naturalHeight)/images.get(building.asset)!.naturalHeight*building.height,draw:()=>drawFacade(building)}));
    for(const id of story.changes){const p=rewardPoint(id),building=map.buildings.find(b=>b.id===id);const depth=id==='balance'?p.y:Math.max(p.y,(building?.y??0)+(building?.height??0)+1);layers.push({y:depth,draw:()=>drawRewards(id,id===v.revealStage&&!reduced.matches?Math.min(1,v.revealTime/1.1):1)});}
    for(const npc of map.npcs)if(!dialog.open||portrait.dataset.portrait!=='guide')layers.push({y:npc.y,draw:()=>{ctx.save();ctx.translate(npc.x*2,0);ctx.scale(-1,1);sprite(npc.asset,npc,npcHeight());ctx.restore();}});
    layers.push({y:requestBoardSpot.y,draw:drawBoard});
    for(const stage of v.solved){const at=clientAt(stage);if(at&&(!dialog.open||portrait.dataset.portrait!==villageRequests[stage].pose))layers.push({y:at.y,draw:()=>drawClient(stage,at)});}
    const studentHeight=Math.max(...directions.flatMap(direction=>[1,2,3,4].map(i=>visibleHeight(`student/${direction}-${i}.webp`))));
    const corgiHeight=Math.max(...directions.flatMap(direction=>[1,2,3,4].map(i=>visibleHeight(`corgi/${direction}-${i}.webp`))));
    const studentFrame=moving&&!reduced.matches?Math.floor(v.walkingTime*8)%4+1:1, dogFrame=dogMoving&&!reduced.matches?Math.floor(v.dogTime*8)%4+1:1;
    const atlas = images.get(encounterAtlas), now = v.encounterClock;
    for (const enemy of v.encounters) {
      if (!canSeeEnemy(enemy)) continue;
      const hits = v.hitCount(enemy), age = now - enemy.hitAt;
      layers.push({y:enemy.y,draw:()=>{
        ctx.save();
        if (hits !== 3) drawStageProp(ctx, enemy, now, reduced.matches);
        const patrol=villainPatrol(now,enemy.index);
        const pose = hits === 3 ? 4 : age >= 80 && age < 310 ? hits === 1 ? 2 : 3 : now < enemy.clampUntil || (!reduced.matches && (patrol.step==='showoff'||Math.floor(now/220)%2===1)) ? 1 : 0;
        const travel = hits === 3 && !reduced.matches ? Math.max(0, age - 80) / 540 : 0;
        ctx.globalAlpha = hits === 3 ? Math.max(0, 1-travel) : 1;
        const bounce=hits<3&&age>=400&&now>=enemy.clampUntil&&!reduced.matches?-Math.abs(Math.sin(now/(patrol.step==='showoff'?73:110)))*(patrol.step==='showoff'?7:3):0;
        if (atlas) drawEncounterFrame(ctx, atlas, 2, pose, enemy, enemy.facing, 73, -enemy.facing * 34 * travel,bounce);
        else {
          ctx.fillStyle='#bb592f';ctx.strokeStyle='#633724';ctx.lineWidth=2;
          ctx.fillRect(enemy.x-14,enemy.y-30,28,26);ctx.strokeRect(enemy.x-14,enemy.y-30,28,26);
          ctx.fillStyle='#fff0b5';ctx.fillRect(enemy.x+enemy.facing*3-3,enemy.y-23,6,5);
        }
        ctx.restore();
        if (!reduced.matches) drawWrenchSparks(ctx, enemy, hits, age);
      }});
    }
    layers.push({y:dog.y,draw:()=>{
      const age = now - v.dogHurt;
      if (atlas && age < 365) {
        const pose = age < 75 ? 0 : age < 150 ? 1 : age < 215 ? 2 : age < 290 ? 3 : 4;
        drawEncounterFrame(ctx,atlas,1,reduced.matches?3:pose,dog,v.dogHurtFacing,54,0,reduced.matches?0:-(pose===2?6:0));
      } else sprite(`corgi/${dog.direction}-${dogFrame}.webp`,dog,43,corgiHeight,true);}});
    layers.push({y:actor.y,draw:()=>{ctx.fillStyle='#1d362c55';ctx.beginPath();ctx.ellipse(actor.x,actor.y,17,7,0,0,Math.PI*2);ctx.fill();const swing = now-v.lastHitAt, hurt = now-v.studentHurt;
      if (atlas && swing < 345) drawEncounterFrame(ctx,atlas,0,reduced.matches?2:swing < 80 ? 0 : swing < 155 ? 1 : swing < 245 ? 2 : 4,actor,v.studentAttackFacing,mapCharacterHeight/.82);
      else if (atlas && hurt < 350) drawEncounterFrame(ctx,atlas,0,hurt < 225 || reduced.matches ? 3 : 4,actor,v.studentHurtFacing,mapCharacterHeight/.82,reduced.matches?0:-v.studentHurtFacing*5*Math.sin(Math.PI*hurt/350));
      else sprite(`student/${actor.direction}-${studentFrame}.webp`,actor,mapCharacterHeight,studentHeight,true);}});
    layers.sort((a,b)=>a.y-b.y).forEach(layer=>layer.draw());
    drawVillageLight();
    const revealStage = v.revealStage, revealTime = v.revealTime;
    if(revealStage && revealTime<2.4 && !reduced.matches){const p=rewardPoint(revealStage);ctx.save();ctx.globalAlpha=Math.max(0,1-revealTime/2.4);ctx.strokeStyle='#fff4b4';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,p.y-22,20+revealTime*48,12+revealTime*23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  return {
    draw, npcHeight, clientFilter, visibleClients,
    /** loadWorld starts the grey facades again; leaving the map drops the tinted clients. */
    clearFacades: () => sleepingFacades.clear(), clearTints: () => tinted.clear(),
  };
}
