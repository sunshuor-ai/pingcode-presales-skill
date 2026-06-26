const { test } = require('node:test');
const assert = require('node:assert');
const S = require('./pingcode_fit_store.js');

const skeletonFact = () => ({ id:'f1', path:'需求/软件需求/X', kind:'work_item',
  value:'软件需求示例', source:'skeleton', status:'guess', authority:'PingCode方案 + ASPICE SWE.1' });

test('rankOf: meeting>doc>skeleton', () => {
  assert.ok(S.rankOf('meeting:2026-06-25') > S.rankOf('doc:a.xlsx#1'));
  assert.ok(S.rankOf('doc:a.xlsx#1') > S.rankOf('skeleton'));
});

test('贴皮盖骨架: 文档 confirmed 盖 guess 的值与状态, 保留 authority', () => {
  const store = { facts:[skeletonFact()], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/软件需求/X', value:'ADB分区点亮算法',
    source:'doc:reqs.xlsx#12', status:'confirmed' }]);
  const f = store.facts[0];
  assert.strictEqual(f.value, 'ADB分区点亮算法');
  assert.strictEqual(f.status, 'confirmed');
  assert.strictEqual(f.id, 'f1');               // id 稳定
  assert.match(f.authority, /ASPICE/);          // 出处保留
});

test('会谈 corrected 盖一切', () => {
  const store = { facts:[{ ...skeletonFact(), status:'confirmed', source:'doc:r.xlsx#1', value:'ADB' }], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/软件需求/X', value:'矩阵大灯', source:'meeting:2026-06-25', status:'corrected' }]);
  assert.strictEqual(store.facts[0].value, '矩阵大灯');
  assert.strictEqual(store.facts[0].status, 'corrected');
});

test('低不盖高: 重跑骨架不能把会谈纠正过的打回 guess', () => {
  const store = { facts:[{ ...skeletonFact(), value:'矩阵大灯', source:'meeting:2026-06-25', status:'corrected' }], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/软件需求/X', value:'软件需求示例', source:'skeleton', status:'guess' }]);
  assert.strictEqual(store.facts[0].value, '矩阵大灯');   // 没被打回
  assert.strictEqual(store.facts[0].status, 'corrected');
});

test('confirm 无新值: 只升状态, 保留原值', () => {
  const store = { facts:[skeletonFact()], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/软件需求/X', source:'meeting:2026-06-25', status:'confirmed' }]);
  assert.strictEqual(store.facts[0].value, '软件需求示例');
  assert.strictEqual(store.facts[0].status, 'confirmed');
});

test('新 path: 追加为新 fact 并分配 id', () => {
  const store = { facts:[skeletonFact()], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/功能安全/Y', value:'功能安全线', kind:'work_item',
    source:'meeting:2026-06-25', status:'confirmed' }]);
  assert.strictEqual(store.facts.length, 2);
  assert.ok(store.facts[1].id);                 // 自动分配
});

test('reject: 置 rejected, fact 保留(供渲染删+审计)', () => {
  const store = { facts:[skeletonFact()], pending_review:[] };
  S.applyPatches(store, [{ path:'需求/软件需求/X', source:'meeting:2026-06-25', status:'rejected' }]);
  assert.strictEqual(store.facts[0].status, 'rejected');
  assert.strictEqual(store.facts.length, 1);
});
