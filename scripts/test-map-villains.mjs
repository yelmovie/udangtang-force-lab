import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMapVillains} from '../src/map-villains.js';
test('old and malformed saves get five bounded hit counts',()=>{
 assert.deepEqual(normalizeMapVillains(null),[0,0,0,0,0]);
 assert.deepEqual(normalizeMapVillains([3,2,-1,4,'3',1]),[3,2,0,0,0]);
 assert.deepEqual(normalizeMapVillains(JSON.parse(JSON.stringify([0,1,2,3,0]))),[0,1,2,3,0]);
});
