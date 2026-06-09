/**
 * PingCode 历史数据模拟引擎
 * ============================
 * 为售前演示生成有真实感的项目历史数据。
 * 使用: const hist = require('./pingcode_historical.js');
 *       const config = hist.generateConfig(workItems, { ratio: { done: 0.35, progress: 0.15 } });
 */

// ============================================================
// 工具函数
// ============================================================
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n) {
  return Math.floor(Date.now() / 1000) - n * 86400;
}

function daysFromNow(n) {
  return Math.floor(Date.now() / 1000) + n * 86400;
}

// ============================================================
// 核心: 为工作项数组分配时间线和状态
// ============================================================

/**
 * 按比例将工作项分配到三个状态桶: 已完成 / 进行中 / 待开始
 * @param {Array} items - 工作项配置数组 [{ title, type, estimated_workload }]
 * @param {Object} opts - { ratio: { done: 0.35, progress: 0.15 } }
 * @returns {Array} items 加上 timeline 和 state 字段
 */
function distributeTimeline(items, opts = {}) {
  const ratio = opts.ratio || { done: 0.35, progress: 0.15 };
  const total = items.length;
  const doneCount = Math.round(total * ratio.done);
  const progressCount = Math.round(total * ratio.progress);

  // Fisher-Yates 洗牌，确保随机分配
  const shuffled = [...items].sort(() => Math.random() - 0.5);

  const doneItems = [];
  const progressItems = [];
  const pendingItems = [];

  for (let i = 0; i < shuffled.length; i++) {
    const item = { ...shuffled[i] };
    if (doneItems.length < doneCount) {
      // 已完成: 2-3 月前开始，完成后在 start 后 3天-4周
      const startOffset = randomBetween(60, 90); // 2-3 月前
      const duration = randomBetween(3, 28);     // 3天-4周
      item.start_at = daysAgo(startOffset);
      item.end_at = daysAgo(startOffset - duration);
      item.state = 'completed';
      // 工时记录模拟: 在估算工时 80%-110% 之间
      item.recorded_workload = Math.round(item.estimated_workload * (0.8 + Math.random() * 0.3));
      doneItems.push(item);
    } else if (progressItems.length < progressCount) {
      // 进行中: 2-3 周前开始，1-2 周后截止
      const startOffset = randomBetween(14, 21);
      item.start_at = daysAgo(startOffset);
      item.end_at = daysFromNow(randomBetween(7, 14));
      item.state = 'in_progress';
      // 部分工时记录
      item.recorded_workload = Math.round(item.estimated_workload * (0.2 + Math.random() * 0.4));
      progressItems.push(item);
    } else {
      // 待开始: 当前或未来
      item.start_at = daysFromNow(randomBetween(0, 14));
      item.end_at = daysFromNow(randomBetween(14, 42));
      item.state = 'pending';
      item.recorded_workload = 0;
      pendingItems.push(item);
    }
  }

  return [...doneItems, ...progressItems, ...pendingItems];
}

// ============================================================
// Bug 收敛曲线: Bug 集中在前半段、修复在后半段
// ============================================================

/**
 * 为 Bug 列表生成收敛曲线时间线
 * Bug 创建时间集中在早期 Sprint，修复时间在后期
 * @param {Array} bugs - Bug 配置数组
 * @param {number} sprintCount - Sprint 总数
 * @returns {Array} bugs 加上收敛曲线时间线
 */
function distributeBugsConvergence(bugs, sprintCount = 3) {
  return bugs.map((bug, i) => {
    // 早期 Bug 多，后期少 — 用 i/bugs.length 控制比例
    const progress = i / bugs.length;
    // 发现时间: 集中在 Sprint 0-1
    const foundSprint = progress < 0.6 ? 0 : (progress < 0.85 ? 1 : 2);
    // 修复时间: 分布在 Sprint 1-2
    const fixedSprint = foundSprint + randomBetween(1, Math.min(2, sprintCount - foundSprint));

    const sprintDuration = 14; // 每 Sprint 2 周
    const baseTime = daysAgo(sprintCount * sprintDuration);

    return {
      ...bug,
      start_at: baseTime + foundSprint * sprintDuration * 86400 + randomBetween(0, sprintDuration * 86400),
      end_at: baseTime + fixedSprint * sprintDuration * 86400 + randomBetween(0, sprintDuration * 86400),
      state: 'completed',
    };
  });
}

// ============================================================
// Sprint 历史生成
// ============================================================

/**
 * 生成历史 Sprint 配置
 * @param {number} count - Sprint 数量
 * @param {number} sprintDurationDays - 每 Sprint 天数
 * @returns {Array} Sprint 配置
 */
function generateHistoricalSprints(count = 2, sprintDurationDays = 14) {
  const sprints = [];
  for (let i = count; i >= 1; i--) {
    const startOffset = (i * sprintDurationDays) + randomBetween(-2, 2);
    const endOffset = ((i - 1) * sprintDurationDays) + randomBetween(-1, 1);
    sprints.push({
      name: `Sprint ${count - i + 1}`,
      start_at: daysAgo(startOffset),
      end_at: daysAgo(endOffset),
      status: 'completed',
    });
  }
  return sprints;
}

// ============================================================
// 工时记录生成
// ============================================================

/**
 * 为已完成/进行中的工作项生成工时记录
 * @param {Object} item - 含 estimated_workload, recorded_workload, start_at, end_at
 * @returns {Array} 工时记录数组 [{ date, hours, description }]
 */
function generateWorkloadLogs(item) {
  if (!item.recorded_workload || item.recorded_workload <= 0) return [];
  const logs = [];
  const totalHours = item.recorded_workload;
  const startDate = item.start_at * 1000;
  const endDate = (item.end_at || Date.now() / 1000) * 1000;
  const days = Math.max(1, Math.round((endDate - startDate) / 86400000));
  const entries = Math.min(days, 10); // 最多 10 条记录
  let remaining = totalHours;

  for (let i = 0; i < entries && remaining > 0; i++) {
    const amount = i === entries - 1
      ? remaining
      : Math.round(remaining * (0.1 + Math.random() * 0.3));
    remaining -= amount;
    logs.push({
      date: Math.floor(startDate / 1000) + (i * Math.floor(days / entries) * 86400),
      hours: Math.max(1, amount),
      description: '工时登记',
    });
  }
  return logs;
}

// ============================================================
// 主入口: 生成完整的历史数据配置
// ============================================================

/**
 * @param {Array} workItems - [{ title, type, estimated_workload }]
 * @param {Object} opts - 可选配置
 * @returns {Object} { items, sprints, stats }
 */
function generateConfig(workItems, opts = {}) {
  const sprintCount = opts.sprintCount || 2;
  const ratio = opts.ratio || { done: 0.35, progress: 0.15 };

  const items = distributeTimeline(workItems, { ratio });

  const bugs = items.filter(i => i.type === 'bug');
  const otherItems = items.filter(i => i.type !== 'bug');

  const distributedBugs = bugs.length > 0
    ? distributeBugsConvergence(bugs, sprintCount + 1)
    : [];

  const sprints = generateHistoricalSprints(sprintCount);

  return {
    items: [...otherItems, ...distributedBugs],
    sprints,
    stats: {
      total: items.length,
      completed: items.filter(i => i.state === 'completed').length,
      inProgress: items.filter(i => i.state === 'in_progress').length,
      pending: items.filter(i => i.state === 'pending').length,
    },
  };
}

module.exports = {
  distributeTimeline,
  distributeBugsConvergence,
  generateHistoricalSprints,
  generateWorkloadLogs,
  generateConfig,
  daysAgo,
  daysFromNow,
};
