const STATUS_OF = { confirm: 'confirmed', correct: 'corrected', reject: 'rejected', add: 'confirmed' };

// classified: [{ op:'confirm'|'correct'|'reject'|'add', path, value?, kind?, raw }]
// 命中 path 的 confirm/correct/reject → 补丁; 未命中 → pending_review; add → 新 path 补丁
function reactionToPatches(classified, facts, meetingDate) {
  const source = 'meeting:' + meetingDate;
  const known = new Set(facts.map(f => f.path));
  const patches = [], pending_review = [];
  for (const c of classified) {
    const status = STATUS_OF[c.op];
    if (c.op === 'add') {
      patches.push({ path: c.path, value: c.value, kind: c.kind || 'work_item', source, status });
      continue;
    }
    if (!known.has(c.path)) {
      pending_review.push({ raw: c.raw, from: source, why: `反应匹配不到 fact(path=${c.path})，待裁定` });
      continue;
    }
    const patch = { path: c.path, source, status };
    if (c.value !== undefined) patch.value = c.value;
    patches.push(patch);
  }
  return { patches, pending_review };
}

module.exports = { reactionToPatches };
