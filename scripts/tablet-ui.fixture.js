// Open /scripts/tablet-ui.fixture.html on the Vite dev server.
// This test entry is not imported by the production app or included in its build.
import '../src/style.css';
import '../src/adventure.css';
import '../src/display.css';
import '../src/polish.css';
import '../src/stagePopup.css';
import '../src/studentUx.css';
import { freshSave } from '../src/state.ts';
import { mountBalance } from '../src/screens/balance.ts';
import { mountCargo } from '../src/screens/cargo.ts';
import { mountScale } from '../src/screens/scale.ts';
import { mountWorkshop } from '../src/screens/workshop.ts';
import { mountRescue } from '../src/screens/rescue.ts';
import { mountVillage } from '../src/screens/village.ts';
import { letterOnce } from '../src/requestLetter.ts';
import { showPredictionChip } from '../src/predictionChip.ts';
import { DefaultLoadingManager } from 'three';
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
    await until(() => root.querySelector('dialog[open]'), 'result popup');
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
  await test('cargo: completed comparisons reopen the question and award a request only after the finding', async () => {
    const save = freshSave();
    save.cargo.runs = [
      {parts:1,action:'push',gesture:100,distance:66},
      {parts:5,action:'push',gesture:100,distance:22},
      {parts:5,action:'pull',gesture:100,distance:22},
    ];
    mount(mountCargo, save);
    assert(root.querySelector('#cargo-record-open').textContent.includes('비교하고 의뢰 받기'), 'next action replaces passive record label');
    click('#cargo-record-open');
    assert(root.querySelector('.cargo-direction').textContent.includes('같은 힘'), 'equal distance explained');
    assert(root.querySelector('.stage-popup-continue').textContent === '더 실험해 보기', 'optional repeat is distinguished');
    click('.stage-popup-continue'); await until(() => !root.querySelector('dialog'), 'question dismissed');
    click('#cargo-record-open'); click('[data-finding="heavy"]');
    assert(!root.querySelector('#request-letter-title') && finished === 0, 'incorrect answer does not grant request or completion');
    click('[data-finding="light"]');
    await until(() => root.querySelector('#request-letter-title'), 'request after correct finding');
    assert(save.cargo.runs.length === 3 && finished === 0, 'request preserves runs and is not mission completion');
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
  await test('scale round 2: unmeasured submission explains why without awarding progress', async () => {
    const save = freshSave(); save.scale.zeroed = true;
    save.scale.runs = [{parts:['orange'],reading:80,zeroed:true},{parts:['blue'],reading:70,zeroed:true}];
    save.levels = { scale: {cleared:[0],attempts:1} };
    mount(mountScale, save); const before = JSON.stringify(save.levels);
    click('[data-pick="0"]'); click('[data-pick="0"]');
    assert(notices.at(-1)?.includes('먼저'), 'visible next-action toast');
    assert(root.querySelector('#scale-difference').textContent.includes('먼저'), 'persistent explanation');
    assert(root.querySelector('[data-pick="0"]').textContent.includes('먼저 재요'), 'next action on the pressed button');
    assert(root.querySelector('[data-pick="0"]').getAttribute('aria-describedby') === 'scale-difference', 'accessible reason');
    assert(before === JSON.stringify(save.levels) && finished === 0, 'no random-click progress');
  });
  await test('scale: a previously measured part can be submitted after another part and resize', async () => {
    const save=freshSave(); save.scale.zeroed=true;
    save.scale.runs=[{parts:['orange'],reading:80,zeroed:true},{parts:['blue'],reading:70,zeroed:true}];
    save.levels={scale:{cleared:[0],attempts:1}};
    mount(mountScale,save); click('#zero-button'); click('[data-part="fake:0"]');
    await until(()=>!root.querySelector('[data-pick="0"]').disabled,'first measurement');
    const known=root.querySelector('[data-fake-known="0"]').textContent;
    click('[data-part="fake:1"]'); await until(()=>!root.querySelector('[data-pick="1"]').disabled,'second measurement');
    window.dispatchEvent(new Event('resize')); click('[data-pick="0"]');
    assert(save.levels.scale.attempts===2,'measured submission evaluated once');
    assert(root.querySelector('[data-fake-known="0"]').textContent===known,'previous reading retained');
    assert(!notices.some(text=>text.includes('아직 안 쟀어요')),'no unnecessary remeasurement');
  });
  await test('balance: automatic prediction popup can close and reopen without input lock', async () => {
    mount(mountBalance); click('[data-object="A"]'); click('[data-pan="left"]');
    click('[data-object="B"]'); click('[data-pan="right"]');
    await until(()=>root.querySelector('dialog[open]'),'automatic prediction');
    click('#balance-popup-close'); await until(()=>!root.querySelector('dialog'),'popup closed');
    click('#balance-record'); click('[data-predict="right"]');
    assert(root.querySelector('#balance-phase').textContent===root.querySelector('.balance-dock .dock-label').textContent,'stage labels agree');
    assert(!root.querySelector('#balance-test').disabled,'pin enabled after reopening');
  });
  await test('leaving a screen cancels its pending request letter', async () => {
    const blocker = document.createElement('div'); blocker.className = 'modal-layer'; document.body.append(blocker);
    try {
      mount(mountCargo); letterOnce(root, 'cargo', () => { throw new Error('stale request accepted'); });
      mount(mountScale); blocker.remove(); await sleep(500);
      assert(!document.querySelector('#request-letter-title'), 'no stale modal on the next screen');
    } finally { blocker.remove(); }
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
  if (name === 'scale') {
    save.scale.zeroed = true;
    save.scale.runs = [{parts:['orange'],reading:80,zeroed:true},{parts:['blue'],reading:70,zeroed:true}];
    save.levels = {scale:{cleared:[0],attempts:1}};
  }
  if (name === 'rescue') { save.rescue.zeroed = save.rescue.loaded = save.rescue.measured = save.rescue.gate = true; }
  if (name === 'balance-stage3') { save.balance.left='A'; save.balance.right='B'; save.balance.prediction='right'; }
  if (name === 'balance-request') {
    save.balance.runs=[{left:'A',right:'B',prediction:'right',actual:'right'},{left:'A',right:'C',prediction:'level',actual:'level'}];
    save.levels={balance:{cleared:[],attempts:0}};
  }
  if (name === 'prediction') save.inquiryPlans={balance:'same'};
  mount({cargo:mountCargo,balance:mountBalance,'balance-stage3':mountBalance,'balance-request':mountBalance,prediction:mountBalance,scale:mountScale,workshop:mountWorkshop,rescue:mountRescue}[name], save);
  if (name === 'prediction') showPredictionChip(root.querySelector('.instrument-stage'),save,'balance');
}
document.querySelector('#inspect-screen').addEventListener('change', event => inspect(event.target.value));
const inspectName = new URLSearchParams(location.search).get('screen');
if (inspectName === 'webgl') { failMode='webgl'; panel.hidden=true; mount(mountWorkshop); }
else if (inspectName && ['cargo','balance','balance-stage3','balance-request','prediction','scale','workshop','rescue'].includes(inspectName)) {
  inspect(inspectName); panel.hidden=true;
}
