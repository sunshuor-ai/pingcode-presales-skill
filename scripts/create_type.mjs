const { chromium } = require('playwright');
const ENV = 'daocloud-test.pingcode.com';
const BASE = `https://${ENV}`;

async function clickText(page, text) {
  await page.evaluate((t) => {
    const all = document.querySelectorAll('a,button,span,div');
    for (const el of all) {
      if (el.children.length === 0 && el.textContent.trim() === t) {
        el.click(); return;
      }
    }
  }, text);
}

const TYPE = {
  name: '设备报修工单',
  fields: [
    { type: '下拉单选', name: '报修类型', options: ['设备故障', '软件故障', '定期维保', '紧急事故'] },
    { type: '多行文本', name: '影响科室' },
    { type: '下拉单选', name: '预计修复时长', options: ['1小时内', '4小时内', '24小时内', '48小时内'] },
    { type: '日期', name: '报修日期' },
  ]
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const T = (ms) => page.waitForTimeout(ms);

  // Login
  console.log('[1] login');
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
  await T(2000);
  try { await clickText(page, '帐号密码登录'); await T(1000); } catch (_) {}
  const inputs = await page.$$('input');
  await inputs[0].fill('manager3477');
  await inputs[1].fill('pc12345');
  await T(500);
  await clickText(page, '登录');
  await page.waitForURL('**/workspace/**', { timeout: 20000 }).catch(() => {});
  await T(2000);
  console.log('[1] OK');

  // Navigate to types page
  console.log('[2] create ' + TYPE.name);
  await page.goto(`${BASE}/admin/product/pjm/configuration/work-item`, { waitUntil: 'networkidle' });
  await T(2000);

  // Click 新建
  await clickText(page, '新建');
  await T(1500);

  // Fill name
  await page.getByPlaceholder('输入名称').fill(TYPE.name);
  await T(300);

  // Random icon
  const iconLinks = await page.$$('a[href="javascript:;"]');
  if (iconLinks.length > 5) await iconLinks[5].click();
  await T(300);

  // Group
  await page.locator('thy-select').filter({ hasText: '选择分组' }).last().click();
  await T(500);
  await page.keyboard.type('任务');
  await T(300);
  await page.keyboard.press('Enter');
  await T(500);

  // Confirm
  await clickText(page, '确定');
  await T(2000);
  console.log('[2] OK');

  // Add to workflow
  console.log('[3] add to workflow');
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle' });
  await T(2000);
  await page.locator('tr').filter({ hasText: '混合项目流程' }).click();
  await T(2000);
  await clickText(page, '添加');
  await T(1500);
  await page.locator('thy-select').filter({ hasText: '选择类型' }).last().click();
  await T(500);
  await page.keyboard.type(TYPE.name);
  await T(300);
  await page.keyboard.press('Enter');
  await T(500);
  await clickText(page, '确定');
  await T(2000);
  console.log('[3] OK');

  // Configure fields
  console.log('[4] ' + TYPE.fields.length + ' fields');
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle' });
  await T(2000);
  await page.locator('tr').filter({ hasText: '混合项目流程' }).click();
  await T(2000);

  // Expand type config
  await page.evaluate((name) => {
    for (const row of document.querySelectorAll('tr')) {
      if (row.textContent.includes(name)) {
        for (const a of row.querySelectorAll('a')) {
          if (a.textContent.trim() === '配置') { a.click(); return; }
        }
      }
    }
  }, TYPE.name);
  await T(1500);

  // Click 属性与视图 配置
  await page.locator('tr').filter({ hasText: '属性与视图' }).locator('a:has-text("配置")').click();
  await T(2000);

  for (const field of TYPE.fields) {
    console.log('  ' + field.name);
    await clickText(page, '添加');
    await T(1000);
    await clickText(page, '创建新属性');
    await T(1000);

    await page.getByPlaceholder('输入名称').fill(field.name);
    await T(300);

    await page.locator(`text=${field.type}`).first().click();
    await T(500);

    if (field.options) {
      for (const opt of field.options) {
        await clickText(page, '添加数据项');
        await T(300);
        await page.getByPlaceholder('输入数据项').fill(opt);
        await T(200);
        await page.keyboard.press('Enter');
        await T(200);
      }
    }

    await clickText(page, '确定');
    await T(1500);
  }

  console.log('[4] OK');
  console.log('DONE: ' + TYPE.name);
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
