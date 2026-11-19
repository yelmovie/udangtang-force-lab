// 마을 지도 위 불빛(SVG): 복구한 건물의 창문·가로등, 해결한 의뢰의 간판, 새로 복구했을 때 코어까지 흐르는 빛.
// (2026-11-19 village.ts의 setupLights를 그대로 옮김, 동작 변경 없음)
import type { StageId } from '../data';
import { villageRequests, type RequestStage } from '../requestBoard';
import { distance, glowStops, requesterSpots, villageLightRoutes, villageLights, type createVillageNavigation, type Point, type VillageMap } from './villageMap';

export type VillageLightOptions = {
  map: VillageMap; navigation: ReturnType<typeof createVillageNavigation>;
  /** 이번에 막 복구한 건물(움직임 줄이기면 undefined). */
  reveal: StageId | undefined;
  changes: StageId[]; complete: boolean; solved: RequestStage[]; arriving: RequestStage[];
  flowStart: number; flowTime: number; arrivalStart: number; arrivalTime: number;
};

export function renderVillageLights(svg: SVGSVGElement, { map, navigation, reveal, changes, complete, solved, arriving, flowStart, flowTime, arrivalStart, arrivalTime }: VillageLightOptions) {
  const add = (parent: Element, tag: string, attributes: Record<string, string | number> = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    parent.append(element); return element;
  };
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${map.width} ${map.height}`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.setProperty('--flow-start', `${flowStart}s`); svg.style.setProperty('--flow-time', `${flowTime}s`);
  const defs = add(svg, 'defs');
  for (const [kind, stops] of Object.entries(glowStops)) {
    const gradient = add(defs, 'radialGradient', { id: `village-glow-${kind}` });
    for (const [offset, color] of stops) add(gradient, 'stop', { offset, 'stop-color': color });
  }
  const stage = reveal;
  const roads = stage ? villageLightRoutes(map, navigation) : {};
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
  const groups: (StageId | 'plaza')[] = [...changes, ...(complete ? ['plaza' as const] : [])];
  const entries = groups.flatMap(id => villageLights[id].map((light, index) => ({ id, light, index })));
  entries.sort((a, b) => Number(b.light.kind === 'aura') - Number(a.light.kind === 'aura'));
  for (const { id, light, index } of entries) {
    const group = add(svg, 'g', { class: `village-light is-${light.kind}` });
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
    const group = add(svg, 'g', { class: 'village-light village-sign' });
    add(group, 'circle', { cx: sign.x, cy: sign.y, r: 80, fill: 'url(#village-glow-aura)' });
    add(group, 'rect', { x: sign.x - 58, y: sign.y - 20, width: 116, height: 40, rx: 8, class: 'village-sign-plate' });
    add(group, 'text', { x: sign.x, y: sign.y + 8, class: 'village-sign-text' }).textContent = villageRequests[stage].sign;
    if (arriving.includes(stage)) { group.classList.add('is-fresh'); (group as SVGGElement).style.animationDelay = `${(arrivalStart + arrivalTime).toFixed(2)}s`; }
  }
  for (const route of routes) {
    const d = route.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
    for (const kind of ['glow', 'line']) add(svg, 'path', { d, class: `village-flow is-${kind}`, pathLength: 1 });
    const end = route.at(-1)!;
    const ring = add(svg, 'circle', { cx: end.x, cy: end.y - 24, r: 36, class: 'village-arrival' });
    ring.style.animationDelay = `${(flowStart + flowTime).toFixed(2)}s`;
    const spark = add(svg, 'g', { class: 'village-spark' });
    add(spark, 'circle', { r: 26, fill: 'url(#village-glow-lamp)' }); add(spark, 'circle', { r: 7, class: 'village-light-core' });
    const total = route.slice(1).reduce((sum, p, i) => sum + distance(route[i], p), 0) || 1;
    let walked = 0;
    const frames = route.map((p, i) => { if (i) walked += distance(route[i - 1], p); return { transform: `translate(${p.x}px, ${p.y}px)`, offset: walked / total }; });
    spark.animate(frames, { duration: flowTime * 1000, delay: flowStart * 1000, easing: 'ease-in-out', fill: 'both' });
    spark.animate([{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: flowTime * 1000, delay: flowStart * 1000, fill: 'both' });
  }

}
