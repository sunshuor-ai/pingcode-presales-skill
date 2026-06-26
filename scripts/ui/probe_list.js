/**
 * 探针(只读):看清类型列表页 —— 总数计数 / 搜索框真相 / 是否有重复
 * 用法: node ui/probe_list.js --env=daocloud-test.pingcode.com [--q=E2E验收]
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env; const q = args.q || 'E2E验收';
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);

  // 1. 总数计数文本
  const countText = await page.locator(':text("个工作项类型")').first().innerText().catch(() => '(未找到计数)');
  console.log('计数文本:', countText);

  // 2. 所有 input 的 placeholder(找真实搜索框)
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ ph: i.placeholder || null, type: i.type, cls: i.className.slice(0, 40) })));
  console.log('页面 input 们:', JSON.stringify(inputs, null, 0));

  // 3. 当前表体可见行里出现几次 q(查重复 / 虚拟滚动影响)
  const bodyText = (await page.locator('.thy-table-body').allInnerTexts()).join('\n');
  const visibleHits = (bodyText.match(new RegExp(q, 'g')) || []).length;
  console.log(`表体可见行中 "${q}" 出现次数:`, visibleHits);

  // footer "共 N 条" 当可靠计数
  const total0 = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => '(无)');
  console.log('footer 计数(搜索前):', total0);

  // 4. 精确用列表过滤框 Ctrl+G(class input-search-control),看能否跨页过滤
  const searchInput = page.locator('input.input-search-control').first();
  console.log('Ctrl+G 框命中数:', await searchInput.count(), 'placeholder:', await searchInput.getAttribute('placeholder').catch(() => null));
  await searchInput.click();                 // 真实点击聚焦
  await page.keyboard.type(q, { delay: 60 }); // 真实键盘敲,触发 ngx-tethys 的 keyup 过滤
  await page.waitForTimeout(1800);
  const total1 = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => '(无)');
  const bodyAfter = (await page.locator('.thy-table-body').allInnerTexts()).join(' ');
  const hitName = (bodyAfter.match(new RegExp(q, 'g')) || []).length;
  console.log(`  搜索 "${q}" 后 footer:`, total1, `| 表体出现 "${q}" 次数:`, hitName, '(没变=搜索框不过滤)');

  // 5. deterministic:翻到第 2 页读真实行
  console.log('[翻页] 点 thy-pagination 第 2 页 ...');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.locator('thy-pagination').getByText('2', { exact: true }).first().click().catch(e => console.log('  翻页 warn:', e.message));
  await page.waitForTimeout(2000);
  const p2 = (await page.locator('.thy-table-body').allInnerTexts()).join('\n');
  const p2names = p2.split('\n').map(s => s.trim()).filter(s => s && !/^(系统|孙硕|编辑|删除|操作于|名称|操作)/.test(s) && !/^\d/.test(s));
  console.log('  第 2 页行(过滤后):', JSON.stringify(p2names.slice(0, 25)));
  console.log(`  第 2 页含 "${q}":`, p2.includes(q));
  await page.screenshot({ path: path.join(shotDir, `probe_page2_${Date.now()}.png`) });
  await ctx.close();
  console.log('[done] 只读探针结束');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
