/**
 * 贴合回路 · 底账导出器（最后一公里）
 * 从已搭好的 PingCode 环境一键生成 {客户}_context.json + {客户}_build_manifest.json，
 * 让修订模式(来活了，改环境)不必再手攒底账。
 * 用法: node pingcode_fit_export.js --client_id=$PINGCODE_CLIENT_ID --client_secret=$PINGCODE_CLIENT_SECRET \
 *        --identifier=JLALED [--client=客户名] [--out=输出前缀]
 */
const fs = require('node:fs');
const api = require('./pingcode_api.js');

// 纯函数: 已建工作项列表 → { context, manifest }
// items: [{ id, title, parentId }]（parentId 不在集合内 → 当根节点）
// factId 由 work item id 稳定派生（'wi_'+id），复跑同结果，便于增量复用。
function buildContextFromItems(items, opts = {}) {
  const byId = new Map(items.map(it => [it.id, it]));
  const pathCache = new Map();
  function pathOf(it) {
    if (pathCache.has(it.id)) return pathCache.get(it.id);
    pathCache.set(it.id, it.title);                 // 先占位, 防自/互引用死循环
    const parent = it.parentId != null ? byId.get(it.parentId) : null;
    const p = parent ? `${pathOf(parent)}/${it.title}` : it.title;
    pathCache.set(it.id, p);
    return p;
  }
  const facts = [];
  const manifest = {};
  for (const it of items) {
    const factId = 'wi_' + it.id;
    const path = pathOf(it);
    // 导出的是「已建骨架」基线: source=skeleton/status=guess（最低权威，
    // 后续 doc/meeting 补丁可覆盖；值与 manifest 一致 → 立即复跑渲染为空, 幂等）
    facts.push({ id: factId, path, kind: 'work_item', value: it.title,
      source: 'skeleton', status: 'guess', authority: null });
    manifest[factId] = { id: it.id, value: it.title, path };
  }
  const context = { client: opts.client || '', identifier: opts.identifier || '',
    facts, pending_review: [] };
  return { context, manifest };
}

// 薄网络封装: 拉真实环境 → 归一化工作项 → 交给纯函数
async function exportContext(token, identifier, opts = {}, baseUrl) {
  const proj = (await api.listProjects(token, baseUrl)).find(p => p.identifier === identifier);
  if (!proj) throw new Error(`未找到环境 identifier=${identifier}`);
  const raw = await api.listWorkItems(token, proj.id, baseUrl);
  const items = raw.map(w => ({ id: w.id, title: w.title,
    parentId: w.parent_id != null ? w.parent_id : (w.parentId != null ? w.parentId : null) }));
  return buildContextFromItems(items, { client: opts.client || identifier, identifier });
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
  if (!args.identifier || !args.client_id || !args.client_secret) {
    console.error('用法: --client_id=$PINGCODE_CLIENT_ID --client_secret=$PINGCODE_CLIENT_SECRET --identifier=JLALED [--client=客户名] [--out=前缀]');
    process.exit(1);
  }
  const { token } = await api.getToken(args.client_id, args.client_secret);
  const { context, manifest } = await exportContext(token, args.identifier, { client: args.client });
  const base = args.out || args.client || args.identifier;
  fs.writeFileSync(`${base}_context.json`, JSON.stringify(context, null, 2));
  fs.writeFileSync(`${base}_build_manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(`导出 ${context.facts.length} 个工作项 → ${base}_context.json + ${base}_build_manifest.json`);
}

if (require.main === module) main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
module.exports = { buildContextFromItems, exportContext };
