import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import sharp from 'sharp';

// Import the shipped navigation rather than an A* copy. CSS is the sole
// browser-only side-effect import; DOM mounting is never invoked by these tests.
const moduleUrls = new Map();
function moduleUrl(filename) {
  const absolute = path.resolve(filename);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  source = source.replace(/^import\s*['"][^'"]+\.css['"];?\s*$/gm, '');
  source = source.replace(/(from\s*|import\s*)(['"])(\.\.?\/[^'"]+)\2/g, (_match, prefix, quote, relative) => {
    const dependency = path.resolve(path.dirname(absolute), relative);
    return `${prefix}${quote}${moduleUrl(path.extname(dependency) ? dependency : `${dependency}.ts`)}${quote}`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  moduleUrls.set(absolute, url);
  return url;
}
const { canStandInVillage, createVillageNavigation, createVillageInput, moveVillagePoint, createVillageEntrances, villageLights, villageLightRoutes, withDirectionParticle, withParticle, requestBoardSpot, requesterSpots } = await import(moduleUrl('src/screens/village.ts'));

const map = JSON.parse(fs.readFileSync('public/assets/village/world-map.json', 'utf8'));
// The prepared source lives in references/ (not versioned); a clean checkout checks the published map alone.
const preparedPath = 'references/pixel-village-v1/prepared/world-map.json';
const prepared = fs.existsSync(preparedPath) ? JSON.parse(fs.readFileSync(preparedPath, 'utf8')) : null;
const STEP = 12;
const EPS = 1e-6;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const edges = polygons => polygons.flatMap(({ points }) => points.map((a, i) => [a, points[(i + 1) % points.length]]));
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inside(p, polygon) {
  let result = false;
  for (const [a, b] of edges([polygon])) {
    if (segmentDistance(p, a, b) < EPS) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
const inUnion = (p, polygons) => polygons.some(polygon => inside(p, polygon));

// Split intersecting polygon edges, then discard seams internal to the union.
// Checking distance from the remaining boundary tests the entire circular body,
// including corners between the runtime's perimeter samples.
function unionBoundary(polygons) {
  const allEdges = edges(polygons);
  return allEdges.flatMap(([a, b]) => {
    const direction = subtract(b, a);
    const lengthSquared = direction[0] ** 2 + direction[1] ** 2;
    const cuts = [0, 1];
    for (const [c, d] of allEdges) {
      const other = subtract(d, c), offset = subtract(c, a);
      const denominator = cross(direction, other);
      if (Math.abs(denominator) > EPS) {
        const t = cross(offset, other) / denominator;
        const u = cross(offset, direction) / denominator;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(offset, direction)) < EPS) {
        for (const point of [c, d]) {
          const t = ((point[0] - a[0]) * direction[0] + (point[1] - a[1]) * direction[1]) / lengthSquared;
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    const sorted = [...new Set(cuts)].sort((x, y) => x - y);
    const pointAt = t => [a[0] + direction[0] * t, a[1] + direction[1] * t];
    const normal = [-direction[1] / Math.sqrt(lengthSquared) * 0.001, direction[0] / Math.sqrt(lengthSquared) * 0.001];
    const boundary = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < EPS) continue;
      const midpoint = pointAt((sorted[i] + sorted[i - 1]) / 2);
      const plus = [midpoint[0] + normal[0], midpoint[1] + normal[1]];
      const minus = [midpoint[0] - normal[0], midpoint[1] - normal[1]];
      if (inUnion(plus, polygons) !== inUnion(minus, polygons)) boundary.push([pointAt(sorted[i - 1]), pointAt(sorted[i])]);
    }
    return boundary;
  });
}
const walkableBoundary = unionBoundary(map.walkable);
const blockedEdges = edges(map.blocked);
const standCache = new Map();
function canStand(x, y) {
  const key = `${x},${y}`;
  if (standCache.has(key)) return standCache.get(key);
  const p = [x, y], radius = map.radius;
  const result = x >= radius && y >= radius && x <= map.width - radius && y <= map.height - radius
    && inUnion(p, map.walkable) && !inUnion(p, map.blocked)
    && walkableBoundary.every(([a, b]) => segmentDistance(p, a, b) >= radius - EPS)
    && blockedEdges.every(([a, b]) => segmentDistance(p, a, b) >= radius - EPS);
  standCache.set(key, result);
  return result;
}

// Anchor the four-direction grid at the real spawn, not at a nearby safe point.
// Check the 12px edge in 3px steps so BFS cannot jump over a thin obstruction.
function explore() {
  if (!canStand(map.spawn.x, map.spawn.y)) return [];
  const queue = [{ ...map.spawn, steps: 0 }];
  const visited = new Set([`${map.spawn.x},${map.spawn.y}`]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
      if (visited.has(key)) continue;
      if ([0.25, 0.5, 0.75, 1].every(t => canStand(current.x + dx * t, current.y + dy * t))) {
        visited.add(key);
        queue.push({ x, y, steps: current.steps + 1 });
      }
    }
  }
  return queue;
}
const reachable = explore();
const nearestTo = target => reachable.reduce((best, p) => {
  const distance = Math.hypot(p.x - target.x, p.y - target.y);
  return distance < best.distance ? { ...p, distance } : best;
}, { distance: Infinity });
const navigation = createVillageNavigation(map);

function assertSafePath(start, route, label) {
  let anchor = start;
  for (const point of route) {
    assert.ok(navigation.segment(anchor, point), `${label}: runtime rejects its own path segment`);
    const samples = Math.max(1, Math.ceil(Math.hypot(point.x - anchor.x, point.y - anchor.y) / 1.5));
    for (let i = 0; i <= samples; i++) {
      const x = anchor.x + (point.x - anchor.x) * i / samples;
      const y = anchor.y + (point.y - anchor.y) * i / samples;
      assert.ok(canStand(x, y), `${label}: full 9px disk leaves safe ground at (${x.toFixed(2)},${y.toFixed(2)})`);
    }
    anchor = point;
  }
}

test('published map matches prepared source and includes exactly five mission entrances', () => {
  if (prepared) assert.deepEqual(map, prepared);
  assert.equal(map.radius, 9);
  assert.deepEqual(map.buildings.map(building => building.id).sort(), ['balance', 'cargo', 'rescue', 'scale', 'workshop']);
  for (const polygon of [...map.walkable, ...map.blocked]) {
    assert.ok(polygon.points.length >= 3, polygon.id);
    assert.ok(polygon.points.every(point => point.length === 2 && point.every(Number.isFinite)), polygon.id);
  }
});

test('spawn fits a 9px disk and has a connected walking region', t => {
  assert.ok(canStand(map.spawn.x, map.spawn.y), `Blocked spawn ${JSON.stringify(map.spawn)}`);
  assert.ok(reachable.length > 100, `Only ${reachable.length} grid cells reachable`);
  t.diagnostic(`${reachable.length} reachable cells on a ${STEP}px four-direction grid`);
});

for (const building of map.buildings) {
  test(`spawn can reach ${building.id} entry within its ${building.entry.radius}px interaction radius`, t => {
    const nearest = nearestTo(building.entry);
    assert.ok(nearest.distance <= building.entry.radius,
      `${building.id} disconnected: closest reachable (${nearest.x},${nearest.y}) is ${nearest.distance.toFixed(1)}px away from (${building.entry.x},${building.entry.y}); needs <=${building.entry.radius}px`);
    t.diagnostic(`${building.id}: ${nearest.steps} grid steps, closest distance ${nearest.distance.toFixed(1)}px`);
  });
}

test('NPC positions fit a 9px disk and can be approached from spawn', () => {
  assert.ok(map.npcs.length > 0);
  for (const npc of map.npcs) {
    assert.ok(canStand(npc.x, npc.y), `NPC ${npc.id} is embedded in an obstacle`);
    const nearest = nearestTo(npc);
    assert.ok(nearest.distance <= STEP, `NPC ${npc.id} unreachable: nearest ${nearest.distance.toFixed(1)}px`);
  }
});

test('building walls override overlapping walkable forecourts', () => {
  for (const [name, x, y] of [
    ['cargo', 346, 290], ['core', 838, 317], ['balance', 1440, 299],
    ['scale', 416, 670], ['workshop', 1430, 687],
  ]) {
    assert.ok(inUnion([x, y], map.walkable), `${name}: test point must exercise overlapping geometry`);
    assert.equal(canStand(x, y), false, `${name} wall must override its forecourt`);
  }
});

test('river and bridge railings reject walking while both bridge decks allow crossing', () => {
  for (const [x, y] of [[1190, 210], [1190, 380], [1190, 440], [1200, 610], [1190, 251], [1190, 321], [1190, 497], [1190, 561]]) {
    assert.equal(canStand(x, y), false, `River/railing (${x},${y}) must block the character`);
  }
  for (const [name, x, y] of [['north', 1190, 284], ['south', 1190, 528]]) {
    assert.ok(canStand(x, y), `${name} bridge deck must fit the character`);
    assert.ok(nearestTo({ x, y }).distance <= STEP, `${name} bridge must connect to spawn`);
  }
});

test('the full character disk stays inside walkable ground and outside the world edge', () => {
  assert.ok(inUnion([1190, 264], map.walkable));
  assert.equal(canStand(1190, 264), false, 'A center on a deck is insufficient when the body overhangs its edge');
  assert.equal(canStand(-1, map.spawn.y), false);
  assert.equal(canStand(map.width + 1, map.spawn.y), false);
  assert.equal(canStand(map.spawn.x, -1), false);
  assert.equal(canStand(map.spawn.x, map.height + 1), false);
});

for (const building of map.buildings) {
  test(`actual A* reaches ${building.id} from spawn with safe smoothed segments`, t => {
    const route = navigation.route(map.spawn, building.entry);
    assert.ok(route?.length, `${building.id}: production grid cannot find a route`);
    const end = route.at(-1);
    const distance = Math.hypot(end.x - building.entry.x, end.y - building.entry.y);
    assert.ok(distance <= building.entry.radius, `${building.id}: route ends ${distance.toFixed(1)}px away, outside entry radius`);
    assertSafePath(map.spawn, route, building.id);
    t.diagnostic(`${building.id}: ${route.length} waypoints, endpoint distance ${distance.toFixed(1)}px`);
  });
}

test('actual navigation refuses a river shortcut and routes through a bridge', () => {
  const target = map.buildings.find(building => building.id === 'workshop').entry;
  assert.equal(navigation.segment(map.spawn, target), false, 'A direct line through the river must not be walkable');
  const route = navigation.route(map.spawn, target);
  assert.ok(route?.length > 1, 'Cross-river journey must have a detour');
  const decks = map.walkable.filter(polygon => ['north-bridge-deck', 'south-bridge-deck'].includes(polygon.id));
  let anchor = map.spawn, crossedDeck = false;
  for (const point of route) {
    const samples = Math.ceil(Math.hypot(point.x - anchor.x, point.y - anchor.y) / 3);
    for (let i = 0; i <= samples; i++) {
      const sample = [anchor.x + (point.x - anchor.x) * i / samples, anchor.y + (point.y - anchor.y) * i / samples];
      if (sample[0] >= 1170 && sample[0] <= 1220 && inUnion(sample, decks)) crossedDeck = true;
    }
    anchor = point;
  }
  assert.ok(crossedDeck, 'The route must cross the river on a bridge deck');
});

test('the path beside the scale connects its east apron to the southern lane', () => {
  const start = { x: 590, y: 700 }, target = { x: 540, y: 780 };
  assert.ok(canStand(start.x, start.y), 'Scale east apron must fit the character');
  assert.ok(canStand(target.x, target.y), 'Southern lane must fit the character');
  const route = navigation.route(start, target);
  assert.ok(route?.length, 'A visible path beside the scale must not be a dead end');
  assertSafePath(start, route, 'scale south corner');
  assert.ok(route.reduce((sum, p, index) => sum + Math.hypot(p.x - (index ? route[index - 1].x : start.x), p.y - (index ? route[index - 1].y : start.y)), 0) < 210, 'The short visible path must not detour around the village');
});

test('actual collision function blocks river/walls and accepts spawn, NPC and bridge centers', () => {
  for (const point of [map.spawn, ...map.npcs, { x: 1190, y: 284 }, { x: 1190, y: 528 }]) {
    assert.ok(canStandInVillage(map, point), `Runtime unexpectedly blocks (${point.x},${point.y})`);
  }
  for (const point of [{ x: 1190, y: 380 }, { x: 416, y: 670 }, { x: 838, y: 317 }, { x: NaN, y: 400 }, { x: Infinity, y: 400 }]) {
    assert.equal(canStandInVillage(map, point), false);
  }
});

test('visible routes and door approaches on the redrawn terrain are reachable', () => {
  const ground = [
    ['cargo approach', 480, 430], ['west lane bend', 600, 480], ['west lane', 600, 445],
    ['west junction', 680, 450], ['west junction edge', 700, 480],
    ['central plaza', 800, 450], ['central plaza edge', 750, 500],
    ['east junction', 940, 450], ['east junction edge', 1050, 470],
    ['northeast lane', 1030, 440], ['northeast turn', 1040, 330],
    ['upper bridge approach', 1060, 350], ['south junction', 830, 580],
    ['scale approach', 680, 640], ['scale lane edge', 600, 670],
    ['south lane', 840, 670], ['southern exit', 840, 800],
    ['east bridge approach', 1330, 480], ['east crossing edge', 1340, 500],
    ['east lane', 1390, 450], ['balance approach', 1410, 380],
    ['workshop approach', 1430, 760], ['east forecourt', 1520, 760],
  ];
  const failures = [];
  for (const [name, x, y] of ground) {
    const target = { x, y };
    if (!canStand(x, y)) { failures.push(`${name} (${x},${y}) is blocked`); continue; }
    const route = navigation.route(map.spawn, target);
    if (!route?.length) { failures.push(`${name}: no route from spawn`); continue; }
    if (Math.hypot(route.at(-1).x - x, route.at(-1).y - y) > STEP)
      failures.push(`${name}: route stops short of visible open ground`);
  }
  assert.deepEqual(failures, []);
});

test('redrawn sandy ground agrees with the navigation area', async t => {
  const { data, info } = await sharp('public/assets/village/terrain.webp').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, map.width);
  assert.equal(info.height, map.height);
  let sandy = 0, reachableSand = 0;
  const blocked = new Map(), blockedPoints = [];
  for (let y = 36; y < map.height - 36; y += 24) for (let x = 36; x < map.width - 36; x += 24) {
    if (map.buildings.some(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)) continue;
    if (inUnion([x, y], map.blocked)) continue;
    let clearSand = 0;
    for (const dy of [-8, 0, 8]) for (const dx of [-8, 0, 8]) {
      const offset = ((y + dy) * info.width + x + dx) * info.channels;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      if (red > 210 && green > 165 && red > green + 20 && green > blue + 25) clearSand++;
    }
    if (clearSand < 7) continue;
    sandy++;
    if (canStand(x, y) && nearestTo({ x, y }).distance <= STEP * 2) reachableSand++;
    else { const key = `${Math.floor(x / 100)},${Math.floor(y / 100)}`; blocked.set(key, (blocked.get(key) ?? 0) + 1); blockedPoints.push([x,y]); }
  }
  t.diagnostic(`${reachableSand}/${sandy} sandy samples reachable; blocked clusters: ${[...blocked].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([key,n])=>`${key}:${n}`).join(' ')}`);
  t.diagnostic(`Blocked sandy samples: ${blockedPoints.map(([x,y])=>`${x},${y}`).join(' ')}`);
  assert.ok(sandy > 0 && reachableSand / sandy >= .9, 'too much painted road is inaccessible');
});

test('expanded navigation stays off painted water and dense tree canopy', async t => {
  const { data, info } = await sharp('public/assets/village/terrain.webp').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const water = [], canopy = [];
  for (let y = 36; y < map.height - 36; y += 24) for (let x = 36; x < map.width - 36; x += 24) {
    if (!canStand(x, y)) continue;
    if (map.buildings.some(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)) continue;
    let wet = 0, darkGreen = 0;
    for (const dy of [-8, 0, 8]) for (const dx of [-8, 0, 8]) {
      const offset = ((y + dy) * info.width + x + dx) * info.channels;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      if (green > red + 25 && blue > green + 10) wet++;
      if (red < 90 && green < 145 && green > red + 20 && blue < 120) darkGreen++;
    }
    if (wet >= 7) water.push([x,y]);
    if (darkGreen >= 7) canopy.push([x,y]);
  }
  t.diagnostic(`Water: ${water.map(p=>p.join(',')).join(' ')}; tree canopy: ${canopy.map(p=>p.join(',')).join(' ')}`);
  assert.deepEqual(water, [], 'the character can stand in painted water');
  assert.deepEqual(canopy, [], 'the character can stand under dense tree canopy');
});

test('keyboard movement supports equal-speed diagonals, opposing keys and touch combinations', () => {
  const input = createVillageInput();
  input.press('ArrowRight', 'ArrowRight');
  assert.deepEqual(input.vector(), { x: 1, y: 0 });
  input.press('ArrowUp', 'ArrowUp');
  const diagonal = input.vector();
  assert.ok(diagonal.x > 0 && diagonal.y < 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  input.press('ArrowLeft', 'ArrowLeft');
  assert.deepEqual(input.vector(), { x: 0, y: -1 });
  input.clear();
  assert.deepEqual(input.vector(), { x: 0, y: 0 });
  const touch = input.vector(['right', 'right', 'down']);
  assert.ok(Math.abs(touch.x - touch.y) < 1e-9);
  assert.ok(Math.abs(Math.hypot(touch.x, touch.y) - 1) < 1e-9);
});

test('WASD works with Korean input and releasing one binding preserves the other held key', () => {
  const input = createVillageInput();
  assert.equal(input.press('ㅈ', 'KeyW'), true);
  input.press('ArrowUp', 'ArrowUp');
  input.release('ㅈ', 'KeyW');
  assert.deepEqual(input.vector(), { x: 0, y: -1 });
  input.release('ArrowUp', 'ArrowUp');
  assert.deepEqual(input.vector(), { x: 0, y: 0 });
  assert.equal(input.press('Enter', 'Enter'), false);
  input.press('W', 'KeyW');
  input.press('W', 'KeyW');
  input.release('w', 'KeyW');
  assert.deepEqual(input.vector(), { x: 0, y: 0 }, 'key repeat and Shift release must not leave movement stuck');
});

function movementMap(blocked) {
  return { width: 400, height: 400, radius: 9, spawn: { x: 100, y: 200 },
    walkable: [{ id: 'ground', points: [[0, 0], [400, 0], [400, 400], [0, 400]] }],
    blocked, buildings: [], npcs: [] };
}

test('movement slides along a wall and never tunnels through it on a long step', () => {
  const world = movementMap([{ id: 'wall', points: [[200, 0], [220, 0], [220, 400], [200, 400]] }]);
  const start = { x: 191, y: 150 };
  const next = moveVillagePoint(world, start, { x: 45, y: 45 });
  assert.ok(Math.abs(next.x - 191) < 1e-6);
  assert.ok(Math.abs(next.y - 195) < 1e-6, 'diagonal input must continue down the wall');
  assert.ok(canStandInVillage(world, next));
  const blocked = moveVillagePoint(world, start, { x: 160, y: 0 });
  assert.deepEqual(blocked, start);
});

test('cardinal input glides along an angled boundary without snagging or crossing it', () => {
  const world = movementMap([{ id: 'slanted-wall', points: [[200, 50], [350, 50], [350, 200]] }]);
  let position = { x: 200, y: 64 };
  for (let i = 0; i < 20; i++) {
    position = moveVillagePoint(world, position, { x: 2, y: 0 });
    assert.ok(canStandInVillage(world, position));
  }
  assert.ok(position.x > 215 && position.y > 79, `Should slide down-right, got ${JSON.stringify(position)}`);
});

test('door entry triggers once per crossing and not when spawning or returning inside', () => {
  const building = map.buildings[0], door = building.entry;
  const outside = { x: door.x, y: door.y + 36 };
  const enter = createVillageEntrances(map, outside);
  assert.equal(enter({ x: door.x, y: door.y + 22 }), undefined, 'passing the approach is not entering');
  assert.equal(enter(door)?.id, building.id);
  assert.equal(enter(door), undefined, 'must not dispatch twice while still in the doorway');
  assert.equal(enter(outside), undefined);
  assert.equal(enter(door)?.id, building.id, 'leaving and returning should rearm the entrance');
  const returned = createVillageEntrances(map, door);
  assert.equal(returned(door), undefined, 'a restored position inside a doorway must not bounce back into the mission');
  returned(outside);
  assert.equal(returned(door)?.id, building.id);
});

for (const building of map.buildings) {
  test(`walking to ${building.id} triggers its doorway and returning leaves the character outside`, () => {
    const route = navigation.route(map.spawn, building.entry);
    const enter = createVillageEntrances(map, map.spawn);
    let position = { ...map.spawn }, entered, ticks = 0;
    const waypoints = [...route];
    while (waypoints.length && !entered && ticks++ < 1800) {
      const target = waypoints[0], dx = target.x - position.x, dy = target.y - position.y;
      const length = Math.hypot(dx, dy);
      if (length < 3) { waypoints.shift(); continue; }
      const amount = Math.min(length, 220 / 60);
      position = moveVillagePoint(map, position, { x: dx / length * amount, y: dy / length * amount });
      assert.ok(canStandInVillage(map, position), 'every foot position must remain on safe ground');
      entered = enter(position);
    }
    assert.equal(entered?.id, building.id, `No auto entry after ${ticks} movement ticks`);
    const wanted = { x: building.entry.x, y: building.entry.y + 36 };
    const returned = navigation.stand(wanted) ? wanted : navigation.nearest(wanted, 100);
    assert.ok(returned && canStandInVillage(map, returned));
    assert.ok(Math.hypot(returned.x - building.entry.x, returned.y - building.entry.y) > 16);
    assert.equal(createVillageEntrances(map, returned)(returned), undefined);
  });
}

test('every restored building has its own lights inside the map, and the plaza lights join at the end', () => {
  for (const id of [...map.buildings.map(building => building.id), 'plaza']) {
    assert.ok(villageLights[id]?.some(light => light.kind !== 'aura'), `${id} needs windows or lamps`);
    for (const light of villageLights[id]) {
      assert.ok(light.r > 0 && light.x - light.r > -40 && light.y - light.r > -40 && light.x < map.width && light.y < map.height, `${id} light off the map`);
    }
  }
});

test('light-flow roads leave each lab door and reach the core door along walkable ground', () => {
  const routes = villageLightRoutes(map, createVillageNavigation(map));
  const core = map.buildings.find(building => building.id === 'rescue');
  assert.equal(routes.rescue, undefined, 'the core sends its light outward along the other roads');
  for (const building of map.buildings.filter(item => item.id !== 'rescue')) {
    const route = routes[building.id];
    assert.ok(route && route.length >= 2, `${building.id} needs a road`);
    assert.ok(Math.hypot(route[0].x - building.entry.x, route[0].y - building.entry.y) < 40, `${building.id} road must start at its door`);
    assert.ok(Math.hypot(route.at(-1).x - core.entry.x, route.at(-1).y - core.entry.y) < 60, `${building.id} road must end at the core`);
    for (let i = 1; i < route.length; i++) assert.ok(navigation.segment(route[i - 1], route[i]), `${building.id} road leaves the path at ${i}`);
  }
});

test('main-button goal text uses the right Korean particle', () => {
  assert.equal(withDirectionParticle('균형 다리'), '균형 다리로');
  assert.equal(withDirectionParticle('운반 공방'), '운반 공방으로');
  assert.equal(withDirectionParticle('중앙 코어'), '중앙 코어로');
  assert.equal(withDirectionParticle('물길'), '물길로');
});

test('the request board stands on the plaza near the doctor and can be reached on foot', () => {
  const doctor = map.npcs.find(npc => npc.id === 'guide');
  assert.ok(Math.hypot(requestBoardSpot.x - doctor.x, requestBoardSpot.y - doctor.y) < 140, 'board belongs beside the doctor');
  for (const building of map.buildings) {
    assert.ok(Math.hypot(requestBoardSpot.x - building.entry.x, requestBoardSpot.y - building.entry.y) > 150, `board must not crowd the ${building.id} door`);
  }
  const stand = navigation.nearest(requestBoardSpot, 80);
  assert.ok(stand && Math.hypot(stand.x - requestBoardSpot.x, stand.y - requestBoardSpot.y) <= 80, 'a reading spot within reach of the board');
  assert.ok(navigation.route(map.spawn, stand), 'the reading spot is walkable from spawn');
  assert.ok(Math.hypot(map.spawn.x - requestBoardSpot.x, map.spawn.y - requestBoardSpot.y) > 80, 'arriving at spawn does not hijack the main button');
});

for (const [id, spot] of Object.entries(requesterSpots)) {
  test(`the ${id} client stands clear of the door, the return spot and the bottom bar`, () => {
    const building = map.buildings.find(item => item.id === id);
    const wanted = { x: building.entry.x, y: building.entry.y + 36 };
    const returned = navigation.stand(wanted) ? wanted : navigation.nearest(wanted, 100);
    assert.ok(Math.hypot(returned.x - spot.x, returned.y - spot.y) > 48 + 15, 'coming back from the mission must not land in the talk radius');
    assert.ok(Math.hypot(building.entry.x - spot.x, building.entry.y - spot.y) > building.entry.radius + 11 + 30, 'not standing in the doorway');
    assert.ok(spot.y < map.height * .86 && spot.y - 70 > 0, 'whole sprite above the bottom bar');
    for (const point of [spot.bubble, spot.sign]) assert.ok(point.x > 60 && point.x < map.width - 60 && point.y > 60 && point.y < map.height * .86, `${id} bubble/sign inside the frame`);
    assert.ok(Math.abs(spot.bubble.x - spot.x) >= 45, 'speech bubble beside the head, not on it');
  });
}

test('client names take the right Korean particles', () => {
  assert.equal(withParticle('빵집 주인', '과', '와'), '빵집 주인과');
  assert.equal(withParticle('공방 친구', '과', '와'), '공방 친구와');
  assert.equal(withParticle('보급소 직원', '이', '가'), '보급소 직원이');
  assert.equal(withParticle('공방 친구', '이', '가'), '공방 친구가');
});
