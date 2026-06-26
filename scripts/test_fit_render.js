const { test } = require('node:test');
const assert = require('node:assert');
const R = require('./pingcode_fit_render.js');

const f = (o) => ({ id:'f1', path:'p', kind:'work_item', value:'v', source:'skeleton', status:'guess', ...o });

test('未建 + 非 rejected → 增', () => {
  const plan = R.renderPlan([f({ id:'fa', value:'A' })], {});
  assert.strictEqual(plan.create.length, 1);
  assert.strictEqual(plan.create[0].id, 'fa');
});

test('已建 + 值漂移 → 改(覆盖 confirmed改名 与 corrected)', () => {
  const facts = [f({ id:'fa', value:'矩阵大灯', status:'corrected' })];
  const plan = R.renderPlan(facts, { fa: { id:'OBJ1', value:'ADB', path:'p' } });
  assert.deepStrictEqual(plan.update, [{ factId:'fa', objId:'OBJ1', value:'矩阵大灯' }]);
});

test('已建 + 值未变 → 空操作(幂等)', () => {
  const facts = [f({ id:'fa', value:'同', status:'confirmed' })];
  const plan = R.renderPlan(facts, { fa: { id:'OBJ1', value:'同', path:'p' } });
  assert.deepStrictEqual(plan, { create:[], update:[], delete:[] });
});

test('rejected + 已建 → 删', () => {
  const plan = R.renderPlan([f({ id:'fa', status:'rejected' })], { fa: { id:'OBJ1', value:'v', path:'p' } });
  assert.deepStrictEqual(plan.delete, [{ factId:'fa', objId:'OBJ1' }]);
});

test('rejected + 未建 → 空操作', () => {
  const plan = R.renderPlan([f({ id:'fa', status:'rejected' })], {});
  assert.deepStrictEqual(plan, { create:[], update:[], delete:[] });
});

test('全部已建且无变更 → 空计划(整体幂等)', () => {
  const facts = [f({ id:'a', value:'x' }), f({ id:'b', value:'y' })];
  const m = { a:{ id:'A', value:'x', path:'p' }, b:{ id:'B', value:'y', path:'p' } };
  assert.deepStrictEqual(R.renderPlan(facts, m), { create:[], update:[], delete:[] });
});
