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

test('discoverTypeFields: item.properties keys ∩ catalog，剔系统 key', () => {
  const catalog = new Map([
    ['biangengleixing', { name:'变更类型', type:'select', options:[{_id:'opt_a',text:'日常变更'}] }],
    ['fengxiandengji', { name:'风险等级', type:'select', options:[] }],
  ]);
  const item = { properties: { entry_status:null, operation_time:123, biangengleixing:null } };
  const fields = CF.discoverTypeFields(item, catalog);
  assert.deepStrictEqual(fields, [{ key:'biangengleixing', name:'变更类型', type:'select', options:[{_id:'opt_a',text:'日常变更'}] }]);
});

test('buildPropertiesPatch: 按字段名解析→key:value，跳过不适用字段并 warn', () => {
  const typeFields = [{ key:'biangengleixing', name:'变更类型', type:'select', options:[{_id:'opt_a',text:'日常变更'}] }];
  const emitted = { '变更类型':'日常变更', '不存在字段':'X' };
  const { props, warnings } = CF.buildPropertiesPatch(typeFields, emitted, {});
  assert.deepStrictEqual(props, { biangengleixing:'opt_a' });
  assert.strictEqual(warnings.length, 1);
  assert.match(warnings[0], /not applicable/);
});

test('buildPropertiesPatch: 非法选项产出回落值+warn但仍写入', () => {
  const typeFields = [{ key:'biangengleixing', name:'变更类型', type:'select', options:[{_id:'opt_a',text:'日常变更'}] }];
  const { props, warnings } = CF.buildPropertiesPatch(typeFields, { '变更类型':'乱填' }, {});
  assert.strictEqual(props.biangengleixing, 'opt_a');
  assert.match(warnings[0], /fell back/);
});

test('applyPropertyValues: 注入 updateFn，空 props 跳过、有 props 调用一次', async () => {
  const calls = [];
  const updateFn = async (token, id, fields) => { calls.push({ id, fields }); return { id }; };
  const items = [
    { id:'w1', props:{ biangengleixing:'opt_a' } },
    { id:'w2', props:{} },
  ];
  const res = await CF.applyPropertyValues('tok', items, 'https://b', { updateFn });
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], { id:'w1', fields:{ properties:{ biangengleixing:'opt_a' } } });
  assert.strictEqual(res.find(r=>r.id==='w1').ok, true);
  assert.strictEqual(res.find(r=>r.id==='w2').skipped, true);
});
