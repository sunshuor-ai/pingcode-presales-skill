# 自定义字段语义填值 + 自动加管理员 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 PingCode 售前演示环境的自定义类型工作项自动填上语义贴合的字段值，并把 Admin 账号自动加为新建对象（项目/Wiki/Ship/TestHub）的管理员。

**Architecture:** 两个特性都挂进现有 Phase 4 后处理 + manifest，做成幂等可重跑。模型只产出"字段名→人读值"，纯函数把它解析成 live key/option `_id` 并按类型格式化后批量 PATCH 写入；管理员靠"扫已有成员里的管理员角色"识别，Phase 4 末尾按 manifest 一次性 sweep。

**Tech Stack:** Node.js v18+（内置 `fetch`，零运行时依赖）；测试 `node:test` + `node:assert`，纯逻辑模块直测、I/O 走真实 E2E（对 daocloud-test，build-and-delete）。

**关键约定（实现前必读）：**
- 测试运行：`node --test scripts/<test_file>.js`（在 skill 根目录 `C:\Users\shuos\.claude\skills\pingcode-presales`）。
- 纯函数与 I/O 分离：I/O 函数都接受可注入的 `fetchImpl`/`updateFn`/`deps` 末参，便于无网络单测。
- **绝不硬编码 option `_id` / 选项文字**：本环境「变更类型」是 `日常变更/临时变更`，必须 live 读。
- 已验证事实见 `specs/2026-06-30-custom-fields-and-admin-design.md` §2，不要重新推断。
- **分支**：当前在 `feat/codex-cross-platform`（那是 backlog #3 的工作）。本计划必须从 `main` 切新分支 `feat/custom-fields-and-admin` 再开工，勿叠在 #3 分支上。

---

## File Structure

**新增：**
- `scripts/pingcode_custom_fields.js` — 自定义字段填值。纯：`resolveOptionId` / `formatValue` / `discoverTypeFields` / `buildPropertiesPatch`；I/O：`resolvePropertyCatalog` / `applyPropertyValues`。
- `scripts/pingcode_admin.js` — 管理员解析与添加。纯：`moduleMembersEndpoint` / `pickAdminRoleId` / `tallyAdminUserId` / `containerModuleOf`；I/O：`listMembers` / `addMember` / `resolveAdminRoleId` / `resolveAdminUserId` / `sweepAdmins`。
- `scripts/test_custom_fields.js` — 纯函数单测。
- `scripts/test_admin.js` — 纯函数单测。
- `scripts/test_e2e_custom_fields_admin.js` — 真实 E2E（无凭证则 skip）。

**修改：**
- `scripts/pingcode_api.js` — `addProjectMember` 增可选 `roleId`。
- `scripts/pingcode_check.js` — Phase 5 增「自定义字段填充率」检查（纯 `checkCustomFieldFill`）。
- `SKILL.md` — 3.7 选项免责声明、3.8 属性目录解析、Phase 4 生成 `properties` 约定、新增 4.4/4.5、Phase 5 检查项。
- `references/api.md` — 补 `work_item_properties` 写值格式、四模块 members 端点 + `ADMIN_ROLE`。

---

## Task 1: custom_fields 纯函数 — 选项解析与按类型格式化

**Files:**
- Create: `scripts/pingcode_custom_fields.js`
- Test: `scripts/test_custom_fields.js`

- [ ] **Step 1: 写失败测试**

```js
// scripts/test_custom_fields.js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_custom_fields.js`
Expected: FAIL（`Cannot find module './pingcode_custom_fields.js'`）

- [ ] **Step 3: 写最小实现**

```js
// scripts/pingcode_custom_fields.js
'use strict';

function resolveOptionId(field, text) {
  const opts = field.options || [];
  const t = String(text);
  const exact = opts.find(o => o.text === t);
  if (exact) return exact._id;
  const loose = opts.find(o => o.text.includes(t) || t.includes(o.text));
  return loose ? loose._id : null;
}

function formatValue(field, humanValue, ctx = {}) {
  switch (field.type) {
    case 'select': {
      const id = resolveOptionId(field, humanValue);
      if (id) return { value: id };
      const fb = (field.options || [])[0];
      return fb ? { value: fb._id, warn: `option "${humanValue}" not in ${field.name}; fell back to "${fb.text}"` }
                : { value: undefined, warn: `no options for ${field.name}` };
    }
    case 'multi_select': {
      const arr = Array.isArray(humanValue) ? humanValue : [humanValue];
      const ids = arr.map(v => resolveOptionId(field, v)).filter(Boolean);
      return ids.length ? { value: ids } : { value: undefined, warn: `no valid options for ${field.name}` };
    }
    case 'text': case 'textarea': case 'link':
      return { value: String(humanValue) };
    case 'number': case 'rate': case 'progress': {
      const n = Number(humanValue);
      return Number.isFinite(n) ? { value: n } : { value: undefined, warn: `non-numeric for ${field.name}` };
    }
    case 'date': {
      let sec = null;
      if (typeof humanValue === 'number') sec = humanValue > 1e12 ? Math.floor(humanValue/1000) : humanValue;
      else { const ms = Date.parse(humanValue); sec = Number.isNaN(ms) ? null : Math.floor(ms/1000); }
      return sec ? { value: sec } : { value: undefined, warn: `bad date for ${field.name}` };
    }
    case 'member': {
      const uid = ctx.resolveUser ? ctx.resolveUser(humanValue) : null;
      const val = uid || ctx.assignee || undefined;
      return val ? { value: val } : { value: undefined, warn: `no user for ${field.name}` };
    }
    case 'members': {
      const arr = Array.isArray(humanValue) ? humanValue : [humanValue];
      const ids = arr.map(v => ctx.resolveUser ? ctx.resolveUser(v) : null).filter(Boolean);
      if (ids.length) return { value: ids };
      return ctx.assignee ? { value: [ctx.assignee] } : { value: undefined };
    }
    default:
      return { value: undefined, warn: `unsupported type ${field.type} for ${field.name}` };
  }
}

module.exports = { resolveOptionId, formatValue };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_custom_fields.js`
Expected: PASS（11 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_custom_fields.js scripts/test_custom_fields.js
git commit -m "feat(custom-fields): resolveOptionId + formatValue per field type

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: custom_fields 纯函数 — 类型字段发现与补丁构建

**Files:**
- Modify: `scripts/pingcode_custom_fields.js`
- Test: `scripts/test_custom_fields.js`

- [ ] **Step 1: 追加失败测试**

```js
// append to scripts/test_custom_fields.js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_custom_fields.js`
Expected: FAIL（`CF.discoverTypeFields is not a function`）

- [ ] **Step 3: 追加实现**

```js
// add to scripts/pingcode_custom_fields.js (before module.exports)
function discoverTypeFields(item, catalog) {
  const keys = Object.keys((item && item.properties) || {});
  return keys.filter(k => catalog.has(k)).map(k => ({ key: k, ...catalog.get(k) }));
}

function buildPropertiesPatch(typeFields, emittedProps, ctx = {}) {
  const byName = new Map(typeFields.map(f => [f.name, f]));
  const props = {}; const warnings = [];
  for (const [name, human] of Object.entries(emittedProps || {})) {
    const field = byName.get(name);
    if (!field) { warnings.push(`field "${name}" not applicable to type; skipped`); continue; }
    const { value, warn } = formatValue(field, human, ctx);
    if (warn) warnings.push(warn);
    if (value !== undefined) props[field.key] = value;
  }
  return { props, warnings };
}
```

更新导出：
```js
module.exports = { resolveOptionId, formatValue, discoverTypeFields, buildPropertiesPatch };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_custom_fields.js`
Expected: PASS（14 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_custom_fields.js scripts/test_custom_fields.js
git commit -m "feat(custom-fields): discoverTypeFields + buildPropertiesPatch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: custom_fields I/O — 属性目录拉取 + 批量写值

**Files:**
- Modify: `scripts/pingcode_custom_fields.js`
- Test: `scripts/test_custom_fields.js`

> `resolvePropertyCatalog` 走网络，由 Task 8 的 E2E 覆盖；`applyPropertyValues` 注入 `updateFn` 可纯单测。

- [ ] **Step 1: 追加失败测试**

```js
// append to scripts/test_custom_fields.js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_custom_fields.js`
Expected: FAIL（`CF.applyPropertyValues is not a function`）

- [ ] **Step 3: 追加实现**

```js
// add to scripts/pingcode_custom_fields.js (before module.exports)
async function resolvePropertyCatalog(token, baseUrl, fetchImpl = fetch) {
  const map = new Map();
  let page = 0;
  while (true) {
    const r = await fetchImpl(`${baseUrl}/v1/project/work_item_properties?page_index=${page}&page_size=100`,
      { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    const vals = j.values || [];
    for (const p of vals) map.set(p.id, { name: p.name, type: p.type, options: p.options || [] });
    if (vals.length === 0 || map.size >= (j.total || 0)) break;
    page++;
  }
  return map;
}

async function applyPropertyValues(token, items, baseUrl, opts = {}) {
  const concurrency = opts.concurrency || 10;
  const updateFn = opts.updateFn || require('./pingcode_api.js').updateWorkItem;
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const r = await Promise.all(batch.map(async it => {
      if (!it.props || Object.keys(it.props).length === 0) return { id: it.id, skipped: true };
      try { await updateFn(token, it.id, { properties: it.props }, baseUrl); return { id: it.id, ok: true }; }
      catch (e) { return { id: it.id, error: e.message }; }
    }));
    results.push(...r);
  }
  return results;
}
```

更新导出：
```js
module.exports = { resolveOptionId, formatValue, discoverTypeFields, buildPropertiesPatch,
  resolvePropertyCatalog, applyPropertyValues };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_custom_fields.js`
Expected: PASS（15 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_custom_fields.js scripts/test_custom_fields.js
git commit -m "feat(custom-fields): resolvePropertyCatalog + applyPropertyValues (injectable)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: admin 纯函数 — 端点映射 / 角色识别 / 管理员计票

**Files:**
- Create: `scripts/pingcode_admin.js`
- Test: `scripts/test_admin.js`

- [ ] **Step 1: 写失败测试**

```js
// scripts/test_admin.js
const { test } = require('node:test');
const assert = require('node:assert');
const A = require('./pingcode_admin.js');

test('moduleMembersEndpoint: 四模块映射', () => {
  assert.strictEqual(A.moduleMembersEndpoint('project','p1'), '/v1/project/projects/p1/members');
  assert.strictEqual(A.moduleMembersEndpoint('wiki','s1'), '/v1/wiki/spaces/s1/members');
  assert.strictEqual(A.moduleMembersEndpoint('ship','pr1'), '/v1/ship/products/pr1/members');
  assert.strictEqual(A.moduleMembersEndpoint('testhub','l1'), '/v1/testhub/libraries/l1/members');
  assert.throws(() => A.moduleMembersEndpoint('unknown','x'), /unknown module/);
});

test('pickAdminRoleId: 找 role.name==管理员 的 role.id', () => {
  const members = [
    { user:{id:'u1'}, role:{id:'r_member', name:'成员'} },
    { user:{id:'u2'}, role:{id:'100000000000000000000001', name:'管理员'} },
  ];
  assert.strictEqual(A.pickAdminRoleId(members), '100000000000000000000001');
  assert.strictEqual(A.pickAdminRoleId([{user:{id:'u1'}}]), null);
});

test('tallyAdminUserId: 取管理员角色出现最频的用户', () => {
  const ADMIN = '100000000000000000000001';
  const lists = [
    [ {user:{id:'u_owner'}, role:{id:ADMIN}}, {user:{id:'u_x'}, role:{id:'r_m'}} ],
    [ {user:{id:'u_owner'}, role:{id:ADMIN}} ],
    [ {user:{id:'u_y'}, role:{id:ADMIN}} ],
  ];
  assert.strictEqual(A.tallyAdminUserId(lists, ADMIN), 'u_owner');
  assert.strictEqual(A.tallyAdminUserId([], ADMIN), null);
});

test('containerModuleOf: manifest 容器类型→module，非容器返回 null', () => {
  assert.strictEqual(A.containerModuleOf('project'), 'project');
  assert.strictEqual(A.containerModuleOf('wiki_space'), 'wiki');
  assert.strictEqual(A.containerModuleOf('ship_product'), 'ship');
  assert.strictEqual(A.containerModuleOf('test_library'), 'testhub');
  assert.strictEqual(A.containerModuleOf('work_item'), null);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_admin.js`
Expected: FAIL（`Cannot find module './pingcode_admin.js'`）

- [ ] **Step 3: 写最小实现**

```js
// scripts/pingcode_admin.js
'use strict';

const ADMIN_ROLE_FALLBACK = '100000000000000000000001';

const MODULE_MEMBERS = {
  project: id => `/v1/project/projects/${id}/members`,
  wiki:    id => `/v1/wiki/spaces/${id}/members`,
  ship:    id => `/v1/ship/products/${id}/members`,
  testhub: id => `/v1/testhub/libraries/${id}/members`,
};
const CONTAINER_TYPE_MODULE = {
  project: 'project', wiki_space: 'wiki', ship_product: 'ship', test_library: 'testhub',
};

function moduleMembersEndpoint(module, id) {
  const f = MODULE_MEMBERS[module];
  if (!f) throw new Error(`unknown module: ${module}`);
  return f(id);
}
function containerModuleOf(manifestType) {
  return CONTAINER_TYPE_MODULE[manifestType] || null;
}
function pickAdminRoleId(members) {
  const m = (members || []).find(x => x.role && x.role.name === '管理员');
  return m ? m.role.id : null;
}
function tallyAdminUserId(memberLists, adminRoleId) {
  const tally = new Map();
  for (const list of memberLists || []) {
    for (const m of list || []) {
      if (m.role && m.role.id === adminRoleId && m.user) {
        tally.set(m.user.id, (tally.get(m.user.id) || 0) + 1);
      }
    }
  }
  let best = null, bestN = 0;
  for (const [uid, n] of tally) if (n > bestN) { best = uid; bestN = n; }
  return best;
}

module.exports = { ADMIN_ROLE_FALLBACK, moduleMembersEndpoint, containerModuleOf, pickAdminRoleId, tallyAdminUserId };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_admin.js`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_admin.js scripts/test_admin.js
git commit -m "feat(admin): pure helpers — endpoint map, role pick, admin tally

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: admin I/O — listMembers / addMember / resolve / sweep

**Files:**
- Modify: `scripts/pingcode_admin.js`
- Test: `scripts/test_admin.js`

> `listMembers`/`addMember`/`resolveAdminRoleId`/`resolveAdminUserId` 走网络，由 Task 8 E2E 覆盖；`sweepAdmins` 注入 `deps` 可纯单测编排逻辑。

- [ ] **Step 1: 追加失败测试**

```js
// append to scripts/test_admin.js
test('sweepAdmins: 按 manifest 容器去重加管理员，幂等汇总', async () => {
  const manifest = { items: [
    { type:'project', id:'p1', status:'DONE' },
    { type:'wiki_space', id:'s1', status:'DONE' },
    { type:'work_item', id:'w1', status:'DONE' },     // 非容器，跳过
    { type:'ship_product', id:'pr1', status:'PENDING' }, // 未完成，跳过
  ]};
  const added = [];
  const deps = {
    resolveAdminUserId: async () => 'u_owner',
    resolveAdminRoleId: async () => '100000000000000000000001',
    addMember: async (token, module, id, uid, rid) => { added.push({ module, id, uid, rid }); return { ok:true }; },
  };
  const res = await A.sweepAdmins('tok', manifest, 'https://b', { sampleProjects:['p1'] }, deps);
  assert.deepStrictEqual(added, [
    { module:'project', id:'p1', uid:'u_owner', rid:'100000000000000000000001' },
    { module:'wiki',    id:'s1', uid:'u_owner', rid:'100000000000000000000001' },
  ]);
  assert.strictEqual(res.added, 2);
  assert.strictEqual(res.skipped_no_admin, false);
});

test('sweepAdmins: admin 找不到→整步跳过并标记告警', async () => {
  const manifest = { items:[{ type:'project', id:'p1', status:'DONE' }] };
  const deps = { resolveAdminUserId: async () => null, resolveAdminRoleId: async () => 'r',
    addMember: async () => { throw new Error('should not be called'); } };
  const res = await A.sweepAdmins('tok', manifest, 'https://b', {}, deps);
  assert.strictEqual(res.added, 0);
  assert.strictEqual(res.skipped_no_admin, true);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_admin.js`
Expected: FAIL（`A.sweepAdmins is not a function`）

- [ ] **Step 3: 追加实现**

```js
// add to scripts/pingcode_admin.js (before module.exports)
async function listMembers(token, module, containerId, baseUrl, fetchImpl = fetch) {
  const r = await fetchImpl(baseUrl + moduleMembersEndpoint(module, containerId),
    { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return j.values || [];
}

async function addMember(token, module, containerId, userId, roleId, baseUrl, fetchImpl = fetch) {
  const r = await fetchImpl(baseUrl + moduleMembersEndpoint(module, containerId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, role_id: roleId }),
  });
  if (r.status === 200 || r.status === 201) return { ok: true };
  const t = await r.text();
  if (/已.*成员|已存在|exist|重复/.test(t)) return { ok: true, already: true };
  return { ok: false, status: r.status, error: t };
}

async function resolveAdminRoleId(token, baseUrl, sampleProjects = [], deps = {}) {
  const lm = deps.listMembers || listMembers;
  for (const pid of sampleProjects) {
    const rid = pickAdminRoleId(await lm(token, 'project', pid, baseUrl));
    if (rid) return rid;
  }
  return ADMIN_ROLE_FALLBACK;
}

async function resolveAdminUserId(token, baseUrl, opts = {}, deps = {}) {
  const { formAdmin, sampleProjects = [], users = [] } = opts;
  if (formAdmin) {
    const u = users.find(x => x.email === formAdmin || x.name === formAdmin
      || x.display_name === formAdmin || x.mobile === formAdmin);
    if (u) return u.id;
  }
  const lm = deps.listMembers || listMembers;
  const roleId = await (deps.resolveAdminRoleId || resolveAdminRoleId)(token, baseUrl, sampleProjects, deps);
  const lists = [];
  for (const pid of sampleProjects) lists.push(await lm(token, 'project', pid, baseUrl));
  return tallyAdminUserId(lists, roleId);
}

async function sweepAdmins(token, manifest, baseUrl, opts = {}, deps = {}) {
  const ru = deps.resolveAdminUserId || resolveAdminUserId;
  const rr = deps.resolveAdminRoleId || resolveAdminRoleId;
  const am = deps.addMember || addMember;
  const containers = (manifest.items || [])
    .filter(it => it.status === 'DONE' && it.id && containerModuleOf(it.type))
    .map(it => ({ module: containerModuleOf(it.type), id: it.id }));
  const userId = await ru(token, baseUrl, opts, deps);
  if (!userId) return { added: 0, skipped_no_admin: true, results: [] };
  const roleId = await rr(token, baseUrl, opts.sampleProjects || [], deps);
  const results = [];
  for (const c of containers) {
    try { const r = await am(token, c.module, c.id, userId, roleId, baseUrl); results.push({ ...c, ...r }); }
    catch (e) { results.push({ ...c, ok: false, error: e.message }); }
  }
  return { added: results.filter(r => r.ok).length, skipped_no_admin: false, results };
}
```

更新导出：
```js
module.exports = { ADMIN_ROLE_FALLBACK, moduleMembersEndpoint, containerModuleOf,
  pickAdminRoleId, tallyAdminUserId,
  listMembers, addMember, resolveAdminRoleId, resolveAdminUserId, sweepAdmins };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_admin.js`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_admin.js scripts/test_admin.js
git commit -m "feat(admin): listMembers/addMember/resolve + manifest-driven sweepAdmins

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: api.js — addProjectMember 支持 roleId

**Files:**
- Modify: `scripts/pingcode_api.js`（`addProjectMember`，当前约 318-320 行）
- Test: `scripts/test_admin.js`（追加）

- [ ] **Step 1: 追加失败测试**

```js
// append to scripts/test_admin.js
const api = require('./pingcode_api.js');
test('addProjectMember: 带 roleId 时进入请求体', async () => {
  let sent = null;
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return { ok:true, json: async()=>({}) }; };
  try {
    await api.addProjectMember('tok', 'p1', 'u1', '100000000000000000000001', 'https://b');
    assert.deepStrictEqual(sent, { user_id:'u1', role_id:'100000000000000000000001' });
  } finally { global.fetch = origFetch; }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_admin.js`
Expected: FAIL（当前签名 `addProjectMember(token, projectId, memberId, baseUrl)`，第 4 参被当作 baseUrl，body 无 role_id）

- [ ] **Step 3: 改实现（向后兼容）**

把 `pingcode_api.js` 的 `addProjectMember` 改为：
```js
async function addProjectMember(token, projectId, memberId, roleId, baseUrl = DEFAULT_BASE) {
  // 向后兼容: 老调用 addProjectMember(token, pid, mid, baseUrl) 把 URL 当 roleId 传入
  if (typeof roleId === 'string' && /^https?:\/\//.test(roleId)) { baseUrl = roleId; roleId = undefined; }
  const body = { user_id: memberId };
  if (roleId) body.role_id = roleId;
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/members`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`添加项目成员失败: ${await resp.text()}`);
  return resp.json();
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_admin.js`
Expected: PASS（7 tests）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_api.js scripts/test_admin.js
git commit -m "feat(api): addProjectMember accepts optional roleId (backward compatible)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: pingcode_check.js — 自定义字段填充率检查

**Files:**
- Modify: `scripts/pingcode_check.js`（新增纯函数 `checkCustomFieldFill` 并接入检查列表）
- Test: `scripts/test_check_fill.js`（新建，纯函数单测）

> 先确认 `pingcode_check.js` 是否已 `module.exports` 暴露函数；若未暴露，本任务追加导出 `checkCustomFieldFill` 即可，不改动既有检查。

- [ ] **Step 1: 写失败测试**

```js
// scripts/test_check_fill.js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/test_check_fill.js`
Expected: FAIL（`checkCustomFieldFill is not a function` 或未导出）

- [ ] **Step 3: 实现并导出**

在 `scripts/pingcode_check.js` 末尾（`module.exports` 处）加：
```js
function checkCustomFieldFill(items, customTypeIds, customKeys) {
  let total = 0, filled = 0;
  for (const it of items || []) {
    if (!customTypeIds.has(it.type_id)) continue;
    total++;
    const props = it.properties || {};
    const hasVal = Object.keys(props).some(k => customKeys.has(k)
      && props[k] != null && !(Array.isArray(props[k]) && props[k].length === 0));
    if (hasVal) filled++;
  }
  return { total, filled, rate: total ? filled / total : 1 };
}
```
确保 `module.exports` 含 `checkCustomFieldFill`（若文件原本无导出对象，追加 `module.exports = { ...(module.exports||{}), checkCustomFieldFill };`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/test_check_fill.js`
Expected: PASS（1 test）

- [ ] **Step 5: Commit**

```bash
git add scripts/pingcode_check.js scripts/test_check_fill.js
git commit -m "feat(check): custom-field fill-rate check for Phase 5 QA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 真实 E2E（daocloud-test，build-and-delete）

**Files:**
- Create: `scripts/test_e2e_custom_fields_admin.js`

> 无 `PINGCODE_CLIENT_ID` 环境变量时整组 skip。所有创建对象当场删除/还原。运行：
> `PINGCODE_CLIENT_ID=.. PINGCODE_CLIENT_SECRET=.. node --test scripts/test_e2e_custom_fields_admin.js`
> （PowerShell：`$env:PINGCODE_CLIENT_ID='..'; $env:PINGCODE_CLIENT_SECRET='..'; node --test scripts/test_e2e_custom_fields_admin.js`）

- [ ] **Step 1: 写 E2E 测试**

```js
// scripts/test_e2e_custom_fields_admin.js
const { test } = require('node:test');
const assert = require('node:assert');
const CF = require('./pingcode_custom_fields.js');
const A = require('./pingcode_admin.js');

const BASE = 'https://open.pingcode.com';
const CID = process.env.PINGCODE_CLIENT_ID, CSEC = process.env.PINGCODE_CLIENT_SECRET;
const RUN = !!(CID && CSEC);
const H = t => ({ Authorization:`Bearer ${t}`, 'Content-Type':'application/json' });
async function token(){ const p=new URLSearchParams({grant_type:'client_credentials',client_id:CID,client_secret:CSEC});
  const r=await fetch(`${BASE}/v1/auth/token?${p}`); return (await r.json()).access_token; }
async function api(t,m,path,body){ const r=await fetch(BASE+path,{method:m,headers:H(t),body:body?JSON.stringify(body):undefined});
  const x=await r.text(); let j; try{j=JSON.parse(x);}catch{j=x;} return {status:r.status,j}; }

// 已知自定义类型（daocloud-test，2026-06-30 探测）
const TYPE_CHANGE = '6a282ab4eb034ddabe075b2b';   // 工程变更申请
const HYBRID = ['683e7d06ae83a8082f4fc891','68881e8a993e6ee6fa88bcef'];
const TEST_PROJ = '691adde7b2447dbb688d1349';     // 测试瀑布

test('E2E #1: 建自定义类型工作项→填值→readback 校验→删', { skip: !RUN }, async () => {
  const t = await token();
  const catalog = await CF.resolvePropertyCatalog(t, BASE);
  assert.ok(catalog.size > 0, 'catalog 非空');

  let wi = null;
  for (const pid of HYBRID) {
    const c = await api(t,'POST','/v1/project/work_items',{ project_id:pid, type_id:TYPE_CHANGE, title:'ZZZ_E2E_DELETE_变更' });
    if (c.status < 300 && c.j.id) { wi = c.j; break; }
  }
  assert.ok(wi, '应能创建工程变更申请工作项');
  try {
    const back = await api(t,'GET',`/v1/project/work_items/${wi.id}`);
    const fields = CF.discoverTypeFields(back.j, catalog);
    const change = fields.find(f => f.name === '变更类型');
    assert.ok(change && change.options.length, '应发现 select 字段「变更类型」及其选项');
    const { props } = CF.buildPropertiesPatch(fields, { '变更类型': change.options[0].text }, {});
    const [res] = await CF.applyPropertyValues(t, [{ id:wi.id, props }], BASE,
      { updateFn: async (tok,id,f) => (await api(tok,'PATCH',`/v1/project/work_items/${id}`, f)).j });
    assert.strictEqual(res.ok, true);
    const back2 = await api(t,'GET',`/v1/project/work_items/${wi.id}`);
    assert.strictEqual(back2.j.properties[change.key], change.options[0]._id, '回读值=选项 _id');
  } finally {
    await api(t,'DELETE',`/v1/project/work_items/${wi.id}`);
  }
});

test('E2E #2: 加管理员→readback role 校验→还原', { skip: !RUN }, async () => {
  const t = await token();
  const roleId = await A.resolveAdminRoleId(t, BASE, [TEST_PROJ]);
  assert.strictEqual(roleId, A.ADMIN_ROLE_FALLBACK, '管理员 role 应为统一常量');
  const members = await A.listMembers(t, 'project', TEST_PROJ, BASE);
  const existing = new Set(members.map(m => m.user && m.user.id));
  const testUser = ['6abd4476dbd14d409235615ee5977821','9ea3529874a448dbaf5c54813f394bd6']
    .find(u => !existing.has(u));
  assert.ok(testUser, '需要一个非成员测试用户');
  try {
    const add = await A.addMember(t, 'project', TEST_PROJ, testUser, roleId, BASE);
    assert.strictEqual(add.ok, true);
    const after = await A.listMembers(t, 'project', TEST_PROJ, BASE);
    const m = after.find(x => x.user && x.user.id === testUser);
    assert.strictEqual(m.role.name, '管理员');
  } finally {
    await api(t,'DELETE',`/v1/project/projects/${TEST_PROJ}/members/${testUser}`);
  }
});
```

- [ ] **Step 2: 跑 E2E（带凭证）确认通过**

Run（PowerShell）: `$env:PINGCODE_CLIENT_ID='<id>'; $env:PINGCODE_CLIENT_SECRET='<secret>'; node --test scripts/test_e2e_custom_fields_admin.js`
Expected: PASS（2 tests）；无凭证时 2 skipped。

- [ ] **Step 3: 跑全量纯单测确认无回归**

Run: `node --test scripts/test_custom_fields.js scripts/test_admin.js scripts/test_check_fill.js`
Expected: 全 PASS。

- [ ] **Step 4: Commit**

```bash
git add scripts/test_e2e_custom_fields_admin.js
git commit -m "test(e2e): real daocloud-test round-trip for custom fields + admin add

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: 文档接线 — api.md + SKILL.md

**Files:**
- Modify: `references/api.md`
- Modify: `SKILL.md`

> 纯文档/流程接线，无单测；验证 = 通读自检（见每步）。

- [ ] **Step 1: api.md 补端点与格式**

在 `references/api.md` 适当位置追加：
```markdown
### 自定义字段（properties）写值
- `GET /v1/project/work_item_properties`（分页）→ 全组织属性表：`id`(=property_key) / `name` / `type` / `options:[{_id,text}]`。`?work_item_type_id=` 过滤无效，返回全部。
- 类型→适用字段：建一条该类型工作项→`GET /v1/project/work_items/{id}` 读 `.properties` 的 key ∩ 属性表。
- 写值：`PATCH /v1/project/work_items/{id}` body `{"properties":{"<key>":<value>}}`。
  - select→选项 `_id`(字符串)；multi_select→`[_id]`；text/textarea→串；date→unix 秒；number→数字；member→`user_id`；members→`[user_id]`。
  - ⚠️ 选项 `_id`/选项文字因环境而异，必须 live 读，禁止硬编码。错误 `100043 property_key 不存在` = key 不属于该类型。

### 成员 / 管理员
- 四模块成员端点：`/v1/project/projects/{id}/members`、`/v1/wiki/spaces/{id}/members`、`/v1/ship/products/{id}/members`、`/v1/testhub/libraries/{id}/members`。
- 加成员带角色：`POST …/members {user_id, role_id}`；移除：`DELETE …/members/{userId}`。
- 「管理员」role id = `100000000000000000000001`（四模块统一，防御性可从已有成员 role.name==管理员 现取）。
- Admin 识别：`/users/me` 在 client_credentials 下无效；`/directory/users` 无 admin 标志；靠"扫已有成员里的管理员角色"。
```
自检：搜 `work_item_properties` 与 `role_id` 均出现，无 TODO。

- [ ] **Step 2: SKILL.md — 3.7 选项免责声明**

在 3.7「各类型字段速查」表上方加一行：
```markdown
> ⚠️ 下表选项值仅为**示例**。实际选项 `_id` 与文字因环境而异，运行时一律以 `GET /v1/project/work_item_properties` 的 live options 为准，禁止硬编码（实测 daocloud-test「变更类型」是 日常/临时，非设计/工艺/材料/软件）。
```

- [ ] **Step 3: SKILL.md — 3.8 Pre-flight 增属性目录**

在 3.8「必须执行的探测」列表末尾加：
```markdown
GET /v1/project/work_item_properties → resolvePropertyCatalog：自定义字段 name↔key↔options（供 Phase 4 生成与 4.4 写值）
```

- [ ] **Step 4: SKILL.md — Phase 4 生成约定 + 新增 4.4 / 4.5**

在 Phase 4 构建顺序铁律后新增两节：
```markdown
### 4.4 自定义字段语义填值（紧跟 4.3 phase_id 修复）
- 生成约定：自定义类型工作项的 blueprint 带 `properties`（**字段名**键、**人读值**：单选写选项文字、文本写串、日期写日期、成员写显示名）。模型不碰 key/`_id`。
- 写入：用 `scripts/pingcode_custom_fields.js`——4.3 回读每条工作项时顺带 `discoverTypeFields`（`.properties` keys ∩ catalog）→ `buildPropertiesPatch`（名→key、选项文字→`_id`、按类型格式化、跳过不适用字段）→ `applyPropertyValues` 并发 PATCH（可并进 4.3 同批 body）。
- 容错：非法选项回落合法默认+warn，绝不发非法 `_id`；类型无自定义字段→no-op。

### 4.5 自动加管理员（Phase 4 末尾，manifest 驱动）
- 用 `scripts/pingcode_admin.js` 的 `sweepAdmins(token, build_manifest, baseUrl, {formAdmin, sampleProjects, users})`：捞本轮新建的 project/wiki/ship/testhub（manifest 容器项）→ 解析 admin（表单优先，否则扫已有成员里的管理员）→ 并发 `addMember(role_id=管理员)`，幂等。
- admin 找不到且表单没填 → 整步跳过并在 Phase 5/6 告警，不瞎猜。
- manifest 需记录容器类型：`project / wiki_space / ship_product / test_library`。
```

- [ ] **Step 5: SKILL.md — Phase 5 增检查项**

在 Phase 5「数量达标」表加一行，并说明用 `checkCustomFieldFill`：
```markdown
| 项目工作项 | 自定义类型工作项的自定义字段填充率 | ≥90% |
```

- [ ] **Step 6: 通读自检 + Commit**

通读 4.4/4.5 与 §6 文件清单一致、函数名与 Task 1-7 导出一致（`resolvePropertyCatalog`/`discoverTypeFields`/`buildPropertiesPatch`/`applyPropertyValues`/`sweepAdmins`/`checkCustomFieldFill`）。
```bash
git add references/api.md SKILL.md
git commit -m "docs(skill): wire custom-field fill (4.4) + admin sweep (4.5) into flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（写计划后自查记录）

**Spec 覆盖：**
- §3.1 模型↔脚本分工 → Task 1/2（buildPropertiesPatch 名键人读值）✅
- §3.2 类型→字段发现 → Task 2 discoverTypeFields ✅
- §3.3 模块接口（resolvePropertyCatalog/discoverTypeFields/formatValue/applyPropertyValues）→ Task 1/2/3 ✅
- §3.4 落点（3.8 catalog、Phase 4 生成、4.4）→ Task 9 ✅
- §3.5 容错（非法选项回落、跳过不适用）→ Task 1/2 测试覆盖 ✅
- §4.1 admin 接口（resolveAdminUserId/resolveAdminRoleId/addAdmin/ADMIN_ROLE）→ Task 4/5（addMember 即 addAdmin 的通用版）✅
- §4.2 末尾 sweep（决策 X）→ Task 5 sweepAdmins + Task 9 4.5 ✅
- §4.3 容错（找不到跳过告警、单容器失败续跑、幂等）→ Task 5 测试 + addMember 幂等 ✅
- §5 幂等/manifest → Task 5 sweepAdmins 读 manifest；§5 的 props_done/admin_done 标记由执行 Phase 4 时落（SKILL.md 既有 manifest 机制），不新增脚本 ✅
- §6 文件清单 → Task 1-9 全覆盖 ✅
- §7 测试（单测 + 真实 E2E）→ Task 1-8 ✅

**Placeholder 扫描：** 无 TBD/TODO；每个 code step 均含完整代码。✅

**类型/命名一致性：** `resolvePropertyCatalog`/`discoverTypeFields`/`buildPropertiesPatch`/`formatValue`/`applyPropertyValues`/`moduleMembersEndpoint`/`pickAdminRoleId`/`tallyAdminUserId`/`containerModuleOf`/`listMembers`/`addMember`/`resolveAdminRoleId`/`resolveAdminUserId`/`sweepAdmins`/`checkCustomFieldFill` 在定义任务与 SKILL.md/E2E 引用处一致。✅

**注：** spec §3.4「properties 并进 4.3 同一 PATCH body」是优化项；本计划以独立 `applyPropertyValues` 实现（一次额外并发 PATCH），SKILL.md 4.4 注明可并入同批——功能等价，写值目标达成。
