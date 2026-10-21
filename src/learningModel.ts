import { balanceObjects, scaleParts, type StageId } from './data';
import { getWorkshopDesign } from './workshopModel';
import type { SaveData } from './state';
import { scaleComparison } from './scaleModel';

export type LearningAnswer = { first: string; chosen: string; tries: number };
export type LearningRecord = { signature: string; answers: LearningAnswer[]; completed: boolean };
export type LearningRecords = Partial<Record<StageId, LearningRecord>>;
export type EvidenceCard = { title: string; detail: string; pair?: [string, string]; tilt?: 'left' | 'right' | 'level'; bars?: { label: string; value: number; maximum: number }[] };
export type LearningQuestion = {
  id: string; prompt: string; pair?: [string, string]; choices: { id: string; text: string }[];
  correct: string; hint: string; explanation: string;
  /** Why a wrong choice is wrong, shown before the hint; never names the answer. */
  why?: Record<string, string>;
};
export type LearningTask = { stage: StageId; cards: EvidenceCard[]; questions: LearningQuestion[]; talk: string; signature: string };
const choices = (...items: [string, string][]) => items.map(([id, text]) => ({ id, text }));
const directionChoices = choices(['left', '왼쪽이 내려가요'], ['level', '수평이에요'], ['right', '오른쪽이 내려가요']);
const names: Record<string, string> = { orange: '사과', teal: '너트', cream: '지우개', blue: '책', green: '돌' };
const blockName = (id: string) => balanceObjects.find(object => object.id === id)?.label ?? id;

/** Questions use the child's observations; they never award understanding from a completion count. */
export function learningTask(save: SaveData, stage: StageId): LearningTask | null {
  const cards: EvidenceCard[] = [];
  const questions: LearningQuestion[] = [];
  let talk = '';
  if (stage === 'cargo') {
    const light = save.cargo.runs.find(r => r.parts === 1 && save.cargo.runs.some(h => h.parts === 5 && h.action === r.action));
    const heavy = light && save.cargo.runs.find(r => r.parts === 5 && r.action === light.action);
    if (!light || !heavy) return null;
    const max = Math.max(light.distance, heavy.distance, 1);
    for (const run of [light, heavy]) cards.push({ title: `부품 ${run.parts}개 상자`, detail: `${run.action === 'push' ? '밀기' : '당기기'} · 같은 힘 · 같은 시간`, bars: [{ label: `${run.distance}칸 이동`, value: run.distance, maximum: max }] });
    questions.push({ id: 'fair', prompt: '무게에 따른 움직임을 비교하려고 같게 둔 것은?', choices: choices(['force-time', '힘과 움직이는 시간'], ['weight', '담은 부품 수'], ['distance', '움직인 거리']), correct: 'force-time', hint: '두 기록에서 같은 것과 달라진 것을 찾아봐요.', explanation: '힘과 시간은 같게 두고 부품 수를 바꾸어 움직인 거리를 비교했어요.' });
    questions.push({ id: 'effort', prompt: '두 상자를 같은 시간 동안 밀어 같은 거리까지 옮기려면 어느 쪽에 더 큰 힘이 필요할까?', choices: choices(['heavy', '부품 5개 상자'], ['light', '부품 1개 상자'], ['same', '항상 힘이 같아요']), correct: 'heavy', why: { same: '두 상자가 같은 힘에 움직인 거리가 달랐어요.' }, hint: '같은 힘으로 움직였을 때 어느 상자가 더 짧게 움직였는지 봐요.', explanation: '내 실험 모형에서는 무거운 상자가 같은 힘으로 더 짧게 갔어요. 같은 시간 동안 밀어 같은 거리까지 보내려면 더 큰 힘이 필요해요.' });
    talk = '무거운 상자를 밀거나 당길 때 필요한 힘을 친구와 이야기해봐요.';
  } else if (stage === 'balance') {
    const tilted = save.balance.runs.find(r => r.actual !== 'level');
    const level = save.balance.runs.find(r => r.actual === 'level');
    if (!tilted || !level) return null;
    const heavy = tilted.actual === 'left' ? tilted.left : tilted.right;
    const afterSwap = tilted.actual === 'left' ? 'right' : 'left';
    const afterSide = afterSwap === 'left' ? '왼쪽' : '오른쪽';
    cards.push({ title: '기울어진 기록', pair: [tilted.left, tilted.right], tilt: tilted.actual, detail: `${blockName(heavy)} 쪽이 내려갔어요.` }, { title: '수평이 된 기록', pair: [level.left, level.right], tilt: 'level', detail: '두 물체의 무게가 같았어요.' });
    questions.push({ id: 'swap', prompt: `그림 속 ${blockName(tilted.left)}과 ${blockName(tilted.right)}의 자리를 서로 바꾸면?`, pair: [tilted.left, tilted.right], choices: directionChoices, correct: afterSwap, hint: `자리를 바꾼 뒤 더 무거운 ${blockName(heavy)}이 어느 쪽으로 옮겨질지 생각해 봐요.`, explanation: `자리를 바꾸면 ${blockName(heavy)}이 ${afterSide}으로 옮겨져서 ${afterSide}이 내려가요. 물체의 무게는 그대로예요.` });
    questions.push({ id: 'equal', prompt: `${blockName(level.left)}과 ${blockName(level.right)}을 놓았을 때 수평이었던 까닭은?`, pair: [level.left, level.right], choices: choices(['equal', '두 물체의 무게가 같아요'], ['look', '큰 물체가 반드시 무거워요'], ['side', '왼쪽에 놓인 물체가 무거워요']), correct: 'equal', why: { look: '크기가 커도 가벼운 물체가 있어요. 크기가 아니라 수평대가 어떻게 되었는지 봐요.', side: '놓은 쪽이 왼쪽인지 오른쪽인지는 무게와 상관없어요.' }, hint: '수평이었던 기록을 다시 봐요.', explanation: '받침점에서 같은 거리의 자리에 놓아 수평이면 두 물체의 무게가 같아요.' });
    talk = '무거운 물체의 자리를 바꾸면 내려가는 쪽도 바뀔까요?';
  } else if (stage === 'scale') {
    const compared = scaleComparison(save.scale.runs);
    if (compared.length === 2) {
      for (const run of compared) cards.push({ title: `${names[run.parts[0]]} 모형`, detail: `빈 저울을 0으로 맞춘 뒤 측정: ${run.reading} g` });
      questions.push({ id: 'need-scale', prompt: '두 모형의 무게를 정확히 비교하는 데 도움이 된 것은?', choices: choices(['scale', '저울로 재어 나온 숫자'], ['size', '그림에 보이는 크기'], ['color', '모형의 색깔']), correct: 'scale', why: { size: '그림에서 커 보여도 더 무겁다고 할 수 없어요.', color: '색깔은 무게를 알려 주지 않아요.' }, hint: '내가 기록한 두 숫자는 어디에서 얻었나요?', explanation: '겉모습으로 헷갈려도 저울의 측정값으로 정확히 비교할 수 있어요.' });
      questions.push({ id: 'heavier', prompt: '내 측정 기록에서 더 무거운 모형은?', choices: choices(['apple', '80 g인 사과 모형'], ['book', '70 g인 책 모형'], ['same', '두 모형의 무게가 같아요']), correct: 'apple', hint: '같은 g 단위로 기록된 두 숫자를 비교해요.', explanation: '80 g인 사과 모형이 70 g인 책 모형보다 10 g 더 무거워요.' });
      talk = '눈으로 볼 때와 저울로 잴 때 무엇이 달랐는지 이야기해요.';
    } else {
    const target = save.scale.runs.find(r => r.zeroed && r.reading === 150);
    if (!target) return null;
    const extra = scaleParts.find(p => p.weight === 25)!;
    cards.push({ title: '내가 영점을 맞추고 잰 꾸러미', detail: `${target.parts.map(id => `${names[id]} 모형`).join(' + ')} = ${target.reading} g` }, { title: '새 문제에서 알려 준 무게', detail: `${names[extra.id]} 모형 25 g` });
    questions.push({ id: 'zero', prompt: '다른 빈 저울에 12 g이 보여요. 재료를 재기 전에 먼저 할 일은?', choices: choices(['empty-zero', '아무것도 없는 저울을 0 g으로 맞춰요'], ['loaded-zero', '재료를 올려놓고 0을 눌러요'], ['ignore', '그대로 재료를 올려요']), correct: 'empty-zero', why: { 'loaded-zero': '재료를 올린 채 0을 누르면 재료 무게까지 지워져요.', ignore: '빈 저울의 12 g이 재료 무게에 더해져요.' }, hint: '내 실험에서 빈 저울의 숫자를 먼저 확인한 이유를 떠올려봐요.', explanation: '빈 저울을 0 g으로 맞춰야 올린 재료의 무게를 정확히 읽을 수 있어요.' });
    questions.push({ id: 'add', prompt: '내 150 g 꾸러미에 25 g 모형을 하나 더 올리면?', choices: choices(['175', '175 g'], ['150', '150 g'], ['125', '125 g']), correct: '175', hint: '150 g에 새 모형의 25 g을 더해봐요.', explanation: '150 g + 25 g = 175 g이에요. 모형을 더하면 전체 무게도 늘어나요.' });
    talk = '재료가 올라간 채로 0을 누르면 왜 재료의 무게를 읽기 어려울까요?';
    }
  } else if (stage === 'workshop') {
    const pair = (['ramp', 'lever'] as const).map(tool => save.workshop.trials.filter(r => r.tool === tool)).find(runs => runs.length >= 2);
    if (!pair) return null;
    const sorted = [...pair].sort((a, b) => a.force - b.force);
    const best = sorted[0], other = sorted.at(-1)!;
    const forceMax = Math.max(best.force, other.force), distanceMax = Math.max(best.distance, other.distance);
    for (const r of [best, other]) cards.push({ title: `내 ${r.tool === 'lever' ? '지레' : '빗면'} · ${getWorkshopDesign(r.tool, r.setting).label}`, detail: '같은 화물 · 같은 도착 높이', bars: [{ label: '필요한 힘', value: r.force, maximum: forceMax }, { label: r.tool === 'lever' ? '손잡이가 움직인 길' : '화물이 움직인 길', value: r.distance, maximum: distanceMax }] });
    questions.push({ id: 'design', prompt: '작은 힘으로 옮기려면 내 두 기록 중 어떤 설계를 고를까요?', choices: choices(['best', getWorkshopDesign(best.tool, best.setting).label], ['other', getWorkshopDesign(other.tool, other.setting).label], ['same', '두 설계의 힘이 같아요']), correct: 'best', hint: '같은 화물과 높이에서 힘 막대를 비교해봐요.', explanation: `${getWorkshopDesign(best.tool, best.setting).label}에서 더 작은 힘이 필요했어요.` });
    questions.push({ id: 'daily-tool', prompt: '무거운 책 수레를 높은 턱 위로 올리려고 해요. 어떤 도구를 쓰면 좋을까요?', choices: choices(['ramp', '완만한 경사판(빗면)'], ['scale', '무게를 재는 저울'], ['rope', '눈금이 그려진 줄자']), correct: 'ramp', hint: '내가 시험한 두 도구 중 바퀴 달린 물체가 따라 올라갈 수 있는 길은 무엇일까요?', explanation: '경사판은 물체를 높은 곳까지 올릴 때 쓰는 빗면이에요. 일상에서 쓰이는 다른 빗면도 찾아봐요.' });
    talk = '집이나 학교에서 지레 또는 빗면을 찾아 친구에게 어떻게 쓰는지 이야기해봐요.';
  } else {
    const failed = save.rescue.runs.find(r => !r.success && save.rescue.runs.some(s => s.success && s.force === r.force && s.route !== r.route));
    const success = failed && save.rescue.runs.find(r => r.success && r.force === failed.force && r.route !== failed.route);
    if (!failed || !success) return null;
    const prior = save.workshop.trials.filter(r => r.tool === 'ramp');
    const usedPrior = new Set(prior.map(r => r.setting)).size >= 2;
    if (usedPrior) for (const r of prior) cards.push({ title: `앞서 모은 내 공방 기록 · ${getWorkshopDesign('ramp', r.setting).label}`, detail: '같은 화물·높이에서 비교한 빗면', bars: [{ label: '필요한 힘', value: r.force, maximum: Math.max(...prior.map(v => v.force)) }] });
    cards.push({ title: `내 코어 운반 · 같은 ${['작은 힘', '중간 힘', '큰 힘'][failed.force - 1]}`, detail: `${failed.route === 'long' ? '긴 길' : '짧은 길'}에서 멈춤 → ${success.route === 'long' ? '긴 길' : '짧은 길'}에서 도착` });
    questions.push({ id: 'evidence', prompt: '힘이 덜 드는 길을 설명할 때 근거가 되는 기록은?', choices: choices(['comparison', usedPrior ? '내 공방·코어의 빗면 비교' : '같은 힘으로 두 길을 비교한 기록'], ['color', '코어와 건물의 색깔'], ['count', '실험 버튼을 누른 횟수']), correct: 'comparison', hint: '어떤 기록이 길을 바꾸었을 때 필요한 힘과 도착 결과를 보여주나요?', explanation: '같은 조건의 실제 비교 기록을 보고 길을 선택할 수 있어요.' });
    questions.push({ id: 'books', prompt: '도서관 책 수레를 같은 높이로 올려요. 내 실험처럼 작은 힘으로 옮기려면?', choices: choices(['long', '길고 완만한 길을 만들어요'], ['short', '짧고 가파른 길을 만들어요'], ['height', '길이와 높이를 모두 바꿔 비교해요']), correct: 'long', hint: '내 코어가 도착한 길과 공방에서 힘을 비교한 기록을 떠올려봐요.', explanation: '같은 높이까지 가는 긴 빗면에서는 작은 힘으로 옮길 수 있어요. 대신 이동하는 길은 길어져요.' });
    talk = '어떤 내 실험 기록을 근거로 책 수레의 길을 골랐는지 친구에게 설명해봐요.';
  }
  const stageIndex = ['cargo', 'balance', 'scale', 'workshop', 'rescue'].indexOf(stage);
  questions.forEach((q, index) => {
    const correct = q.choices.find(c => c.id === q.correct)!;
    const ordered = q.choices.filter(c => c.id !== q.correct);
    ordered.splice((stageIndex * 2 + index + 1) % 3, 0, correct);
    q.choices = ordered;
  });
  return { stage, cards, questions, talk, signature: JSON.stringify({ stage, cards, questions: questions.map(q => [q.id, q.correct]) }) };
}

export function retainLearningRecords(value: unknown): LearningRecords {
  if (!value || typeof value !== 'object') return {};
  const result: LearningRecords = {};
  for (const stage of ['cargo', 'balance', 'scale', 'workshop', 'rescue'] as StageId[]) {
    const raw = (value as LearningRecords)[stage];
    if (!raw || typeof raw.signature !== 'string' || raw.signature.length > 6000 || !Array.isArray(raw.answers)) continue;
    const answers = raw.answers.slice(0, 2).filter(a => a && typeof a.first === 'string' && a.first.length <= 32 && typeof a.chosen === 'string' && a.chosen.length <= 32 && Number.isInteger(a.tries) && a.tries > 0 && a.tries <= 100).map(a => ({ first: a.first, chosen: a.chosen, tries: a.tries }));
    result[stage] = { signature: raw.signature, answers, completed: raw.completed === true && answers.length === 2 };
  }
  return result;
}

export function learningRecordComplete(task: LearningTask, record: LearningRecord | undefined): boolean {
  return !!record && record.signature === task.signature && record.answers.length === task.questions.length && task.questions.every((q, i) => record.answers[i]?.chosen === q.correct);
}

export function learningSummary(task: LearningTask, record: LearningRecord): string {
  return task.questions.map((q, i) => {
    const a = record.answers[i];
    const label = (id: string) => q.choices.find(c => c.id === id)?.text ?? '';
    return `${q.prompt} → ${label(a.chosen)}${a.first !== a.chosen ? ` (첫 선택: ${label(a.first)} → 다시 선택: ${label(a.chosen)}, ${a.tries}회 시도)` : ''}`;
  }).join(' / ');
}
