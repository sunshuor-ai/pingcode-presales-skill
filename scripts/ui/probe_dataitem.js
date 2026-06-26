/**
 * 探针(只读):钉死「单选数据项」文本框的真实选择器
 * 新建属性 → 名称 → 单选 → 点一次添加数据项 → dump 数据项区所有 input 的全属性
 * 用法: node ui/probe_dataitem.js --env=daocloud-test.pingcode.com
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.locator('text="工作项属性"').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="propertyName"]', { timeout: 8000 });
  await page.locator('input[name="propertyName"]').click();
  await page.keyboard.type('探数据项_勿存', { delay: 30 });
  await page.locator('.cdk-overlay-container').getByText('单选', { exact: true }).first().click();
  await page.waitForTimeout(800);

  // 真实鼠标点一次「添加数据项」
  const addBtn = page.locator('.cdk-overlay-container button', { hasText: '添加数据项' }).last();
  const bb = await addBtn.boundingBox();
  if (bb) await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(800);

  // dump 所有 input 全属性
  const inputs = await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container');
    return [...root.querySelectorAll('input')].map(i => ({
      type: i.type, name: i.getAttribute('name'), ph: i.placeholder || null,
      cls: i.className.slice(0, 50), value: i.value,
    }));
  });
  console.log('弹窗所有 input:'); inputs.forEach((x, i) => console.log(`  [${i}]`, JSON.stringify(x)));

  // dump「数据项」区附近的 HTML 结构(找文本框容器)
  const areaHtml = await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container');
    const txt = root.textContent;
    // 找含"数据项"的容器,打印其 outerHTML 片段
    const all = [...root.querySelectorAll('*')];
    const node = all.find(el => /数据项/.test(el.textContent) && el.querySelectorAll('input').length <= 3 && el.children.length < 12);
    return node ? node.outerHTML.slice(0, 1200) : '(未定位数据项容器)';
  });
  console.log('\n数据项区 HTML 片段:\n', areaHtml);

  await page.screenshot({ path: path.join(shotDir, `dataitem_probe_${Date.now()}.png`) });
  await page.keyboard.press('Escape').catch(() => {});
  await ctx.close();
  console.log('\n[done] 只读,零改动');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
