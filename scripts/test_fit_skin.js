const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const xlsx = require('xlsx');
const SK = require('./pingcode_fit_skin.js');

test('parseXlsx 读出行对象', () => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([['需求名称','所属模块'], ['ADB分区点亮算法','软件需求'], ['防眩目遮蔽','软件需求']]);
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const tmp = path.join(os.tmpdir(), `skin_${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmp);
  const rows = SK.parseXlsx(tmp);
  fs.unlinkSync(tmp);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0]['需求名称'], 'ADB分区点亮算法');
});

const SKELETON_PATHS = ['需求/软件需求/占位', '需求/系统需求/占位'];

test('skinToPatches: 条目 hintPath 命中骨架槽 → confirmed/doc 补丁', () => {
  const items = [{ value:'ADB分区点亮算法', hintPath:'需求/软件需求/占位', raw:'r1' }];
  const { patches, pending_review } = SK.skinToPatches(items, SKELETON_PATHS, 'reqs.xlsx');
  assert.strictEqual(patches.length, 1);
  assert.strictEqual(patches[0].status, 'confirmed');
  assert.strictEqual(patches[0].path, '需求/软件需求/占位');
  assert.match(patches[0].source, /^doc:reqs\.xlsx/);
  assert.strictEqual(pending_review.length, 0);
});

test('skinToPatches: hintPath 不在骨架 → pending_review', () => {
  const items = [{ value:'某条', hintPath:'需求/不存在', raw:'r2' }];
  const { patches, pending_review } = SK.skinToPatches(items, SKELETON_PATHS, 'reqs.xlsx');
  assert.strictEqual(patches.length, 0);
  assert.strictEqual(pending_review.length, 1);
});
