// A short loop around a building, with a pause to show off before turning back.
export function villainPatrol(now, phase=0){
 const t=((now+phase*743)%4100)/4100;
 const walk=t<.36||t>=.56&&t<.89;
 const part=t<.36?t/.36:t<.56?1:t<.89?1-(t-.56)/.33:0;
 const x=(.5-.5*Math.cos(part*Math.PI))*2-1;
 return {x,y:Math.sin(part*Math.PI)*(t<.56?1:-1),direction:t<.56?1:-1,step:walk?'walk':'showoff'};
}
