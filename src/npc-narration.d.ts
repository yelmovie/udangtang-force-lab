export function installNpcNarration(options: {selector: string; src: string; text: string; enabled?: () => boolean; volume?: () => number; hold?: () => (() => void)}): () => void;
