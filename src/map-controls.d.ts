export type MapPadDirection='up'|'down'|'left'|'right';
export interface MapControlPoint {x:number;y:number}
export const MAP_VECTORS:Record<MapPadDirection,MapControlPoint>;
export function mapKeyDirection(event:Pick<KeyboardEvent,'key'|'code'>):MapPadDirection|undefined;
export function bindDirectionPad(root:HTMLElement,selector:string,directionOf:(button:HTMLElement)=>MapPadDirection,options:{press:(direction:MapPadDirection)=>void;release?:(direction:MapPadDirection)=>void;cancel?:(direction:MapPadDirection)=>void;tap?:(direction:MapPadDirection)=>void;blocked?:()=>boolean;signal?:AbortSignal;repeatMs?:number}):{clear:()=>void;destroy:()=>void};
export function assistMapStep(start:MapControlPoint,delta:MapControlPoint,canStand:(point:MapControlPoint)=>boolean,maxStep?:number):MapControlPoint;
export function stepAlongRoad(start:MapControlPoint,input:MapControlPoint,amount:number,segments:MapControlPoint[][],turnWindow?:number):MapControlPoint;
