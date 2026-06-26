/**
 * 贴合回路修订 CLI
 * 用法: node pingcode_revise.js --client_id=.. --client_secret=.. --identifier=JLALED \
 *        --context=客户_context.json [--from-doc=reqs.xlsx | --from-followup=会谈.md] [--dry]
 */
const fs = require('node:fs');
const api = require('./pingcode_api.js');
const store = require('./pingcode_fit_store.js');
const { renderPlan } = require('./pingcode_fit_render.js');

function planToPreview(plan) {
  const L = [`计划: 增 ${plan.create.length} / 改 ${plan.update.length} / 删 ${plan.delete.length}`];
  plan.create.forEach(c => L.push(`  + ${c.value}`));
  plan.update.forEach(u => L.push(`  ~ → ${u.value}`));
  plan.delete.forEach(d => L.push(`  - ${d.objId}`));
  return L.join('\n');
}

// manifest: { <factId>: { id, value, path } }；path→objId 索引用于父定位
function parentPathOf(p) { return p.split('/').slice(0, -1).join('/'); }

async function applyPlan(token, plan, baseUrl, manifest, facts) {
  const pathToObj = {};
  for (const f of facts) if (manifest[f.id]) pathToObj[f.path] = manifest[f.id].id;
  let done = { create:0, update:0, del:0, skip:0 };

  for (const f of plan.create) {
    if (f.kind !== 'work_item') { console.warn(`跳过(MVP仅work_item): ${f.value}`); done.skip++; continue; }
    const parentId = pathToObj[parentPathOf(f.path)];
    const wi = await api.createWorkItem(token, { projectId: process.env.FIT_PROJECT_ID,
      typeId: 'task', title: f.value, parentId, description: f.value }, baseUrl);
    manifest[f.id] = { id: wi.id, value: f.value, path: f.path };
    pathToObj[f.path] = wi.id; done.create++;
  }
  for (const u of plan.update) {
    await api.updateWorkItem(token, u.objId, { title: u.value }, baseUrl);
    manifest[u.factId].value = u.value; done.update++;
  }
  for (const d of plan.delete) {
    // 护栏: 只删 manifest 里 fact 关联的对象
    const known = Object.values(manifest).some(m => m.id === d.objId);
    if (!known) { console.warn(`跳过删除(不在 manifest): ${d.objId}`); done.skip++; continue; }
    await api.deleteWorkItem(token, d.objId, baseUrl);
    delete manifest[d.factId]; done.del++;
  }
  return done;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
  const DRY = 'dry' in args;
  if (!args.context || !args.identifier) {
    console.error('用法: --client_id=.. --client_secret=.. --identifier=.. --context=ctx.json [--from-doc=.. | --from-followup=..] [--dry]');
    process.exit(1);
  }
  const ctx = JSON.parse(fs.readFileSync(args.context, 'utf8'));
  const manifestPath = args.context.replace(/_context\.json$/, '_build_manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

  // 适配器产补丁(运行期: 自由文本→分类项 由调用方/LLM 预处理后传入 *.patches.json)
  if (args['from-doc'] || args['from-followup']) {
    const pf = (args['from-doc'] || args['from-followup']) + '.patches.json';
    if (fs.existsSync(pf)) {
      const { patches = [], pending_review = [] } = JSON.parse(fs.readFileSync(pf, 'utf8'));
      store.applyPatches(ctx, patches);
      ctx.pending_review = (ctx.pending_review || []).concat(pending_review);
    } else {
      console.warn(`未找到 ${pf}（运行期由适配器/LLM 生成补丁，见 references/fit_loop.md）`);
    }
  }

  const plan = renderPlan(ctx.facts, manifest);
  console.log(planToPreview(plan));
  if (ctx.pending_review?.length) console.log(`\n⚠ 待裁定 ${ctx.pending_review.length} 条(pending_review)`);

  if (DRY) { console.log('\n[dry-run] 未写入。'); return; }
  if (!plan.create.length && !plan.update.length && !plan.delete.length) { console.log('\n无变更(幂等)，跳过。'); return; }

  const { token } = await api.getToken(args.client_id, args.client_secret);
  const proj = (await api.listProjects(token)).find(p => p.identifier === args.identifier);
  process.env.FIT_PROJECT_ID = proj.id;
  const done = await applyPlan(token, plan, undefined, manifest, ctx.facts);
  fs.writeFileSync(args.context, JSON.stringify(ctx, null, 2));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n落地: 增 ${done.create} / 改 ${done.update} / 删 ${done.del} / 跳过 ${done.skip}。store+manifest 已回写。`);
}

if (require.main === module) main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
module.exports = { planToPreview, applyPlan, parentPathOf };
