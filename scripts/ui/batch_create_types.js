/**
 * 批量建工作项类型(有头,一个窗口连续建,看得见)——金来奥光电/汽车电子
 * API 先查重跳过已存在;path① 新建→名称→分组→确定;计数差验证。
 * 用法: node ui/batch_create_types.js --env=daocloud-test.pingcode.com --client_id=XXX --client_secret=YYY
 */
const { chromium } = require('playwright');
const path = require('path'); const os = require('os'); const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const env = args.env;
const profileDir = args.profile || path.join(os.homedir(), '.pingcode-presales-edge-profile');
const ADMIN = 'admin/product/pjm/configuration/work-item';
const BASE = 'https://open.pingcode.com';
const shotDir = path.join(__dirname, 'screenshots'); fs.mkdirSync(shotDir, { recursive: true });

// 汽车电子/光电 专属类型(名称 + 分组)
const TYPES = [
  { name: '工程变更申请', group: '事务' },
  { name: '技术评审', group: '事务' },
  { name: '风险项', group: '事务' },
  { name: '合规检查项', group: '事务' },
  { name: '失效分析', group: '事务' },
  { name: '功能安全项', group: '需求' },
  { name: 'DV试验项', group: '任务' },
  { name: '8D质量问题', group: '缺陷' },
];

async function existingTypes() {
  if (!args.client_id) return [];
  const p = new URLSearchParams({ grant_type: 'client_credentials', client_id: args.client_id, client_secret: args.client_secret });
  const r = await fetch(`${BASE}/v1/auth/token?${p}`); const { access_token } = await r.json();
  const w = await fetch(`${BASE}/v1/project/work_item_types`, { headers: { Authorization: 'Bearer ' + access_token } });
  const d = await w.json(); const list = Array.isArray(d) ? d : (d.values || []);
  return list.map(t => t.name);
}
async function totalCount(page) { const t = await page.locator('text=/共\\s*\\d+\\s*条/').first().innerText().catch(() => ''); const m = t.match(/(\d+)/); return m ? Number(m[1]) : null; }

(async () => {
  const have = await existingTypes();
  console.log('已存在类型数:', have.length);
  const todo = TYPES.filter(t => !have.includes(t.name));
  console.log('本次将建:', todo.map(t => t.name).join('、') || '(无,全已存在)');
  if (!todo.length) return;

  const ctx = await chromium.launchPersistentContext(profileDir, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`https://${env}/${ADMIN}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (/signin|login/i.test(page.url())) { console.log('[x] 未登录'); await ctx.close(); process.exit(1); }

  let okN = 0;
  for (const t of todo) {
    const before = await totalCount(page);
    console.log(`\n建「${t.name}」(分组 ${t.group})... 建前 ${before}`);
    await page.locator('button:has-text("新建")').first().click();
    await page.waitForSelector('.cdk-overlay-container input[name="workItemTypeName"]', { timeout: 8000 });
    await page.locator('input[name="workItemTypeName"]').click();
    await page.keyboard.type(t.name, { delay: 40 });
    await page.waitForTimeout(300);
    // 分组 thy-select:mouse.click 打开 → 选 → 验证显示
    const sel = page.locator('.cdk-overlay-container thy-select').first();
    let picked = false;
    for (let a = 0; a < 2 && !picked; a++) {
      const b = await sel.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForSelector('.cdk-overlay-pane .thy-option-item', { timeout: 5000 });
      const pane = page.locator('.cdk-overlay-pane').last();
      await pane.locator('.thy-option-item').filter({ hasText: new RegExp(`^\\s*${t.group}\\s*$`) }).first().click();
      await page.waitForTimeout(500);
      picked = (await sel.innerText()).includes(t.group);
    }
    await page.locator('.cdk-overlay-container button:has-text("确定")').last().click();
    await page.waitForTimeout(1800);
    const after = await totalCount(page);
    const ok = after === before + 1;
    console.log(ok ? `  [√] 建成(${before}→${after})` : `  [x] 计数未+1(${before}→${after}),看窗口`);
    if (ok) okN++;
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(shotDir, `batch_types_${Date.now()}.png`) });
  console.log(`\n[done] 成功 ${okN}/${todo.length}`);
  await page.waitForTimeout(2000);
  await ctx.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
