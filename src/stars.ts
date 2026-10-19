import type { StageId } from './data';
import type { SaveData } from './state';
import { challenges } from './challenges';
import { ordersComplete } from './cargoModel';
import { mysteryComplete } from './balanceModel';
import { fakeRequestComplete } from './scaleModel';
import { workshopL2Complete } from './workshopModel';
import { hasFairComparison } from './rescueModel';

export type StarSlot = { label: string; done: boolean };
export type StageStars = { earned: number; slots: StarSlot[] };

const stageIds: StageId[] = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];

/** Level 2 request finished, read from the same records the request screens save. */
function requestDone(save: SaveData, stage: Exclude<StageId, 'rescue'>): boolean {
  if (stage === 'cargo') return ordersComplete(save.cargo.orders);
  if (stage === 'balance') return mysteryComplete(save.levels?.balance);
  if (stage === 'scale') return fakeRequestComplete(save.levels?.scale);
  return workshopL2Complete(save.levels?.workshop);
}

/**
 * Up to three stars per mission, always recomputed from saved evidence (never stored,
 * never from speed, tap count or answer accuracy):
 * 1. mission completed, 2. level 2 request finished (the core has no request, so its
 * same-force route comparison counts instead), 3. the mission's challenge.
 */
export function stageStars(save: SaveData, stage: StageId): StageStars {
  const second: StarSlot = stage === 'rescue'
    ? { label: '같은 힘 비교 발견', done: hasFairComparison(save.rescue.runs) }
    : { label: '2단계 의뢰', done: requestDone(save, stage) };
  const slots: StarSlot[] = [
    { label: '미션 완료', done: save.completed.includes(stage) },
    second,
    { label: '도전 과제', done: challenges(save).some(item => item.id === stage && item.done) },
  ];
  return { earned: slots.filter(slot => slot.done).length, slots };
}

export function totalStars(save: SaveData): { earned: number; max: number } {
  let earned = 0, max = 0;
  for (const stage of stageIds) {
    const { slots } = stageStars(save, stage);
    earned += slots.filter(slot => slot.done).length;
    max += slots.length;
  }
  return { earned, max };
}
