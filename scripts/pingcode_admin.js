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
