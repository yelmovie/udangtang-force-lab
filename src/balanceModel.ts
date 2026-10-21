export function balanceExplorationReady(runs: readonly {left:string;right:string;actual:string}[]): boolean {
  return [['A','B'],['A','C'],['B','C']].every(([a,b]) => runs.some(run => (run.left === a && run.right === b) || (run.left === b && run.right === a))) && runs.some(run => run.actual === 'level') && runs.some(run => run.actual !== 'level');
}

export type MysteryOutcome = 'left' | 'right' | 'level';
/** One balance comparison: which side went down, or level. */
export type MysteryRecord = { left: string; right: string; actual: MysteryOutcome };
/** Boxes look the same; only the hidden weights differ. Exactly one box is the heaviest. */
export type MysteryRound = { boxes: string[]; weights: Record<string, number> };
export type MysteryVerdict =
  | { result: 'found' }
  | { result: 'ruled-out'; clue: number }
  | { result: 'unknown'; others: string[] };

export const mysteryLabels = ['가', '나', '다', '라'] as const;
// Round 1: one real pillar part among two equal boxes.
// Round 2: an equal pair is mixed in, so a level result also rules out two boxes at once.
const roundWeights: readonly (readonly number[])[] = [[6, 4, 4], [6, 5, 4, 4]];
export const mysteryRoundCount = roundWeights.length;
/** Round 1 is "thrifty" when found with this many balance uses or fewer. */
export const thriftyBudget = 2;

function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same index and seed always give the same hidden arrangement. */
export function mysteryRound(index: number, seed: number): MysteryRound {
  const weights = [...roundWeights[index]];
  const next = random(seed * 31 + index);
  for (let i = weights.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [weights[i], weights[j]] = [weights[j], weights[i]];
  }
  const boxes: string[] = mysteryLabels.slice(0, weights.length);
  return { boxes, weights: Object.fromEntries(boxes.map((id, i) => [id, weights[i]])) };
}

export function weigh(round: MysteryRound, left: string, right: string): MysteryOutcome {
  const l = round.weights[left], r = round.weights[right];
  return l > r ? 'left' : l < r ? 'right' : 'level';
}

/** Why a box cannot be the one heaviest box: it went up once, or balanced with another box. */
function ruledOutBy(record: MysteryRecord, id: string): boolean {
  if (record.left !== id && record.right !== id) return false;
  if (record.actual === 'level') return true;
  return (record.actual === 'left' ? record.right : record.left) === id;
}

/** Boxes the records have not ruled out yet. Only direct records matter: a box that never
 * went up and never balanced cannot be shown lighter than anything. */
export function candidates(boxes: readonly string[], records: readonly MysteryRecord[]): string[] {
  return boxes.filter(id => !records.some(record => ruledOutBy(record, id)));
}

export function mysteryComparisonReady(boxes: readonly string[], records: readonly MysteryRecord[]): boolean {
  const compared = new Set(records.flatMap(record => [record.left, record.right]));
  return boxes.length > 0 && boxes.every(id => compared.has(id)) && candidates(boxes, records).length === 1;
}

/** A pick is found only when the records prove it, so a lucky guess still needs evidence. */
export function judgePick(boxes: readonly string[], records: readonly MysteryRecord[], pick: string): MysteryVerdict {
  const clue = records.findIndex(record => ruledOutBy(record, pick));
  if (clue >= 0) return { result: 'ruled-out', clue };
  const others = candidates(boxes, records).filter(id => id !== pick);
  return others.length ? { result: 'unknown', others } : { result: 'found' };
}

/** Record card text with the heavier box first: "가 > 나" or "나 = 다". */
export function relationText(record: MysteryRecord): string {
  if (record.actual === 'level') return `${record.left} = ${record.right}`;
  const [heavy, light] = record.actual === 'left' ? [record.left, record.right] : [record.right, record.left];
  return `${heavy} > ${light}`;
}

/** No penalty words: point at the record card, or at the boxes not compared yet. */
export function pickHint(verdict: Exclude<MysteryVerdict, { result: 'found' }>, pick: string, records: readonly MysteryRecord[]): string {
  if (verdict.result === 'ruled-out') {
    const record = records[verdict.clue];
    return record.actual === 'level'
      ? `기록 카드 「${relationText(record)}」를 봐요. 무게가 같은 두 상자에는 진짜 부품이 없어요. 진짜 부품은 하나뿐이에요.`
      : `기록 카드 「${relationText(record)}」를 봐요. ${pick} 상자보다 무거운 상자가 있어요.`;
  }
  if (!records.length) return '아직 비교 기록이 없어요. 수평대에 상자 두 개를 올려 비교해 봐요.';
  return `${pick} 상자가 ${verdict.others.join('·')} 상자보다 무거운지 아직 몰라요. 수평대로 비교해 봐요.`;
}

export function isThrifty(roundIndex: number, uses: number): boolean {
  return roundIndex === 0 && uses <= thriftyBudget;
}

export function nextMysteryRound(record: { cleared: readonly number[] } | undefined): number {
  for (let i = 0; i < mysteryRoundCount; i++) if (!record?.cleared.includes(i)) return i;
  return mysteryRoundCount;
}

export function mysteryComplete(record: { cleared: readonly number[] } | undefined): boolean {
  return nextMysteryRound(record) >= mysteryRoundCount;
}
