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
