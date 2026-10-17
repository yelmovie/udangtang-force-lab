import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { coreRoutePoint, coreRoutes, type CoreRoute } from '../coreSceneModel';
import { coreAssets } from './coreAssets';

type ScreenPoint = { x: number; y: number };
export type CoreProjection = { core: ScreenPoint; dock: ScreenPoint; start: ScreenPoint; end: ScreenPoint; long: ScreenPoint; short: ScreenPoint };
export interface CoreScene {
  configure(route: CoreRoute, progress: number, delivered: boolean): void;
  project(): CoreProjection;
  orbit(direction: number): void;
  setView(view: 'overview' | 'inspect'): void;
  dock(): Promise<boolean>;
  dispose(): void;
}

function disposeObjects(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
  textures.forEach(value => { value.dispose(); const data = value.image as { close?: () => void } | undefined; data?.close?.(); });
}

export async function createCoreScene(host: HTMLElement, signal: AbortSignal, onProjection: (projection: CoreProjection) => void): Promise<CoreScene> {
  const loader = new GLTFLoader(), request = new AbortController();
  const abortRequest = () => request.abort();
  signal.addEventListener('abort', abortRequest, { once: true });
  if (signal.aborted) request.abort();
  const timeout = window.setTimeout(abortRequest, 15000);
  async function load(url: string) {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) throw new Error('코어 모델을 받지 못했어요.');
    return (await loader.parseAsync(await response.arrayBuffer(), '')).scene;
  }
  const loaded = await Promise.allSettled([load(coreAssets.core), load(coreAssets.dock)]);
  window.clearTimeout(timeout); signal.removeEventListener('abort', abortRequest);
  if (request.signal.aborted || signal.aborted || loaded.some(result => result.status === 'rejected')) {
    loaded.forEach(result => { if (result.status === 'fulfilled') disposeObjects(result.value); });
    throw new Error('코어 작업대를 준비하지 못했어요.');
  }
  const models = loaded.map(result => (result as PromiseFulfilledResult<THREE.Group>).value);
  const scene = new THREE.Scene(), core = new THREE.Group(), dock = new THREE.Group();
  function normalize(model: THREE.Group, width: number, axis: 'x' | 'z') {
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) { material.roughness = .68; material.metalness = .12; material.envMapIntensity = .45; }
      }
    });
    const group = new THREE.Group(); group.add(model); group.scale.setScalar(width / size[axis]); return group;
  }
  core.add(normalize(models[0], 1.05, 'x'));
  dock.add(normalize(models[1], 2.7, 'z')); dock.rotation.y = -Math.PI / 2; dock.position.set(3.95, 1.3, 0);
  scene.add(core, dock);
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (error) { disposeObjects(scene); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('aria-label', '회전하며 살펴볼 수 있는 코어와 중앙 장치, 같은 높이에 이어진 두 빗면');
  host.append(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04, .1, 100); scene.environment = environment.texture; scene.environmentIntensity = .65;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#dae9df', '#183c49', .8));
  const sunlight = new THREE.DirectionalLight('#fff0ce', 2.1); sunlight.position.set(-3, 9, 6); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024); sunlight.shadow.camera.left = -8; sunlight.shadow.camera.right = 8;
  sunlight.shadow.camera.top = 7; sunlight.shadow.camera.bottom = -7; sunlight.shadow.camera.near = .5; sunlight.shadow.camera.far = 30;
  sunlight.shadow.normalBias = .025; sunlight.shadow.bias = -.0003; sunlight.shadow.radius = 3; scene.add(sunlight);
  const rim = new THREE.DirectionalLight('#71d4df', .8); rim.position.set(5, 4, -5); scene.add(rim);
  const mat = (color: string, metalness = .25) => new THREE.MeshStandardMaterial({ color, roughness: .58, metalness });
  const casing = mat('#355462'), trim = mat('#bdc8ba'), deck = mat('#718c89', .08), dark = mat('#233c47');
  const glow = (color: string) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .6, roughness: .5 });
  const cyan = glow('#5edbc8'), amber = glow('#e9b867');
  function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(.08, h / 3, w / 4, d / 4)), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  // The room is an image; only the interactive work area and contact shadows are 3D.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), new THREE.ShadowMaterial({ color: '#05141d', opacity: .32 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.04; ground.receiveShadow = true; scene.add(ground);
  box(3.8, 1.12, 4.5, casing, 3.4, .58, 0);
  box(3.9, .16, 4.6, deck, 3.4, 1.22, 0);
  box(3.94, .1, 4.64, dark, 3.4, .1, 0);
  for (const z of [-2.24, 2.24]) box(3.8, .04, .06, cyan, 3.4, 1.12, z);
  const routeRails: Record<CoreRoute, THREE.MeshStandardMaterial> = { long: cyan.clone(), short: amber.clone() };
  const routeDecks: Record<CoreRoute, THREE.MeshStandardMaterial> = { long: deck.clone(), short: deck.clone() };
  for (const route of ['long', 'short'] as const) {
    const { start, end } = coreRoutes[route], dx = end.x - start.x, dy = end.y - start.y, angle = Math.atan2(dy, dx), length = Math.hypot(dx, dy);
    const beam = new THREE.Group(); beam.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, start.z); beam.rotation.z = angle; scene.add(beam);
    box(length, .15, 1.22, routeDecks[route], 0, -.075, 0, beam);
    for (const z of [-.61, .61]) box(length, .09, .06, routeRails[route], 0, .025, z, beam);
    for (const t of [.24, .52, .8]) {
      for (const side of [-1, 1]) {
        const marker = box(.24, .006, .025, trim, -length / 2 + length * t, .007, side * .065, beam); marker.rotation.y = side * .62;
      }
    }
    for (const t of [.38, .76]) {
      const point = coreRoutePoint(route, t), height = Math.max(.06, point.y - .1);
      for (const z of [start.z - .46, start.z + .46]) box(.14, height, .18, casing, point.x, height / 2, z);
      box(.5, .09, 1.15, dark, point.x, .015, start.z);
    }
  }
  const lampMaterials = Array.from({ length: 5 }, () => glow('#294f59'));
  lampMaterials.forEach((material, i) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .025, 16), material);
    lamp.rotation.z = Math.PI / 2; lamp.position.set(1.444, .98, -.56 + i * .28); scene.add(lamp);
  });
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#8ef7db', transparent: true, opacity: .65, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.58, .61, 48), ringMaterial); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  scene.updateMatrixWorld(true);
  const dockSpot = new THREE.Vector3(3.45, 1.5, 0);
  const ray = new THREE.Raycaster(new THREE.Vector3(dockSpot.x, 5, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(dock, true)[0]; if (hit) dockSpot.y = hit.point.y + .012;
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  const cameraTarget = new THREE.Vector3(.35, .8, 0);
  let disposed = false, route: CoreRoute = 'short', progress = -1, delivered = false, docked = false, inspecting = false;
  let azimuth = -.42, animation = 0, cameraAnimation = 0, arrivalAnimation = 0;
  let resolveAnimation: ((value: boolean) => void) | undefined;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function screen(point: THREE.Vector3): ScreenPoint {
    const projected = point.clone().project(camera); return { x: (projected.x + 1) / 2 * host.clientWidth, y: (1 - projected.y) / 2 * host.clientHeight };
  }
  function project(): CoreProjection {
    const points = coreRoutes[route];
    return { core: screen(core.position.clone().add(new THREE.Vector3(0, .4, 0))), dock: screen(dockSpot.clone().add(new THREE.Vector3(0, .35, 0))), start: screen(new THREE.Vector3(points.start.x, points.start.y + .4, points.start.z)), end: screen(new THREE.Vector3(points.end.x, points.end.y + .4, points.end.z)), long: screen(new THREE.Vector3(-2.4, .76, 1.25)), short: screen(new THREE.Vector3(.1, 1.02, -1.25)) };
  }
  function draw(shadows = false) {
    if (disposed) return;
    ring.position.copy(core.position); ring.position.y += .012; ring.visible = !inspecting && !docked;
    ring.rotation.set(-Math.PI / 2, delivered ? 0 : -Math.atan2(1.22, coreRoutes[route].end.x - coreRoutes[route].start.x), 0);
    if (shadows) renderer.shadowMap.needsUpdate = true;
    camera.lookAt(cameraTarget); camera.updateMatrixWorld(); renderer.render(scene, camera);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles); renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.view = inspecting ? 'inspect' : 'overview'; onProjection(project());
  }
  function cameraPose() {
    const target = inspecting ? core.position.clone().add(new THREE.Vector3(0, .43, 0)) : new THREE.Vector3(.35, .8, 0);
    const elevation = inspecting ? .32 : .48;
    let distance = inspecting ? 3.9 : Math.max(12.4, 12.8 / camera.aspect);
    const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    if (!inspecting) {
      const points = [new THREE.Vector3(-5.1, 0, 1.95), new THREE.Vector3(-1.85, 0, -1.95), new THREE.Vector3(5.5, 0, 2.4), new THREE.Vector3(5.5, 3.35, -.95), new THREE.Vector3(2.5, 3.35, 1.1)];
      for (let i = 0; i < 8; i++) {
        camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateMatrixWorld();
        const max = Math.max(...points.map(point => { const p = point.clone().project(camera); return Math.max(Math.abs(p.x) / .91, Math.abs(p.y) / .85); }));
        if (max <= 1) break; distance *= Math.min(1.2, max);
      }
    }
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }
  function moveCamera(animate: boolean) {
    cancelAnimationFrame(cameraAnimation);
    const from = camera.position.clone(), oldTarget = cameraTarget.clone(), next = cameraPose();
    if (!animate || reducedMotion) { camera.position.copy(next.position); cameraTarget.copy(next.target); draw(); return; }
    camera.position.copy(from); cameraTarget.copy(oldTarget);
    const started = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const t = Math.min(1, (now - started) / 260), eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(from, next.position, eased); cameraTarget.lerpVectors(oldTarget, next.target, eased); draw();
      if (t < 1) cameraAnimation = requestAnimationFrame(tick);
    };
    cameraAnimation = requestAnimationFrame(tick);
  }
  function pose() {
    if (docked) { core.position.copy(dockSpot); core.rotation.z = 0; }
    else if (delivered) { core.position.set(2.1, 1.3, coreRoutes[route].end.z); core.rotation.z = 0; }
    else { const point = coreRoutePoint(route, progress); core.position.set(point.x, point.y, point.z); core.rotation.z = Math.atan2(1.22, coreRoutes[route].end.x - coreRoutes[route].start.x); }
    draw(true);
  }
  const resize = () => {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false); if (!resolveAnimation) moveCamera(false); else draw();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); pose(); resize();
  const api: CoreScene = {
    configure(nextRoute, nextProgress, nextDelivered) {
      if (disposed || resolveAnimation) return;
      const changed = nextRoute !== route || nextProgress !== progress || nextDelivered !== delivered;
      if (!changed) { draw(); return; }
      cancelAnimationFrame(arrivalAnimation);
      const arriving = nextDelivered && !delivered, from = core.position.clone(), rotation = core.rotation.z;
      route = nextRoute; progress = nextProgress; delivered = nextDelivered; docked = false;
      lampMaterials.forEach(material => { material.color.set('#294f59'); material.emissive.set('#294f59'); material.emissiveIntensity = .1; });
      for (const key of ['long', 'short'] as const) { routeRails[key].emissiveIntensity = key === route ? .8 : .05; routeDecks[key].color.set(key === route ? '#839c90' : '#526d73'); }
      pose();
      if (arriving && !reducedMotion) {
        const to = core.position.clone(), started = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          const t = Math.min(1, (now - started) / 220), eased = t * t * (3 - 2 * t);
          core.position.lerpVectors(from, to, eased); core.rotation.z = rotation * (1 - eased); draw(true);
          if (t < 1) arrivalAnimation = requestAnimationFrame(tick);
        };
        arrivalAnimation = requestAnimationFrame(tick);
      }
    },
    project,
    orbit(direction) { if (disposed || resolveAnimation) return; azimuth = THREE.MathUtils.clamp(azimuth + direction * .2, -1.12, -.12); moveCamera(true); },
    setView(view) { if (disposed || resolveAnimation) return; inspecting = view === 'inspect'; if (!inspecting) azimuth = -.42; moveCamera(true); },
    dock() {
      if (disposed || !delivered || resolveAnimation) return Promise.resolve(false);
      cancelAnimationFrame(cameraAnimation); cancelAnimationFrame(arrivalAnimation); inspecting = false;
      const from = core.position.clone(), entry = new THREE.Vector3(2.1, dockSpot.y, 0);
      const oldCamera = camera.position.clone(), oldTarget = cameraTarget.clone(), closeTarget = dockSpot.clone().add(new THREE.Vector3(.35, .65, 0));
      const closeCamera = closeTarget.clone().add(new THREE.Vector3(-4.7, 2.9, 5.6));
      const duration = reducedMotion ? 0 : 2600, started = performance.now();
      return new Promise<boolean>(resolve => {
        resolveAnimation = resolve;
        const tick = (now: number) => {
          if (disposed) return;
          const t = duration ? Math.min(1, (now - started) / duration) : 1;
          const travel = Math.min(1, t / .48), segment = travel < .5 ? travel * 2 : (travel - .5) * 2, eased = segment * segment * (3 - 2 * segment);
          core.position.lerpVectors(travel < .5 ? from : entry, travel < .5 ? entry : dockSpot, eased); core.rotation.z = 0;
          const zoom = THREE.MathUtils.smoothstep(t, .12, .72);
          camera.position.lerpVectors(oldCamera, closeCamera, zoom); cameraTarget.lerpVectors(oldTarget, closeTarget, zoom);
          lampMaterials.forEach((material, i) => { const lit = t >= .5 + i * .055; material.color.set(lit ? '#9ff9d7' : '#294f59'); material.emissive.set(lit ? '#50e9c7' : '#294f59'); material.emissiveIntensity = lit ? 2 : .1; });
          docked = travel === 1; draw(true);
          if (t < 1) animation = requestAnimationFrame(tick); else { resolveAnimation = undefined; resolve(true); }
        };
        animation = requestAnimationFrame(tick);
      });
    },
    dispose() {
      if (disposed) return; disposed = true; observer.disconnect(); cancelAnimationFrame(animation); cancelAnimationFrame(cameraAnimation); cancelAnimationFrame(arrivalAnimation);
      resolveAnimation?.(false); resolveAnimation = undefined; environment.dispose(); sunlight.shadow.dispose();
      cyan.dispose(); amber.dispose(); disposeObjects(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
  signal.addEventListener('abort', () => api.dispose(), { once: true }); if (signal.aborted) api.dispose(); return api;
}
