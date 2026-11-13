// The map award plays once on the last hit. It never changes learning or certificate progress.
export function openMapFinale(host, source) {
 const doc=host.ownerDocument;
 if(!host.isConnected||doc.querySelector('.map-finale-dialog'))return;
 const dialog=doc.createElement('dialog');dialog.className='map-finale-dialog';
 dialog.setAttribute('aria-label','지도 모험 피날레');
 Object.assign(dialog.style,{width:'min(760px,calc(100vw - 28px))',maxHeight:'calc(100dvh - 28px)',padding:'14px',border:'1px solid #9bbbae',borderRadius:'14px',background:'#172525',color:'#fff',textAlign:'center',zIndex:'999'});
 const title=doc.createElement('h2');title.textContent='모든 악당을 물리쳤어!';title.style.margin='0 0 10px';
 const video=doc.createElement('video');video.src=source;video.playsInline=true;video.muted=true;video.controls=true;video.autoplay=true;video.preload='metadata';video.setAttribute('aria-label','지도 탐험 피날레 영상');
 Object.assign(video.style,{display:'block',width:'100%',maxHeight:'62dvh',borderRadius:'8px',background:'#080e10'});
 const status=doc.createElement('p');status.hidden=true;status.role='status';
 const close=doc.createElement('button');close.type='button';close.textContent='지도로 돌아가기';Object.assign(close.style,{marginTop:'10px',minHeight:'44px',padding:'6px 18px',borderRadius:'8px',cursor:'pointer'});
 dialog.append(title,video,status,close);doc.body.append(dialog);dialog.showModal();
 close.addEventListener('click',()=>dialog.close());
 video.addEventListener('error',()=>{status.hidden=false;status.textContent='지금은 영상을 열 수 없어. 지도 퇴치 기록은 저장됐어.';});
 dialog.addEventListener('close',()=>{video.pause();dialog.remove();},{once:true});
 video.play().catch(()=>{});
}
