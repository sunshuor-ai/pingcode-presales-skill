/**
 * 连通性 spike — 第一步,纯 Playwright,无需 Stagehand / Anthropic key
 * =================================================================
 * 验证 3 件事(spec §15 最大的未知数):
 *   1. 本地 Playwright 用 channel:'msedge' 能驱动你已装的 Edge
 *   2. 专属持久化 profile 能复用登录态(登一次,之后免登)
 *   3. 能导航到管理后台工作项配置页,并把真实 DOM probe 下来
 *
 * 用法:
 *   首次(会弹 Edge 窗口让你手工登录,给 150s):
 *     node ui/spike_connect.js --env=<租户>.pingcode.com --wait=150
 *   之后(复用会话,直接验证 + probe,几秒返回):
 *     node ui/spike_connect.js --env=<租户>.pingcode.com
 *   顺便探一下工作项配置页 DOM:
 *     node ui/spike_connect.js --env=<租户>.pingcode.com --probe=admin
 *
 * profile 存在仓库外(~/.pingcode-presales-edge-profile),不会进 git。
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
const waitSec = Number(args.wait || 0);
const probe = args.probe; // 'admin' = 顺便导航到工作项配置页 probe DOM

// 正确后台 URL(来自 skill.md 3.7,bundled 的那些是错的)
const ADMIN_WORKITEM = 'admin/product/pjm/configuration/work-item';

function shotPath(tag) {
  const dir = path.join(__dirname, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `spike_${tag}_${Date.now()}.png`);
}

(async () => {
  if (!env) throw new Error('用法: node ui/spike_connect.js --env=<租户>.pingcode.com [--wait=150] [--probe=admin]');

  console.log('[1] 用 channel:msedge 启动本地 Edge + 持久化 profile ...');
  console.log('    profile:', profileDir);
  const ctx = await chromium.launchPersistentContext(profileDir, {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log(`[2] 打开 https://${env}/ ...`);
  await page.goto(`https://${env}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    .catch(e => console.log('    goto warn:', e.message));
  await page.waitForTimeout(3000);

  let url = page.url();
  let loggedIn = !/signin|login/i.test(url);
  console.log('    当前 URL:', url);
  console.log(loggedIn ? '    [√] 已登录(复用了 profile 会话)' : '    [!] 未登录');
  console.log('    [截图]', (await page.screenshot({ path: shotPath(loggedIn ? 'in' : 'signin') }), 'ok'));

  // 未登录且给了等待时间 → 让用户在弹出窗口手工登录
  if (!loggedIn && waitSec > 0) {
    console.log(`[3] 请在弹出的 Edge 窗口手工登录,等待 ${waitSec}s ...`);
    try {
      await page.waitForURL(u => !/signin|login/i.test(u.toString()), { timeout: waitSec * 1000 });
      loggedIn = true;
      console.log('    [√] 检测到登录成功,URL:', page.url());
      await page.screenshot({ path: shotPath('after_login') });
    } catch {
      console.log('    [x] 超时仍未登录,下次再跑 --wait 重试');
    }
  }

  // probe:导航到工作项配置页,dump 真实 DOM 给后续写 fields.js 用
  if (loggedIn && probe === 'admin') {
    console.log(`[4] 导航到工作项配置页 /${ADMIN_WORKITEM} ...`);
    await page.goto(`https://${env}/${ADMIN_WORKITEM}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      .catch(e => console.log('    goto warn:', e.message));
    await page.waitForTimeout(4000);
    console.log('    URL:', page.url());
    await page.screenshot({ path: shotPath('admin_workitem'), fullPage: true });
    // probe:抓「新建」按钮 + 类型行,确认选择器
    const newBtn = await page.locator('button:has-text("新建")').count();
    const bodyHit = (await page.evaluate(() => document.body.innerText)).includes('工作项类型')
      || (await page.evaluate(() => document.body.innerText)).includes('工作项配置');
    console.log('    probe: 含「新建」按钮 ×', newBtn, '| 页面命中工作项配置文案:', bodyHit);
    const dump = path.join(__dirname, 'screenshots', `dom_admin_${Date.now()}.html`);
    fs.writeFileSync(dump, await page.content());
    console.log('    [DOM dump]', dump);
  }

  await ctx.close();
  console.log('[done] profile 已持久化,下次免登:', profileDir);
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
