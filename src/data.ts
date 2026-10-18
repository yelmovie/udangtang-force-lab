export type StageId = 'cargo' | 'balance' | 'scale' | 'workshop' | 'rescue';
export type PageId = 'title' | 'map' | StageId | 'complete';

export const stages: {
  id: StageId;
  page: number;
  mission: number;
  title: string;
  concept: string;
  evidence: string;
  restore: string;
  color: string;
}[] = [
  { id: 'cargo', page: 3, mission: 1, title: '물자 배송소', concept: '밀기·당기기', evidence: '밀고 당긴 기록', restore: '코어를 옮길 준비에 쓸 수리 재료가 도착했어요.', color: '#e58b43' },
  { id: 'balance', page: 5, mission: 2, title: '균형 다리', concept: '수평잡기', evidence: '무게를 비교한 기록', restore: '코어 운반을 위한 다리 점검을 마쳤어요.', color: '#7eaf67' },
  { id: 'scale', page: 7, mission: 3, title: '재료 보급소', concept: '전자저울', evidence: '저울로 비교한 기록', restore: '코어의 무게를 정확히 잴 준비가 됐어요.', color: '#5b9fb0' },
  { id: 'workshop', page: 9, mission: 4, title: '운반 공방', concept: '지레·빗면', evidence: '도구 활용 설계도', restore: '코어를 옮길 지레와 빗면이 준비됐어요.', color: '#ad86c0' },
  { id: 'rescue', page: 11, mission: 5, title: '중앙 코어', concept: '긴급 운반 작전', evidence: '나의 코어 운반 기록', restore: '배터리 코어를 다시 장착해 마을 전체에 전기가 돌아왔어요!', color: '#d99b35' },
];

export const balanceObjects = [
  { id: 'A', label: '나무 블록', weight: 4, color: '#dc9755', image: '/assets/game/balance-wood-v2.webp' },
  { id: 'B', label: '금속 블록', weight: 6, color: '#86aab4', image: '/assets/game/balance-metal-v2.webp' },
  { id: 'C', label: '도자기 블록', weight: 4, color: '#a794c6', image: '/assets/game/balance-ceramic-v2.webp' },
] as const;

export const scaleParts = [
  { id: 'orange', label: '주황 부품', weight: 80, color: '#e58b43' },
  { id: 'teal', label: '청록 부품', weight: 45, color: '#45a5a3' },
  { id: 'cream', label: '크림 부품', weight: 25, color: '#dbc37f' },
  { id: 'blue', label: '파랑 부품', weight: 70, color: '#678ead' },
  { id: 'green', label: '초록 부품', weight: 55, color: '#83aa68' },
] as const;

export const targetWeight = 150;
