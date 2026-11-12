export function normalizeMapVillains(value: unknown): number[];
export function mountMapVillains(host: HTMLElement, options: {progress:number[];points:{id:number;x:number;y:number;name:string}[];onHit?: (id:number,hits:number)=>void;blocked?:()=>boolean;sound?:()=>void;tool?:string;color?:string}): {position:(id:number,x:number,y:number)=>void;scale:(scale:number)=>void;destroy:()=>void};
