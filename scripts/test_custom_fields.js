const { test } = require('node:test');
const assert = require('node:assert');
const CF = require('./pingcode_custom_fields.js');

const selectField = { key:'biangengleixing', name:'变更类型', type:'select',
  options:[{_id:'opt_a',text:'日常变更'},{_id:'opt_b',text:'临时变更'}] };

test('resolveOptionId: 精确匹配选项文字→_id', () => {
  assert.strictEqual(CF.resolveOptionId(selectField, '日常变更'), 'opt_a');
});
test('resolveOptionId: 近似匹配（包含）兜底', () => {
  assert.strictEqual(CF.resolveOptionId(selectField, '临时'), 'opt_b');
});
test('resolveOptionId: 对不上返回 null', () => {
  assert.strictEqual(CF.resolveOptionId(selectField, '设计变更'), null);
});

test('formatValue select: 文字→_id', () => {
  assert.deepStrictEqual(CF.formatValue(selectField, '日常变更'), { value:'opt_a' });
});
test('formatValue select: 非法选项回落首项并 warn', () => {
  const r = CF.formatValue(selectField, '不存在的');
  assert.strictEqual(r.value, 'opt_a');
  assert.match(r.warn, /fell back/);
});
test('formatValue textarea: 原样字符串', () => {
  assert.deepStrictEqual(CF.formatValue({type:'textarea',name:'原因'}, '因为X'), { value:'因为X' });
});
test('formatValue date: 字符串→unix 秒', () => {
  assert.deepStrictEqual(CF.formatValue({type:'date',name:'评审日期'}, '2026-07-01'),
    { value: Math.floor(Date.parse('2026-07-01')/1000) });
});
test('formatValue member: 显示名经 resolveUser→user_id, 缺省回落 assignee', () => {
  const ctx = { resolveUser: n => n==='孙硕' ? 'u1' : null, assignee:'u_def' };
  assert.deepStrictEqual(CF.formatValue({type:'member',name:'负责人'}, '孙硕', ctx), { value:'u1' });
  const r2 = CF.formatValue({type:'member',name:'负责人'}, '查无此人', ctx);
  assert.strictEqual(r2.value, 'u_def');
});
test('formatValue multi_select: [文字]→[_id]', () => {
  const f = { type:'multi_select', name:'模块', options:[{_id:'m1',text:'A'},{_id:'m2',text:'B'}] };
  assert.deepStrictEqual(CF.formatValue(f, ['A','B']), { value:['m1','m2'] });
});
