import test from 'node:test';
import assert from 'node:assert/strict';
import {canPlayMapFinale,defeatedMapVillains,normalizeMapVillains} from '../src/map-villains.js';
test('old and malformed saves get five bounded hit counts',()=>{
 assert.deepEqual(normalizeMapVillains(null),[0,0,0,0,0]);
 assert.deepEqual(normalizeMapVillains([3,2,-1,4,'3',1]),[3,2,0,0,0]);
 assert.deepEqual(normalizeMapVillains(JSON.parse(JSON.stringify([0,1,2,3,0]))),[0,1,2,3,0]);
});

test('the map finale is locked until all five corresponding experiments and villains are complete',()=>{
 const ids=['cargo','balance','scale','workshop','rescue'];
 assert.equal(defeatedMapVillains({completed:ids.slice(0,4),mapVillains:[3,3,3,3,3]}),4);
 assert.equal(canPlayMapFinale({completed:ids.slice(0,4),mapVillains:[3,3,3,3,3]}),false);
 assert.equal(canPlayMapFinale({completed:ids,mapVillains:[3,3,3,3,2]}),false);
 assert.equal(canPlayMapFinale({completed:ids,mapVillains:[3,3,3,3,3]}),true);
});
