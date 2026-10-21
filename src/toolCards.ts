import { balanceObjects, stages, type StageId } from './data';
import type { SaveData } from './state';
import { firstFairComparison, forceNames } from './rescueModel';
import { getWorkshopDesign, retainWorkshopRuns } from './workshopModel';

/** One card per mission, given when its level 1 is completed. */
export type ToolCardInfo = { stage: StageId; name: string; idea: string };
export type ToolCard = ToolCardInfo & { earned: boolean; mission: string; record: string | null };

export const toolCardInfo: Record<StageId, ToolCardInfo> = {
  cargo: { stage: 'cargo', name: '밀기 장갑', idea: '같은 바닥에서 같은 힘으로 같은 시간 동안 밀면 가벼운 상자가 더 멀리 움직여요.' },
  balance: { stage: 'balance', name: '수평대', idea: '받침점에서 같은 거리에 놓으면 무거운 쪽이 내려가고, 무게가 같으면 수평이 돼요.' },
  scale: { stage: 'scale', name: '전자저울', idea: '0을 맞춘 저울로 재면 무게를 숫자로 비교할 수 있어요.' },
  workshop: { stage: 'workshop', name: '지레와 빗면 판', idea: '받침점을 물체 가까이 둔 지레나 길고 완만한 빗면은 작은 힘으로 올려요. 대신 움직이는 거리는 길어져요.' },
  rescue: { stage: 'rescue', name: '코어 운반 기록', idea: '같은 물체를 같은 높이까지 올리면, 짧고 가파른 빗면보다 길고 완만한 빗면에서 작은 힘이 들어요.' },
};

const objectName = (id: string) => balanceObjects.find(item => item.id === id)?.label ?? id;
const scaleNames: Record<string, string> = { orange: '사과 모형', blue: '책 모형' };
const routeShort = { short: '짧고 가파른 빗면', long: '길고 완만한 빗면' };

/** The student's own record line, read from saved runs. null hides the line. */
export function toolCardRecord(save: SaveData, stage: StageId): string | null {
  if (stage === 'cargo') {
    const distance = (parts: number) => [...save.cargo.runs].reverse().find(run => run.parts === parts)?.distance;
    const items = [1, 5].flatMap(parts => { const d = distance(parts); return d === undefined ? [] : [`${parts}개 상자 ${d}칸`]; });
    return items.length ? items.join(', ') : null;
  }
  if (stage === 'balance') {
    const runs = [...save.balance.runs].reverse();
    const tilted = runs.find(run => run.actual !== 'level' && run.left !== run.right);
    const level = runs.find(run => run.actual === 'level' && run.left !== run.right);
    const items: string[] = [];
    if (tilted) {
      const heavy = tilted.actual === 'left' ? tilted.left : tilted.right, light = tilted.actual === 'left' ? tilted.right : tilted.left;
      items.push(`${objectName(light)}과 ${objectName(heavy)}: ${objectName(heavy)} 쪽이 내려감`);
    }
    if (level) items.push(`${objectName(level.left)}과 ${objectName(level.right)}: 수평`);
    return items.length ? items.join(' · ') : null;
  }
  if (stage === 'scale') {
    const reading = (id: string) => [...save.scale.runs].reverse().find(run => run.zeroed && run.parts.length === 1 && run.parts[0] === id)?.reading;
    const items = ['orange', 'blue'].flatMap(id => { const g = reading(id); return g === undefined ? [] : [`${scaleNames[id]} ${g} g`]; });
    return items.length ? items.join(', ') : null;
  }
  if (stage === 'workshop') {
    const easier = retainWorkshopRuns(save.workshop.trials).filter(run => run.force < 100);
    if (!easier.length) return null;
    const best = easier.reduce((a, b) => (b.force < a.force ? b : a));
    const tool = best.tool === 'lever' ? '지레' : '빗면';
    return `직접 들 때보다 힘이 가장 적게 든 설계: ${tool} '${getWorkshopDesign(best.tool, best.setting).label}'`;
  }
  const found = firstFairComparison(save.rescue.runs);
  return found ? `${forceNames[found.force - 1]}으로 ${routeShort[found.stopped.route]}은 멈춤, ${routeShort[found.arrived.route]}은 도착` : null;
}

/** All five cards in mission order. Never stored: always recomputed from the save. */
export function toolCards(save: SaveData): ToolCard[] {
  return stages.map(stage => {
    const earned = save.completed.includes(stage.id);
    return { ...toolCardInfo[stage.id], earned, mission: stage.title, record: earned ? toolCardRecord(save, stage.id) : null };
  });
}

export function earnedToolCards(save: SaveData): ToolCard[] {
  return toolCards(save).filter(card => card.earned);
}

/** Lines for the downloadable research record. */
export function toolCardsText(save: SaveData): string {
  const earned = earnedToolCards(save);
  return `내 도구 카드 ${earned.length}/5\n` + (earned.length ? earned.map(card => `- ${card.name}${card.record ? `: ${card.record}` : ''}`).join('\n') : '- (아직 받은 카드가 없어요)');
}
