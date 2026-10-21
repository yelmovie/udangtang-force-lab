// Open /scripts/tablet-ui.fixture.html on the Vite dev server.
// This test entry is not imported by the production app or included in its build.
import '../src/style.css';
import '../src/adventure.css';
import '../src/display.css';
import '../src/polish.css';
import '../src/stagePopup.css';
import '../src/studentUx.css';
import { scaleParts } from '../src/data.ts';
import { cargoDistance } from '../src/cargoModel.ts';
import { retainWorkshopRuns } from '../src/workshopModel.ts';
import { freshSave } from '../src/state.ts';
import { mountBalance } from '../src/screens/balance.ts';
import { mountCargo } from '../src/screens/cargo.ts';
import { mountScale } from '../src/screens/scale.ts';
import { mountWorkshop } from '../src/screens/workshop.ts';
import { mountRescue } from '../src/screens/rescue.ts';
import { mountVillage } from '../src/screens/village.ts';
import { showRequestLetter } from '../src/requestLetter.ts';
import { showPredictionChip } from '../src/predictionChip.ts';
import { DefaultLoadingManager } from 'three';
import { openLearningReview } from '../src/learningReview.ts';
import { learningTask } from '../src/learningModel.ts';
import { openLifeObservation, lifeCards, introHelpFor, emptyLifeObservation, dropLifeCard } from '../src/lifeObservation.ts';
import '../src/learning.css';
import '../src/questionUI.css';
import '../src/tabletUx.css';

const root = document.querySelector('#screen'), results = document.querySelector('#results');
const panel = document.querySelector('#test-panel');
const style = document.createElement('style');
style.textContent = '#test-panel{position:fixed;top:0;left:140px;z-index:9999;background:#fff;padding:8px;max-height:45vh;overflow:auto;font:14px monospace;max-width:calc(100vw - 300px)}#test-panel button{min-height:44px;margin:3px}#test-panel pre{white-space:pre-wrap}';
document.head.append(style);
let cleanup, context, failMode = '', finished = 0, destination = '', notices = [];
const originalContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  if (failMode === 'webgl' && /webgl/.test(type)) return null;
  return originalContext.call(this, type, ...args);
};
DefaultLoadingManager.setURLModifier(url => failMode === 'asset' && /workshop.*\.(webp|glb)/.test(url) ? '/__missing_tablet_test_asset__' : url);
const allCargo=()=>['push','pull'].flatMap(action=>[1,3,5].map(parts=>({parts,action,gesture:100,distance:cargoDistance(parts)})));
const allScale=()=>scaleParts.map(part=>({parts:[part.id],reading:part.weight,zeroed:true}));
const allBalance=()=>[{left:'A',right:'B',prediction:'right',actual:'right'},{left:'A',right:'C',prediction:'level',actual:'level'},{left:'B',right:'C',prediction:'left',actual:'left'}];
const allWorkshop=()=>retainWorkshopRuns([0,1,2].map(setting=>({tool:'lever',setting})).concat([0,1].map(setting=>({tool:'ramp',setting}))));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 10000) {
  const start = performance.now();
  while (!predicate()) { if (performance.now() - start > timeout) throw new Error(`Timeout: ${label}`); await sleep(30); }
}
function mount(screen, save = freshSave()) {
  cleanup?.(); root.replaceChildren(); finished = 0; destination = ''; notices = [];
  context = { save, commit() {}, sound() {}, toast(text) { notices.push(text); }, navigate(page) { destination = page; }, finish() { finished++; } };
  cleanup = screen(root, context);
}
function failure(kind) { return root.querySelector(`.scene-recovery[data-failure="${kind}"]:not([hidden])`); }
async function readyWorkshop() { await until(() => root.querySelector('#workshop-handle:not(:disabled)') && !root.querySelector('.scene-recovery:not([hidden])'), 'workshop ready'); }
function click(selector) { const button = root.querySelector(selector); assert(button && !button.disabled, `available ${selector}`); button.click(); }
function captureStub(element) {
  let pointer;
  element.setPointerCapture = id => { pointer = id; };
  element.hasPointerCapture = id => pointer === id;
  element.releasePointerCapture = () => { pointer = undefined; };
  return () => pointer === undefined;
}
function gesture(element, stop = 'pointercancel', capture = element) {
  const released = captureStub(capture), rect = element.getBoundingClientRect();
  const dispatch = (type, x, y) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', button: 0, clientX: x, clientY: y }));
  dispatch('pointerdown', rect.x + rect.width / 2, rect.y + rect.height / 2);
  dispatch('pointermove', -20, -20); // Move outside the screen while captured.
  if (stop === 'resize' || stop === 'blur') window.dispatchEvent(new Event(stop));
  else dispatch(stop, -20, -20);
  assert(released(), `${stop}: capture released`);
  assert(!document.querySelector('.instrument-drag-ghost, .cargo-load-ghost'), `${stop}: no stale ghost`);
}
async function test(name, run) {
  try { await run(); results.textContent += `PASS ${name}\n`; }
  catch (error) { results.textContent += `FAIL ${name}: ${error.message}\n`; }
  finally { failMode = ''; cleanup?.(); cleanup = null; root.replaceChildren(); }
}

document.querySelector('#run-tests').addEventListener('click', async event => {
  event.target.disabled = true; results.textContent = ''; panel.style.pointerEvents = 'none';
  for (const kind of ['webgl', 'asset']) await test(`${kind}: failure → retry → map, saved progress unchanged`, async () => {
    failMode = kind;
    const save = freshSave(); save.workshop.direct = true;
    const before = JSON.stringify(save);
    mount(mountWorkshop, save);
    await until(() => failure(kind), `${kind} error`);
    assert(root.querySelector('#workshop-handle').disabled, 'failed scene blocks experiments');
    assert(finished === 0, 'failure cannot finish');
    const retry = root.querySelector('[data-scene-retry]');
    assert(retry.getBoundingClientRect().height >= 44, 'retry touch size');
    failMode = ''; retry.click(); retry.click(); // A stale duplicate click cannot start a second load.
    await readyWorkshop(); await sleep(1000);
    assert(!root.querySelector('.scene-recovery:not([hidden])'), 'retry remains usable');
    assert(JSON.stringify(save) === before, 'retry preserved progress');
    assert(root.querySelectorAll('#workshop-canvas canvas').length === 1, 'single renderer');
    const gl = root.querySelector('canvas').getContext('webgl2');
    assert(gl?.getExtension('WEBGL_lose_context'), 'context loss extension available');
    gl.getExtension('WEBGL_lose_context').loseContext();
    await until(() => failure('context-lost'), 'context-lost panel');
    assert(finished === 0 && JSON.stringify(save) === before, 'loss preserved progress');
    click('[data-scene-map]'); assert(destination === 'map', 'map return available');
  });
  await test('context-lost → retry recovers interaction', async () => {
    mount(mountWorkshop); await readyWorkshop();
    root.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
    await until(() => failure('context-lost'), 'loss'); click('[data-scene-retry]'); await readyWorkshop();
    click('[data-tool="ramp"]'); assert(root.querySelector('[data-tool="ramp"]').getAttribute('aria-pressed') === 'true', 'tool works');
  });
  await test('context-lost during an open result exposes recovery without losing the result', async () => {
    mount(mountWorkshop); await readyWorkshop();
    const handle = root.querySelector('#workshop-handle');
    handle.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));
    await until(() => context.save.workshop.direct, 'direct experiment');
    handle.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter',bubbles:true}));
    assert(!root.querySelector('dialog[open]'),'direct activity does not interrupt with a popup');
    click('#workshop-open-record');await until(() => root.querySelector('dialog[open]'), 'manual result popup');
    const before = JSON.stringify(context.save);
    root.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
    await until(() => failure('context-lost') && !root.querySelector('dialog[open]'), 'uncovered recovery');
    assert(JSON.stringify(context.save) === before && finished === 0, 'result retained without completion');
  });
  for (const stop of ['pointercancel', 'resize', 'blur']) {
    await test(`balance ${stop}: outside drag cancels, tap placement still works`, async () => {
      mount(mountBalance); gesture(root.querySelector('[data-object="A"]'), stop);
      click('[data-object="A"]'); click('[data-pan="left"]');
      assert(context.save.balance.left === 'A', 'tap placement works after cancellation');
      assert(context.save.balance.runs.length === 0, 'cancellation adds no result');
    });
    await test(`scale ${stop}: outside drag cancels, next measurement works`, async () => {
      mount(mountScale); gesture(root.querySelector('[data-part="orange"]'), stop);
      click('[data-part="orange"]');
      await until(() => context.save.scale.runs.length === 1, 'measurement');
      assert(context.save.scale.runs.length === 1, 'one measurement');
    });
    await test(`cargo ${stop}: outside drag cancels without experiment`, async () => {
      mount(mountCargo); gesture(root.querySelector('[data-parts="5"]'), stop);
      click('[data-parts="5"]'); assert(context.save.cargo.parts === 5, 'part selection works');
      assert(context.save.cargo.runs.length === 0, 'no unintended run');
    });
    await test(`workshop ${stop}: cancellation restores controls`, async () => {
      mount(mountWorkshop); await readyWorkshop(); await sleep(400);
      // Keep movement below the completion threshold while testing interrupted input.
      const handle = root.querySelector('#workshop-handle'), released = captureStub(handle), r = handle.getBoundingClientRect();
      handle.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true,pointerType:'touch',pointerId:7,clientX:r.x,clientY:r.y}));
      if (stop === 'pointercancel') handle.dispatchEvent(new PointerEvent(stop, {bubbles:true,pointerId:7}));
      else window.dispatchEvent(new Event(stop));
      assert(released(), 'capture released');
      assert(!root.querySelector('[data-tool="lever"]').disabled && !context.save.workshop.direct, 'controls unlocked, no completion');
    });
    await test(`rescue ${stop}: initial SVG drag restores controls`, async () => {
      mount(mountRescue);
      gesture(root.querySelector('#core-art'), stop, root.querySelector('svg.rescue-board') ?? root.querySelector('#core-art').closest('svg'));
      assert(!root.querySelector('.rescue-controls').inert, 'controls unlocked');
      assert(!context.save.rescue.loaded && !context.save.rescue.delivered, 'cancelled drag preserves progress');
    });
  }
  await test('cargo: finish both push and pull comparisons before the bakery letter', async () => {
    const all=allCargo();
    for(const oldRequest of [false,true]) for(let missing=0;missing<all.length;missing++){
      const save=freshSave();save.cargo.runs=all.filter((_,i)=>i!==missing).map(run=>({...run}));
      if(oldRequest)save.cargo.orders=[];
      mount(mountCargo,save);
      assert(root.querySelector('.cargo-finding-cta').hidden,'one missing comparison cannot finish exploration');
      assert(!root.querySelector('#request-letter-title'),'no early letter even with an old empty request record');
      click('#cargo-record-open');
      assert(!root.querySelector('[data-finding]'),'question waits for all six observations');
      click('.stage-popup-continue');await until(()=>!root.querySelector('dialog'),'partial records closed');
    }
    const save=freshSave();save.cargo.parts=1;save.cargo.action='pull';save.cargo.runs=all.filter(run=>!(run.parts===1&&run.action==='pull')).map(run=>({...run}));
    mount(mountCargo,save);click('#cargo-tap-go');
    assert(save.cargo.runs.length===5 && !root.querySelector('#request-letter-title'),'last pull still animating: no completion or letter');
    await until(()=>save.cargo.runs.length===6,'last pull stopped');
    await until(()=>root.querySelector('dialog[open]'),'last pull result');
    assert(!root.querySelector('#request-letter-title'),'result can be read before the letter');
    assert(root.querySelector('[data-finding]'),'question opens after all six observations');
    click('.stage-popup-continue');await until(()=>!root.querySelector('dialog'),'question dismissed');
    click('#cargo-record-open');click('[data-finding="heavy"]');
    assert(!root.querySelector('#request-letter-title') && finished===0,'incorrect answer cannot open the request');
    click('[data-finding="light"]');
    assert(!root.querySelector('#request-letter-title'),'correct finding does not auto-open a letter');
    click('#cargo-open-orders');await until(()=>root.querySelector('#request-letter-title'),'letter after explicit request button');
    assert(save.cargo.runs.length===6 && finished===0,'request preserves all observations');
  });
  for(const roundIndex of [0,1]) await test('balance: '+(roundIndex===0?3:4)+' boxes finish comparison before the question popup', async () => {
    const save=freshSave();save.balance.runs=allBalance();
    save.levels={balance:{cleared:roundIndex===0?[]:[0],attempts:0}};
    mount(mountBalance,save);
    const ids=[...root.querySelectorAll('.mystery-card')].map(card=>card.dataset.object);
    assert(ids.length===(roundIndex===0?3:4),'round size');
    let best=ids[0];
    for(let index=1;index<ids.length;index++){
      click('[data-object="'+best+'"]');click('[data-pan="left"]');click('[data-object="'+ids[index]+'"]');click('[data-pan="right"]');click('#balance-test');
      assert(!root.querySelector('dialog[open]'),'no question during the measurement');
      await until(()=>!root.querySelector('#balance-record').disabled,'comparison stopped');
      const angle=parseFloat(root.querySelector('#balance-board').style.getPropertyValue('--tilt-deg'));
      if(angle>0)best=ids[index];
      if(index<ids.length-1){
        assert(!root.querySelector('dialog[open]'),'no automatic popup before every box is compared');
        click('#balance-record');assert(!root.querySelector('[data-pick]'),'manual records do not ask the answer early');
        click('#balance-popup-close');await until(()=>!root.querySelector('dialog'),'records dismissed');
      }else{
        assert(root.querySelector('dialog[open]') && root.querySelectorAll('[data-pick]').length===ids.length,'question arrives after the final comparison');
        click('[data-pick="'+best+'"]');assert(save.levels.balance.cleared.includes(roundIndex),'record-supported answer accepted');
      }
    }
  });
  await test('village: locked buildings explain the prerequisite without changing progress', async () => {
    const save = freshSave(), before = JSON.stringify(save);
    mount((root, context) => mountVillage(root, context, {adminUnlocked:false}), save);
    await until(() => root.querySelector('.village-building-label[data-stage="balance"]'), 'village ready');
    click('.village-building-label[data-stage="balance"]');
    assert(root.querySelector('.village-dialog').open, 'locked building opens dialog');
    assert(root.querySelector('#village-dialog-line').textContent.includes('물자 배송소 미션을 끝내고'), 'current prerequisite named');
    click('#village-dialog-next');
    assert(!root.querySelector('.village-dialog').open, 'acknowledge closes dialog');
    click('.village-building-label[data-stage="rescue"]');
    assert(root.querySelector('.village-dialog').open, 'another locked building also explains');
    click('#village-dialog-close');
    assert(JSON.stringify(save) === before && !destination, 'no progress or navigation from locked entry');
    click('.village-building-label[data-stage="cargo"]');
    assert(!root.querySelector('.village-dialog').open, 'open building remains usable');
  });
  await test('balance question pictures show the starting positions before a swap', async () => {
    for(const run of [{left:'A',right:'B',actual:'right'},{left:'B',right:'A',actual:'left'},{left:'C',right:'B',actual:'right'},{left:'B',right:'C',actual:'left'}]) {
      const save=freshSave();save.balance.runs=[{...run,prediction:'level'},{left:'A',right:'C',prediction:'level',actual:'level'}];
      const task=learningTask(save,'balance');
      mount((host,context)=>openLearningReview({app:document.querySelector('#app'),save:context.save,stage:'balance',commit(){},onDone(){},onClose(){}}),save);
      const layer=document.querySelector('.learning-layer');
      const names=layer.querySelector('.learning-question-pair .lb-names').textContent;
      assert(names.indexOf(run.left==='B'?'금속':run.left==='C'?'도자기':'나무')<names.lastIndexOf(run.right==='B'?'금속':run.right==='C'?'도자기':'나무'),'pictured starting pair');
      layer.querySelector('[data-learning-choice="'+task.questions[0].correct+'"]').click();
      assert(!layer.querySelector('[data-learning="next"]').disabled,'the opposite side is accepted');
      cleanup?.();
    }
  });
  await test('spring zero screw works only after the object is removed', async () => {
    const save=freshSave();save.scale.zeroed=true;save.scale.runs=allScale();
    mount(mountScale,save);click('#scale-spring-open');click('[data-hang="orange"]');
    assert(root.querySelector('#spring-screw-up').disabled && root.querySelector('#spring-screw-down').disabled,'loaded screw is disabled');
    await until(()=>!root.querySelector('[data-hang=""]').disabled,'spring steady');
    click('[data-hang=""]');await until(()=>!root.querySelector('#spring-screw-up').disabled,'empty spring');
    click('#spring-screw-up');click('#spring-screw-up');
    assert(root.querySelector('#spring-zero').textContent==='0 ✓','empty scale can be zeroed');
  });
  await test('slide introduction offers descent and hides unrelated lifting claims', async () => {
    const priorLog=results.textContent;inspect('life-intro');results.textContent=priorLog;const layer=document.querySelector('.life-layer');
    layer.querySelector('[data-intro-card="slide"]').click();
    const visible=[...layer.querySelectorAll('[data-intro-help]')].filter(b=>!b.hidden);
    assert(visible.length===1 && visible[0].textContent.includes('내려오게'),'only actual slide use');
    visible[0].click();layer.querySelector('[data-intro-where]').click();
    assert(layer.querySelector('#life-intro-sentence').textContent.includes('미끄러져 내려오게'),'correct introduction');
    layer.querySelector('[data-intro-card="scissors"]').click();
    assert(!layer.querySelector('#life-intro-sentence').textContent.includes('미끄러져'),'switching tools clears incompatible help');
    layer.querySelector('#life-close').click();
  });
  await test('scale: all five models finish before summary; letter requires an explicit click', async()=>{
    mount(mountScale);click('#zero-button');
    for(let i=0;i<scaleParts.length;i++) {
      if(i)click('#scale-measure');click('[data-part="'+scaleParts[i].id+'"]');
      await until(()=>!root.querySelector('#zero-button').disabled,'measurement stopped');
      assert(context.save.scale.runs.length===i+1,'individual measurement recorded');
      assert(!root.querySelector('#request-letter-title'),'no automatic letter');
      assert(!!root.querySelector('dialog[open]')===(i===4),'only final model opens summary');
    }
    click('.stage-popup-close');await until(()=>!root.querySelector('dialog'),'summary dismissed');
    click('#scale-measure');click('[data-part="green"]');await until(()=>!root.querySelector('#zero-button').disabled,'free experiment');
    assert(!root.querySelector('dialog[open]'),'continued experiment is uninterrupted');
    click('#scale-request-open');assert(root.querySelector('#request-letter-title'),'explicit letter opens');
    click('#request-letter-accept');assert(root.querySelector('[data-part="fake:0"]'),'request starts after acceptance');
  });
  await test('scale requests: measure every part before choosing; next round waits for a button', async()=>{
    const save=freshSave();save.scale.zeroed=true;save.scale.runs=allScale();save.levels={scale:{cleared:[],attempts:0}};
    mount(mountScale,save);
    for(let round=0;round<2;round++){
      if(round===0)click('#zero-button');
      const count=root.querySelectorAll('.fake-slot').length;
      const readings=[];
      for(let i=0;i<count;i++){
        assert([...root.querySelectorAll('[data-pick]')].every(button=>button.hidden),'answer choices wait for every measurement');
        click('[data-part="fake:'+i+'"]');await until(()=>!root.querySelector('#zero-button').disabled,'part stopped');
        assert(!root.querySelector('dialog[open]'),'no partial measurement popup');
        readings.push(parseInt(root.querySelector('[data-fake-known="'+i+'"]').textContent));
      }
      window.dispatchEvent(new Event('resize'));
      const fake=readings.findIndex(value=>readings.filter(other=>other===value).length===1);
      click('[data-pick="'+fake+'"]');assert(save.levels.scale.cleared.includes(round),'all evidence supports fake answer');
      if(round===0){
        await sleep(1800);assert(root.querySelectorAll('.fake-slot').length===count,'round stays while reading result');
        click('.stage-popup-close');await until(()=>!root.querySelector('dialog'),'result dismissed');
        assert(root.querySelector('#scale-next'),'closing result preserves next action');click('#scale-next');
      }
    }
    assert(!root.querySelector('#scale-finish').disabled,'all request rounds complete');
  });
  await test('workshop: all six basic activities precede the request',async()=>{
    for(let missing=0;missing<6;missing++){
      const save=freshSave();save.workshop.direct=missing!==5;save.workshop.trials=allWorkshop().filter((_,i)=>i!==missing);
      save.levels={workshop:{cleared:[],attempts:0}};mount(mountWorkshop,save);await readyWorkshop();
      assert(!root.querySelector('#workshop-open-request')&&!root.querySelector('#request-letter-title'),'missing activity keeps request closed');
    }
    const save=freshSave();save.workshop.direct=true;save.workshop.trials=allWorkshop().slice(0,-1);
    mount(mountWorkshop,save);await readyWorkshop();click('[data-tool="ramp"]');click('[data-ramp="1"]');
    await sleep(400);click('#design-adjustment [data-tap-run]');
    await until(()=>root.querySelector('dialog[open]'),'last activity summary',15000);
    assert(!root.querySelector('#request-letter-title'),'summary does not open a letter');
    click('#workshop-open-request');assert(root.querySelector('#request-letter-title'),'explicit workshop request letter');
  });
  await test('rescue: short ramp at small force comes before the long ramp',async()=>{
    const save=freshSave();save.rescue.zeroed=save.rescue.loaded=save.rescue.measured=save.rescue.gate=true;save.rescue.route='long';save.rescue.force=3;
    mount(mountRescue,save);
    assert(save.rescue.route==='short'&&save.rescue.force===1,'first route starts short with small force');
    assert(root.querySelector('button[data-route="long"]').disabled&&root.querySelector('#core-long-tag').disabled&&root.querySelector('#rescue-force').disabled,'all alternate controls wait for the short trial');
    await until(()=>!root.querySelector('#core-handle').disabled,'core ready',20000);click('#core-handle');
    await until(()=>save.rescue.runs.length===1,'short trial recorded');
    assert(!save.rescue.runs[0].success,'short ramp stops at small force');
    await until(()=>!root.querySelector('.rescue-controls').inert,'stopped core returned');
    assert(!root.querySelector('button[data-route="long"]').disabled,'long ramp now available');
    click('button[data-route="long"]');assert(save.rescue.force===1,'comparison keeps the same small force');
  });
  await test('balance: inline prediction and result popup can reopen without input lock', async () => {
    mount(mountBalance); click('[data-object="A"]'); click('[data-pan="left"]');
    click('[data-object="B"]'); click('[data-pan="right"]');
    assert(root.querySelector('[data-predict="right"]'),'prediction is on the stage before release');
    click('[data-predict="right"]');
    assert(!root.querySelector('#balance-test').disabled,'prediction enables the pin');
    click('#balance-test');await until(()=>!root.querySelector('#balance-record').disabled,'observed result');
    assert(!root.querySelector('dialog[open]'),'partial basic comparison does not auto-open a popup');click('#balance-record');
    click('#balance-popup-close');await until(()=>!root.querySelector('dialog'),'popup closed');
    click('#balance-record');assert(root.querySelector('dialog[open]'),'records reopen');
    click('#balance-popup-close');await until(()=>!root.querySelector('dialog'),'records closed');
    click('[data-object="C"]');click('[data-pan="right"]');click('[data-predict="level"]');
    assert(root.querySelector('#balance-phase').textContent===root.querySelector('.balance-dock .dock-label').textContent,'stage labels agree');
    assert(!root.querySelector('#balance-test').disabled,'next comparison remains usable');
  });
  await test('leaving a screen removes its explicit request letter',async()=>{
    mount(mountCargo);showRequestLetter(root,'cargo',()=>{});assert(root.querySelector('dialog[open]'),'explicit letter');
    mount(mountScale);await sleep(500);assert(!document.querySelector('#request-letter-title'),'no stale letter on another screen');
  });
  await test('balance basics: compare all three pairs before summary and explicit letter',async()=>{
    mount(mountBalance);
    const pairs=[['A','B','right'],['A','C','level'],['B','C','left']];
    for(let i=0;i<pairs.length;i++){
      const [a,b,actual]=pairs[i];click('[data-object="'+a+'"]');click('[data-pan="left"]');click('[data-object="'+b+'"]');click('[data-pan="right"]');click('[data-predict="'+actual+'"]');click('#balance-test');
      await until(()=>!root.querySelector('#balance-record').disabled,'basic comparison stopped');
      assert(!root.querySelector('#request-letter-title'),'no auto letter');
      assert(!!root.querySelector('dialog[open]')===(i===2),'only final pair opens summary');
    }
    click('#balance-popup-close');await until(()=>!root.querySelector('dialog'),'summary closed');
    assert(!root.querySelector('#request-letter-title'),'letter stays closed after summary');
    click('#balance-request-open');assert(root.querySelector('#request-letter-title'),'explicit request opens letter');
  });
  await test('core weighing: loading waits for explicit measurement record',async()=>{
    mount(mountRescue);click('[data-rescue="zero"]');click('[data-rescue="load"]');
    assert(!root.querySelector('dialog[open]')&&!context.save.rescue.measured,'placing the core does not interrupt');
    click('[data-rescue="reading"]');assert(root.querySelector('dialog[open]'),'measurement record opens explicitly');
  });
  panel.style.pointerEvents = ''; event.target.disabled = false;
  results.textContent += '\nSynthetic pointer events only; physical touch/iPad Safari not tested.\n';
});
for (const kind of ['webgl','asset']) document.querySelector(`#show-${kind}`).addEventListener('click', () => {
  failMode = kind; panel.style.display = 'none'; mount(mountWorkshop);
});
function inspect(name) {
  const save = freshSave();
  if (!name) return;
  failMode = ''; results.textContent = `Layout fixture: ${name} (seeded state, not an end-to-end playthrough)`;
  panel.style.top = '0'; panel.style.maxHeight = '58px';
  if (name === 'cargo-before-letter') {
    save.cargo.parts=1;save.cargo.action='pull';save.cargo.orders=[];
    save.cargo.runs=allCargo().filter(run=>!(run.parts===1&&run.action==='pull'));
    mount(mountCargo,save);return;
  }
  if (name === 'balance-question') {
    save.balance.runs=[{left:'C',right:'B',prediction:'left',actual:'right'},{left:'A',right:'C',prediction:'level',actual:'level'}];
    mount((host, context) => openLearningReview({app:document.querySelector('#app'),save:context.save,stage:'balance',commit(){},onDone(){},onClose(){}}),save);
    return;
  }
  if (name === 'life-intro') {
    let value=emptyLifeObservation();
    for (const card of lifeCards) value=dropLifeCard(value,card.id,card.tool).record;
    mount(() => {openLifeObservation({app:document.querySelector('#app'),value,onSave(){},onDone(){}});return () => document.querySelector('#life-close')?.click();},save);
    return;
  }
  if (name === 'scale') {
    save.scale.zeroed = true;
    save.scale.runs = allScale();
    save.levels = {scale:{cleared:[0],attempts:1}};
  }
  if (name === 'rescue') { save.rescue.zeroed = save.rescue.loaded = save.rescue.measured = save.rescue.gate = true; }
  if (name === 'balance-stage3') { save.balance.left='A'; save.balance.right='B'; save.balance.prediction='right'; }
  if (name === 'balance-request' || name === 'balance-request-4') {
    save.balance.runs=allBalance();
    save.levels={balance:{cleared:name === 'balance-request-4' ? [0] : [],attempts:0}};
  }
  if (name === 'prediction') save.inquiryPlans={balance:'same'};
  mount({cargo:mountCargo,balance:mountBalance,'balance-stage3':mountBalance,'balance-request':mountBalance,'balance-request-4':mountBalance,prediction:mountBalance,scale:mountScale,workshop:mountWorkshop,rescue:mountRescue}[name], save);
  if (name === 'prediction') showPredictionChip(root.querySelector('.instrument-stage'),save,'balance');
}
document.querySelector('#inspect-screen').addEventListener('change', event => inspect(event.target.value));
const inspectName = new URLSearchParams(location.search).get('screen');
if (inspectName === 'webgl') { failMode='webgl'; panel.hidden=true; mount(mountWorkshop); }
else if (inspectName && ['cargo','balance','balance-stage3','balance-request','balance-request-4','balance-question','life-intro','cargo-before-letter','prediction','scale','workshop','rescue'].includes(inspectName)) {
  inspect(inspectName); panel.hidden=true;
}
