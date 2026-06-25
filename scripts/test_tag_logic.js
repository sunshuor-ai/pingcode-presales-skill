const { test } = require('node:test');
const assert = require('node:assert');
const L = require('./pingcode_tag_logic.js');

const ITEMS = [
  { title: 'ADB自适应远光系统需求', description: '防眩目分区遮蔽' },
  { title: 'ADB分区点亮算法详细设计', description: '渐变过渡' },
  { title: '配光性能系统需求 (ECE R112)', description: '近光配光照度' },
  { title: '近光配光软件需求', description: '光型控制' },
  { title: 'UDS诊断服务软件需求', description: 'CAN通信' },
  { title: '功能安全系统需求', description: 'ASIL B 故障检测' },
];
const DICT = ['ADB', '配光', 'UDS', '功能安全', 'ASIL', 'EMC'];

test('extractTags 取频次≥min的词典词, 按频降序', () => {
  const tags = L.extractTags(ITEMS, DICT, { min: 2, max: 12 });
  assert.deepStrictEqual(tags, ['ADB', '配光']); // ADB×2, 配光×2; 其余<min或0
});

test('extractTags max 封顶', () => {
  const tags = L.extractTags(ITEMS, DICT, { min: 1, max: 2 });
  assert.strictEqual(tags.length, 2);
  assert.deepStrictEqual(tags, ['ADB', '配光']);
});

test('extractTags 大小写无关 + 命中描述', () => {
  const tags = L.extractTags([{ title: 'adb test', description: 'has EMC inside' }], ['ADB', 'EMC'], { min: 1, max: 5 });
  assert.ok(tags.includes('ADB') && tags.includes('EMC'));
});

test('matchTags 子串命中即贴, 可多标签', () => {
  const item = { title: 'ADB分区点亮算法详细设计', description: '配光过渡' };
  assert.deepStrictEqual(L.matchTags(item, ['ADB', '配光', 'UDS']).sort(), ['ADB', '配光']);
});

test('matchTags 短标签命中长文本(子串subsumes别名)', () => {
  const item = { title: 'ADB自适应远光与近光配光', description: '' };
  assert.deepStrictEqual(L.matchTags(item, ['ADB', '配光']).sort(), ['ADB', '配光']);
});

test('matchTags 无命中返回空', () => {
  assert.deepStrictEqual(L.matchTags({ title: '项目立项', description: '可行性' }, ['ADB', 'EMC']), []);
});
