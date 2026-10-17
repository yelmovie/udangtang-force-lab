import type { PageId, StageId } from './data';
import type { SaveData } from './state';

export interface AppContext {
  save: SaveData;
  commit: () => void;
  navigate: (page: PageId) => void;
  finish: (stage: StageId, summary: string) => void;
  toast: (message: string) => void;
  sound: (frequency?: number) => void;
}

export type ScreenMount = (root: HTMLElement, context: AppContext) => (() => void) | void;
