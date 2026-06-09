const pw = require('playwright');

(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: false });
  const page = await browser.newPage();
  const T = (ms) => page.waitForTimeout(ms);
  const BASE = 'https://daocloud-test.pingcode.com';

  // Login
  console.log('login...');
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
  await T(3000);
  // Switch to password login if needed
  try { await page.locator('text=帐号密码登录').click({ timeout: 3000 }); await T(1000); } catch (_) {}
  const inputs = await page.$$('input');
  await inputs[0].fill('manager3477');
  await inputs[1].fill('pc12345');
  await T(500);
  await page.locator('button:has-text("登录")').click({ force: true });
  await T(5000); // wait for redirect
  console.log('URL: ' + page.url());

  // Create type
  console.log('create type...');
  await page.goto(`${BASE}/admin/product/pjm/configuration/work-item`, { waitUntil: 'networkidle', timeout: 30000 });
  await T(3000);
  await page.locator('button:has-text("新建")').last().click({ force: true });
  await T(2000);

  await page.locator('input[placeholder="输入名称"]').fill('设备报修工单', { timeout: 10000 });
  await T(500);
  // 用 evaluate 随机选图标，绕过 CDK overlay
  await page.evaluate(() => {
    const links = document.querySelectorAll('a[href="javascript:;"]');
    // 跳过前2个（通常是操作按钮），选第2-10个之间的图标
    const icons = Array.from(links).filter((l, i) => i > 1 && i < 15 && l.querySelector('img'));
    if (icons.length > 0) icons[0].click();
  });
  await T(300);
  await page.locator('thy-select').filter({ hasText: '选择分组' }).last().click({ force: true });
  await T(500);
  await page.keyboard.type('任务');
  await T(300);
  await page.keyboard.press('Enter');
  await T(1000); // wait for dropdown to close
  await page.locator('button:has-text("确定")').last().click({ force: true });
  await T(2000);
  console.log('OK');

  // Add to workflow
  console.log('add to workflow...');
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle', timeout: 30000 });
  await T(3000);
  await page.locator('tr').filter({ hasText: '混合项目流程' }).click({ force: true });
  await T(2000);
  await page.locator('button:has-text("添加")').last().click({ force: true });
  await T(1500);
  await page.locator('thy-select').filter({ hasText: '选择类型' }).last().click({ force: true });
  await T(500);
  await page.keyboard.type('设备报修工单');
  await T(300);
  await page.keyboard.press('Enter');
  await T(500);
  await page.locator('button:has-text("确定")').last().click({ force: true });
  await T(2000);
  console.log('OK');

  // Config fields
  const FIELDS = [
    { name: '报修类型', type: '下拉单选', opts: ['设备故障', '软件故障', '定期维保', '紧急事故'] },
    { name: '影响科室', type: '多行文本' },
    { name: '预计修复时长', type: '下拉单选', opts: ['1小时内', '4小时内', '24小时内', '48小时内'] },
    { name: '报修日期', type: '日期' },
  ];

  console.log('fields...');
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle', timeout: 30000 });
  await T(3000);
  await page.locator('tr').filter({ hasText: '混合项目流程' }).click({ force: true });
  await T(2000);

  // Expand config
  await page.locator('tr').filter({ hasText: '设备报修工单' }).locator('a:has-text("配置")').click({ force: true });
  await T(2000);
  await page.locator('tr').filter({ hasText: '属性与视图' }).locator('a:has-text("配置")').click({ force: true });
  await T(2000);

  for (const f of FIELDS) {
    console.log('  ' + f.name);
    await page.locator('button:has-text("添加")').last().click({ force: true });
    await T(1000);
    await page.locator('text=创建新属性').click({ force: true });
    await T(1000);
    await page.locator('input[placeholder="输入名称"]').fill(f.name, { timeout: 5000 });
    await T(300);
    await page.locator(`text=${f.type}`).first().click({ force: true });
    await T(500);

    if (f.opts) {
      for (const o of f.opts) {
        await page.locator('text=添加数据项').click({ force: true });
        await T(300);
        await page.locator('input[placeholder="输入数据项"]').fill(o, { timeout: 3000 });
        await T(200);
        await page.keyboard.press('Enter');
        await T(200);
      }
    }

    await page.locator('button:has-text("确定")').last().click({ force: true });
    await T(1500);
  }

  console.log('DONE! 10秒后自动关闭...');
  await T(10000);
  await browser.close();
  process.exit(0);
})().catch(async e => {
  console.error('FAIL: ' + e.message);
  console.log('浏览器保持打开30秒，查看问题...');
  await new Promise(r => setTimeout(r, 30000));
  process.exit(1);
});
