// 마을 지도 순수 로직: 지도 자료 형식·걷기 판정·길 찾기·입력·불빛 자료. 화면·캔버스와 무관해서 테스트가 직접 쓴다.
// (2026-11-19 village.ts에서 그대로 옮김, 동작 변경 없음)
import type { StageId } from '../data';
import type { RequestStage } from '../requestBoard';

export type Point = { x: number; y: number };
export type Direction = 'down' | 'left' | 'right' | 'up';
export type Polygon = { id: string; points: [number, number][] };
export type Building = { id: StageId; asset: string; x: number; y: number; width: number; height: number; entry: Point & { radius: number } };
export type Npc = Point & { id: string; name: string; asset: string; portrait?: string };
export type VillageMap = { width: number; height: number; radius: number; spawn: Point; walkable: Polygon[]; blocked: Polygon[]; buildings: Building[]; npcs: Npc[] };
export type AssetMeta = { file: string; width: number; height: number; pivot?: Point; alphaBounds?: { left: number; top: number; width: number; height: number } };
export const directions: Direction[] = ['down', 'left', 'right', 'up'];
export const stageIds: StageId[] = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const walkingSpeed = 220;

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

export function inside(point: Point, polygon: Polygon): boolean {
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

export type Edge = { a: Point; b: Point };
export const geometryCache = new WeakMap<VillageMap, { boundary: Edge[]; blocked: Edge[] }>();
export const geometryEpsilon = 1e-6;
export function polygonEdges(polygons: Polygon[]): Edge[] {
  return polygons.flatMap(polygon => polygon.points.map(([x,y],i) => {
    const next=polygon.points[(i+1)%polygon.points.length];
    return { a:{x,y},b:{x:next[0],y:next[1]} };
  }));
}
export function geometryFor(map: VillageMap) {
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
export function distanceToEdge(point: Point, {a,b}: Edge): number {
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

export function validateMap(value: unknown): VillageMap {
  const map = value as VillageMap;
  const point = (p: Point) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const polygons = (p: Polygon[]) => Array.isArray(p) && p.every(poly=>Array.isArray(poly.points)&&poly.points.length>=3&&poly.points.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isFinite)));
  if(!map||!Number.isFinite(map.width)||!Number.isFinite(map.height)||map.width<100||map.height<100||map.width>5000||map.height>5000||!Number.isFinite(map.radius)||map.radius<1||!point(map.spawn)||!polygons(map.walkable)||!map.walkable.length||!polygons(map.blocked)||!Array.isArray(map.buildings)||!Array.isArray(map.npcs))throw new Error('map');
  if(map.buildings.some(b=>!stageIds.includes(b.id)||!point(b)||!point(b.entry)||!Number.isFinite(b.width)||!Number.isFinite(b.height)||!Number.isFinite(b.entry.radius)||typeof b.asset!=='string')||map.npcs.some(n=>!point(n)||typeof n.asset!=='string'||typeof n.name!=='string'))throw new Error('map');
  return map;
}

export type VillageLight = Point & { r: number; kind: 'aura' | 'window' | 'lamp' };
/** Warm windows and street lamps (map pixels) each restored building switches on. 'plaza' joins at 5/5. */
export const villageLights: Record<StageId | 'plaza', VillageLight[]> = {
  cargo: [{x:345,y:250,r:140,kind:'aura'},{x:352,y:268,r:34,kind:'window'},{x:460,y:232,r:20,kind:'window'},{x:292,y:222,r:30,kind:'lamp'},{x:407,y:222,r:30,kind:'lamp'}],
  rescue: [{x:838,y:222,r:155,kind:'aura'},{x:832,y:290,r:38,kind:'window'},{x:728,y:250,r:24,kind:'window'},{x:940,y:250,r:24,kind:'window'},{x:830,y:175,r:60,kind:'window'},{x:783,y:250,r:28,kind:'lamp'},{x:880,y:250,r:28,kind:'lamp'}],
  balance: [{x:1440,y:240,r:140,kind:'aura'},{x:1440,y:270,r:34,kind:'window'},{x:1343,y:240,r:22,kind:'window'},{x:1537,y:240,r:22,kind:'window'},{x:1388,y:248,r:28,kind:'lamp'},{x:1487,y:248,r:28,kind:'lamp'},{x:1102,y:215,r:38,kind:'lamp'},{x:1265,y:215,r:38,kind:'lamp'},{x:1102,y:282,r:38,kind:'lamp'},{x:1265,y:282,r:38,kind:'lamp'}],
  scale: [{x:420,y:620,r:150,kind:'aura'},{x:500,y:650,r:30,kind:'window'},{x:300,y:600,r:40,kind:'window'},{x:410,y:640,r:26,kind:'window'},{x:475,y:622,r:26,kind:'lamp'},{x:530,y:622,r:26,kind:'lamp'},{x:465,y:812,r:40,kind:'lamp'}],
  workshop: [{x:1450,y:640,r:140,kind:'aura'},{x:1520,y:672,r:32,kind:'window'},{x:1440,y:650,r:28,kind:'window'},{x:1390,y:632,r:26,kind:'lamp'},{x:1485,y:632,r:26,kind:'lamp'},{x:1120,y:465,r:38,kind:'lamp'},{x:1268,y:465,r:38,kind:'lamp'},{x:1120,y:527,r:38,kind:'lamp'},{x:1268,y:527,r:38,kind:'lamp'}],
  plaza: [{x:754,y:790,r:44,kind:'lamp'},{x:919,y:790,r:44,kind:'lamp'}],
};

export const glowStops: Record<VillageLight['kind'], [string, string][]> = {
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
/** E6 (2026-11-21): a finished mission's reward on the map — the spot the fog clears around and the reveal ring marks (map pixels). */
export const rewardSpots: Record<StageId, Point> = {
  cargo: { x: 455, y: 374 }, balance: { x: 1183, y: 282 }, scale: { x: 574, y: 735 }, workshop: { x: 1344, y: 732 }, rescue: { x: 838, y: 243 },
};
/** Props drawn for a finished mission, in drawing order: file, foot point and height (map pixels). */
export const rewardProps: Record<StageId, { file: string; at: Point; height: number }[]> = {
  cargo: [{ file: 'props/prop-01.webp', at: { x: 455, y: 374 }, height: 70 }, { file: 'props/prop-01.webp', at: { x: 504, y: 389 }, height: 55 }],
  balance: [],
  scale: [{ file: 'props/prop-05.webp', at: { x: 576, y: 735 }, height: 60 }, { file: 'props/prop-04.webp', at: { x: 613, y: 755 }, height: 39 }],
  workshop: [{ file: 'props/prop-11.webp', at: { x: 1344, y: 732 }, height: 50 }, { file: 'props/prop-09.webp', at: { x: 1540, y: 738 }, height: 40 }, { file: 'props/prop-10.webp', at: { x: 1540, y: 703 }, height: 16 }],
  rescue: [{ file: 'props/prop-12.webp', at: { x: 838, y: 243 }, height: 55 }],
};
/** The repaired cargo rail: a yellow stripe drawn after the cargo props (map pixels). */
export const cargoRewardRail = { x: 382, y: 389, width: 65, height: 6, color: '#f8db74' };
/** NPC silhouettes use the same scale and standing height as the student. */
export const mapCharacterHeight = 83;

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
