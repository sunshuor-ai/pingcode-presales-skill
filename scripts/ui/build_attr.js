/**
 * 段 B 学习:在「工作项属性」全局库真建一个单选属性(含数据项)→ 确定 → 验证
 * ===============================================================
 * 单选流程(实测):填名 → 点单选卡(exact) → 内联「数据项」→ 逐个「添加数据项」录值 → 确定。无「下一步」。
 * 验证:footer 计数差 +1。弹窗没关 → 读真实报错。
 * 用法: node ui/build_attr.js --env=daocloud-test.pingcode.com --name="学习_单选_可删" --type=单选 --items="高,中,低"
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const name = args.name || '学习_单选_可删';
const type = args.type || '单选';
const items = (args.items || '高,中,低').split(',').map(s => s.trim()).filter(Boolean);
const enableColor = args.color === 'on' || args.color === '1';  // 单/多选:打开"是否开启自定义颜色"
const multiMember = args.multi === 'on' || args.multi === '1';  // 成员:打开"允许选择多个成员"
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `attrbuild_${t}_${Date.now()}.png`);

async function attrCount(page) {
  // 优先 footer「共 N 条」,兜底「N 个属性」
  let t = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => '');
  let m = t.match(/(\d+)/);
  if (!m) { t = await page.locator('text=/\\d+\\s*个属性/').first().innerText().catch(() => ''); m = t.match(/(\d+)/); }
  return m ? Number(m[1]) : null;
}

(async () => {
  if (!env) throw new Error('用法: node ui/build_attr.js --env=<租户>.pingcode.com --name=<名> --type=单选 --items="A,B,C"');
  // headless:视口不受物理屏幕限制,高弹窗能整屏渲染,底部按钮可点;登录态已存 profile,无头照样登录
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1400 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3000);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  console.log('[1] 切「工作项属性」tab ...');
  await page.locator('text="工作项属性"').first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const before = await attrCount(page);
  console.log('  建前属性数:', before);

  console.log(`[2] 新建 → 填名「${name}」→ 点「${type}」卡 ...`);
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="propertyName"]', { timeout: 8000 });
  await page.locator('input[name="propertyName"]').click();
  await page.keyboard.type(name, { delay: 30 });
  await page.locator('.cdk-overlay-container').getByText(type, { exact: true }).first().click();
  await page.waitForTimeout(800);

  // 校验只选中了目标类型卡(防 exact 误触)
  const selectedCards = await page.locator('.cdk-overlay-container [class*="active"], .cdk-overlay-container [class*="selected"]').allInnerTexts().catch(() => []);
  console.log('  选中卡片(粗读):', JSON.stringify(selectedCards.map(s => s.replace(/\s+/g, '')).filter(Boolean).slice(0, 4)));

  await page.screenshot({ path: shot('after_pick') });

  // 需要数据项的类型才录;简单类型(单/多行文本·数字·日期·成员·进度·评分·链接·引用)跳过
  const DATA_ITEM_TYPES = ['单选', '多选', '级联单选', '级联多选'];
  if (DATA_ITEM_TYPES.includes(type) && items.length) {
    console.log(`[3] 录 ${items.length} 个数据项(每项:添加数据项→真实输入→点空白失焦提交,不按Enter): ${items.join('/')} ...`);
    const realClick = async (loc) => { if (!(await loc.count())) return false; const b = await loc.boundingBox(); if (!b) return false; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; };
    const dataInputs = () => page.locator('.cdk-overlay-container input[placeholder="输入数据项"]');  // probe 实测:数据项文本框
    const addBtn = () => page.locator('.cdk-overlay-container button', { hasText: '添加数据项' }).last();
    // 点弹窗空白处(标题区)使输入框失焦提交——只提交、不留 Enter 那种空行
    const blurCommit = async () => {
      const title = page.locator('.cdk-overlay-container').getByText('新建属性', { exact: true }).first();
      const b = await title.boundingBox().catch(() => null);
      if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };

    // 打开「是否开启自定义颜色」开关(thy-switch,真实鼠标点)
    if (enableColor) {
      const sw = page.locator('.cdk-overlay-container thy-switch').first();
      const sb = await sw.boundingBox().catch(() => null);
      if (sb) await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.waitForTimeout(500);
      const on = await page.evaluate(() => { const i = document.querySelector('.cdk-overlay-container input.thy-switch-input'); return i ? i.checked : null; });
      console.log('  自定义颜色开关 →', on);
    }

    for (const it of items) {
      const added = await realClick(addBtn());          // 每项开一新空行
      await page.waitForTimeout(500);
      const inp = dataInputs().last();
      await realClick(inp);
      await page.keyboard.type(it, { delay: 50 });       // 真实键盘输入
      await page.waitForTimeout(200);
      await blurCommit();                                 // 点空白失焦提交(不留空行)
      await page.waitForTimeout(400);
      console.log(`    + ${it} (添加btn=${added})`);
    }
  } else {
    console.log(`[3] 简单类型「${type}」无数据项,跳过录入`);
    // 成员:可选打开「允许选择多个成员」(thy-switch,真实鼠标点)
    if (type === '成员' && multiMember) {
      const sw = page.locator('.cdk-overlay-container thy-switch').first();
      const sb = await sw.boundingBox().catch(() => null);
      if (sb) await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.waitForTimeout(400);
      const on = await page.evaluate(() => { const i = document.querySelector('.cdk-overlay-container input.thy-switch-input'); return i ? i.checked : null; });
      console.log('  允许选择多个成员 →', on);
    }
  }
  await page.screenshot({ path: shot('before_confirm') });

  console.log('[4] 点确定 ...');
  await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container');
    const b = [...root.querySelectorAll('button')].filter(x => x.textContent.trim() === '确定').pop();
    if (b) b.click();
  });
  await page.waitForTimeout(2000);
  const stillOpen = await page.locator('.cdk-overlay-container input[name="propertyName"]').count();
  if (stillOpen) {
    const errText = await page.locator('.cdk-overlay-container').innerText().catch(() => '');
    const errLine = (errText.split('\n').map(s => s.trim()).filter(s => /不能|已存在|不正确|错误|必填|至少/.test(s))[0]) || '(看截图)';
    await page.screenshot({ path: shot('dialog_error') });
    console.log('  [x] 弹窗未关,报错:', errLine);
    await page.keyboard.press('Escape').catch(() => {});
    await ctx.close(); process.exit(1);
  }

  console.log('[5] 验证(计数差)...');
  await page.waitForTimeout(1500);
  const after = await attrCount(page);
  await page.screenshot({ path: shot('after') });
  console.log(`  建后属性数: ${after}(建前 ${before})`);
  const itemDesc = ['单选', '多选', '级联单选', '级联多选'].includes(type) ? `, 数据项 ${items.join('/')}` : '';
  console.log(after === before + 1 ? `[√] 成功:「${name}」(${type}${itemDesc})已建` : `[x] 计数未 +1,存疑`);

  await ctx.close();
  console.log('[done]');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
