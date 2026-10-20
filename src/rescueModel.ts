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
// What the student should try next at the selected force, or the discovery once it exists.
export function comparisonHint(runs: RescueRun[], force: number): string {
  const found = firstFairComparison(runs);
  if (found) return `${forceNames[found.force - 1]}에서 ${routeLetters[found.stopped.route]}은 멈추고 ${routeLetters[found.arrived.route]}은 도착했어요.`;
  const name = forceNames[force - 1], here = runs.filter(run => validRun(run) && run.force === force);
  const routes = new Set(here.map(run => run.route));
  if (!routes.size) return `${name}으로 A 짧은 빗면과 B 긴 빗면을 하나씩 시험해요.`;
  if (routes.size === 1) return `같은 ${name}으로 ${routeLetters[routes.has('short') ? 'long' : 'short']}도 시험해요.`;
  return here.every(run => run.success) ? `${name}에서는 두 길 모두 도착했어요. 힘을 줄여서 다시 비교해요.` : `${name}에서는 두 길 모두 멈췄어요. 힘을 키워서 다시 비교해요.`;
}
export function comparisonSummary(runs: RescueRun[]): string {
  const found = firstFairComparison(runs);
  return found ? `${forceNames[found.force - 1]}으로 똑같이 밀었을 때 ${routeNames[found.stopped.route]}에서는 코어가 올라가지 못하고, ${routeNames[found.arrived.route]}에서는 끝까지 도착했어요.` : '';
}
// Keep the first discovery as evidence, plus recent trials, without growing the save forever.
export function retainRescueRuns(runs: RescueRun[]): RescueRun[] {
  const valid = runs.filter(validRun);
  if (valid.length <= 20) return valid;
  for (let second = 1; second < valid.length; second++) {
    const first = valid.findIndex((run, index) => index < second && run.route !== valid[second].route && run.force === valid[second].force && run.success !== valid[second].success);
    if (first !== -1) return valid.filter((_run, index) => index === first || index === second || index >= valid.length - 18);
  }
  return valid.slice(-20);
}
export function rescueReady(state: RescueState): boolean {
  return state.zeroed && state.measured && state.gate && state.delivered && canLift(state.route, state.force) && state.runs.some(run => run.route === state.route && run.force === state.force && run.success) && hasFairComparison(state.runs);
}
