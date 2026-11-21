import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// A11 (2026-11-21): every mission carries its 2022 개정 성취기준 codes as data, and they match the teacher table.
const data = fs.readFileSync('src/data.ts', 'utf8');
const info = fs.readFileSync('src/info.ts', 'utf8');
const curriculum = info.match(/curriculum: `([\s\S]*?)`/)[1].replace(/<[^>]+>/g, '|');
const missions = [['cargo', '물자 배송소'], ['balance', '균형 다리'], ['scale', '재료 보급소'], ['workshop', '운반 공방'], ['rescue', '중앙 코어']];
const codesOf = id => { const m = data.match(new RegExp(`id: '${id}',[^\\n]*standards: \\[([^\\]]*)\\]`)); assert.ok(m, `${id} has standards`); return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]); };
const table = Object.fromEntries([...curriculum.matchAll(/\[(4과01-0\d)\][|\s]*[^|]+[|\s]*([^|]+)/g)].map(m => [m[1], m[2]]));

test('each mission lists at least one achievement standard code in the 4과01-0n form', () => {
  for (const [id] of missions) { const codes = codesOf(id); assert.ok(codes.length >= 1, id); for (const c of codes) assert.match(c, /^4과01-0[1-4]$/); }
});
test('the codes match the teacher curriculum table both ways', () => {
  assert.deepEqual(Object.keys(table).sort(), ['4과01-01', '4과01-02', '4과01-03', '4과01-04']);
  for (const [id, name] of missions) for (const code of codesOf(id)) assert.ok(table[code].includes(name), `${code} lists ${name}`);
  for (const [code, list] of Object.entries(table)) for (const [id, name] of missions) if (list.includes(name)) assert.ok(codesOf(id).includes(code), `${id} has ${code}`);
});
test('every standard of the unit is covered by some mission', () => {
  const all = new Set(missions.flatMap(([id]) => codesOf(id)));
  assert.deepEqual([...all].sort(), ['4과01-01', '4과01-02', '4과01-03', '4과01-04']);
});
