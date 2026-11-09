export function emphasizeConcept(text: string, terms: string[]): string;
export function bindConceptFocus(host: HTMLElement, video: HTMLVideoElement, options: {steps: {at: number; term: string}[]; terms: string[]; caption: HTMLElement; anchor: HTMLElement; controls?: boolean; reduced?: boolean}): () => void;
