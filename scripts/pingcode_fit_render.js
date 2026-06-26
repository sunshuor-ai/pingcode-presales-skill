// (facts, manifest) → {create, update, delete}; 纯函数, 无网络
// manifest: { <factId>: { id, value, path } }
function renderPlan(facts, manifest) {
  const plan = { create: [], update: [], delete: [] };
  for (const f of facts) {
    const built = manifest[f.id];
    if (f.status === 'rejected') {
      if (built) plan.delete.push({ factId: f.id, objId: built.id });
    } else if (!built) {
      plan.create.push(f);
    } else if (f.value !== built.value) {     // 值漂移 → 改
      plan.update.push({ factId: f.id, objId: built.id, value: f.value });
    }
  }
  return plan;
}

module.exports = { renderPlan };
