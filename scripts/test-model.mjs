import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { beforeEach } from 'node:test';
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
const model = await import(moduleUrl('src/rescueModel.ts'));
const workshop = await import(moduleUrl('src/workshopModel.ts'));
const learning = await import(moduleUrl('src/learningModel.ts'));
const inquiry = await import(moduleUrl('src/inquiryPlan.ts'));
const scaleModel = await import(moduleUrl('src/scaleModel.ts'));
const life = await import(moduleUrl('src/lifeObservation.ts'));
const challenge = await import(moduleUrl('src/challenges.ts'));
const coreScene = await import(moduleUrl('src/coreSceneModel.ts'));
test('basic scale completion needs two accurate individual measurements, not a 150 g combination', () => {
  const runs = [{parts:['orange'],reading:80,zeroed:true},{parts:['blue'],reading:70,zeroed:true}];
  assert.equal(scaleModel.canCompleteScale({zeroed:true,runs}),true);
  assert.equal(scaleModel.canCompleteScale({zeroed:false,runs}),false);
  for(const bad of [runs.slice(0,1),[{parts:['orange','blue'],reading:150,zeroed:true}],runs.map(r=>({...r,zeroed:false})),runs.map(r=>({...r,reading:99}))]) assert.equal(scaleModel.canCompleteScale({zeroed:true,runs:bad}),false);
  let recorded = runs;
  for(let i=0;i<40;i++) recorded=scaleModel.recordScaleRun(recorded,{parts:['cream'],reading:25,zeroed:true});
  assert.equal(recorded.length,3);
  assert.equal(scaleModel.canCompleteScale({zeroed:true,runs:recorded}),true);
  const save=state.freshSave(); save.scale={zeroed:true,parts:[],runs};
  const task=learning.learningTask(save,'scale');
  assert.equal(task.questions[0].id,'need-scale');
  assert.equal(task.cards.length,2);
});
test('spring scale: zero screw, eye level and saved readings behave as the inquiry describes', () => {
  assert.equal(scaleModel.springStartOffset, 10, 'an untouched spring scale does not rest at 0');
  assert.equal(scaleModel.turnSpringScrew(10, -1), 5);
  assert.equal(scaleModel.turnSpringScrew(5, -1), 0);
  assert.equal(scaleModel.turnSpringScrew(0, -1), -5, 'turning past 0 is allowed and must be turned back');
  assert.equal(scaleModel.turnSpringScrew(-10, -1), -10);
  assert.equal(scaleModel.turnSpringScrew(15, 1), 15);
  assert.equal(scaleModel.springReading('orange', 'level', 0), 80);
  assert.equal(scaleModel.springReading('orange', 'above', 0), 85, 'from above the pointer appears at a larger mark');
  assert.equal(scaleModel.springReading('orange', 'below', 0), 75);
  assert.equal(scaleModel.springReading('blue', 'level', 10), 80, 'before zeroing the book reads like the apple');
  assert.equal(scaleModel.springReading('cream', 'below', -10), 10, 'readings never go below 0');
  let reads = [];
  const above = { object: 'orange', eye: 'above', value: 85, zeroed: true };
  reads = scaleModel.recordSpringRead(reads, above);
  assert.equal(scaleModel.springDone(reads), false, 'a reading from above does not finish the inquiry');
  assert.match(scaleModel.springHint(reads, above), /정면에서 다시 읽어 볼까/);
  assert.doesNotMatch(scaleModel.springHint(reads, above), /틀렸|실패|땡|벌점/);
  const level = { object: 'orange', eye: 'level', value: 80, zeroed: true };
  reads = scaleModel.recordSpringRead(reads, level);
  assert.equal(scaleModel.springDone(reads), true);
  assert.match(scaleModel.springHint(reads, level), /위에서 읽은 85 g과 달라요/);
  assert.match(scaleModel.springHint(reads, above), /85 g, 정면에서 80 g/, 'a later wrong-eye reading becomes a comparison');
  assert.equal(scaleModel.springDone([{ object: 'orange', eye: 'level', value: 90, zeroed: false }]), false, 'an unzeroed reading is kept but does not finish');
  assert.match(scaleModel.springHint([], { object: 'orange', eye: 'level', value: 90, zeroed: false }), /영점 나사/);
  reads = scaleModel.recordSpringRead(reads, { ...level, value: 80 });
  assert.equal(reads.length, 2, 'the same object, eye and zero state replace the earlier reading');
  for (let i = 0; i < 40; i++) reads = scaleModel.recordSpringRead(reads, { object: 'blue', eye: i % 2 ? 'above' : 'below', value: 70 + i, zeroed: i % 3 === 0 });
  assert.ok(reads.length <= 12);
  assert.match(scaleModel.springSummary([level, above]), /정면에서 눈금을 읽었어요.*달랐어요/);
  assert.equal(scaleModel.springSummary([above]), '');
  const save = state.freshSave();
  save.scale = { zeroed: true, parts: [], runs: [], springReads: [level, above, { object: 'alien', eye: 'level', value: 1, zeroed: true }, { object: 'blue', eye: 'sideways', value: 70, zeroed: true }, { object: 'blue', eye: 'level', value: 70.5, zeroed: true }, 'junk'] };
  localStorage.setItem(state.SAVE_KEY, JSON.stringify(save));
  const restored = state.readSave();
  assert.deepEqual(restored.scale.springReads, [level, above], 'only valid readings survive restore');
  assert.equal(scaleModel.canCompleteScale(restored.scale), false, 'spring readings do not complete the basic mission');
  localStorage.setItem(state.SAVE_KEY, JSON.stringify(state.freshSave()));
  assert.equal('springReads' in state.readSave().scale, false, 'old saves gain no spring field');
});
test('basic workshop needs direct lift, two fulcrum positions (one easier) and both ramp lengths; findings stay optional', () => {
  const basic={...state.freshSave().workshop,direct:true,trials:workshop.retainWorkshopRuns([{tool:'lever',setting:0},{tool:'lever',setting:1},{tool:'ramp',setting:0},{tool:'ramp',setting:1}])};
  assert.equal(workshop.canFinishWorkshopExploration(basic),true);
  assert.equal(workshop.canCompleteWorkshop(basic),false,'optional challenge still needs the findings');
  assert.equal(workshop.canFinishWorkshopExploration({...basic,direct:false}),false);
  assert.equal(workshop.canFinishWorkshopExploration({...basic,trials:[{tool:'lever',setting:1,force:1,distance:1},{tool:'lever',setting:2,force:1,distance:1},{tool:'ramp',setting:0},{tool:'ramp',setting:1}]}),false,'recompute model values rather than trusting forged force');
  assert.equal(workshop.canFinishWorkshopExploration({...basic,trials:workshop.retainWorkshopRuns([{tool:'lever',setting:0},{tool:'ramp',setting:0}])}),false,'one try per tool is no longer a comparison');
  assert.equal(workshop.canFinishWorkshopExploration({...basic,trials:workshop.retainWorkshopRuns([{tool:'lever',setting:0},{tool:'lever',setting:1},{tool:'ramp',setting:0}])}),false,'both ramp lengths are needed');
  assert.deepEqual(workshop.workshopFinishSteps({...basic,trials:workshop.retainWorkshopRuns([{tool:'lever',setting:1},{tool:'lever',setting:2}])}),{direct:true,lever:false,ramp:false},'two harder positions do not show a smaller force');
});
test('life observation retains drafts without equating a sharing checkbox to a completed observation', () => {
  assert.equal(life.hasLifeObservation(life.retainLifeObservation({tool:'ramp',source:'example',object:'  ',use:' ',shared:true})),false);
  assert.equal(life.retainLifeObservation({tool:'alien',source:'example'}),undefined);
  const kept=life.retainLifeObservation({tool:'ramp',source:'around',object:'학교 경사판',use:'수레를 높은 턱에 올려요',shared:false});
  assert.equal(life.hasLifeObservation(kept),true);
  assert.equal(kept.shared,false);
  assert.equal(life.retainLifeObservation({...kept,use:'a'.repeat(1000)}).use.length,160);
  const save=state.freshSave(); save.lifeObservation=kept;
  state.writeSave(save);
  assert.deepEqual(state.readSave().lifeObservation,kept);
});
test('core ramps compare the same height while the longer path is gentler', () => {
  const { long, short } = coreScene.coreRoutes;
  assert.equal(long.start.y, short.start.y);
  assert.equal(long.end.y, short.end.y);
  const angle = ramp => Math.atan2(ramp.end.y - ramp.start.y, ramp.end.x - ramp.start.x);
  assert.ok(angle(long) < angle(short));
  assert.deepEqual(coreScene.coreRoutePoint('long', -1), long.start);
  const end = coreScene.coreRoutePoint('short', 2);
  assert.ok(Math.hypot(end.x - short.end.x, end.y - short.end.y, end.z - short.end.z) < 1e-10);
  assert.deepEqual(coreScene.coreRoutePoint('long', NaN), long.start);
});
test('core touch projection ignores sideward motion and allows reversal', () => {
  const start = {x:20,y:200}, end = {x:220,y:100};
  assert.equal(coreScene.coreDragProgress({x:200,y:-100}, start, end), 1);
  assert.equal(coreScene.coreDragProgress({x:100,y:200}, start, end), 0);
  assert.equal(coreScene.coreDragProgress({x:-100,y:50}, start, end), -.5);
  assert.equal(coreScene.coreDragProgress({x:NaN,y:0}, start, end), 0);
  assert.equal(coreScene.coreDragProgress({x:100,y:0}, start, start), 0);
});
test('shipped core GLBs embed textures and remain within the combined tablet budget', () => {
  const manifest = JSON.parse(fs.readFileSync('references/models/core-models.json', 'utf8'));
  let bytes = 0, triangles = 0;
  for (const asset of manifest.assets) {
    const file = fs.readFileSync(asset.output);
    assert.equal(file.readUInt32LE(0), 0x46546c67);
    assert.equal(file.readUInt32LE(8), file.length);
    const document = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
    assert.ok(document.buffers.every(buffer => !buffer.uri));
    assert.ok(document.images.every(image => image.bufferView !== undefined && !image.uri));
    const index = document.accessors[document.meshes[0].primitives[0].indices];
    assert.equal(index.count % 3, 0);
    assert.equal(file.length, asset.bytes);
    assert.equal(index.count / 3, asset.triangles);
    assert.ok(asset.texture.width <= 1024 && asset.texture.height <= 1024);
    bytes += file.length; triangles += index.count / 3;
  }
  assert.ok(bytes <= 2000000, 'models must fit the 2 MB combined envelope');
  assert.ok(triangles <= 35000, 'model budget leaves room for the procedural stage');
});
const key = 'udangtang-force-lab-save-v1';
const memory = new Map();
const stages = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
const comparison = [
  { route: 'short', force: 1, success: false },
  { route: 'long', force: 1, success: true },
];
test('mission predictions survive reload but forged choices are discarded', () => {
  const save = state.freshSave();
  save.inquiryPlans = { cargo: 'heavy', workshop: 'less', rescue: '<script>', scale: 'compare' };
  const restored = restore(save);
  assert.deepEqual(restored.inquiryPlans, { cargo: 'heavy', workshop: 'less' }, 'old method-style answers and forged ids are dropped');
  assert.equal(inquiry.planLabel('cargo', restored.inquiryPlans.cargo), '부품 5개 상자');
});
test('every mission prediction names the choice its experiment supports', () => {
  for (const [stage, plan] of Object.entries(inquiry.inquiryPlans)) {
    assert.ok(plan.choices.some(choice => choice.id === plan.expected), stage + ' expected choice exists');
    assert.ok(plan.choices.length >= 2 && plan.result.length > 0, stage + ' has a real choice and an observed result');
  }
});
test('prediction recap compares the first thought with the student own records', () => {
  const save = state.freshSave();
  assert.equal(inquiry.predictionRecap(save, 'cargo').matched, null, 'no prediction is not judged');
  save.inquiryPlans = { cargo: 'same', rescue: 'long' };
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 100, distance: 60 }, { parts: 5, action: 'push', gesture: 100, distance: 36 }];
  const cargo = inquiry.predictionRecap(save, 'cargo');
  assert.equal(cargo.matched, false);
  assert.match(cargo.result, /1개 상자는 60칸, 5개 상자는 36칸/);
  assert.match(inquiry.predictionVerdict(cargo), /예상과 달랐어/);
  save.rescue.runs = [{ route: 'long', force: 3, success: true }, ...comparison];
  const rescue = inquiry.predictionRecap(save, 'rescue');
  assert.equal(rescue.matched, true);
  assert.match(rescue.result, /^작은 힘으로/, 'uses the force where the fair comparison happened, not the latest run');
});
test('optional badges require distinct comparison evidence rather than repeated actions', () => {
  const save = state.freshSave();
  const earned = id => challenge.challenges(save).find(item => item.id === id).done;
  save.cargo.runs = [1, 1, 5].map(parts => ({parts, action:'push', gesture:100, distance:Math.round(72/(1+parts*.2))}));
  assert.equal(earned('cargo'), false);
  save.cargo.runs.push({parts:3, action:'push', gesture:100, distance:45});
  assert.equal(earned('cargo'), true);
  save.balance.runs = [{left:'A',right:'B',prediction:'right',actual:'right'}];
  assert.equal(earned('balance'), false);
  save.balance.runs.push({left:'B',right:'A',prediction:'left',actual:'left'});
  assert.equal(earned('balance'), false, 'a level comparison is also required');
  save.balance.runs.push({left:'A',right:'C',prediction:'level',actual:'level'});
  assert.equal(earned('balance'), true);
  save.scale.runs = [{parts:['orange','blue'],zeroed:true,reading:150},{parts:['blue','orange'],zeroed:true,reading:150}];
  assert.equal(earned('scale'), false, 'reordering the same pieces is not a new combination');
  save.scale.runs.push({parts:['orange','teal','cream'],zeroed:true,reading:150});
  assert.equal(earned('scale'), true);
  save.workshop.trials = workshop.retainWorkshopRuns([{tool:'lever',setting:0},{tool:'lever',setting:1},{tool:'lever',setting:2},{tool:'ramp',setting:0},{tool:'ramp',setting:1}]);
  assert.equal(earned('workshop'), false, 'observations still need evidence-based choices');
  save.workshop.leverFinding = save.workshop.rampFinding = true;
  assert.equal(earned('workshop'), true);
  save.rescue.runs = structuredClone(comparison);
  assert.equal(earned('rescue'), false);
  save.rescue.runs.push({route:'short',force:2,success:false},{route:'long',force:2,success:true});
  assert.equal(earned('rescue'), true);
});
function restore(value) {
  memory.set(key, JSON.stringify(value));
  return state.readSave();
}
function readyRescue() {
  return { ...state.freshSave().rescue, zeroed: true, loaded: true, measured: true, gate: true,
    route: 'long', force: 1, delivered: true, runs: structuredClone(comparison) };
}
beforeEach(() => {
  memory.clear();
  globalThis.localStorage = {
    getItem: storageKey => memory.get(storageKey) ?? null,
    setItem: (storageKey, value) => memory.set(storageKey, value),
  };
});

test('learning checks require actual observations and do not invent comparison evidence', () => {
  const save = state.freshSave();
  for (const id of stages) assert.equal(learning.learningTask(save, id), null);
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 60 }, { parts: 5, action: 'pull', gesture: 1, distance: 15 }];
  assert.equal(learning.learningTask(save, 'cargo'), null, 'different directions alone are not a fair weight comparison');
  save.cargo.runs.push({ parts: 5, action: 'push', gesture: 1, distance: 15 });
  const task = learning.learningTask(save, 'cargo');
  assert.equal(task.cards[0].bars[0].value, 60);
  assert.equal(task.cards[1].bars[0].value, 15);
});

test('balance transfer depends on observed objects, rather than a memorized left answer', () => {
  const save = state.freshSave();
  save.balance.runs = [{ left: 'A', right: 'B', prediction: 'left', actual: 'right' }, { left: 'A', right: 'C', prediction: 'level', actual: 'level' }];
  const first = learning.learningTask(save, 'balance');
  assert.equal(first.questions[0].correct, 'left');
  save.balance.runs[0] = { left: 'B', right: 'A', prediction: 'right', actual: 'left' };
  const swapped = learning.learningTask(save, 'balance');
  assert.equal(swapped.questions[0].correct, 'right');
  assert.notEqual(first.signature, swapped.signature);
});

test('first-option repetition cannot complete every learning check', () => {
  const save = state.freshSave();
  save.cargo.runs = [{ parts: 1, action: 'push', gesture: 1, distance: 60 }, { parts: 5, action: 'push', gesture: 1, distance: 15 }];
  save.scale.runs = [{ parts: ['orange', 'blue'], reading: 150, zeroed: true }];
  for (const id of ['cargo', 'scale']) {
    const task = learning.learningTask(save, id);
    const record = { signature: task.signature, completed: true, answers: task.questions.map(q => ({ first: q.choices[0].id, chosen: q.choices[0].id, tries: 1 })) };
    assert.equal(learning.learningRecordComplete(task, record), false);
  }
});

test('workshop evidence preserves the observed force and distance tradeoff', () => {
  const save = state.freshSave();
  save.workshop.trials = workshop.retainWorkshopRuns([{ tool: 'ramp', setting: 0 }, { tool: 'ramp', setting: 1 }]);
  const task = learning.learningTask(save, 'workshop');
  const [small, big] = task.cards;
  assert.ok(small.bars[0].value < big.bars[0].value);
  assert.ok(small.bars[1].value > big.bars[1].value);
  assert.equal(task.questions[1].correct, 'ramp');
});

test('learning completion needs both valid answers tied to unchanged evidence, and retains changed thoughts', () => {
  const save = state.freshSave();
  save.scale.runs = [{ parts: ['orange', 'blue'], reading: 150, zeroed: true }];
  const task = learning.learningTask(save, 'scale');
  const record = { signature: task.signature, completed: true, answers: [{ first: 'loaded-zero', chosen: 'empty-zero', tries: 2 }] };
  assert.equal(learning.learningRecordComplete(task, record), false, 'a completion flag cannot substitute for an answer');
  record.answers.push({ first: '175', chosen: '175', tries: 1 });
  assert.equal(learning.learningRecordComplete(task, record), true);
  assert.match(learning.learningSummary(task, record), /첫 선택:.*다시 선택:/);
  assert.equal(learning.learningRecordComplete(task, { ...record, signature: 'old evidence' }), false);
  save.learning = { scale: record };
  const restored = restore(save);
  assert.equal(restored.learning.scale.answers[0].first, 'loaded-zero');
  assert.equal(restored.learning.scale.answers[0].chosen, 'empty-zero');
  assert.deepEqual(learning.retainLearningRecords({ cargo: { signature: 'x', completed: true, answers: [null] } }), { cargo: { signature: 'x', completed: false, answers: [] } });
});

test('rescue review reuses real ramp records and fair transport comparison, including preview without prior work', () => {
  const save = state.freshSave();
  save.rescue = readyRescue();
  const preview = learning.learningTask(save, 'rescue');
  assert.equal(preview.cards.length, 1);
  save.workshop.trials = workshop.retainWorkshopRuns([{ tool: 'ramp', setting: 0 }, { tool: 'ramp', setting: 1 }]);
  const task = learning.learningTask(save, 'rescue');
  assert.equal(task.cards.length, 3);
  assert.match(task.cards[0].title, /내 공방 기록/);
  assert.match(task.questions[0].choices.find(c => c.id === 'comparison').text, /공방/);
  assert.equal(task.questions[1].correct, 'long');
});

test('fresh sessions do not share records, and stages unlock in order', () => {
  const save = state.freshSave();
  assert.equal(state.nextIncomplete(save), 'cargo');
  assert.equal(state.stageIsOpen(save, 'cargo'), true);
  for (let index = 0; index < stages.length; index++) {
    const id = stages[index];
    assert.equal(state.stageIsOpen(save, id), true);
    if (index + 1 < stages.length) assert.equal(state.stageIsOpen(save, stages[index + 1]), false);
    if (id === 'rescue') save.rescue = readyRescue();
    assert.equal(state.completeStage(save, id, `${id} evidence`), true);
    assert.equal(state.nextIncomplete(save), stages[index + 1] ?? 'complete');
  }
  state.completeStage(save, 'rescue', 'updated evidence');
  assert.equal(save.completed.length, 5);
  assert.equal(save.evidence.rescue, 'updated evidence');
  assert.deepEqual(state.freshSave().completed, []);
});

test('v1 saves without the new rescue state keep four completed missions and evidence', () => {
  const legacy = state.freshSave();
  legacy.completed = stages.slice(0, 4);
  legacy.evidence = Object.fromEntries(legacy.completed.map(id => [id, `${id} evidence`]));
  legacy.currentPage = 'complete';
  delete legacy.rescue;
  const restored = restore(legacy);
  assert.deepEqual(restored.rescue, state.freshSave().rescue);
  assert.deepEqual(restored.completed, stages.slice(0, 4));
  assert.deepEqual(restored.evidence, legacy.evidence);
  assert.equal(state.nextIncomplete(restored), 'rescue');
  assert.equal(state.stageIsOpen(restored, 'rescue'), true);
});

test('route experiment accepts only valid force levels and reproduces both paths', () => {
  for (const force of [1, 2, 3]) {
    assert.equal(model.canLift('short', force), force === 3);
    assert.equal(model.canLift('long', force), true);
  }
  for (const force of [NaN, Infinity, -Infinity, -1, 0, 1.5, 4, 99, '3', null]) {
    assert.equal(model.canLift('short', force), false, `short force ${force}`);
    assert.equal(model.canLift('long', force), false, `long force ${force}`);
  }
  assert.equal(model.canLift('unknown', 3), false);
});

test('learning evidence requires a different route, the same force, and a different outcome', () => {
  assert.equal(model.hasFairComparison([]), false);
  assert.equal(model.hasFairComparison([comparison[0]]), false);
  assert.equal(model.hasFairComparison(comparison), true);
  assert.equal(model.hasFairComparison([...comparison].reverse()), true);
  assert.equal(model.hasFairComparison([{route:'short',force:3,success:true},{route:'long',force:1,success:true}]), false);
  assert.equal(model.hasFairComparison([{route:'short',force:3,success:true},{route:'long',force:3,success:true}]), false);
  assert.equal(model.hasFairComparison([{route:'short',force:1,success:false},{route:'long',force:2,success:true}]), false);
  assert.equal(model.hasFairComparison([comparison[0], {...comparison[0]}]), false);
});

test('every rescue completion prerequisite is required', () => {
  const ready = readyRescue();
  assert.equal(model.rescueReady(ready), true);
  for (const missing of ['zeroed', 'measured', 'gate', 'delivered']) {
    assert.equal(model.rescueReady({...ready, [missing]: false}), false, missing);
  }
  assert.equal(model.rescueReady({...ready, runs: [comparison[1]]}), false);
  assert.equal(model.rescueReady({...ready, route: 'short', force: 1}), false);
  assert.equal(model.rescueReady({...ready, route: 'short', force: 3}), false, 'the selected route needs its own successful trial');
  assert.equal(model.rescueReady({...ready, force: 2}), false, 'changing force requires another trial');
  assert.equal(model.rescueReady(state.freshSave().rescue), false);
});

test('a large-force short path is a valid final choice after a fair comparison', () => {
  const ready = readyRescue();
  ready.route = 'short';
  ready.force = 3;
  ready.runs.push({route:'short',force:3,success:true});
  assert.equal(model.rescueReady(ready), true);
  const save = state.freshSave();
  save.rescue = ready;
  assert.equal(state.writeSave(save), true);
  assert.deepEqual(state.readSave().rescue, ready);
});

test('valid finished missions and the final route survive save and restore', () => {
  const save = state.freshSave();
  save.rescue = readyRescue();
  save.completed = [...stages];
  save.evidence.rescue = 'same force, different routes';
  save.currentPage = 'complete';
  assert.equal(state.writeSave(save), true);
  const restored = state.readSave();
  assert.deepEqual(restored.rescue, save.rescue);
  assert.deepEqual(restored.completed, stages);
  assert.equal(restored.currentPage, 'complete');
});

test('corrupt rescue flags and impossible outcomes cannot restore a false completion', () => {
  const save = state.freshSave();
  save.completed = [...stages];
  save.currentPage = 'complete';
  save.rescue = {...readyRescue(), zeroed: false};
  let restored = restore(save);
  assert.equal(restored.rescue.measured, false);
  assert.equal(restored.rescue.delivered, false);
  assert.equal(restored.completed.includes('rescue'), false);
  assert.notEqual(restored.currentPage, 'complete');
  save.rescue = {...readyRescue(), runs: []};
  restored = restore(save);
  assert.equal(restored.rescue.delivered, false);
  assert.equal(restored.completed.includes('rescue'), false);
  save.rescue = {...readyRescue(), runs: [{route:'short',force:1,success:true},{route:'long',force:1,success:false}]};
  restored = restore(save);
  assert.deepEqual(restored.rescue.runs, []);
  assert.equal(restored.completed.includes('rescue'), false);
});

test('rescue evidence alone does not unlock the ending without earlier missions', () => {
  const save = state.freshSave();
  save.rescue = readyRescue();
  save.completed = ['rescue'];
  save.evidence.rescue = 'unfinished sequence';
  save.currentPage = 'complete';
  const restored = restore(save);
  assert.equal(restored.completed.includes('rescue'), false);
  assert.equal(restored.evidence.rescue, undefined);
  assert.equal(restored.currentPage, 'map');
});

test('replaying a completed rescue retains earned progress while requiring a new delivery', () => {
  const save = state.freshSave();
  save.rescue = {...readyRescue(), route: 'short', force: 1, delivered: false};
  save.completed = [...stages];
  save.evidence.rescue = 'earned completion evidence';
  save.currentPage = 'rescue';
  const restored = restore(save);
  assert.equal(restored.completed.includes('rescue'), true);
  assert.equal(restored.evidence.rescue, 'earned completion evidence');
  assert.equal(restored.rescue.delivered, false);
  assert.equal(model.rescueReady(restored.rescue), false);
});

test('resume of a locked stage falls back to a usable map', () => {
  const save = state.freshSave();
  save.currentPage = 'rescue';
  const restored = restore(save);
  assert.equal(restored.currentPage, 'map');
});

test('invalid shapes, enumerations and numeric values are sanitized without crashing', () => {
  const save = state.freshSave();
  save.completed = ['cargo','cargo','alien'];
  save.currentPage = 'alien';
  save.cargo = {parts:99,action:'alien',runs:[null,{parts:1,action:'push',gesture:Infinity,distance:60},{parts:1,action:'push',gesture:50,distance:-1}]};
  save.balance = {left:'<script>',right:'B',prediction:'invalid',runs:[null,{left:'A',right:'B',prediction:'left',actual:'invalid'}]};
  save.scale = {zeroed:'true',parts:['orange','orange','alien',null],runs:[null,{parts:['alien'],reading:150,zeroed:true},{parts:['orange'],reading:Infinity,zeroed:true}]};
  save.rescue = {force:99,route:'invalid',runs:[null,{route:'long',force:0,success:true}],measured:true,zeroed:false};
  const restored = restore(save);
  assert.deepEqual(restored.completed, ['cargo']);
  assert.equal(restored.currentPage, 'map');
  assert.equal(restored.cargo.parts, 1);
  assert.deepEqual(restored.cargo.runs, []);
  assert.equal(restored.balance.left, null);
  assert.deepEqual(restored.balance.runs, []);
  assert.equal(restored.scale.zeroed, false);
  assert.deepEqual(restored.scale.parts, ['orange']);
  assert.deepEqual(restored.scale.runs, []);
  assert.equal(restored.rescue.force, 1);
  assert.equal(restored.rescue.measured, false);
  assert.deepEqual(restored.rescue.runs, []);
});

test('experiment history is bounded during restore', () => {
  const save = state.freshSave();
  save.rescue.runs = Array.from({length:30}, (_, index) => ({route:'short',force:index % 3 + 1,success:index % 3 === 2}));
  const restored = restore(save);
  assert.deepEqual(restored.rescue.runs, save.rescue.runs.slice(-20));
});

test('long replay sessions preserve the earned comparison and latest trial through reload', () => {
  const save = state.freshSave();
  save.rescue = readyRescue();
  save.completed = [...stages];
  save.evidence.rescue = 'earned completion evidence';
  for (let trial = 0; trial < 60; trial++) {
    const run = {route:'short',force:3,success:true};
    save.rescue.route = run.route;
    save.rescue.force = run.force;
    save.rescue.runs = model.retainRescueRuns([...save.rescue.runs, run]);
    assert.ok(save.rescue.runs.length <= 20);
    assert.deepEqual(save.rescue.runs.slice(0, 2), comparison);
    assert.deepEqual(save.rescue.runs.at(-1), run);
    assert.equal(model.rescueReady(save.rescue), true);
    const restored = restore(save);
    assert.equal(restored.completed.includes('rescue'), true);
    assert.equal(restored.evidence.rescue, 'earned completion evidence');
    save.rescue = restored.rescue;
  }
});

test('restore compaction preserves an early valid comparison but rejects impossible evidence', () => {
  const recent = Array.from({length:25}, () => ({route:'short',force:3,success:true}));
  const save = state.freshSave();
  save.rescue = {...readyRescue(), route:'short',force:3,runs:[...comparison,...recent]};
  save.completed = [...stages];
  const restored = restore(save);
  assert.equal(restored.rescue.runs.length, 20);
  assert.deepEqual(restored.rescue.runs.slice(0,2), comparison);
  assert.equal(restored.completed.includes('rescue'), true);
  const impossible = [{route:'short',force:1,success:true},{route:'long',force:1,success:false}];
  assert.deepEqual(model.retainRescueRuns([...impossible,...recent]), recent.slice(-20));
  const original = [...comparison,...recent];
  const copy = structuredClone(original);
  model.retainRescueRuns(original);
  assert.deepEqual(original, copy, 'compaction must not mutate its input');
});

test('missing, corrupt, unsupported or blocked storage is handled safely', () => {
  assert.equal(state.readSave(), null);
  for (const value of ['{bad', 'null', '[]', '{"version":2}']) {
    memory.set(key, value);
    assert.equal(state.readSave(), null);
  }
  localStorage.getItem = () => { throw new Error('storage unavailable'); };
  assert.equal(state.readSave(), null);
  localStorage.setItem = () => { throw new Error('storage unavailable'); };
  assert.equal(state.writeSave(state.freshSave()), false);
});

test('lever designs trade the applied force for travel while lifting the same load to the same height', () => {
  const designs = [0,1,2].map(setting=>workshop.getWorkshopDesign('lever',setting));
  assert.ok(designs[0].force < designs[1].force && designs[1].force < designs[2].force);
  assert.ok(designs[0].distance > designs[1].distance && designs[1].distance > designs[2].distance);
  assert.equal(designs[1].force, 100, 'equal arms do not reduce the necessary force');
  assert.ok(designs[2].force > 100, 'an unfavorable pivot can need more force than direct lifting');
  for(const design of designs) {
    assert.equal(design.lift, designs[0].lift);
    assert.ok(Math.abs(design.force*design.distance-100*design.lift)<1e-9);
  }
});

test('a longer ramp reduces force but requires greater travel to the same height', () => {
  const short = workshop.getWorkshopDesign('ramp',0);
  const long = workshop.getWorkshopDesign('ramp',1);
  assert.equal(short.lift,long.lift);
  assert.ok(long.force<short.force);
  assert.ok(long.distance>short.distance);
  assert.ok(Math.abs(short.force*short.distance-long.force*long.distance)<1e-9);
});

test('workshop comparisons require distinct tested designs and choices use the student observations', () => {
  const repeated=workshop.retainWorkshopRuns([{tool:'lever',setting:1},{tool:'lever',setting:1}]);
  assert.equal(workshop.hasWorkshopComparison(repeated,'lever'),false);
  assert.equal(workshop.isBestWorkshopDesign(repeated,'lever',1),false);
  const compared=workshop.retainWorkshopRuns([{tool:'lever',setting:1},{tool:'lever',setting:2}]);
  assert.equal(workshop.hasWorkshopComparison(compared,'lever'),true);
  assert.equal(workshop.isBestWorkshopDesign(compared,'lever',1),true);
  assert.equal(workshop.isBestWorkshopDesign(compared,'lever',2),false);
  assert.equal(workshop.isBestWorkshopDesign(compared,'lever',0),false,'an untested option is not evidence');
  assert.equal(workshop.hasWorkshopComparison(compared,'ramp'),false);
});

test('workshop completion needs direct lifting, both comparisons and both evidence-based findings', () => {
  const trials=workshop.retainWorkshopRuns([{tool:'lever',setting:0},{tool:'lever',setting:1},{tool:'ramp',setting:0},{tool:'ramp',setting:1}]);
  const ready={...state.freshSave().workshop,direct:true,leverFinding:true,rampFinding:true,trials};
  assert.equal(workshop.canCompleteWorkshop(ready),true);
  for(const required of ['direct','leverFinding','rampFinding']) assert.equal(workshop.canCompleteWorkshop({...ready,[required]:false}),false,required);
  assert.equal(workshop.canCompleteWorkshop({...ready,trials:trials.filter(run=>run.tool==='lever')}),false);
  assert.equal(workshop.canCompleteWorkshop({...ready,trials:trials.filter(run=>run.tool==='ramp')}),false);
});

test('workshop restore recalculates values, rejects invalid designs and does not invent findings', () => {
  const raw=[null,{tool:'lever',setting:0,force:Infinity,distance:-7},{tool:'lever',setting:0,force:0,distance:0},
    {tool:'ramp',setting:0,force:9999,distance:9999},{tool:'ramp',setting:2},{tool:'lever',setting:1.5},
    {tool:'lever',setting:NaN},{tool:'lever',setting:-1},{tool:'unknown',setting:1}];
  const save=state.freshSave();
  save.workshop={...save.workshop,fulcrumPosition:99,rampLength:99,trials:raw,leverFinding:true,rampFinding:true};
  const restored=restore(save).workshop;
  assert.equal(restored.fulcrumPosition,1);
  assert.equal(restored.rampLength,0);
  assert.equal(restored.trials.length,2);
  for(const run of restored.trials) {
    const design=workshop.getWorkshopDesign(run.tool,run.setting);
    assert.equal(run.force,design.force);
    assert.equal(run.distance,design.distance);
  }
  assert.equal(restored.leverFinding,false);
  assert.equal(restored.rampFinding,false);
});

test('legacy workshop progress survives migration without claiming new experiments were performed', () => {
  const save=state.freshSave();
  save.workshop={direct:true,lever:true,ramp:true,fulcrumSnapped:true,plankSnapped:true,rampSnapped:true};
  save.completed=stages.slice(0,4);
  const restored=restore(save);
  assert.equal(restored.workshop.direct,true);
  assert.equal(restored.workshop.lever,true);
  assert.deepEqual(restored.workshop.trials,[]);
  assert.equal(restored.workshop.leverFinding,false);
  assert.equal(restored.workshop.rampFinding,false);
  assert.deepEqual(restored.completed,stages.slice(0,4));
  assert.equal(workshop.canCompleteWorkshop(restored.workshop),false);
});

test('a newly better workshop result needs a fresh choice, survives reload, and keeps the earned badge', () => {
  const save = state.freshSave();
  save.completed = stages.slice(0,4);
  save.workshop = {...save.workshop,direct:true,leverFinding:true,rampFinding:true,
    trials:workshop.retainWorkshopRuns([{tool:'lever',setting:1},{tool:'lever',setting:2},{tool:'ramp',setting:0},{tool:'ramp',setting:1}])};
  assert.equal(workshop.canCompleteWorkshop(save.workshop),true);
  assert.equal(workshop.recordWorkshopTrial(save.workshop,'lever',0),true);
  assert.equal(save.workshop.leverFinding,false,'new evidence must not invent a new student choice');
  assert.equal(save.workshop.rampFinding,true,'the other tool finding is unchanged');
  assert.equal(workshop.canCompleteWorkshop(save.workshop),false);
  const restored = restore(save);
  assert.equal(restored.workshop.leverFinding,false);
  assert.equal(restored.completed.includes('workshop'),true,'re-exploration does not revoke earned progress');
  assert.equal(workshop.isBestWorkshopDesign(restored.workshop.trials,'lever',0),true);
  restored.workshop.leverFinding = true;
  assert.equal(workshop.canCompleteWorkshop(restored.workshop),true);
  assert.equal(workshop.recordWorkshopTrial(restored.workshop,'lever',2),false);
  assert.equal(restored.workshop.leverFinding,true,'repeating a worse design does not invalidate the supported choice');
});
