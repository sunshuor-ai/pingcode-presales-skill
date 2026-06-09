#!/usr/bin/env node
/**
 * PingCode 演示环境自检脚本
 * ===========================
 * Phase 4 结束后自动运行，检查所有模块是否达标，结构合规，内容有质量。
 * 可选 --fix 自动修复结构类问题（数量不足、phase_id 偏移、Bug 越级）。
 *
 * 用法:
 *   node pingcode_check.js --env=xxx.pingcode.com --client_id=xxx --client_secret=xxx
 *   node pingcode_check.js --env=xxx.pingcode.com --client_id=xxx --client_secret=xxx --fix
 *   node pingcode_check.js --env=xxx.pingcode.com --client_id=xxx --client_secret=xxx --report=report.json
 *
 * 也可以用环境变量:
 *   PINGCODE_ENV / PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET
 */

const api = require('./pingcode_api.js');

// ============================================================
// 解析参数
// ============================================================
function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    args[k] = v ?? true;
  }
  return {
    env:          args.env          || process.env.PINGCODE_ENV,
    clientId:     args.client_id    || process.env.PINGCODE_CLIENT_ID,
    clientSecret: args.client_secret|| process.env.PINGCODE_CLIENT_SECRET,
    fix:          !!args.fix,
    reportFile:   args.report       || null,
  };
}

// ============================================================
// 彩色输出
// ============================================================
const C = {
  ok:   s => `\x1b[32m✅ ${s}\x1b[0m`,
  warn: s => `\x1b[33m⚠️  ${s}\x1b[0m`,
  fail: s => `\x1b[31m❌ ${s}\x1b[0m`,
  fix:  s => `\x1b[36m🔧 ${s}\x1b[0m`,
  h:    s => `\x1b[1m${s}\x1b[0m`,
  dim:  s => `\x1b[2m${s}\x1b[0m`,
};

// ============================================================
// 数据采集（并行拉取所有模块数据）
// ============================================================
async function collectData(token, baseUrl) {
  console.log(C.dim('  正在拉取环境数据...'));

  const [projects, wikiSpaces, testLibraries, shipProducts] = await Promise.all([
    api.listProjects(token, baseUrl),
    api.listWikiSpaces(token, baseUrl),
    api.listTestLibraries(token, baseUrl),
    api.listShipProducts(token, baseUrl),
  ]);

  // 并行拉各项目工作项 + Wiki页面 + TestHub套件/用例 + Ship工单/需求
  const [workItemsByProject, wikiPagesBySpace, testDataByLib, shipDataByProduct] =
    await Promise.all([
      Promise.all(projects.map(p =>
        api.listWorkItems(token, p.id, baseUrl).then(items => ({ project: p, items }))
      )),
      Promise.all(wikiSpaces.map(s =>
        api.listWikiPages(token, s.id, baseUrl).then(pages => ({ space: s, pages }))
      )),
      Promise.all(testLibraries.map(async lib => {
        const [suites, cases] = await Promise.all([
          api.listTestSuites(token, lib.id, baseUrl),
          api.listTestCases(token, { libraryId: lib.id }, baseUrl),
        ]);
        return { lib, suites, cases };
      })),
      Promise.all(shipProducts.map(async prod => {
        const [tickets, ideas] = await Promise.all([
          api.listShipTickets(token, prod.id, baseUrl),
          api.listShipIdeas(token, prod.id, baseUrl),
        ]);
        return { product: prod, tickets, ideas };
      })),
    ]);

  return { projects, workItemsByProject, wikiSpaces, wikiPagesBySpace, testLibraries, testDataByLib, shipProducts, shipDataByProduct };
}

// ============================================================
// 辅助
// ============================================================
function pct(n, total) { return total === 0 ? 100 : Math.round(n / total * 100); }
const GENERIC_WORDS = /示例|测试数据|通用|example|demo|sample|测试项目|test project/i;
const PHASE_TYPES   = ['phase', '阶段'];

function isPhase(item) {
  return PHASE_TYPES.some(k => String(item.type_id || '').toLowerCase().includes(k))
    || (item.type_name && PHASE_TYPES.some(k => item.type_name.includes(k)));
}

// ============================================================
// 检查 A：数量达标
// ============================================================
function checkA(data) {
  const results = [];
  const { projects, workItemsByProject, wikiPagesBySpace, testDataByLib, shipDataByProduct } = data;

  // 1. 项目工作项层级
  for (const { project, items } of workItemsByProject) {
    const phases   = items.filter(i => isPhase(i));
    const epics    = items.filter(i => i.type_id === 'epic');
    const features = items.filter(i => i.type_id === 'feature');
    const stories  = items.filter(i => i.type_id === 'story');
    const tasks    = items.filter(i => i.type_id === 'task' || i.type_id === 'bug');
    const withDesc = items.filter(i => i.description && i.description.trim().split('\n').length >= 3);
    const withLoad = items.filter(i => i.estimated_workload > 0);

    if (['hybrid', 'waterfall'].includes(project.type)) {
      const ok = phases.length >= 4;
      results.push({ id: `A.phases.${project.id}`, ok, level: ok ? 'ok' : 'fail',
        msg: `[${project.name}] PMP阶段数: ${phases.length} (要求≥4)`, fixable: false });
    }

    const fOk = features.length >= 4;
    results.push({ id: `A.features.${project.id}`, ok: fOk, level: fOk ? 'ok' : 'fail',
      msg: `[${project.name}] Feature数: ${features.length} (要求≥4)`, fixable: false });

    const noChildStories = stories.filter(s => !items.some(i => i.parent_id === s.id));
    const sOk = noChildStories.length === 0;
    results.push({ id: `A.story_children.${project.id}`, ok: sOk, level: sOk ? 'ok' : 'fail',
      msg: `[${project.name}] 空Story（无子工作项）: ${noChildStories.length} 条`,
      fixable: true, fixData: { type: 'empty_stories', projectId: project.id, stories: noChildStories } });

    const descPct = pct(withDesc.length, items.length);
    const descOk  = descPct >= 90;
    results.push({ id: `A.desc.${project.id}`, ok: descOk, level: descOk ? 'ok' : 'warn',
      msg: `[${project.name}] 有描述工作项: ${descPct}% (要求≥90%)`, fixable: false });

    const loadPct = pct(withLoad.length, items.length);
    const loadOk  = loadPct >= 90;
    results.push({ id: `A.workload.${project.id}`, ok: loadOk, level: loadOk ? 'ok' : 'warn',
      msg: `[${project.name}] 有预估工时工作项: ${loadPct}% (要求≥90%)`, fixable: false });
  }

  // 2. Wiki
  const wikiOk = data.wikiSpaces.length >= 2;
  results.push({ id: 'A.wiki_spaces', ok: wikiOk, level: wikiOk ? 'ok' : 'fail',
    msg: `Wiki空间数: ${data.wikiSpaces.length} (要求≥2)`, fixable: false });

  for (const { space, pages } of wikiPagesBySpace) {
    const ok = pages.length >= 2;
    results.push({ id: `A.wiki_pages.${space.id}`, ok, level: ok ? 'ok' : 'warn',
      msg: `Wiki[${space.name}] 页面数: ${pages.length} (要求≥2)`, fixable: false });
  }

  // 3. TestHub
  const libOk = data.testLibraries.length >= 2;
  results.push({ id: 'A.test_libs', ok: libOk, level: libOk ? 'ok' : 'fail',
    msg: `测试库数: ${data.testLibraries.length} (要求≥2)`, fixable: false });

  for (const { lib, suites, cases } of testDataByLib) {
    const sOk = suites.length >= 2;
    results.push({ id: `A.suites.${lib.id}`, ok: sOk, level: sOk ? 'ok' : 'warn',
      msg: `TestHub[${lib.name}] 套件数: ${suites.length} (要求≥2)`, fixable: false });

    for (const suite of suites) {
      const suiteCases = cases.filter(c => c.suite_id === suite.id);
      const cOk = suiteCases.length >= 3;
      results.push({ id: `A.cases.${suite.id}`, ok: cOk, level: cOk ? 'ok' : 'warn',
        msg: `  套件[${suite.name}] 用例数: ${suiteCases.length} (要求≥3)`, fixable: false });
    }
  }

  // 4. Ship
  const prodOk = data.shipProducts.length >= 1;
  results.push({ id: 'A.ship_products', ok: prodOk, level: prodOk ? 'ok' : 'fail',
    msg: `Ship产品空间数: ${data.shipProducts.length} (要求≥1)`, fixable: false });

  let totalTickets = 0, totalIdeas = 0;
  for (const { tickets, ideas } of shipDataByProduct) {
    totalTickets += tickets.length;
    totalIdeas   += ideas.length;
  }
  const tOk = totalTickets >= 3;
  results.push({ id: 'A.tickets', ok: tOk, level: tOk ? 'ok' : 'fail',
    msg: `工单总数: ${totalTickets} (要求≥3)`, fixable: false });
  const iOk = totalIdeas >= 3;
  results.push({ id: 'A.ideas', ok: iOk, level: iOk ? 'ok' : 'fail',
    msg: `需求总数: ${totalIdeas} (要求≥3)`, fixable: false });

  return results;
}

// ============================================================
// 检查 B：结构合规
// ============================================================
function checkB(data) {
  const results = [];

  for (const { project, items } of data.workItemsByProject) {
    const itemMap = new Map(items.map(i => [i.id, i]));
    const bugs    = items.filter(i => i.type_id === 'bug');
    const stories = items.filter(i => i.type_id === 'story');

    // Bug 只能挂 Story 下
    const badBugs = bugs.filter(b => {
      const parent = itemMap.get(b.parent_id);
      return !parent || parent.type_id !== 'story';
    });
    const bugOk = badBugs.length === 0;
    results.push({ id: `B.bug_parent.${project.id}`, ok: bugOk, level: bugOk ? 'ok' : 'fail',
      msg: `[${project.name}] Bug越级挂载（非Story下）: ${badBugs.length} 条`,
      fixable: badBugs.length > 0,
      fixData: { type: 'bad_bug_parent', projectId: project.id, items: badBugs, itemMap, stories } });

    // 孤立 Story/Task（无 parent_id，但非 epic 级）
    const orphans = items.filter(i =>
      ['story', 'task'].includes(i.type_id) && !i.parent_id && !isPhase(i)
    );
    const orphanOk = orphans.length === 0;
    results.push({ id: `B.orphans.${project.id}`, ok: orphanOk, level: orphanOk ? 'ok' : 'warn',
      msg: `[${project.name}] 孤立工作项（无父级）: ${orphans.length} 条`, fixable: false });
  }

  return results;
}

// ============================================================
// 检查 C：内容质量
// ============================================================
function checkC(data) {
  const results = [];

  // 工作项名称含通用词
  for (const { project, items } of data.workItemsByProject) {
    const genericItems = items.filter(i => GENERIC_WORDS.test(i.title || ''));
    const nameOk = genericItems.length === 0;
    results.push({ id: `C.generic_names.${project.id}`, ok: nameOk, level: nameOk ? 'ok' : 'warn',
      msg: `[${project.name}] 含通用词工作项（示例/测试等）: ${genericItems.length} 条`, fixable: false });

    // description 过短（< 3 行）
    const shortDesc = items.filter(i => {
      const d = (i.description || '').trim();
      return d.length === 0 || d.split('\n').filter(l => l.trim()).length < 3;
    });
    const descOk = shortDesc.length <= Math.ceil(items.length * 0.1);
    results.push({ id: `C.short_desc.${project.id}`, ok: descOk, level: descOk ? 'ok' : 'warn',
      msg: `[${project.name}] 描述不足3行的工作项: ${shortDesc.length} 条`, fixable: false });
  }

  // Wiki 页面内容长度
  for (const { space, pages } of data.wikiPagesBySpace) {
    const thinPages = pages.filter(p => (p.content || '').length < 500);
    const ok = thinPages.length === 0;
    results.push({ id: `C.wiki_content.${space.id}`, ok, level: ok ? 'ok' : 'warn',
      msg: `Wiki[${space.name}] 内容<500字节的页面: ${thinPages.length} 个`, fixable: false });
  }

  // 测试用例步骤
  for (const { lib, cases } of data.testDataByLib) {
    const noSteps = cases.filter(c => !c.steps || c.steps.length < 3);
    const ok = noSteps.length === 0;
    results.push({ id: `C.case_steps.${lib.id}`, ok, level: ok ? 'ok' : 'warn',
      msg: `TestHub[${lib.name}] 步骤<3步的用例: ${noSteps.length} 条`, fixable: false });
  }

  return results;
}

// ============================================================
// 检查 D：业务贴合度抽检（随机取 5 条）
// ============================================================
function checkD(data) {
  const allItems = data.workItemsByProject.flatMap(({ items }) => items);
  if (allItems.length === 0) return [];

  const sample = allItems.sort(() => Math.random() - 0.5).slice(0, 5);
  const results = [];

  for (const item of sample) {
    const title = item.title || '';
    // 既没有通用词，又不是纯英文/数字，认为贴合业务
    const ok = !GENERIC_WORDS.test(title) && /[一-鿿]/.test(title);
    results.push({ id: `D.sample.${item.id}`, ok, level: ok ? 'ok' : 'warn',
      msg: `  抽检: "${title.slice(0, 40)}"` });
  }

  return results;
}

// ============================================================
// 自动修复（--fix）
// ============================================================
async function autoFix(token, baseUrl, failedChecks) {
  const fixed = [];

  for (const check of failedChecks) {
    if (!check.fixable || !check.fixData) continue;
    const { type, projectId, stories, items: badItems, itemMap } = check.fixData;

    if (type === 'empty_stories') {
      // 为无子工作项的 Story 补建一个 Task
      for (const story of stories) {
        try {
          await api.createWorkItem(token, {
            projectId,
            typeId: 'task',
            title:  `${story.title} — 实现`,
            description: `关联用户故事「${story.title}」的具体实现任务。\n请根据实际开发情况细化此任务内容。`,
            parentId: story.id,
            phaseId: story.phase_id,
            startAt: story.start_at,
            endAt:   story.end_at,
            assigneeId: story.assignee_id,
            estimatedWorkload: 8,
            remainingWorkload:  8,
          }, baseUrl);
          await api.sleep(api.DEFAULT_DELAY || 200);
          fixed.push(`补建 Task: "${story.title}" 下`);
        } catch (e) {
          console.log(C.warn(`  补建失败 [${story.title}]: ${e.message}`));
        }
      }
    }

    if (type === 'bad_bug_parent' && badItems && stories.length > 0) {
      // Bug 父级不是 Story → 移到第一个可用 Story 下（保守策略）
      const targetStory = stories[0];
      const patchList = badItems.map(b => ({ id: b.id, fields: { parent_id: targetStory.id } }));
      try {
        await api.batchUpdateWorkItems(token, patchList, baseUrl);
        fixed.push(`${badItems.length} 条 Bug 已移至 Story「${targetStory.title}」下`);
      } catch (e) {
        console.log(C.warn(`  Bug移动失败: ${e.message}`));
      }
    }
  }

  return fixed;
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  const cfg = parseArgs();

  if (!cfg.env || !cfg.clientId || !cfg.clientSecret) {
    console.error('缺少必填参数: --env= --client_id= --client_secret=');
    process.exit(1);
  }

  const baseUrl = `https://open.${cfg.env.replace(/^https?:\/\//, '')}`;
  console.log(C.h(`\n=== PingCode 演示环境自检 ===`));
  console.log(C.dim(`  环境: ${cfg.env}`));
  console.log(C.dim(`  时间: ${new Date().toLocaleString('zh-CN')}\n`));

  // 认证
  process.stdout.write('  认证中...');
  const auth = await api.getToken(cfg.clientId, cfg.clientSecret, baseUrl);
  console.log(' 完成');

  // 采集数据
  const data = await collectData(auth, baseUrl);
  const projectNames = data.projects.map(p => p.name).join('、');
  console.log(C.dim(`  项目: ${projectNames || '(无)'}\n`));

  // 运行检查
  console.log(C.h('【A. 数量达标】'));
  const aResults = checkA(data);
  aResults.forEach(r => console.log('  ' + (r.level === 'ok' ? C.ok(r.msg) : r.level === 'warn' ? C.warn(r.msg) : C.fail(r.msg))));

  console.log(C.h('\n【B. 结构合规】'));
  const bResults = checkB(data);
  bResults.forEach(r => console.log('  ' + (r.level === 'ok' ? C.ok(r.msg) : r.level === 'warn' ? C.warn(r.msg) : C.fail(r.msg))));

  console.log(C.h('\n【C. 内容质量】'));
  const cResults = checkC(data);
  cResults.forEach(r => console.log('  ' + (r.level === 'ok' ? C.ok(r.msg) : r.level === 'warn' ? C.warn(r.msg) : C.fail(r.msg))));

  console.log(C.h('\n【D. 业务贴合度（随机抽检 5 条）】'));
  const dResults = checkD(data);
  dResults.forEach(r => console.log('  ' + (r.ok ? C.ok(r.msg) : C.warn(r.msg))));

  // 汇总
  const all    = [...aResults, ...bResults, ...cResults, ...dResults];
  const passes = all.filter(r => r.level === 'ok').length;
  const warns  = all.filter(r => r.level === 'warn').length;
  const fails  = all.filter(r => r.level === 'fail').length;
  const fixable= all.filter(r => r.fixable);

  console.log(C.h('\n=== 检查结果汇总 ==='));
  console.log(`  ${C.ok(`通过: ${passes}`)}  ${C.warn(`警告: ${warns}`)}  ${C.fail(`失败: ${fails}`)}`);

  if (fixable.length > 0 && !cfg.fix) {
    console.log(C.dim(`\n  有 ${fixable.length} 项可自动修复，运行加 --fix 参数自动处理`));
  }

  // 自动修复
  if (cfg.fix && fixable.length > 0) {
    console.log(C.h('\n【自动修复中...】'));
    const fixed = await autoFix(auth, baseUrl, fixable);
    fixed.forEach(f => console.log('  ' + C.fix(f)));
    console.log(`  完成，共修复 ${fixed.length} 项`);
  }

  // 结论
  if (fails === 0 && warns <= 2) {
    console.log(C.ok('\n✅ 演示环境质量达标，可以交付。\n'));
  } else if (fails === 0) {
    console.log(C.warn(`\n⚠️  有 ${warns} 项警告，建议修复后再交付。\n`));
  } else {
    console.log(C.fail(`\n❌ 有 ${fails} 项必须修复后才能交付。运行 --fix 处理可自动修复项。\n`));
  }

  // 保存 JSON 报告
  if (cfg.reportFile) {
    const report = {
      timestamp: new Date().toISOString(),
      env: cfg.env,
      summary: { pass: passes, warn: warns, fail: fails },
      checks: all,
    };
    require('fs').writeFileSync(cfg.reportFile, JSON.stringify(report, null, 2));
    console.log(C.dim(`  报告已保存: ${cfg.reportFile}`));
  }

  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('\n自检脚本报错:', e.message);
  process.exit(2);
});
