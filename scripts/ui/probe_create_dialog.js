/**
 * 探针:路径① 「新建」类型弹窗(只读,绝不提交)
 * ================================================
 * 复用持久化登录态 → 工作项配置页 → 点「新建」→ dump 弹窗 DOM + 截图
 * → 打印 弹窗内 input/textarea/thy-select/button 的真实选择器线索
 * → 按 Esc / 点「取消」关掉(不点「确定」,不改任何状态)
 *
 * 用法: node ui/probe_create_dialog.js --env=daocloud-test.pingcode.com
 */
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=')];
}));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN_WORKITEM = 'admin/product/pjm/configuration/work-item';

const shotDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

(async () => {
  if (!env) throw new Error('用法: node ui/probe_create_dialog.js --env=<租户>.pingcode.com');

  const ctx = await chromium.launchPersistentContext(profileDir, {
    channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log('[1] 导航工作项配置页 ...');
  await page.goto(`https://${env}/${ADMIN_WORKITEM}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    .catch(e => console.log('    goto warn:', e.message));
  await page.waitForTimeout(3000);
  if (/signin|login/i.test(page.url())) {
    console.log('[x] 未登录,先跑: node ui/spike_connect.js --env=' + env + ' --wait=150');
    await ctx.close(); process.exit(1);
  }

  console.log('[2] 点「新建」打开创建类型弹窗 ...');
  await page.locator('button:has-text("新建")').first().click();
  // 等弹窗:overlay pane 出现且里面有输入框
  await page.waitForSelector('.cdk-overlay-container .cdk-overlay-pane input', { timeout: 8000 })
    .catch(() => console.log('    warn: 8s 内没等到 overlay 里的 input,继续 dump 看看'));
  await page.waitForTimeout(1500);

  // dump 整个 overlay 容器(所有浮层都在这)
  const overlayHtml = await page.evaluate(() => {
    const c = document.querySelector('.cdk-overlay-container');
    return c ? c.outerHTML : '(no .cdk-overlay-container)';
  });
  const dumpPath = path.join(shotDir, `dom_create_dialog_${Date.now()}.html`);
  fs.writeFileSync(dumpPath, overlayHtml);
  await page.screenshot({ path: path.join(shotDir, `create_dialog_${Date.now()}.png`) });

  // 抠真实选择器线索
  const probe = await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container') || document;
    const q = (sel) => Array.from(root.querySelectorAll(sel));
    return {
      title: (q('.thy-dialog-header-title, .dialog-header-title, [class*="dialog"][class*="title"]')[0] || {}).textContent?.trim() || null,
      inputs: q('input').map(i => ({ placeholder: i.placeholder || null, type: i.type, name: i.getAttribute('name') })),
      textareas: q('textarea').map(t => ({ placeholder: t.placeholder || null })),
      thySelects: q('thy-select').map(s => ({
        placeholder: s.getAttribute('thyplaceholder') || s.querySelector('.thy-select-placeholder, [class*="placeholder"]')?.textContent?.trim() || null,
        text: s.textContent.trim().slice(0, 40),
      })),
      buttons: q('button').map(b => b.textContent.trim()).filter(Boolean),
      iconHints: q('thy-icon').length,
    };
  });

  console.log('\n===== 路径① 新建弹窗 probe =====');
  console.log('弹窗标题      :', probe.title);
  console.log('input 输入框   :', JSON.stringify(probe.inputs));
  console.log('textarea      :', JSON.stringify(probe.textareas));
  console.log('thy-select 下拉:', JSON.stringify(probe.thySelects));
  console.log('button 按钮    :', JSON.stringify(probe.buttons));
  console.log('thy-icon 数量  :', probe.iconHints, '(图标选择器)');
  console.log('[DOM dump]    :', dumpPath);

  console.log('\n[3] 按 Esc 关闭弹窗(不提交,不改状态)...');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
  await ctx.close();
  console.log('[done] 只读探针结束,环境零改动');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
