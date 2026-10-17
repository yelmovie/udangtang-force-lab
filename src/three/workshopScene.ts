import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getWorkshopDesign, type WorkshopTool, type LeverSetting } from '../workshopModel';

export interface WorkshopScene {
  configure: (tool: WorkshopTool | 'direct', setting: number) => void;
  setProgress: (progress: number) => void;
  /** Level 2 cargo weight (1 = level 1 cargo); heavier cargo is drawn a little bigger. */
  setCargoWeight: (weight: number) => void;
  turn: (direction: -1 | 1) => void;
  layout: () => { support: {x:number;y:number}; effort: {x:number;y:number}; effortRest: {x:number;y:number}; actorFloor: {x:number;y:number}; heightStart: {x:number;y:number}; heightGoal: {x:number;y:number} };
  leverSettingAt: (x:number) => LeverSetting;
  dispose: () => void;
}

// The user's travel drives the apparatus directly; trials never autoplay.
export function createWorkshopScene(host: HTMLElement): WorkshopScene {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '설계 손잡이와 연결된 입체 지레와 빗면');
  host.append(renderer.domElement);
  let disposed = false, progress = 0, angle = 16;
  let tool: WorkshopTool | 'direct' = 'lever', setting = 1;
  scene.add(new THREE.HemisphereLight('#fff1d0', '#765744', 2.5));
  const sunlight = new THREE.DirectionalLight('#ffedd0', 2.8);
  sunlight.position.set(-3, 7, 5); scene.add(sunlight);
  const material = (color: string, metalness = .03) => new THREE.MeshStandardMaterial({ color, metalness, roughness: .7 });
  const woodMap = new THREE.TextureLoader().load('/assets/textures/workshop-wood.webp', () => draw());
  woodMap.colorSpace = THREE.SRGBColorSpace; woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping; woodMap.repeat.set(.32, .32);
  const wood = new THREE.MeshStandardMaterial({ color: '#f4d3a4', map: woodMap, roughness: .72 }), edge = material('#83502d'), teal = material('#267a78');
  const brass = material('#d8ae65', .3), light = material('#fff0b5'), coral = material('#ba582e');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.9, 48), new THREE.MeshBasicMaterial({ color: '#38200f', transparent: true, opacity: .17, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.scale.y = .54; floor.position.y = -.025; scene.add(floor);
  function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function plank(length: number, width: number, parent: THREE.Object3D) {
    const outline = new THREE.Shape();
    outline.moveTo(-length / 2, -.07); outline.lineTo(length / 2, -.07);
    outline.lineTo(length / 2, .07); outline.lineTo(-length / 2, .07); outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: width, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .035 });
    geometry.translate(0, 0, -width / 2);
    const mesh = new THREE.Mesh(geometry, [wood, edge]); parent.add(mesh); return mesh;
  }
  function cargo(parent: THREE.Object3D) {
    const group = new THREE.Group(); parent.add(group);
    box(.58, .58, .58, teal, 0, 0, 0, group);
    for (const y of [-.21, .21]) box(.61, .07, .61, brass, 0, y, 0, group);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.2), light);
    crystal.position.z = .32; crystal.scale.z = .36; group.add(crystal);
    return group;
  }
  const lever = new THREE.Group(); lever.position.x=.55; scene.add(lever);
  const support = new THREE.Group(); lever.add(support);
  const supportMesh = new THREE.Mesh(new THREE.ConeGeometry(.49, 1.5, 4), teal);
  supportMesh.rotation.y = Math.PI / 4; supportMesh.position.y = .8; support.add(supportMesh);
  const supportBase = box(1.1, .13, .9, edge, 0, .075, 0, support);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .75, 12), brass);
  bearing.rotation.x = Math.PI / 2; bearing.position.y = 1.65; support.add(bearing);
  const leverBeam = new THREE.Group(); lever.add(leverBeam);
  const leverBoard = plank(4.6, .62, leverBeam);
  const effort = box(.38, .12, .68, coral, -2, .16, 0, leverBeam);
  const leverCargo = cargo(lever);
  const sling = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .33, 8), brass); lever.add(sling);
  const ramp = new THREE.Group(); scene.add(ramp);
  const rampBeam = new THREE.Group(); ramp.add(rampBeam);
  let rampBoard = plank(2.9, .94, rampBeam);
  const rampCargo = cargo(ramp);
  const topPost = box(.18, 1.7, .18, teal, 0, .85, -.56, ramp);
  const topFlag = box(.52, .32, .045, brass, 0, 1.91, -.56, ramp);
  const bottomPost = box(.12, .3, .12, edge, 0, .15, -.56, ramp);
  function draw() { if (!disposed) renderer.render(scene, camera); }
  /** Stretch a bottom-centred model into the box the procedural part used to fill. */
  function fit(model: THREE.Object3D, width: number, height: number | null, depth: number) {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()), scale = width / size.x;
    model.scale.set(scale, height ? height / size.y : scale, depth / size.z); return model;
  }
  // Meshy models replace the stand-in boxes once loaded; if loading fails the boxes stay.
  const loader = new GLTFLoader();
  loader.loadAsync('/assets/models/workshop/fulcrum.glb').then(({ scene: model }) => {
    if (disposed) return;
    supportMesh.visible = supportBase.visible = bearing.visible = false;
    support.add(fit(model, 1.15, 1.6, .95)); draw();
  }).catch(() => {});
  loader.loadAsync('/assets/models/workshop/crate.glb').then(({ scene: model }) => {
    if (disposed) return;
    for (const group of [leverCargo, rampCargo]) {
      group.children.forEach(child => { child.visible = false; });
      const crate = fit(model.clone(), .66, null, .66); crate.position.y = -.31; group.add(crate);
    }
    draw();
  }).catch(() => {});
  function setPose() {
    lever.visible = tool === 'lever'; ramp.visible = tool === 'ramp';
    if (tool === 'lever') {
      const design = getWorkshopDesign('lever', setting);
      support.position.x = design.pivot;
      leverBeam.position.set(design.pivot, 1.65, 0);
      leverBoard.position.x = -design.pivot; effort.position.x = -2 - design.pivot;
      const loadArm = 2 - design.pivot;
      const rotation = Math.asin(design.lift * progress / loadArm);
      leverBeam.rotation.z = rotation;
      const loadX = design.pivot + loadArm * Math.cos(rotation), loadY = 1.65 + design.lift * progress;
      leverCargo.position.set(loadX, loadY - .62, 0); sling.position.set(loadX, loadY - .165, 0);
    } else if (tool === 'ramp') {
      const design = getWorkshopDesign('ramp', setting);
      const run = Math.sqrt(design.length ** 2 - design.lift ** 2), slope = Math.asin(design.lift / design.length);
      rampBeam.position.set(0, .3 + design.lift / 2, 0); rampBeam.rotation.z = slope;
      rampCargo.position.set(-run / 2 + run * progress - .38 * Math.sin(slope), .3 + design.lift * progress + .38 * Math.cos(slope), 0);
      rampCargo.rotation.z = slope;
      topPost.position.x = topFlag.position.x = run / 2; bottomPost.position.x = -run / 2;
    }
    draw();
  }
  function positionCamera() {
    const radians = angle * Math.PI / 180;
    camera.position.set(Math.sin(radians) * 8, 4.8, Math.cos(radians) * 8); camera.lookAt(0, 1.55, 0);
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight), aspect = width / height;
    const halfHeight = Math.max(1.7, 3.1 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); positionCamera(); draw();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); setPose(); resize();
  function project(x:number,y:number,z=0) {
    camera.updateMatrixWorld();
    const point=new THREE.Vector3(x,y,z).project(camera);
    return {x:(point.x+1)*host.clientWidth/2,y:(1-point.y)*host.clientHeight/2};
  }
  return {
    configure(nextTool, nextSetting) {
      if (disposed) return;
      tool = nextTool; setting = nextSetting; progress = 0;
      if (tool === 'ramp') {
        rampBoard.geometry.dispose(); rampBeam.remove(rampBoard);
        rampBoard = plank(getWorkshopDesign('ramp', setting).length + .4, .94, rampBeam);
      }
      setPose();
    },
    setProgress(next) { if (!disposed) { progress = Math.max(0, Math.min(1, next)); setPose(); } },
    setCargoWeight(weight) {
      if (disposed) return;
      const size = Math.max(.85, Math.min(1.22, .55 + .45 * weight));
      leverCargo.scale.setScalar(size); rampCargo.scale.setScalar(size); draw();
    },
    turn(direction) { angle = Math.max(-20, Math.min(40, angle + direction * 12)); positionCamera(); draw(); },
    layout() {
      if(tool==='lever') {
        const design=getWorkshopDesign('lever',setting), rotation=Math.asin(design.lift*progress/(2-design.pivot));
        const offset=lever.position.x;
        return {support:project(design.pivot+offset,.7),effort:project(offset+design.pivot+(-2-design.pivot)*Math.cos(rotation),1.81+(-2-design.pivot)*Math.sin(rotation),.15),effortRest:project(offset-2,1.81,.15),actorFloor:project(offset-2.7,0,.15),heightStart:project(offset+2.6,.74),heightGoal:project(offset+2.6,.74+design.lift)};
      }
      const design=tool==='ramp'?getWorkshopDesign('ramp',setting):{length:0,lift:1.4};
      const x=tool==='ramp'?Math.sqrt(design.length**2-design.lift**2)/2+.42:1;
      return {support:project(0,.7),effort:project(0,.3),effortRest:project(0,.3),actorFloor:project(0,0),heightStart:project(x,.3),heightGoal:project(x,.3+design.lift)};
    },
    leverSettingAt(x) {
      return ([0,1,2] as LeverSetting[]).reduce((best,next)=>Math.abs(project(getWorkshopDesign('lever',next).pivot+lever.position.x,.7).x-x)<Math.abs(project(getWorkshopDesign('lever',best).pivot+lever.position.x,.7).x-x)?next:best,1 as LeverSetting);
    },
    dispose() {
      disposed = true; observer.disconnect(); const materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(item => materials.add(item)); } });
      materials.forEach(item => { (item as THREE.MeshStandardMaterial).map?.dispose(); item.dispose(); }); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
