// 集成测试: applyPlan 这条「纯逻辑 ↔ 真实 API」接缝。
// 用 mock 替换 pingcode_api 的三个写函数, 录下调用参数, 不碰网络。
// 核心价值: 回归上次的 camelCase bug(createWorkItem 要 projectId 不是 project_id) + 锁护栏。
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const api = require('./pingcode_api.js');
const { applyPlan } = require('./pingcode_revise.js');

let calls;
const orig = {};
const MOCKED = ['createWorkItem', 'updateWorkItem', 'deleteWorkItem'];

beforeEach(() => {
  calls = { create: [], update: [], del: [] };
  for (const m of MOCKED) orig[m] = api[m];
  let n = 0;
  api.createWorkItem = async (token, opts) => { calls.create.push(opts); return { id: 'NEW' + (++n) }; };
  api.updateWorkItem = async (token, id, fields) => { calls.update.push({ id, fields }); return { id, ...fields }; };
  api.deleteWorkItem = async (token, id) => { calls.del.push(id); return 200; };
  process.env.FIT_PROJECT_ID = 'PROJ1';
});
afterEach(() => { for (const m of MOCKED) api[m] = orig[m]; });

test('create 用 camelCase 调 createWorkItem（回归 camelCase bug）', async () => {
  const facts = [{ id:'fa', path:'需求/X', kind:'work_item', value:'ADB' }];
  const manifest = {};
  const done = await applyPlan('tok', { create: facts, update: [], delete: [] }, undefined, manifest, facts);
  assert.strictEqual(calls.create.length, 1);
  const opts = calls.create[0];
  assert.strictEqual(opts.projectId, 'PROJ1');       // camelCase 才会被 api 读到
  assert.strictEqual(opts.typeId, 'task');
  assert.strictEqual(opts.project_id, undefined);     // 不能是 snake_case（那样静默失败）
  assert.strictEqual(opts.type_id, undefined);
  assert.strictEqual(opts.title, 'ADB');
  assert.strictEqual(done.create, 1);
  assert.deepStrictEqual(manifest.fa, { id:'NEW1', value:'ADB', path:'需求/X' });
});

test('create 非 work_item → 跳过，不调 API', async () => {
  const facts = [{ id:'fw', path:'wiki/Y', kind:'wiki', value:'页' }];
  const done = await applyPlan('tok', { create: facts, update: [], delete: [] }, undefined, {}, facts);
  assert.strictEqual(calls.create.length, 0);
  assert.strictEqual(done.skip, 1);
  assert.strictEqual(done.create, 0);
});

test('update 调对 objId + title，回写 manifest 值', async () => {
  const manifest = { f1: { id:'OBJ1', value:'旧', path:'p' } };
  const done = await applyPlan('tok',
    { create: [], update: [{ factId:'f1', objId:'OBJ1', value:'新名' }], delete: [] }, undefined, manifest, []);
  assert.deepStrictEqual(calls.update, [{ id:'OBJ1', fields:{ title:'新名' } }]);
  assert.strictEqual(manifest.f1.value, '新名');
  assert.strictEqual(done.update, 1);
});

test('delete 护栏：只删 manifest 里已知对象，未知跳过', async () => {
  const manifest = { f1: { id:'OBJ1', value:'v', path:'p' } };
  const plan = { create: [], update: [], delete: [ { factId:'f1', objId:'OBJ1' }, { factId:'fx', objId:'UNKNOWN' } ] };
  const done = await applyPlan('tok', plan, undefined, manifest, []);
  assert.deepStrictEqual(calls.del, ['OBJ1']);        // 只删已知
  assert.strictEqual(done.del, 1);
  assert.strictEqual(done.skip, 1);                   // 未知被跳过, 不误删
  assert.strictEqual(manifest.f1, undefined);         // 已删的从 manifest 移除
});

test('create 带父子：子项 parentId 取已建父对象', async () => {
  const facts = [{ id:'fp', path:'需求', kind:'work_item', value:'需求' },
                 { id:'fc', path:'需求/子', kind:'work_item', value:'子' }];
  const manifest = { fp: { id:'POBJ', value:'需求', path:'需求' } };  // 父已建
  await applyPlan('tok', { create: [facts[1]], update: [], delete: [] }, undefined, manifest, facts);
  assert.strictEqual(calls.create[0].parentId, 'POBJ');
});
