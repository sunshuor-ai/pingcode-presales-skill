const { test } = require('node:test');
const assert = require('node:assert');
const { buildContextFromItems } = require('./pingcode_fit_export.js');

test('扁平(无父): path=title, factId 稳定, manifest 对齐', () => {
  const { context, manifest } = buildContextFromItems(
    [{ id:'A', title:'需求', parentId:null }], { client:'弗浪', identifier:'JLALED' });
  assert.strictEqual(context.facts.length, 1);
  const f = context.facts[0];
  assert.strictEqual(f.id, 'wi_A');
  assert.strictEqual(f.path, '需求');
  assert.strictEqual(f.value, '需求');
  assert.strictEqual(f.kind, 'work_item');
  assert.deepStrictEqual(manifest.wi_A, { id:'A', value:'需求', path:'需求' });
  assert.strictEqual(context.client, '弗浪');
  assert.strictEqual(context.identifier, 'JLALED');
});

test('嵌套: path 由父链拼接', () => {
  const items = [{ id:'A', title:'需求', parentId:null },
                 { id:'B', title:'ADB', parentId:'A' },
                 { id:'C', title:'子任务', parentId:'B' }];
  const { context, manifest } = buildContextFromItems(items, {});
  const p = Object.fromEntries(context.facts.map(f => [f.id, f.path]));
  assert.strictEqual(p.wi_A, '需求');
  assert.strictEqual(p.wi_B, '需求/ADB');
  assert.strictEqual(p.wi_C, '需求/ADB/子任务');
  assert.strictEqual(manifest.wi_C.path, '需求/ADB/子任务');
});

test('孤儿父(父不在集合) → 当根处理, 不崩', () => {
  const { context } = buildContextFromItems([{ id:'X', title:'独项', parentId:'GHOST' }], {});
  assert.strictEqual(context.facts[0].path, '独项');
});

test('导出 fact 默认 source=skeleton/status=guess(后续 doc/meeting 可覆盖)', () => {
  const { context } = buildContextFromItems([{ id:'A', title:'T', parentId:null }], {});
  assert.strictEqual(context.facts[0].source, 'skeleton');
  assert.strictEqual(context.facts[0].status, 'guess');
  assert.strictEqual(context.facts[0].authority, null);
  assert.deepStrictEqual(context.pending_review, []);
});

test('复跑确定性: 同输入 → 同 factId(便于增量复用)', () => {
  const items = [{ id:'A', title:'T', parentId:null }, { id:'B', title:'U', parentId:'A' }];
  const r1 = buildContextFromItems(items, {});
  const r2 = buildContextFromItems(items, {});
  assert.deepStrictEqual(r1.context.facts.map(f => f.id), r2.context.facts.map(f => f.id));
  assert.deepStrictEqual(r1.manifest, r2.manifest);
});
