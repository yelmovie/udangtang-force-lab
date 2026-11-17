import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Same loader as test-rescue-flow.mjs: import the real TypeScript modules without build output.
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
const walk = await import(moduleUrl('src/rescueWalkModel.ts'));
const bench = await import(moduleUrl('src/rescueModel.ts'));
const routes = (await import(moduleUrl('src/coreSceneModel.ts'))).coreRoutes;

const fresh = (patch = {}) => ({ zeroed: false, loaded: false, measured: false, gate: false, route: 'short', force: 1, runs: [], delivered: false, ...patch });
const shortStop = force => ({ route: 'short', force, success: false });
const longArrive = force => ({ route: 'long', force, success: true });
const atScale = { ...walk.walkCourse.scale, z: 0 };
const atGate = { x: walk.walkCourse.gateX - 1.2, y: 0, z: 0 };
const entrance = route => ({ x: routes[route].start.x - .95, y: 0, z: routes[route].start.z });

test('the scale offers the same choices as the bench: zero the empty scale, or load and read', () => {
  const state = fresh();
  assert.equal(walk.walkZone(atScale, state), 'scale');
  assert.deepEqual(walk.walkActions(state, 'scale'), ['zero', 'load']);
  assert.deepEqual(walk.walkActions(fresh({ zeroed: true }), 'scale'), ['load']);
  assert.deepEqual(walk.walkActions(fresh({ loaded: true }), 'scale'), ['reading', 'unload'], 'a loaded, unzeroed scale can be read and unloaded, not zeroed');
  assert.deepEqual(walk.walkActions(fresh({ zeroed: true, loaded: true, measured: true }), 'scale'), [], 'nothing left at the scale once the weight is recorded');
});

test('the crate cannot be handled before the weight is recorded, and disappears as a place once the way is open', () => {
  assert.equal(walk.walkZone(atGate, fresh()), 'gate');
  assert.deepEqual(walk.walkActions(fresh(), 'gate'), []);
  assert.match(walk.walkWaiting(fresh(), 'gate'), /먼저 저울/);
  const measured = fresh({ zeroed: true, measured: true });
  assert.deepEqual(walk.walkActions(measured, 'gate'), ['pull-crate', 'push-crate']);
  assert.equal(walk.walkZone(atGate, fresh({ zeroed: true, measured: true, gate: true })), null);
});

test('the crate comes toward the explorer when pulled and only nudges when pushed', () => {
  assert.equal(walk.crateX(0), walk.walkCourse.gateX);
  assert.equal(walk.crateX(1), walk.walkCourse.gateX - walk.walkCourse.gatePull);
  assert.equal(walk.crateX(5), walk.crateX(1), 'never past the open position');
  assert.ok(walk.crateX(-1) > walk.walkCourse.gateX && walk.crateX(-1) - walk.walkCourse.gateX < .2, 'a push is a small nudge against the stoppers');
  assert.ok(walk.crateHoldSpot(.5).x < walk.crateX(.5), 'the explorer stays on the near side of the crate');
});

test('ramp entrances are places only after the way is open', () => {
  const open = fresh({ zeroed: true, measured: true, gate: true });
  assert.equal(walk.walkZone(entrance('short'), fresh({ zeroed: true, measured: true })), null);
  assert.equal(walk.walkZone(entrance('short'), open), 'short');
  assert.equal(walk.walkZone(entrance('long'), open), 'long');
  assert.deepEqual(walk.walkActions(open, 'short'), ['push-core']);
  assert.deepEqual(walk.walkActions(open, 'long'), [], 'the core is on the other ramp');
});

test('walking to a ramp picks it, with the same short-ramp-first rule as the bench', () => {
  const open = fresh({ zeroed: true, measured: true, gate: true });
  assert.equal(walk.routeToSelect(open, 'long'), 'long');
  assert.equal(walk.routeLocked(open, 'long'), true, 'long ramp waits for the short ramp trial with small force');
  assert.equal(walk.routeLocked(open, 'short'), false);
  const tried = { ...open, runs: [shortStop(1)] };
  assert.equal(walk.routeLocked(tried, 'long'), false);
  assert.equal(walk.routeToSelect(tried, 'short'), null, 'already on this ramp');
  assert.equal(walk.routeToSelect({ ...tried, delivered: true }, 'long'), null, 'an arrived core is not moved by walking past');
  assert.equal(walk.routeToSelect(fresh(), 'long'), null);
});

test('how far a push goes is decided by canLift alone', () => {
  for (const route of ['short', 'long']) for (const force of [1, 2, 3]) {
    assert.equal(walk.pushLimit(route, force), bench.canLift(route, force) ? 1 : bench.stallTravel, `${route} ${force}`);
  }
  assert.equal(walk.pushLimit('short', 1), .08, 'too little force only budges the core');
});

test('the explorer stays behind the core on the ramp', () => {
  for (const route of ['short', 'long']) {
    const start = walk.coreHoldSpot(route, 0), top = walk.coreHoldSpot(route, 1);
    assert.equal(start.y, 0, 'on the floor at the start');
    assert.ok(start.x < routes[route].start.x);
    assert.ok(top.x < routes[route].end.x && top.y > .7 && top.y < routes[route].end.y);
    assert.equal(top.z, routes[route].start.z);
  }
});

test('the core is shown where the saved state says it is', () => {
  const place = (state, progress = 0) => walk.corePlace(walk.walkView(state, progress));
  assert.equal(place(fresh()).at, 'station');
  assert.equal(place(fresh({ loaded: true })).at, 'scale');
  assert.equal(place(fresh({ zeroed: true, measured: true, loaded: true })).at, 'scale', 'the weighed core stays on the scale until the way is open');
  assert.equal(place(fresh({ zeroed: true, measured: true })).at, 'station');
  const open = fresh({ zeroed: true, measured: true, gate: true, route: 'long' });
  assert.deepEqual(place(open).point, routes.long.start);
  assert.equal(place(open, bench.stallTravel).at, 'route');
  const done = place({ ...open, delivered: true }, 1);
  assert.equal(done.at, 'deck');
  assert.equal(done.point.y, routes.long.end.y, 'both ramps end at the same height');
  assert.deepEqual(walk.walkView(open, .5), { phase: 2, loaded: false, route: 'long', progress: .5, delivered: false });
});

test('putting the core back is offered only when the bench says the mission is ready', () => {
  const runs = [shortStop(1), longArrive(1)];
  const ready = fresh({ zeroed: true, measured: true, gate: true, route: 'long', force: 1, runs, delivered: true });
  const onDeck = { x: 1.2, y: 1.2, z: 1.25 };
  assert.equal(bench.rescueReady(ready), true);
  assert.equal(walk.walkZone(onDeck, ready), 'dock');
  assert.deepEqual(walk.walkActions(ready, 'dock'), ['dock']);
  assert.deepEqual(walk.walkActions({ ...ready, runs: [longArrive(1)] }, 'dock'), [], 'no fair comparison, no finish');
  assert.deepEqual(walk.walkActions(ready, 'long'), ['retry']);
  assert.equal(walk.walkZone(onDeck, { ...ready, delivered: false }), null);
});

test('checkpoints follow the course and never jump past a closed gate', () => {
  const course = walk.walkCourse;
  assert.deepEqual(walk.walkCheckpoint(course.spawn.x, false), course.spawn);
  assert.equal(walk.walkCheckpoint(course.scale.x, false).x, course.scale.x);
  assert.ok(walk.walkCheckpoint(course.gateX - 1, false).x < course.gateX);
  assert.ok(walk.walkCheckpoint(-2, false).x < course.gateX, 'closed gate: back on the near side');
  assert.ok(walk.walkCheckpoint(course.gateX + 1, true).x > course.gateX);
  assert.ok(walk.walkCheckpoint(-2, true).x > course.pileX);
});

test('every action has a label, and only the two efforts are hold buttons', () => {
  for (const action of ['zero', 'load', 'unload', 'reading', 'push-crate', 'pull-crate', 'push-core', 'retry', 'dock']) assert.ok(walk.walkActionLabels[action]);
  assert.deepEqual([...walk.walkHoldActions], ['pull-crate', 'push-core']);
});
