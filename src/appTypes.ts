import type { PageId, StageId } from './data';
import type { SaveData } from './state';
import type { MapSound } from './sound';

export interface AppContext {
  save: SaveData;
  commit: () => void;
  navigate: (page: PageId) => void;
  finish: (stage: StageId, summary: string) => void;
  toast: (message: string) => void;
  sound: (frequency?: number) => void;
  /** Named map-fight effect; follows the same sound switch and volume as `sound`. */
  cue: (name: MapSound) => void;
}

export type ScreenMount = (root: HTMLElement, context: AppContext) => (() => void) | void;
