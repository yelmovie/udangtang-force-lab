import './reward-cards.css';
import { createRewardCards, type RewardCards, type RewardSound } from './reward-cards.js';
import { stages } from './data';
import type { MapSound } from './sound';

/** One achievement card per map villain, in mission order. The star count rises with the mission number. */
const titles = ['밀고 당기기 배송왕', '수평 잡기 다리 지킴이', '전자저울 측정 탐정', '지레·빗면 발명가', '마을을 밝힌 코어 영웅'];
const sounds: Record<RewardSound, MapSound> = { whoosh: 'cardWhoosh', reveal: 'cardReveal', epic: 'cardEpic', slot: 'cardSlot', complete: 'cardComplete' };
let cue: (name: MapSound) => void = () => {};
/** main.ts hands over its `cue`, so the cards follow the sound switch and volume. */
export function bindRewardSound(play: (name: MapSound) => void) { cue = play; }

// Built on first use: the map's unit tests import this module without a browser.
let instance: RewardCards | undefined;
function rewardCards() {
  const base = `${import.meta.env.BASE_URL}assets/reward-cards/`;
  return instance ??= createRewardCards({
    setName: '힘 실험실 성취 카드',
    cards: stages.map((stage, index) => ({ id: stage.id, title: titles[index], stage: stage.title, art: `${base}card-${index + 1}-${stage.id}.webp`, thumb: `${base}thumb-${index + 1}-${stage.id}.webp` })),
    theme: { accent: '#e58b43', accent2: '#0c686b', glow: '#ffe687', ink: '#123c3d', back: '#0c686b' },
    particles: ['gear', 'star', 'bolt', 'spark'],
    colors: ['#f6b45e', '#73bba2', '#ffe687', '#e58b43', '#ffffff', '#9fd8c6'],
    emblem: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 5h12M21 6v13L11 35a5 5 0 0 0 4 8h18a5 5 0 0 0 4-8L27 19V6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 32h18l4 6-3 5H14l-3-5z" fill="#73bba2"/><circle cx="20" cy="35" r="2" fill="#f6b45e"/><circle cx="28" cy="38" r="2" fill="#f6b45e"/></svg>',
    sound: name => cue(sounds[name]),
    inertRoot: () => document.querySelector<HTMLElement>('#app'),
  });
}

// Cards on their way to a slot stay empty in the header until they land.
const flying = new Set<number>();
type Progress = { completed: readonly string[]; mapVillains: readonly number[] };
/** A card is owned once its area's villain has been driven off (three hits). Nothing extra is saved. */
export const ownedRewardCards = (save: Progress) => stages.map((stage, index) => save.completed.includes(stage.id) && save.mapVillains[index] === 3);
export const rewardSlotsHtml = (save: Progress) => rewardCards().slotsHtml(ownedRewardCards(save).map((owned, index) => owned && !flying.has(index)));
export function revealRewardCard(index: number, origin: { x: number; y: number } | undefined, save: Progress) {
  flying.add(index);
  return rewardCards().reveal(index, origin, ownedRewardCards(save)).finally(() => flying.delete(index));
}
