/**
 * 探针:学"属性挂到类型"(行级定位版)
 * templates → 混合项目流程 → [任务行的「配置」] → [属性与视图行的「配置」] → 显示视图配置「添加」→ 选属性弹窗(dump)
 * 到打开「添加」弹窗为止,不点确定。用法: node ui/probe_attach.js --env=daocloud-test.pingcode.com [--type=任务]
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const targetType = args.type || '任务';
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `attach_${t}_${Date.now()}.png`);

async function rc(page, locator, label) {
  const el = locator.first();
  if (!(await el.count())) { console.log(`  [miss] ${label}`); return false; }
  const b = await el.boundingBox().catch(() => null);
  if (!b) { console.log(`  [no-box] ${label}`); return false; }
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); console.log(`  [click] ${label}`); return true;
}

// 找"名字恰好=rowName"的行,点该行内文字=actionText 的操作(真实鼠标)
async function clickRowAction(page, rowName, actionText) {
  const coords = await page.evaluate(({ rowName, actionText }) => {
    const nameEls = [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === rowName);
    for (const ne of nameEls) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li');
      if (!row) continue;
      const act = [...row.querySelectorAll('a,span,button')].find(x => x.textContent.trim() === actionText);
      if (act) { const r = act.getBoundingClientRect(); if (r.width) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    }
    return null;
  }, { rowName, actionText });
  if (!coords) { console.log(`  [miss] 行「${rowName}」→「${actionText}」`); return false; }
  await page.mouse.click(coords.x, coords.y); console.log(`  [click] 行「${rowName}」→「${actionText}」`); return true;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3500);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  console.log('[1] 进「混合项目流程」...');
  await rc(page, page.getByText('混合项目流程', { exact: true }), '混合项目流程');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('A_flow') });

  console.log(`[2] 点「${targetType}」行的「配置」...`);
  await clickRowAction(page, targetType, '配置');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shot('B_typecfg') });
  // dump 任务配置面板的子项(应有 工作流/属性与视图/提醒/通知/权限)
  const subItems = await page.evaluate(() => [...new Set([...document.querySelectorAll('span,a,div,li,td')].map(e => e.textContent.trim()).filter(t => /工作流|属性与视图|提醒|通知|权限/.test(t) && t.length < 10))]);
  console.log('  类型配置子项:', JSON.stringify(subItems));

  console.log('[3] 点「属性与视图」行的「配置」...');
  let ok = await clickRowAction(page, '属性与视图', '配置');
  if (!ok) ok = await rc(page, page.getByText('属性与视图', { exact: true }), '属性与视图(直接点)');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shot('C_displaycfg') });

  console.log('[4] 显示视图配置 右上「添加」(按位置选 x 最大的)...');
  const addCoord = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
    if (!els.length) return null;
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); });
    const r = els[0].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, n: els.length, tag: els[0].tagName };
  });
  console.log('  添加候选:', JSON.stringify(addCoord));
  if (addCoord) await page.mouse.click(addCoord.x, addCoord.y);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: shot('D_add_dialog') });

  // dump 最新 overlay-pane(新弹窗)
  const dlg = await page.evaluate(() => {
    const panes = [...document.querySelectorAll('.cdk-overlay-pane')];
    const root = panes[panes.length - 1] || document;
    const q = (s) => [...root.querySelectorAll(s)];
    return {
      paneCount: panes.length,
      title: [...new Set(q('[class*="title"],.thy-dialog-header-title,h3').map(e => e.textContent.trim()).filter(Boolean))].slice(0, 3),
      inputs: q('input').map(i => ({ ph: i.placeholder || null, cls: i.className.slice(0, 30) })),
      buttons: [...new Set(q('button').map(b => b.textContent.trim()).filter(Boolean))].slice(0, 8),
      sampleOptions: [...new Set(q('.thy-list-option,.thy-option-item,label,li,td').map(e => e.textContent.trim()).filter(Boolean))].slice(0, 10),
    };
  });
  console.log('  添加弹窗(最新pane):', JSON.stringify(dlg));

  await page.keyboard.press('Escape').catch(() => {});
  await ctx.close();
  console.log('[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
