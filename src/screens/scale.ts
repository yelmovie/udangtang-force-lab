import type { AppContext } from '../appTypes';
import { icons } from '../icons';
import { scaleParts, targetWeight } from '../data';
import { mountCompanion } from '../sprites';
import { missionProgressMarkup, setMissionProgress } from '../missionProgress';
import { canCompleteScale, comparisonParts, emptyScaleReading, fakeHint, fakeLabels, fakeLayout, fakeRequestComplete, fakeRounds, fakeSummary, judgeFakePick, nextFakeRound, recordFakePick, recordScaleRun, scaleComparison, recordSpringRead, springDone, springEyeLabels, springHint, springObjects, springParallax, springReading, springStartOffset, springSummary, turnSpringScrew, type EyeLevel } from '../scaleModel';
import { letterOnce } from '../requestLetter';
import { predictionRecap } from '../inquiryPlan';
import '../instruments.css';
import '../scalePolish.css';

const props: Record<string,{name:string;file:string}> = {
  orange:{name:'사과 모형',file:'apple'},teal:{name:'너트 모형',file:'nut'},cream:{name:'지우개 모형',file:'eraser'},blue:{name:'책 모형',file:'book'},green:{name:'돌 모형',file:'rock'},
};
// Level 2 parts are ids like "fake:2" so they share the level 1 tap/drag/basket code.
const fakeIndex = (id:string) => id.startsWith('fake:') ? Number(id.slice(5)) : -1;
const nameOf = (id:string) => fakeIndex(id)>=0 ? `${fakeLabels[fakeIndex(id)]} 부품` : props[id].name;
const partArt = (id:string) => fakeIndex(id)>=0 ? `<img src="/assets/game/nut.webp" alt="" draggable="false"><b class="fake-tag" aria-hidden="true">${fakeLabels[fakeIndex(id)]}</b>` : `<img src="/assets/game/${props[id].file}.webp" alt="" draggable="false">`;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Result popup: what one finished try showed, the records to compare, and one question to answer. Questions are not saved.
type PopQuestion = { prompt:string; choices:[string,string][]; correct:string; right:string; hint:string };
type PopResult = { title:string; text:string; records?:string; question?:PopQuestion; answer?:string };
const shortName = (id:string) => props[id].name.replace(' 모형','');

export function mountScale(root: HTMLElement, context: AppContext): () => void {
  const state = context.save.scale;
  const events = new AbortController();
  let active = true;
  let busy = false;
  let frame = 0;
  let suppressClickUntil = 0;
  const motions = new Set<Animation>();
  const last = state.runs.at(-1);
  let reading: number | null = last && last.zeroed === state.zeroed && [...last.parts].sort().join(',') === [...state.parts].sort().join(',') ? last.reading : null;
  let feedback = '겉모습만으로 무게를 정확히 알 수 있을까요? 사과와 책 모형을 하나씩 재 봐요.';
  // Level 2 request: positions are shuffled per visit; measurements are session play, only judgements are saved.
  const record = () => context.save.levels?.scale;
  const fakeSeed = Math.floor(Math.random()*1000);
  let level: 1|2 = canCompleteScale(state) && record() ? 2 : 1;
  let fakeZeroed = false;
  let fakeOn: number | null = null;
  let waiting = false;
  let timer = 0;
  let misses = 0;
  let found: number | null = null;
  const measured = new Map<number,{reading:number;zeroed:boolean}>();
  let dockRound = -1;
  let requestMarkup = '';
  let popup: HTMLDialogElement | null = null;
  let popupPending = false;
  let lastResult: PopResult | null = null;
  const popupBusy = () => !!popup || popupPending;
  if(level===2) { feedback='겉모습이 똑같은 부품 중 하나가 가짜예요. 저울로 하나씩 재 봐요.'; state.parts=[]; reading=null; }

  root.innerHTML = `<section class="experiment-screen instrument-screen scale-screen">
    <div class="experiment-heading"><div><p class="eyebrow">03 · 재료 보급소</p><h1>저울로 무게를 비교해요</h1></div>${missionProgressMarkup('scale',['빈 저울 0 맞추기','사과 재기','책 재기','가짜 부품 찾기'])}</div>
    <div class="instrument-stage game-panel scale-field">
      <div class="instrument-phase" id="scale-phase" tabindex="-1"></div>
      <div class="scale-toolbar"><div class="scale-comparison" id="scale-comparison" aria-label="두 모형의 측정 결과"></div><button class="scale-record-open" id="scale-record-open" type="button">기록 보기</button></div>
      <div class="scale-target">하나씩 재고 <strong>비교해요</strong></div>
      <div class="scale-basket" id="scale-basket" aria-label="전자저울 위 쟁반"><span class="basket-label">모형 부품을 여기에 놓아요</span><div class="basket-items" id="basket-items"></div></div>
      <div class="scale-platform"></div><div class="scale-body"><div class="scale-display"><span class="scale-stability" id="scale-stability">측정값</span><strong id="scale-reading">15</strong><span>g</span></div><button class="zero-button" id="zero-button" aria-label="빈 저울 영점 맞추기">0 맞추기</button><button id="scale-measure" class="scale-measure-button">모두 내리기</button></div>
      <div class="scale-difference" id="scale-difference" role="status"></div>
      <div class="instrument-companion" id="scale-companion" aria-hidden="true"></div>
      <div class="spring-lab" id="spring-lab" hidden aria-label="용수철저울 선택 탐구">
        <div class="spring-head"><span class="scale-request-from" id="spring-badge">선택 탐구</span><p>용수철저울을 바르게 읽어요 <small>영점 나사 → 물체 걸기 → 멈출 때까지 기다리기 → 정면에서 읽기</small></p><button class="scale-heft" id="spring-close">전자저울로 돌아가기</button></div>
        <div class="spring-stage">
          <div class="spring-view"><div class="spring-eye-marker" id="spring-eye-marker" aria-hidden="true">눈</div><div class="spring-scale" id="spring-scale"><div class="spring-ring"></div><div class="spring-dial"><div class="spring-marks" id="spring-marks">${Array.from({length:11},(_,i)=>`<span style="--g:${i*10}"><b>${i*10}</b></span>`).join('')}${Array.from({length:10},(_,i)=>`<i style="--g:${i*10+5}"></i>`).join('')}</div><div class="spring-pointer" id="spring-pointer"></div></div><div class="spring-hook" id="spring-hook"></div></div></div>
          <div class="spring-controls">
            <div class="spring-group"><span>① 영점 나사</span><div class="spring-row"><button id="spring-screw-up" aria-label="영점 나사 왼쪽으로 돌리기">${icons.rotateLeft}</button><strong id="spring-zero"></strong><button id="spring-screw-down" aria-label="영점 나사 오른쪽으로 돌리기">${icons.rotateRight}</button></div></div>
            <div class="spring-group"><span>② 물체 걸기</span><div class="spring-row">${springObjects.map(id=>`<button data-hang="${id}">${props[id].name}</button>`).join('')}<button data-hang="">내리기</button></div></div>
            <div class="spring-group"><span>③ 흔들림</span><strong id="spring-swing"></strong></div>
            <div class="spring-group"><span>④ 눈높이</span><div class="spring-row spring-eye-wrap"><input type="range" id="spring-eye" min="0" max="2" step="1" value="1" aria-label="눈높이: 위, 정면, 아래"><div class="spring-eye-labels" aria-hidden="true"><span>위</span><span>정면</span><span>아래</span></div></div></div>
            <button class="button button-primary" id="spring-read">⑤ 눈금 읽기</button>
            <p class="spring-feedback" id="spring-feedback" role="status"></p>
            <div class="spring-reads" id="spring-reads" aria-label="눈높이별 읽은 값"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="instrument-dock scale-dock" id="scale-shelf"><div class="instrument-tools" data-level="1"><span class="dock-label">모형을 누르거나 끌어서 저울에 올려요 <small>빼기: 쟁반의 − 누르기</small></span><div class="scale-parts">${scaleParts.map(part=>`<button class="scale-part" data-part="${part.id}" aria-label="${props[part.id].name} 저울에 올리기" style="--part-color:${part.color}">${partArt(part.id)}<strong>${props[part.id].name}</strong><span class="known-weight" data-known="${part.id}">무게 ?</span></button>`).join('')}</div></div><div class="instrument-tools" data-level="2" hidden><span class="dock-label">겉모습이 똑같은 부품이에요. 하나씩 저울에 올려 재요 <small>다른 숫자를 찾으면 ‘가짜예요’</small></span><div class="fake-parts" id="fake-parts"></div></div></div>
    <div class="experiment-footer"><span class="feedback" id="scale-feedback" role="status"></span><button class="button button-primary" id="scale-finish" disabled>비교 기록 저장 →</button></div>
  </section>`;
  const basket = root.querySelector<HTMLElement>('#scale-basket')!;
  const basketItems = root.querySelector<HTMLElement>('#basket-items')!;
  const readingNode = root.querySelector<HTMLElement>('#scale-reading')!;
  const finish = root.querySelector<HTMLButtonElement>('#scale-finish')!;
  const measure = root.querySelector<HTMLButtonElement>('#scale-measure')!;
  const companion = mountCompanion(root.querySelector<HTMLElement>('#scale-companion')!);
  const round = () => Math.min(nextFakeRound(record()), fakeRounds.length-1);
  const requestDone = () => fakeRequestComplete(record());
  const loaded = () => level===2 ? fakeOn===null ? [] : [`fake:${fakeOn}`] : state.parts;
  const zeroedNow = () => level===2 ? fakeZeroed : state.zeroed;
  function loadReading() {
    if(level===2) return (fakeOn===null ? 0 : fakeLayout(round(),fakeSeed)[fakeOn])+(fakeZeroed?0:emptyScaleReading);
    return state.parts.reduce((sum,id)=>sum+scaleParts.find(p=>p.id===id)!.weight,0)+(state.zeroed?0:15);
  }
  function canFinish() { return canCompleteScale(state) && requestDone(); }
  function renderFakeDock() {
    if(dockRound===round()) return;
    dockRound=round();
    const count=fakeRounds[dockRound].count;
    const dock=root.querySelector<HTMLElement>('#fake-parts')!;
    dock.style.setProperty('--fake-count',String(count));
    dock.innerHTML=Array.from({length:count},(_,i)=>`<div class="fake-slot" data-slot="${i}"><button class="scale-part fake-part" data-part="fake:${i}" aria-label="${fakeLabels[i]} 부품 저울에 올리기">${partArt(`fake:${i}`)}<strong>${fakeLabels[i]} 부품</strong><span class="known-weight" data-fake-known="${i}">무게 ?</span></button><button class="fake-pick" data-pick="${i}" aria-label="${fakeLabels[i]} 부품이 가짜예요">가짜예요</button></div>`).join('');
  }
  function requestBar() {
    const springButton=`<button class="scale-heft" id="scale-spring-open">${springDone(state.springReads) ? '용수철저울 다시 보기' : '용수철저울도 읽어 볼까?'}</button>`;
    if(level===1) return canCompleteScale(state) ? `<div class="scale-request"><span class="scale-request-from">보급소 직원의 의뢰</span><button class="button button-primary" id="scale-request-open">${record() ? '의뢰 이어 하기' : '의뢰 받기'}</button>${springButton}</div>` : '';
    if(requestDone()&&!waiting) return `<div class="scale-request is-done"><span class="scale-request-from">의뢰 완료 ✓</span><p>가짜 ${fakeRounds.length}개를 저울 숫자로 찾았어요</p>${springButton}</div>`;
    const r=fakeRounds[round()];
    return `<div class="scale-request is-active"><span class="scale-request-from">의뢰 ${round()+1} / ${fakeRounds.length}</span><p>가짜 1개 · 진짜는 모두 <strong>${r.real} g</strong></p><button class="scale-heft" id="scale-heft">손으로 들어 보기</button></div>`;
  }
  function phaseText() {
    if(busy) return '숫자가 멈출 때까지 살펴봐요';
    if(level===1) return !state.zeroed ? state.parts.length ? '모두 내리고 빈 저울을 0으로 맞춰요' : '빈 저울을 0으로 맞춰요' : canCompleteScale(state) ? '보급소 직원의 의뢰를 받아요' : state.parts.length ? '모두 내린 뒤 다른 모형을 하나만 올려요' : '사과와 책 모형을 하나씩 재 봐요';
    if(waiting) return '가짜를 찾았어요! 다음 의뢰를 준비해요';
    if(requestDone()) return '의뢰 완료! 비교 기록을 저장해요';
    if(!fakeZeroed&&fakeOn===null&&!measured.size) return '빈 저울의 숫자부터 확인해요';
    return `부품 ${fakeRounds[round()].count}개를 하나씩 재고 다른 숫자를 찾아요`;
  }
  function differenceText() {
    if(busy) return '안정되면 자동으로 기록해요';
    if(!zeroedNow()) return `빈 저울의 ${emptyScaleReading} g이 더해져 있어요`;
    if(level===1) return canCompleteScale(state) ? '사과 80 g > 책 70 g · 사과가 10 g 더 무거워요' : '겉모습만으로 정확한 무게는 알기 어려워요';
    if(requestDone()&&!waiting) return '눈과 손으로 모르는 작은 차이도 저울은 숫자로 보여 줘요';
    return '진짜 부품끼리는 숫자가 같아요';
  }
  function recordsMarkup(at=round()) {
    if(level===2) {
      const r=fakeRounds[at];
      return `<section class="scale-pop-records" aria-label="이번 의뢰 측정 기록"><h3>의뢰 ${at+1} / ${fakeRounds.length} · 진짜 부품은 모두 ${r.real} g</h3><div class="scale-pop-rows">${Array.from({length:r.count},(_,i)=>{const value=measured.get(i);return `<span class="${found===i?'is-fake':value?'is-measured':''}">${fakeLabels[i]} 부품 <strong>${value ? `${value.reading} g${value.zeroed?'':' · 영점 전'}` : '아직 안 쟀어요'}</strong></span>`;}).join('')}</div></section>`;
    }
    const compared=scaleComparison(state.runs);
    const pair=comparisonParts.map(id=>{const run=compared.find(run=>run.parts[0]===id);return `<span class="${run?'is-measured':''}">${props[id].name} <strong>${run ? run.reading+' g' : '아직 안 쟀어요'}</strong></span>`;}).join('<b class="scale-pop-vs" aria-hidden="true">vs</b>');
    const runs=state.runs.slice(-5).reverse().map(run=>`<li><span>${run.parts.map(shortName).join(' + ')}${run.zeroed ? '' : ' · 영점 전'}</span><strong>${run.reading} g</strong></li>`).join('');
    return `<section class="scale-pop-records" aria-label="나의 측정 기록"><h3>두 모형 비교</h3><div class="scale-pop-rows scale-pop-pair">${pair}</div>${runs ? `<h3>최근 측정 <small>${state.runs.length}번 쟀어요</small></h3><ol class="scale-pop-runs">${runs}</ol>` : '<p class="scale-pop-note">하나씩 재면 부품의 무게를 발견할 수 있어요.</p>'}${canCompleteScale(state) ? '<p class="scale-pop-note">더 해 보기 (선택): 여러 모형으로 150 g 만들기. 실제 물체의 무게는 모형과 다를 수 있어요.</p>' : ''}</section>`;
  }
  function questionMarkup(q:PopQuestion, answer?:string) {
    const solved=answer===q.correct;
    return `<section class="scale-pop-question"><p class="scale-pop-prompt"><span>생각해 봐요</span>${q.prompt}</p><div class="scale-pop-choices">${q.choices.map(([id,label])=>`<button type="button" data-answer="${id}" class="${answer===id ? solved ? 'is-right' : 'is-wrong' : ''}"${solved?' disabled':''}>${label}</button>`).join('')}</div><p class="scale-pop-answer${solved?' is-right':''}" role="status">${answer===undefined ? '' : solved ? q.right : q.hint}</p></section>`;
  }
  function openPopup(label:string) {
    if(!active) return;
    popup?.close();
    const result=lastResult;
    const dialog=document.createElement('dialog');
    dialog.className='stage-popup scale-popup';
    dialog.setAttribute('aria-labelledby','scale-popup-title');
    const render=()=>{
      dialog.innerHTML=`<div class="stage-popup-card"><button class="stage-popup-close" type="button" aria-label="닫기">×</button><p class="stage-popup-label">${label}</p><h2 id="scale-popup-title">${result ? result.title : '나의 측정 기록'}</h2><div class="stage-popup-body">${result ? `<p class="scale-pop-text">${result.text}</p>` : ''}${result?.records ?? recordsMarkup()}${result?.question ? questionMarkup(result.question,result.answer) : ''}</div><div class="stage-popup-actions">${canFinish() ? '<button class="button button-primary stage-result-finish" type="button">비교 기록 저장 →</button>' : '<button class="button button-primary stage-popup-continue" type="button">계속 실험하기</button>'}</div></div>`;
    };
    render();
    dialog.addEventListener('click',event=>{
      event.stopPropagation();
      const button=(event.target as Element).closest<HTMLButtonElement>('button');
      if(!button||button.disabled) return;
      if(button.matches('.stage-popup-close, .stage-popup-continue')) { dialog.close(); return; }
      if(button.matches('.stage-result-finish')) { if(canFinish()) { dialog.close(); finish.click(); } return; }
      if(button.dataset.answer&&result?.question) {
        result.answer=button.dataset.answer;
        const right=result.answer===result.question.correct;
        context.sound(right ? 730 : 340); render();
        dialog.querySelector<HTMLElement>(right ? '.stage-popup-continue' : `[data-answer="${result.answer}"]`)?.focus();
      }
    });
    dialog.addEventListener('close',()=>{ dialog.remove(); if(popup===dialog) { popup=null; if(active) update(); } });
    root.append(dialog);
    popup=dialog;
    dialog.showModal();
  }
  // Never interrupt a drag: a result that lands mid-drag waits for the pointer to lift.
  function showResult(result:PopResult) {
    lastResult=result;
    if(drag) { popupPending=true; return; }
    openPopup('실험 결과');
  }
  // Level 1 opens a popup for each finished measurement until both models are compared; later free play stays in the footer.
  function measureResult(parts:string[],value:number,zeroed:boolean):PopResult {
    if(!zeroed) return { title:`${value} g? 0을 맞추기 전 숫자예요`, text:`빈 저울이 이미 ${emptyScaleReading} g을 가리키고 있었어요. 그래서 모형의 무게보다 ${emptyScaleReading} g 더 크게 보여요.`, question:{ prompt:'정확한 무게를 재려면 먼저 무엇을 할까요?', choices:[['heavier','모형을 하나 더 올려요'],['zero','모두 내리고 0 맞추기를 눌러요']], correct:'zero', right:'맞아요! 빈 저울을 0으로 맞추면 모형의 무게만 숫자로 나와요.', hint:`숫자에 빈 저울의 ${emptyScaleReading} g이 더해져 있어요. 빈 저울부터 0으로 맞춰야 해요.` } };
    if(parts.length>1) return { title:`함께 올려서 ${value} g이에요`, text:`${parts.map(shortName).join(', ')} 모형을 한꺼번에 재었어요. 이 숫자로는 각각의 무게를 알 수 없어요.`, question:{ prompt:'두 모형의 무게를 비교하려면 어떻게 잴까요?', choices:[['one','하나씩 따로 재요'],['together','함께 올려 재요']], correct:'one', right:'맞아요! 하나씩 재야 두 숫자를 비교할 수 있어요. 모두 내리고 하나만 올려요.', hint:'함께 재면 두 무게가 더해진 숫자 하나만 나와요.' } };
    const name=props[parts[0]].name;
    if(canCompleteScale(state)) {
      const recap=predictionRecap(context.save,'scale');
      return { title:'사과 80 g, 책 70 g!', text:`${name}은 ${value} g이에요. 이제 두 숫자를 비교할 수 있어요.${recap.predicted ? ` 처음 내 예상은 ‘${recap.predicted}’였어요. ${recap.matched ? '예상과 같아요!' : '예상과 달랐어요. 그래서 직접 재 보는 게 중요해요.'}` : ''}`, question:{ prompt:'어느 모형이 더 무거운가요?', choices:[['book','책 모형'],['apple','사과 모형'],['same','무게가 같아요']], correct:'apple', right:'맞아요! 80 g이 70 g보다 커요. 사과 모형이 10 g 더 무거워요. 겉모습이 아니라 숫자로 비교했어요.', hint:'기록한 두 숫자를 다시 봐요. 숫자가 더 큰 쪽이 더 무거워요.' } };
    }
    const others=comparisonParts.filter(id=>id!==parts[0]).map(id=>props[id].name);
    return { title:`${name}은 ${value} g이에요`, text:(comparisonParts as readonly string[]).includes(parts[0]) ? `${others.join(', ')}의 무게도 재면 두 숫자를 비교할 수 있어요.` : `${name}의 무게를 발견했어요. 비교할 모형은 사과와 책 모형이에요.`, question:{ prompt:'다른 모형의 무게를 재려면 다음에 무엇을 할까요?', choices:[['stack','지금 모형 위에 하나 더 올려요'],['swap','모두 내리고 다른 모형 하나만 올려요']], correct:'swap', right:'맞아요! 저울에는 재고 싶은 모형 하나만 올려요.', hint:'두 개를 함께 올리면 무게가 더해져서 하나의 무게를 알 수 없어요.' } };
  }
  function update() {
    const compared = scaleComparison(state.runs);
    setMissionProgress(root,[state.zeroed,...comparisonParts.map(id=>compared.some(run=>run.parts[0]===id)),requestDone()],'');
    const bar=level===1&&!canCompleteScale(state) ? comparisonParts.map(id=>{const run=compared.find(run=>run.parts[0]===id);return `<span>${props[id].name} <strong>${run ? run.reading+' g ✓' : '아직 안 쟀어요'}</strong></span>`;}).join('') : requestBar();
    // Re-render only on change so a focused button (의뢰 받기, 손으로 들어 보기) keeps focus.
    if(bar!==requestMarkup) root.querySelector('#scale-comparison')!.innerHTML=requestMarkup=bar;
    // The letter waits until the result popup is closed so two dialogs never stack.
    if(level===1&&!busy&&!popupBusy()&&!record()&&canCompleteScale(state)) letterOnce(root,'scale',openRequest);
    root.querySelector('#scale-comparison')!.setAttribute('aria-label',level===2 ? '보급소 의뢰' : '두 모형의 측정 결과');
    root.querySelectorAll<HTMLElement>('.scale-dock [data-level]').forEach(part=>{part.hidden=Number(part.dataset.level)!==level;});
    if(level===2) renderFakeDock();
    const items=loaded();
    basketItems.innerHTML=items.map(id=>`<button class="basket-part${fakeIndex(id)>=0?' fake-basket-part':''}" data-remove="${id}" aria-label="${nameOf(id)} 저울에서 빼기">${partArt(id)}<span>${nameOf(id).replace(' 모형','')}</span><i aria-hidden="true">−</i></button>`).join('');
    readingNode.textContent=reading===null ? String(loadReading()) : String(reading);
    root.querySelector('#scale-stability')!.textContent=busy ? '안정되는 중…' : reading!==null ? zeroedNow() ? '안정 ✓' : '0 맞추기 전' : '측정값';
    root.querySelector('.scale-display')!.classList.toggle('is-stable',!busy&&reading!==null&&zeroedNow());
    root.querySelector('.scale-display')!.setAttribute('aria-busy',String(busy));
    root.querySelector<HTMLButtonElement>('#zero-button')!.disabled=busy||waiting;
    root.querySelector('#zero-button')!.classList.toggle('zeroed',zeroedNow());
    root.querySelectorAll<HTMLButtonElement>('[data-part]').forEach(button=>{button.disabled=busy||waiting||items.includes(button.dataset.part!);});
    root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(button=>button.disabled=busy||waiting);
    for(const part of scaleParts) {
      const known=state.runs.find(run=>run.zeroed && run.parts.length===1 && run.parts[0]===part.id);
      root.querySelector(`[data-known="${part.id}"]`)!.textContent=known ? `발견 ${known.reading} g` : '무게 ?';
    }
    if(level===2) {
      const done=requestDone()&&!waiting;
      root.querySelectorAll<HTMLElement>('.fake-slot').forEach(slot=>{
        const i=Number(slot.dataset.slot), value=measured.get(i);
        slot.querySelector('[data-fake-known]')!.textContent=value ? `${value.reading} g${value.zeroed?'':' · 영점 전'}` : '무게 ?';
        slot.dataset.state=found===i ? 'fake' : value ? 'measured' : 'new';
        const pick=slot.querySelector<HTMLButtonElement>('[data-pick]')!;
        pick.disabled=busy||waiting||done;
        pick.textContent=found===i ? '가짜 ✓' : '가짜예요';
        pick.removeAttribute('aria-describedby');
      });
      const heft=root.querySelector<HTMLButtonElement>('#scale-heft');
      if(heft) heft.disabled=busy||waiting;
    }
    measure.disabled=busy||waiting||!items.length; finish.disabled=busy||waiting||!canFinish();
    root.querySelector('#scale-phase')!.textContent=phaseText();
    root.querySelector('#scale-feedback')!.textContent=feedback;
    const difference=root.querySelector<HTMLElement>('#scale-difference')!;
    difference.classList.toggle('matched',level===1 ? !!state.zeroed&&reading===targetWeight : found!==null);
    difference.textContent=differenceText();
    root.querySelector<HTMLButtonElement>('#scale-record-open')!.disabled=busy;
  }
  function animate(target:Element|null,keyframes:Keyframe[],duration:number) {
    if(!target||reducedMotion()) return;
    const motion=target.animate(keyframes,{duration,easing:'ease-out'});
    motions.add(motion); void motion.finished.then(()=>motions.delete(motion)).catch(()=>motions.delete(motion));
  }
  function bounce() {
    const motion=basket.animate([{transform:'translate(-50%,-5px)'},{transform:'translate(-50%,5px)',offset:.45},{transform:'translate(-50%,0)'}],{duration:reducedMotion()?1:350,easing:'ease-out'});
    motions.add(motion); void motion.finished.then(()=>motions.delete(motion)).catch(()=>motions.delete(motion));
  }
  function addPart(id:string) {
    if(busy||waiting||loaded().includes(id)) return;
    if(level===2) {
      const i=fakeIndex(id);
      if(i<0||i>=fakeRounds[round()].count) return;
      const swapped=fakeOn!==null;
      fakeOn=i; reading=null;
      feedback=swapped ? `${nameOf(id)}으로 바꿔 올렸어요. 하나씩 재야 비교할 수 있어요.` : `${nameOf(id)}을 올렸어요. 숫자가 멈추면 기록돼요.`;
    } else {
      if(!props[id]) return;
      state.parts.push(id); reading=null;
      feedback=`${nameOf(id)}을 올렸어요. 숫자가 멈추면 자동으로 기록돼요.`;
    }
    companion.setMood('effort'); context.commit(); context.sound(470); update(); bounce(); weigh();
  }
  function removePart(id:string) {
    if(busy||waiting) return;
    if(level===2) fakeOn=null; else state.parts=state.parts.filter(value=>value!==id);
    reading=null;
    feedback=loaded().length ? `${nameOf(id)}을 뺐어요. 무게가 얼마나 달라졌을까요?` : '저울이 비었어요. 0 g인지 확인해요.';
    context.commit(); context.sound(470); update(); bounce(); if(loaded().length) weigh();
  }
  function weigh() {
    if(busy||!loaded().length) return;
    const parts=[...loaded()]; const zeroed=zeroedNow(); const measuredLevel=level;
    const measuredValue=loadReading();
    busy=true; feedback='쟁반이 조금 흔들려요. 숫자가 멈추면 기록해요.'; companion.setMood('observe'); update();
    const started=performance.now(); const duration=reducedMotion()?1:950;
    const from=Number(readingNode.textContent)||0; const wasComplete=canCompleteScale(state);
    const tick=(now:number)=>{
      if(!active) return;
      const progress=Math.min(1,(now-started)/duration);
      const eased=1-Math.pow(1-Math.min(1,progress/.7),3);
      readingNode.textContent=String(Math.max(0,Math.round(from+(measuredValue-from)*eased+Math.sin(progress*17)*6*(1-progress))));
      if(progress<1) { frame=requestAnimationFrame(tick); return; }
      frame=0; busy=false; reading=measuredValue;
      if(measuredLevel===2) {
        const slot=fakeIndex(parts[0]);
        measured.set(slot,{reading:measuredValue,zeroed});
        const sameAsBefore=[...measured].some(([other,value])=>other!==slot&&value.zeroed===zeroed&&value.reading===measuredValue);
        feedback=!zeroed ? `${nameOf(parts[0])} ${measuredValue} g? 빈 저울의 ${emptyScaleReading} g이 더해진 숫자예요. 그래도 부품끼리 비교는 할 수 있어요.` : `${nameOf(parts[0])}은 ${measuredValue} g이에요.${measured.size<2 ? ' 다른 부품도 재 봐요.' : sameAsBefore ? ' 앞에서 잰 부품과 숫자가 같아요.' : ' 앞에서 잰 숫자와 비교해 봐요.'}`;
        companion.setMood('observe'); context.sound(520); update();
      } else {
        state.runs=recordScaleRun(state.runs,{parts,reading:measuredValue,zeroed});
        feedback=!zeroed ? '빈 저울을 0으로 맞춰야 정확히 잴 수 있어요. 이것을 영점 맞추기라고 해요.' : canCompleteScale(state) ? '저울로 어느 쪽이 얼마나 무거운지 알아냈어요! 보급소 직원의 의뢰가 도착했어요.' : parts.length>1 ? '비교할 때는 사과와 책 모형을 하나씩 올려요.' : `${props[parts[0]].name}은 ${measuredValue} g이에요. 다른 모형과 비교해요.`;
        companion.setMood(zeroed&&measuredValue===targetWeight?'success':'observe'); context.commit(); context.sound(zeroed&&measuredValue===targetWeight?730:520);
        if(!wasComplete) showResult(measureResult(parts,measuredValue,zeroed));
        update();
      }
      if(zeroed) animate(root.querySelector('#scale-stability'),[{transform:'scale(1.35)'},{transform:'scale(1)'}],280);
    };
    frame=requestAnimationFrame(tick);
  }
  function openRequest() {
    if(busy||level!==1||!canCompleteScale(state)) return;
    context.save.levels ??= {};
    context.save.levels.scale ??= {cleared:[],attempts:0};
    level=2; lastResult=null; state.parts=[]; reading=null; fakeZeroed=false; fakeOn=null; misses=0; found=null; measured.clear();
    feedback='의뢰용 저울을 새로 켰어요. 빈 저울의 숫자부터 확인해요.';
    context.commit(); context.sound(620); companion.setMood('observe'); update();
    root.querySelector<HTMLElement>('#scale-phase')!.focus({preventScroll:true});
  }
  function heft() {
    if(busy||waiting||level!==2) return;
    feedback='손으로 들어 보니 모두 비슷해요. 몇 g 차이는 손으로 알기 어려워요. 저울로 재 봐요.';
    context.sound(400); update();
    root.querySelectorAll('.fake-part img').forEach((image,i)=>animate(image,[{transform:'translateY(0) rotate(0)'},{transform:`translateY(-7px) rotate(${i%2?4:-4}deg)`,offset:.3},{transform:`translateY(-3px) rotate(${i%2?-3:3}deg)`,offset:.6},{transform:'translateY(0) rotate(0)'}],600));
  }
  function pick(slot:number) {
    if(busy||waiting||level!==2||requestDone()) return;
    const current=round(), result=judgeFakePick(current,fakeSeed,slot,[...measured.keys()]);
    if(result==='unmeasured') {
      feedback=`${fakeLabels[slot]} 부품은 아직 안 쟀어요. 먼저 이 부품을 저울에 올려 무게를 재 봐요.`;
      context.toast(feedback); context.sound(340); update();
      // Keep the next action visible after the short toast has disappeared.
      root.querySelector('#scale-difference')!.textContent=feedback;
      const pickButton = root.querySelector<HTMLButtonElement>(`[data-pick="${slot}"]`)!;
      pickButton.textContent='아직 안 쟀어요 · 먼저 재요';
      pickButton.setAttribute('aria-describedby','scale-difference');
      return;
    }
    context.save.levels!.scale=recordFakePick(record()!,current,result);
    context.commit();
    if(result==='real') {
      misses++;
      feedback=`${fakeLabels[slot]} 부품은 진짜였어요. ${fakeHint(misses,fakeZeroed)}`;
      companion.setMood('observe'); context.sound(520);
      showResult({ title:`${fakeLabels[slot]} 부품은 진짜였어요`, text:fakeHint(misses,fakeZeroed), records:recordsMarkup(), question:{ prompt:'가짜 부품은 어떻게 찾을 수 있을까요?', choices:[['look','겉모습을 자세히 봐요'],['number','하나씩 재서 숫자가 다른 부품을 찾아요']], correct:'number', right:'맞아요! 진짜 부품끼리는 숫자가 같아요. 다른 숫자가 나오는 부품이 가짜예요.', hint:'부품들은 겉모습이 똑같아요. 눈으로는 구별할 수 없어요.' } });
      update(); return;
    }
    const r=fakeRounds[current];
    found=slot; companion.setMood('success'); context.sound(780);
    feedback=`찾았어요! 진짜는 ${r.real} g, ${fakeLabels[slot]} 부품만 ${r.fake} g이었어요.${fakeZeroed ? '' : ' 0을 맞추면 진짜 무게도 바로 알 수 있어요.'}`;
    animate(root.querySelector(`.fake-slot[data-slot="${slot}"]`),[{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],420);
    showResult({ title:requestDone() ? '의뢰를 모두 해결했어요!' : `찾았어요! ${fakeLabels[slot]} 부품이 가짜예요`, text:`진짜는 ${r.real} g, ${fakeLabels[slot]} 부품만 ${r.fake} g이었어요.${fakeZeroed ? '' : ' 0을 맞추면 진짜 무게도 바로 알 수 있어요.'}${requestDone() ? ' 아래의 ‘비교 기록 저장’을 눌러 보급소에 알려요.' : ' 다음 의뢰는 부품이 더 많고 차이도 더 작아요.'}`, records:recordsMarkup(current), question:{ prompt:`가짜 부품은 진짜보다 ${r.fake<r.real ? '가벼웠나요, 무거웠나요' : '무거웠나요, 가벼웠나요'}?`, choices:[['light',`가벼웠어요 (${r.fake<r.real ? r.real-r.fake : r.fake-r.real} g 차이)`],['heavy',`무거웠어요 (${r.fake<r.real ? r.real-r.fake : r.fake-r.real} g 차이)`]], correct:r.fake<r.real ? 'light' : 'heavy', right:`맞아요! ${r.fake} g은 ${r.real} g보다 ${r.fake<r.real ? '작아서 가벼워요' : '커서 무거워요'}.`, hint:`${r.fake} g과 ${r.real} g 중 어느 숫자가 더 큰지 비교해 봐요.` } });
    if(requestDone()) { feedback+=' 의뢰를 모두 해결했어요! 비교 기록을 저장해요.'; update(); return; }
    waiting=true; update();
    timer=window.setTimeout(()=>{
      if(!active) return;
      waiting=false; fakeOn=null; reading=null; misses=0; found=null; measured.clear();
      feedback=`다음 의뢰예요. 이번에는 부품이 ${fakeRounds[round()].count}개, 차이도 더 작대요!`;
      update();
      root.querySelector<HTMLElement>('#scale-phase')!.focus({preventScroll:true});
    },reducedMotion()?400:1600);
  }
  // Optional inquiry: spring scale. Screw, hung object and eye level are session play; only readings are saved.
  const spring=root.querySelector<HTMLElement>('#spring-lab')!;
  const section=root.querySelector<HTMLElement>('.scale-screen')!;
  const eyes:EyeLevel[]=['above','level','below'];
  let springOffset=springStartOffset, springObject='', springEye:EyeLevel='level', swinging=false, springTimer=0;
  let springFeedback='빈 저울의 바늘이 0을 가리키나요? 영점 나사를 돌려 0에 맞춰요.';
  const pxPerGram=2;
  function renderSpring() {
    const reads=state.springReads??[];
    // The pointer sits at the true value; the mark strip shifts with the eye, so a wrong eye level really reads a different number.
    spring.querySelector<HTMLElement>('#spring-pointer')!.style.setProperty('--g',String(Math.min(110,springObject ? springReading(springObject,'level',springOffset) : springOffset)));
    spring.querySelector<HTMLElement>('#spring-marks')!.style.setProperty('--shift',`${-springParallax[springEye]*pxPerGram}px`);
    spring.querySelector<HTMLElement>('#spring-scale')!.dataset.eye=springEye;
    spring.querySelector<HTMLElement>('#spring-eye-marker')!.dataset.eye=springEye;
    spring.querySelector<HTMLElement>('#spring-hook')!.innerHTML=springObject ? `${partArt(springObject)}<span>${props[springObject].name}</span>` : '<span class="spring-empty">빈 고리</span>';
    spring.querySelector('#spring-zero')!.textContent=springOffset===0 ? '0 ✓' : `빈 저울 ${springOffset} g`;
    spring.querySelector('#spring-zero')!.classList.toggle('is-zero',springOffset===0);
    spring.querySelector('#spring-swing')!.textContent=swinging ? '흔들리는 중… 기다려요' : springObject ? '멈췄어요 ✓' : '물체를 걸면 바늘이 흔들려요';
    spring.querySelector<HTMLInputElement>('#spring-eye')!.value=String(eyes.indexOf(springEye));
    spring.querySelectorAll<HTMLButtonElement>('[data-hang]').forEach(button=>{button.disabled=swinging||(button.dataset.hang||'')===springObject; button.classList.toggle('selected',!!button.dataset.hang&&button.dataset.hang===springObject);});
    spring.querySelector<HTMLButtonElement>('#spring-screw-up')!.disabled=swinging||springOffset<=-10;
    spring.querySelector<HTMLButtonElement>('#spring-screw-down')!.disabled=swinging||springOffset>=15;
    spring.querySelector<HTMLButtonElement>('#spring-read')!.disabled=swinging||!springObject;
    spring.querySelector('#spring-badge')!.textContent=springDone(reads) ? '선택 탐구 완료 ✓' : '선택 탐구';
    spring.querySelector('#spring-feedback')!.textContent=springFeedback;
    spring.querySelector('#spring-reads')!.innerHTML=reads.slice().reverse().map(r=>`<span class="spring-read${r.eye==='level'&&r.zeroed?' is-level':''}">${props[r.object].name.replace(' 모형','')} · ${springEyeLabels[r.eye]} <strong>${r.value} g</strong>${r.zeroed?'':' · 영점 전'}</span>`).join('')||'<span class="spring-read">눈높이를 바꿔 가며 읽은 값이 여기에 남아요.</span>';
  }
  function swingPointer() {
    clearTimeout(springTimer); swinging=true; renderSpring();
    animate(spring.querySelector('#spring-pointer'),[{translate:'0 0'},{translate:'0 -14px',offset:.15},{translate:'0 11px',offset:.35},{translate:'0 -7px',offset:.55},{translate:'0 4px',offset:.75},{translate:'0 0'}],1400);
    animate(spring.querySelector('#spring-hook'),[{rotate:'0deg'},{rotate:'5deg',offset:.2},{rotate:'-4deg',offset:.45},{rotate:'2deg',offset:.7},{rotate:'0deg'}],1400);
    springTimer=window.setTimeout(()=>{ if(!active) return; swinging=false; springFeedback=springObject ? '바늘이 멈췄어요. 눈높이를 정면에 맞추고 눈금을 읽어요.' : '빈 고리예요. 바늘이 0인지 확인해요.'; renderSpring(); },reducedMotion()?1:1400);
  }
  function openSpring() {
    section.dataset.spring='open'; spring.hidden=false; context.sound(620); renderSpring();
    spring.querySelector<HTMLElement>('#spring-close')!.focus({preventScroll:true});
  }
  function closeSpring() {
    clearTimeout(springTimer); swinging=false; delete section.dataset.spring; spring.hidden=true; update();
    root.querySelector<HTMLElement>('#scale-phase')!.focus({preventScroll:true});
  }
  spring.addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('button');
    if(!button||button.disabled) return;
    if(button.id==='spring-close') { closeSpring(); return; }
    if(button.id==='spring-screw-up'||button.id==='spring-screw-down') {
      springOffset=turnSpringScrew(springOffset,button.id==='spring-screw-up' ? -1 : 1);
      springFeedback=springOffset===0 ? '빈 저울이 0을 가리켜요! 이제 물체를 걸어요.' : springOffset<0 ? '조금 지나쳤어요. 반대로 돌려 0에 맞춰요.' : springObject ? '나사를 돌리면 바늘이 함께 움직여요. 빈 저울일 때 0에 맞춰요.' : `아직 ${springOffset} g이에요. 0이 될 때까지 돌려요.`;
      context.sound(springOffset===0 ? 700 : 470); renderSpring(); return;
    }
    if(button.dataset.hang!==undefined) {
      springObject=button.dataset.hang; context.sound(470);
      springFeedback=springObject ? `${props[springObject].name}을 걸었어요. 바늘이 멈출 때까지 기다려요.` : '물체를 내렸어요.';
      swingPointer(); return;
    }
    if(button.id==='spring-read') {
      const read={object:springObject,eye:springEye,value:springReading(springObject,springEye,springOffset),zeroed:springOffset===0};
      state.springReads=recordSpringRead(state.springReads??[],read);
      springFeedback=springHint(state.springReads,read);
      companion.setMood(read.eye==='level'&&read.zeroed ? 'success' : 'observe'); context.commit(); context.sound(read.eye==='level'&&read.zeroed ? 730 : 520); renderSpring();
      animate(spring.querySelector('#spring-reads .spring-read'),[{transform:'scale(1.08)'},{transform:'scale(1)'}],320);
    }
  },{signal:events.signal});
  spring.querySelector('#spring-eye')!.addEventListener('input',event=>{
    springEye=eyes[Number((event.target as HTMLInputElement).value)]??'level';
    springFeedback=springEye==='level' ? '정면이에요. 바늘과 눈금이 한 줄로 보여요.' : `${springEyeLabels[springEye]} 보면 바늘이 다른 눈금을 가리키는 것처럼 보여요. 읽어서 비교해 봐요.`;
    renderSpring();
  },{signal:events.signal});
  root.addEventListener('click',event=>{
    if(busy||(event.detail>0&&performance.now()<suppressClickUntil)) return;
    const button=(event.target as Element).closest<HTMLButtonElement>('button');
    if(!button||button.disabled) return;
    if(button.dataset.part) addPart(button.dataset.part);
    if(button.dataset.remove) removePart(button.dataset.remove);
    if(button.dataset.pick) pick(Number(button.dataset.pick));
    if(button.id==='scale-request-open') openRequest();
    if(button.id==='scale-heft') heft();
    if(button.id==='scale-spring-open') openSpring();
    if(button.id==='scale-record-open') openPopup(lastResult ? '다시 보기' : '나의 기록');
    if(button.id==='zero-button') {
      if(loaded().length) {feedback='부품이 올라가 있어요! 모두 내려놓고 빈 저울의 0을 맞춰요.'; context.sound(340); update(); return;}
      if(level===2) fakeZeroed=true; else state.zeroed=true;
      reading=null; feedback='빈 저울이 0 g이에요! 이제 부품의 무게만 잴 수 있어요.';context.commit();context.sound(700);update();
    }
    if(button.id==='scale-measure') { if(level===2) fakeOn=null; else state.parts=[]; reading=null; feedback=level===2 ? '빈 저울이에요. 다른 부품 하나를 올려요.' : '빈 저울이에요. 다른 모형 하나를 올려요.'; context.commit(); update(); }
    if(button.id==='scale-finish'&&canFinish()) {
      context.finish('scale',`빈 저울을 0으로 맞추고 사과 모형 80 g과 책 모형 70 g을 하나씩 재었어요. 사과 모형이 10 g 더 무거웠어요. 겉모습으로 헷갈리던 무게를 저울의 숫자로 정확히 비교했어요. ${fakeSummary(record()!)}${springDone(state.springReads) ? ' '+springSummary(state.springReads) : ''}`);
    }
  },{signal:events.signal});
  let drag:{pointer:number;source:HTMLElement;id:string;fromBasket:boolean;x:number;y:number;moved:boolean;ghost:HTMLElement|null}|null=null;
  function endDrag() {
    if(!drag)return;
    const current=drag; drag=null;
    current.ghost?.remove(); if(current.source.hasPointerCapture(current.pointer))current.source.releasePointerCapture(current.pointer);
    basket.classList.remove('drop-ready'); root.querySelector('#scale-shelf')!.classList.remove('drop-ready');
    if(popupPending&&active) { popupPending=false; openPopup('실험 결과'); }
  }
  root.addEventListener('pointerdown',event=>{
    if(busy||waiting||event.button!==0||drag)return;
    const source=(event.target as Element).closest<HTMLButtonElement>('[data-part],[data-remove]');
    if(!source||source.disabled)return;
    drag={pointer:event.pointerId,source,id:source.dataset.part??source.dataset.remove!,fromBasket:!!source.dataset.remove,x:event.clientX,y:event.clientY,moved:false,ghost:null};
    source.setPointerCapture(event.pointerId);
  },{signal:events.signal});
  root.addEventListener('pointermove',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    drag.moved ||= Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7;
    if(!drag.moved)return;
    if(!drag.ghost){drag.ghost=document.createElement('div');drag.ghost.className='instrument-drag-ghost scale-drag-ghost';drag.ghost.innerHTML=partArt(drag.id);document.body.append(drag.ghost);}
    drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
    const over=document.elementFromPoint(event.clientX,event.clientY);
    basket.classList.toggle('drop-ready',!drag.fromBasket&&!!over?.closest('#scale-basket, .scale-body, .instrument-stage'));
    root.querySelector('#scale-shelf')!.classList.toggle('drop-ready',drag.fromBasket&&!!over?.closest('#scale-shelf'));
  },{signal:events.signal});
  root.addEventListener('pointerup',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    const current=drag;const over=document.elementFromPoint(event.clientX,event.clientY);
    if(current.moved)suppressClickUntil=performance.now()+350;
    endDrag();
    if(!current.moved)return;
    if(current.fromBasket&&over?.closest('#scale-shelf'))removePart(current.id);
    else if(!current.fromBasket&&over?.closest('#scale-basket, .scale-body, .instrument-stage'))addPart(current.id);
  },{signal:events.signal});
  root.addEventListener('pointercancel',endDrag,{signal:events.signal});
  root.addEventListener('lostpointercapture',endDrag,{signal:events.signal});
  window.addEventListener('blur',endDrag,{signal:events.signal});
  window.addEventListener('resize',endDrag,{signal:events.signal});
  update(); if(level===1&&state.parts.length) weigh();
  return()=>{active=false;popup?.remove();clearTimeout(timer);clearTimeout(springTimer);endDrag();events.abort();cancelAnimationFrame(frame);motions.forEach(motion=>motion.cancel());companion.dispose();};
}
