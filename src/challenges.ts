import type { SaveData } from './state';

export type Challenge = { id: string; label: string; hint: string; done: boolean };

/** Optional badges reward comparing or extending evidence, never speed or tap count. */
export function challenges(save: SaveData): Challenge[] {
  const cargoTrend = (['push', 'pull'] as const).some(action => [1,3,5].every(parts => save.cargo.runs.some(run => run.parts === parts && run.action === action)));
  const swappedBalance = save.balance.runs.some(a => a.actual !== 'level' && save.balance.runs.some(b => b.left === a.right && b.right === a.left && b.actual !== a.actual));
  const equalBalance = save.balance.runs.some(run => run.actual === 'level');
  const targetCombos = new Set(save.scale.runs.filter(run => run.zeroed && run.reading === 150).map(run => [...run.parts].sort().join(',')));
  const leverSettings = new Set(save.workshop.trials.filter(run => run.tool === 'lever').map(run => run.setting));
  const rampSettings = new Set(save.workshop.trials.filter(run => run.tool === 'ramp').map(run => run.setting));
  const fairAt = (force: number) => save.rescue.runs.some(run => run.force === force && run.route === 'short' && !run.success) && save.rescue.runs.some(run => run.force === force && run.route === 'long' && run.success);
  return [
    { id: 'cargo', label: '세 상자의 움직임을 공정하게 비교', hint: '1·3·5개를 같은 방향·힘·시간으로 움직여 보자', done: cargoTrend },
    { id: 'balance', label: '자리를 바꿔도 무거운 쪽 찾기', hint: '같은 두 블록의 자리를 바꿔 보고 수평인 짝도 찾아보자', done: swappedBalance && equalBalance },
    { id: 'scale', label: '다른 재료로 같은 150 g 만들기', hint: '영점을 맞추고 서로 다른 조합 두 개로 150 g을 재 보자', done: targetCombos.size >= 2 },
    { id: 'workshop', label: '도구의 힘 변화를 끝까지 비교', hint: '지레의 세 위치와 빗면의 두 길에서 힘을 비교해 보자', done: leverSettings.size >= 3 && rampSettings.size >= 2 && save.workshop.leverFinding && save.workshop.rampFinding },
    { id: 'rescue', label: '힘을 바꿔도 길 차이 확인', hint: '작은 힘과 중간 힘으로 각각 두 길을 공정하게 비교해 보자', done: fairAt(1) && fairAt(2) },
  ];
}

export const abilityStatements = [
  '같은 바닥에서 같은 힘·시간으로 밀면 가벼운 상자가 더 멀리 간다고 설명할 수 있어요',
  '수평대로 어느 쪽이 더 무거운지 알아낼 수 있어요',
  '저울의 영점을 맞추고 무게를 정확히 잴 수 있어요',
  '지레·빗면에서 힘이 덜 드는 설계를 고를 수 있어요',
  '무거운 수레를 옮길 길을 힘 비교로 설명할 수 있어요',
];
