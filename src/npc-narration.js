// Original playback controller; recordings are documented in docs/AUDIO-PROVENANCE-20261109.md.
export function installNpcNarration({selector,src,text,enabled=()=>true,volume=()=>.7,hold=()=>()=>{}}) {
  if(typeof document==='undefined'||typeof MutationObserver==='undefined'||typeof Audio!=='function')return ()=>{};
  const player=new Audio(src);player.preload='none';
  let current=null,release=null,epoch=0;
  let voiceVolume;try{const saved=localStorage.getItem('npc-narration-volume');voiceVolume=saved===null?null:Number(saved);}catch{voiceVolume=null;}
  voiceVolume=Number.isFinite(voiceVolume)?Math.min(1,Math.max(0,voiceVolume)):null;
  const visible=el=>el.isConnected&&!el.closest('[hidden],dialog:not([open])')&&el.getClientRects().length>0;
  const stop=()=>{epoch++;player.pause();player.currentTime=0;release?.();release=null;
    const b=current?.querySelector('[data-npc-voice]');if(b){b.textContent='인사 듣기';b.setAttribute('aria-pressed','false');}current=null;
  };
  const speak=el=>{
    if(current===el){stop();return;}stop();
    if(!enabled()||document.hidden||!visible(el))return;
    player.volume=Math.min(1,Math.max(0,voiceVolume??.7));if(!player.volume)return;
    current=el;release=hold();const token=epoch;
    const b=el.querySelector('[data-npc-voice]');b.textContent='읽기 멈춤';b.setAttribute('aria-pressed','true');
    el.querySelector('[data-npc-caption]').hidden=false;
    void player.play().catch(()=>{if(token!==epoch)return;stop();b.textContent='음성 준비 중';});
  };
  const refresh=()=>{
    if(current&&(!visible(current)||!enabled()))stop();
    document.querySelectorAll(selector).forEach(el=>{
      if(el.querySelector('[data-npc-voice]'))return;
      const box=document.createElement('div');box.dataset.npcAudio='true';
      const b=document.createElement('button');b.type='button';b.dataset.npcVoice='true';
      b.textContent='인사 듣기';b.setAttribute('aria-label','NPC의 AI 합성 인사 음성 듣기');b.setAttribute('aria-pressed','false');
      b.style.cssText='min-height:48px;min-width:80px;margin-top:8px;font:inherit;cursor:pointer';
      const label=document.createElement('small');label.textContent=' · AI 합성 음성';
      const level=document.createElement('input');level.type='range';level.min='0';level.max='100';level.step='5';level.value=String(Math.round((voiceVolume??.7)*100));level.setAttribute('aria-label','NPC 음성 크기');level.style.cssText='width:90px;min-height:48px;vertical-align:middle';
      level.addEventListener('input',()=>{voiceVolume=Number(level.value)/100;player.volume=voiceVolume;try{localStorage.setItem('npc-narration-volume',String(voiceVolume));}catch{}if(!voiceVolume)stop();});
      const caption=document.createElement('p');caption.dataset.npcCaption='true';caption.textContent=text;caption.hidden=true;
      box.append(b,label,level,caption);el.append(box);
    });
  };
  const click=e=>{
    const b=e.target instanceof Element?e.target.closest('[data-npc-voice]'):null;
    if(b){e.preventDefault();e.stopImmediatePropagation();speak(b.closest(selector));return;}
    if(current)stop();
  };
  const hidden=()=>{if(document.hidden)stop();};
  const media=e=>{if(e.target instanceof HTMLVideoElement)stop();};
  const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
  player.addEventListener('ended',stop);player.addEventListener('error',stop);
  document.addEventListener('click',click,true);document.addEventListener('visibilitychange',hidden);
  document.addEventListener('play',media,true);globalThis.addEventListener('pagehide',stop);refresh();
  return ()=>{stop();observer.disconnect();document.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('play',media,true);globalThis.removeEventListener('pagehide',stop);player.removeAttribute('src');player.load();};
}
