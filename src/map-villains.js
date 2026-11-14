// Retain old map combat counts when reading existing saves.
export const normalizeMapVillains = value => Array.from({length:5},(_,i)=>Number.isInteger(value?.[i])&&value[i]>=0&&value[i]<=3?value[i]:0);

// A victory is awarded only after every learned area has actually been defended.
const areas=['cargo','balance','scale','workshop','rescue'];
export const defeatedMapVillains = save => areas.filter((id,i)=>save.completed.includes(id)&&save.mapVillains[i]===3).length;
export const canPlayMapFinale = save => defeatedMapVillains(save)===areas.length;
