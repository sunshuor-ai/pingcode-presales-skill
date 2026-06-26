/**
 * 探针(只读):学习「字段属性类型」全集
 * ==========================================
 * 后台 → 工作项属性 tab → 新建属性 → 打开「类型」下拉 → 枚举全部字段类型
 * 不提交,只学。看清:有哪些类型、哪种需要数据项、单选是否有「下一步」。
 * 用法: node ui/probe_attr_types.js --env=daocloud-test.pingcode.com
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (t) => path.join(shotDir, `attr_${t}_${Date.now()}.png`);

(async () => {
  if (!env) throw new Error('用法: node ui/probe_attr_types.js --env=<租户>.pingcode.com');
  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('goto warn:', e.message));
  await page.waitForTimeout(3000);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  console.log('[1] 切到「工作项属性」tab ...');
  await page.locator('text="工作项属性"').first().click().catch(e => console.log('  tab warn:', e.message));
  await page.waitForTimeout(2500);
  console.log('  当前 URL:', page.url());
  await page.screenshot({ path: shot('tab') });

  // 找「新建」按钮(属性 tab 里的)
  console.log('[2] 找并点「新建」属性 ...');
  const newBtns = page.locator('button:has-text("新建"), button:has-text("添加"), button:has-text("创建")');
  console.log('  候选新建按钮数:', await newBtns.count());
  await newBtns.first().click().catch(e => console.log('  新建 warn:', e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('after_new') });

  // 弹窗内 dump:标题/输入框/thy-select/按钮
  const probe1 = await page.evaluate(() => {
    const root = document.querySelector('.cdk-overlay-container') || document;
    const q = (s) => Array.from(root.querySelectorAll(s));
    return {
      title: q('[class*="dialog"][class*="title"], .thy-dialog-header-title')[0]?.textContent?.trim() || null,
      inputs: q('input').map(i => ({ ph: i.placeholder || null, name: i.getAttribute('name') })),
      thySelects: q('thy-select').map(s => s.textContent.trim().slice(0, 30)),
      buttons: q('button').map(b => b.textContent.trim()).filter(Boolean),
    };
  });
  console.log('  新建属性弹窗:', JSON.stringify(probe1));

  // 打开「类型」下拉,枚举所有字段类型
  console.log('[3] 打开「类型」下拉枚举字段类型 ...');
  const selects = page.locator('.cdk-overlay-container thy-select');
  const nSel = await selects.count();
  console.log('  弹窗内 thy-select 数:', nSel);
  // 类型下拉通常是其中一个;逐个尝试打开找到含字段类型的那个
  let typeOptions = [];
  for (let i = 0; i < nSel; i++) {
    const s = selects.nth(i);
    const box = await s.boundingBox().catch(() => null);
    if (!box) continue;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    const opts = await page.locator('.cdk-overlay-pane').last().locator('.thy-option-item').allInnerTexts().catch(() => []);
    if (opts.length) { typeOptions = opts.map(s => s.trim()); console.log(`  thy-select[${i}] 选项:`, JSON.stringify(typeOptions)); }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: shot('type_dropdown') });

  console.log('\n===== 字段属性类型全集(daocloud-test 实测) =====');
  console.log(JSON.stringify(typeOptions, null, 0));

  console.log('\n[4] 关闭弹窗(不提交)...');
  await page.keyboard.press('Escape').catch(() => {});
  await ctx.close();
  console.log('[done] 只读学习结束,零改动');
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
