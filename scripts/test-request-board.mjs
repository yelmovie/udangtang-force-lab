import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Import the actual TypeScript modules without producing build files or adding dependencies.
const moduleUrls = new Map();
function moduleUrl(filename) {
  const absolute = path.resolve(filename);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(/(from\s*|import\s*)(['"])(\.\.?\/[^'"]+)\2/g, (_match, prefix, quote, relative) => {
    const dependency = path.resolve(path.dirname(absolute), relative);
    return `${prefix}${quote}${moduleUrl(path.extname(dependency) ? dependency : `${dependency}.ts`)}${quote}`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  moduleUrls.set(absolute, url);
  return url;
}
const state = await import(moduleUrl('src/state.ts'));
const board = await import(moduleUrl('src/requestBoard.ts'));
const cargo = await import(moduleUrl('src/cargoModel.ts'));
const balance = await import(moduleUrl('src/balanceModel.ts'));
const scale = await import(moduleUrl('src/scaleModel.ts'));
const workshop = await import(moduleUrl('src/workshopModel.ts'));

const completeBase = save => {
  save.cargo.orders=[]; save.cargo.runs=['push','pull'].flatMap(action=>[1,3,5].map(parts=>({parts,action,gesture:100,distance:cargo.cargoDistance(parts)})));
  save.balance.runs=[{left:'A',right:'B',actual:'right'},{left:'A',right:'C',actual:'level'},{left:'B',right:'C',actual:'left'}].map(run=>({...run,prediction:run.actual}));
  save.scale.zeroed=true;save.scale.runs=[['orange',80],['teal',45],['cream',25],['blue',70],['green',55]].map(([id,reading])=>({parts:[id],reading,zeroed:true}));
  save.workshop.direct=true;save.workshop.trials=workshop.retainWorkshopRuns([0,1,2].map(setting=>({tool:'lever',setting})).concat([0,1].map(setting=>({tool:'ramp',setting}))));
  return save;
};
const range = n => Array.from({ length: n }, (_, i) => i);
const statuses = save => Object.fromEntries(board.requestBoard(save).map(card => [card.stage, card.status]));
const solveAll = save => {
  save.cargo.orders = cargo.cargoOrders.map(order => cargo.orderSolution(order));
  save.levels = {
    balance: { cleared: range(balance.mysteryRoundCount), attempts: 4 },
    scale: { cleared: range(scale.fakeRounds.length), attempts: 3 },
    workshop: { cleared: range(workshop.workshopCargos.length), attempts: 5 },
  };
  return save;
};

test('the board lists the four clients in mission order with the planned lines', () => {
  const cards = board.requestBoard(state.freshSave());
  assert.deepEqual(cards.map(card => card.stage), ['cargo', 'balance', 'scale', 'workshop']);
  assert.deepEqual(cards.map(card => card.client), ['빵집 주인', '다리 점검원', '보급소 직원', '공방 친구']);
  assert.equal(cards[0].quote, '오븐이 고장 났어요! 수리 부품 상자를 가게 문 앞 노란 칸에 딱 멈춰 줄래요?');
  assert.equal(cards[2].quote, '부품 하나가 가짜래요. 눈으로는 모르겠어요.');
  assert.equal(new Set(cards.map(card => card.pose)).size, 4, 'each client has their own drawing');
  assert.ok(cards.every(card => card.hue === 0), 'own drawings are shown untinted');
});

test('a fresh save has every request locked until its level 1', () => {
  const save = state.freshSave();
  assert.deepEqual(statuses(save), { cargo: 'locked', balance: 'locked', scale: 'locked', workshop: 'locked' });
  assert.ok(board.requestBoard(save).every(card => !card.optional && card.statusText === '실험 1단계를 마치면 열려요'));
  assert.deepEqual(board.solvedRequests(save), []);
});

test('level 1 findings open each request, even before the request is taken', () => {
  const save = state.freshSave();
  completeBase(save);
  assert.ok(scale.scaleExplorationReady(save.scale));
  assert.deepEqual(statuses(save), { cargo: 'open', balance: 'open', scale: 'open', workshop: 'open' });
  assert.ok(board.requestBoard(save).every(card => card.statusText === '도와줄 수 있어요'));
});

test('one tilted balance comparison alone keeps the bridge request locked', () => {
  const save = state.freshSave();
  save.balance.runs = [{ left: 'A', right: 'B', prediction: 'left', actual: 'left' }];
  assert.equal(board.requestStatus(save, 'balance'), 'locked');
});

test('a completed mission counts as level 1 done, and an old save without level 2 records stays open', () => {
  const save = state.freshSave();
  save.completed = ['cargo', 'balance', 'scale', 'workshop'];
  assert.deepEqual(statuses(save), { cargo: 'open', balance: 'open', scale: 'open', workshop: 'open' });
});

test('finished level 2 records solve each request from the saved records', () => {
  const save = solveAll(state.freshSave());
  assert.deepEqual(statuses(save), { cargo: 'solved', balance: 'solved', scale: 'solved', workshop: 'solved' });
  assert.deepEqual(board.solvedRequests(save), ['cargo', 'balance', 'scale', 'workshop']);
  assert.ok(board.requestBoard(save).every(card => card.statusText === '해결했어요 ✓'));
});

test('partial level 2 progress is still open, not solved', () => {
  const save = completeBase(state.freshSave());
  save.cargo.orders = [cargo.orderSolution(cargo.cargoOrders[0])];
  save.cargo.runs = ['push','pull'].flatMap(action => [1,3,5].map(parts => ({parts,action,gesture:100,distance:cargo.cargoDistance(parts)})));
  save.levels = { balance: { cleared: [0], attempts: 2 }, scale: { cleared: [1], attempts: 2 }, workshop: { cleared: [0, 1], attempts: 4 } };
  assert.deepEqual(statuses(save), { cargo: 'open', balance: 'open', scale: 'open', workshop: 'open' });
});

test('only requests solved since the last village visit count as new', () => {
  assert.deepEqual(board.newlySolved(undefined, ['cargo']), [], 'no earlier visit: nothing to animate');
  assert.deepEqual(board.newlySolved([], ['cargo']), ['cargo']);
  assert.deepEqual(board.newlySolved(['cargo'], ['cargo', 'scale']), ['scale']);
  assert.deepEqual(board.newlySolved(['cargo', 'scale'], ['cargo', 'scale']), []);
});

test('thank-you lines name what the student did', () => {
  const save = solveAll(state.freshSave());
  assert.equal(board.requestThanks(save, 'cargo'), '고마워요! 부품 5개 상자를 큰 힘으로 딱 멈춰 줬어요. 덕분에 오븐을 고쳐서 빵을 다시 구워요.');
  assert.match(board.requestThanks(save, 'balance'), /수평대로 비교해서 .*무거운 기둥 부품을 2번 모두 찾아 줬어요/);
  assert.match(board.requestThanks(save, 'scale'), /저울로 재서 47 g, 42 g짜리 가짜 부품을 가려내 줬어요/);
  assert.match(board.requestThanks(save, 'workshop'), /가벼운 화물, 보통 화물, 무거운 화물을 모두 올려 줬어요/);
});

test('board judgements never change the save', () => {
  const save = solveAll(state.freshSave());
  const before = JSON.stringify(save);
  board.requestBoard(save); board.solvedRequests(save);
  for (const stage of board.requestStages) { board.requestStatus(save, stage); board.requestThanks(save, stage); }
  assert.equal(JSON.stringify(save), before);
});


test('an old early cargo request does not bypass an unfinished pull comparison', () => {
  const save=state.freshSave();save.cargo.orders=[];
  save.cargo.runs=[{parts:1,action:'push',gesture:100,distance:66},{parts:5,action:'push',gesture:100,distance:22},{parts:5,action:'pull',gesture:100,distance:22}];
  assert.equal(board.requestStatus(save,'cargo'),'locked');
  save.cargo.runs.push({parts:1,action:'pull',gesture:100,distance:66},{parts:3,action:'push',gesture:100,distance:33},{parts:3,action:'pull',gesture:100,distance:33});
  assert.equal(board.requestStatus(save,'cargo'),'open');
});

test('every missing basic activity keeps each request locked, including stale request records',()=>{
  const required={cargo:6,balance:3,scale:5,workshop:6};
  for(const [stage,count] of Object.entries(required)) for(let missing=0;missing<count;missing++) {
    const save=completeBase(state.freshSave());save.levels={balance:{cleared:[],attempts:0},scale:{cleared:[],attempts:0},workshop:{cleared:[],attempts:0}};
    if(stage==='workshop') {if(missing===5)save.workshop.direct=false;else save.workshop.trials.splice(missing,1);}
    else save[stage].runs.splice(missing,1);
    assert.equal(board.requestStatus(save,stage),'locked',stage+' missing '+missing);
  }
});
test('all subsets of the scale models require five separate zeroed measurements',()=>{
  const save=completeBase(state.freshSave()), all=save.scale.runs;
  for(let mask=0;mask<32;mask++)assert.equal(scale.scaleExplorationReady({...save.scale,runs:all.filter((_,i)=>mask&(1<<i))}),mask===31);
  assert.equal(scale.scaleExplorationReady({...save.scale,runs:all.map(run=>({...run,zeroed:false}))}),false);
  assert.equal(scale.scaleExplorationReady({...save.scale,runs:[{parts:all.flatMap(run=>run.parts),reading:275,zeroed:true}]}),false);
});
test('workshop requires direct lift, all three fulcrums and both ramps',()=>{
  const base=completeBase(state.freshSave()).workshop;
  for(let mask=0;mask<64;mask++)assert.equal(workshop.workshopExplorationReady({...base,direct:!!(mask&32),trials:base.trials.filter((_,i)=>mask&(1<<i))}),mask===63);
});
