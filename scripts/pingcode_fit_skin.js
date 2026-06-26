const xlsx = require('xlsx');

// .xlsx 首个 sheet → 行对象数组(首行表头)
function parseXlsx(file) {
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { defval: '' });
}

// items: [{ value, hintPath, raw }] —— hintPath 由运行期 LLM 据骨架 path 列表判定
// 命中骨架槽 → confirmed/doc 补丁; 不命中 → pending_review
function skinToPatches(items, skeletonPaths, file) {
  const known = new Set(skeletonPaths);
  const patches = [], pending_review = [];
  items.forEach((it, i) => {
    if (it.hintPath && known.has(it.hintPath)) {
      patches.push({ path: it.hintPath, value: it.value, kind: 'work_item',
        source: `doc:${file}#${i}`, status: 'confirmed' });
    } else {
      pending_review.push({ raw: it.raw ?? it.value, from: `doc:${file}#${i}`,
        why: `条目映射不到骨架槽(hintPath=${it.hintPath || '无'})，待裁定` });
    }
  });
  return { patches, pending_review };
}

module.exports = { parseXlsx, skinToPatches };
