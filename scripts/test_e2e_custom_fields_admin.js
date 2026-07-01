// Real E2E against daocloud-test (build-and-delete). Skips without PINGCODE_CLIENT_ID.
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
const CONTAINERS = {
  project: '691adde7b2447dbb688d1349',            // 测试瀑布
  wiki:    '6a27eb10d9a9e9625bd21ed3',            // 工程运维手册
  ship:    '67a3657a42012b855324f9be',            // 业务需求池
  testhub: '67a3657a2bbc7b058ab988ec',            // 示例测试库
};
const CAND_USERS = ['6abd4476dbd14d409235615ee5977821','9ea3529874a448dbaf5c54813f394bd6',
  '60be5fbd4d2d4e129fc75da704a2d789','ee51126b044449f390d5c58cad305df8'];

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

test('E2E #2: 四模块加管理员→readback role 校验→还原', { skip: !RUN }, async () => {
  const t = await token();
  const roleId = await A.resolveAdminRoleId(t, BASE, [CONTAINERS.project]);
  assert.strictEqual(roleId, A.ADMIN_ROLE_FALLBACK, '管理员 role 应为统一常量');
  for (const [mod, cid] of Object.entries(CONTAINERS)) {
    const members = await A.listMembers(t, mod, cid, BASE);
    const existing = new Set(members.map(m => m.user && m.user.id));
    const testUser = CAND_USERS.find(u => !existing.has(u));
    assert.ok(testUser, `${mod} 需要一个非成员测试用户`);
    try {
      const add = await A.addMember(t, mod, cid, testUser, roleId, BASE);
      assert.strictEqual(add.ok, true, `${mod} addMember 应成功`);
      const after = await A.listMembers(t, mod, cid, BASE);
      const m = after.find(x => x.user && x.user.id === testUser);
      assert.ok(m && m.role && m.role.name === '管理员', `${mod} 加后应为管理员`);
    } finally {
      await api(t, 'DELETE', A.moduleMembersEndpoint(mod, cid) + '/' + testUser);
    }
  }
});
