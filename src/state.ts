import type { PageId, StageId } from './data';
import { hasFairComparison, retainRescueRuns } from './rescueModel';
import { hasWorkshopComparison, retainWorkshopRuns, type WorkshopState } from './workshopModel';
import { retainLearningRecords, type LearningRecords } from './learningModel';
import { retainInquiryPlans, type InquiryPlans } from './inquiryPlan';
import { retainLifeObservation, type LifeObservation } from './lifeObservation';
import { retainCargoOrders } from './cargoModel';
import { retainSpringReads, type SpringRead } from './scaleModel';

export type CargoRun = { parts: number; action: 'push' | 'pull'; gesture: number; distance: number };
export type BalanceRun = { left: string; right: string; prediction: 'left' | 'right' | 'level'; actual: 'left' | 'right' | 'level' };
export type ScaleRun = { parts: string[]; reading: number; zeroed: boolean };
export type { SpringRead };
export type RescueRun = { route: 'short' | 'long'; force: number; success: boolean };
/** Level 2 request progress for one mission: cleared round indices (0-based) and attempt count. */
export type LevelRecord = { cleared: number[]; attempts: number };
export type LevelStage = 'balance' | 'scale' | 'workshop';
export type LevelRecords = Partial<Record<LevelStage, LevelRecord>>;
const levelStages: LevelStage[] = ['balance', 'scale', 'workshop'];

export function retainLevels(value: unknown): LevelRecords {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>, kept: LevelRecords = {};
  for (const stage of levelStages) {
    const item = raw[stage] as Partial<LevelRecord> | undefined;
    if (!item || typeof item !== 'object') continue;
    const cleared = Array.isArray(item.cleared) ? [...new Set(item.cleared.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 10))].sort((a, b) => a - b) : [];
    const attempts = Number.isInteger(item.attempts) && item.attempts! >= 0 ? Math.min(999, item.attempts!) : 0;
    kept[stage] = { cleared, attempts };
  }
  return kept;
}
export type RescueState = { zeroed: boolean; loaded: boolean; measured: boolean; gate: boolean; route: 'short' | 'long'; force: number; runs: RescueRun[]; delivered: boolean };

export interface SaveData {
  version: 1;
  currentPage: PageId;
  completed: StageId[];
  evidence: Partial<Record<StageId, string>>;
  soundOn: boolean;
  soundVolume?: number;
  /** orders: delivering force step per finished bakery order (level 2); present once the level 1 finding is chosen. */
  cargo: { parts: number; action: 'push' | 'pull'; runs: CargoRun[]; orders?: number[] };
  balance: { left: string | null; right: string | null; prediction: BalanceRun['prediction'] | null; runs: BalanceRun[] };
  /** springReads: optional spring-scale inquiry (zero screw · wait for swing · eye level), one entry per object × eye level. */
  scale: { zeroed: boolean; parts: string[]; runs: ScaleRun[]; springReads?: SpringRead[] };
  workshop: WorkshopState;
  rescue: RescueState;
  abilities?: number[];
  learning?: LearningRecords;
  inquiryPlans?: InquiryPlans;
  lifeObservation?: LifeObservation;
  /** Optional level 2 requests (balance mystery blocks, scale fake part, workshop force budget). */
  levels?: LevelRecords;
  savedAt: number;
}

export const SAVE_KEY = 'udangtang-force-lab-save-v1';
const stageIds: StageId[] = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];
const pageIds: PageId[] = ['title', 'map', ...stageIds, 'complete'];

export function freshSave(): SaveData {
  return {
    version: 1,
    currentPage: 'title',
    completed: [],
    evidence: {},
    inquiryPlans: {},
    soundOn: false,
    soundVolume: 0.3,
    cargo: { parts: 1, action: 'push', runs: [] },
    balance: { left: null, right: null, prediction: null, runs: [] },
    scale: { zeroed: false, parts: [], runs: [] },
    workshop: { direct: false, lever: false, ramp: false, fulcrumSnapped: false, plankSnapped: false, rampSnapped: false, fulcrumPosition: 1, rampLength: 0, trials: [], leverFinding: false, rampFinding: false },
    rescue: { zeroed: false, loaded: false, measured: false, gate: false, route: 'short', force: 1, runs: [], delivered: false },
    savedAt: Date.now(),
  };
}

export function readSave(): SaveData | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return null;
    const item = raw as Partial<SaveData>;
    const fallback = freshSave();
    const completed = Array.isArray(item.completed) ? [...new Set(item.completed.filter((id): id is StageId => stageIds.includes(id)))] : [];
    const evidence: SaveData['evidence'] = {};
    for (const id of completed) if (typeof item.evidence?.[id] === 'string') evidence[id] = item.evidence[id];
    const restored: SaveData = {
      ...fallback,
      currentPage: pageIds.includes(item.currentPage as PageId) ? item.currentPage as PageId : 'map',
      completed,
      evidence,
      soundOn: item.soundOn === true,
      soundVolume: typeof item.soundVolume === 'number' && Number.isFinite(item.soundVolume) ? Math.min(1, Math.max(0, item.soundVolume)) : 0.3,
      cargo: {
        parts: [1, 3, 5].includes(item.cargo?.parts ?? 0) ? item.cargo!.parts : 1,
        action: item.cargo?.action === 'pull' ? 'pull' : 'push',
        runs: Array.isArray(item.cargo?.runs) ? item.cargo.runs.filter((run): run is CargoRun =>
          !!run && [1, 3, 5].includes(run.parts) && ['push', 'pull'].includes(run.action) &&
          Number.isFinite(run.gesture) && Number.isFinite(run.distance) && run.distance >= 0 && run.distance <= 100).slice(-20) : [],
        ...(Array.isArray(item.cargo?.orders) ? { orders: retainCargoOrders(item.cargo.orders) } : {}),
      },
      balance: {
        left: ['A', 'B', 'C'].includes(item.balance?.left ?? '') ? item.balance!.left : null,
        right: ['A', 'B', 'C'].includes(item.balance?.right ?? '') ? item.balance!.right : null,
        prediction: ['left', 'right', 'level'].includes(item.balance?.prediction ?? '') ? item.balance!.prediction : null,
        runs: Array.isArray(item.balance?.runs) ? item.balance.runs.filter((run): run is BalanceRun =>
          !!run && ['A', 'B', 'C'].includes(run.left) && ['A', 'B', 'C'].includes(run.right) &&
          ['left', 'right', 'level'].includes(run.prediction) && ['left', 'right', 'level'].includes(run.actual)).slice(-20) : [],
      },
      scale: {
        zeroed: item.scale?.zeroed === true,
        parts: Array.isArray(item.scale?.parts) ? [...new Set(item.scale.parts.filter((id): id is string => typeof id === 'string' && ['orange', 'teal', 'cream', 'blue', 'green'].includes(id)))] : [],
        runs: Array.isArray(item.scale?.runs) ? item.scale.runs.filter((run): run is ScaleRun =>
          !!run && Array.isArray(run.parts) && run.parts.every(id => typeof id === 'string' && ['orange', 'teal', 'cream', 'blue', 'green'].includes(id)) &&
          Number.isFinite(run.reading) && run.reading >= 0 && run.reading <= 1000 && typeof run.zeroed === 'boolean').slice(-20) : [],
        ...(Array.isArray(item.scale?.springReads) ? { springReads: retainSpringReads(item.scale.springReads) } : {}),
      },
      workshop: {
        direct: item.workshop?.direct === true,
        lever: item.workshop?.lever === true,
        ramp: item.workshop?.ramp === true,
        fulcrumSnapped: item.workshop?.fulcrumSnapped === true,
        plankSnapped: item.workshop?.plankSnapped === true,
        rampSnapped: item.workshop?.rampSnapped === true,
        fulcrumPosition: item.workshop?.fulcrumPosition === 0 || item.workshop?.fulcrumPosition === 2 ? item.workshop.fulcrumPosition : 1,
        rampLength: item.workshop?.rampLength === 1 ? 1 : 0,
        trials: retainWorkshopRuns(item.workshop?.trials),
        leverFinding: item.workshop?.leverFinding === true && hasWorkshopComparison(retainWorkshopRuns(item.workshop?.trials), 'lever'),
        rampFinding: item.workshop?.rampFinding === true && hasWorkshopComparison(retainWorkshopRuns(item.workshop?.trials), 'ramp'),
      },
      abilities: Array.isArray(item.abilities) ? [...new Set(item.abilities.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 5))] : [],
      learning: retainLearningRecords(item.learning),
      inquiryPlans: retainInquiryPlans(item.inquiryPlans),
      lifeObservation: retainLifeObservation(item.lifeObservation),
      levels: retainLevels(item.levels),
      savedAt: Number.isFinite(item.savedAt) ? item.savedAt! : Date.now(),
      rescue: {
        zeroed: item.rescue?.zeroed === true,
        loaded: item.rescue?.loaded === true,
        measured: item.rescue?.measured === true && item.rescue?.zeroed === true,
        gate: item.rescue?.gate === true,
        route: item.rescue?.route === 'long' ? 'long' : 'short',
        force: [1, 2, 3].includes(item.rescue?.force ?? 0) ? item.rescue!.force : 1,
        runs: Array.isArray(item.rescue?.runs) ? retainRescueRuns(item.rescue.runs) : [],
        delivered: item.rescue?.delivered === true && item.rescue?.measured === true && item.rescue?.gate === true,
      },
    };
    const rescue = restored.rescue;
    rescue.delivered = rescue.delivered && rescue.zeroed && rescue.measured && rescue.gate && rescue.runs.some(run => run.route === rescue.route && run.force === rescue.force && run.success);
    // Preserve the original four-stage saves; verify evidence for the newly added mission.
    const earnedRescue = rescue.zeroed && rescue.measured && rescue.gate && hasFairComparison(rescue.runs) && rescue.runs.some(run => run.success);
    if (restored.completed.includes('rescue') && (!earnedRescue || !stageIds.slice(0, 4).every(id => restored.completed.includes(id)))) {
      restored.completed = restored.completed.filter(id => id !== 'rescue');
      delete restored.evidence.rescue;
    }
    if ((stageIds.includes(restored.currentPage as StageId) && !stageIsOpen(restored, restored.currentPage as StageId)) || (restored.currentPage === 'complete' && restored.completed.length !== stageIds.length)) restored.currentPage = 'map';
    return restored;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData): boolean {
  save.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function stageIsOpen(save: SaveData, id: StageId): boolean {
  const index = stageIds.indexOf(id);
  return index === 0 || save.completed.includes(stageIds[index - 1]);
}

export function nextIncomplete(save: SaveData): StageId | 'complete' {
  return stageIds.find(id => !save.completed.includes(id)) ?? 'complete';
}

export function completeStage(save: SaveData, id: StageId, summary: string): boolean {
  if (!save.completed.includes(id)) save.completed.push(id);
  save.evidence[id] = summary;
  save.currentPage = 'map';
  return writeSave(save);
}
