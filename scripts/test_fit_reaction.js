const { test } = require('node:test');
const assert = require('node:assert');
const RX = require('./pingcode_fit_reaction.js');

const FACTS = [
  { id:'f1', path:'需求/软件需求/ADB', value:'ADB分区点亮', status:'guess' },
  { id:'f2', path:'设计/评审',        value:'设计评审',   status:'guess' },
];

test('correct 命中 path → corrected 补丁(带 meeting source)', () => {
  const { patches, pending_review } = RX.reactionToPatches(
    [{ op:'correct', path:'需求/软件需求/ADB', value:'矩阵大灯', raw:'叫矩阵大灯' }], FACTS, '2026-06-25');
  assert.strictEqual(patches.length, 1);
  assert.strictEqual(patches[0].status, 'corrected');
  assert.strictEqual(patches[0].value, '矩阵大灯');
  assert.strictEqual(patches[0].source, 'meeting:2026-06-25');
  assert.strictEqual(pending_review.length, 0);
});

test('correct 未命中 path → 进 pending_review, 不产补丁', () => {
  const { patches, pending_review } = RX.reactionToPatches(
    [{ op:'correct', path:'不存在/X', value:'Y', raw:'某句模糊话' }], FACTS, '2026-06-25');
  assert.strictEqual(patches.length, 0);
  assert.strictEqual(pending_review.length, 1);
  assert.match(pending_review[0].why, /匹配/);
});

test('reject 命中 → rejected 补丁', () => {
  const { patches } = RX.reactionToPatches(
    [{ op:'reject', path:'设计/评审', raw:'评审独立门' }], FACTS, '2026-06-25');
  assert.strictEqual(patches[0].status, 'rejected');
  assert.strictEqual(patches[0].path, '设计/评审');
});

test('add → 新 path confirmed 补丁(无需命中)', () => {
  const { patches } = RX.reactionToPatches(
    [{ op:'add', path:'需求/功能安全/线', value:'功能安全线', kind:'work_item', raw:'少了功能安全' }], FACTS, '2026-06-25');
  assert.strictEqual(patches[0].status, 'confirmed');
  assert.strictEqual(patches[0].path, '需求/功能安全/线');
});

test('confirm 命中 → confirmed 补丁(无 value)', () => {
  const { patches } = RX.reactionToPatches(
    [{ op:'confirm', path:'需求/软件需求/ADB', raw:'对就这样' }], FACTS, '2026-06-25');
  assert.strictEqual(patches[0].status, 'confirmed');
  assert.strictEqual(patches[0].value, undefined);
});
