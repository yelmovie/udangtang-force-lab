import './certificate.css';
import {stages} from './data';
import type {SaveData} from './state';
import {earnedToolCards} from './toolCards';
import {shownItems,wrapTabAtEnds} from './focusTrap';
import {saveCertificatePng} from './certificate-png';

const blank=(field:string,label:string)=>`<span class="cert-field"><span class="cert-blank" data-cert-blank="${field}" aria-label="${label} 적는 빈칸"></span><span>${label}</span></span>`;

/** Reads the same completed missions as the ending; the printed name never enters the save. */
export function openForceCertificate(app:HTMLElement,save:SaveData,announce:(message:string)=>void){
 const complete=stages.filter(stage=>save.completed.includes(stage.id)).length;
 if(complete!==stages.length)return;
 const date=new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});
 const cards=earnedToolCards(save).length;
 const opener=document.activeElement as HTMLElement|null,wasInert=app.inert;
 const overlay=document.createElement('div');overlay.className='modal-layer certificate-layer';overlay.tabIndex=-1;
 overlay.innerHTML=`<section class="force-cert-dialog" role="dialog" aria-modal="true" aria-labelledby="force-cert-title"><article class="cert-paper"><img class="cert-frame" src="/assets/ui/certificate-frame-20261122.webp" alt=""><div class="cert-content"><p class="cert-world">우당탕 힘 실험실 · 힘 연구원</p><h2 class="cert-title" id="force-cert-title">힘 탐구 연구원 인증서</h2><div class="cert-recipient"><div class="cert-school-row">${blank('school','학교')}${blank('grade','학년')}${blank('class','반')}${blank('number','번')}</div><div class="cert-name-row"><span>이름</span><span class="cert-blank" data-cert-blank="name" aria-label="이름 적는 빈칸"></span></div></div><p class="cert-award">위 연구원은 다섯 실험에서 힘과 도구의 쓰임을 탐구하고,<br>실험 기록으로 배터리 코어를 옮겨 마을을 다시 밝혔으므로<br>이 인증서를 드립니다.</p><p class="cert-achievement">미션 ${complete} / ${stages.length} 완료 · 도구 카드 ${cards} / ${stages.length}</p><div class="cert-bottom"><p class="cert-date"><small>인증서 만든 날</small>${date}</p><div class="cert-stamp" aria-label="힘 탐구 인증 도장"><span>✦</span><b>힘 탐구<br>연구원 인증</b></div><p class="cert-giver"><small>주는 이</small>우당탕 힘 실험실<br>도토리 박사 · 콩이</p></div><p class="cert-credit">기획·제작: 옐샘 & ⓒ 아이스크림미디어</p></div></article><p class="cert-note">인쇄한 뒤 학교·반·번호·이름을 직접 적어요.</p><div class="cert-actions"><button type="button" class="button button-primary" id="certificate-print">인증서 인쇄 / PDF 저장</button><button type="button" class="button button-primary" id="certificate-png">PNG 저장</button><button type="button" class="button button-secondary" id="certificate-close">닫기</button></div></section>`;
 const close=()=>{overlay.remove();app.inert=wasInert;if(opener?.isConnected)opener.focus({preventScroll:true});};
 overlay.addEventListener('modal-dismiss',close);
 overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab')wrapTabAtEnds(event,shownItems(overlay,'button:not(:disabled)'));});
 overlay.querySelector<HTMLButtonElement>('#certificate-print')!.onclick=()=>window.print();
 overlay.querySelector<HTMLButtonElement>('#certificate-close')!.onclick=close;
 overlay.querySelector<HTMLButtonElement>('#certificate-png')!.onclick=async event=>{const button=event.currentTarget as HTMLButtonElement;button.disabled=true;try{await saveCertificatePng(overlay.querySelector<HTMLElement>('.cert-paper')!,'우당탕_힘탐구_연구원_인증서.png');announce('인증서 PNG를 저장했어요.');}catch{announce('인증서 그림을 불러오지 못했어요. 연결을 확인하고 다시 눌러 주세요.');}finally{button.disabled=false;}};
 app.inert=true;document.body.append(overlay);overlay.querySelector<HTMLButtonElement>('#certificate-print')!.focus({preventScroll:true});
}
