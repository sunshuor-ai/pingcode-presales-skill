/**
 * fields.js — Web 自动化生产模块(纯本地 Playwright + 本机 Edge)
 * ============================================================
 * 读行业 types 配置 → 每类型跑完整流水:建类型(path①)→ 入混合项目流程(path②)→ 建字段(全局)→ 挂到类型。
 * 函数逻辑均来自已验证脚本(build_type/add_type_to_flow/build_attr/attach_attr/batch_type_fields)的 consolidation。
 *
 * 用法:
 *   node ui/fields.js --env=daocloud-test.pingcode.com --vertical=references/verticals/汽车电子.md \
 *        [--client_id=XXX --client_secret=YYY] [--only=风险项,合规检查项] [--headed]
 *
 * types 配置来源:vertical .md 里的 ```yaml types: ...``` 块(name / group / fields[{name,kind,options}])。
 * 铁律见 references/web_ops.md;凭证只走参数,绝不入库。
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
let yaml; try { yaml = require('js-yaml'); } catch { }

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const headed = 'headed' in args || args.headed === 'true';
const only = (args.only || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN = 'admin/product/pjm/configuration/work-item';
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const BASE = 'https://open.pingcode.com';
const DATA_ITEM = ['单选', '多选'];
const sleep = (p, ms) => p.waitForTimeout(ms);

function loadTypes(vp) {
  const md = fs.readFileSync(vp, 'utf8');
  const m = md.match(/```yaml([\s\S]*?)```/);
  if (!m || !yaml) throw new Error('未找到 yaml types 块或缺 js-yaml');
  return (yaml.load(m[1]).types) || [];
}
async function existingTypes() {
  if (!args.client_id) return [];
  const p = new URLSearchParams({ grant_type: 'client_credentials', client_id: args.client_id, client_secret: args.client_secret });
  const r = await fetch(`${BASE}/v1/auth/token?${p}`); const { access_token } = await r.json();
  const w = await fetch(`${BASE}/v1/project/work_item_types`, { headers: { Authorization: 'Bearer ' + access_token } });
  const d = await w.json(); return (Array.isArray(d) ? d : (d.values || [])).map(t => t.name);
}
async function realClick(page, loc) { if (!(await loc.count())) return false; const b = await loc.first().boundingBox(); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; }
// 屏外元素:打标记 + locator.click(自动滚入,不靠坐标)
async function tagClick(page, selectorFn) { await page.evaluate(selectorFn); await page.locator('[data-auto="x"]').click({ timeout: 8000 }).catch(() => { }); await page.evaluate(() => { const e = document.querySelector('[data-auto="x"]'); if (e) e.removeAttribute('data-auto'); }); }
async function clickRowAction(page, rowName, actionText) {
  return page.evaluate(({ rowName, actionText }) => {
    for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === rowName)) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li'); if (!row) continue;
      const act = [...row.querySelectorAll('a,span,button')].find(x => x.textContent.trim() === actionText);
      if (act) { act.click(); return true; }
    } return false;
  }, { rowName, actionText });
}
async function totalTypeCount(page) { const t = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => ''); const m = t.match(/(\d+)/); return m ? Number(m[1]) : null; }
async function attrCount(page, type) { return page.evaluate(t => { for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === t)) { const r = ne.closest('tr,.thy-sortable-item,[class*="row"],li'); if (r) { const m = r.textContent.match(/(\d+)\s*属性/); if (m) return Number(m[1]); } } return null; }, type); }
function clickOkInLastPane() { const panes = [...document.querySelectorAll('.cdk-overlay-pane')]; for (let i = panes.length - 1; i >= 0; i--) { const b = [...panes[i].querySelectorAll('button')].find(x => x.textContent.trim() === '确定'); if (b) { b.click(); return; } } }

// ---- path① 建类型 ----
async function createType(page, name, group) {
  if (await page.evaluate(t => [...document.querySelectorAll('span,a,div,td,li')].some(e => e.textContent.trim() === t), name)) return 'exists?'; // 表里可见的快速跳过(主查重靠 API)
  const before = await totalTypeCount(page);
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="workItemTypeName"]', { timeout: 8000 });
  await page.locator('input[name="workItemTypeName"]').click(); await page.keyboard.type(name, { delay: 40 });
  const sel = page.locator('.cdk-overlay-container thy-select').first(); let picked = false;
  for (let a = 0; a < 2 && !picked; a++) {
    const b = await sel.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('.cdk-overlay-pane .thy-option-item', { timeout: 5000 });
    await page.locator('.cdk-overlay-pane').last().locator('.thy-option-item').filter({ hasText: new RegExp(`^\\s*${group}\\s*$`) }).first().click();
    await sleep(page, 500); picked = (await sel.innerText()).includes(group);
  }
  await page.evaluate(clickOkInLastPane); await sleep(page, 1800);
  const after = await totalTypeCount(page);
  return after === before + 1 ? 'created' : 'check';
}
// ---- path② 入流程 ----
async function addToFlow(page, type) {
  if (await page.evaluate(t => [...document.querySelectorAll('span,a,div,td')].some(e => e.textContent.trim() === t), type)) return 'in-flow';
  await tagClick(page, () => { const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0); els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); }); if (els[0]) els[0].setAttribute('data-auto', 'x'); });
  await page.waitForSelector('text=添加类型', { timeout: 8000 }).catch(() => { }); await sleep(page, 700);
  await tagClick(page, () => { const p = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); const t = p && p.querySelector('thy-select'); if (t) t.setAttribute('data-auto', 'x'); });
  await sleep(page, 700); await page.keyboard.type(type, { delay: 50 }); await sleep(page, 1100);
  await page.locator('.cdk-overlay-pane').last().locator('.thy-option-item', { hasText: type }).first().click({ timeout: 5000 }).catch(() => { });
  await sleep(page, 600); await page.evaluate(clickOkInLastPane); await sleep(page, 1800); return 'added';
}
// ---- 建全局字段(已存在=exists)----
async function createField(page, f) {
  const [name, kind, items] = [f.name, f.kind, f.options];
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="propertyName"]', { timeout: 8000 });
  await page.locator('input[name="propertyName"]').click(); await page.keyboard.type(name, { delay: 30 });
  await page.locator('.cdk-overlay-container').getByText(kind, { exact: true }).first().click(); await sleep(page, 500);
  if (DATA_ITEM.includes(kind) && items) {
    const blur = async () => { const t = page.locator('.cdk-overlay-container').getByText('新建属性', { exact: true }).first(); const b = await t.boundingBox().catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
    for (const it of items) {
      await realClick(page, page.locator('.cdk-overlay-container button', { hasText: '添加数据项' }).last()); await sleep(page, 400);
      await realClick(page, page.locator('.cdk-overlay-container input[placeholder="输入数据项"]').last()); await page.keyboard.type(String(it), { delay: 40 }); await sleep(page, 150); await blur(); await sleep(page, 300);
    }
  }
  await page.evaluate(clickOkInLastPane); await sleep(page, 1500);
  const still = await page.locator('.cdk-overlay-container input[name="propertyName"]').count();
  if (still) { const dup = /已存在/.test(await page.locator('.cdk-overlay-container').innerText().catch(() => '')); await page.keyboard.press('Escape').catch(() => { }); await sleep(page, 400); return dup ? 'exists' : 'fail'; }
  return 'created';
}
// ---- 挂字段到当前类型(已在其属性与视图面板)----
async function attachField(page, name) {
  await tagClick(page, () => { const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0); els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); }); if (els[0]) els[0].setAttribute('data-auto', 'x'); });
  await page.waitForSelector('text=添加属性', { timeout: 8000 }).catch(() => { }); await sleep(page, 700);
  await tagClick(page, () => { const p = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); const t = p && p.querySelector('thy-select'); if (t) t.setAttribute('data-auto', 'x'); });
  await sleep(page, 700); await page.keyboard.type(name, { delay: 40 }); await sleep(page, 1100);
  const ok = await page.locator('.cdk-overlay-pane').last().locator('.thy-option-item', { hasText: name }).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
  await sleep(page, 600); await page.evaluate(clickOkInLastPane); await sleep(page, 1800); return ok;
}

(async () => {
  if (!env || !args.vertical) throw new Error('用法: --env=<租户> --vertical=<行业.md> [--client_id= --client_secret=] [--only=] [--headed]');
  let types = loadTypes(args.vertical);
  if (only.length) types = types.filter(t => only.includes(t.name));
  const have = await existingTypes();
  console.log(`[fields] ${args.vertical} → ${types.length} 类型;已存在(API): ${have.length}`);

  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: !headed, viewport: { width: 1440, height: headed ? 920 : 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const goto = async (p) => { await page.goto(`https://${env}/${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { }); await sleep(page, 3000); };

  for (const t of types) {
    console.log(`\n===== ${t.name}(${t.group},${(t.fields || []).length} 字段)=====`);
    // ① 建类型
    await goto(ADMIN);
    if (/signin|login/i.test(page.url())) { console.log('[x] 未登录,先 node ui/spike_connect.js --env=' + env + ' --wait=150'); break; }
    if (have.includes(t.name)) console.log('  类型已存在(API),跳过建');
    else console.log('  建类型 →', await createType(page, t.name, t.group));
    // ② 入流程
    await goto(TEMPLATES); await realClick(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => { }); await sleep(page, 1500);
    console.log('  入流程 →', await addToFlow(page, t.name));
    // ③ 建字段(工作项属性 tab)
    await goto(ADMIN); await realClick(page, page.locator('text="工作项属性"')); await sleep(page, 2000);
    for (const f of (t.fields || [])) console.log(`    字段「${f.name}」(${f.kind}) →`, await createField(page, f));
    // ④ 挂载(该类型属性与视图)
    await goto(TEMPLATES); await realClick(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => { }); await sleep(page, 1500);
    await clickRowAction(page, t.name, '配置'); await page.waitForSelector('text=属性与视图', { timeout: 8000 }).catch(() => { }); await sleep(page, 1500);
    await clickRowAction(page, '属性与视图', '配置'); await page.waitForSelector('text=显示视图配置', { timeout: 8000 }).catch(() => { }); await sleep(page, 1500);
    let okN = 0; for (const f of (t.fields || [])) { const ok = await attachField(page, f.name); if (ok) okN++; console.log(`    挂「${f.name}」→ ${ok ? 'ok' : 'fail'}`); }
    // 验证
    await goto(TEMPLATES); await realClick(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => { }); await sleep(page, 1500);
    console.log(`  [√] ${t.name}: 挂 ${okN}/${(t.fields || []).length},当前属性数 ${await attrCount(page, t.name)}`);
  }
  await ctx.close(); console.log('\n[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
