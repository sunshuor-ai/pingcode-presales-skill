/**
 * 探针(只读):学「单选」字段的数据项录入流程
 * ================================================
 * 新建属性 → 填名 → 点「单选」卡片(exact,防误中级联单选)→ 观察:
 *   有没有「下一步」?数据项在哪录?「添加数据项」长啥样?
 * 不提交,只学。用法: node ui/probe_singleselect.js --env=daocloud-test.pingcode.com
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `ss_${t}_${Date.now()}.png`);

async function dumpDialog(page, label) {
  const d = await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container') || document;
    const q = (s) => Array.from(root.querySelectorAll(s));
    const txt = root.textContent || '';
    return {
      buttons: q('button').map(b => b.textContent.trim()).filter(Boolean),
      inputs: q('input').map(i => ({ ph: i.placeholder || null, name: i.getAttribute('name') })),
      has数据项: /数据项/.test(txt),
      has添加数据项: /添加数据项/.test(txt),
      has下一步: /下一步/.test(txt),
    };
  });
  console.log(`  [${label}]`, JSON.stringify(d));
  return d;
}

(async () => {
  if (!env) throw new Error('用法: node ui/probe_singleselect.js --env=<租户>.pingcode.com');
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3000);

  console.log('[1] 工作项属性 tab → 新建 → 填名 ...');
  await page.locator('text="工作项属性"').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("新建")').first().click();
  await page.waitForSelector('.cdk-overlay-container input[name="propertyName"]', { timeout: 8000 });
  await page.locator('input[name="propertyName"]').click();
  await page.keyboard.type('学习用_单选_勿存', { delay: 30 });
  await page.waitForTimeout(300);
  await dumpDialog(page, '选类型前');

  console.log('[2] 点「单选」卡片(exact)...');
  await page.locator('.cdk-overlay-container').getByText('单选', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  const d1 = await dumpDialog(page, '点单选后');
  await page.screenshot({ path: shot('after_pick_single') });

  // 若有「下一步」,点进去看数据项页
  if (d1.has下一步) {
    console.log('[3] 有「下一步」→ 点进去看数据项页 ...');
    await page.locator('.cdk-overlay-container button:has-text("下一步")').last().click();
    await page.waitForTimeout(1000);
    await dumpDialog(page, '下一步后');
    await page.screenshot({ path: shot('after_next') });
  } else {
    console.log('[3] 无「下一步」→ 数据项应在当前页(看截图)');
  }

  console.log('[4] 取消关闭(不提交)...');
  await page.locator('.cdk-overlay-container button:has-text("取消")').last().click().catch(() => page.keyboard.press('Escape'));
  await ctx.close();
  console.log('[done] 只读学习结束,零改动');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
