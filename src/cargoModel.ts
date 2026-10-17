import { forceNames } from './rescueModel';

export type ForceLevel = 1 | 2 | 3;
export type OrderResult = 'hit' | 'over' | 'short';
export type CargoOrder = { parts: 1 | 3 | 5; target: readonly [number, number] };

// Qualitative model in rail cells; drag speed and length never change it.
// The medium step is the level 1 "same push": 1, 3 and 5 parts stop at 66, 44 and 22 cells,
// evenly spaced so heavier crates visibly fall short. Each heavier crate needs exactly one
// step more to stop at the same bakery door (44 cells).
const distanceTable: Record<ForceLevel, Record<1 | 3 | 5, number>> = {
  1: { 1: 44, 3: 26, 5: 12 },
  2: { 1: 66, 3: 44, 5: 22 },
  3: { 1: 84, 3: 64, 5: 44 },
};
export const cargoForceNames = forceNames;

/** Bakery oven-repair orders: same yellow zone, heavier crates each time. The nearest miss
 * (22 or 64 cells) stops clearly off the strip. */
export const cargoOrders: readonly CargoOrder[] = [
  { parts: 1, target: [40, 48] },
  { parts: 3, target: [40, 48] },
  { parts: 5, target: [40, 48] },
];

export function cargoDistance(parts: number, force: ForceLevel = 2): number {
  const row = distanceTable[force];
  return row[parts as 1 | 3 | 5] ?? row[5];
}

export function orderResult(order: CargoOrder, distance: number): OrderResult {
  return distance < order.target[0] ? 'short' : distance > order.target[1] ? 'over' : 'hit';
}

export function orderSolution(order: CargoOrder): ForceLevel | null {
  return ([1, 2, 3] as const).find(force => orderResult(order, cargoDistance(order.parts, force)) === 'hit') ?? null;
}

/** Saved orders are the delivering force step per order, in order. Keep only the valid prefix. */
export function retainCargoOrders(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kept: number[] = [];
  for (const [index, order] of cargoOrders.entries()) {
    if (value[index] !== orderSolution(order)) break;
    kept.push(value[index]);
  }
  return kept;
}

export function ordersComplete(orders: readonly number[] | undefined): boolean {
  return !!orders && orders.length >= cargoOrders.length;
}

/** First miss says where to look and to change one step; a second miss on the same order says which way. */
export function orderHint(result: Exclude<OrderResult, 'hit'>, misses: number): string {
  const seen = result === 'over' ? '노란 칸을 지나쳤어요.' : '노란 칸까지 못 갔어요.';
  if (misses < 2) return `${seen} 힘을 한 단계 바꿔 봐요.`;
  return result === 'short' ? `${seen} 무거운 상자는 더 큰 힘이 필요해요.` : `${seen} 힘을 더 작게 골라 봐요.`;
}
