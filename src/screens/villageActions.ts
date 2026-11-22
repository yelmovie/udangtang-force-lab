import { defeatedMapVillains } from '../map-villains.js';
import { icons } from '../icons';
import { stageIsOpen } from '../state';
import { villageRewards } from '../villageStory';
import { mountDialogueText } from '../npcDialogue';
import { mountDialogueVoice, setDialoguePortrait } from '../npcDialogueVoice';
import { requestThanks, villageRequests, type RequestStage } from '../requestBoard';
import { distance, requestBoardSpot, requesterSpots, stageIds, withDirectionParticle } from './villageMap';
import type { Building, Point } from './villageMap';
import type { Talk, VillageScene } from './villageScene';

/** What the student does on the map: walk a route, talk to the doctor and clients, read the request board,
 * enter a building, and the hint and next-place button that follow where they stand. */
export function createVillageActions(v: VillageScene) {
  const { root, context, options, story, canvas, labels, hint, action, dialog, portrait, nextLine, board, cards, solved, arriving, boardAvailable } = v;
  const voice = mountDialogueVoice(dialog, () => context.save);
  const dialogueText = mountDialogueText(dialog, nextLine, () => closeDialogue());
  function stopRoute() { v.path=[]; v.destination=null; v.guided=undefined; }
  function updateNearby() {
    const map = v.map, actor = v.actor;
    if(!map)return;
    v.nearestBuilding=map.buildings.filter(building=>distance(actor,building.entry)<=building.entry.radius+11).sort((a,b)=>distance(actor,a.entry)-distance(actor,b.entry))[0];
    v.nearestNpc=map.npcs.filter(npc=>distance(actor,npc)<=120).sort((a,b)=>distance(actor,a)-distance(actor,b))[0];
    v.nearestClient=v.nearestNpc?undefined:v.visibleClients().filter(stage=>distance(actor,requesterSpots[stage])<=48).sort((a,b)=>distance(actor,requesterSpots[a])-distance(actor,requesterSpots[b]))[0];
    v.nearBoard=boardAvailable&&!v.nearestNpc&&!v.nearestClient&&distance(actor,requestBoardSpot)<=80;
    const guided = v.guided;
    action.hidden=!story.next;
    action.disabled=!!guided||!story.next;
    if(guided) action.setAttribute('aria-busy','true');
    else action.removeAttribute('aria-busy');
    const guide=!!story.next&&!guided;
    const next=guided?'길을 따라가는 중…':story.next?`${withDirectionParticle(villageRewards[story.next].name)} 가기`:'';
    if(action.firstChild?.textContent!==next)action.replaceChildren(document.createTextNode(next));
    if(guide&&!action.querySelector('svg'))action.insertAdjacentHTML('beforeend','<svg class="map-direction-cue" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>');
    if(!guide)action.querySelector('svg')?.remove();
    action.classList.toggle('map-next-cue',guide);
    for(const bubble of labels.querySelectorAll<HTMLButtonElement>('[data-near-npc]'))bubble.hidden=!!guided||dialog.open||board.open||v.nearestNpc?.name!==bubble.dataset.nearNpc;
    for(const bubble of labels.querySelectorAll<HTMLButtonElement>('.village-client-bubble[data-client]'))bubble.hidden=!!guided||v.nearestClient!==bubble.dataset.client;
    const boardLabel=labels.querySelector<HTMLButtonElement>('.village-board-label');if(boardLabel)boardLabel.hidden=!!guided||!v.nearBoard;
  }
  function restHint() {
    if(v.nearestNpc)return `${v.nearestNpc.name} 곁이야. 말풍선을 누르면 이야기를 들을 수 있어!`;
    if(v.nearestClient)return `${villageRequests[v.nearestClient].client} 곁이야. 말풍선을 누르면 인사를 들을 수 있어!`;
    if(v.nearBoard)return '의뢰 게시판이야. 게시판을 눌러 마을 사람들의 부탁을 확인해 봐!';
    if(!story.next) {
      const n=defeatedMapVillains(context.save);
      return n>=5?'마을에 불이 모두 켜졌어! 「내 발견 모아 보기」를 눌러 봐.':`악당 ${n}/5 퇴치 · 악당을 물리치면 성취 카드를 받아!`;
    }
    return `다음 목적지는 ${villageRewards[story.next].name}! 불이 켜진 이름표를 누르면 걸어가요.`;
  }
  function goTo(target: Point, name?: string, building?: Building) {
    const navigation = v.navigation;
    if(!navigation||v.paused())return;
    stopRoute();v.resumeFollow();
    if (building && explainLockedBuilding(building)) return;
    const next=navigation.route(v.actor,target);
    if(!next){hint.textContent='그곳까지 갈 길이 없어. 흙길이나 다리를 눌러 봐!';updateNearby();v.draw();return;}
    v.clearInput();v.guided=building;v.path=next;v.destination=next.at(-1)??null;updateNearby();hint.textContent=name?`${name} 앞까지 길을 따라 걸어갈게.`:'길을 따라가는 중… 방향판을 누르면 직접 걸을 수 있어.';canvas.focus();v.draw();
  }
  function setupLabels() {
    const map = v.map!, signal = v.events;
    labels.replaceChildren();
    for(const building of map.buildings){const button=document.createElement('button');button.className='village-building-label';button.dataset.stage=building.id;button.style.left=`${(building.x+building.width/2)/map.width*100}%`;button.style.top=`max(${(building.y+building.height*0.42)/map.height*100}%, var(--label-floor, 0px))`;const name=document.createElement('span');const open=options.adminUnlocked||stageIsOpen(context.save,building.id);name.textContent=villageRewards[building.id].name;button.innerHTML=`<svg class="map-lock-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="${open?'M8 11V7a4 4 0 0 1 7.5-2':'M8 11V7a4 4 0 0 1 8 0v4'}"/></svg>`;button.append(name);button.classList.toggle('is-current',story.next===building.id);button.classList.toggle('is-complete',story.changes.includes(building.id));button.classList.toggle('is-locked',!options.adminUnlocked&&!stageIsOpen(context.save,building.id));button.setAttribute('aria-label',`${villageRewards[building.id].name} 문 앞으로 걷기 · ${open?'열림':'잠김'}`);button.addEventListener('click',()=>goTo(building.entry,villageRewards[building.id].name,building),{signal});labels.append(button);}
    for(const npc of map.npcs){const bubble=document.createElement('button');
      bubble.className='village-client-bubble';
      bubble.dataset.nearNpc=npc.name;
      bubble.hidden=true;
      bubble.style.left=`${(npc.x-30)/map.width*100}%`;
      bubble.style.top=`${(npc.y-82)/map.height*100}%`;
      bubble.innerHTML=icons.speech;
      bubble.setAttribute('aria-label',`${npc.name}와 이야기`);
      bubble.addEventListener('click',interact,{signal});
      labels.append(bubble);}
    const open=cards.filter(card=>card.status==='open').length;
    const boardLabel=document.createElement('button');boardLabel.className='village-board-label';boardLabel.style.left=`${requestBoardSpot.x/map.width*100}%`;boardLabel.style.top=`${(requestBoardSpot.y+6)/map.height*100}%`;
    boardLabel.textContent='의뢰 게시판';if(open){const count=document.createElement('span');count.className='village-board-count';count.textContent=String(open);boardLabel.append(count);}
    boardLabel.setAttribute('aria-label',`의뢰 게시판 열기${open?`, 도와줄 수 있는 의뢰 ${open}개`:''}`);boardLabel.addEventListener('click',openBoard,{signal});labels.append(boardLabel);
    for(const stage of solved){const {bubble}=requesterSpots[stage],button=document.createElement('button');
      button.className='village-client-bubble';
      button.dataset.client=stage;
      button.style.left=`${bubble.x/map.width*100}%`;
      button.style.top=`${bubble.y/map.height*100}%`;
      button.innerHTML=icons.speech;
      button.setAttribute('aria-label',`${villageRequests[stage].client}의 인사 듣기`);
      button.classList.toggle('is-waiting',!v.arrivalShown&&arriving.includes(stage));
      button.addEventListener('click',()=>openClient(stage),{signal});
      labels.append(button);}
  }
  function openBoard() {
    if(!v.map||v.paused()||!boardAvailable)return;
    v.clearInput();stopRoute();updateNearby();
    board.querySelector('.village-board-lead')!.textContent='마을 사람들의 부탁(의뢰)이에요. 실험 1단계를 마치면 그 건물에서 받을 수 있어요.';
    const list=board.querySelector('.village-board-cards')!;list.replaceChildren();
    for(const card of cards){
      const item=document.createElement('li');item.className=`village-board-card is-${card.status}`;
      const face=document.createElement('img');face.className='village-board-portrait';face.alt='';face.src=v.assetURL(`npc/${card.pose}.webp`);
      const text=document.createElement('div');text.className='village-board-text';
      const locked=card.status==='locked';
      // Inline filters would override the CSS silhouette, so only tint an unlocked fallback pose.
      if(!locked&&villageRequests[card.stage].hue)face.style.filter=v.clientFilter(card.stage);
      // A locked request keeps its client a secret: a dark silhouette with a question mark until level 1 is done.
      if(locked){face.classList.add('is-mystery');const mark=document.createElement('span');mark.className='village-board-mark';mark.textContent='?';mark.setAttribute('aria-hidden','true');item.append(mark);}
      const from=document.createElement('strong');from.textContent=locked?`??? · ${villageRewards[card.stage].name}`:`${card.client} · ${villageRewards[card.stage].name}`;
      const quote=document.createElement('p');quote.textContent=locked?'누가 부탁할지는 아직 비밀이에요.':`“${card.quote}”`;
      const status=document.createElement('span');status.className='village-board-status';status.textContent=card.statusText;
      text.append(from,quote,status);
      const go=document.createElement('button');go.textContent=`${withDirectionParticle(villageRewards[card.stage].name)} 가기`;
      go.addEventListener('click',()=>{const building=v.map?.buildings.find(b=>b.id===card.stage);board.close();v.last=performance.now();if(building)goTo(building.entry,villageRewards[card.stage].name,building);});
      item.append(face,text,go);list.append(item);
    }
    board.showModal();board.querySelector<HTMLButtonElement>('.village-board-card button')?.focus();v.draw();
  }
  function closeBoard() { if(!board.open)return;board.close();v.clearInput();canvas.focus();v.last=performance.now();v.draw(); }
  function openClient(stage: RequestStage) {
    const request=villageRequests[stage];
    openTalk({name:request.client,role:`${villageRewards[stage].name} 의뢰인`,text:requestThanks(context.save,stage),portrait:request.pose,voice:`npc-dialogue/${stage}-thanks`,done:'또 도울게요!'});
  }
  function primary() {
    const map = v.map;
    if(!map||v.paused()||v.guided)return;
    const goal=map.buildings.find(b=>b.id===story.next);
    if(goal)goTo(goal.entry,villageRewards[goal.id].name,goal);
  }
  function openTalk(next: Talk) {
    if (!v.map || v.paused()) return;
    stopRoute();v.clearInput();updateNearby();
    root.querySelector('#village-dialog-title')!.textContent = next.name;
    root.querySelector('#village-dialog-role')!.textContent = next.role;
    setDialoguePortrait(portrait, next.portrait);
    dialog.showModal();
    dialogueText.show(next.text, next.done, true);
    voice.show(next.voice);
    nextLine.focus(); v.draw();
  }
  function closeDialogue() {
    if (!dialog.open) return;
    dialogueText.finish(); voice.stop(); dialog.close(); v.clearInput();
    canvas.focus(); v.last = performance.now(); v.draw();
  }
  function explainLockedBuilding(building: Building) {
    if (options.adminUnlocked || stageIsOpen(context.save, building.id)) return false;
    const mission = story.next ? villageRewards[story.next].name : '열린 실험실';
    const message = `먼저 ${mission} 미션을 끝내고 와 줘! 실험과 의뢰를 마치고 복구하면 다음 건물에 들어갈 수 있어.`;
    hint.textContent = message;
    openTalk({ name: v.map?.npcs[0]?.name ?? '마을 안내원', role: `${villageRewards[building.id].name} 입장 안내`, text: message, portrait: 'guide', voice: story.next ? `npc-dialogue/locked-${story.next}` : undefined, done: '미션을 끝내고 올게요!' });
    return true;
  }
  function enterBuilding(building: Building) {
    if (v.entering || !v.alive || v.paused()) return false;
    if (explainLockedBuilding(building)) return false;
    v.entering = true;
    v.clearInput();stopRoute();
    context.navigate(building.id);
    return true;
  }
  function interact() {
    if(!v.map||v.paused())return;updateNearby();
    const nearestNpc = v.nearestNpc;
    if(nearestNpc){
      const ordered = story.changes.every((stage, index) => stage === stageIds[index]);
      openTalk({name:nearestNpc.name,role:'마을의 안내원',text:story.lines.join(' '),portrait:'guide',voice:ordered ? `npc-dialogue/guide-${story.next ?? 'complete'}` : undefined,done:'탐구하러 갈게요!'});return;
    }
    if(v.nearestClient){openClient(v.nearestClient);return;}
    if(v.nearBoard){openBoard();return;}
    if(!v.nearestBuilding)return;
    enterBuilding(v.nearestBuilding);
  }
  /** A tap on the canvas (map pixels): the board, a client, a villain, the doctor, a building, else the ground. */
  function tapMap(p: Point) {
    const map = v.map!, actor = v.actor;
    if(v.nearBoard&&Math.abs(p.x-requestBoardSpot.x)<50&&p.y>requestBoardSpot.y-98&&p.y<requestBoardSpot.y+10){openBoard();return;}
    const client=v.visibleClients().find(stage=>{const c=requesterSpots[stage];return distance(actor,c)<=48&&Math.abs(p.x-c.x)<30&&p.y>c.y-v.npcHeight()-5&&p.y<c.y+8;});if(client){openClient(client);return;}
    const villain=v.encounters.find(e=>v.hitCount(e)<3&&Math.abs(e.x-p.x)<33&&p.y>=e.y-62&&p.y<=e.y+8);
    if(villain){goTo(villain,'바퀴잠금 봇');return;}
    const npc=map.npcs.find(n=>distance(n,p)<55);if(npc){goTo({x:npc.x-72,y:npc.y+6},npc.name);return;}
    const building=map.buildings.find(b=>p.x>b.x&&p.x<b.x+b.width&&p.y>b.y&&p.y<b.y+b.height);if(building){goTo(building.entry,villageRewards[building.id].name,building);return;}
    goTo(p);
  }
  function destroyDialogue() { voice.destroy(); dialogueText.destroy(); }
  return { stopRoute, goTo, updateNearby, restHint, setupLabels, openBoard, closeBoard, openClient, primary, closeDialogue, interact, enterBuilding, tapMap, destroyDialogue };
}
