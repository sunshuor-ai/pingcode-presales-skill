/**
 * API 查重/验证:列出所有工作项类型(可靠,无 UI 分页/事件坑)
 * ============================================================
 * 安全:creds 只走命令行参数,绝不写进文件、绝不入库(占位符纪律)。
 * 用法: node ui/api_types.js --client_id=XXX --client_secret=YYY [--q=名字]
 */
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const BASE = 'https://open.pingcode.com';

(async () => {
  if (!args.client_id || !args.client_secret) throw new Error('需 --client_id 和 --client_secret');
  const p = new URLSearchParams({ grant_type: 'client_credentials', client_id: args.client_id, client_secret: args.client_secret });
  const authRes = await fetch(`${BASE}/v1/auth/token?${p}`);
  if (!authRes.ok) throw new Error(`认证失败 HTTP ${authRes.status}: ${await authRes.text()}`);
  const { access_token: TOKEN } = await authRes.json();
  if (!TOKEN) throw new Error('Token 获取失败,检查 creds');
  console.log('[auth] ok');

  const r = await fetch(`${BASE}/v1/project/work_item_types`, { headers: { Authorization: 'Bearer ' + TOKEN } });
  const data = await r.json();
  const list = Array.isArray(data) ? data : (data.values || data.data || []);
  console.log('[work_item_types] 返回条数:', list.length);
  const names = list.map(t => t.name);
  console.log('全部类型名:', JSON.stringify(names));

  // 看自定义类型在不在(系统类型之外的)
  const customHint = names.filter(n => /E2E|可删|测试用例|故障|采购项|立项任务|研发任务/.test(n));
  console.log('疑似自定义/我建的:', JSON.stringify(customHint));

  if (args.q) {
    const exact = list.filter(t => t.name === args.q);
    console.log(`查重 "${args.q}":`, exact.length, '条', exact.length ? '→ 已存在' : '→ 不存在(可建)');
  }
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
