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
  /** 2022 개정 과학 성취기준 코드(A11). 교사용 「성취기준」 표(info.ts)와 같아야 한다 — scripts/test-curriculum.mjs. */
  standards: readonly string[];
}[] = [
  { id: 'cargo', page: 3, mission: 1, title: '물자 배송소', concept: '밀기·당기기', evidence: '밀고 당긴 기록', restore: '코어를 옮길 준비에 쓸 수리 재료가 도착했어요.', color: '#e58b43', standards: ['4과01-01'] },
  { id: 'balance', page: 5, mission: 2, title: '균형 다리', concept: '수평 잡기', evidence: '무게를 비교한 기록', restore: '코어 운반을 위한 다리 점검을 마쳤어요.', color: '#7eaf67', standards: ['4과01-02'] },
  { id: 'scale', page: 7, mission: 3, title: '재료 보급소', concept: '전자저울', evidence: '저울로 비교한 기록', restore: '코어의 무게를 정확히 잴 준비가 됐어요.', color: '#5b9fb0', standards: ['4과01-03'] },
  { id: 'workshop', page: 9, mission: 4, title: '운반 공방', concept: '지레·빗면', evidence: '도구 활용 설계도', restore: '코어를 옮길 지레와 빗면이 준비됐어요.', color: '#ad86c0', standards: ['4과01-04'] },
  { id: 'rescue', page: 11, mission: 5, title: '중앙 코어', concept: '긴급 운반 작전', evidence: '나의 코어 운반 기록', restore: '배터리 코어를 다시 끼워 마을 전체에 전기가 돌아왔어요!', color: '#d99b35', standards: ['4과01-01', '4과01-03', '4과01-04'] },
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

/** The line on the stage finish popup (moved from main.ts, E2 2026-11-21). */
export const stageFinishLines: Record<StageId, string> = {
  cargo: '빵집 주문을 다 배달했어요. 이제 운반 레일을 고칠 수 있어요!',
  balance: '어느 쪽이 무거운지 수평대로 알아냈어요. 발견을 저장해요!',
  scale: '저울로 무게를 비교했어요. 비교 기록을 저장해요!',
  workshop: '지레와 빗면으로 힘을 줄이는 법을 찾았어요. 생활 속 도구를 찾으러 가요!',
  rescue: '코어가 중앙 장치에 도착했어요. 다시 끼워 마을의 전기를 되찾아요!',
};
