import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';
import { coreRoutePoint, coreRoutes, type CoreRoute } from '../coreSceneModel';
import { coreHoldSpot, corePlace, crateHoldSpot, crateX, walkCheckpoint, walkCourse, type WalkSpot, type WalkView } from '../rescueWalkModel';
import { coreAssets } from './coreAssets';

// The walking version of the core mission: a one-way workshop the explorer walks through.
// Stage (floor, ramps, props), figure (upright pictures), fixed follow camera and walking live here.
// What the experiment does is not decided here: rescue.ts tells this scene where the crate and the core are.
type ScreenPoint = { x: number; y: number };
/** stepping: the explorer is walking on the floor (the walk strip is showing), for footstep sounds. */
export type WalkFrame = { spot: WalkSpot; scale: ScreenPoint; short: ScreenPoint; long: ScreenPoint; core: ScreenPoint; stepping?: boolean };
export type WalkHold = 'pull' | 'push' | null;
export interface WalkStage {
  sync(view: WalkView): void;
  move(x: number, z: number): void;
  jump(): void;
  hold(kind: WalkHold): void;
  react(kind: 'cheer' | 'flinch'): void;
  setPaused(paused: boolean): void;
  inspect(on: boolean): void;
  dock(): Promise<boolean>;
  dispose(): void;
}
export type WalkEvents = { frame(frame: WalkFrame): void; bump(): void; returned(): void; jumped?(): void };

type Strip = { file: string; frames: number; fps: number; cols?: number; rows?: number; row?: number };
const art = `${import.meta.env.BASE_URL}assets/`;
const strips = {
  idle: { file: 'run-stage/explorer-idle.webp', frames: 1, fps: 1 },
  walk: { file: 'run-stage/explorer-walk.webp', frames: 6, fps: 10 },
  push: { file: 'run-stage/explorer-push.webp', frames: 6, fps: 8 },
  pull: { file: 'run-stage/explorer-pull.webp', frames: 5, fps: 7 },
  jump: { file: 'run-stage/explorer-jump.webp', frames: 1, fps: 1 },
  cheer: { file: 'run-stage/explorer-cheer.webp', frames: 1, fps: 1 },
  corgi: { file: 'run-stage/corgi-walk.webp', frames: 6, fps: 10 },
  bot: { file: 'run-stage/bot-walk.webp', frames: 6, fps: 8 },
} satisfies Record<string, Strip>;
const pictures = {
  core: 'props/core-cargo.webp', crate: 'props/wood-crate.webp', scale: 'game/scale.webp', wood: 'textures/workshop-wood.webp',
  floor: 'run-stage/floor.webp', pile: 'run-stage/parts-pile.webp', wall: 'run-stage/wall.webp', panel: 'run-stage/panel.webp', dock: 'run-stage/dock.webp',
  shelf: 'run-stage/decor-shelf.webp', barrels: 'run-stage/decor-barrels.webp', bench: 'run-stage/decor-bench.webp',
};

const GRAVITY = 24, JUMP = 7.4, ACCEL = 42, DAMPING = 12, RADIUS = .3, BODY = 1.1;

// Figures and props are upright pictures that stand straight on the floor. A camera-facing sprite would lean back
// under this raised view and cut into whatever stands behind it.
const upright = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
const STAND = 1.1; // a little taller, because the raised view shortens upright pictures
function standing(texture?: THREE.Texture) {
  const material = new THREE.MeshBasicMaterial({ map: texture ?? null, transparent: true, alphaTest: .2 });
  return new THREE.Mesh(upright, material);
}
class Figure {
  readonly sprite = standing();
  private name = ''; private clock = 0; private facing = 1;
  constructor(private readonly maps: Record<string, { texture: THREE.Texture; strip: Strip }>, private readonly height: number, first: string) { this.show(first, 1, 0); }
  /** Shows one animation; `facing` -1 mirrors the picture. */
  show(name: string, facing: number, dt: number) {
    const entry = this.maps[name] ?? Object.values(this.maps)[0], { texture, strip } = entry;
    if (name !== this.name) { this.name = name; this.clock = 0; this.sprite.material.map = texture; this.sprite.material.needsUpdate = true; }
    this.clock += dt; this.facing = facing < 0 ? -1 : 1;
    const cols = strip.cols ?? strip.frames, rows = strip.rows ?? 1, frame = Math.floor(this.clock * strip.fps) % strip.frames;
    const image = texture.image as { width: number; height: number };
    texture.repeat.set(this.facing / cols, 1 / rows);
    texture.offset.set((frame + (this.facing < 0 ? 1 : 0)) / cols, 1 - ((strip.row ?? 0) + 1) / rows);
    const ratio = (image.width / cols) / (image.height / rows);
    this.sprite.scale.set(this.height * ratio, this.height * STAND, 1);
  }
  /** Feet on this spot (the pictures keep a small empty margin below the feet). */
  stand(x: number, y: number, z: number) { this.sprite.position.set(x, y - this.height * STAND * .035, z); }
}

export async function createWalkStage(host: HTMLElement, signal: AbortSignal, startAt: WalkSpot, events: WalkEvents): Promise<WalkStage> {
  const loader = new THREE.TextureLoader();
  const load = async (file: string) => { const texture = await loader.loadAsync(art + file); texture.colorSpace = THREE.SRGBColorSpace; return texture; };
  const stripNames = Object.keys(strips) as (keyof typeof strips)[], pictureNames = Object.keys(pictures) as (keyof typeof pictures)[];
  const loaded = await Promise.all([...stripNames.map(name => load(strips[name].file)), ...pictureNames.map(name => load(pictures[name]))]);
  const textures = loaded.slice();
  if (signal.aborted) { textures.forEach(texture => texture.dispose()); throw new Error('aborted'); }
  const stripMap = Object.fromEntries(stripNames.map((name, i) => [name, { texture: loaded[i], strip: strips[name] as Strip }]));
  const picture = Object.fromEntries(pictureNames.map((name, i) => [name, loaded[stripNames.length + i]])) as Record<keyof typeof pictures, THREE.Texture>;

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); }
  catch (error) { textures.forEach(texture => texture.dispose()); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor('#102a33');
  renderer.domElement.setAttribute('aria-label', '탐구자가 걸어 다니는 코어 작업장. 왼쪽부터 저울, 막힌 문, 두 빗면, 중앙 장치가 이어져요.');
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene(), solid = new THREE.Group(), geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  scene.add(solid);
  scene.add(new THREE.HemisphereLight('#e6f1e6', '#1b3a45', 1.5));
  const sun = new THREE.DirectionalLight('#fff0ce', 1.6); sun.position.set(-4, 9, 7); scene.add(sun);
  const paint = (color: string, map?: THREE.Texture) => { const material = new THREE.MeshLambertMaterial(map ? { color, map } : { color }); materials.push(material); return material; };
  const tiled = (texture: THREE.Texture, x: number, y: number) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(x, y); return texture; };
  const casing = paint('#eef3ee', tiled(picture.panel, 1, 1));
  /** A box that is drawn; `blocks` also makes it something the explorer walks on or into. */
  function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, blocks = true, parent: THREE.Object3D = blocks ? solid : scene) {
    const geometry = new THREE.BoxGeometry(w, h, d); geometries.push(geometry);
    if (material === casing) { // keep the wall panels one size on every box: a tile of three panels covers 1.8 units
      const uv = geometry.attributes.uv, sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let i = 0; i < uv.count; i++) { const [across, up] = sizes[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * across / 1.8, uv.getY(i) * up / 1.8); }
    }
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  const unseen = new THREE.MeshBasicMaterial({ visible: false }); materials.push(unseen);
  const { minX, maxX, halfDepth, gateX, doorHalf, sillX, pileX } = walkCourse, length = maxX - minX + 2, midX = (minX + maxX) / 2;
  const dark = paint('#233c47'), brass = paint('#c9a45c');
  box(length + 12, 1, halfDepth * 2 + 1.2, paint('#ffffff', tiled(picture.floor, (length + 12) / 2.4, (halfDepth * 2 + 1.2) / 2.4)), midX, -.5, 0);
  // Back wall: one long painted wall, mirrored so it repeats without a seam.
  const wallHeight = 4.7, wallArt = picture.wall, wallImage = wallArt.image as { width: number; height: number };
  wallArt.wrapS = THREE.MirroredRepeatWrapping; wallArt.repeat.set((length + 14) / (wallHeight * wallImage.width / wallImage.height), 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(length + 14, wallHeight), new THREE.MeshBasicMaterial({ map: wallArt })); geometries.push(wall.geometry); materials.push(wall.material);
  wall.position.set(midX, wallHeight / 2 - .05, -halfDepth - .6); scene.add(wall);
  for (const [w, h, d, x, y, z] of [[length, 6, .4, midX, 3, -halfDepth - .2], [length, 6, .4, midX, 3, halfDepth - .05], [.4, 6, 8, minX - .2, 3, 0], [.4, 6, 8, maxX + .4, 3, 0]] as const) box(w, h, d, unseen, x, y, z);
  /** A picture standing upright and facing the viewer; the view never turns, so it never shows its edge. */
  const flat = (texture: THREE.Texture, width: number, x: number, y: number, z: number) => {
    const image = texture.image as { width: number; height: number }, height = width * image.height / image.width;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .05 }));
    geometries.push(mesh.geometry); materials.push(mesh.material); mesh.position.set(x, y + height / 2, z); scene.add(mesh); return mesh;
  };
  // Furniture along the back wall. It is only looked at, but nobody can stand inside it.
  for (const [texture, width, x] of [[picture.shelf, 2, minX + .95], [picture.barrels, 1.7, sillX + 2.2], [picture.bench, 2.3, -4.6]] as const) {
    flat(texture, width, x, 0, -halfDepth + .15); box(width * .8, 2.6, .5, unseen, x, 1.3, -halfDepth + .15);
  }
  // Scale corner: the stand that holds the core, and the scale on its table.
  const { station, scale: scaleSpot } = walkCourse;
  const tableWood = picture.wood.clone(); tableWood.needsUpdate = true; textures.push(tableWood); const tableTop = paint('#ffffff', tableWood);
  box(1.15, .44, .8, casing, station.x, .22, station.z); box(1.3, .08, .95, tableTop, station.x, .46, station.z, false);
  box(1.8, .44, .95, casing, scaleSpot.x, .22, scaleSpot.z); box(1.95, .08, 1.1, tableTop, scaleSpot.x, .46, scaleSpot.z, false);
  flat(picture.scale, 1.5, scaleSpot.x, .5, scaleSpot.z + .05);
  // Tables are for the core and the scale, not for standing on.
  box(1.3, 2.4, .95, unseen, station.x, 1.2, station.z); box(1.95, 2.4, 1.1, unseen, scaleSpot.x, 1.2, scaleSpot.z);
  // Rail along the back wall: the weighed core rides it to the ramps once the way is open.
  const railY = 2.6, railZ = -halfDepth - .25, railFrom = scaleSpot.x - .6, railTo = coreRoutes.short.start.x + .6;
  box(railTo - railFrom, .1, .12, brass, (railFrom + railTo) / 2, railY, railZ, false);
  for (const x of [railFrom, (railFrom + railTo) / 2, railTo]) box(.1, .5, .1, dark, x, railY + .25, railZ, false);
  const trolley = box(.5, .2, .3, dark, 0, 0, 0, false), cable = box(.05, 1, .05, dark, 0, 0, 0, false);
  // A low sill to hop over.
  box(.45, .28, halfDepth * 2, paint('#a98a52'), sillX, .14, 0); box(.2, .02, halfDepth * 2, paint('#e8cf8f'), sillX, .285, 0, false);
  // The gate: a wall with one doorway. The near half is a low fence so the doorway stays in view, but nobody walks through it.
  const wallDepth = halfDepth + .4 - doorHalf;
  box(1, 2.1, wallDepth, casing, gateX, 1.05, -(doorHalf + wallDepth / 2)); box(1.08, .1, wallDepth + .04, dark, gateX, 2.15, -(doorHalf + wallDepth / 2), false);
  box(1.04, .08, .08, brass, gateX, 2.02, -doorHalf + .02, false);
  box(.5, .5, wallDepth, casing, gateX, .25, doorHalf + wallDepth / 2); box(.58, .06, wallDepth + .04, dark, gateX, .53, doorHalf + wallDepth / 2, false);
  box(.5, 6, wallDepth, unseen, gateX, 3, doorHalf + wallDepth / 2);
  for (const side of [-1, 1]) box(.3, .34, .3, brass, gateX + .62, .17, side * (doorHalf - .2), false);
  // Scattered parts on the near half of the passage: walk round them or hop over.
  box(.8, .45, 1.5, unseen, pileX, .225, halfDepth - .75);
  flat(picture.pile, 1.55, pileX, -.04, halfDepth - .6);
  // Ramps and the raised deck, at the same places and heights as the bench (coreRoutes).
  box(3.8, 1.3, 4.5, casing, 3.4, .65, 0); box(3.84, .04, 4.54, paint('#5f8683'), 3.4, 1.285, 0, false); box(3.9, .08, .08, brass, 3.4, 1.26, 2.27, false);
  box(.08, 2.6, 1.24, unseen, 1.46, 1.3, 0); // the deck is reached by a ramp, not by hopping up its wall
  const rails: Record<CoreRoute, THREE.MeshLambertMaterial> = { long: paint('#5edbc8'), short: paint('#e9b867') };
  for (const route of ['long', 'short'] as const) {
    const { start, end } = coreRoutes[route], dx = end.x - start.x, dy = end.y - start.y, angle = Math.atan2(dy, dx), span = Math.hypot(dx, dy);
    const beam = new THREE.Group(); beam.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, start.z); beam.rotation.z = angle; solid.add(beam);
    const boards = picture.wood.clone(); boards.needsUpdate = true; textures.push(boards);
    box(span + .3, .15, 1.22, paint('#ffffff', tiled(boards, span / 1.6, 1)), -.12, -.075, 0, true, beam);
    for (const z of [-.61, .61]) box(span, .09, .06, rails[route], 0, .03, z, false, beam);
    for (const t of [.38, .76]) { const point = coreRoutePoint(route, t), height = Math.max(.06, point.y - .1); for (const z of [start.z - .46, start.z + .46]) box(.14, height, .18, dark, point.x, height / 2, z, false); }
    // Unseen side rails along the raised part: nobody squeezes in under a ramp or drops off its side,
    // and the narrow strip between a ramp and the wall behind it is closed.
    const low = coreRoutePoint(route, .3), railSpan = end.x - low.x, outer = Math.sign(start.z);
    for (const z of [start.z - .66, start.z + .66]) box(railSpan, 2.6, .08, unseen, low.x + railSpan / 2, 1.3, z);
    box(railSpan, 2.6, 1, unseen, low.x + railSpan / 2, 1.3, start.z + outer * 1.16);
  }
  // The central device the core goes back into: a picture, with five lamps on the deck front that light up by code.
  const { dock: dockSpot } = walkCourse;
  const device = flat(picture.dock, 2.3, dockSpot.x, dockSpot.y - .03, dockSpot.z - .75), deviceHeight = device.geometry.parameters.height;
  box(2, 2.6, 1, unseen, dockSpot.x, dockSpot.y + 1.3, dockSpot.z - 1.05);
  // The socket is drawn about a third of the way up the device picture; the core comes to rest on it.
  const socket = new THREE.Vector3(dockSpot.x, dockSpot.y + deviceHeight * .31, dockSpot.z - .65);
  const lamps = Array.from({ length: 5 }, (_unused, i) => {
    const material = new THREE.MeshBasicMaterial({ color: '#294f59' }), geometry = new THREE.CircleGeometry(.13, 20); materials.push(material); geometries.push(geometry);
    const lamp = new THREE.Mesh(geometry, material); lamp.position.set(2.2 + i * .6, .8, 2.26); scene.add(lamp);
    const rim = new THREE.Mesh(new THREE.RingGeometry(.13, .18, 20), brass); geometries.push(rim.geometry); rim.position.copy(lamp.position); scene.add(rim);
    return material;
  });

  solid.updateMatrixWorld(true);
  const world = new Octree(); world.fromGraphNode(solid);

  // Moving things: all upright pictures with a round shadow.
  const shadowGeometry = new THREE.CircleGeometry(.5, 20), shadowMaterial = new THREE.MeshBasicMaterial({ color: '#04141b', transparent: true, opacity: .3, depthWrite: false });
  geometries.push(shadowGeometry); materials.push(shadowMaterial);
  const shadow = (size: number) => { const mesh = new THREE.Mesh(shadowGeometry, shadowMaterial); mesh.rotation.x = -Math.PI / 2; mesh.scale.setScalar(size); scene.add(mesh); return mesh; };
  const prop = (texture: THREE.Texture, width: number) => {
    const image = texture.image as { width: number; height: number }, mesh = standing(texture); materials.push(mesh.material);
    mesh.scale.set(width, width * image.height / image.width * STAND, 1); scene.add(mesh); return mesh;
  };
  const crate = prop(picture.crate, 1.6), crateShadow = shadow(1.4);
  const core = prop(picture.core, 1.05), coreShadow = shadow(.9);
  const explorer = new Figure(stripMap, 1.8, 'idle'), corgi = new Figure({ corgi: stripMap.corgi }, .95, 'corgi'), bot = new Figure({ bot: stripMap.bot }, 1.3, 'bot');
  const explorerShadow = shadow(.75), corgiShadow = shadow(.55), botShadow = shadow(.8);
  scene.add(explorer.sprite, corgi.sprite, bot.sprite);
  for (const figure of [explorer, corgi, bot]) materials.push(figure.sprite.material);

  const camera = new THREE.PerspectiveCamera(34, 1, .1, 90), look = new THREE.Vector3(startAt.x + 1.4, 1, 0);
  const body = new Capsule(new THREE.Vector3(), new THREE.Vector3(), RADIUS), velocity = new THREE.Vector3();
  const place = (spot: WalkSpot) => { body.start.set(spot.x, spot.y + RADIUS, spot.z); body.end.set(spot.x, spot.y + RADIUS + BODY - RADIUS * 2 + .3, spot.z); velocity.set(0, 0, 0); };
  place(startAt);
  const feet = () => ({ x: body.start.x, y: body.start.y - RADIUS, z: body.start.z });
  const ground = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  function floorUnder(x: number, y: number, z: number) { ground.set(new THREE.Vector3(x, y + .6, z), down); ground.far = 6; return ground.intersectObject(solid, true)[0]?.point.y ?? 0; }

  let disposed = false, paused = false, raf = 0, last = 0;
  let view: WalkView = { phase: 0, loaded: false, route: 'short', progress: 0, delivered: false };
  let inputX = 0, inputZ = 0, jumpAt = -1, onFloor = true, airTime = 0, facing = 1, held: WalkHold = null;
  let reaction = '', reactionUntil = 0, bumpUntil = 0, clock = 0;
  let rail: { started: number; from: THREE.Vector3 } | null = null, inspecting = false, docking: { started: number; from: THREE.Vector3; resolve(value: boolean): void } | null = null, docked = false;
  let model: THREE.Object3D | null = null, modelLoading = false;
  const corgiSpot = new THREE.Vector3(startAt.x - .9, 0, startAt.z + .4), corePosition = new THREE.Vector3();
  const botHome = { x: pileX - .1, z: -1.15, reach: 1.05 };

  function corePoint(now: number) {
    if (docking || docked) {
      const k = docking ? Math.min(1, (now - docking.started) / 1500) : 1, eased = k * k * (3 - 2 * k), to = socket;
      if (docking) { corePosition.lerpVectors(docking.from, to, eased); corePosition.y += Math.sin(eased * Math.PI) * .7; } else corePosition.copy(to);
      return;
    }
    if (view.phase === 2 && !view.delivered && rail) {
      const k = (now - rail.started) / 2400, to = coreRoutePoint(view.route, 0), high = railY - 1.25, back = railZ + .1;
      if (k >= 1) rail = null;
      else {
        // Lifted up to the rail, carried along it, then lowered onto the start of the ramp.
        const ease = (t: number) => t * t * (3 - 2 * t), a = ease(Math.min(1, k / .2)), b = ease(Math.min(1, Math.max(0, (k - .2) / .55))), c = ease(Math.max(0, (k - .75) / .25));
        corePosition.set(rail.from.x + (to.x - rail.from.x) * b, rail.from.y + (high - rail.from.y) * a + (to.y - high) * c, rail.from.z + (back - rail.from.z) * a + (to.z - back) * c);
        return;
      }
    }
    const { point } = corePlace(view); corePosition.set(point.x, point.y, point.z);
  }

  function pushOut(cx: number, cz: number, halfX: number, halfZ: number) {
    const px = body.start.x, pz = body.start.z, nearX = Math.max(cx - halfX, Math.min(cx + halfX, px)), nearZ = Math.max(cz - halfZ, Math.min(cz + halfZ, pz));
    let dx = px - nearX, dz = pz - nearZ; const distance = Math.hypot(dx, dz);
    if (distance >= RADIUS) return;
    if (distance < 1e-6) { // centre is inside: leave through the nearest side
      const toX = halfX - Math.abs(px - cx), toZ = halfZ - Math.abs(pz - cz);
      if (toX < toZ) { dx = Math.sign(px - cx) || -1; dz = 0; body.translate(new THREE.Vector3(dx * (toX + RADIUS), 0, 0)); }
      else { dz = Math.sign(pz - cz) || 1; body.translate(new THREE.Vector3(0, 0, dz * (toZ + RADIUS))); }
      return;
    }
    body.translate(new THREE.Vector3(dx / distance * (RADIUS - distance), 0, dz / distance * (RADIUS - distance)));
  }

  function walk(dt: number, now: number) {
    if (held) {
      const spot = held === 'pull' ? crateHoldSpot(view.progress) : coreHoldSpot(view.route, view.progress);
      place(spot); onFloor = true; airTime = 0; facing = 1; return;
    }
    const free = !inspecting && !docking;
    // Standing, the capsule rests a hair above the floor between contacts, so a short gap still counts as standing.
    const grounded = airTime < .1, push = dt * (grounded ? ACCEL : ACCEL * .3);
    const diagonal = inputX && inputZ ? Math.SQRT1_2 : 1;
    if (free) { velocity.x += inputX * push * diagonal; velocity.z += inputZ * push * diagonal; if (inputX) facing = inputX; }
    if (free && grounded && now - jumpAt < 160) { velocity.y = JUMP; onFloor = false; airTime = .1; jumpAt = -1; events.jumped?.(); }
    let damping = Math.exp(-DAMPING * dt) - 1;
    if (!onFloor) velocity.y -= GRAVITY * dt;
    if (!grounded) damping *= .1;
    velocity.x += velocity.x * damping; velocity.z += velocity.z * damping;
    body.translate(velocity.clone().multiplyScalar(dt));
    const hit = world.capsuleIntersect(body); onFloor = false;
    if (hit) {
      onFloor = hit.normal.y > .15;
      if (!onFloor) velocity.addScaledVector(hit.normal, -hit.normal.dot(velocity)); else if (velocity.y < 0) velocity.y = 0;
      if (hit.depth >= 1e-10) body.translate(hit.normal.multiplyScalar(hit.depth));
    }
    airTime = onFloor ? 0 : airTime + dt;
    const at = feet();
    if (view.phase < 2 && at.y < 1.5) pushOut(crateX(view.progress), 0, .7, .7);
    else if (view.phase === 2 && at.y < 1.5) pushOut(crateX(1), 0, .7, .7);
    if (view.phase === 2 && !rail && !docked && Math.abs(at.y - corePosition.y) < .9) pushOut(corePosition.x, corePosition.z, .34, .34);
    // A closed gate is never passed, even by a lucky hop.
    if (view.phase < 2 && body.start.x > gateX - .5) body.translate(new THREE.Vector3(gateX - .5 - body.start.x, 0, 0));
    if (!Number.isFinite(body.start.x + body.start.y + body.start.z) || body.start.y < -6) { place(walkCheckpoint(Number.isFinite(body.start.x) ? body.start.x : minX, view.phase === 2)); onFloor = true; airTime = 0; events.returned(); }
  }

  function draw(now: number, dt: number) {
    corePoint(now);
    const at = feet(), speed = Math.hypot(velocity.x, velocity.z);
    const name = held ?? (now < reactionUntil ? reaction : airTime > .12 ? 'jump' : speed > .5 ? 'walk' : 'idle');
    explorer.show(name === 'flinch' ? 'idle' : name, facing, dt);
    explorer.stand(at.x, at.y, at.z);
    explorer.sprite.material.color.set(now < bumpUntil && Math.floor(now / 90) % 2 ? '#ffb0a0' : '#ffffff');
    const floor = airTime > .12 ? floorUnder(at.x, at.y, at.z) : at.y;
    explorerShadow.position.set(at.x, floor + .02, at.z); explorerShadow.scale.setScalar(.75 * Math.max(.45, 1 - (at.y - floor) * .35));
    // The corgi trots a step behind.
    const behind = new THREE.Vector3(at.x - facing * .95, corgiSpot.y, at.z + .45), gap = corgiSpot.distanceTo(behind);
    if (gap > .12) corgiSpot.lerp(behind, 1 - Math.exp(-5 * dt));
    corgiSpot.y += (floorUnder(corgiSpot.x, Math.max(at.y, corgiSpot.y), corgiSpot.z) - corgiSpot.y) * Math.min(1, dt * 12);
    corgi.show('corgi', behind.x >= corgiSpot.x ? 1 : -1, gap > .2 ? dt : 0);
    corgi.stand(corgiSpot.x, corgiSpot.y, corgiSpot.z); corgiShadow.position.set(corgiSpot.x, corgiSpot.y + .02, corgiSpot.z);
    // The wheel-lock bot only paces across the passage.
    const sweep = Math.sin(clock * .9), botZ = botHome.z + sweep * botHome.reach;
    bot.show('bot', Math.cos(clock * .9) >= 0 ? 1 : -1, dt);
    bot.stand(botHome.x, 0, botZ); botShadow.position.set(botHome.x, .02, botZ);
    if (view.phase === 2 && !held && now > bumpUntil && at.y < .8 && Math.hypot(at.x - botHome.x, at.z - botZ) < .75) {
      bumpUntil = now + 1100; velocity.x += (at.x >= botHome.x ? 1 : -1) * 4.5; reaction = 'flinch'; reactionUntil = now + 500; events.bump();
    }
    const cx = view.phase === 2 ? crateX(1) : crateX(view.progress);
    crate.position.set(cx, -.06, .35); crateShadow.position.set(cx, .02, 0);
    core.position.set(corePosition.x, corePosition.y - .05, corePosition.z + .1); core.visible = !model?.visible;
    for (const item of [explorer.sprite, corgi.sprite, explorerShadow, corgiShadow]) item.visible = !inspecting;
    // The trolley and its cable show only while the core rides the rail.
    trolley.visible = cable.visible = !!rail && view.phase === 2;
    if (rail) { const drop = Math.max(.05, railY - .1 - (corePosition.y + .8));
      trolley.position.set(corePosition.x, railY - .1, railZ);
      cable.position.set(corePosition.x, railY - .1 - drop / 2, railZ + (corePosition.z - railZ) / 2);
      cable.scale.set(1, drop, 1);
      cable.visible = corePosition.z < railZ + .6; }
    coreShadow.visible = view.phase === 2 && !rail && !docking && !docked; coreShadow.position.set(corePosition.x, corePosition.y + .03, corePosition.z);
    if (model?.visible) { model.position.copy(corePosition); }
    rails.long.emissive.set(view.phase === 2 && view.route === 'long' ? '#1f6e63' : '#000000'); rails.short.emissive.set(view.phase === 2 && view.route === 'short' ? '#7a5a1e' : '#000000');
    if (docking) { const k = (now - docking.started) / 2200; lamps.forEach((lamp, i) => lamp.color.set(k >= .55 + i * .08 ? '#9ff9d7' : '#294f59')); if (k >= 1) { const done = docking; docking = null; docked = true; done.resolve(true); } }
    // Fixed follow camera: it slides with the explorer and never turns.
    const wide = Math.max(1, 1.75 / camera.aspect), targetX = THREE.MathUtils.clamp(at.x + 1.4, minX + 5.2, maxX - 3.4);
    const want = inspecting || docking ? new THREE.Vector3(corePosition.x, corePosition.y + .45, corePosition.z) : new THREE.Vector3(targetX, 1 + THREE.MathUtils.smoothstep(at.x, -5, 1) * .7, 0);
    look.lerp(want, dt ? 1 - Math.exp(-5 * dt) : 1);
    const offset = inspecting ? new THREE.Vector3(0, 1.3, 3.6) : docking ? new THREE.Vector3(-1.2, 2.6, 7) : new THREE.Vector3(0, 4.4 * wide, 9 * wide);
    camera.position.lerp(look.clone().add(offset), dt ? 1 - Math.exp(-6 * dt) : 1); camera.lookAt(look);
    renderer.render(scene, camera);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles); renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.spot = `${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)}`;
    const screen = (x: number, y: number, z: number): ScreenPoint => { const p = new THREE.Vector3(x, y, z).project(camera); return { x: (p.x + 1) / 2 * host.clientWidth, y: (1 - p.y) / 2 * host.clientHeight }; };
    events.frame({
      spot: at, stepping: name === 'walk', scale: screen(scaleSpot.x - .17, .93, scaleSpot.z + .06),
      long: screen(coreRoutes.long.start.x + 3.6, 2.95, coreRoutes.long.start.z), short: screen(coreRoutes.short.start.x + 1.7, 2.95, coreRoutes.short.start.z),
      core: screen(corePosition.x, corePosition.y + .55, corePosition.z),
    });
  }

  function tick(now: number) {
    if (disposed || paused) return;
    const elapsed = Math.min(.05, last ? (now - last) / 1000 : 0); last = now; clock += elapsed;
    // Five small steps a frame, so a slow tablet never drops the explorer through the floor.
    for (let i = 0; i < 5; i++) walk(elapsed / 5, now);
    draw(now, elapsed);
    raf = requestAnimationFrame(tick);
  }
  const resize = () => {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false); if (paused) draw(performance.now(), 0);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize(); draw(performance.now(), 0);
  raf = requestAnimationFrame(tick);

  async function showModel() {
    if (model || modelLoading) { if (model) model.visible = inspecting; return; }
    modelLoading = true;
    try {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
      const loadedModel = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(coreAssets.core)).scene;
      if (disposed) return;
      const bounds = new THREE.Box3().setFromObject(loadedModel), size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
      loadedModel.position.set(-centre.x, -bounds.min.y, -centre.z);
      model = new THREE.Group(); model.add(loadedModel); model.scale.setScalar(1.05 / size.x); model.visible = inspecting; scene.add(model);
    } catch { /* the picture of the core stays */ } finally { modelLoading = false; }
  }

  const api: WalkStage = {
    sync(next) {
      if (disposed) return;
      if (view.phase === 1 && next.phase === 2) rail = { started: performance.now(), from: corePosition.clone() };
      if (!next.delivered) docked = false;
      view = next; if (paused) draw(performance.now(), 0);
    },
    move(x, z) { inputX = Math.sign(x); inputZ = Math.sign(z); },
    jump() { jumpAt = performance.now(); },
    hold(kind) { if (held && !kind) velocity.set(0, 0, 0); held = kind; },
    react(kind) { reaction = kind; reactionUntil = performance.now() + (kind === 'cheer' ? 1600 : 500); },
    setPaused(next) { if (paused === next || disposed) return; paused = next; inputX = inputZ = 0; if (!paused) { last = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); },
    inspect(on) { inspecting = on; if (on) void showModel(); else if (model) model.visible = false; if (model && on) model.rotation.y = 0; },
    dock() {
      if (disposed || docking || !view.delivered) return Promise.resolve(false);
      if (docked) return Promise.resolve(true);
      inspecting = false; if (model) model.visible = false;
      return new Promise<boolean>(resolve => { docking = { started: performance.now(), from: corePosition.clone(), resolve }; reaction = 'cheer'; reactionUntil = performance.now() + 2400; });
    },
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf); observer.disconnect(); docking?.resolve(false); docking = null;
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
      model?.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose(); material.dispose(); } } });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
  // While the core is looked at closely, the pad's left and right turn the core itself (the view stays put).
  const turn = () => { if (!disposed && inspecting && model && inputX) model.rotation.y += inputX * .045; if (!disposed) turnFrame = requestAnimationFrame(turn); };
  let turnFrame = requestAnimationFrame(turn);
  signal.addEventListener('abort', () => { cancelAnimationFrame(turnFrame); api.dispose(); }, { once: true });
  if (signal.aborted) api.dispose();
  return api;
}
