/**
 * 有头:开窗导航到「添加属性」弹窗,然后交给用户手动操作,脚本周期截图记录正确手势。
 * 用法: node ui/manual_attach.js --env=daocloud-test.pingcode.com --type=任务 --secs=90
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const targetType = args.type || '任务'; const secs = Number(args.secs || 90);
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
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1500, height: 940 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  console.log('导航:混合项目流程 → 任务配置 → 属性与视图配置 → 添加 ...');
  await rc(page, page.getByText('混合项目流程', { exact: true })); await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
  await clickRowAction(page, targetType, '配置'); await page.waitForSelector('text=属性与视图', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
  await clickRowAction(page, '属性与视图', '配置'); await page.waitForSelector('text=显示视图配置', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
  const addCoord = await page.evaluate(() => { const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0); els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); }); const r = els[0]?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
  if (addCoord) await page.mouse.click(addCoord.x, addCoord.y);
  await page.waitForSelector('text=添加属性', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);

  console.log('\n================ 该你了 ================');
  console.log('窗口已停在「添加属性」弹窗。请手动:打开「选择属性」→ 选 紧急程度_可删 →（你的收尾手势）→ 确定');
  console.log(`脚本会在 ${secs}s 内每 6s 截一张图记录。慢慢来。`);
  const n = Math.floor(secs / 6);
  for (let i = 1; i <= n; i++) {
    await page.waitForTimeout(6000);
    const f = path.join(shotDir, `manual_${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f }).catch(() => {});
    process.stdout.write(`  [shot ${i}/${n}] `);
  }
  console.log('\n[done] 截图结束');
  await ctx.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
