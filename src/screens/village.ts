import type { AppContext } from '../appTypes';
import { icons } from '../icons';
import type { StageId } from '../data';
import { stageIsOpen } from '../state';
import { getVillageStory, villageRewards } from '../villageStory';
import '../village.css';
import { challenges } from '../challenges';
import { stageStars, totalStars, type StageStars } from '../stars';
import { newlySolved, requestBoard, requestThanks, solvedRequests, villageRequests, type RequestStage } from '../requestBoard';

type Point = { x: number; y: number };
type Direction = 'down' | 'left' | 'right' | 'up';
type Polygon = { id: string; points: [number, number][] };
type Building = { id: StageId; asset: string; x: number; y: number; width: number; height: number; entry: Point & { radius: number } };
type Npc = Point & { id: string; name: string; asset: string; portrait?: string };
export type VillageMap = { width: number; height: number; radius: number; spawn: Point; walkable: Polygon[]; blocked: Polygon[]; buildings: Building[]; npcs: Npc[] };
type AssetMeta = { file: string; width: number; height: number; pivot?: Point; alphaBounds?: { left: number; top: number; width: number; height: number } };
const directions: Direction[] = ['down', 'left', 'right', 'up'];
const stageIds: StageId[] = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const walkingSpeed = 220;
/** Star slots seen at the last village visit; only lives for this page load, so stars stay computed from the save. */
let seenStars: Record<StageId, boolean[]> | undefined;
/** Requests solved at the last village visit, so a client walks out only once per new solve. */
let seenRequests: RequestStage[] | undefined;

/** Track physical keys separately: releasing W must not cancel a held ArrowUp. */
export function createVillageInput() {
  const held = new Map<string, Direction>();
  const bindings: Record<string, Direction> = {
    ArrowUp: 'up', KeyW: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', KeyS: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', KeyA: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', KeyD: 'right', d: 'right', D: 'right',
  };
  return {
    press(key: string, code = '') {
      const direction = bindings[code] ?? bindings[key];
      if (!direction) return false;
      held.set(code || key, direction);
      return true;
    },
    release(key: string, code = '') { return held.delete(code || key); },
    clear() { held.clear(); },
    directions() { return new Set(held.values()); },
    vector(pads: Iterable<Direction> = []): Point {
      const active = new Set([...held.values(), ...pads]);
      const x = Number(active.has('right')) - Number(active.has('left'));
      const y = Number(active.has('down')) - Number(active.has('up'));
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    },
  };
}

function inside(point: Point, polygon: Polygon): boolean {
  let result = false;
  const points = polygon.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i];
    const cross = (point.x - ax) * (by - ay) - (point.y - ay) * (bx - ax);
    if (Math.abs(cross) < .00001 && point.x >= Math.min(ax,bx) && point.x <= Math.max(ax,bx) && point.y >= Math.min(ay,by) && point.y <= Math.max(ay,by)) return true;
    if ((ay > point.y) !== (by > point.y) && point.x < (bx - ax) * (point.y - ay) / (by - ay) + ax) result = !result;
  }
  return result;
}

type Edge = { a: Point; b: Point };
const geometryCache = new WeakMap<VillageMap, { boundary: Edge[]; blocked: Edge[] }>();
const geometryEpsilon = 1e-6;
function polygonEdges(polygons: Polygon[]): Edge[] {
  return polygons.flatMap(polygon => polygon.points.map(([x,y],i) => {
    const next=polygon.points[(i+1)%polygon.points.length];
    return { a:{x,y},b:{x:next[0],y:next[1]} };
  }));
}
function geometryFor(map: VillageMap) {
  const cached=geometryCache.get(map);if(cached)return cached;
  const allEdges=polygonEdges(map.walkable),boundary:Edge[]=[];
  const inUnion=(p:Point)=>map.walkable.some(polygon=>inside(p,polygon));
  // Split intersections once. Only edges separating ground from non-ground
  // remain; overlapping walkable polygons must not create invisible walls.
  for(const {a,b} of allEdges){
    const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
    if(lengthSquared<geometryEpsilon)continue;
    const cuts=[0,1];
    for(const {a:c,b:d} of allEdges){
      const ex=d.x-c.x,ey=d.y-c.y,ox=c.x-a.x,oy=c.y-a.y;
      const denominator=dx*ey-dy*ex;
      if(Math.abs(denominator)>geometryEpsilon){
        const t=(ox*ey-oy*ex)/denominator,u=(ox*dy-oy*dx)/denominator;
        if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
      }else if(Math.abs(ox*dy-oy*dx)<geometryEpsilon){
        for(const p of [c,d]){const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/lengthSquared;if(t>0&&t<1)cuts.push(t);}
      }
    }
    const sorted=[...new Set(cuts)].sort((x,y)=>x-y);
    const at=(t:number):Point=>({x:a.x+dx*t,y:a.y+dy*t});
    const nx=-dy/Math.sqrt(lengthSquared)*.001,ny=dx/Math.sqrt(lengthSquared)*.001;
    for(let i=1;i<sorted.length;i++){
      if(sorted[i]-sorted[i-1]<geometryEpsilon)continue;
      const midpoint=at((sorted[i]+sorted[i-1])/2);
      if(inUnion({x:midpoint.x+nx,y:midpoint.y+ny})!==inUnion({x:midpoint.x-nx,y:midpoint.y-ny}))boundary.push({a:at(sorted[i-1]),b:at(sorted[i])});
    }
  }
  const geometry={boundary,blocked:polygonEdges(map.blocked)};
  geometryCache.set(map,geometry);return geometry;
}
function distanceToEdge(point: Point, {a,b}: Edge): number {
  const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
  const t=lengthSquared?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSquared)):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
export function canStandInVillage(map: VillageMap, point: Point): boolean {
  const radius=map.radius;
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<radius||point.y<radius||point.x>map.width-radius||point.y>map.height-radius)return false;
  if(!map.walkable.some(poly=>inside(point,poly))||map.blocked.some(poly=>inside(point,poly)))return false;
  const geometry=geometryFor(map),minimum=radius-geometryEpsilon;
  return geometry.boundary.every(edge=>distanceToEdge(point,edge)>=minimum)&&geometry.blocked.every(edge=>distanceToEdge(point,edge)>=minimum);
}

/** Move the same foot circle used by pathfinding, sliding along nearby walls. */
export function moveVillagePoint(map: VillageMap, start: Point, delta: Point): Point {
  const position = { ...start }, length = Math.hypot(delta.x, delta.y);
  if (!Number.isFinite(length) || !length || !canStandInVillage(map, start)) return position;
  const count = Math.max(1, Math.ceil(length / (map.radius / 2)));
  const step = { x: delta.x / count, y: delta.y / count };
  const geometry = geometryFor(map);
  for (let i = 0; i < count; i++) {
    const next = { x: position.x + step.x, y: position.y + step.y };
    if (canStandInVillage(map, next)) { Object.assign(position, next); continue; }
    const candidates = [{ x: step.x, y: 0 }, { x: 0, y: step.y }];
    for (const edge of [...geometry.boundary, ...geometry.blocked]) {
      if (distanceToEdge(position, edge) > map.radius + Math.hypot(step.x, step.y) + .01) continue;
      const x = edge.b.x - edge.a.x, y = edge.b.y - edge.a.y;
      const squared = x * x + y * y;
      if (!squared) continue;
      const projection = (step.x * x + step.y * y) / squared;
      candidates.push({ x: x * projection, y: y * projection });
    }
    let best: Point | undefined, bestProgress = 1e-8;
    for (const candidate of candidates) {
      const progress = candidate.x * step.x + candidate.y * step.y;
      const target = { x: position.x + candidate.x, y: position.y + candidate.y };
      if (progress > bestProgress && canStandInVillage(map, target)) { best = target; bestProgress = progress; }
    }
    if (best) Object.assign(position, best);
  }
  return position;
}

/** Only crossing a doorway triggers entry; spawning/returning there never does. */
export function createVillageEntrances(map: VillageMap, spawn: Point) {
  const doorAt = (point: Point) => map.buildings.find(building => distance(point, building.entry) <= Math.min(16, building.entry.radius));
  let previous = doorAt(spawn)?.id;
  return (point: Point): Building | undefined => {
    const door = doorAt(point);
    const entered = door && door.id !== previous ? door : undefined;
    previous = door?.id;
    return entered;
  };
}

/** Foot-circle navigation. Diagonals cannot cut corners and all shortcuts are checked. */
export function createVillageNavigation(map: VillageMap) {
  const step = 12, columns = Math.ceil(map.width / step), rows = Math.ceil(map.height / step);
  const valid = new Uint8Array(columns * rows);
  const coordinate = (index: number): Point => ({ x:(index % columns) * step + step / 2, y:Math.floor(index / columns) * step + step / 2 });
  const stand = (p: Point) => canStandInVillage(map,p);
  for (let i = 0; i < valid.length; i++) valid[i] = Number(stand(coordinate(i)));
  function segment(a: Point, b: Point) {
    const count = Math.max(1, Math.ceil(distance(a,b) / 3));
    for (let i = 0; i <= count; i++) if (!stand({ x:a.x+(b.x-a.x)*i/count, y:a.y+(b.y-a.y)*i/count })) return false;
    return true;
  }
  function closest(point: Point, limit = 70, connected = false): number {
    let result = -1, best = limit;
    const cx = Math.floor(point.x / step), cy = Math.floor(point.y / step), radius = Math.ceil(limit / step);
    for (let y = Math.max(0,cy-radius); y <= Math.min(rows-1,cy+radius); y++) for (let x = Math.max(0,cx-radius); x <= Math.min(columns-1,cx+radius); x++) {
      const index = y * columns + x;
      if (!valid[index]) continue;
      const p = coordinate(index), d = distance(point,p);
      if (d <= best && (!connected || segment(point,p))) { best = d; result = index; }
    }
    return result;
  }
  function nearest(point: Point, limit = 70): Point | null { const index = closest(point,limit); return index < 0 ? null : coordinate(index); }
  function route(start: Point, target: Point): Point[] | null {
    const first = closest(start,48,true), last = closest(target,60);
    if (first < 0 || last < 0) return null;
    const scores = new Float64Array(valid.length).fill(Infinity), parent = new Int32Array(valid.length).fill(-1), closed = new Uint8Array(valid.length);
    const heap: { id: number; f: number }[] = [];
    function push(item: { id: number; f: number }) { heap.push(item); let i=heap.length-1; while(i>0){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item; }
    function pop() { const first = heap[0], tail = heap.pop()!; if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=tail.f)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return first; }
    const goal = coordinate(last); scores[first] = 0; push({id:first,f:distance(coordinate(first),goal)});
    while (heap.length) {
      const current = pop().id; if (closed[current]) continue;
      if (current === last) {
        const reversed: Point[] = []; let index = last;
        while(index !== first && index >= 0){reversed.push(coordinate(index));index=parent[index];}
        reversed.push(coordinate(first)); reversed.reverse();
        if (stand(target) && segment(goal,target)) reversed.push(target);
        const path: Point[] = []; let anchor = start, at = 0;
        while(at<reversed.length){let furthest=at;while(furthest+1<reversed.length && segment(anchor,reversed[furthest+1]))furthest++;path.push(reversed[furthest]);anchor=reversed[furthest];at=furthest+1;}
        return path;
      }
      closed[current] = 1; const cx = current % columns, cy = Math.floor(current / columns);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=columns||y>=rows)continue;
        const next=y*columns+x;if(!valid[next]||closed[next])continue;
        if(dx&&dy&&(!valid[cy*columns+x]||!valid[y*columns+cx]))continue;
        if(!segment(coordinate(current),coordinate(next)))continue;
        const score=scores[current]+step*Math.hypot(dx,dy);
        if(score<scores[next]){scores[next]=score;parent[next]=current;push({id:next,f:score+distance(coordinate(next),goal)});}
      }
    }
    return null;
  }
  return { stand, nearest, route, segment };
}

function validateMap(value: unknown): VillageMap {
  const map = value as VillageMap;
  const point = (p: Point) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const polygons = (p: Polygon[]) => Array.isArray(p) && p.every(poly=>Array.isArray(poly.points)&&poly.points.length>=3&&poly.points.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isFinite)));
  if(!map||!Number.isFinite(map.width)||!Number.isFinite(map.height)||map.width<100||map.height<100||map.width>5000||map.height>5000||!Number.isFinite(map.radius)||map.radius<1||!point(map.spawn)||!polygons(map.walkable)||!map.walkable.length||!polygons(map.blocked)||!Array.isArray(map.buildings)||!Array.isArray(map.npcs))throw new Error('map');
  if(map.buildings.some(b=>!stageIds.includes(b.id)||!point(b)||!point(b.entry)||!Number.isFinite(b.width)||!Number.isFinite(b.height)||!Number.isFinite(b.entry.radius)||typeof b.asset!=='string')||map.npcs.some(n=>!point(n)||typeof n.asset!=='string'||typeof n.name!=='string'))throw new Error('map');
  return map;
}

type VillageLight = Point & { r: number; kind: 'aura' | 'window' | 'lamp' };
/** Warm windows and street lamps (map pixels) each restored building switches on. 'plaza' joins at 5/5. */
export const villageLights: Record<StageId | 'plaza', VillageLight[]> = {
  cargo: [{x:345,y:250,r:140,kind:'aura'},{x:352,y:268,r:34,kind:'window'},{x:460,y:232,r:20,kind:'window'},{x:292,y:222,r:30,kind:'lamp'},{x:407,y:222,r:30,kind:'lamp'}],
  rescue: [{x:838,y:222,r:155,kind:'aura'},{x:832,y:290,r:38,kind:'window'},{x:728,y:250,r:24,kind:'window'},{x:940,y:250,r:24,kind:'window'},{x:830,y:175,r:60,kind:'window'},{x:783,y:250,r:28,kind:'lamp'},{x:880,y:250,r:28,kind:'lamp'}],
  balance: [{x:1440,y:240,r:140,kind:'aura'},{x:1440,y:270,r:34,kind:'window'},{x:1343,y:240,r:22,kind:'window'},{x:1537,y:240,r:22,kind:'window'},{x:1388,y:248,r:28,kind:'lamp'},{x:1487,y:248,r:28,kind:'lamp'},{x:1102,y:215,r:38,kind:'lamp'},{x:1265,y:215,r:38,kind:'lamp'},{x:1102,y:282,r:38,kind:'lamp'},{x:1265,y:282,r:38,kind:'lamp'}],
  scale: [{x:420,y:620,r:150,kind:'aura'},{x:500,y:650,r:30,kind:'window'},{x:300,y:600,r:40,kind:'window'},{x:410,y:640,r:26,kind:'window'},{x:475,y:622,r:26,kind:'lamp'},{x:530,y:622,r:26,kind:'lamp'},{x:465,y:812,r:40,kind:'lamp'}],
  workshop: [{x:1450,y:640,r:140,kind:'aura'},{x:1520,y:672,r:32,kind:'window'},{x:1440,y:650,r:28,kind:'window'},{x:1390,y:632,r:26,kind:'lamp'},{x:1485,y:632,r:26,kind:'lamp'},{x:1120,y:465,r:38,kind:'lamp'},{x:1268,y:465,r:38,kind:'lamp'},{x:1120,y:527,r:38,kind:'lamp'},{x:1268,y:527,r:38,kind:'lamp'}],
  plaza: [{x:754,y:790,r:44,kind:'lamp'},{x:919,y:790,r:44,kind:'lamp'}],
};

const glowStops: Record<VillageLight['kind'], [string, string][]> = {
  aura: [['0', 'rgba(255,236,145,.45)'], ['.6', 'rgba(255,226,125,.18)'], ['1', 'rgba(255,222,105,0)']],
  window: [['0', 'rgba(255,232,150,1)'], ['.45', 'rgba(255,204,100,.62)'], ['1', 'rgba(255,190,80,0)']],
  lamp: [['0', 'rgba(255,250,215,1)'], ['.25', 'rgba(255,232,140,.7)'], ['1', 'rgba(255,222,105,0)']],
};

/** Request board on the plaza beside the doctor: foot of its posts (map pixels). */
export const requestBoardSpot: Point = { x: 935, y: 640 };
/** A solved request's client stands here, clear of the door and the return spot, with a speech
 * bubble beside the head and a lit shop sign on the building, away from labels and the bottom bar. */
export const requesterSpots: Record<RequestStage, Point & { bubble: Point; sign: Point }> = {
  cargo: { x: 425, y: 375, bubble: { x: 500, y: 300 }, sign: { x: 240, y: 300 } },
  balance: { x: 1365, y: 380, bubble: { x: 1318, y: 300 }, sign: { x: 1545, y: 292 } },
  scale: { x: 600, y: 700, bubble: { x: 662, y: 625 }, sign: { x: 300, y: 680 } },
  workshop: { x: 1410, y: 770, bubble: { x: 1340, y: 718 }, sign: { x: 1560, y: 692 } },
};
/** NPC silhouettes use the same scale and standing height as the student. */
const mapCharacterHeight = 83;

/** Korean particle after a name: 주인과/친구와, 주인이/친구가. */
export function withParticle(name: string, batchim: string, plain: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  return `${name}${code >= 0 && code < 11172 && code % 28 ? batchim : plain}`;
}

/** Korean direction particle: 공방 → 공방으로, 다리 → 다리로 (ㄹ batchim also takes 로). */
export function withDirectionParticle(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const batchim = code >= 0 && code < 11172 ? code % 28 : 0;
  return `${name}${batchim && batchim !== 8 ? '으로' : '로'}`;
}

/** Walkable road paths from each building door to the central core door, for the light-flow reveal. */
export function villageLightRoutes(map: VillageMap, navigation: ReturnType<typeof createVillageNavigation>): Partial<Record<StageId, Point[]>> {
  const core = map.buildings.find(building => building.id === 'rescue');
  const routes: Partial<Record<StageId, Point[]>> = {};
  if (!core) return routes;
  const front = (building: Building): Point => {
    const wanted = { x: building.entry.x, y: building.entry.y + 30 };
    return navigation.stand(wanted) ? wanted : navigation.nearest(wanted, 60) ?? wanted;
  };
  for (const building of map.buildings) {
    if (building === core) continue;
    const route = navigation.route(front(building), front(core));
    routes[building.id] = [front(building), ...(route ?? [front(core)])];
  }
  return routes;
}

export function mountVillage(root: HTMLElement, context: AppContext, options: { adminUnlocked: boolean; returnedFrom?: StageId; newlyCompleted?: StageId }): () => void {
  const story = getVillageStory(context.save.completed);
  const events = new AbortController();
  const base = `${import.meta.env.BASE_URL}assets/village/`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML = `<section class="village-screen"><div class="village-frame"><canvas class="village-canvas" tabindex="0" aria-label="힘 마을. 방향키나 WASD로 걷고, 땅이나 건물 이름을 누르면 길을 따라 이동해요. 열린 문에 닿으면 자동 입장해요. Enter로 안내원과 대화하거나 가까운 문에 들어갈 수도 있어요."></canvas><svg class="village-lights" aria-hidden="true" focusable="false"></svg><div class="village-labels"></div></div><header class="village-hud"><div class="village-objective"><span>우리의 힘 마을</span><strong id="village-goal"></strong></div><div class="village-tally"><span class="village-stars" id="village-stars" role="img"></span><span class="village-count" id="village-count"></span></div></header><div class="village-reveal" role="status" hidden></div><div class="village-bottom"><div class="village-pad" role="group" aria-label="이동 방향판"><button data-direction="up" aria-label="위로 걷기">↑</button><button data-direction="left" aria-label="왼쪽으로 걷기">←</button><button data-direction="down" aria-label="아래로 걷기">↓</button><button data-direction="right" aria-label="오른쪽으로 걷기">→</button></div><p class="village-hint" id="village-hint" role="status">길을 누르거나 방향판으로 걸어가 봐!</p><div class="village-actions"><button id="village-results" hidden>내 발견 모아 보기</button><button id="village-action" disabled>건물 이름을 눌러요</button></div></div><div class="village-loading"><strong>마을로 가는 길을 준비해요…</strong><progress max="100" value="0" aria-label="마을 그림 준비"></progress><span id="village-loading-detail">마을 지도를 읽는 중이에요</span><button id="village-retry" hidden>다시 불러오기</button></div><dialog class="village-dialog" aria-labelledby="village-dialog-title"><img class="village-portrait" alt=""><div class="village-dialog-heading"><div><span id="village-dialog-role">마을의 안내원</span><h2 id="village-dialog-title"></h2></div><button id="village-dialog-close" aria-label="대화 닫기">×</button></div><p id="village-dialog-line"></p><div class="village-dialog-bottom"><span id="village-dialog-page"></span><button id="village-dialog-next">이야기 더 듣기 →</button></div></dialog><dialog class="village-board" aria-labelledby="village-board-title"><div class="village-board-heading"><h2 id="village-board-title">의뢰 게시판</h2><button id="village-board-close" aria-label="게시판 닫기">×</button></div><p class="village-board-lead"></p><ul class="village-board-cards"></ul></dialog></section>`;
  const shell = root.querySelector<HTMLElement>('.village-screen')!, frame = root.querySelector<HTMLElement>('.village-frame')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.village-canvas')!;
  const ctx = canvas.getContext('2d')!;
  // Fog is smooth, so it renders at quarter resolution: a cached static layer plus the walker's own light.
  const fogScale = .25, fogCanvas = document.createElement('canvas'), fogBase = document.createElement('canvas');
  const fogCtx = fogCanvas.getContext('2d')!, fogBaseCtx = fogBase.getContext('2d')!;
  let fogKey = '';
  const labels = root.querySelector<HTMLElement>('.village-labels')!;
  const lights = root.querySelector<SVGSVGElement>('.village-lights')!;
  const loading = root.querySelector<HTMLElement>('.village-loading')!;
  const retry = root.querySelector<HTMLButtonElement>('#village-retry')!;
  const action = root.querySelector<HTMLButtonElement>('#village-action')!;
  const hint = root.querySelector<HTMLElement>('#village-hint')!;
  const reveal = root.querySelector<HTMLElement>('.village-reveal')!;
  const dialog = root.querySelector<HTMLDialogElement>('.village-dialog')!;
  const portrait = root.querySelector<HTMLImageElement>('.village-portrait')!;
  const nextLine = root.querySelector<HTMLButtonElement>('#village-dialog-next')!;
  const board = root.querySelector<HTMLDialogElement>('.village-board')!;
  root.querySelector('#village-goal')!.textContent = story.next ? `다음 발견 · ${villageRewards[story.next].name}` : `마을 복구 완료 · 도전 과제 ${challenges(context.save).filter(item => item.done).length}/5`;
  root.querySelector('#village-count')!.textContent = `${story.count} / 5 복구`;
  const stars = Object.fromEntries(stageIds.map(id => [id, stageStars(context.save, id)])) as Record<StageId, StageStars>;
  // A star earned since the last visit pops once on its building label.
  const freshStars = Object.fromEntries(stageIds.map(id => [id, stars[id].slots.map((slot, i) => !!seenStars && slot.done && !seenStars[id][i])])) as Record<StageId, boolean[]>;
  seenStars = Object.fromEntries(stageIds.map(id => [id, stars[id].slots.map(slot => slot.done)])) as Record<StageId, boolean[]>;
  const starTotal = totalStars(context.save), starBadge = root.querySelector<HTMLElement>('#village-stars')!;
  starBadge.textContent = `★ ${starTotal.earned} / ${starTotal.max}`;
  starBadge.setAttribute('aria-label', `모은 별 ${starTotal.max}개 중 ${starTotal.earned}개`);
  // Level 2 requests: the board shows all four; a solved one brings its client back to the building.
  const cards = requestBoard(context.save), solved = solvedRequests(context.save);
  const arriving = reduced.matches ? [] : newlySolved(seenRequests, solved);
  seenRequests = solved;
  // Clients walk out after the light reveal and the star pop, never on top of them.
  const freshStar = Object.values(freshStars).some(row => row.some(Boolean));
  const results = root.querySelector<HTMLButtonElement>('#village-results')!; results.hidden = !story.complete; results.classList.toggle('is-next', story.complete);
  let alive = true, generation = 0, raf = 0, last = 0, walkingTime = 0, dogTime = 0, revealTime = 0, lastDraw = 0;
  let wasMoving = false, wasDogMoving = false;
  let fetches = new AbortController();
  let map: VillageMap | null = null, navigation: ReturnType<typeof createVillageNavigation> | null = null;
  let actor = { x:0,y:0,direction:'down' as Direction }, dog = { x:0,y:0,direction:'down' as Direction };
  let path: Point[] = [], trail: Point[] = [], destination: Point | null = null;
  let nearestBuilding: Building | undefined, nearestNpc: Npc | undefined, line = 0;
  let nearestClient: RequestStage | undefined, nearBoard = false;
  type Talk = { name: string; role: string; lines: string[]; portrait: (line: number) => string; tint: string; done: string };
  let talk: Talk | null = null;
  let revealStage = options.newlyCompleted && story.changes.includes(options.newlyCompleted) ? options.newlyCompleted : undefined;
  // Reveal timeline (seconds): windows light up, then light runs along the road to the core.
  const flowStart = .7, flowTime = 1.3, revealEnd = flowStart + flowTime + .5;
  const arrivalStart = revealStage ? revealEnd + .3 : freshStar ? 1.3 : .5, arrivalTime = .9;
  let arrivalShown = !arriving.length;
  const tinted = new Map<RequestStage, HTMLCanvasElement>();
  let images = new Map<string,HTMLImageElement>(), metadata = new Map<string,AssetMeta>();
  const cancelImages = new Set<() => void>();
  const input = createVillageInput(), pads = new Map<number,Direction>();
  const padButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-direction]')];
  const pad = root.querySelector<HTMLElement>('.village-pad')!;
  let entrance: ReturnType<typeof createVillageEntrances> | null = null, entering = false;
  const vectors: Record<Direction,Point> = { up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0} };
  function paused() { return document.hidden || dialog.open || board.open || !!root.closest('[inert]') || !!document.querySelector('.modal-layer'); }
  function syncPadFeedback() {
    const active = new Set([...input.directions(), ...pads.values()]);
    for (const button of padButtons) button.classList.toggle('is-held', active.has(button.dataset.direction as Direction));
  }
  function clearInput() { input.clear(); pads.clear(); syncPadFeedback(); }
  function assetURL(file: string) { if(!/^[a-z0-9_./-]+\.webp$/i.test(file)||file.startsWith('/')||file.split('/').includes('..'))throw new Error('asset');return base+file; }
  function loadImage(file: string): Promise<HTMLImageElement> {
    return new Promise((resolve,reject)=>{
      const image = new Image(); image.decoding = 'async';
      let done = false;
      const finish = (error?: Error) => { if(done)return;done=true;window.clearTimeout(timer);cancelImages.delete(cancel);image.onload=image.onerror=null;if(error){image.removeAttribute('src');reject(error);}else resolve(image); };
      const cancel = () => finish(new Error('cancelled'));
      const timer = window.setTimeout(()=>finish(new Error(file)),25000);
      cancelImages.add(cancel); image.onload=()=>finish();image.onerror=()=>finish(new Error(file));
      try { image.src=assetURL(file); } catch { finish(new Error(file)); }
    });
  }
  function pivot(file: string, image: HTMLImageElement) { return metadata.get(file)?.pivot ?? { x:image.naturalWidth/2,y:image.naturalHeight }; }
  function visibleHeight(file: string) { return metadata.get(file)?.alphaBounds?.height || images.get(file)?.naturalHeight || 1; }
  function npcHeight() {
    const studentFamilyHeight = Math.max(...directions.flatMap(direction => [1, 2, 3, 4].map(i => visibleHeight(`student/${direction}-${i}.webp`))));
    return mapCharacterHeight * visibleHeight('student/down-1.webp') / studentFamilyHeight;
  }
  function sprite(file: string, p: Point, height: number, familyHeight?: number) {
    const image = images.get(file); if(!image)return;
    const scale = height/(familyHeight||visibleHeight(file)), anchor=pivot(file,image);
    ctx.drawImage(image,Math.round(p.x-anchor.x*scale),Math.round(p.y-anchor.y*scale),Math.round(image.naturalWidth*scale),Math.round(image.naturalHeight*scale));
  }
  function rewardPoint(id: StageId): Point { return id==='rescue'?{x:838,y:243}:id==='balance'?{x:1183,y:282}:id==='cargo'?{x:455,y:374}:id==='scale'?{x:574,y:735}:{x:1344,y:732}; }
  // Light glows live in the SVG overlay (setupLights); the canvas keeps only the reward props.
  function drawRewards(id: StageId, alpha: number) {
    ctx.save();ctx.globalAlpha=alpha;
    if(id==='cargo'){sprite('props/prop-01.webp',{x:455,y:374},70);sprite('props/prop-01.webp',{x:504,y:389},55);ctx.fillStyle='#f8db74';ctx.fillRect(382,389,65,6);}
    if(id==='scale'){sprite('props/prop-05.webp',{x:576,y:735},60);sprite('props/prop-04.webp',{x:613,y:755},39);}
    if(id==='workshop'){sprite('props/prop-11.webp',{x:1344,y:732},50);sprite('props/prop-09.webp',{x:1540,y:738},40);sprite('props/prop-10.webp',{x:1540,y:703},16);}
    if(id==='rescue'){sprite('props/prop-12.webp',{x:838,y:243},55);}
    ctx.restore();
  }
  function clientFilter(stage: RequestStage) { const { hue } = villageRequests[stage]; return hue ? `hue-rotate(${hue}deg) saturate(1.2)` : 'none'; }
  /** The doctor's pose recoloured once per client (canvas filter; browsers without it keep the pose). */
  function tintedClient(stage: RequestStage) {
    const cached = tinted.get(stage); if (cached) return cached;
    const image = images.get(`npc/${villageRequests[stage].pose}.webp`); if (!image) return undefined;
    const sheet = document.createElement('canvas'); sheet.width = image.naturalWidth; sheet.height = image.naturalHeight;
    const paint = sheet.getContext('2d')!; paint.filter = clientFilter(stage); paint.drawImage(image, 0, 0);
    tinted.set(stage, sheet); return sheet;
  }
  /** Where a solved client is now: walking out of the door during the arrival, else at their spot. */
  function clientAt(stage: RequestStage): (Point & { alpha: number }) | null {
    const spot = requesterSpots[stage];
    if (arrivalShown || !arriving.includes(stage)) return { ...spot, alpha: 1 };
    const t = (revealTime - arrivalStart) / arrivalTime; if (t < 0) return null;
    const door = map?.buildings.find(b => b.id === stage)?.entry ?? spot, ease = 1 - (1 - Math.min(1, t)) ** 2;
    return { x: door.x + (spot.x - door.x) * ease, y: door.y + (spot.y - door.y) * ease, alpha: Math.min(1, t * 3) };
  }
  function visibleClients() { return solved.filter(stage => arrivalShown || !arriving.includes(stage)); }
  function drawClient(stage: RequestStage, p: Point & { alpha: number }) {
    const file = `npc/${villageRequests[stage].pose}.webp`, image = images.get(file), sheet = tintedClient(stage); if (!image || !sheet) return;
    const scale = npcHeight() / visibleHeight(file), anchor = pivot(file, image);
    ctx.save(); ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#1d362c55'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sheet, Math.round(p.x - anchor.x * scale), Math.round(p.y - anchor.y * scale), Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    ctx.restore();
  }
  /** Wooden notice board; each paper note shows its request: grey locked, cream open, green solved. */
  function drawBoard() {
    const { x, y } = requestBoardSpot;
    ctx.fillStyle = '#1d362c55'; ctx.beginPath(); ctx.ellipse(x, y, 42, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b3b22'; ctx.fillRect(x - 32, y - 76, 8, 76); ctx.fillRect(x + 24, y - 76, 8, 76);
    ctx.fillStyle = '#6f4a2b'; ctx.fillRect(x - 43, y - 88, 86, 60);
    ctx.fillStyle = '#b98252'; ctx.fillRect(x - 39, y - 84, 78, 52);
    ctx.fillStyle = '#2f5f48'; ctx.fillRect(x - 48, y - 95, 96, 9);
    cards.forEach((card, i) => {
      const nx = x - 35 + i * 18, ny = y - 78 + (i % 2) * 5;
      ctx.fillStyle = card.status === 'solved' ? '#cfeebb' : card.status === 'open' ? '#fff6d8' : '#cbc5b3'; ctx.fillRect(nx, ny, 15, 20);
      ctx.fillStyle = ['#d9534f', '#3f7fd0', '#e0a21b', '#8c5bc0'][i]; ctx.fillRect(nx + 6, ny - 2, 3, 3);
      if (card.status === 'solved') { ctx.strokeStyle = '#2f7a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx + 3, ny + 10); ctx.lineTo(nx + 6, ny + 14); ctx.lineTo(nx + 12, ny + 5); ctx.stroke(); }
      else { ctx.fillStyle = '#8b7a5c'; ctx.fillRect(nx + 3, ny + 7, 9, 2); ctx.fillRect(nx + 3, ny + 12, 7, 2); }
    });
  }
  /** 0→1 while the newly restored building's light travels to the core; 1 when nothing plays. */
  function revealProgress() { return revealStage && !reduced.matches ? Math.min(1, revealTime / revealEnd) : 1; }
  function clearAround(target: CanvasRenderingContext2D, point: Point, radius: number) {
    const light = target.createRadialGradient(point.x,point.y,Math.min(20,radius*.3),point.x,point.y,radius);
    light.addColorStop(0,'rgba(0,0,0,1)'); light.addColorStop(.55,'rgba(0,0,0,.85)'); light.addColorStop(1,'rgba(0,0,0,0)');
    target.fillStyle=light;target.fillRect(point.x-radius,point.y-radius,radius*2,radius*2);
  }
  function drawVillageLight() {
    if (!map) return;
    // Each restored building lifts the dusk a step; the newest step fades in with its reveal.
    const progress = revealProgress(), level = story.count - (revealStage ? 1 - progress : 0);
    const darkness = .46 * (1 - level / 5);
    if (darkness < .005) return;
    const width = Math.ceil(map.width * fogScale), height = Math.ceil(map.height * fogScale);
    if (fogBase.width !== width || fogBase.height !== height) { fogBase.width = fogCanvas.width = width; fogBase.height = fogCanvas.height = height; fogKey = ''; }
    const key = `${darkness.toFixed(3)}|${progress.toFixed(2)}`;
    if (key !== fogKey) {
      fogKey = key;
      fogBaseCtx.setTransform(fogScale,0,0,fogScale,0,0);
      fogBaseCtx.globalCompositeOperation = 'source-over';
      fogBaseCtx.clearRect(0,0,map.width,map.height);
      fogBaseCtx.fillStyle = `rgba(9,31,42,${darkness})`;
      fogBaseCtx.fillRect(0,0,map.width,map.height);
      fogBaseCtx.globalCompositeOperation = 'destination-out';
      clearAround(fogBaseCtx, { x: requestBoardSpot.x, y: requestBoardSpot.y - 45 }, 110);
      for (const id of story.changes) {
        const grow = id === revealStage ? progress : 1;
        clearAround(fogBaseCtx, rewardPoint(id), Math.max(25, 260 * grow));
        for (const light of villageLights[id]) clearAround(fogBaseCtx, light, Math.max(12, light.r * 2.2 * grow));
      }
      fogBaseCtx.globalCompositeOperation = 'source-over';
    }
    fogCtx.setTransform(1,0,0,1,0,0);fogCtx.clearRect(0,0,width,height);fogCtx.drawImage(fogBase,0,0);
    fogCtx.setTransform(fogScale,0,0,fogScale,0,0);fogCtx.globalCompositeOperation='destination-out';clearAround(fogCtx,actor,125);fogCtx.globalCompositeOperation='source-over';
    ctx.imageSmoothingEnabled=true;ctx.drawImage(fogCanvas,0,0,map.width,map.height);ctx.imageSmoothingEnabled=false;
  }
  function draw(moving = false, dogMoving = false) {
    if(!alive||!map||!images.has('terrain.webp'))return;
    follow();
    ctx.setTransform(canvas.width/map.width,0,0,canvas.height/map.height,0,0);ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,map.width,map.height);ctx.drawImage(images.get('terrain.webp')!,0,0,map.width,map.height);
    if(destination){ctx.strokeStyle='#fff5b1';ctx.lineWidth=4;ctx.setLineDash([5,5]);ctx.beginPath();ctx.ellipse(destination.x,destination.y,15,8,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    for(const building of map.buildings){if(story.next===building.id){ctx.fillStyle='#ffe68799';ctx.beginPath();ctx.ellipse(building.entry.x,building.entry.y+8,26,11,0,0,Math.PI*2);ctx.fill();}}
    const layers:{y:number;draw:()=>void}[]=map.buildings.map(building=>({y:building.y+(metadata.get(building.asset)?.pivot?.y??images.get(building.asset)!.naturalHeight)/images.get(building.asset)!.naturalHeight*building.height,draw:()=>ctx.drawImage(images.get(building.asset)!,building.x,building.y,building.width,building.height)}));
    for(const id of story.changes){const p=rewardPoint(id),building=map.buildings.find(b=>b.id===id);const depth=id==='balance'?p.y:Math.max(p.y,(building?.y??0)+(building?.height??0)+1);layers.push({y:depth,draw:()=>drawRewards(id,id===revealStage&&!reduced.matches?Math.min(1,revealTime/1.1):1)});}
    for(const npc of map.npcs)layers.push({y:npc.y,draw:()=>{ctx.save();ctx.translate(npc.x*2,0);ctx.scale(-1,1);sprite(npc.asset,npc,npcHeight());ctx.restore();}});
    layers.push({y:requestBoardSpot.y,draw:drawBoard});
    for(const stage of solved){const at=clientAt(stage);if(at)layers.push({y:at.y,draw:()=>drawClient(stage,at)});}
    const studentHeight=Math.max(...directions.flatMap(direction=>[1,2,3,4].map(i=>visibleHeight(`student/${direction}-${i}.webp`))));
    const corgiHeight=Math.max(...directions.flatMap(direction=>[1,2,3,4].map(i=>visibleHeight(`corgi/${direction}-${i}.webp`))));
    const studentFrame=moving&&!reduced.matches?Math.floor(walkingTime*8)%4+1:1, dogFrame=dogMoving&&!reduced.matches?Math.floor(dogTime*8)%4+1:1;
    layers.push({y:dog.y,draw:()=>sprite(`corgi/${dog.direction}-${dogFrame}.webp`,dog,43,corgiHeight)});
    layers.push({y:actor.y,draw:()=>{ctx.fillStyle='#1d362c55';ctx.beginPath();ctx.ellipse(actor.x,actor.y,17,7,0,0,Math.PI*2);ctx.fill();sprite(`student/${actor.direction}-${studentFrame}.webp`,actor,mapCharacterHeight,studentHeight);}});
    layers.sort((a,b)=>a.y-b.y).forEach(layer=>layer.draw());
    drawVillageLight();
    if(revealStage && revealTime<2.4 && !reduced.matches){const p=rewardPoint(revealStage);ctx.save();ctx.globalAlpha=Math.max(0,1-revealTime/2.4);ctx.strokeStyle='#fff4b4';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,p.y-22,20+revealTime*48,12+revealTime*23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  // The map fills the screen (cover, up to 2x the fit size) and the camera follows the student over the overflow.
  let frameWidth=1,frameHeight=1;
  function follow() {
    const sw=shell.clientWidth,sh=shell.clientHeight,mw=map?.width??16,mh=map?.height??9;
    const axis=(view:number,size:number,at:number)=>size<=view?(view-size)/2:Math.min(0,Math.max(view-size,view/2-at));
    frame.style.transform=`translate(${axis(sw,frameWidth,actor.x/mw*frameWidth)}px,${axis(sh,frameHeight,actor.y/mh*frameHeight)}px)`;
  }
  function resize() {
    const mw=map?.width??16,mh=map?.height??9,sw=Math.max(1,shell.clientWidth),sh=Math.max(1,shell.clientHeight);
    const fit=Math.min(sw/mw,sh/mh),scale=Math.min(Math.max(sw/mw,sh/mh),fit*2);
    frameWidth=mw*scale;frameHeight=mh*scale;
    frame.style.width=`${frameWidth}px`;frame.style.height=`${frameHeight}px`;
    const density=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(frameWidth*density);canvas.height=Math.round(frameHeight*density);draw();
  }
  const observer=new ResizeObserver(resize);observer.observe(shell);resize();
  function updateNearby() {
    if(!map)return;
    nearestBuilding=map.buildings.filter(building=>distance(actor,building.entry)<=building.entry.radius+11).sort((a,b)=>distance(actor,a.entry)-distance(actor,b.entry))[0];
    nearestNpc=map.npcs.filter(npc=>distance(actor,npc)<=120).sort((a,b)=>distance(actor,a)-distance(actor,b))[0];
    nearestClient=nearestNpc?undefined:visibleClients().filter(stage=>distance(actor,requesterSpots[stage])<=48).sort((a,b)=>distance(actor,requesterSpots[a])-distance(actor,requesterSpots[b]))[0];
    nearBoard=!nearestNpc&&!nearestClient&&distance(actor,requestBoardSpot)<=80;
    const spot=!!nearestNpc||!!nearestClient||nearBoard;
    // Away from the next lab's door, the main button walks there instead of back into a finished one.
    const guide=!spot&&!!story.next&&nearestBuilding?.id!==story.next;
    action.disabled=!nearestBuilding&&!spot&&!guide;
    const next=nearestNpc?`${nearestNpc.name}와 이야기` : nearestClient?`${withParticle(villageRequests[nearestClient].client,'과','와')} 이야기` : nearBoard?'의뢰 게시판 보기' : guide?`다음: ${withDirectionParticle(villageRewards[story.next!].name)} 가기` : nearestBuilding?`${villageRewards[nearestBuilding.id].name} ${options.adminUnlocked||stageIsOpen(context.save,nearestBuilding.id)?'들어가기':'살펴보기'}`:'건물 이름을 눌러요';
    if(action.textContent!==next)action.textContent=next;
    // Walking past the doctor shows his greeting as a bubble; the button still opens the full talk.
    const bubble=labels.querySelector<HTMLElement>('.village-npc-bubble');
    if(bubble){const show=!!nearestNpc&&!dialog.open;if(show&&bubble.hidden){bubble.textContent=story.lines[0];}bubble.hidden=!show;}
  }
  function restHint() {
    if(nearestNpc)return `${nearestNpc.name} 곁이야. 오른쪽 아래 버튼을 누르면 이야기를 들을 수 있어!`;
    if(nearestClient)return `${villageRequests[nearestClient].client} 곁이야. 오른쪽 아래 버튼을 누르면 인사를 들을 수 있어!`;
    if(nearBoard)return '의뢰 게시판이야. 오른쪽 아래 버튼을 누르면 마을 사람들의 의뢰를 볼 수 있어!';
    if(!story.next)return '마을에 불이 모두 켜졌어! 「내 발견 모아 보기」를 눌러 봐.';
    return `다음 목적지는 ${villageRewards[story.next].name}! 불이 켜진 이름표를 누르면 걸어가요.`;
  }
  function goTo(target: Point, name?: string) {
    if(!navigation||paused())return;
    const building = map?.buildings.find(building => distance(target, building.entry) < 1);
    if (building && explainLockedBuilding(building)) return;
    const next=navigation.route(actor,target);
    if(!next){hint.textContent='그곳까지 갈 길이 없어. 흙길이나 다리를 눌러 봐!';destination=null;path=[];draw();return;}
    clearInput();path=next;destination=next.at(-1)??null;hint.textContent=name?`${name} 앞까지 길을 따라 걸어갈게.`:'길을 따라 가는 중… 방향판을 누르면 직접 걸을 수 있어.';canvas.focus();draw();
  }
  /** Small star row under a building name: earned, empty, or switched off by the teacher. */
  function starRow(id: StageId) {
    const row=document.createElement('span');row.className='village-label-stars';row.setAttribute('aria-hidden','true');
    stars[id].slots.forEach((slot,i)=>{const star=document.createElement('span');star.className='village-star';star.classList.toggle('is-done',slot.done);star.classList.toggle('is-off',!slot.done&&!!slot.off);star.classList.toggle('is-new',freshStars[id][i]);star.textContent=slot.done?'★':'☆';row.append(star);});
    return row;
  }
  function starText(id: StageId) {
    const off=stars[id].slots.some(slot=>slot.off&&!slot.done);
    return `별 ${stars[id].earned}개${off?', 2단계 의뢰는 쉬는 중':''}`;
  }
  function setupLabels() {
    labels.replaceChildren();
    for(const building of map!.buildings){const button=document.createElement('button');button.className='village-building-label';button.dataset.stage=building.id;button.style.left=`${(building.x+building.width/2)/map!.width*100}%`;button.style.top=`${(building.y+building.height*0.42)/map!.height*100}%`;const name=document.createElement('span');name.textContent=`${story.changes.includes(building.id)?'✓ ':''}${villageRewards[building.id].name}`;button.append(name,starRow(building.id));button.classList.toggle('is-current',story.next===building.id);button.classList.toggle('is-complete',story.changes.includes(building.id));button.classList.toggle('is-locked',!options.adminUnlocked&&!stageIsOpen(context.save,building.id));button.setAttribute('aria-label',`${villageRewards[building.id].name} 문 앞으로 걷기, ${starText(building.id)}`);button.addEventListener('click',()=>goTo(building.entry,villageRewards[building.id].name),{signal:events.signal});labels.append(button);}
    for(const npc of map!.npcs){const button=document.createElement('button');button.className='village-npc-label';button.style.left=`${npc.x/map!.width*100}%`;button.style.top=`${(npc.y-100)/map!.height*100}%`;button.textContent='도토리 박사';button.setAttribute('aria-label',`${npc.name}에게 걸어가기`);button.addEventListener('click',()=>goTo({x:npc.x-72,y:npc.y+6},npc.name),{signal:events.signal});labels.append(button);const bubble=document.createElement('button');bubble.className='village-npc-bubble';bubble.hidden=true;bubble.style.left=`${(npc.x-30)/map!.width*100}%`;bubble.style.top=`${(npc.y-112)/map!.height*100}%`;bubble.setAttribute('aria-label',`${npc.name}의 이야기 더 듣기`);bubble.addEventListener('click',()=>interact(),{signal:events.signal});labels.append(bubble);}
    const open=cards.filter(card=>card.status==='open').length;
    const boardLabel=document.createElement('button');boardLabel.className='village-board-label';boardLabel.style.left=`${requestBoardSpot.x/map!.width*100}%`;boardLabel.style.top=`${(requestBoardSpot.y+6)/map!.height*100}%`;
    boardLabel.textContent='의뢰 게시판';if(open){const count=document.createElement('span');count.className='village-board-count';count.textContent=String(open);boardLabel.append(count);}
    boardLabel.setAttribute('aria-label',`의뢰 게시판 열기${open?`, 도와줄 수 있는 의뢰 ${open}개`:''}`);boardLabel.addEventListener('click',openBoard,{signal:events.signal});labels.append(boardLabel);
    for(const stage of solved){const {bubble}=requesterSpots[stage],button=document.createElement('button');button.className='village-client-bubble';button.dataset.client=stage;button.style.left=`${bubble.x/map!.width*100}%`;button.style.top=`${bubble.y/map!.height*100}%`;button.innerHTML=icons.speech;button.setAttribute('aria-label',`${villageRequests[stage].client}의 인사 듣기`);button.classList.toggle('is-waiting',!arrivalShown&&arriving.includes(stage));button.addEventListener('click',()=>openClient(stage),{signal:events.signal});labels.append(button);}
  }
  function openBoard() {
    if(!map||paused())return;
    clearInput();path=[];destination=null;
    board.querySelector('.village-board-lead')!.textContent=cards[0].optional?'오늘 의뢰는 선택이에요. 하고 싶은 의뢰가 있으면 도와줘요.':'마을 사람들의 부탁이에요. 실험 1단계를 마치면 그 건물에서 의뢰를 받을 수 있어요.';
    const list=board.querySelector('.village-board-cards')!;list.replaceChildren();
    for(const card of cards){
      const item=document.createElement('li');item.className=`village-board-card is-${card.status}`;
      const face=document.createElement('img');face.className='village-board-portrait';face.alt='';face.src=assetURL(`npc/${card.pose}.webp`);
      const text=document.createElement('div');text.className='village-board-text';
      const locked=card.status==='locked';
      // Inline filters would override the CSS silhouette, so only tint an unlocked fallback pose.
      if(!locked&&villageRequests[card.stage].hue)face.style.filter=clientFilter(card.stage);
      // A locked request keeps its client a secret: a dark silhouette with a question mark until level 1 is done.
      if(locked){face.classList.add('is-mystery');const mark=document.createElement('span');mark.className='village-board-mark';mark.textContent='?';mark.setAttribute('aria-hidden','true');item.append(mark);}
      const from=document.createElement('strong');from.textContent=locked?`??? · ${villageRewards[card.stage].name}`:`${card.client} · ${villageRewards[card.stage].name}`;
      const quote=document.createElement('p');quote.textContent=locked?'누가 부탁할지는 아직 비밀이에요.':`“${card.quote}”`;
      const status=document.createElement('span');status.className='village-board-status';status.textContent=card.statusText;
      if(card.optional){const tag=document.createElement('span');tag.className='village-board-tag';tag.textContent='선택 의뢰';status.prepend(tag);}
      text.append(from,quote,status);
      const go=document.createElement('button');go.textContent=`${withDirectionParticle(villageRewards[card.stage].name)} 가기`;
      go.addEventListener('click',()=>{const building=map?.buildings.find(b=>b.id===card.stage);board.close();last=performance.now();if(building)goTo(building.entry,villageRewards[card.stage].name);});
      item.append(face,text,go);list.append(item);
    }
    board.showModal();board.querySelector<HTMLButtonElement>('.village-board-card button')?.focus();draw();
  }
  function closeBoard() { if(!board.open)return;board.close();clearInput();canvas.focus();last=performance.now();draw(); }
  function openClient(stage: RequestStage) {
    const request=villageRequests[stage];
    openTalk({name:request.client,role:`${villageRewards[stage].name} 의뢰인`,lines:[requestThanks(context.save,stage)],portrait:()=>`npc/${request.pose}.webp`,tint:clientFilter(stage),done:'또 도울게요!'});
  }
  /** Lit windows and lamps of restored buildings, drawn once in map pixels over the canvas. A fresh
   * completion plays its reveal with CSS opacity/transform only; reduced motion shows the end state. */
  function setupLights() {
    const add = (parent: Element, tag: string, attributes: Record<string, string | number> = {}) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
      parent.append(element); return element;
    };
    lights.replaceChildren();
    lights.setAttribute('viewBox', `0 0 ${map!.width} ${map!.height}`); lights.setAttribute('preserveAspectRatio', 'none');
    lights.style.setProperty('--flow-start', `${flowStart}s`); lights.style.setProperty('--flow-time', `${flowTime}s`);
    const defs = add(lights, 'defs');
    for (const [kind, stops] of Object.entries(glowStops)) {
      const gradient = add(defs, 'radialGradient', { id: `village-glow-${kind}` });
      for (const [offset, color] of stops) add(gradient, 'stop', { offset, 'stop-color': color });
    }
    const stage = revealStage && !reduced.matches ? revealStage : undefined;
    const roads = stage ? villageLightRoutes(map!, navigation!) : {};
    // The core's light spreads back out to every building; other labs send theirs to the core.
    const routes = stage === 'rescue' ? Object.values(roads).map(route => [...route].reverse()) : stage && roads[stage] ? [roads[stage]!] : [];
    const along = (point: Point) => {
      let best = 95, at = -1;
      for (const route of routes) {
        const total = route.slice(1).reduce((sum, p, i) => sum + distance(route[i], p), 0) || 1;
        let walked = 0;
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1], b = route[i], length = distance(a, b);
          for (let s = 0; s <= 8; s++) { const d = distance(point, { x: a.x + (b.x - a.x) * s / 8, y: a.y + (b.y - a.y) * s / 8 }); if (d < best) { best = d; at = (walked + length * s / 8) / total; } }
          walked += length;
        }
      }
      return at;
    };
    const groups: (StageId | 'plaza')[] = [...story.changes, ...(story.complete ? ['plaza' as const] : [])];
    const entries = groups.flatMap(id => villageLights[id].map((light, index) => ({ id, light, index })));
    entries.sort((a, b) => Number(b.light.kind === 'aura') - Number(a.light.kind === 'aura'));
    for (const { id, light, index } of entries) {
      const group = add(lights, 'g', { class: `village-light is-${light.kind}` });
      add(group, 'circle', { cx: light.x, cy: light.y, r: light.r, fill: `url(#village-glow-${light.kind})` });
      if (light.kind === 'lamp') add(group, 'circle', { cx: light.x, cy: light.y, r: 4, class: 'village-light-core' });
      if (!stage || (id !== stage && !(id === 'plaza' && stage === 'rescue'))) continue;
      // Windows come on one by one; lamps beside the road wait for the travelling light.
      const passed = light.kind === 'lamp' ? along(light) : -1;
      const delay = id === 'plaza' ? flowStart + flowTime : passed >= 0 ? flowStart + flowTime * passed : .15 + index * .12;
      group.classList.add('is-fresh'); (group as SVGGElement).style.animationDelay = `${delay.toFixed(2)}s`;
    }
    for (const stage of solved) {
      const { sign } = requesterSpots[stage];
      const group = add(lights, 'g', { class: 'village-light village-sign' });
      add(group, 'circle', { cx: sign.x, cy: sign.y, r: 80, fill: 'url(#village-glow-aura)' });
      add(group, 'rect', { x: sign.x - 58, y: sign.y - 20, width: 116, height: 40, rx: 8, class: 'village-sign-plate' });
      add(group, 'text', { x: sign.x, y: sign.y + 8, class: 'village-sign-text' }).textContent = villageRequests[stage].sign;
      if (arriving.includes(stage)) { group.classList.add('is-fresh'); (group as SVGGElement).style.animationDelay = `${(arrivalStart + arrivalTime).toFixed(2)}s`; }
    }
    for (const route of routes) {
      const d = route.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
      for (const kind of ['glow', 'line']) add(lights, 'path', { d, class: `village-flow is-${kind}`, pathLength: 1 });
      const end = route.at(-1)!;
      const ring = add(lights, 'circle', { cx: end.x, cy: end.y - 24, r: 36, class: 'village-arrival' });
      ring.style.animationDelay = `${(flowStart + flowTime).toFixed(2)}s`;
      const spark = add(lights, 'g', { class: 'village-spark' });
      add(spark, 'circle', { r: 26, fill: 'url(#village-glow-lamp)' }); add(spark, 'circle', { r: 7, class: 'village-light-core' });
      const total = route.slice(1).reduce((sum, p, i) => sum + distance(route[i], p), 0) || 1;
      let walked = 0;
      const frames = route.map((p, i) => { if (i) walked += distance(route[i - 1], p); return { transform: `translate(${p.x}px, ${p.y}px)`, offset: walked / total }; });
      spark.animate(frames, { duration: flowTime * 1000, delay: flowStart * 1000, easing: 'ease-in-out', fill: 'both' });
      spark.animate([{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: flowTime * 1000, delay: flowStart * 1000, fill: 'both' });
    }
  }
  function primary() {
    if(!map||paused())return;updateNearby();
    const goal=!nearestNpc&&!nearestClient&&!nearBoard&&story.next&&nearestBuilding?.id!==story.next?map.buildings.find(b=>b.id===story.next):undefined;
    if(goal){goTo(goal.entry,villageRewards[goal.id].name);return;}
    interact();
  }
  function showLine() {
    if(!talk)return;
    root.querySelector('#village-dialog-title')!.textContent=talk.name;
    root.querySelector('#village-dialog-role')!.textContent=talk.role;
    root.querySelector('#village-dialog-line')!.textContent=talk.lines[line];
    root.querySelector('#village-dialog-page')!.textContent=`${line+1} / ${talk.lines.length}`;
    nextLine.textContent=line===talk.lines.length-1?talk.done:'이야기 더 듣기 →';
    portrait.src=assetURL(talk.portrait(line));portrait.style.filter=talk.tint;
  }
  function openTalk(next: Talk) {
    if(!map||paused())return;
    talk=next;line=0;path=[];destination=null;clearInput();showLine();dialog.showModal();nextLine.focus();draw();
  }
  function closeDialogue() { if(!dialog.open)return;dialog.close();talk=null;clearInput();canvas.focus();last=performance.now();draw(); }
  function explainLockedBuilding(building: Building) {
    if (options.adminUnlocked || stageIsOpen(context.save, building.id)) return false;
    const mission = story.next ? villageRewards[story.next].name : '먼저 열린 실험실';
    const message = `먼저 ${mission} 미션을 끝내고 와 줘! 실험과 의뢰를 마치고 복구하면 다음 건물에 들어갈 수 있어.`;
    hint.textContent = message;
    openTalk({ name: villageRewards[building.id].name, role: '아직 들어갈 수 없어요', lines: [message], portrait: () => 'npc/point.webp', tint: '', done: '미션을 끝내고 올게!' });
    return true;
  }
  function enterBuilding(building: Building) {
    if (entering || !alive || paused()) return false;
    if (explainLockedBuilding(building)) return false;
    entering = true;
    clearInput(); path = []; destination = null;
    context.navigate(building.id);
    return true;
  }
  function interact() {
    if(!map||paused())return;updateNearby();
    if(nearestNpc){const lines=story.lines;openTalk({name:nearestNpc.name,role:'마을의 안내원',lines,portrait:i=>i===0?'npc/wave.webp':i===lines.length-1?'npc/point.webp':'npc/think.webp',tint:'',done:'탐구하러 갈게!'});return;}
    if(nearestClient){openClient(nearestClient);return;}
    if(nearBoard){openBoard();return;}
    if(!nearestBuilding)return;
    enterBuilding(nearestBuilding);
  }
  function move(dx: number, dy: number): boolean {
    if(!map || (!dx && !dy))return false;
    const next = moveVillagePoint(map, actor, { x: dx, y: dy });
    const actualX = next.x - actor.x, actualY = next.y - actor.y;
    const moved = Math.hypot(actualX, actualY) > .001;
    const facingX = moved ? actualX : dx, facingY = moved ? actualY : dy;
    actor.direction = Math.abs(facingX) > Math.abs(facingY) ? facingX < 0 ? 'left' : 'right' : facingY < 0 ? 'up' : 'down';
    actor.x = next.x; actor.y = next.y;
    return moved;
  }
  function tick(now: number) {
    if(!alive||!map)return;
    const dt=Math.min(.035,Math.max(0,(now-last)/1000));last=now;
    if(paused()){clearInput();path=[];destination=null;walkingTime=0;dogTime=0;raf=requestAnimationFrame(tick);return;}
    const old={x:actor.x,y:actor.y}, oldFacing=actor.direction;
    const direction = input.vector(pads.values());
    let arrived=false;
    if(direction.x||direction.y){path=[];destination=null;move(direction.x*walkingSpeed*dt,direction.y*walkingSpeed*dt);}
    else if(path.length){const target=path[0],d=distance(actor,target);if(d<3)path.shift();else move((target.x-actor.x)/d*Math.min(d,walkingSpeed*dt),(target.y-actor.y)/d*Math.min(d,walkingSpeed*dt));if(!path.length){destination=null;arrived=true;}}
    const moved=distance(old,actor)>.05;if(moved){walkingTime+=dt;if(!trail.length||distance(actor,trail.at(-1)!)>9)trail.push({x:actor.x,y:actor.y});}else walkingTime=0;
    const entered = entrance?.(actor);
    if (entered && enterBuilding(entered)) return;
    let dogMoved=false;
    if(trail.length>5){const target=trail[0],d=distance(dog,target);if(d<4)trail.shift();else{const amount=Math.min(d,(walkingSpeed+40)*dt),next={x:dog.x+(target.x-dog.x)/d*amount,y:dog.y+(target.y-dog.y)/d*amount};if(navigation!.stand(next)){dog.direction=Math.abs(target.x-dog.x)>Math.abs(target.y-dog.y)?target.x<dog.x?'left':'right':target.y<dog.y?'up':'down';dog.x=next.x;dog.y=next.y;dogMoved=true;}else trail.shift();}}
    dogTime=dogMoved?dogTime+dt:0;revealTime+=dt;
    if(!arrivalShown&&revealTime>=arrivalStart+arrivalTime){
      arrivalShown=true;
      labels.querySelectorAll('.village-client-bubble.is-waiting').forEach(bubble=>{bubble.classList.remove('is-waiting');bubble.classList.add('is-arrived');});
      hint.textContent=`${withParticle(villageRequests[arriving[0]].client,'이','가')} 가게 앞에 돌아왔어! 말풍선을 누르면 인사를 들을 수 있어.`;
    }
    updateNearby();
    if(arrived&&!entered)hint.textContent=restHint();
    // The banner shrinks to its title so labels stay readable, then leaves the next step to the hint.
    if(!reveal.hidden&&revealTime>3.6)reveal.classList.add('is-compact');
    if(!reveal.hidden&&revealTime>8){reveal.hidden=true;if(revealStage&&hint.textContent===villageRewards[revealStage].changeDescription)hint.textContent=restHint();}
    if(moved||dogMoved||moved!==wasMoving||dogMoved!==wasDogMoving||actor.direction!==oldFacing||now-lastDraw>180||revealStage&&revealTime<revealEnd+.2||!arrivalShown&&revealTime>=arrivalStart-.05){draw(moved,dogMoved);lastDraw=now;}
    wasMoving=moved;wasDogMoving=dogMoved;
    raf=requestAnimationFrame(tick);
  }
  async function loadWorld() {
    const token=++generation;cancelAnimationFrame(raf);fetches.abort();fetches=new AbortController();cancelImages.forEach(cancel=>cancel());clearInput();map=null;path=[];images.clear();labels.replaceChildren();lights.replaceChildren();loading.hidden=false;retry.hidden=true;action.disabled=true;reveal.hidden=true;
    loading.querySelector('strong')!.textContent='마을로 가는 길을 준비해요…';
    const progress=loading.querySelector('progress')!,detail=root.querySelector('#village-loading-detail')!;progress.hidden=false;progress.value=0;detail.textContent='마을 지도를 읽는 중이에요';
    try {
      const responses=await Promise.all([fetch(base+'world-map.json',{signal:fetches.signal}),fetch(base+'manifest.json',{signal:fetches.signal})]);
      if(responses.some(response=>!response.ok))throw new Error('map');
      const candidate=validateMap(await responses[0].json());const manifest=await responses[1].json() as {outputs:AssetMeta[]};
      if(!alive||token!==generation)return;if(!ctx)throw new Error('canvas');
      if(!Array.isArray(manifest.outputs))throw new Error('manifest');metadata=new Map(manifest.outputs.map(item=>[item.file,item]));
      const files=[...new Set(['terrain.webp',...candidate.buildings.map(b=>b.asset),...candidate.npcs.map(n=>n.asset),...['guide','wave','think','point','baker','inspector','clerk','crafter'].map(pose=>`npc/${pose}.webp`),...['student','corgi'].flatMap(person=>directions.flatMap(direction=>[1,2,3,4].map(i=>`${person}/${direction}-${i}.webp`))),...[1,4,5,9,10,11,12].map(i=>`props/prop-${String(i).padStart(2,'0')}.webp`)])];
      let count=0;
      const loaded=await Promise.all(files.map(async file=>{const image=await loadImage(file);if(alive&&token===generation){count++;progress.value=Math.round(count/files.length*95);detail.textContent=`마을 그림 ${count} / ${files.length}장 준비`;}return [file,image] as const;}));
      if(!alive||token!==generation)return;
      detail.textContent='안전하게 걸을 수 있는 길을 찾는 중이에요';
      const nav=createVillageNavigation(candidate);const returned=candidate.buildings.find(b=>b.id===options.returnedFrom);
      const wanted=returned?{x:returned.entry.x,y:returned.entry.y+36}:candidate.spawn;
      const spawn=nav.stand(wanted)?wanted:nav.nearest(wanted,100);if(!spawn)throw new Error('spawn');
      const dogSpawn = [{x:spawn.x+27,y:spawn.y+28},{x:spawn.x-27,y:spawn.y+28},{x:spawn.x,y:spawn.y+40}]
        .find(point => nav.stand(point) && nav.segment(spawn,point)) ?? spawn;
      map=candidate;navigation=nav;images=new Map(loaded);actor={...spawn,direction:'down'};dog={...dogSpawn,direction:'down'};trail=[{...spawn}];
      entrance=createVillageEntrances(candidate,spawn);entering=false;
      walkingTime=dogTime=revealTime=0;destination=null;setupLabels();setupLights();loading.hidden=true;resize();updateNearby();
      if(revealStage){
        reveal.innerHTML=`<strong>✦ ${villageRewards[revealStage].changeTitle}</strong><span>도토리 박사: ${villageRewards[revealStage].afterLines[0]}</span>`;
        // The banner sits above the bottom bar; if the next lab's label is low, lean away from it.
        const goal=candidate.buildings.find(b=>b.id===story.next);
        const low=goal&&(goal.y+goal.height*.42)/candidate.height>.45;
        reveal.style.left=low?`${(goal.x+goal.width/2)/candidate.width<.5?57:43}%`:'';
        reveal.classList.remove('is-compact');reveal.hidden=false;hint.textContent=villageRewards[revealStage].changeDescription;
      }
      else hint.textContent=story.complete?restHint():returned?`다시 마을이야! 불이 켜진 ${villageRewards[story.next!].name} 이름표를 누르면 걸어가요.`:'불이 켜진 건물 이름을 누르면 실험하러 걸어가요.';
      last=performance.now();raf=requestAnimationFrame(tick);canvas.focus({preventScroll:true});
    } catch {
      if(!alive||token!==generation)return;fetches.abort();cancelImages.forEach(cancel=>cancel());
      loading.querySelector('strong')!.textContent='마을 그림을 불러오지 못했어요';detail.textContent='인터넷 연결을 확인하고 다시 불러와 주세요. 탐구 기록은 그대로예요.';progress.hidden=true;retry.hidden=false;retry.focus();
    }
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!map||paused()||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();const bounds=canvas.getBoundingClientRect(),p={x:(event.clientX-bounds.left)/bounds.width*map.width,y:(event.clientY-bounds.top)/bounds.height*map.height};
    if(Math.abs(p.x-requestBoardSpot.x)<50&&p.y>requestBoardSpot.y-98&&p.y<requestBoardSpot.y+10){openBoard();return;}
    const client=visibleClients().find(stage=>{const c=requesterSpots[stage];return Math.abs(p.x-c.x)<30&&p.y>c.y-npcHeight()-5&&p.y<c.y+8;});if(client){openClient(client);return;}
    const npc=map.npcs.find(n=>distance(n,p)<55);if(npc){goTo({x:npc.x-72,y:npc.y+6},npc.name);return;}
    const building=map.buildings.find(b=>p.x>b.x&&p.x<b.x+b.width&&p.y>b.y&&p.y<b.y+b.height);if(building){goTo(building.entry,villageRewards[building.id].name);return;}
    goTo(p);
  },{signal:events.signal});
  window.addEventListener('keydown',event=>{
    if(!map||paused())return;const target=event.target as Element;
    if(event.ctrlKey||event.altKey||event.metaKey||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]'))return;
    if(input.press(event.key,event.code)){event.preventDefault();path=[];destination=null;canvas.focus({preventScroll:true});syncPadFeedback();}
    else if((event.key==='Enter'||event.key===' ')&&!event.repeat&&!target.closest('button,a')){event.preventDefault();interact();}
  },{signal:events.signal});
  window.addEventListener('keyup',event=>{if(input.release(event.key,event.code)){event.preventDefault();syncPadFeedback();}},{signal:events.signal});
  window.addEventListener('blur',clearInput,{signal:events.signal});
  document.addEventListener('visibilitychange',()=>{clearInput();last=performance.now();},{signal:events.signal});
  padButtons.forEach(button=>{
    button.addEventListener('pointerdown',event=>{if(!map||paused()||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();canvas.focus();path=[];destination=null;button.setPointerCapture(event.pointerId);pads.set(event.pointerId,button.dataset.direction as Direction);syncPadFeedback();},{signal:events.signal});
    button.addEventListener('pointermove',event=>{
      if(!pads.has(event.pointerId)||paused())return;
      const hovered=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-direction]');
      if(hovered&&pad.contains(hovered)){pads.set(event.pointerId,hovered.dataset.direction as Direction);syncPadFeedback();}
    },{signal:events.signal});
    const release=(event:PointerEvent)=>{pads.delete(event.pointerId);syncPadFeedback();};
    button.addEventListener('pointerup',release,{signal:events.signal});button.addEventListener('pointercancel',release,{signal:events.signal});button.addEventListener('lostpointercapture',release,{signal:events.signal});
    button.addEventListener('click',event=>{if(event.detail!==0||!map||paused())return;const v=vectors[button.dataset.direction as Direction];goTo({x:actor.x+v.x*48,y:actor.y+v.y*48});},{signal:events.signal});
  });
  action.addEventListener('click',primary,{signal:events.signal});results.addEventListener('click',()=>context.navigate('complete'),{signal:events.signal});
  nextLine.addEventListener('click',()=>{if(talk&&line+1<talk.lines.length){line++;showLine();}else closeDialogue();},{signal:events.signal});
  root.querySelector('#village-board-close')!.addEventListener('click',closeBoard,{signal:events.signal});
  board.addEventListener('cancel',event=>{event.preventDefault();closeBoard();},{signal:events.signal});
  root.querySelector('#village-dialog-close')!.addEventListener('click',closeDialogue,{signal:events.signal});
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialogue();},{signal:events.signal});
  retry.addEventListener('click',()=>void loadWorld(),{signal:events.signal});
  reduced.addEventListener('change',()=>{if(reduced.matches)lights.querySelectorAll('.village-spark').forEach(spark=>spark.remove());draw();},{signal:events.signal});
  void loadWorld();
  return()=>{alive=false;generation++;cancelAnimationFrame(raf);fetches.abort();cancelImages.forEach(cancel=>cancel());clearInput();events.abort();observer.disconnect();if(dialog.open)dialog.close();if(board.open)board.close();portrait.removeAttribute('src');tinted.clear();images.clear();metadata.clear();};
}



