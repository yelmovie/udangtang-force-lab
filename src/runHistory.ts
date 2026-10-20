/**
 * Bounded run history that never drops the evidence a mission needs: the first run of each kind
 * (e.g. 1 vs 5 parts, or one block pair) is kept, and the rest of the room goes to the latest runs.
 * Order stays chronological. Free play beyond the limit only forgets repeated, later runs.
 */
export function keepEvidence<T>(runs: T[], key: (run: T) => string, limit = 20): T[] {
  if (runs.length <= limit) return runs;
  const firsts: T[] = [];
  const seen = new Set<string>();
  for (const run of runs) { const k = key(run); if (!seen.has(k)) { seen.add(k); firsts.push(run); } }
  const kept = new Set(firsts.slice(0, limit - 4));
  for (const run of runs.filter(r => !kept.has(r)).slice(-(limit - kept.size))) kept.add(run);
  return runs.filter(run => kept.has(run));
}
export const cargoRunKey = (run: { parts: number; action: string }) => `${run.parts}:${run.action}`;
export const balanceRunKey = (run: { left: string; right: string }) => `${run.left}:${run.right}`;
