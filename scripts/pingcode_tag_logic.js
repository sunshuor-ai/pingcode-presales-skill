/**
 * 标签纯逻辑（可单测，无网络）：词典锚定抽词 + 关键词匹配
 */
const norm = s => (s || '').toString().toLowerCase();
const hayOf = it => norm(it.title) + '  ' + norm(it.description);

// 词典锚定抽标签: dict 词在工作项 title+description 出现的工作项数 ≥min, 按频降序取前 max
function extractTags(workItems, dict, { min = 2, max = 12 } = {}) {
  const counted = dict.map(term => {
    const t = norm(term);
    const n = workItems.filter(w => hayOf(w).includes(t)).length;
    return { term, n };
  }).filter(x => x.n >= min);
  counted.sort((a, b) => b.n - a.n || dict.indexOf(a.term) - dict.indexOf(b.term));
  return counted.slice(0, max).map(x => x.term);
}

// 关键词匹配: 工作项 title|description 含某标签词(子串,大小写无关) → 贴该标签
function matchTags(item, tagList) {
  const hay = hayOf(item);
  return tagList.filter(tag => hay.includes(norm(tag)));
}

module.exports = { extractTags, matchTags, norm, hayOf };
