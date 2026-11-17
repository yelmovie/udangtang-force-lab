import type { RescueState } from './state';
import { canLift, needsShortRampTrial, rescueReady, stallTravel } from './rescueModel';
import { coreRoutePoint, coreRoutes, type CorePoint, type CoreRoute } from './coreSceneModel';

// Walking version of the core mission: where things stand on the one-way course and which button a place offers.
// It decides nothing about the experiment itself; arrivals and stops still come from canLift() in rescueModel.
export type WalkZone = 'scale' | 'gate' | 'short' | 'long' | 'dock';
export type WalkAction = 'zero' | 'load' | 'unload' | 'reading' | 'push-crate' | 'pull-crate' | 'push-core' | 'retry' | 'dock';
export type WalkSpot = { x: number; y: number; z: number };

export const walkCourse = {
  minX: -20.2, maxX: 5.1, halfDepth: 2.55,
  spawn: { x: -19, y: 0, z: .7 },
  station: { x: -17.8, y: 0, z: -1.9 },
  scale: { x: -15.5, y: 0, z: -1.8 },
  sillX: -13.5,
  gateX: -9, gatePull: 2.5, doorHalf: 1.15,
  pileX: -7.3,
  deckY: 1.3, dock: { x: 3.95, y: 1.3, z: 0 },
} as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const phaseOf = (state: RescueState) => !state.measured ? 0 : !state.gate ? 1 : 2;

/** The crate sits in the doorway and comes toward the explorer (west) as it is pulled; a push only nudges it against the stoppers. */
export function crateX(travel: number): number { return walkCourse.gateX - walkCourse.gatePull * clamp(travel, -.07, 1); }

/** Where the explorer's feet are while holding the crate or the core, so the figure moves with the object. */
export function crateHoldSpot(travel: number): WalkSpot { return { x: crateX(travel) - 1.1, y: 0, z: 0 }; }
export function coreHoldSpot(route: CoreRoute, progress: number): WalkSpot {
  const { start, end } = coreRoutes[route], dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
  const core = coreRoutePoint(route, progress), x = core.x - dx / length * .85;
  return { x, y: x <= start.x ? 0 : start.y + (x - start.x) * dy / dx, z: start.z };
}

/** Which place the explorer is standing at. The gate stops being a place once the way is open. */
export function walkZone(spot: WalkSpot, state: RescueState): WalkZone | null {
  const step = phaseOf(state), low = spot.y < .6;
  if (low && Math.abs(spot.x - walkCourse.scale.x) <= 1.6 && spot.z <= 1.1) return 'scale';
  if (step < 2 && low && spot.x >= walkCourse.gateX - 2 && spot.x <= walkCourse.gateX - .4 && Math.abs(spot.z) <= 1.4) return 'gate';
  if (step === 2) {
    if (state.delivered && spot.y >= .7 && spot.x >= .2) return 'dock';
    if (low) for (const route of ['short', 'long'] as const) {
      const start = coreRoutes[route].start;
      if (Math.hypot(spot.x - (start.x - .95), spot.z - start.z) <= 1.15) return route;
    }
  }
  return null;
}

/** Buttons the place offers now, most useful first (at most two). Empty when this place has nothing to do yet. */
export function walkActions(state: RescueState, zone: WalkZone | null): WalkAction[] {
  const step = phaseOf(state);
  if (zone === 'scale' && step === 0) return state.loaded ? ['reading', 'unload'] : state.zeroed ? ['load'] : ['zero', 'load'];
  if (zone === 'gate' && step === 1) return ['pull-crate', 'push-crate'];
  if ((zone === 'short' || zone === 'long') && step === 2) {
    if (state.delivered) return ['retry'];
    return state.route === zone ? ['push-core'] : [];
  }
  if (zone === 'dock' && rescueReady(state)) return ['dock'];
  return [];
}

/** Walking into a ramp entrance picks that ramp. The long ramp waits until the short one was tried with small force, as in the bench. */
export function routeToSelect(state: RescueState, zone: WalkZone | null): CoreRoute | null {
  if (phaseOf(state) !== 2 || state.delivered || (zone !== 'short' && zone !== 'long') || state.route === zone) return null;
  return zone;
}
export function routeLocked(state: RescueState, route: CoreRoute): boolean { return route === 'long' && needsShortRampTrial(state.runs); }

/** Why the place has no button yet: the earlier step is still open. */
export function walkWaiting(state: RescueState, zone: WalkZone | null): string {
  const step = phaseOf(state);
  if (zone === 'gate' && step === 0) return '먼저 저울에서 코어의 무게를 확인해요.';
  return '';
}

/** How far a held push carries the core: all the way only when the bench model says this force lifts it on this ramp. */
export function pushLimit(route: CoreRoute, force: number): number { return canLift(route, force) ? 1 : stallTravel; }

/** What the walking scene needs to know to draw the crate and the core. `progress` is the crate's or the core's travel. */
export type WalkView = { phase: 0 | 1 | 2; loaded: boolean; route: CoreRoute; progress: number; delivered: boolean };
export function walkView(state: RescueState, progress: number): WalkView {
  return { phase: phaseOf(state), loaded: state.loaded, route: state.route, progress, delivered: state.delivered };
}
export type CorePlace = { at: 'station' | 'scale' | 'route' | 'deck'; point: CorePoint };
/** Where the core is shown. It stays on the scale after weighing until the way is open; afterwards it is on the chosen ramp. */
export function corePlace(view: WalkView): CorePlace {
  if (view.phase < 2 && view.loaded) return { at: 'scale', point: { x: walkCourse.scale.x, y: 1.45, z: walkCourse.scale.z } };
  if (view.phase < 2) return { at: 'station', point: { x: walkCourse.station.x, y: .5, z: walkCourse.station.z } };
  if (view.delivered) return { at: 'deck', point: { x: 2.1, y: walkCourse.deckY, z: coreRoutes[view.route].end.z } };
  return { at: 'route', point: coreRoutePoint(view.route, view.progress) };
}

/** The last safe place for this stretch of the course. */
export function walkCheckpoint(x: number, gateOpen: boolean): WalkSpot {
  if (gateOpen && x >= walkCourse.gateX + .8) return x >= -5.9 ? { x: -5.6, y: 0, z: -.4 } : { x: walkCourse.gateX + 1.2, y: 0, z: 0 };
  if (x >= walkCourse.sillX + .6) return { x: walkCourse.sillX + .9, y: 0, z: 1.6 };
  if (x >= walkCourse.scale.x - 1.6) return { x: walkCourse.scale.x, y: 0, z: .6 };
  return { ...walkCourse.spawn };
}

export const walkActionLabels: Record<WalkAction, string> = {
  zero: '0 맞추기', load: '코어 올리기', unload: '코어 내리기', reading: '숫자 확인', 'push-crate': '밀기', 'pull-crate': '당기기', 'push-core': '밀기', retry: '다시 시험', dock: '코어 끼우기',
};
/** Buttons that work while pressed; the others are single taps. */
export const walkHoldActions: readonly WalkAction[] = ['pull-crate', 'push-core'];
