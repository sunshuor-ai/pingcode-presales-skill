/**
 * 把全局属性挂到工作项类型(用户给的序列,实测打通)
 * 全部流程 → 混合项目流程 → [类型行「配置」] → [属性与视图行「配置」] → 右上「添加」
 *   → 「添加属性」弹窗:选择属性下拉(搜索+多选)→ 点空白收起 → 确定 → 验证详情面板出现
 * 用法: node ui/attach_attr.js --env=daocloud-test.pingcode.com --type=任务 --props="紧急程度_可删,影响模块_可删"
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const targetType = args.type || '任务';
const props = (args.props || '').split(',').map(s => s.trim()).filter(Boolean);
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const TEMPLATES = 'admin/product/pjm/configuration/templates';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `attachdo_${t}_${Date.now()}.png`);

async function rc(page, locator, label) {
  const el = locator.first();
  if (!(await el.count())) { console.log(`  [miss] ${label}`); return false; }
  const b = await el.boundingBox().catch(() => null);
  if (!b) { console.log(`  [no-box] ${label}`); return false; }
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true;
}
async function clickRowAction(page, rowName, actionText) {
  const c = await page.evaluate(({ rowName, actionText }) => {
    const names = [...document.querySelectorAll('span,a,div,td,li')].filter(e => e.textContent.trim() === rowName);
    for (const ne of names) {
      const row = ne.closest('tr, .thy-sortable-item, [class*="row"], li'); if (!row) continue;
      const act = [...row.querySelectorAll('a,span,button')].find(x => x.textContent.trim() === actionText);
      if (act) { const r = act.getBoundingClientRect(); if (r.width) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    }
    return null;
  }, { rowName, actionText });
  if (!c) { console.log(`  [miss] 行「${rowName}」→「${actionText}」`); return false; }
  await page.mouse.click(c.x, c.y); return true;
}

(async () => {
  if (!env || !props.length) throw new Error('用法: --env= --type=任务 --props="属性1,属性2"');
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${TEMPLATES}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3500);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  console.log(`[1] 混合项目流程 → 「${targetType}」配置 → 属性与视图配置 ...`);
  const r0 = await rc(page, page.getByText('混合项目流程', { exact: true }), '混合项目流程');
  await page.waitForSelector('text=工作项类型', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r1 = await clickRowAction(page, targetType, '配置');
  console.log(`  混合项目流程=${r0} 任务配置=${r1}`);
  await page.waitForSelector('text=属性与视图', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r2 = await clickRowAction(page, '属性与视图', '配置');
  console.log(`  属性与视图配置=${r2}`);
  await page.waitForSelector('text=显示视图配置', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log('[2] 右上「添加」开「添加属性」弹窗 ...');
  // 右上角"+添加":x 最大,同 x 取 y 最小(最顶)——探针实测正确选法
  const addCoord = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button,a,span,div')].filter(e => e.textContent.trim() === '添加' && e.getBoundingClientRect().width > 0);
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (rb.x - ra.x) || (ra.y - rb.y); });
    const r = els[0]?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  console.log('  选用添加:', JSON.stringify(addCoord));
  if (addCoord) await page.mouse.click(addCoord.x, addCoord.y);
  await page.waitForSelector('text=添加属性', { timeout: 8000 }).catch(() => console.log('  warn: 未确认到添加属性弹窗'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot('after_add_click') });

  console.log('[3] 打开「选择属性」下拉(精确定位下拉框,排除标签)...');
  const ddCoord = await page.evaluate(() => {
    const pane = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); if (!pane) return null;
    let trig = pane.querySelector('thy-select');
    if (!trig) {
      const cand = [...pane.querySelectorAll('div,span,input')].filter(e => /选择属性/.test((e.textContent || '') + (e.placeholder || '')) && e.getBoundingClientRect().width > 60);
      trig = cand.find(e => /select|choice|form-control/.test(e.className)) || cand[cand.length - 1];
    }
    if (!trig) return null;
    const r = trig.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, cls: trig.className.slice(0, 30), tag: trig.tagName };
  });
  console.log('  下拉框:', JSON.stringify(ddCoord));
  if (ddCoord) await page.mouse.click(ddCoord.x, ddCoord.y);
  await page.waitForTimeout(900);

  for (const p of props) {
    console.log(`  搜索并选「${p}」...`);
    await page.keyboard.type(p, { delay: 50 });            // 真实键盘搜索(下拉打开后输入框聚焦)
    await page.waitForTimeout(1300);
    // 诊断:下拉浮层里到底有啥 input / option
    const dump = await page.evaluate(() => {
      const pane = [...document.querySelectorAll('.cdk-overlay-pane')].pop(); if (!pane) return null;
      return {
        inputs: [...pane.querySelectorAll('input')].map(i => ({ ph: i.placeholder, val: i.value, cls: i.className.slice(0, 22) })),
        options: [...pane.querySelectorAll('.thy-option-item,.thy-list-option,thy-option,[class*=option],li')].map(e => ({ tag: e.tagName, cls: e.className.slice(0, 28), txt: e.textContent.trim().slice(0, 16) })).slice(0, 8),
      };
    });
    console.log('    下拉pane:', JSON.stringify(dump));
    // thy-select 选项:用 locator.click()(正经事件派发+自动滚入),不用 mouse 坐标
    const opt = page.locator('.cdk-overlay-pane').last().locator('.thy-option-item', { hasText: p }).first();
    await opt.click({ timeout: 5000 }).then(() => console.log(`    [选项 click ok] ${p}`)).catch(e => console.log('    [选项 click fail]', e.message));
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot('after_opt') });
    // 读下拉框是否已显示选中 chip
    const picked = await page.evaluate(() => { const s = [...document.querySelectorAll('thy-select')].pop(); return s ? s.textContent.trim().slice(0, 40) : null; });
    console.log('    下拉框现状:', JSON.stringify(picked));
    // 不要 Ctrl+A/Delete——焦点在带 chip 的下拉里会把已选 chip 删掉。多选时下个 p 直接 type 即可(thy-select 选后自动清搜索词)。
  }

  console.log('[4] 不点空白(任何点击都清 chip),保留选择直接确定 ...');
  const chipNow = await page.evaluate(() => { const s = [...document.querySelectorAll('thy-select')].pop(); return s ? s.textContent.trim().slice(0, 40) : null; });
  console.log('  确定前 chip:', JSON.stringify(chipNow));
  await page.screenshot({ path: shot('before_ok') });

  console.log('[5] 确定 ...');
  await page.evaluate(() => {
    const panes = [...document.querySelectorAll('.cdk-overlay-pane')];
    for (let i = panes.length - 1; i >= 0; i--) {
      const b = [...panes[i].querySelectorAll('button')].find(x => x.textContent.trim() === '确定');
      if (b) { b.click(); return; }
    }
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shot('after') });

  console.log('[6] 验证:详情面板是否出现这些属性 ...');
  for (const p of props) {
    const seen = await page.locator(`text=${p}`).count();
    console.log(`  「${p}」详情面板出现: ${seen > 0 ? '✓' : '✗ (看截图)'}`);
  }
  await ctx.close();
  console.log('[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
