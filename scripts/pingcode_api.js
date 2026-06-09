/**
 * PingCode REST API 统一封装
 * ============================
 * 封装所有已验证的 PingCode API 端点，提供统一接口。
 * Node.js v18+，零外部依赖（使用内置 fetch）。
 *
 * 使用方式:
 *   const api = require('./pingcode_api.js');
 *   const token = await api.getToken(clientId, clientSecret, baseUrl);
 *   const proj = await api.createProject(token, { name: 'xx', type: 'scrum', identifier: 'XX' });
 */

// ============================================================
// 默认配置
// ============================================================
const DEFAULT_BASE = "https://open.pingcode.com";
const DEFAULT_DELAY = 200; // 请求间隔 ms

// ============================================================
// 工具函数
// ============================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function H(token) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }

// ============================================================
// 认证
// ============================================================
async function getToken(clientId, clientSecret, baseUrl = DEFAULT_BASE) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const resp = await fetch(`${baseUrl}/v1/auth/token?${params}`);
  if (!resp.ok) throw new Error(`认证失败 HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return { token: data.access_token, type: data.token_type, baseUrl };
}

// ============================================================
// 项目管理
// ============================================================
async function createProject(token, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { name*, type*, identifier*, description, memberIds, assigneeId, startAt, endAt }
   * type: 'scrum' | 'kanban' | 'waterfall'
   */
  const body = { name: opts.name, type: opts.type, identifier: opts.identifier, state: "normal" };
  if (opts.description) body.description = opts.description;
  if (opts.memberIds) body.member_ids = opts.memberIds;
  if (opts.assigneeId) body.assignee_id = opts.assigneeId;
  if (opts.startAt) body.start_at = opts.startAt;
  if (opts.endAt) body.end_at = opts.endAt;
  const resp = await fetch(`${baseUrl}/v1/project/projects`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建项目失败: ${await resp.text()}`);
  return resp.json();
}

async function listProjects(token, baseUrl = DEFAULT_BASE) {
  const all = [];
  let page = 0;
  while (true) {
    const resp = await fetch(`${baseUrl}/v1/project/projects?page_index=${page}&page_size=50`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询项目失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

// ============================================================
// Sprint / 迭代
// ============================================================
async function createSprint(token, projectId, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { name*, assigneeId*, startAt, endAt, description, status, categoryIds }
   */
  const body = { name: opts.name, assignee_id: opts.assigneeId, status: opts.status || "pending" };
  if (opts.startAt) body.start_at = opts.startAt;
  if (opts.endAt) body.end_at = opts.endAt;
  if (opts.description) body.description = opts.description;
  if (opts.categoryIds) body.category_ids = opts.categoryIds;
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/sprints`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建Sprint失败: ${await resp.text()}`);
  const data = await resp.json();
  return Array.isArray(data) && data.length > 0 ? data[0].sprint : data;
}

// ============================================================
// 工作项
// ============================================================
async function createWorkItem(token, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { projectId*, title*, typeId*, description, parentId, startAt, endAt,
   *         priorityId, stateId, assigneeId, sprintId, versionId, boardId,
   *         storyPoints, estimatedWorkload, remainingWorkload, participantIds,
   *         entryId, swimlaneId, properties }
   * typeId: 'story' | 'task' | 'bug' | 'epic' | 'feature'
   * 注意: waterfall项目不支持 story/epic，用 task 做父级
   *       bug不能挂到task下
   */
  const body = { project_id: opts.projectId, type_id: opts.typeId, title: opts.title };
  const fieldMap = {
    description: "description", parentId: "parent_id", startAt: "start_at", endAt: "end_at",
    priorityId: "priority_id", stateId: "state_id", assigneeId: "assignee_id",
    sprintId: "sprint_id", versionId: "version_id", boardId: "board_id",
    entryId: "entry_id", swimlaneId: "swimlane_id", storyPoints: "story_points",
    estimatedWorkload: "estimated_workload", remainingWorkload: "remaining_workload",
  };
  for (const [optKey, apiKey] of Object.entries(fieldMap)) {
    if (opts[optKey] != null && opts[optKey] !== "" && opts[optKey] !== 0) {
      body[apiKey] = opts[optKey];
    }
  }
  if (opts.participantIds) body.participant_ids = opts.participantIds;
  // 注意: 不要在不知道custom field key的情况下传properties
  const resp = await fetch(`${baseUrl}/v1/project/work_items`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建工作项失败: ${await resp.text()}`);
  return resp.json();
}

async function updateWorkItem(token, workItemId, fields, baseUrl = DEFAULT_BASE) {
  /** fields: { parent_id, sprint_id, ... } */
  const resp = await fetch(`${baseUrl}/v1/project/work_items/${workItemId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新工作项失败: ${await resp.text()}`);
  return resp.json();
}

async function listWorkItems(token, projectId, baseUrl = DEFAULT_BASE) {
  const all = [];
  let page = 0;
  while (true) {
    const resp = await fetch(`${baseUrl}/v1/project/work_items?project_id=${projectId}&page_index=${page}&page_size=50`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询工作项失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

// ============================================================
// Wiki 知识库
// ============================================================
async function createWikiSpace(token, opts, baseUrl = DEFAULT_BASE) {
  /** opts: { name*, identifier*, description, visibility, scopeType } */
  const body = {
    name: opts.name, identifier: opts.identifier,
    visibility: opts.visibility || "private",
    scope_type: opts.scopeType || "organization",
  };
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/wiki/spaces`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建Wiki空间失败: ${await resp.text()}`);
  return resp.json();
}

async function createWikiPage(token, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { spaceId*, name*, content, formatType, parentId }
   * 注意: content和formatType必须同时存在
   */
  const body = { space_id: opts.spaceId, name: opts.name, type: "document" };
  if (opts.content) { body.content = opts.content; body.format_type = opts.formatType || "markdown"; }
  if (opts.parentId) body.parent_id = opts.parentId;
  const resp = await fetch(`${baseUrl}/v1/wiki/pages`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建Wiki页面失败: ${await resp.text()}`);
  return resp.json();
}

async function listWikiSpaces(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/spaces`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询Wiki空间失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function listWikiPages(token, spaceId, baseUrl = DEFAULT_BASE) {
  const all = [];
  let page = 0;
  while (true) {
    const resp = await fetch(`${baseUrl}/v1/wiki/pages?space_id=${spaceId}&page_index=${page}&page_size=50`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询Wiki页面失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

// ============================================================
// TestHub 测试管理
// ============================================================
async function createTestLibrary(token, opts, baseUrl = DEFAULT_BASE) {
  /** opts: { name*, identifier*, description } */
  const body = { name: opts.name, identifier: opts.identifier };
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建测试库失败: ${await resp.text()}`);
  return resp.json();
}

async function createTestSuite(token, libraryId, opts, baseUrl = DEFAULT_BASE) {
  /** opts: { name*, description } */
  const body = { name: opts.name };
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries/${libraryId}/suites`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建测试套件失败: ${await resp.text()}`);
  return resp.json();
}

async function createTestCase(token, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { testLibraryId*, suiteId*, title*, typeId, importantLevelId,
   *         stateId, precondition, steps: [{description, expected_value}], description }
   * 注意: 用 test_library_id (不是 library_id)
   */
  const body = {
    test_library_id: opts.testLibraryId,
    suite_id: opts.suiteId,
    title: opts.title,
    type_id: opts.typeId || "5f0c152f3342df1eff78bdb9",
    important_level_id: opts.importantLevelId || "67f32d3e455dac23e649107c",
    state_id: opts.stateId || "69fee13b6cc9f5d6d779c344",
  };
  if (opts.precondition) body.precondition = opts.precondition;
  if (opts.steps) body.steps = opts.steps;
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/testhub/cases`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建测试用例失败: ${await resp.text()}`);
  return resp.json();
}

async function createTestPlan(token, libraryId, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { name*, assigneeId*, startAt*, endAt, description }
   * 注意: assignee_id和start_at是必填字段
   */
  const body = {
    name: opts.name,
    assignee_id: opts.assigneeId,
    start_at: opts.startAt,
    end_at: opts.endAt || opts.startAt + 7776000,
  };
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries/${libraryId}/plans`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建测试计划失败: ${await resp.text()}`);
  return resp.json();
}

async function createTestRun(token, opts, baseUrl = DEFAULT_BASE) {
  /**
   * opts: { planId*, caseId*, libraryId*, assigneeId*, status, steps: [{step_id, status, actual_value}] }
   * 注意: library_id是必填字段
   */
  const body = {
    plan_id: opts.planId, case_id: opts.caseId,
    library_id: opts.libraryId, assignee_id: opts.assigneeId,
    status: opts.status || "pass",
  };
  if (opts.steps) body.steps = opts.steps;
  const resp = await fetch(`${baseUrl}/v1/testhub/runs`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建执行记录失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// 辅助: 用户信息
// ============================================================
async function getUsers(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/directory/users`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询用户失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function getMe(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/directory/users/me`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询当前用户失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// 项目管理: 更新、克隆、成员
// ============================================================
async function getProject(token, projectId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询项目失败: ${await resp.text()}`);
  return resp.json();
}

async function updateProject(token, projectId, fields, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新项目失败: ${await resp.text()}`);
  return resp.json();
}

async function cloneProject(token, projectId, identifier, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/clone`, { method: "POST", headers: H(token), body: JSON.stringify({ identifier }) });
  if (!resp.ok) throw new Error(`克隆项目失败: ${await resp.text()}`);
  return resp.json();
}

async function listProjectMembers(token, projectId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/members`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询项目成员失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function addProjectMember(token, projectId, memberId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/members`, { method: "POST", headers: H(token), body: JSON.stringify({ user_id: memberId }) });
  if (!resp.ok) throw new Error(`添加项目成员失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// 工作项: 类型查询、批量更新、版本
// ============================================================
async function getWorkItemTypes(token, baseUrl = DEFAULT_BASE) {
  /** 获取所有系统预置工作项类型 (epic/feature/story/task/bug/issue + custom) */
  const resp = await fetch(`${baseUrl}/v1/project/work_item_types`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询工作项类型失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function batchUpdateWorkItems(token, updates, baseUrl = DEFAULT_BASE) {
  /** updates: [{ id, fields: { parent_id, state_id, ... } }] */
  const body = { updates: updates.map(u => ({ id: u.id, ...u.fields })) };
  const resp = await fetch(`${baseUrl}/v1/project/work_items`, { method: "PATCH", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`批量更新工作项失败: ${await resp.text()}`);
  return resp.json();
}

async function listWorkItemVersions(token, workItemId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/work_items/${workItemId}/versions`, { headers: H(token) });
  if (!resp.ok) return [];
  return (await resp.json()).values || [];
}

// ============================================================
// Sprint: 查询、更新
// ============================================================
async function listSprints(token, projectId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/sprints`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询Sprint失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function updateSprint(token, projectId, sprintId, fields, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/sprints/${sprintId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新Sprint失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// Wiki: 页面内容、版本
// ============================================================
async function getWikiPage(token, pageId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/pages/${pageId}`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询Wiki页面失败: ${await resp.text()}`);
  return resp.json();
}

async function updateWikiPage(token, pageId, fields, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/pages/${pageId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新Wiki页面失败: ${await resp.text()}`);
  return resp.json();
}

async function updateWikiPageContent(token, pageId, content, formatType = "markdown", baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/pages/${pageId}/content`, { method: "PUT", headers: H(token), body: JSON.stringify({ content, format_type: formatType }) });
  if (!resp.ok) throw new Error(`更新Wiki内容失败: ${await resp.text()}`);
  return resp.json();
}

async function getWikiPageContent(token, pageId, versionId = "", baseUrl = DEFAULT_BASE) {
  let url = `${baseUrl}/v1/wiki/pages/${pageId}/content`;
  if (versionId) url += `?version_id=${versionId}`;
  const resp = await fetch(url, { headers: H(token) });
  if (!resp.ok) throw new Error(`获取Wiki内容失败: ${await resp.text()}`);
  return resp.json();
}

async function listWikiPageVersions(token, pageId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/pages/${pageId}/versions`, { headers: H(token) });
  if (!resp.ok) return [];
  return (await resp.json()).values || [];
}

async function restoreWikiPageVersion(token, pageId, versionId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/wiki/pages/${pageId}/versions/${versionId}/restore`, { method: "POST", headers: H(token) });
  if (!resp.ok) throw new Error(`恢复Wiki版本失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// TestHub: 查询（自检用）
// ============================================================
async function listTestLibraries(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询测试库失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function listTestSuites(token, libraryId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries/${libraryId}/suites`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询测试套件失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function listTestCases(token, opts = {}, baseUrl = DEFAULT_BASE) {
  /** opts: { libraryId?, suiteId? } */
  const params = new URLSearchParams();
  if (opts.libraryId) params.set('test_library_id', opts.libraryId);
  if (opts.suiteId) params.set('suite_id', opts.suiteId);
  const all = [];
  let page = 0;
  while (true) {
    params.set('page_index', page);
    params.set('page_size', 50);
    const resp = await fetch(`${baseUrl}/v1/testhub/cases?${params}`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询测试用例失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

async function listTestPlans(token, libraryId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries/${libraryId}/plans`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询测试计划失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

// ============================================================
// Ship: 查询（自检用）
// ============================================================
async function listShipProducts(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/ship/products`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询Ship产品失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

async function listShipTickets(token, productId, baseUrl = DEFAULT_BASE) {
  const all = [];
  let page = 0;
  while (true) {
    const resp = await fetch(`${baseUrl}/v1/ship/tickets?product_id=${productId}&page_index=${page}&page_size=50`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询工单失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

async function listShipIdeas(token, productId, baseUrl = DEFAULT_BASE) {
  const all = [];
  let page = 0;
  while (true) {
    const resp = await fetch(`${baseUrl}/v1/ship/ideas?product_id=${productId}&page_index=${page}&page_size=50`, { headers: H(token) });
    if (!resp.ok) throw new Error(`查询需求失败: ${await resp.text()}`);
    const data = await resp.json();
    all.push(...(data.values || []));
    if (all.length >= (data.total || 0)) break;
    page++;
  }
  return all;
}

// ============================================================
// TestHub: 更新执行、计划、用例删除
// ============================================================
async function updateTestRun(token, runId, fields, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/runs/${runId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新执行记录失败: ${await resp.text()}`);
  return resp.json();
}

async function updateTestPlan(token, libraryId, planId, fields, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/libraries/${libraryId}/plans/${planId}`, { method: "PATCH", headers: H(token), body: JSON.stringify(fields) });
  if (!resp.ok) throw new Error(`更新测试计划失败: ${await resp.text()}`);
  return resp.json();
}

async function getTestRunStatuses(token, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/testhub/run_statuses`, { headers: H(token) });
  if (!resp.ok) throw new Error(`查询执行状态失败: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

// ============================================================
// 关注人 (跨模块通用)
// ============================================================
async function addParticipant(token, principalType, principalId, userId, baseUrl = DEFAULT_BASE) {
  const body = { principal_type: principalType, principal_id: principalId, user_id: userId };
  const resp = await fetch(`${baseUrl}/v1/participants`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`添加关注人失败: ${await resp.text()}`);
  return resp.json();
}

async function listParticipants(token, principalType, principalId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/participants?principal_type=${principalType}&principal_id=${principalId}`, { headers: H(token) });
  if (!resp.ok) return [];
  return (await resp.json()).values || [];
}

// ============================================================
// 工时 (跨模块通用)
// ============================================================
async function createWorkload(token, opts, baseUrl = DEFAULT_BASE) {
  /** opts: { principalType*, principalId*, type*, duration*, reportAt, description } */
  const body = { principal_type: opts.principalType, principal_id: opts.principalId, type: opts.type, duration: opts.duration };
  if (opts.reportAt) body.report_at = opts.reportAt;
  if (opts.description) body.description = opts.description;
  const resp = await fetch(`${baseUrl}/v1/workloads`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建工时失败: ${await resp.text()}`);
  return resp.json();
}

async function listWorkloads(token, principalType, principalId, baseUrl = DEFAULT_BASE) {
  const resp = await fetch(`${baseUrl}/v1/workloads?principal_type=${principalType}&principal_id=${principalId}`, { headers: H(token) });
  if (!resp.ok) return [];
  return (await resp.json()).values || [];
}

// ============================================================
// 产品管理 Ship: 工单
// ============================================================
async function createTicket(token, opts, baseUrl = DEFAULT_BASE) {
  /** opts: { title*, description, priorityId, channelId, productId, customerId } */
  const body = { title: opts.title };
  if (opts.description) body.description = opts.description;
  if (opts.priorityId) body.priority_id = opts.priorityId;
  if (opts.channelId) body.channel_id = opts.channelId;
  if (opts.productId) body.product_id = opts.productId;
  if (opts.customerId) body.customer_id = opts.customerId;
  const resp = await fetch(`${baseUrl}/v1/ship/tickets`, { method: "POST", headers: H(token), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`创建工单失败: ${await resp.text()}`);
  return resp.json();
}

// ============================================================
// 辅助: ID 常量 (PingCode 系统预置)
// ============================================================
const CASE_TYPES = {
  functional: "5f0c152f3342df1eff78bdb9",
  performance: "5f0c15353342df1eff78bdba",
  config: "5f0c153d3342df1eff78bdbb",
  install: "5f0c15433342df1eff78bdbc",
  api: "5f0c15493342df1eff78bdbd",
  security: "5f0c15de3342df1eff78bdbe",
  compatibility: "5f0c16203342df1eff78bdbf",
  ui: "5f0c162c3342df1eff78bdc0",
  other: "5f0c16333342df1eff78bdc1",
};

const IMPORTANT_LEVELS = {
  P0: "67f32d3e455dac23e649107b",
  P1: "67f32d3e455dac23e649107c",
  P2: "67f32d3e455dac23e649107d",
  P3: "67f32d3e455dac23e649107e",
  P4: "67f32d3e455dac23e649107f",
};

const CASE_STATES = {
  design: "69fee13b6cc9f5d6d779c344",
  ready: "69fee13b6cc9f5d6d779c345",
  deprecated: "69fee13b6cc9f5d6d779c346",
};

// ============================================================
// 批量创建辅助
// ============================================================
async function batchCreate(items, createFn, delay = DEFAULT_DELAY) {
  /** 串行批量创建（有依赖顺序时使用），自动限速和错误收集 */
  const results = [];
  const errors = [];
  for (const item of items) {
    try {
      results.push(await createFn(item));
    } catch (e) {
      errors.push({ item, error: e.message });
    }
    await sleep(delay);
  }
  return { results, errors, total: items.length, ok: results.length, fail: errors.length };
}

async function batchCreateParallel(items, createFn, { concurrency = 5, delay = 100 } = {}) {
  /**
   * 并发批量创建（同级无依赖时使用，如同一 Phase 下的多个 Epic）
   * 每批 concurrency 个并发，批间等待 delay ms
   * 相比串行 batchCreate 约快 4-5x
   */
  const results = [];
  const errors = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(item => createFn(item)));
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') {
        results.push(settled[j].value);
      } else {
        errors.push({ item: batch[j], error: settled[j].reason?.message || String(settled[j].reason) });
      }
    }
    if (i + concurrency < items.length) await sleep(delay);
  }
  return { results, errors, total: items.length, ok: results.length, fail: errors.length };
}

// ============================================================
// 历史数据辅助
// ============================================================

/**
 * 创建已完成状态的工作项 (带过去时间)
 */
async function createHistoricalWorkItem(token, opts, baseUrl = DEFAULT_BASE) {
  const body = {
    project_id: opts.projectId,
    type_id: opts.typeId || 'task',
    title: opts.title,
    description: opts.description || '',
    start_at: opts.startAt,
    end_at: opts.endAt,
    priority_id: opts.priorityId,
    state_id: opts.stateId,
    assignee_id: opts.assigneeId,
    sprint_id: opts.sprintId,
    estimated_workload: opts.estimatedWorkload,
    remaining_workload: opts.state === 'completed' ? 0 : (opts.remainingWorkload || opts.estimatedWorkload),
  };
  if (opts.parentId) body.parent_id = opts.parentId;
  if (opts.participantIds) body.participant_ids = opts.participantIds;
  const resp = await fetch(`${baseUrl}/v1/project/work_items`, {
    method: 'POST', headers: H(token), body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('创建工作项失败: ' + (await resp.text()));
  return resp.json();
}

/**
 * 批量创建历史 Sprint
 * @param {Object} token
 * @param {string} projectId
 * @param {Array} sprints - [{ name, start_at, end_at, status }]
 * @param {string} assigneeId
 */
async function createHistoricalSprints(token, projectId, sprints, assigneeId, baseUrl = DEFAULT_BASE) {
  const created = [];
  for (const s of sprints) {
    const body = {
      name: s.name,
      assignee_id: assigneeId,
      start_at: s.start_at,
      end_at: s.end_at,
      status: s.status || 'completed',
    };
    const resp = await fetch(`${baseUrl}/v1/project/projects/${projectId}/sprints`, {
      method: 'POST', headers: H(token), body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('创建 Sprint 失败: ' + (await resp.text()));
    created.push(await resp.json());
    await sleep(DEFAULT_DELAY);
  }
  return created;
}

// ============================================================
// 导出
// ============================================================
// ============================================================
// 随机用户派发
// ============================================================

/**
 * 从用户列表中随机抽取 N 个用户
 * @param {Array} users - getUsers() 返回的用户数组
 * @param {number} count - 抽取数量
 * @param {Array} excludeIds - 排除的用户 ID
 * @returns {Array} 选中用户 [{ id, name, ... }]
 */
function randomPick(users, count = 1, excludeIds = []) {
  const pool = users.filter(u => !excludeIds.includes(u.id));
  if (pool.length === 0) return [];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

/**
 * 随机选定一个负责人
 * @param {Array} users
 * @param {Array} excludeIds
 * @returns {Object|null} { id, name }
 */
function randomAssignee(users, excludeIds = []) {
  const pick = randomPick(users, 1, excludeIds);
  return pick.length > 0 ? pick[0] : null;
}

/**
 * 随机选定关注人 (1-3人，排除负责人)
 * @param {Array} users
 * @param {string} assigneeId - 负责人 ID（排除掉）
 * @param {number} maxCount - 最多关注人数
 * @returns {Array} [{ id, name }]
 */
function randomParticipants(users, assigneeId, maxCount = 3) {
  const count = Math.min(maxCount, Math.max(1, Math.floor(Math.random() * maxCount) + 1));
  return randomPick(users, count, assigneeId ? [assigneeId] : []);
}

module.exports = {
  // 认证
  getToken, sleep,
  // 项目
  createProject, getProject, updateProject, cloneProject, listProjects,
  listProjectMembers, addProjectMember,
  // Sprint
  createSprint, listSprints, updateSprint,
  // 工作项
  createWorkItem, updateWorkItem, listWorkItems,
  batchUpdateWorkItems, getWorkItemTypes, listWorkItemVersions,
  // Wiki
  createWikiSpace, listWikiSpaces, listWikiPages,
  createWikiPage, getWikiPage, updateWikiPage,
  updateWikiPageContent, getWikiPageContent,
  listWikiPageVersions, restoreWikiPageVersion,
  // TestHub
  createTestLibrary, createTestSuite, createTestCase,
  createTestPlan, updateTestPlan, createTestRun, updateTestRun,
  getTestRunStatuses,
  listTestLibraries, listTestSuites, listTestCases, listTestPlans,
  // Ship
  listShipProducts, listShipTickets, listShipIdeas,
  // 关联模块
  addParticipant, listParticipants,
  createWorkload, listWorkloads,
  createTicket,
  // 用户
  getUsers, getMe,
  // 常量
  CASE_TYPES, IMPORTANT_LEVELS, CASE_STATES,
  batchCreate, batchCreateParallel,
  // 历史数据
  createHistoricalWorkItem, createHistoricalSprints,
  // 随机用户派发
  randomPick, randomAssignee, randomParticipants,
};
