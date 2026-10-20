// Flat SVG workbench used when the 3D one cannot start (no WebGL, lost context, model or module load failure).
// It implements the same WorkshopScene interface, so gestures, judging, records and the request all stay shared.
import { getWorkshopDesign, type LeverSetting, type WorkshopTool } from '../workshopModel';
import type { WorkshopScene } from './workshopScene';

const NS = 'http://www.w3.org/2000/svg';
const LEVER_Y = 1.5;   // height of the pivot top in world units (floor = 0)
const RAMP_BASE = .3;

export function createWorkshopScene2D(host: HTMLElement): WorkshopScene {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('workshop-flat');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '평면 작업대: 받침대 위 판자(지레)와 빗면, 화물');
  host.append(svg);
  let tool: WorkshopTool | 'direct' = 'lever', setting = 1, progress = 0, cargoSize = .62, disposed = false;

  // World → screen: front view, floor near the bottom, x centred. Same axes as the 3D scene.
  function frame() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    // The floor sits above the bottom controls so the DOM actor's feet stay on screen.
    const scale = Math.min(width / 9, height / 3.7);
    return { width, height, scale, cx: width / 2, floor: height * .74 };
  }
  function project(x: number, y: number) {
    const f = frame();
    return { x: f.cx + x * f.scale, y: f.floor - y * f.scale };
  }
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    svg.append(node);
    return node;
  };
  function leverPose() {
    const design = getWorkshopDesign('lever', setting);
    const loadArm = 2 - design.pivot, effortArm = 2 + design.pivot;
    const rotation = Math.asin(Math.min(1, design.lift * progress / loadArm));
    return {
      design, rotation,
      load: { x: design.pivot + loadArm * Math.cos(rotation), y: LEVER_Y + loadArm * Math.sin(rotation) },
      effort: { x: design.pivot - effortArm * Math.cos(rotation), y: LEVER_Y - effortArm * Math.sin(rotation) },
    };
  }
  function crate(x: number, y: number, angle = 0) {
    // (x, y) is the middle of the crate's bottom edge in world units.
    const f = frame(), size = cargoSize * f.scale, p = project(x, y);
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${-angle * 180 / Math.PI})`);
    const box = document.createElementNS(NS, 'rect');
    Object.entries({ x: -size / 2, y: -size, width: size, height: size, rx: size * .08, fill: '#c98a4b', stroke: '#6e4320', 'stroke-width': 3 }).forEach(([k, v]) => box.setAttribute(k, String(v)));
    const band = document.createElementNS(NS, 'path');
    band.setAttribute('d', `M${-size / 2} ${-size / 2}H${size / 2}M${-size / 2 + 4} ${-4}L${size / 2 - 4} ${-size + 4}`);
    band.setAttribute('stroke', '#8a5528'); band.setAttribute('stroke-width', '3'); band.setAttribute('fill', 'none');
    group.append(box, band); svg.append(group);
  }
  function draw() {
    if (disposed) return;
    const f = frame();
    svg.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
    svg.replaceChildren();
    el('rect', { x: 0, y: f.floor, width: f.width, height: f.height - f.floor, fill: '#d9b98a', opacity: .55 });
    el('line', { x1: 0, y1: f.floor, x2: f.width, y2: f.floor, stroke: '#8a6440', 'stroke-width': 3 });
    if (tool === 'lever') {
      const { design, rotation, load, effort } = leverPose();
      const top = project(design.pivot, LEVER_Y), base = project(design.pivot, 0), half = .45 * f.scale;
      el('path', { d: `M${top.x} ${top.y}L${base.x - half} ${base.y}H${base.x + half}Z`, fill: '#267a78', stroke: '#0f4d4b', 'stroke-width': 3, 'stroke-linejoin': 'round' });
      const a = project(effort.x, effort.y), b = project(load.x, load.y);
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#a8682f', 'stroke-width': Math.max(10, f.scale * .16), 'stroke-linecap': 'round' });
      el('circle', { cx: top.x, cy: top.y, r: Math.max(5, f.scale * .07), fill: '#d8ae65', stroke: '#6e4320', 'stroke-width': 2 });
      crate(load.x - .25, load.y + .06, rotation);
    } else if (tool === 'ramp') {
      const design = getWorkshopDesign('ramp', setting);
      const run = Math.sqrt(design.length ** 2 - design.lift ** 2), slope = Math.asin(design.lift / design.length);
      const low = project(-run / 2, RAMP_BASE), high = project(run / 2, RAMP_BASE + design.lift), foot = project(run / 2, 0);
      el('path', { d: `M${low.x} ${low.y}L${high.x} ${high.y}L${foot.x} ${foot.y}L${low.x} ${project(-run / 2, 0).y}Z`, fill: '#e7c79a', stroke: '#8a5528', 'stroke-width': 3, 'stroke-linejoin': 'round' });
      el('line', { x1: low.x, y1: low.y, x2: high.x, y2: high.y, stroke: '#a8682f', 'stroke-width': Math.max(8, f.scale * .12), 'stroke-linecap': 'round' });
      crate(-run / 2 + run * progress, RAMP_BASE + design.lift * progress + .04, slope);
    }
    // Direct lifting is drawn by the DOM actor (child holding the crate), as in the 3D scene.
  }
  const observer = new ResizeObserver(draw);
  observer.observe(host);
  draw();
  return {
    configure(nextTool, nextSetting) { tool = nextTool; setting = nextSetting; progress = 0; draw(); },
    setProgress(next) { progress = Math.max(0, Math.min(1, next)); draw(); },
    setCargoWeight(weight) { cargoSize = .62 * Math.max(.85, Math.min(1.22, .55 + .45 * weight)); draw(); },
    turn() { /* the flat view has one fixed angle */ },
    layout() {
      if (tool === 'lever') {
        const { design, effort } = leverPose();
        return { support: project(design.pivot, LEVER_Y * .6), effort: project(effort.x, effort.y), effortRest: project(-2, LEVER_Y),
          actorFloor: project(-2.7, 0), heightStart: project(2.6, LEVER_Y), heightGoal: project(2.6, LEVER_Y + design.lift) };
      }
      const design = tool === 'ramp' ? getWorkshopDesign('ramp', setting) : { length: 0, lift: 1.4 };
      const x = tool === 'ramp' ? Math.sqrt(design.length ** 2 - design.lift ** 2) / 2 + .42 : 1;
      return { support: project(0, .7), effort: project(0, .3), effortRest: project(0, .3), actorFloor: project(0, 0), heightStart: project(x, RAMP_BASE), heightGoal: project(x, RAMP_BASE + design.lift) };
    },
    leverSettingAt(x) {
      return ([0, 1, 2] as LeverSetting[]).reduce((best, next) =>
        Math.abs(project(getWorkshopDesign('lever', next).pivot, 0).x - x) < Math.abs(project(getWorkshopDesign('lever', best).pivot, 0).x - x) ? next : best, 1 as LeverSetting);
    },
    dispose() { disposed = true; observer.disconnect(); svg.remove(); },
  };
}
