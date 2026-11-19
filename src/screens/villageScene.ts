import type { AppContext } from '../appTypes';
import type { StageId } from '../data';
import type { MapSound } from '../sound';
import type { getVillageStory } from '../villageStory';
import type { Encounter } from '../villageEncounters';
import type { RequestCard, RequestStage } from '../requestBoard';
import type { AssetMeta, Building, Direction, Npc, Point, VillageMap, createVillageNavigation } from './villageMap';

export type VillageOptions = { adminUnlocked: boolean; returnedFrom?: StageId; newlyCompleted?: StageId; onFinale: () => void };
export type Talk = { name: string; role: string; text: string; portrait: string; voice?: string; done: string };
type Facing = 1 | -1;

/** Everything the map screen's parts share. `mountVillage` builds it once; the draw, encounter, camera and
 * action parts read and change these fields at call time (never copy a changing field into a local). */
export interface VillageScene {
  // Fixed for one visit to the map.
  root: HTMLElement; context: AppContext; options: VillageOptions; story: ReturnType<typeof getVillageStory>; reduced: MediaQueryList;
  events: AbortSignal;
  shell: HTMLElement; frame: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; labels: HTMLElement; lights: SVGSVGElement;
  hint: HTMLElement; reveal: HTMLElement; action: HTMLButtonElement; panButton: HTMLButtonElement;
  dialog: HTMLDialogElement; portrait: HTMLElement; nextLine: HTMLButtonElement; board: HTMLDialogElement;
  encounterHud: HTMLElement; attack: HTMLButtonElement; encounterPips: HTMLElement; encounterText: HTMLElement;
  cards: RequestCard[]; solved: RequestStage[]; arriving: RequestStage[]; boardAvailable: boolean; revealStage?: StageId;
  /** Reveal timeline (seconds): windows light up, then light runs along the road to the core. */
  flowStart: number; flowTime: number; revealEnd: number; arrivalStart: number; arrivalTime: number;

  // The loaded world.
  alive: boolean; map: VillageMap | null; navigation: ReturnType<typeof createVillageNavigation> | null;
  images: Map<string, HTMLImageElement>; metadata: Map<string, AssetMeta>;
  // Walking.
  actor: Point & { direction: Direction }; dog: Point & { direction: Direction };
  path: Point[]; trail: Point[]; destination: Point | null; guided: Building | undefined; entering: boolean;
  last: number; walkingTime: number; dogTime: number; revealTime: number; arrivalShown: boolean;
  nearestBuilding: Building | undefined; nearestNpc: Npc | undefined; nearestClient: RequestStage | undefined; nearBoard: boolean;
  // Camera.
  camera: Point; panView: Point | null; overview: boolean; frameWidth: number; frameHeight: number;
  // Villains.
  encounters: Encounter[]; nearbyEnemy: Encounter | undefined; attackTarget: Encounter | undefined; encounterClock: number;
  lastHitAt: number; studentHurt: number; dogHurt: number; studentAttackFacing: Facing; studentHurtFacing: Facing; dogHurtFacing: Facing;
  finaleAt: number; focusBeforeAttack: HTMLElement | null;

  // Shared helpers (mountVillage).
  /** Hit sounds and the reward card wait on these timers; cleared when the map closes. */
  cueTimers: Set<number>;
  paused(): boolean; clearInput(): void; assetURL(file: string): string; cueLater(name: MapSound, delay: number): void;
  /** voiceDelay: ms before the line is spoken (the bubble text shows at once). */
  villainSay(id: StageId, index: number, text: string, voiceDelay?: number): void; syncAttackDock(): boolean;
  // villageDraw.ts
  draw(moving?: boolean, dogMoving?: boolean): void; npcHeight(): number; clientFilter(stage: RequestStage): string; visibleClients(): RequestStage[];
  // villageEncounter.ts
  hitCount(enemy: Encounter): number; updateEncounters(now: number): void; clearOfVillageResidents(point: Point): boolean;
  // villageCamera.ts
  follow(snap?: boolean): void; resize(): void; resumeFollow(): void;
  // villageActions.ts
  stopRoute(): void; goTo(target: Point, name?: string, building?: Building): void; updateNearby(): void; restHint(): string;
  openBoard(): void; openClient(stage: RequestStage): void; closeDialogue(): void; interact(): void; enterBuilding(building: Building): boolean;
}
