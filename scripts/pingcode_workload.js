/**
 * pingcode_workload.js — 给已建工作项随机模拟登记工时 (历史数据模拟的一环)
 *
 * 规则:
 *  - 范围: 只登 可执行层级 story/task/bug (阶段/里程碑/需求/史诗/特性不登)
 *  - 跳过未来项: start_at 晚于今天的不登
 *  - 单项总量 ≈ estimated_workload × 随机(0.3~1.0); 无预估兜底随机 4~16h
 *  - 拆 1~3 条, 且受 总量/6 约束 (小活条数更少); 单条 ≤ 8h, 至少 1h
 *  - 日期: 在 [start, min(end,今天)] 均匀铺开 → 对齐北京当日0点 → 不晚于今天 (规避 100810)
 *  - 登记人 report_by_id = 该工作项负责人(assignee), 兜底随机用户池 (企业鉴权必填)
 *  - 工时类型: 按标题关键词映射 设计/测试/研发 → workload_type id
 *
 * 用法: node pingcode_workload.js --client_id=xx --client_secret=xx [--identifiers=RNNPD,RNMNT] [--dry]
 *   --identifiers 省略则对环境内全部项目登记; --dry 仅预览不写入
 */
const api = require('./pingcode_api.js');
const BASE = 'https://open.pingcode.com';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const DRY = 'dry' in args;
const NOW = Math.floor(Date.now() / 1000);
const bjDay = ts => ts - ((ts + 8 * 3600) % 86400);   // 对齐北京时区当日0点
const TODAY = bjDay(NOW);
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));

function workloadKind(title = '') {
  if (/设计|结构|仿真|配方|DOE|方案|图纸|规格书|SOP|文档|报告|评审/.test(title)) return '设计';
  if (/测试|验证|DV|PV|抽检|循环|安全|针刺|挤压|过充|温升|可靠性/.test(title)) return '测试';
  return '研发';
}

function planLogs(item) {
  const est = item.estimated_workload || ri(4, 16);
  const start = item.start_at || (NOW - 30 * 86400);
  const end = Math.min(item.end_at || NOW, NOW);
  if (start > NOW) return [];                       // 未开始的不登
  const span = Math.max(86400, end - start);
  const total = Math.max(1, Math.round(est * rand(0.3, 1.0)));
  const entries = Math.min(ri(1, 3), Math.max(1, Math.round(total / 6)));
  const logs = []; let remaining = total;
  for (let i = 0; i < entries; i++) {
    let h = i === entries - 1 ? remaining : Math.max(1, Math.round(remaining * rand(0.3, 0.6)));
    h = Math.min(h, 8); remaining -= h; if (h <= 0) break;
    const ra = Math.min(bjDay(Math.floor(start + span * (i + 1) / (entries + 1))), TODAY);
    logs.push({ hours: h, reportAt: ra });
    if (remaining <= 0) break;
  }
  return logs;
}

(async () => {
  if (!args.client_id || !args.client_secret) {
    console.error('用法: node pingcode_workload.js --client_id=xx --client_secret=xx [--identifiers=A,B] [--dry]');
    process.exit(1);
  }
  const auth = await api.getToken(args.client_id, args.client_secret);
  const token = auth.token;
  const users = await api.getUsers(token);
  const wtypes = ((await (await fetch(`${BASE}/v1/workload_types`, { headers: { Authorization: 'Bearer ' + token } })).json()).values) || [];
  const wtId = name => (wtypes.find(w => w.name === name) || wtypes[0] || {}).id;

  let projs = await api.listProjects(token);
  if (args.identifiers) { const ids = args.identifiers.split(','); projs = projs.filter(p => ids.includes(p.identifier)); }
  console.log(`[OK] 认证, 用户池 ${users.length}, 目标项目 ${projs.map(p => p.identifier).join('/')}${DRY ? '  (DRY-RUN)' : ''}`);

  let logs = 0, hours = 0, fail = 0, okItems = 0;
  for (const p of projs) {
    const items = await api.listWorkItems(token, p.id);
    const leaves = items.filter(it => ['story', 'task', 'bug'].includes(it.type));
    console.log(`\n■ ${p.name}: 可登记工作项 ${leaves.length}`);
    for (const it of leaves) {
      const plan = planLogs(it);
      // 登记人 = 该工作项负责人, 兜底随机池
      const reporter = (it.assignee && it.assignee.id) || (api.randomAssignee(users) || {}).id || (users[0] && users[0].id);
      for (const lg of plan) {
        if (DRY) { logs++; hours += lg.hours; continue; }
        try {
          await api.createWorkload(token, {
            principalType: 'work_item', principalId: it.id, duration: lg.hours,
            reportById: reporter, reportAt: lg.reportAt,
            type: wtId(workloadKind(it.title)), description: `${it.title} 工时登记`,
          });
          logs++; hours += lg.hours; await api.sleep(160);
        } catch (e) { fail++; if (fail <= 3) console.log(`  [FAIL] ${it.title}: ${String(e.message).slice(0, 90)}`); }
      }
      if (plan.length) okItems++;
    }
  }
  console.log(`\n=== 工时登记${DRY ? '(预览)' : ''}完成: ${okItems} 工作项, ${logs} 条, 合计 ${hours}h${fail ? `, 失败 ${fail}` : ''} ===`);
  if (fail) console.log('⚠️ 大量失败且报"登记人不能为空"→ 检查 report_by_id; 报 100810 → 检查 report_at 日期对齐');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
