import type { RescueState, RescueRun } from './state';

export const coreWeight = 180;
/** Too little force: the core only budges this far and stops at once, on every input path (drag, tap, key, 2D, 3D).
 * One small value, so force never looks like fuel that carries the core part way up the ramp. */
export const stallTravel = .08;
export const forceNames = ['작은 힘', '중간 힘', '큰 힘'];
export const routeNames = { short: '짧고 가파른 빗면', long: '길고 완만한 빗면' };
// Same load, height and surface. Qualitative model; these are not measured newtons.
export function canLift(route: RescueRun['route'], force: number): boolean {
  if (!['short', 'long'].includes(route) || ![1, 2, 3].includes(force)) return false;
  return force >= (route === 'short' ? 3 : 1);
}
function validRun(run: RescueRun): boolean {
  return !!run && ['short', 'long'].includes(run.route) && [1, 2, 3].includes(run.force) && run.success === canLift(run.route, run.force);
}
export function hasFairComparison(runs: RescueRun[]): boolean {
  const valid = runs.filter(validRun);
  return valid.some(a => valid.some(b => a.route !== b.route && a.force === b.force && a.success !== b.success));
}
/** Forces at which one route stopped and the other arrived. Only small and medium force can differ. */
export function fairComparisonForces(runs: RescueRun[]): number[] {
  const valid = runs.filter(validRun);
  return [1, 2, 3].filter(force => valid.some(a => a.force === force && valid.some(b => b.force === force && a.route !== b.route && a.success !== b.success)));
}
/** Both routes tried at every force, so the student also sees the difference vanish at big force. */
export function triedEveryForce(runs: RescueRun[]): boolean {
  const valid = runs.filter(validRun);
  return [1, 2, 3].every(force => (['short', 'long'] as const).every(route => valid.some(run => run.force === force && run.route === route)));
}
export type RescueComparison = { force: number; stopped: RescueRun; arrived: RescueRun };
// The first same-force pair with different results. retainRescueRuns keeps this pair, so it stays fixed.
export function firstFairComparison(runs: RescueRun[]): RescueComparison | null {
  const valid = runs.filter(validRun);
  for (let second = 1; second < valid.length; second++) {
    const b = valid[second], a = valid.slice(0, second).find(run => run.route !== b.route && run.force === b.force && run.success !== b.success);
    if (a) return { force: b.force, stopped: a.success ? b : a, arrived: a.success ? a : b };
  }
  return null;
}
const routeLetters = { short: 'A 짧은 빗면', long: 'B 긴 빗면' };
// How to keep the test fair at the selected force, or the discovery once it exists.
// Before the discovery it names the variable to keep (force), never the route that arrives or the force to pick.
export function comparisonHint(runs: RescueRun[], force: number): string {
  const found = firstFairComparison(runs);
  if (found) return `${forceNames[found.force - 1]}에서 ${routeLetters[found.stopped.route]}은 멈추고 ${routeLetters[found.arrived.route]}은 도착했어요.`;
  const name = forceNames[force - 1], here = runs.filter(run => validRun(run) && run.force === force);
  const routes = new Set(here.map(run => run.route));
  if (!routes.size) return `${name}으로 두 길을 모두 시험해야 공정하게 비교할 수 있어요.`;
  if (routes.size === 1) return '힘은 그대로 두고 길만 바꾸면 어떻게 될까요?';
  return `${name}에서는 두 길 모두 ${here.every(run => run.success) ? '도착해서' : '멈춰서'} 차이가 보이지 않아요. 다른 힘으로 다시 비교해 봐요.`;
}
/** After the first discovery: an optional nudge to check the same difference at another force. */
export function secondComparisonHint(runs: RescueRun[]): string {
  return fairComparisonForces(runs).length === 1 ? '다른 힘에서도 같은 차이가 날까요? 비교해 보면 별을 하나 더 받아요.' : '';
}
export function comparisonSummary(runs: RescueRun[]): string {
  const found = firstFairComparison(runs);
  return found ? `${forceNames[found.force - 1]}으로 똑같이 밀었을 때 ${routeNames[found.stopped.route]}에서는 코어가 올라가지 못하고, ${routeNames[found.arrived.route]}에서는 끝까지 도착했어요.` : '';
}
// Keep the first run of each route and force, plus recent trials, without growing the save forever.
// A result depends only on route and force, so those first runs hold every comparison (and the first discovery) the stars read.
export function retainRescueRuns(runs: RescueRun[]): RescueRun[] {
  const valid = runs.filter(validRun);
  if (valid.length <= 20) return valid;
  const keep = new Set(valid.map(run => valid.findIndex(other => other.route === run.route && other.force === run.force)));
  for (let index = valid.length - 1; index >= 0 && keep.size < 20; index--) keep.add(index);
  return valid.filter((_run, index) => keep.has(index));
}
export function rescueReady(state: RescueState): boolean {
  return state.zeroed && state.measured && state.gate && state.delivered && canLift(state.route, state.force) && state.runs.some(run => run.route === state.route && run.force === state.force && run.success) && hasFairComparison(state.runs);
}

/** Start with the short ramp at small force before comparing the longer route. */
export function needsShortRampTrial(runs: RescueRun[]): boolean {
  return !hasFairComparison(runs) && !runs.some(run => validRun(run) && run.route === 'short' && run.force === 1 && !run.success);
}
