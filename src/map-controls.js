// Identical standalone copy in each game: no runtime dependency on sibling projects.
export const MAP_VECTORS = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const keyDirections = {ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',w:'up',a:'left',s:'down',d:'right'};
export function mapKeyDirection(event) { return keyDirections[event.code] || keyDirections[event.key?.length===1?event.key.toLowerCase():event.key]; }

/** One finger can slide between arrows, leave the pad to stop, and re-enter it.
 * Each input owns its release; a touch never clears an unrelated keyboard key.
 * The delegated root also supports map HUDs rebuilt after every arrival. */
export function bindDirectionPad(root, selector, directionOf, {press,release,cancel,tap,blocked=()=>false,signal,repeatMs=0}={}) {
  const doc=root.ownerDocument||globalThis.document,win=doc.defaultView||globalThis.window||globalThis,abort=new AbortController(),options={signal:abort.signal},bindings=[];
  const on=(target,type,fn,opts=options)=>{target?.addEventListener?.(type,fn,opts);bindings.push(()=>target?.removeEventListener?.(type,fn,opts));};
  let pointer=null,timer=0;const keyboardKeys=new Map();
  const buttons=()=>[...(root.querySelectorAll?.(selector)||[])];
  const find=target=>{const b=target?.closest?.(selector);return b&&root.contains(b)&&!b.disabled?b:null;};
  function paint(){const direction=pointer?.direction||[...keyboardKeys.values()].at(-1);for(const b of buttons()){const held=!blocked()&&directionOf(b)===direction;b.setAttribute?.('data-map-pad','');b.toggleAttribute?.('data-map-held',held);if(held)b.classList?.add('is-held');else b.classList?.remove('is-held');}}
  function change(direction){if(pointer?.direction===direction)return;const old=pointer?.direction;if(old)(cancel||release)?.(old,{cancelled:true});if(pointer)pointer.direction=direction;if(direction)press?.(direction);paint();}
  function endPointer(reason){const previous=pointer;pointer=null;globalThis.clearInterval(timer);timer=0;if(previous?.direction)(reason==='pointerup'?release:cancel||release)?.(previous.direction,{cancelled:reason!=='pointerup'});try{if(previous&&root.hasPointerCapture?.(previous.id))root.releasePointerCapture(previous.id);}catch{}paint();}
  function clear(reason){keyboardKeys.clear();endPointer(reason);}
  on(root,'pointerdown',event=>{
    const b=find(event.target);if(!b||pointer||blocked()||event.button>0)return;
    event.preventDefault();event.stopPropagation?.();pointer={id:event.pointerId,direction:null,button:b};
    try{root.setPointerCapture(event.pointerId);}catch{}
    change(directionOf(b));
    if(repeatMs)timer=globalThis.setInterval(()=>{if(blocked()){clear();return;}if(pointer?.direction)press?.(pointer.direction);},repeatMs);
  },options);
  on(doc,'pointermove',event=>{
    if(pointer?.id!==event.pointerId)return;if(blocked()){clear();return;}
    const b=find(doc.elementFromPoint(event.clientX,event.clientY));change(b?directionOf(b):null);
  },options);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])on(doc,type,event=>{if(pointer?.id===event.pointerId)endPointer(type);},options);
  // Suppress the generated pointer click, preserving keyboard/assistive activation.
  on(root,'click',event=>{const b=find(event.target);if(!b)return;event.preventDefault();event.stopImmediatePropagation();if(event.detail===0&&!blocked())tap?.(directionOf(b));},{...options,capture:true});
  on(doc,'keydown',event=>{const d=mapKeyDirection(event);if(d&&!blocked()&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){if(!event.repeat)keyboardKeys.set(event.code||event.key,d);paint();}},options);
  on(doc,'keyup',event=>{if(mapKeyDirection(event)){keyboardKeys.delete(event.code||event.key);paint();}},options);
  on(win,'blur',clear,options);on(doc,'visibilitychange',clear,options);
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{if(blocked()||root.isConnected===false||!buttons().length)clear();else paint();}):null;observer?.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','inert']});
  function destroy(){clear();observer?.disconnect();abort.abort();signal?.removeEventListener('abort',destroy);for(const unbind of bindings)unbind();}
  if(signal){if(signal.aborted)destroy();else signal.addEventListener('abort',destroy,{once:true});}
  paint();return {clear,destroy};
}

/** Keep a full, bounded step around a sloping road edge. Every candidate still
 * passes the game's own collision rule, including intermediate feet positions. */
export function assistMapStep(start,delta,canStand,maxStep=4){
  const length=Math.hypot(delta.x,delta.y);if(!Number.isFinite(length)||!length||!canStand(start))return {...start};
  const count=Math.min(128,Math.max(1,Math.ceil(length/maxStep))),size=Math.min(length/count,maxStep),dx=delta.x/length,dy=delta.y/length;
  let p={...start};
  for(let i=0;i<count;i++){
    let next=null;
    for(const angle of [0,Math.PI/12,-Math.PI/12,Math.PI/6,-Math.PI/6,Math.PI/4,-Math.PI/4,Math.PI/3,-Math.PI/3]){
      const c=Math.cos(angle),s=Math.sin(angle),q={x:p.x+(dx*c-dy*s)*size,y:p.y+(dx*s+dy*c)*size};
      if(canStand(q)&&canStand({x:(p.x+q.x)/2,y:(p.y+q.y)/2})){next=q;break;}
    }
    if(!next)break;p=next;
  }
  return p;
}

/** Center-line walking for maps that deliberately restrict feet to a graph.
 * A turn shortly before a junction approaches that junction, never another road. */
export function stepAlongRoad(start,input,amount,segments,turnWindow=36){
  const magnitude=Math.hypot(input.x,input.y);if(!magnitude||!(amount>0)||!segments.length)return {...start};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),same=(a,b)=>dist(a,b)<.001;
  let edge=null,p=null,gap=Infinity;
  for(const pair of segments){const [a,b]=pair,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((start.x-a.x)*dx+(start.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:a.x+dx*t,y:a.y+dy*t},d=dist(start,q);if(d<gap){edge=pair;p=q;gap=d;}}
  let left=amount;
  const exits=node=>segments.flatMap(([a,b])=>same(a,node)?[b]:same(b,node)?[a]:[]);
  const score=(from,to)=>((to.x-from.x)*input.x+(to.y-from.y)*input.y)/(dist(from,to)*magnitude||1);
  for(let guard=0;left>.0001&&guard<segments.length*2+2;guard++){
    const node=edge.find(n=>same(n,p));const options=node?exits(node):edge;
    let target=null,best=.18;
    for(const q of options){const s=score(p,q);if(dist(p,q)>.001&&s>best){best=s;target=q;}}
    if(!target&&!node){let closest=turnWindow;for(const q of edge){const d=dist(p,q);if(d<closest&&exits(q).some(exit=>!edge.some(n=>same(n,exit))&&score(q,exit)>.55)){target=q;closest=d;}}}
    if(!target)break;
    const d=dist(p,target),step=Math.min(left,d);p={x:p.x+(target.x-p.x)*step/d,y:p.y+(target.y-p.y)*step/d};left-=step;
    if(step===d){p={...target};edge=segments.find(([a,b])=>same(a,target)||same(b,target));}
  }
  return p;
}
