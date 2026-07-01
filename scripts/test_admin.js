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

test('memberAddBody: project/testhub 用 user_id，wiki/ship 用 member 对象（实测契约）', () => {
  assert.deepStrictEqual(A.memberAddBody('project','u1','r'), { user_id:'u1', role_id:'r' });
  assert.deepStrictEqual(A.memberAddBody('testhub','u1','r'), { user_id:'u1', role_id:'r' });
  assert.deepStrictEqual(A.memberAddBody('wiki','u1','r'), { member:{ id:'u1', type:'user' }, role_id:'r' });
  assert.deepStrictEqual(A.memberAddBody('ship','u1','r'), { member:{ id:'u1', type:'user' }, role_id:'r' });
});

test('addMember: 按模块发对应 body 形状', async () => {
  const sent = {};
  const fake = async (url, opts) => { sent[url] = JSON.parse(opts.body); return { status:200, text: async()=>'{}' }; };
  await A.addMember('t','wiki','s1','u1','r','https://b', fake);
  await A.addMember('t','project','p1','u1','r','https://b', fake);
  assert.deepStrictEqual(sent['https://b/v1/wiki/spaces/s1/members'], { member:{ id:'u1', type:'user' }, role_id:'r' });
  assert.deepStrictEqual(sent['https://b/v1/project/projects/p1/members'], { user_id:'u1', role_id:'r' });
});
