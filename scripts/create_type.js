/**
 * 独立脚本：创建自定义工作项类型 + 字段（puppeteer v25）
 * 用法：node create_type.js
 */
const puppeteer = require('puppeteer');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ENV = 'daocloud-test.pingcode.com';
const BASE = `https://${ENV}`;
const T = (ms) => new Promise(r => setTimeout(r, ms));

// puppeteer 辅助：按文本找元素点击
async function clickText(page, text) {
  await page.evaluate((t) => {
    const all = document.querySelectorAll('a, button, span, div');
    for (const el of all) {
      if (el.children.length === 0 && el.textContent.trim() === t) {
        el.click(); return;
      }
    }
  }, text);
}

// ======== 类型定义 ========
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
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // ======== 1. 登录 ========
  console.log('[1] 登录...');
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle2', timeout: 30000 });
  await T(2000);

  // 切密码登录
  try { await clickText(page, '帐号密码登录'); await T(1000); } catch (_) {}

  // 填账号密码
  const inputs = await page.$$('input');
  await inputs[0].click({ clickCount: 3 });
  await inputs[0].type('manager3477');
  await inputs[1].click({ clickCount: 3 });
  await inputs[1].type('pc12345');
  await T(500);

  // 登录
  await clickText(page, '登录');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await T(2000);
  console.log('[1] OK: ' + page.url());

  // ======== 2. 创建类型 ========
  console.log('[2] 创建: ' + TYPE.name);
  await page.goto(`${BASE}/admin/product/pjm/configuration/work-item`, { waitUntil: 'networkidle2', timeout: 30000 });
  await T(2000);

  await clickText(page, '新建');
  await T(1500);

  // 名称
  const nameInput = await page.waitForSelector('input[placeholder="输入名称"]');
  await nameInput.click({ clickCount: 3 });
  await nameInput.type(TYPE.name);
  await T(300);

  // 图标
  const iconLinks = await page.$$('a[href="javascript:;"]');
  if (iconLinks.length > 5) await iconLinks[5].click();
  await T(300);

  // 分组
  await page.evaluate(() => {
    const selects = document.querySelectorAll('thy-select');
    for (const s of selects) {
      if (s.textContent.includes('选择分组')) { s.click(); return; }
    }
  });
  await T(500);
  await page.keyboard.type('任务');
  await T(300);
  await page.keyboard.press('Enter');
  await T(500);

  // 确定
  await clickText(page, '确定');
  await T(2000);
  console.log('[2] OK');

  // ======== 3. 加入混合项目流程 ========
  console.log('[3] 加入流程...');
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle2', timeout: 30000 });
  await T(2000);

  // 点混合项目流程
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const r of rows) {
      if (r.textContent.includes('混合项目流程')) { r.click(); return; }
    }
  });
  await T(2000);

  // 添加
  await clickText(page, '添加');
  await T(1500);

  // 选类型
  await page.evaluate(() => {
    const selects = document.querySelectorAll('thy-select');
    for (const s of selects) {
      if (s.textContent.includes('选择类型')) { s.click(); return; }
    }
  });
  await T(500);
  await page.keyboard.type(TYPE.name);
  await T(300);
  await page.keyboard.press('Enter');
  await T(500);

  await clickText(page, '确定');
  await T(2000);
  console.log('[3] OK');

  // ======== 4. 配置字段 ========
  console.log('[4] 配置' + TYPE.fields.length + '个字段...');

  // 重新进入流程页并展开类型配置
  await page.goto(`${BASE}/admin/product/pjm/configuration/templates`, { waitUntil: 'networkidle2', timeout: 30000 });
  await T(2000);

  await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const r of rows) {
      if (r.textContent.includes('混合项目流程')) { r.click(); return; }
    }
  });
  await T(2000);

  // 展开目标类型的配置
  await page.evaluate((name) => {
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      if (row.textContent.includes(name)) {
        const links = row.querySelectorAll('a');
        for (const a of links) {
          if (a.textContent.trim() === '配置') { a.click(); return true; }
        }
      }
    }
  }, TYPE.name);
  await T(1500);

  // 点属性与视图 配置
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      if (row.textContent.includes('属性与视图') && row.textContent.includes('设置事项的自定义属性')) {
        const links = row.querySelectorAll('a');
        for (const a of links) {
          if (a.textContent.trim() === '配置') { a.click(); return true; }
        }
      }
    }
  });
  await T(2000);

  // 逐个创建字段
  for (const field of TYPE.fields) {
    console.log('  字段: ' + field.name + ' [' + field.type + ']');

    await clickText(page, '添加');
    await T(1000);

    await clickText(page, '创建新属性');
    await T(1000);

    // 名称
    const fInput = await page.waitForSelector('input[placeholder="输入名称"]');
    await fInput.click({ clickCount: 3 });
    await fInput.type(field.name);
    await T(300);

    // 类型
    await clickText(page, field.type);
    await T(500);

    // 数据项（单选/多选）
    if (field.options) {
      for (const opt of field.options) {
        await clickText(page, '添加数据项');
        await T(300);
        const allInputs = await page.$$('input:not([disabled]):not([type="hidden"])');
        const last = allInputs[allInputs.length - 1];
        if (last) {
          await last.click({ clickCount: 3 });
          await last.type(opt);
          await T(200);
          await page.keyboard.press('Enter');
          await T(200);
        }
      }
    }

    await clickText(page, '确定');
    await T(1500);
  }

  console.log('[4] OK');
  console.log('\n=== DONE: ' + TYPE.name + ' + ' + TYPE.fields.length + ' fields ===');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('[FAIL]', e.message); process.exit(1); });
