const { test } = require('node:test');
const assert = require('node:assert');
const { planToPreview } = require('./pingcode_revise.js');

test('preview 汇总 增/改/删 计数与明细', () => {
  const plan = {
    create: [{ value:'功能安全线' }],
    update: [{ value:'矩阵大灯' }],
    delete: [{ objId:'OBJ2' }],
  };
  const out = planToPreview(plan);
  assert.match(out, /增 1 \/ 改 1 \/ 删 1/);
  assert.match(out, /功能安全线/);
  assert.match(out, /矩阵大灯/);
});

test('空计划 preview 标注幂等', () => {
  const out = planToPreview({ create:[], update:[], delete:[] });
  assert.match(out, /增 0 \/ 改 0 \/ 删 0/);
});
