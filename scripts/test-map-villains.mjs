import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMapVillains,mountMapVillains} from '../src/map-villains.js';
test('old and malformed saves get five bounded hit counts',()=>{
 assert.deepEqual(normalizeMapVillains(null),[0,0,0,0,0]);
 assert.deepEqual(normalizeMapVillains([3,2,-1,4,'3',1]),[3,2,0,0,0]);
 assert.deepEqual(normalizeMapVillains(JSON.parse(JSON.stringify([0,1,2,3,0]))),[0,1,2,3,0]);
});
test('only supplied completed places appear; blocking, repeated clicks and teardown are safe',()=>{
 const pending=new Map();let next=0;
 const old={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,matchMedia:globalThis.matchMedia};
 globalThis.setTimeout=fn=>{pending.set(++next,fn);return next;};globalThis.clearTimeout=id=>pending.delete(id);globalThis.matchMedia=()=>({matches:false});
 class El{constructor(){this.children=[];this.handlers={};this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){}};this.attrs={};}append(e){this.children.push(e);e.parent=this;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,fn){this.handlers[k]=fn;}querySelector(){return this.caption??=new El();}remove(){this.parent.children=this.parent.children.filter(e=>e!==this);}focus(){doc.activeElement=this;}}
 const doc={createElement:()=>new El(),activeElement:null};const host=new El();host.ownerDocument=doc;
 let blocked=true,hits=0,sounds=0;const progress=[0,0,0,0,3];
 try{const ui=mountMapVillains(host,{progress,points:[{id:0,name:'시험 구역',x:50,y:50},{id:4,name:'완료 구역',x:80,y:80}],blocked:()=>blocked,onHit:()=>hits++,sound:()=>sounds++});
 const layer=host.children[0],button=layer.children.find(e=>e.dataset.villain==='0');assert.ok(button);assert.equal(layer.children.filter(e=>e.dataset.villain).length,1);
 const click=()=>button.handlers.click({stopPropagation(){}}),flush=()=>{for(const [id,fn]of [...pending]){pending.delete(id);fn();}};
 click();assert.equal(hits,0);blocked=false;click();click();assert.equal(hits,1);assert.equal(progress[0],1);flush();click();flush();click();assert.equal(progress[0],3);assert.equal(sounds,3);flush();assert.equal(layer.children.includes(button),false);ui.destroy();assert.equal(host.children.length,0);assert.equal(pending.size,0);
 }finally{Object.assign(globalThis,old);}
});
