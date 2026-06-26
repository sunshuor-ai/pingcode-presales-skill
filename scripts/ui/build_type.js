/**
 * 段 A:路径① 真建一个工作项类型(可靠版)
 * ==========================================
 * 实测结论沉淀:
 *  - ngx-tethys 认真实键盘/鼠标事件(thy-select 必须 mouse.click 真坐标打开)。
 *  - 列表搜索框自动化下不过滤;API /v1/project/work_item_types 只返回"已入流程"的类型 → 两者都不能查重新建类型。
 *  - 可靠验证 = footer「共 N 条」计数差(建前/建后 +1);可靠去重 = 后端同名兜底(读弹窗报错)。
 *
 * 用法: node ui/build_type.js --env=daocloud-test.pingcode.com --name="UIauto类型_可删" [--group=需求]
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const name = args.name || 'UIauto类型_可删';
const wantGroup = args.group || null;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `buildtype_${t}_${Date.now()}.png`);

async function totalCount(page) {
  const t = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => '');
  const m = t.match(/(\d+)/); return m ? Number(m[1]) : null;
}

(async () => {
  if (!env) throw new Error('用法: node ui/build_type.js --env=<租户>.pingcode.com --name=<名> [--group=]');
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3000);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录,先跑 spike_connect --wait=150'); await ctx.close(); process.exit(1); }

  const before = await totalCount(page);
  console.log(`[0] 建前类型总数: ${before}`);

  console.log(`[1] 新建 → 填名称「${name}」...`);
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="workItemTypeName"]', { timeout: 8000 });
  await page.locator('input[name="workItemTypeName"]').click();
  await page.keyboard.type(name, { delay: 40 });
  await page.waitForTimeout(300);

  console.log('[2] 选分组(thy-select mouse.click 打开)...');
  const sel = page.locator('.cdk-overlay-container thy-select').first();
  let group = wantGroup;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const box = await sel.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('.cdk-overlay-pane .thy-option-item', { timeout: 5000 });
    const pane = page.locator('.cdk-overlay-pane').last();
    const opts = (await pane.locator('.thy-option-item').allInnerTexts()).map(s => s.trim());
    if (attempt === 1) console.log('  可选分组:', JSON.stringify(opts));
    group = wantGroup && opts.includes(wantGroup) ? wantGroup : opts[0];
    await pane.locator('.thy-option-item').filter({ hasText: new RegExp(`^\\s*${group}\\s*$`) }).first().click();
    await page.waitForTimeout(500);
    // 验证下拉真的显示了分组(治"分组没选上")
    const shown = (await sel.innerText()).trim();
    if (shown.includes(group)) { console.log(`  [√] 分组已选中:「${group}」(下拉显示: ${shown})`); break; }
    console.log(`  [!] 第${attempt}次分组没选上(下拉仍显示「${shown}」),重试 ...`);
  }

  await page.screenshot({ path: shot('before_confirm') });
  console.log('[3] 点确定 ...');
  await page.locator('.cdk-overlay-container button:has-text("确定")').last().click();
  await page.waitForTimeout(2000);

  // 弹窗还在 = 没提交成功 → 读真实报错
  const stillOpen = await page.locator('.cdk-overlay-container input[name="workItemTypeName"]').count();
  if (stillOpen) {
    const errText = await page.locator('.cdk-overlay-container').innerText().catch(() => '');
    const errLine = (errText.split('\n').map(s => s.trim()).filter(s => /不能|已存在|不正确|错误|必填|超过/.test(s))[0]) || '(未捕获到明确报错文字,看截图)';
    await page.screenshot({ path: shot('dialog_error') });
    console.log('  [x] 弹窗未关闭,真实报错:', errLine);
    await page.keyboard.press('Escape').catch(() => {});
    await ctx.close(); process.exit(1);
  }

  console.log('[4] 验证(计数差)...');
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const after = await totalCount(page);
  await page.screenshot({ path: shot('after') });
  console.log(`  建后类型总数: ${after}(建前 ${before})`);
  console.log(after === before + 1 ? `[√] 验证通过:总数 +1,「${name}」(分组 ${group})已建` : `[x] 验证可疑:总数未 +1`);

  await ctx.close();
  console.log('[done] 段A结束。');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
