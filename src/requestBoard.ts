import type { SaveData } from './state';
import { cargoExplorationReady, cargoForceNames, cargoOrders, ordersComplete } from './cargoModel';
import { balanceExplorationReady, mysteryComplete, mysteryRoundCount } from './balanceModel';
import { scaleExplorationReady, fakeRequestComplete, fakeRounds } from './scaleModel';
import { workshopExplorationReady, workshopCargos, workshopL2Complete } from './workshopModel';

export type RequestStage = 'cargo' | 'balance' | 'scale' | 'workshop';
/** locked: the mission's level 1 is not done yet · open: the request can be played · solved: level 2 finished. */
export type RequestStatus = 'locked' | 'open' | 'solved';
export type RequestPose = 'wave' | 'think' | 'point' | 'guide' | 'baker' | 'inspector' | 'clerk' | 'crafter';
export type VillageRequest = {
  client: string;
  /** One line on the board, in the client's own words. */
  quote: string;
  /** Lit shop sign once the client is back (village restoration step 2). */
  sign: string;
  /** Portrait under npc/: the client's own drawing (hue 0), or a doctor pose tinted by `hue` as a fallback. */
  pose: RequestPose;
  hue: number;
};

export const requestStages: readonly RequestStage[] = ['cargo', 'balance', 'scale', 'workshop'];

export const villageRequests: Record<RequestStage, VillageRequest> = {
  cargo: { client: '빵집 주인', quote: '오븐이 고장 났어요! 수리 부품 상자를 가게 문 앞 노란 칸에 딱 멈춰 줄래요?', sign: '빵집 배달', pose: 'baker', hue: 0 },
  balance: { client: '다리 점검원', quote: '똑같이 생긴 상자 중에 진짜 무거운 기둥 부품이 섞였어요. 찾아 주세요!', sign: '점검 완료', pose: 'inspector', hue: 0 },
  scale: { client: '보급소 직원', quote: '부품 하나가 가짜래요. 눈으로는 모르겠어요.', sign: '부품 검사', pose: 'clerk', hue: 0 },
  workshop: { client: '공방 친구', quote: '콩이 힘으로는 이 화물을 못 들어요. 장치를 바꿔 볼까요?', sign: '공방 영업', pose: 'crafter', hue: 0 },
};

/** Level 2 finished, read from the same records the mission screens save. */
export function requestSolved(save: SaveData, stage: RequestStage): boolean {
  if (stage === 'cargo') return ordersComplete(save.cargo?.orders);
  if (stage === 'balance') return mysteryComplete(save.levels?.balance);
  if (stage === 'scale') return fakeRequestComplete(save.levels?.scale);
  return workshopL2Complete(save.levels?.workshop);
}

/** Level 1 done: all basic activities are recorded, or a previously completed mission is revisited. */
function levelOneDone(save: SaveData, stage: RequestStage): boolean {
  if (save.completed.includes(stage)) return true;
  if (stage === 'cargo') return Array.isArray(save.cargo?.orders) && cargoExplorationReady(save.cargo.runs);
  if (stage === 'balance') {
    const runs = save.balance?.runs ?? [];
    return balanceExplorationReady(runs);
  }
  if (stage === 'scale') return !!save.scale && scaleExplorationReady(save.scale);
  return !!save.workshop && workshopExplorationReady(save.workshop);
}

export function requestStatus(save: SaveData, stage: RequestStage): RequestStatus {
  return requestSolved(save, stage) ? 'solved' : levelOneDone(save, stage) ? 'open' : 'locked';
}

export type RequestCard = VillageRequest & { stage: RequestStage; status: RequestStatus; statusText: string };

/** The four board cards. */
export function requestBoard(save: SaveData): RequestCard[] {
  return requestStages.map(stage => {
    const status = requestStatus(save, stage);
    const statusText = status === 'solved' ? '해결했어요 ✓' : status === 'locked' ? '실험 1단계를 마치면 열려요' : '도와줄 수 있어요';
    return { ...villageRequests[stage], stage, status, statusText };
  });
}

export function solvedRequests(save: SaveData): RequestStage[] {
  return requestStages.filter(stage => requestSolved(save, stage));
}

/** Requests solved since the last village visit. Without an earlier visit nothing counts as new. */
export function newlySolved(before: readonly RequestStage[] | undefined, after: readonly RequestStage[]): RequestStage[] {
  return before ? after.filter(stage => !before.includes(stage)) : [];
}

/** The client's thank-you, naming what the student actually did in the request. */
export function requestThanks(save: SaveData, stage: RequestStage): string {
  if (stage === 'cargo') {
    const orders = save.cargo?.orders ?? [];
    const index = Math.max(0, Math.min(orders.length, cargoOrders.length) - 1);
    const force = cargoForceNames[(orders[index] ?? 3) - 1] ?? cargoForceNames[2];
    return `고마워요! 부품 ${cargoOrders[index].parts}개 상자를 ${force}으로 딱 멈춰 줬어요. 덕분에 오븐을 고쳐서 빵을 다시 구워요.`;
  }
  if (stage === 'balance') return `고마워요! 수평대로 비교해서 똑같이 생긴 상자 속 무거운 기둥 부품을 ${mysteryRoundCount}번 모두 찾아 줬어요. 이제 다리를 튼튼하게 고칠 수 있어요.`;
  if (stage === 'scale') return `고마워요! 저울로 재서 ${fakeRounds.map(round => `${round.fake} g`).join(', ')}짜리 가짜 부품을 가려내 줬어요. 눈으로는 정말 몰랐거든요.`;
  return `고마워요! 콩이의 작은 힘으로 ${workshopCargos.map(cargo => cargo.label).join(', ')}을 모두 올려 줬어요. 장치를 바꾸니 되더라고요.`;
}
