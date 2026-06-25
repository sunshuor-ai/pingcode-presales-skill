/**
 * 标签自动打标 — 对已建项目扫内容抽标签并贴到工作项
 * 用法: node pingcode_tag_apply.js --client_id=.. --client_secret=.. --identifier=JLALED [--industry=汽车电子] [--min=2] [--max=12] [--dry]
 */
const api = require('./pingcode_api.js');
const L = require('./pingcode_tag_logic.js');
const tagsDict = require('./pingcode_tags.js');
const fs = require('fs');
const path = require('path');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const DRY = 'dry' in args;
const MIN = +(args.min || 2), MAX = +(args.max || 12);

// 行业模板「术语」行 → 词
function verticalTerms(industry) {
  if (!industry) return [];
  const f = path.join(__dirname, '..', 'references', 'verticals', industry + '.md');
  if (!fs.existsSync(f)) return [];
  const m = fs.readFileSync(f, 'utf8').match(/-\s*术语\s*[:：]\s*(.+)/);
  return m ? m[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
}

function buildDictionary(industry) {
  const ind = (tagsDict.INDUSTRY_TERMS && tagsDict.INDUSTRY_TERMS[industry]) || [];
  const def = tagsDict.INDUSTRY_DEFAULT || [];
  return [...new Set([...verticalTerms(industry), ...ind, ...def])];
}

(async () => {
  if (!args.client_id || !args.client_secret || !args.identifier) {
    console.error('用法: --client_id=.. --client_secret=.. --identifier=项目标识 [--industry=汽车电子] [--min=2] [--max=12] [--dry]');
    process.exit(1);
  }
  const { token } = await api.getToken(args.client_id, args.client_secret);
  const proj = (await api.listProjects(token)).find(p => p.identifier === args.identifier);
  if (!proj) { console.error('未找到项目', args.identifier); process.exit(1); }
  const items = await api.listWorkItems(token, proj.id);
  console.log(`[OK] 项目 ${args.identifier}, 工作项 ${items.length}, 行业 ${args.industry || '(未指定,用通用词典)'}`);

  const dict = buildDictionary(args.industry);
  const tagNames = L.extractTags(items, dict, { min: MIN, max: MAX });
  console.log(`抽出标签(${tagNames.length}): ${tagNames.join(' / ') || '(无,降低--min试试)'}`);
  if (!tagNames.length) return;

  // 建标签(幂等): 同名复用
  const existing = await api.listTags(token, proj.id);
  const byName = {}; existing.forEach(t => byName[t.name] = t.id);
  let created = 0;
  for (const name of tagNames) {
    if (byName[name]) continue;
    if (DRY) { byName[name] = 'DRY'; created++; continue; }
    const t = await api.createTag(token, { name, projectId: proj.id, color: '#1890ff' });
    byName[name] = t.id; created++; await api.sleep(120);
  }
  console.log(`标签: 新建 ${created}, 复用 ${tagNames.length - created}`);

  // 贴标(并发, 幂等跳过已贴)
  const jobs = [];
  for (const it of items) {
    const has = new Set((it.tags || []).map(t => t.name));
    for (const name of L.matchTags(it, tagNames)) {
      if (!has.has(name)) jobs.push({ wid: it.id, name, tagId: byName[name] });
    }
  }
  let done = 0, fail = 0;
  if (!DRY) {
    const r = await api.batchCreateParallel(jobs, j => api.addWorkItemTag(token, j.wid, j.tagId), { concurrency: 10 });
    done = r.ok; fail = r.fail;
  } else done = jobs.length;

  const tagged = new Set(jobs.map(j => j.wid)).size;
  console.log(`\n=== ${DRY ? '(预览) ' : ''}贴标 ${done}/${jobs.length} 条, 覆盖 ${tagged}/${items.length} 工作项 (${Math.round(tagged / items.length * 100)}%)${fail ? ', 失败 ' + fail : ''} ===`);
  const per = {}; jobs.forEach(j => per[j.name] = (per[j.name] || 0) + 1);
  Object.entries(per).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  ${n}: ${c}`));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
