const RANK = { skeleton: 0, doc: 1, meeting: 2 };
function rankOf(source) {
  const k = String(source || '').split(':')[0];
  return RANK[k] ?? 0;
}

let _seq = 0;
function newFactId() { return 'f' + Date.now().toString(36) + (_seq++).toString(36); }

// 高权威赢 value+status；同级 incoming(晚) 赢；低权威(rank<) 保持原 fact
function mergeFact(existing, patch) {
  if (rankOf(patch.source) >= rankOf(existing.source)) {
    return {
      ...existing,
      value: patch.value ?? existing.value,
      status: patch.status,
      source: patch.source,
      authority: patch.authority ?? existing.authority,
    };
  }
  return existing;
}

// 按 path 匹配；命中→merge，未命中→追加(分配 id)
function applyPatches(store, patches) {
  for (const p of patches) {
    const i = store.facts.findIndex(f => f.path === p.path);
    if (i >= 0) {
      store.facts[i] = mergeFact(store.facts[i], p);
    } else {
      store.facts.push({ id: p.id || newFactId(), authority: null, ...p });
    }
  }
  return store;
}

module.exports = { rankOf, mergeFact, applyPatches, newFactId };
