const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vt = require('./vertical_template.js');

const SAMPLE = [
  '# 汽车电子 — 行业结构模板',
  '## 概览',
  '- 项目类型: hybrid',
  '## 专属类型与字段',
  '```yaml',
  'types:',
  '  - name: 变更请求',
  '    group: 事务',
  '    fields:',
  '      - { name: 变更类型, kind: 单选, options: [需求变更, 设计变更] }',
  '      - { name: 影响分析, kind: 多行文本 }',
  '```',
  ''
].join('\n');

test('extractTypesBlock 取出含 types 的 yaml 块', () => {
  const block = vt.extractTypesBlock(SAMPLE);
  assert.ok(block && block.includes('types:'));
});
test('extractTypesBlock 无 yaml 块时返回 null', () => {
  assert.strictEqual(vt.extractTypesBlock('# 纯散文\n没有结构块'), null);
});
test('parseVertical 解析出 types 数组', () => {
  const parsed = vt.parseVertical(SAMPLE);
  assert.strictEqual(parsed.types.length, 1);
  assert.strictEqual(parsed.types[0].name, '变更请求');
  assert.strictEqual(parsed.types[0].fields.length, 2);
  assert.deepStrictEqual(parsed.types[0].fields[0].options, ['需求变更', '设计变更']);
});
test('parseVertical 无块时返回空 types', () => {
  assert.deepStrictEqual(vt.parseVertical('# 纯散文').types, []);
});
test('validateVertical 合法模板返回空错误数组', () => {
  assert.deepStrictEqual(vt.validateVertical(vt.parseVertical(SAMPLE)), []);
});
test('validateVertical 非法 kind 报错', () => {
  const errs = vt.validateVertical({ types: [{ name: 'X', group: '事务', fields: [{ name: '字段A', kind: '富文本' }] }] });
  assert.strictEqual(errs.length, 1);
  assert.match(errs[0], /kind/);
});
test('validateVertical 非法 group 报错', () => {
  const errs = vt.validateVertical({ types: [{ name: 'X', group: '缺陷', fields: [] }] });
  assert.match(errs[0], /group/);
});
test('validateVertical 单选缺 options 报错', () => {
  const errs = vt.validateVertical({ types: [{ name: 'X', group: '事务', fields: [{ name: '字段A', kind: '单选' }] }] });
  assert.match(errs[0], /options/);
});
test('validateVertical 缺 name 报错', () => {
  const errs = vt.validateVertical({ types: [{ group: '事务', fields: [] }] });
  assert.match(errs[0], /name/);
});
test('validateFile 读文件并校验', () => {
  const tmp = path.join(os.tmpdir(), `vt_${Date.now()}.md`);
  fs.writeFileSync(tmp, SAMPLE);
  assert.deepStrictEqual(vt.validateFile(tmp), []);
  fs.unlinkSync(tmp);
});
