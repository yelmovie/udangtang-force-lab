import { distance } from './villageMap';
import type { Point } from './villageMap';
import type { VillageScene } from './villageScene';

/** The map fills the screen (cover, up to 2x the fit size) and the camera follows the student over the overflow.
 * Also the whole-map view, hand mode (drag to look around), wheel zoom and two-finger pinch. */
export function createVillageCamera(v: VillageScene) {
  const { root, shell, frame, canvas, labels, hint, panButton, reduced } = v;
  let zoom=1,camAt=0,viewW=1,viewH=1;
  let savedView: {zoom:number; point:Point|null}|null=null;
  const touches=new Map<number,Point>();
  let pinch:{gap:number;scale:number;point:Point}|null=null;
  // Hand mode: the camera stays where it was dragged until hand mode is switched off or the student starts walking again.
  let panDrag: { id: number; x: number; y: number; from: { x: number; y: number }; moved: boolean } | null = null, hintBeforePan = '';
  const scaleFor=()=>{const mw=v.map?.width??16,mh=v.map?.height??9,sw=Math.max(1,shell.clientWidth),sh=Math.max(1,shell.clientHeight),fit=Math.min(sw/mw,sh/mh);return Math.min(Math.max(sw/mw,sh/mh),fit*2);};
  function syncFit(){const button=root.querySelector('#village-fit')!;button.setAttribute('aria-pressed',String(v.overview));button.setAttribute('aria-label',v.overview?'이전 지도 보기':'지도 전체 보기');}
  function follow(snap=false) {
    const sw=shell.clientWidth,sh=shell.clientHeight,mw=v.map?.width??16,mh=v.map?.height??9,panView=v.panView,camera=v.camera;
    const clamp=(view:number,size:number,at:number)=>size<=view?(view-size)/2:Math.min(0,Math.max(view-size,at));
    const axis=(view:number,size:number,at:number)=>clamp(view,size,view/2-at);
    const x=panView?clamp(sw,v.frameWidth,panView.x):axis(sw,v.frameWidth,v.actor.x/mw*v.frameWidth);
    const y=panView?clamp(sh,v.frameHeight,panView.y):axis(sh,v.frameHeight,v.actor.y/mh*v.frameHeight);
    const now=performance.now(),blend=snap||!camAt||panView||v.overview||reduced.matches?1:1-Math.exp(-Math.min(40,now-camAt)/73);
    camAt=now;v.camera={x:camera.x+(x-camera.x)*blend,y:camera.y+(y-camera.y)*blend};
    if(distance(v.camera,{x,y})<.45)v.camera={x,y};
    frame.style.transform=`translate(${v.camera.x}px,${v.camera.y}px)`;
    // Short screens: building labels keep clear of the top bar badges (village.css --label-floor uses this).
    labels.style.setProperty('--cam-y',`${v.camera.y}px`);
  }
  function resize() {
    const mw=v.map?.width??16,mh=v.map?.height??9,sw=Math.max(1,shell.clientWidth),sh=Math.max(1,shell.clientHeight);
    const scale=v.overview?Math.min(sw/mw,Math.max(1,sh-170)/mh):scaleFor()*zoom;
    if(v.panView&&!v.overview){const fx=(viewW/2-v.camera.x)/v.frameWidth,fy=(viewH/2-v.camera.y)/v.frameHeight;v.panView={x:sw/2-fx*mw*scale,y:sh/2-fy*mh*scale};}
    viewW=sw;viewH=sh;
    v.frameWidth=mw*scale;v.frameHeight=mh*scale;
    frame.style.width=`${v.frameWidth}px`;frame.style.height=`${v.frameHeight}px`;
    const density=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(v.frameWidth*density);canvas.height=Math.round(v.frameHeight*density);follow(true);v.draw();
  }
  function setPan(on: boolean) {
    if (on === !!v.panView) return;
    v.panView = on ? { ...v.camera } : null; panDrag = null;
    shell.classList.toggle('is-panning', on);
    panButton.setAttribute('aria-pressed', String(on));
    panButton.setAttribute('aria-label', on ? '지도 끌기 끝' : '지도 끌어 보기');
    if(on&&v.overview){v.overview=false;savedView=null;syncFit();resize();}
    if (on) { v.stopRoute();v.updateNearby();hintBeforePan = hint.textContent ?? ''; hint.textContent = ''; }
    else hint.textContent = hintBeforePan;
    follow();
  }
  function resumeFollow() {
    touches.clear();pinch=null;panDrag=null;
    setPan(false);
    if(v.overview||zoom!==1){v.overview=false;zoom=1;savedView=null;syncFit();resize();}
  }
  /** Fingers and drags end when the window loses focus. */
  function releasePointers() { touches.clear();pinch=null;panDrag=null; }
  const local=(event:PointerEvent|WheelEvent)=>{const box=shell.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top};};
  const midpoint=()=>{const [a,b]=[...touches.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,gap:distance(a,b)};};
  function zoomAt(mult:number,mid:Point,point:Point){
    if(!v.map)return;v.overview=false;savedView=null;syncFit();setPan(true);zoom=Math.max(1,Math.min(2,mult));resize();
    v.panView={x:mid.x-point.x*v.frameWidth,y:mid.y-point.y*v.frameHeight};follow(true);
  }
  /** The fit and hand buttons, then wheel, pinch, drag and tap on the canvas (registered in this order). */
  function bindCameraInput(tapMap: (p: Point) => void) {
    const signal = v.events;
    root.querySelector('#village-fit')!.addEventListener('click',()=>{if(!v.map||v.paused())return;v.stopRoute();v.updateNearby();
      if(!v.overview){
        savedView={zoom,point:v.panView?{x:(shell.clientWidth/2-v.camera.x)/v.frameWidth,y:(shell.clientHeight/2-v.camera.y)/v.frameHeight}:null};
        setPan(false);v.overview=true;resize();
      }else{
        v.overview=false;zoom=savedView?.zoom??1;resize();
        if(savedView?.point){setPan(true);v.panView={x:shell.clientWidth/2-savedView.point.x*v.frameWidth,y:shell.clientHeight/2-savedView.point.y*v.frameHeight};follow(true);}
        savedView=null;
      }
      syncFit();},{signal});
    panButton.addEventListener('click',()=>{if(v.map&&!v.paused()){if(v.panView)resumeFollow();else setPan(true);}},{signal});
    canvas.addEventListener('wheel',event=>{const map=v.map;if(!map||v.paused())return;event.preventDefault();v.stopRoute();const p=local(event);
      zoomAt(v.frameWidth/map.width/scaleFor()*Math.exp(-event.deltaY*.0015),p,{x:(p.x-v.camera.x)/v.frameWidth,y:(p.y-v.camera.y)/v.frameHeight});
    },{signal,passive:false});
    canvas.addEventListener('pointerdown',event=>{
      const map=v.map;
      if(!map||v.paused()||(event.pointerType==='mouse'&&event.button!==0))return;
      if(event.pointerType==='touch'){
        touches.set(event.pointerId,local(event));canvas.setPointerCapture?.(event.pointerId);
        if(touches.size===2){v.stopRoute();v.clearInput();panDrag=null;const m=midpoint();pinch={gap:m.gap,scale:v.frameWidth/map.width/scaleFor(),point:{x:(m.x-v.camera.x)/v.frameWidth,y:(m.y-v.camera.y)/v.frameHeight}};return;}
      }
      if(panDrag||pinch||v.overview)return;
      // Take over from the route at the finger-down point. Only a release without dragging counts as a tap.
      v.stopRoute();v.clearInput();v.updateNearby();v.draw();event.preventDefault();
      panDrag={id:event.pointerId,x:event.clientX,y:event.clientY,from:{...v.camera},moved:false};
      if(event.pointerType==='mouse')canvas.setPointerCapture(event.pointerId);
    },{signal});
    canvas.addEventListener('pointermove',event=>{
      if(v.paused())return;
      if(touches.has(event.pointerId))touches.set(event.pointerId,local(event));
      if(pinch&&touches.size>=2){const m=midpoint();zoomAt(pinch.scale*m.gap/Math.max(8,pinch.gap),m,pinch.point);return;}
      const drag=panDrag;if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<8)return;
      if(!drag.moved){if(!v.panView)setPan(true);panDrag=drag;drag.moved=true;shell.classList.add('is-pan-dragging');}
      v.panView={x:drag.from.x+dx,y:drag.from.y+dy};follow();
      v.panView={...v.camera};
    },{signal});
    const endPan=(event:PointerEvent)=>{touches.delete(event.pointerId);if(touches.size<2)pinch=null;if(panDrag?.id===event.pointerId){panDrag=null;shell.classList.remove('is-pan-dragging');}};
    canvas.addEventListener('pointercancel',endPan,{signal});canvas.addEventListener('lostpointercapture',endPan,{signal});
    canvas.addEventListener('pointerup',event=>{
      if(panDrag?.id!==event.pointerId){endPan(event);return;}
      const tap=!panDrag.moved&&!v.panView;endPan(event);
      const map=v.map;
      if(!map||v.paused()||!tap)return;
      const bounds=canvas.getBoundingClientRect();
      tapMap({x:(event.clientX-bounds.left)/bounds.width*map.width,y:(event.clientY-bounds.top)/bounds.height*map.height});
    },{signal});
  }
  return { follow, resize, resumeFollow, releasePointers, bindCameraInput };
}
