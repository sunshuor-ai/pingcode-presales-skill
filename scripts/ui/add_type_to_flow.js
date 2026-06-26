/**
 * path②:把工作项类型加进「混合项目流程」(探+试建一体,带 dump)
 * 流程详情 → 右上「添加」→「添加类型」弹窗(搜索框+列表)→ 搜+选+确定 → 验证类型入流程
 * 用法: node ui/add_type_to_flow.js --env=daocloud-test.pingcode.com --type=风险项
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const type = args.type || '风险项';
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `addtype_${t}_${Date.now()}.png`);

async function rc(page, locator) { const el = locator.first(); if (!(await el.count())) return false; const b = await el.boundingBox().catch(() => null); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; }
// 流程详情里该类型是否已存在(行级)
async function typeInFlow(page, name) {
  return await page.evaluate((name) => [...document.querySelectorAll('span,a,div,td')].some(e => e.textContent.trim() === name), name);
}

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  console.log('[1] 进混合项目流程 ...');
  await rc(page, page.getByText('混合项目流程', { exact: true }));
  await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2000);

  if (await typeInFlow(page, type)) { console.log(`[=] 「${type}」已在流程里,跳过`); await ctx.close(); return; }

  console.log('[2] 点流程详情右上「添加」(x最大y最小)...');
  const addCoord = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0);
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); });
    const r = els[0]?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  console.log('  添加:', JSON.stringify(addCoord));
  if (addCoord) await page.mouse.click(addCoord.x, addCoord.y);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('dialog') });

  // dump 添加类型弹窗结构
  const dlg = await page.evaluate(() => {
    const pane = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); if (!pane) return null;
    return {
      title: [...new Set([...pane.querySelectorAll('h3,[class*=title]')].map(e => e.textContent.trim()).filter(Boolean))].slice(0, 3),
      inputs: [...pane.querySelectorAll('input')].map(i => ({ ph: i.placeholder, cls: i.className.slice(0, 25) })),
      items: [...new Set([...pane.querySelectorAll('.thy-option-item,.thy-list-option,li,[class*=option],label')].map(e => e.textContent.trim()).filter(Boolean))].slice(0, 10),
      buttons: [...new Set([...pane.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean))].slice(0, 6),
    };
  });
  console.log('  添加类型弹窗:', JSON.stringify(dlg));

  console.log(`[3] 打开类型下拉(thy-select)+ 搜 + 选「${type}」...`);
  const ddCoord = await page.evaluate(() => {
    const pane = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); if (!pane) return null;
    const trig = pane.querySelector('thy-select') || [...pane.querySelectorAll('div,span')].find(e => /选择.*类型/.test(e.textContent) && e.getBoundingClientRect().width > 80);
    if (!trig) return null; const r = trig.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  console.log('  类型下拉:', JSON.stringify(ddCoord));
  if (ddCoord) await page.mouse.click(ddCoord.x, ddCoord.y);
  await page.waitForTimeout(800);
  await page.keyboard.type(type, { delay: 50 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot('searched') });
  const opt = page.locator('.cdk-overlay-pane').last().locator('.thy-option-item', { hasText: type }).first();
  await opt.click({ timeout: 5000 }).then(() => console.log('  [选项 click ok]')).catch(e => console.log('  [选项 click fail]', e.message));
  await page.waitForTimeout(700);
  const chip = await page.evaluate(() => { const s = [...document.querySelectorAll('thy-select')].pop(); return s ? s.textContent.trim().slice(0, 30) : null; });
  console.log('  下拉现状:', JSON.stringify(chip));

  console.log('[4] 确定 ...');
  await page.evaluate(() => { const panes = [...document.querySelectorAll('.cdk-overlay-pane')]; for (let i = panes.length - 1; i >= 0; i--) { const b = [...panes[i].querySelectorAll('button')].find(x => x.textContent.trim() === '确定'); if (b) { b.click(); return; } } });
  await page.waitForTimeout(2500);

  console.log('[5] 验证 ...');
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);
  await rc(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2000);
  console.log(`  「${type}」在流程里: ${await typeInFlow(page, type) ? '✓ 已加入' : '✗ 未找到'}`);
  await ctx.close(); console.log('[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
