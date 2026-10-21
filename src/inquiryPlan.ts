import type { StageId } from './data';
import type { SaveData } from './state';
import { forceNames, hasFairComparison } from './rescueModel';

export type InquiryChoice = { id: string; label: string };
/** `expected` is the choice the experiment supports; `result` says what students actually see. */
export type InquiryPlan = { prompt: string; choices: InquiryChoice[]; observation: string; expected: string; result: string };
export type InquiryPlans = Partial<Record<StageId, string>>;

/** A prediction is kept even when it changes; it is never scored as a failure. */
export const inquiryPlans: Record<StageId, InquiryPlan> = {
  cargo: {
    prompt: '같은 힘으로 같은 시간 동안 밀면 어느 상자가 더 멀리 갈까?',
    choices: [{ id: 'light', label: '부품 1개 상자' }, { id: 'heavy', label: '부품 5개 상자' }, { id: 'same', label: '똑같이 갈 것 같아' }],
    observation: '부품 수만 바꾸고 같은 힘·시간으로 움직인 자국을 비교해 봐.',
    expected: 'light',
    result: '같은 힘으로 같은 시간 동안 밀었더니 부품 1개 상자가 더 멀리 갔어.',
  },
  balance: {
    prompt: '크기가 같은 나무 블록과 금속 블록, 무게도 같을까?',
    choices: [{ id: 'same', label: '무게도 같을 것 같아' }, { id: 'different', label: '무게는 다를 것 같아' }],
    observation: '두 블록을 받침점에서 같은 거리에 놓고 내려가는 쪽을 살펴봐.',
    expected: 'different',
    result: '크기가 같아도 금속 블록 쪽이 내려갔어. 겉모습만으로는 무게를 알 수 없었어.',
  },
  scale: {
    prompt: '사과 모형과 책 모형, 어느 쪽이 더 무거울까?',
    choices: [{ id: 'apple', label: '사과 모형' }, { id: 'book', label: '책 모형' }, { id: 'same', label: '무게가 같을 것 같아' }],
    observation: '빈 저울의 숫자를 먼저 0으로 맞춘 뒤 하나씩 올려 봐.',
    expected: 'apple',
    result: '저울로 재 보니 사과 모형 80 g, 책 모형 70 g이었어. 사과 모형이 10 g 더 무거웠어.',
  },
  workshop: {
    prompt: '받침점 위치나 빗면 길이를 잘 고르면 직접 들 때보다 필요한 힘이 어떻게 될까?',
    choices: [{ id: 'less', label: '힘이 줄어들 것 같아' }, { id: 'same', label: '똑같을 것 같아' }, { id: 'more', label: '힘이 더 들 것 같아' }],
    observation: '같은 화물로 시험해 봐. 지레에서는 받침점만, 빗면에서는 길이만 바꾸고 도착 높이는 그대로 둬.',
    expected: 'less',
    result: '받침점을 화물 가까이 두거나 빗면을 길게 하면 힘이 적게 들었어. 대신 움직인 거리는 길었어.',
  },
  rescue: {
    prompt: '같은 작은 힘으로 밀면 어느 길에서 코어가 끝까지 올라갈까?',
    choices: [{ id: 'long', label: '길고 완만한 길' }, { id: 'short', label: '짧고 가파른 길' }],
    observation: '같은 힘으로 두 길을 모두 시험하고 코어가 도착했는지 확인해 봐.',
    expected: 'long',
    result: '같은 작은 힘으로 밀었더니 짧고 가파른 길에서는 멈추고, 길고 완만한 길에서는 도착했어.',
  },
};

export function planLabel(stage: StageId, choice: string | undefined): string | null {
  return inquiryPlans[stage].choices.find(option => option.id === choice)?.label ?? null;
}

export type PredictionRecap = { predicted: string | null; result: string; matched: boolean | null };

/** Puts the student's first thought next to what their own records showed. */
export function predictionRecap(save: SaveData, stage: StageId): PredictionRecap {
  const plan = inquiryPlans[stage];
  const choice = save.inquiryPlans?.[stage];
  const predicted = planLabel(stage, choice);
  let result = plan.result;
  if (stage === 'cargo') {
    const runs = [...save.cargo.runs].reverse();
    const one = runs.find(run => run.parts === 1 && runs.some(other => other.parts === 5 && other.action === run.action));
    const five = one && runs.find(run => run.parts === 5 && run.action === one.action);
    if (one && five) result = `같은 힘으로 같은 시간 동안 ${one.action === 'push' ? '밀었더니' : '당겼더니'} 부품 1개 상자는 ${one.distance}칸, 5개 상자는 ${five.distance}칸 갔어.`;
  }
  if (stage === 'rescue') {
    const force = [1, 2, 3].find(level => hasFairComparison(save.rescue.runs.filter(run => run.force === level)));
    if (force) result = `${forceNames[force - 1]}으로 밀었더니 짧고 가파른 길에서는 멈추고, 길고 완만한 길에서는 도착했어.`;
  }
  return { predicted, result, matched: predicted ? choice === plan.expected : null };
}

export function predictionVerdict(recap: PredictionRecap): string {
  return recap.matched === null ? '' : recap.matched ? '예상이 맞았어! 실험으로 확인했어.' : '예상과 달랐어! 그래서 직접 실험해 보는 게 중요해.';
}

export function retainInquiryPlans(value: unknown): InquiryPlans {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>, kept: InquiryPlans = {};
  for (const stage of Object.keys(inquiryPlans) as StageId[]) {
    const choice = raw[stage];
    if (typeof choice === 'string' && planLabel(stage, choice)) kept[stage] = choice;
  }
  return kept;
}
