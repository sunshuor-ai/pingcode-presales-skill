/**
 * 只读:验证某类型的「属性与视图·显示视图配置」详情面板是否含指定属性
 * 用法: node ui/verify_attach.js --env=daocloud-test.pingcode.com --type=任务 --props="颜色多选_可删,颜色单选_可删"
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const targetType = args.type || '任务';
const props = (args.props || '').split(',').map(s => s.trim()).filter(Boolean);
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });

async function rc(page, locator) { const el = locator.first(); if (!(await el.count())) return false; const b = await el.boundingBox().catch(() => null); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; }
async function clickRowAction(page, rowName, actionText) {
  const c = await page.evaluate(({ rowName, actionText }) => {
    for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === rowName)) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li'); if (!row) continue;
      const act = [...row.querySelectorAll('a,span,button')].find(x => x.textContent.trim() === actionText);
      if (act) { const r = act.getBoundingClientRect(); if (r.width) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    } return null;
  }, { rowName, actionText });
  if (!c) return false; await page.mouse.click(c.x, c.y); return true;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await rc(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);

  // 顺便读 任务 行的「N属性」
  const attrCount = await page.evaluate((t) => {
    for (const ne of [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === t)) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li'); if (!row) continue;
      const m = row.textContent.match(/(\d+)\s*属性/); if (m) return m[1];
    } return null;
  }, targetType);
  console.log(`「${targetType}」行显示: ${attrCount} 属性`);

  await clickRowAction(page, targetType, '配置'); await page.waitForSelector('text=属性与视图', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
  await clickRowAction(page, '属性与视图', '配置'); await page.waitForSelector('text=显示视图配置', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shotDir, `verify_attach_${Date.now()}.png`), fullPage: true });

  const bodyText = await page.evaluate(() => document.body.innerText);
  for (const p of props) console.log(`  「${p}」在详情面板: ${bodyText.includes(p) ? '✓ 已挂载' : '✗ 未找到'}`);
  await ctx.close();
  console.log('[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
