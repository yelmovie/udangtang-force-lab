export type RewardSound = 'whoosh' | 'reveal' | 'epic' | 'slot' | 'complete';
export interface RewardCard { id: string; title: string; stage: string; art: string; thumb?: string }
export interface RewardCardsConfig {
  setName: string;
  cards: RewardCard[];
  theme: { accent: string; accent2: string; glow: string; ink?: string; back?: string };
  particles: string[];
  colors: string[];
  emblem?: string;
  sound?: (name: RewardSound) => void;
  inertRoot?: () => HTMLElement | null;
}
export interface RewardCards {
  slotsHtml(owned: readonly boolean[]): string;
  syncSlots(owned: readonly boolean[], popIndex?: number): void;
  reveal(index: number, origin: { x: number; y: number } | undefined, ownedAfter: readonly boolean[]): Promise<void>;
  openAlbum(): void;
  isBusy(): boolean;
}
export function createRewardCards(config: RewardCardsConfig): RewardCards;
