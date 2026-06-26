/**
 * 提速版(单会话 + 有头 + CSS缩放):给一个工作项类型建字段并挂载
 * 一次开浏览器 → 工作项属性tab建字段(已存在跳过)→ 流程详情该类型属性与视图 → 逐字段开"添加"挂(不重导航)
 * 有头 + body.zoom 缩页面,解决高弹窗/右上按钮被屏幕截断;坐标在缩放空间内一致。
 * 用法: node ui/batch_type_fields.js --env=daocloud-test.pingcode.com --type=合规检查项
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const targetType = args.type;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const ZOOM = Number(args.zoom || 0.67);
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });

// 各类型字段定义  [名称, 类型, 数据项(单/多选用), 颜色, 多成员]
const TYPE_FIELDS = {
  '合规检查项': [
    ['适用标准', '多选', ['ISO 26262', 'IATF 16949', 'AEC-Q100', 'ECE R148', 'ISO 16750']],
    ['检查结论', '单选', ['符合', '轻微不符合', '严重不符合']],
    ['不符合描述', '多行文本'], ['整改期限', '日期'], ['整改负责人', '成员'],
  ],
  '失效分析': [
    ['分析类型', '单选', ['DFMEA', 'PFMEA']], ['失效模式', '多行文本'],
    ['严重度S', '数字'], ['发生度O', '数字'], ['探测度D', '数字'], ['RPN', '数字'], ['改进措施', '多行文本'],
  ],
  '功能安全项': [
    ['ASIL等级', '单选', ['QM', 'A', 'B', 'C', 'D']], ['安全目标', '多行文本'], ['安全机制', '多行文本'],
  ],
  'DV试验项': [
    ['试验类型', '单选', ['DV', 'PV', 'EMC', '环境', '可靠性', '配光光学']],
    ['试验标准', '单行文本'], ['样件批次', '单行文本'], ['试验结论', '单选', ['通过', '有条件', '不通过']],
  ],
  '8D质量问题': [
    ['问题等级', '单选', ['A', 'B', 'C']], ['8D进展', '单选', ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']],
    ['根本原因', '多行文本'], ['纠正预防措施', '多行文本'],
  ],
};
const DATA_ITEM = ['单选', '多选'];
const sleep = (p, ms) => p.waitForTimeout(ms);
async function zoom(page) { await page.evaluate((z) => { document.body.style.zoom = z; }, ZOOM).catch(() => {}); }
async function realClick(page, loc) { if (!(await loc.count())) return false; const b = await loc.first().boundingBox(); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; }
async function clickRowAction(page, rowName, actionText) {
  return page.evaluate(({ rowName, actionText }) => {
    for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === rowName)) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li'); if (!row) continue;
      const act = [...row.querySelectorAll('a,span,button')].find(x => x.textContent.trim() === actionText);
      if (act) { act.click(); return true; }
    } return false;
  }, { rowName, actionText });
}

// ---- 建一个全局字段属性(已存在则跳过)----
async function createField(page, [name, type, items]) {
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="propertyName"]', { timeout: 8000 });
  await page.locator('input[name="propertyName"]').click(); await page.keyboard.type(name, { delay: 30 });
  await page.locator('.cdk-overlay-container').getByText(type, { exact: true }).first().click();
  await sleep(page, 500);
  if (DATA_ITEM.includes(type) && items) {
    const addBtn = () => page.locator('.cdk-overlay-container button', { hasText: '添加数据项' }).last();
    const di = () => page.locator('.cdk-overlay-container input[placeholder="输入数据项"]');
    const blur = async () => { const t = page.locator('.cdk-overlay-container').getByText('新建属性', { exact: true }).first(); const b = await t.boundingBox().catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
    for (const it of items) { await realClick(page, addBtn()); await sleep(page, 400); await realClick(page, di().last()); await page.keyboard.type(it, { delay: 40 }); await sleep(page, 150); await blur(); await sleep(page, 300); }
  }
  await page.evaluate(() => { const b = [...document.querySelectorAll('.cdk-overlay-container button')].filter(x => x.textContent.trim() === '确定').pop(); if (b) b.click(); });
  await sleep(page, 1500);
  const still = await page.locator('.cdk-overlay-container input[name="propertyName"]').count();
  if (still) { const txt = await page.locator('.cdk-overlay-container').innerText().catch(() => ''); const dup = /已存在/.test(txt); await page.keyboard.press('Escape').catch(() => {}); await sleep(page, 400); return dup ? 'exists' : 'fail'; }
  return 'created';
}

// ---- 把一个字段挂到当前类型(已在其属性与视图面板)----
async function attachField(page, name) {
  // 右上「添加」:evaluate 标记右上角那个 + locator.click(自动滚入,不靠坐标/不怕屏外)
  await page.evaluate(() => { const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0); els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); }); if (els[0]) els[0].setAttribute('data-auto', 'addbtn'); });
  await page.locator('[data-auto="addbtn"]').click({ timeout: 8000 }).catch(e => console.log('    [添加 click fail]', e.message));
  await page.evaluate(() => { const e = document.querySelector('[data-auto="addbtn"]'); if (e) e.removeAttribute('data-auto'); });
  await page.waitForSelector('text=添加属性', { timeout: 8000 }).catch(() => {});
  await sleep(page, 700);
  // thy-select:标记 + locator.click 打开(自动滚入)
  await page.evaluate(() => { const pane = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); const t = pane && pane.querySelector('thy-select'); if (t) t.setAttribute('data-auto', 'dd'); });
  await page.locator('[data-auto="dd"]').click({ timeout: 5000 }).catch(e => console.log('    [下拉 click fail]', e.message));
  await page.evaluate(() => { const e = document.querySelector('[data-auto="dd"]'); if (e) e.removeAttribute('data-auto'); });
  await sleep(page, 700);
  await page.keyboard.type(name, { delay: 40 }); await sleep(page, 1100);
  const opt = page.locator('.cdk-overlay-pane').last().locator('.thy-option-item', { hasText: name }).first();
  const ok = await opt.click({ timeout: 5000 }).then(() => true).catch(() => false);
  await sleep(page, 600);
  await page.evaluate(() => { const panes = [...document.querySelectorAll('.cdk-overlay-pane')]; for (let i = panes.length - 1; i >= 0; i--) { const b = [...panes[i].querySelectorAll('button')].find(x => x.textContent.trim() === '确定'); if (b) { b.click(); return; } } });
  await sleep(page, 1800);
  return ok;
}
async function attrCount(page, type) { return page.evaluate((t) => { for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === t)) { const row = ne.closest('tr,.thy-sortable-item,[class*="row"],li'); if (row) { const m = row.textContent.match(/(\d+)\s*属性/); if (m) return Number(m[1]); } } return null; }, type); }

(async () => {
  const fields = TYPE_FIELDS[targetType];
  if (!fields) throw new Error('未知类型,可选: ' + Object.keys(TYPE_FIELDS).join('/'));
  const t0 = Date.now();
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 920 } });
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log(`\n=== ${targetType}:建 ${fields.length} 字段 ===`);
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(page, 3000); await zoom(page);
  await realClick(page, page.locator('text="工作项属性"')); await sleep(page, 2000); await zoom(page);
  for (const f of fields) { const r = await createField(page, f); console.log(`  字段「${f[0]}」(${f[1]}) → ${r}`); await zoom(page); }

  console.log(`\n=== ${targetType}:挂载(此段不缩放,坐标用真值;添加/下拉走 locator 自动滚入)===`);
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(page, 3000);
  await realClick(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {}); await sleep(page, 1500);
  const r1 = await clickRowAction(page, targetType, '配置'); await page.waitForSelector('text=属性与视图', { timeout: 8000 }).catch(() => {}); await sleep(page, 1500);
  const r2 = await clickRowAction(page, '属性与视图', '配置'); await page.waitForSelector('text=显示视图配置', { timeout: 8000 }).catch(() => {}); await sleep(page, 1500);
  const onPanel = await page.evaluate(() => /显示视图配置/.test(document.body.innerText) && /属性配置/.test(document.body.innerText));
  console.log(`  导航: ${targetType}配置=${r1} 属性与视图配置=${r2} 在面板=${onPanel}`);
  await page.screenshot({ path: path.join(shotDir, `batchfields_navcheck_${Date.now()}.png`) });
  const before = await page.evaluate(() => null); // 面板内拿不到行计数,用挂后回流程页对比
  let okN = 0;
  for (const f of fields) { const ok = await attachField(page, f[0]); console.log(`  挂「${f[0]}」→ ${ok ? 'ok' : 'fail'}`); if (ok) okN++; }

  // 验证:回流程页读该类型属性数
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(page, 2500);
  await realClick(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {}); await sleep(page, 2000);
  const cnt = await attrCount(page, targetType);
  await page.screenshot({ path: path.join(shotDir, `batchfields_${targetType}_${Date.now()}.png`) });
  console.log(`\n[done] ${targetType}: 挂载 ${okN}/${fields.length},当前属性数 ${cnt},耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await sleep(page, 2000);
  await ctx.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
