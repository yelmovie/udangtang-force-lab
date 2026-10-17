import { scaleParts } from './data';
import type { LevelRecord, ScaleRun } from './state';

// Two individual measurements establish a comparison, not an arithmetic target.
export const comparisonParts = ['orange', 'blue'] as const;
export function scaleComparison(runs: ScaleRun[]): ScaleRun[] {
  return comparisonParts.flatMap(id => {
    const run = [...runs].reverse().find(r => r.zeroed && r.parts.length === 1 && r.parts[0] === id && r.reading === scaleParts.find(p => p.id === id)!.weight);
    return run ? [run] : [];
  });
}
export function canCompleteScale(state: { zeroed: boolean; runs: ScaleRun[] }): boolean {
  return state.zeroed && scaleComparison(state.runs).length === 2;
}
export function recordScaleRun(runs: ScaleRun[], run: ScaleRun): ScaleRun[] {
  const key = (r: ScaleRun) => `${r.zeroed}:${[...r.parts].sort().join(',')}`;
  const next = [...runs.filter(r => key(r) !== key(run)), run];
  const required = scaleComparison(next);
  return [...required, ...next.filter(r => !required.includes(r)).slice(-(20 - required.length))];
}

// Level 2 request "가짜 부품 가려내기": identical-looking parts, one weighs a little different.
// Only the scale numbers reveal it; the empty scale adds 15 g until it is zeroed (same rule as level 1).
export const emptyScaleReading = 15;
export type FakeRound = { count: number; real: number; fake: number };
export const fakeRounds: readonly FakeRound[] = [
  { count: 4, real: 50, fake: 47 },
  { count: 5, real: 40, fake: 42 },
];
export const fakeLabels = ['가', '나', '다', '라', '마'] as const;
export type FakePick = 'found' | 'real' | 'unmeasured';

/** Same seed and round always hide the fake in the same slot; positions differ between rounds. */
export function fakeSlot(round: number, seed: number): number {
  let x = (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 13)) >>> 0) % fakeRounds[round].count;
}
export function fakeLayout(round: number, seed: number): number[] {
  const { count, real, fake } = fakeRounds[round], slot = fakeSlot(round, seed);
  return Array.from({ length: count }, (_, i) => i === slot ? fake : real);
}
export function fakeReading(round: number, seed: number, slot: number, zeroed: boolean): number {
  return fakeLayout(round, seed)[slot] + (zeroed ? 0 : emptyScaleReading);
}
/** Judgement uses scale measurements only: a part that was never weighed cannot be accused. */
export function judgeFakePick(round: number, seed: number, picked: number, measured: readonly number[]): FakePick {
  if (!measured.includes(picked)) return 'unmeasured';
  return picked === fakeSlot(round, seed) ? 'found' : 'real';
}
export function nextFakeRound(record?: LevelRecord): number {
  const index = fakeRounds.findIndex((_, i) => !record?.cleared.includes(i));
  return index < 0 ? fakeRounds.length : index;
}
export function fakeRequestComplete(record?: LevelRecord): boolean {
  return !!record && fakeRounds.every((_, i) => record.cleared.includes(i));
}
/** Every judged pick counts as an attempt; an unmeasured pick is not judged. */
export function recordFakePick(record: LevelRecord, round: number, result: FakePick): LevelRecord {
  if (result === 'unmeasured') return record;
  const cleared = result === 'found' ? [...new Set([...record.cleared, round])].sort((a, b) => a - b) : record.cleared;
  return { cleared, attempts: Math.min(999, record.attempts + 1) };
}
/** First miss says where to look; later misses say what to compare. Never a penalty. */
export function fakeHint(misses: number, zeroed: boolean): string {
  const hint = misses < 2
    ? '저울 화면의 숫자를 봐요. 부품을 하나씩 올려 모두 재 봐요.'
    : '같은 숫자가 여러 번 나왔지요? 그 숫자와 다른 하나가 가짜예요.';
  return zeroed ? hint : `${hint} 빈 저울을 0으로 맞추면 부품 무게만 보여요.`;
}
export function fakeSummary(record: LevelRecord): string {
  return `보급소 의뢰에서는 겉모습이 똑같은 부품 ${fakeRounds.map(r => r.count).join('개, ')}개 중 무게가 조금 다른 가짜를 저울 숫자로 가려냈어요(판정 ${record.attempts}번).`;
}

// Optional inquiry "용수철저울 바르게 읽기": zero screw → hang one object → wait for the swing → read at eye level.
// The scale is read in whole grams; marks grow downward, so an eye above the pointer reads a larger number.
export type EyeLevel = 'above' | 'level' | 'below';
export type SpringRead = { object: string; eye: EyeLevel; value: number; zeroed: boolean };
export const springObjects = ['orange', 'blue'] as const;
export const springEyeLabels: Record<EyeLevel, string> = { above: '위에서', level: '정면에서', below: '아래에서' };
export const springParallax: Record<EyeLevel, number> = { above: 5, level: 0, below: -5 };
export const springScrewStep = 5;
/** Empty scale before the zero screw is turned: the pointer rests two steps below 0. */
export const springStartOffset = 10;
export function turnSpringScrew(offset: number, direction: -1 | 1): number {
  return Math.max(-10, Math.min(15, offset + direction * springScrewStep));
}
export function springReading(object: string, eye: EyeLevel, offset: number): number {
  const weight = scaleParts.find(p => p.id === object)?.weight ?? 0;
  return Math.max(0, weight + offset + springParallax[eye]);
}
export function recordSpringRead(reads: SpringRead[], read: SpringRead): SpringRead[] {
  const key = (r: SpringRead) => `${r.object}:${r.eye}:${r.zeroed}`;
  return [...reads.filter(r => key(r) !== key(read)), read].slice(-12);
}
/** The inquiry is done once one object has been read at eye level on a zeroed scale. */
export function springDone(reads: readonly SpringRead[] | undefined): boolean {
  return !!reads?.some(r => r.eye === 'level' && r.zeroed);
}
/** A reading from above or below is kept as a comparison, never marked wrong. */
export function springHint(reads: readonly SpringRead[], read: SpringRead): string {
  const level = reads.find(r => r.object === read.object && r.eye === 'level' && r.zeroed === read.zeroed);
  if (read.eye !== 'level') return level ? `${springEyeLabels[read.eye]} ${read.value} g, 정면에서 ${level.value} g. 눈높이가 다르면 숫자가 달라 보여요.` : `${springEyeLabels[read.eye]} 읽으니 ${read.value} g이에요. 정면에서 다시 읽어 볼까?`;
  const other = reads.find(r => r.object === read.object && r.eye !== 'level' && r.zeroed === read.zeroed);
  if (!read.zeroed) return `정면에서 ${read.value} g. 빈 저울이 0이 아니라 숫자가 더해져 있어요. 영점 나사를 돌려요.`;
  return other ? `정면에서 ${read.value} g. ${springEyeLabels[other.eye]} 읽은 ${other.value} g과 달라요. 눈금은 정면에서 읽어야 해요.` : `정면에서 ${read.value} g이에요. 위나 아래에서도 읽어 비교해 봐요.`;
}
export function springSummary(reads: readonly SpringRead[] | undefined): string {
  if (!springDone(reads)) return '';
  const compared = reads!.some(r => r.eye !== 'level');
  return `용수철저울은 영점 나사를 맞추고 흔들림이 멈춘 뒤 정면에서 눈금을 읽었어요.${compared ? ' 위나 아래에서 읽은 숫자는 정면과 달랐어요.' : ''}`;
}
export function retainSpringReads(value: unknown): SpringRead[] {
  if (!Array.isArray(value)) return [];
  const objects: readonly string[] = springObjects;
  return value.filter((r): r is SpringRead => !!r && typeof r === 'object' && objects.includes((r as SpringRead).object) && (r as SpringRead).eye in springParallax &&
    Number.isInteger((r as SpringRead).value) && (r as SpringRead).value >= 0 && (r as SpringRead).value <= 200 && typeof (r as SpringRead).zeroed === 'boolean').slice(-12);
}
