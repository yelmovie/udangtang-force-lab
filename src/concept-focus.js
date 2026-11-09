// Media-clock concept emphasis. No completion gates or independent playback timer.
const escapeText = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emphasizeConcept(text, terms) {
  const words = [...new Set(terms.filter(Boolean))].sort((a,b) => b.length-a.length);
  if (!words.length) return escapeText(text);
  const pattern = new RegExp(words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  let result='', last=0;
  for (const match of String(text).matchAll(pattern)) {
    // A one-syllable term such as 물 must not highlight the last syllable of 식물.
    if(match[0].length===1&&/[가-힣]/.test(String(text)[match.index-1]||''))continue;
    result += escapeText(String(text).slice(last,match.index)) + '<mark class="science-keyword">' + escapeText(match[0]) + '</mark>';
    last=match.index+match[0].length;
  }
  return result+escapeText(String(text).slice(last));
}
export function bindConceptFocus(host, video, {steps, terms, caption, anchor, controls=true, reduced=false}) {
  if (!host || !video || !caption || !anchor || !host.ownerDocument) return () => {};
  const doc=host.ownerDocument;
  if (!doc.querySelector('link[data-concept-focus-style]')) {
    const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./concept-focus.css',import.meta.url).href;link.dataset.conceptFocusStyle='';doc.head.append(link);
  }
  host.classList.add('science-focus-player');
  if(reduced)host.classList.add('science-focus-reduced');
  host.querySelectorAll('.concept-cues li,.concept-cue-list li,#concept-fallback li,.concept-error').forEach(el=>{el.innerHTML=emphasizeConcept(el.textContent,terms);});
  const rail=doc.createElement('div');rail.className='science-focus-rail';
  rail.innerHTML=`<nav class="science-focus-steps" aria-label="핵심 장면 다시 살펴보기">${steps.map((step,i)=>`<button type="button" data-science-step="${i}" aria-label="${i+1}번째 장면: ${escapeText(step.term)} 다시 살펴보기"><span aria-hidden="true">${i+1}</span><strong>${escapeText(step.term)}</strong></button>`).join('')}</nav>${controls?'<button type="button" class="science-focus-toggle">재생</button>':''}`;
  anchor.after(rail);
  const controller=new AbortController(), options={signal:controller.signal};
  let last=-1, destroyed=false;
  const update=()=>{
    if(destroyed)return;
    let current=0;steps.forEach((step,i)=>{if(video.currentTime+0.001>=step.at)current=i;});
    const highlighted=emphasizeConcept(caption.textContent,terms);
    if(caption.innerHTML!==highlighted)caption.innerHTML=highlighted;
    if(current!==last){caption.dataset.scienceCue=String(current);caption.getAnimations?.().forEach(a=>a.cancel());if(!reduced&&!matchMedia('(prefers-reduced-motion: reduce)').matches)caption.animate?.([{opacity:.5,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:280,easing:'ease-out'});last=current;}
    rail.querySelectorAll('[data-science-step]').forEach((button,i)=>{button.classList.toggle('is-current',i===current);button.classList.toggle('is-seen',i<current||video.ended);if(i===current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    if(controls)host.querySelectorAll('.concept-play').forEach(button=>{button.hidden=true;});
    const toggle=rail.querySelector('.science-focus-toggle');if(toggle){toggle.textContent=video.paused?'재생':'일시정지';toggle.setAttribute('aria-label',video.paused?'개념 영상 재생':'개념 영상 일시정지');}
  };
  rail.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-science-step')){video.pause();video.hidden=false;host.querySelectorAll('.concept-end-frame,.concept-end').forEach(el=>{el.hidden=true;});/* Seek just inside the cue: media clocks round fractional seconds. */const at=steps[Number(button.dataset.scienceStep)].at;video.currentTime=at>0?at+0.001:0;video.dispatchEvent(new Event('timeupdate'));update();}
    else if(video.paused)video.play().catch(()=>update());else video.pause();
  },options);
  for(const event of ['timeupdate','seeked','play','pause','ended','loadedmetadata'])video.addEventListener(event,update,options);
  video.addEventListener('loadedmetadata',()=>{rail.querySelectorAll('button').forEach(button=>{button.disabled=false;});},options);
  const unavailable=()=>{rail.querySelectorAll('button').forEach(button=>{button.disabled=true;});};
  video.addEventListener('error',unavailable,options);
  const lastSource=[...video.querySelectorAll('source')].at(-1);lastSource?.addEventListener('error',unavailable,options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();},options);
  update();
  return ()=>{if(destroyed)return;destroyed=true;controller.abort();rail.remove();};
}
