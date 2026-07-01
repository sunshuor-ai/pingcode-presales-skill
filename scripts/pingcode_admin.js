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
  const containers = ((manifest && manifest.items) || [])
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

module.exports = { ADMIN_ROLE_FALLBACK, moduleMembersEndpoint, containerModuleOf,
  pickAdminRoleId, tallyAdminUserId,
  listMembers, addMember, resolveAdminRoleId, resolveAdminUserId, sweepAdmins };
