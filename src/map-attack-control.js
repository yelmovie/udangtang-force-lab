// Mount the existing attack action beside the map hand tool.
const icon='<svg viewBox="0 0 32 32" width="30" height="30" focusable="false" aria-hidden="true"><path d="M7 23l5.3-5.4m-3.6 8 2.2 2.2m-.5-3.8-2.6-2.6m4.6-3.9 4.2 4.1m-2.1-2.1 10.4-10.3L27 4.6l-5 2.1L11.6 17.1m-5.9-4.9h4m-2-2v4m14.9 8.3h4m-2-2v4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const styles=`
[data-map-attack-toolbar]{align-items:center}
html body button.map-attack-dock[data-map-attack-dock]:not([hidden]){
 appearance:none!important;position:relative!important;inset:auto!important;
 display:inline-grid!important;place-items:center!important;flex:0 0 56px!important;
 width:56px!important;min-width:56px!important;max-width:56px!important;
 height:56px!important;min-height:56px!important;max-height:56px!important;
 margin:0!important;padding:0!important;border:2px solid #fff2cc!important;border-radius:50%!important;
 background:#3f2c58!important;color:#fff4da!important;
 box-shadow:0 3px 0 #251635,0 1px 10px #17262464!important;
 transform:none!important;pointer-events:auto!important;touch-action:manipulation;
 cursor:pointer;vertical-align:middle;
}
html body button.map-attack-dock[data-map-attack-dock][hidden]{display:none!important}
html body button.map-attack-dock[data-map-attack-dock]>svg{display:block;width:30px;height:30px;pointer-events:none}
html body button.map-attack-dock[data-map-attack-dock]:hover{background:#583c78!important}
html body button.map-attack-dock[data-map-attack-dock]:active{background:#2e2043!important}
html body button.map-attack-dock[data-map-attack-dock]:focus-visible{outline:3px solid #fff!important;outline-offset:3px}
html body button.map-attack-dock[data-map-attack-dock][aria-disabled="true"]{opacity:.72}
@media (max-width:440px){html body button.map-attack-dock[data-map-attack-dock]:not([hidden]){flex-basis:48px!important;width:48px!important;min-width:48px!important;height:48px!important;min-height:48px!important}}
`;
export function dockMapAttack(button,findHand){
 const doc=button.ownerDocument;
 if(!doc.querySelector('style[data-map-attack-dock-style]')){
  const sheet=doc.createElement('style');sheet.dataset.mapAttackDockStyle='';sheet.textContent=styles;doc.head.append(sheet);
 }
 button.classList.add('map-attack-dock');button.dataset.mapAttackDock='';
 button.innerHTML=icon;button.title='공격 · 스페이스바';
 return ()=>{
  const hand=findHand();
  if(!hand?.isConnected||!hand.parentElement)return false;
  if(hand.nextElementSibling!==button){hand.after(button);hand.parentElement.dataset.mapAttackToolbar='';}
  return !hand.hidden;
 };
}
