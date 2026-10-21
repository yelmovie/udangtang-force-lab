import type { StageId } from './data';

type VillageReward = {
  name: string;
  changeTitle: string;
  changeDescription: string;
  beforeLines: string[];
  afterLines: string[];
};

const stageOrder: readonly StageId[] = ['cargo', 'balance', 'scale', 'workshop', 'rescue'];

// These town changes are story rewards. The experiments supply observations,
// rather than claiming that a scientific observation itself generates power.
export const villageRewards: Record<StageId, VillageReward> = {
  cargo: {
    name: '물자 배송소',
    changeTitle: '마을에 물자가 도착했어!',
    changeDescription: '배송소의 비상등이 켜지고, 코어 운반에 쓸 수리 재료가 도착했어.',
    beforeLines: [
      '배터리 코어를 다시 끼우려면 운반 준비부터 해야 해. 친구들은 비상등을 켜고 수리 재료를 기다리고 있어.',
      '같은 상자에 부품 수만 바꾸고 같은 힘으로 같은 시간 동안 밀어 보자. 움직인 거리를 비교하면 어떤 짐을 옮기기 쉬운지 알 수 있어.',
    ],
    afterLines: [
      '네 비교 기록을 보고 배송 팀이 수리 재료를 가져왔어! 코어를 옮길 준비가 시작됐네.',
      '같은 힘으로 같은 시간 동안 밀었을 때, 부품이 적은 상자가 더 멀리 움직였지. 비교 기록을 잘 챙겨 두자.',
    ],
  },
  balance: {
    name: '균형 다리',
    changeTitle: '다리 점검을 마쳤어!',
    changeDescription: '블록 비교 기록으로 다리 점검을 마쳤어. 비상 전원으로 켠 표시등이 준비 완료를 알려 줘.',
    beforeLines: [
      '코어를 운반할 길을 준비하고 있어. 다리 점검에 쓸 블록 중 어느 쪽이 무거운지 비교해 줄래?',
      '받침점에서 같은 거리인 두 접시에 블록을 놓고, 어느 쪽이 내려갈지 예상한 뒤 확인해 보자.',
    ],
    afterLines: [
      '블록 비교 기록 덕분에 다리 점검을 마쳤어! 비상 표시등이 준비 완료를 알려 주네.',
      '받침점에서 같은 거리라면 무거운 쪽이 내려가고, 무게가 같으면 수평을 이뤄. 블록을 서로 바꿔 놓아도 확인할 수 있지.',
    ],
  },
  scale: {
    name: '재료 보급소',
    changeTitle: '보급소에 재료가 정리됐어!',
    changeDescription: '보급소의 비상등 아래에 무게를 확인한 재료 꾸러미가 놓였어. 운반 준비가 한 걸음 더 진행됐어.',
    beforeLines: [
      '코어를 옮기기 전에 무게를 정확히 재는 법부터 익히자. 사과 모형과 책 모형 중 어느 쪽이 더 무거울까?',
      '건전지로 작동하는 저울을 쓰자. 빈 저울을 0으로 맞추고 두 모형을 하나씩 재면 숫자로 비교할 수 있어.',
    ],
    afterLines: [
      '보급소 친구들이 네가 잰 재료를 꾸러미로 정리했어!',
      '사과 모형 80 g과 책 모형 70 g을 비교했지. 저울을 쓰니 어느 쪽이 얼마나 무거운지 알 수 있어.',
    ],
  },
  workshop: {
    name: '운반 공방',
    changeTitle: '운반 장치가 준비됐어!',
    changeDescription: '공방의 비상등 아래에 정비를 마친 지레와 빗면이 준비됐어. 이제 코어를 옮길 도구가 생겼어.',
    beforeLines: [
      '배터리 코어는 그냥 들기엔 너무 무거워. 공방 친구들이 코어를 옮길 지레와 빗면을 준비하고 있어.',
      '직접 들 때와 지레·빗면을 쓸 때의 힘을 비교해 보자. 생활 속에서는 어디에 쓰일까?',
    ],
    afterLines: [
      '네 비교 기록으로 코어를 옮길 도구를 골랐어! 이제 중앙 장치에 다시 끼우러 가자.',
      '직접 들 때보다 작은 힘으로 움직이는 도구를 찾았지. 생활 속 도구의 쓰임도 친구에게 이야기해 줘.',
    ],
  },
  rescue: {
    name: '중앙 코어',
    changeTitle: '중앙 코어와 마을에 불이 켜졌어!',
    changeDescription: '네가 옮긴 배터리 코어를 중앙 장치에 다시 끼웠어. 전기가 돌아와 마을의 등이 환하게 켜졌어.',
    beforeLines: [
      '처음에 발견한 배터리 코어를 기억하지? 이제 중앙 장치의 빈자리에 다시 끼울 차례야!',
      '무게를 재고, 상자를 당겨 길을 열고, 같은 힘으로 두 빗면을 비교하자. 코어가 도착하는 길로 옮겨 다시 장착하는 거야.',
    ],
    afterLines: [
      '배터리 코어를 다시 장착하니 마을 전체에 전기가 돌아왔어! 우리가 함께 해냈네!',
      '같은 힘으로 두 길을 비교한 기록이 선택을 도와줬지. 힘을 줄일 수 있는 길에서는 움직이는 거리도 함께 살펴봐야 해.',
    ],
  },
};

export function getVillageStory(completed: readonly StageId[]): {
  next: StageId | null;
  count: number;
  complete: boolean;
  lines: string[];
  changes: StageId[];
} {
  // Read-only derivation also tolerates unvalidated runtime save data.
  const supplied = new Set<unknown>(Array.isArray(completed) ? completed : []);
  const changes = stageOrder.filter(id => supplied.has(id));
  const next = stageOrder.find(id => !supplied.has(id)) ?? null;
  const latest = changes.at(-1);
  const lines = next === null
    ? [
      '분리돼 있던 배터리 코어를 다시 끼워 마을의 전기를 되찾았어. 친구들과 함께 우당탕 마을을 다시 밝혔네!',
      '무게를 재고, 조건을 맞추어 비교하고, 결과를 보고 방법을 골랐지.',
      '다시 실험해도 마을에 남긴 변화는 그대로야. 다른 방법으로도 같은 결과를 만들 수 있는지 찾아보자!',
    ]
    : [
      ...(latest ? [villageRewards[latest].afterLines[1]] : []),
      ...villageRewards[next].beforeLines,
    ];
  return { next, count: changes.length, complete: next === null, lines, changes };
}
