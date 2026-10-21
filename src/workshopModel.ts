export type WorkshopTool = 'lever' | 'ramp';
export type LeverSetting = 0 | 1 | 2;
export type RampSetting = 0 | 1;
export type WorkshopRun = ({ tool: 'lever'; setting: LeverSetting } | { tool: 'ramp'; setting: RampSetting }) & { force: number; distance: number };
export type WorkshopState = {
  direct: boolean; lever: boolean; ramp: boolean;
  fulcrumSnapped: boolean; plankSnapped: boolean; rampSnapped: boolean;
  fulcrumPosition: LeverSetting; rampLength: RampSetting;
  trials: WorkshopRun[]; leverFinding: boolean; rampFinding: boolean;
};
export type WorkshopDesign = { label: string; force: number; distance: number; lift: number; pivot: number; length: number };

// Ideal tools: friction and the tool's own weight are omitted. Force is relative
// to directly lifting the same load (100), never a measurement of finger pressure.
export function getWorkshopDesign(tool: WorkshopTool, setting: number): WorkshopDesign {
  if (tool === 'lever') {
    const index = Math.max(0, Math.min(2, Math.round(setting)));
    const pivot = [1, 0, -1][index];
    const loadArm = 2 - pivot;
    const effortArm = 2 + pivot;
    const lift = 0.45;
    return { label: ['화물 가까이', '판자 가운데', '화물에서 멀리'][index], force: 100 * loadArm / effortArm, distance: lift * effortArm / loadArm, lift, pivot, length: 4 };
  }
  const long = setting >= 1;
  const length = long ? 4.4 : 2.5;
  const lift = 1.4;
  return { label: long ? '길고 완만하게' : '짧고 가파르게', force: 100 * lift / length, distance: length, lift, pivot: 0, length };
}

export function retainWorkshopRuns(value: unknown): WorkshopRun[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, WorkshopRun>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { tool, setting } = item as { tool?: unknown; setting?: unknown };
    if ((tool !== 'lever' && tool !== 'ramp') || typeof setting !== 'number' || !Number.isInteger(setting) || setting < 0 || setting > (tool === 'lever' ? 2 : 1)) continue;
    const design = getWorkshopDesign(tool, setting);
    const run = { tool, setting, force: design.force, distance: design.distance } as WorkshopRun;
    unique.set(`${tool}:${setting}`, run);
  }
  return [...unique.values()];
}

export function hasWorkshopComparison(runs: WorkshopRun[], tool: WorkshopTool): boolean {
  return new Set(runs.filter(run => run.tool === tool).map(run => run.setting)).size >= 2;
}

export function isBestWorkshopDesign(runs: WorkshopRun[], tool: WorkshopTool, setting: number): boolean {
  const compared = runs.filter(run => run.tool === tool);
  return hasWorkshopComparison(runs, tool) && compared.some(run => run.setting === setting && run.force === Math.min(...compared.map(item => item.force)));
}

/** A newly observed improvement needs a fresh student choice, not an inferred choice. */
export function recordWorkshopTrial(state: WorkshopState, tool: WorkshopTool, setting: number): boolean {
  const previous = state.trials.filter(run => run.tool === tool);
  const next = retainWorkshopRuns([...state.trials, { tool, setting }]);
  const observed = next.find(run => run.tool === tool && run.setting === setting);
  if (!observed) return false;
  const finding = tool === 'lever' ? 'leverFinding' : 'rampFinding';
  const needsNewChoice = state[finding] && previous.length > 0 && observed.force < Math.min(...previous.map(run => run.force));
  state.trials = next;
  if (needsNewChoice) state[finding] = false;
  return needsNewChoice;
}

export function canCompleteWorkshop(state: WorkshopState): boolean {
  return state.direct && state.leverFinding && state.rampFinding && hasWorkshopComparison(state.trials, 'lever') && hasWorkshopComparison(state.trials, 'ramp');
}

/** Basic exploration: lift directly, compare two fulcrum positions (one easier than
 * lifting directly) and both ramp lengths. Answer choices remain an optional challenge. */
export function workshopFinishSteps(state: WorkshopState): { direct: boolean; lever: boolean; ramp: boolean } {
  const valid = retainWorkshopRuns(state.trials);
  return {
    direct: state.direct,
    lever: hasWorkshopComparison(valid, 'lever') && valid.some(run => run.tool === 'lever' && run.force < 100),
    ramp: hasWorkshopComparison(valid, 'ramp'),
  };
}

export function canFinishWorkshopExploration(state: WorkshopState): boolean {
  const steps = workshopFinishSteps(state);
  return steps.direct && steps.lever && steps.ramp;
}

export function workshopActivitySteps(state: WorkshopState): {direct:boolean;lever:boolean;ramp:boolean} {
  const runs = retainWorkshopRuns(state.trials);
  return {direct:state.direct, lever:[0,1,2].every(setting => runs.some(run => run.tool === 'lever' && run.setting === setting)), ramp:[0,1].every(setting => runs.some(run => run.tool === 'ramp' && run.setting === setting))};
}
export function workshopExplorationReady(state: WorkshopState): boolean {
  const steps = workshopActivitySteps(state);
  return steps.direct && steps.lever && steps.ramp;
}

/* Level 2 "force budget": 콩이 can only give up to the 작은 힘 step. Heavier cargo
 * multiplies the same qualitative design forces; nothing here is a real unit. */
export type WorkshopL2Tool = WorkshopTool | 'direct';
export type WorkshopL2Record = { cleared: number[]; attempts: number };
export type WorkshopL2Result = { force: number; success: boolean; needCells: number; budgetCells: number; overCells: number; stallAt: number };

export const workshopForcePerCell = 10;
export const workshopBudget = 60;
/** Light 0.8 · normal 1 · heavy 1.6. Only lever-near (53) or the long ramp (51) carry the
 * heavy cargo; the short ramp (90) and anything without a better arm stay over budget. */
export const workshopCargos = [
  { label: '가벼운 화물', weight: .8 },
  { label: '보통 화물', weight: 1 },
  { label: '무거운 화물', weight: 1.6 },
] as const;

export function workshopL2Force(cargo: number, tool: WorkshopL2Tool, setting: number): number {
  const weight = workshopCargos[Math.max(0, Math.min(workshopCargos.length - 1, cargo))].weight;
  return (tool === 'direct' ? 100 : getWorkshopDesign(tool, setting).force) * weight;
}

export function judgeWorkshopL2(cargo: number, tool: WorkshopL2Tool, setting: number): WorkshopL2Result {
  const force = workshopL2Force(cargo, tool, setting);
  const needCells = Math.ceil(force / workshopForcePerCell - 1e-9);
  const budgetCells = workshopBudget / workshopForcePerCell;
  const success = tool !== 'direct' && force <= workshopBudget;
  // Over budget the cargo only twitches: force is not a fuel that carries it part way.
  const stallAt = success ? 1 : .05;
  return { force, success, needCells, budgetCells, overCells: Math.max(0, needCells - budgetCells), stallAt };
}

/** Cargo is delivered in order; the first not yet cleared is the current one. */
export function workshopL2Current(record: WorkshopL2Record | undefined): number {
  const index = workshopCargos.findIndex((_cargo, i) => !record?.cleared.includes(i));
  return index < 0 ? workshopCargos.length : index;
}

export function workshopL2Complete(record: WorkshopL2Record | undefined): boolean {
  return workshopL2Current(record) >= workshopCargos.length;
}

export function applyWorkshopL2Attempt(record: WorkshopL2Record | undefined, cargo: number, success: boolean): WorkshopL2Record {
  const cleared = record?.cleared ?? [];
  return {
    cleared: success && !cleared.includes(cargo) ? [...cleared, cargo].sort((a, b) => a - b) : [...cleared],
    attempts: Math.min(999, (record?.attempts ?? 0) + 1),
  };
}

/** Every two misses on the same cargo the clue gets one step more specific. */
export function workshopL2HintLevel(misses: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.floor(misses / 2))) as 0 | 1 | 2 | 3;
}

/** Where to look → what to change → narrow the range. Never names the exact answer setting. */
export function workshopL2Hint(level: number, tool: WorkshopL2Tool): string {
  if (tool === 'direct') return '콩이 혼자서는 들 수 없어요. 지레나 빗면을 골라 봐요.';
  if (level <= 0) return '설계를 바꿔 다시 해 봐요.';
  if (level === 1) return '힘 막대의 빨간 칸을 보세요. 설계를 바꾸면 빨간 칸이 줄어드는지 살펴봐요.';
  if (level === 2) return tool === 'lever' ? '받침대 위치를 바꿔 보세요. 어느 쪽으로 옮기면 힘이 작아졌나요?' : '빗면 길이를 바꿔 보세요. 어떤 빗면에서 힘이 작았나요?';
  return '앞 화물을 올렸던 설계와 지금 설계를 비교해 봐요. 어느 쪽으로 바꿀 때 빨간 칸이 줄었나요?';
}
