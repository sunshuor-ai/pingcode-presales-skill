const { test } = require('node:test');
const assert = require('node:assert');
const { checkCustomFieldFill } = require('./pingcode_check.js');

test('checkCustomFieldFill: 自定义类型工作项里有自定义值的比例', () => {
  const customTypeIds = new Set(['6a282ab4']);          // 工程变更申请
  const customKeys = new Set(['biangengleixing']);       // 该环境自定义字段 key
  const items = [
    { type_id:'6a282ab4', properties:{ biangengleixing:'opt_a', entry_status:null } }, // 已填
    { type_id:'6a282ab4', properties:{ biangengleixing:null } },                         // 未填
    { type_id:'story',     properties:{ risk:null } },                                   // 非自定义类型，不计
  ];
  const r = checkCustomFieldFill(items, customTypeIds, customKeys);
  assert.strictEqual(r.total, 2);
  assert.strictEqual(r.filled, 1);
  assert.strictEqual(r.rate, 0.5);
});
