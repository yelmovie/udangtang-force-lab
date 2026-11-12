// Optional post-learning cleanup. Never awards stars or unlocks a learning activity.
export const normalizeMapVillains = value => Array.from({length:5},(_,i)=>Number.isInteger(value?.[i])&&value[i]>=0&&value[i]<=3?value[i]:0);
export function mountMapVillains(host,{progress,points,onHit,blocked=()=>false,sound=()=>{},tool='빛 파동',color='#8171bb'}={}){
 const doc=host.ownerDocument,layer=doc.createElement('div');layer.className='map-villains';layer.style.setProperty('--villain-color',color);host.append(layer);
 const timers=new Set(),buttons=new Map();let alive=true;
 const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(alive)fn();},ms);timers.add(id);};
 const status=doc.createElement('span');status.className='map-villain-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');layer.append(status);
 for(const point of points){const i=point.id;if(progress[i]>=3)continue;
  const b=doc.createElement('button');b.type='button';b.className='map-villain';b.dataset.villain=String(i);b.title='탐구로 얻은 빛을 세 번 톡! 남은 혼란을 걷어내자.';b.style.left=point.x+'%';b.style.top=point.y+'%';
  b.innerHTML='<span class="map-villain-body" aria-hidden="true"><i></i><i></i><em></em></span><span class="map-villain-pulse" aria-hidden="true">✦</span><span class="map-villain-caption"></span>';
  const label=()=>{b.setAttribute('aria-label',`${point.name} 혼란 구름. ${tool} 보내기. ${3-progress[i]}번 남음`);b.querySelector('.map-villain-caption').textContent=`${tool} · ${3-progress[i]}`;};label();
  b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('keydown',e=>{e.stopPropagation();if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();});
  let busy=false;
  b.addEventListener('click',e=>{e.stopPropagation();if(busy||blocked()||progress[i]>=3)return;busy=true;progress[i]++;onHit?.(i,progress[i]);sound();label();
   const done=progress[i]===3;b.classList.add(done?'is-cleared':'is-hit');b.setAttribute('aria-disabled','true');
   status.textContent=done?`${point.name}의 혼란 구름을 물리쳤어! 탐구로 찾은 빛이 돌아왔어.`:`톡! ${tool}이 닿았어. ${3-progress[i]}번 더 보내자.`;
   later(()=>{if(done){const focused=doc.activeElement===b;b.remove();buttons.delete(i);if(focused){const next=[...buttons.values()][0];if(next)next.focus({preventScroll:true});else{host.tabIndex=-1;host.focus({preventScroll:true});}}}else{busy=false;b.classList.remove('is-hit');b.removeAttribute('aria-disabled');}},matchMedia('(prefers-reduced-motion: reduce)').matches?160:460);
  });buttons.set(i,b);layer.append(b);
 }
 return {position(id,x,y){const b=buttons.get(id);if(b){b.style.left=x+'px';b.style.top=y+'px';}},scale(value){layer.style.setProperty('--villain-scale',String(1/Math.max(.1,value)));},destroy(){alive=false;for(const id of timers)clearTimeout(id);layer.remove();}};
}
