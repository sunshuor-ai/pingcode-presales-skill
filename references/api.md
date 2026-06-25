# PingCode REST API 完整参考

## 认证

```
GET https://open.pingcode.com/v1/auth/token?grant_type=client_credentials&client_id=...&client_secret=...
```
返回: `{ access_token, token_type: "Bearer", expires_in: <timestamp> }`

## 项目管理

| 端点 | 方法 | 关键字段 |
|------|------|---------|
| `/v1/project/projects` | POST | name*, type*, identifier*, description, member_ids, start_at, end_at, assignee_id, state:"normal" |
| `/v1/project/projects` | GET | page_index, page_size |
| `/v1/project/projects/{id}` | GET | — |
| `/v1/project/projects/{id}` | PATCH | 任意字段 |
| `/v1/project/projects/{id}/clone` | POST | identifier*(新项目标识) |
| `/v1/project/projects/{id}/members` | GET/POST/DELETE | user_id |
| `/v1/project/projects/{id}/sprints` | GET/POST | name*, assignee_id*, start_at, end_at, status:"pending", category_ids |
| `/v1/project/projects/{id}/sprints/{sid}` | GET/PATCH | — |
| `/v1/project/projects/{id}/versions` | GET/POST | name, start_at, end_at |
| `/v1/project/work_items` | POST | project_id*, type_id*, title*, description, parent_id, start_at, end_at, priority_id, state_id, assignee_id, sprint_id, version_id, board_id, entry_id, swimlane_id, story_points, estimated_workload, remaining_workload, participant_ids |
| `/v1/project/work_items` | GET | project_id(必填), page_index, page_size |
| `/v1/project/work_items` | PATCH | 批量更新: [{ id, fields }] |
| `/v1/project/work_items/{id}` | GET | — |
| `/v1/project/work_items/{id}` | PATCH | parent_id, sprint_id, state_id 等 |
| `/v1/project/work_item_types` | GET | — |

**项目类型**: `"scrum"` | `"kanban"` | `"waterfall"` | `"hybrid"`

**工作项类型** (type_id string values): `"epic"` | `"feature"` | `"story"` | `"task"` | `"bug"` | `"issue"`
系统也预置 ObjectId 格式的类型（如 `69fee13a287f09f61c548e16`=阶段），通过 GET work_item_types 获取。

**层级规则（Hybrid 双轨制 — 实战验证）**:

```
阶段 (Phase, type_id 动态获取)
├── 里程碑 (Milestone)              parent_id = 阶段 ✓
├── 需求 (Requirement)               parent_id = 阶段 ✓ (产品管理线)
│   └── 任务 (Task)                  parent_id = 需求
│
├── 史诗 (Epic)                     phase_id = 阶段 (所属计划), NOT parent_id!
│   └── 特性 (Feature)               parent_id = 史诗 + phase_id = 阶段
│       └── 用户故事 (Story)         parent_id = 特性 + phase_id = 阶段
│           ├── 任务 (Task)          parent_id = 故事 + phase_id = 阶段
│           └── 缺陷 (Bug)           parent_id = 故事 + phase_id = 阶段
```
> **重要**: 阶段关联字段是 `phase_id` 而非 `plan_id`。所有工作项创建时都应带 `phase_id`，PATCH 更新也支持。
```

- **产品管理线**: 阶段 → 需求 → 任务。适用于产品需求/功能规格。
- **研��开发线**: 阶段(plan) → 史诗 → 特性 → 用户故事 → 任务/缺陷。适用于软件开发迭代。
- **Waterfall**: 不支持 story/epic/feature，用 task 做父级。
- Bug 不能挂 task 下
- 项目不支持某类型时返回 `1003104: "项目中不存在该工作项类型"`
- 父类型不正确时返回 `100319: "父工作项的类型不正确"`

## Wiki 知识库

| 端点 | 方法 | 关键字段 |
|------|------|---------|
| `/v1/wiki/spaces` | POST | name*, identifier*, visibility:"private", scope_type:"organization", description |
| `/v1/wiki/spaces` | GET | — |
| `/v1/wiki/spaces/{id}` | GET/PATCH/DELETE | — |
| `/v1/wiki/pages` | POST | space_id*, name*, type:"document", content, format_type:"markdown", parent_id |
| `/v1/wiki/pages` | GET | space_id(必填) |
| `/v1/wiki/pages/{id}` | GET/PATCH/DELETE | lock:0/1 |
| `/v1/wiki/pages/{id}/content` | GET | version_id(可选) |
| `/v1/wiki/pages/{id}/content` | PUT | content*, format_type* |
| `/v1/wiki/pages/{id}/versions` | GET | — |
| `/v1/wiki/pages/{id}/versions/{vid}/restore` | POST | — |

**注意**: `content` 和 `format_type` 必须同时存在。`format_type` 值: `"text"` | `"markdown"` | `"html"`

## TestHub 测试

| 端点 | 方法 | 关键字段 |
|------|------|---------|
| `/v1/testhub/libraries` | POST | name*, identifier*, description |
| `/v1/testhub/libraries` | GET | — |
| `/v1/testhub/libraries/{id}/suites` | POST | name*, description |
| `/v1/testhub/cases` | POST | test_library_id*, suite_id*, title*, type_id, important_level_id, state_id, precondition, steps, description |
| `/v1/testhub/cases` | GET | test_library_id 或 suite_id |
| `/v1/testhub/cases/{id}` | GET/DELETE | — |
| `/v1/testhub/libraries/{id}/plans` | POST | name*, assignee_id*, start_at*, end_at, description |
| `/v1/testhub/libraries/{id}/plans` | GET | — |
| `/v1/testhub/libraries/{id}/plans/{pid}` | PATCH | — |
| `/v1/testhub/runs` | POST | plan_id*, case_id*, library_id*, assignee_id*, status, steps |
| `/v1/testhub/runs` | GET | plan_id, case_id, status |
| `/v1/testhub/runs/{id}` | GET/PATCH | status, steps |
| `/v1/testhub/run_statuses` | GET | — |
| `/v1/testhub/case_types` | GET | — |

**Steps 格式**: `[{ description, expected_value }]` (创建case), `[{ step_id, status, actual_value }]` (创建run)

## 系统 ID 常量

### 用例类型 (case_types) — daocloud-test 实测
| 名称 | ID |
|------|-----|
| 信息类 | `5f0c162c3342df1eff78bdc0` |
| 功能需求 | `5f0c16333342df1eff78bdc1` |
| 评审类 | `67d3f07ff62a8a0f991ed093` |
> **注意**: case_types 环境间差异大，必须 `GET /v1/testhub/case_types` 动态获取。

### Ship 工单类型 (ticket_types)
| 名称 | ID |
|------|-----|
| 需求 | `67a3657a42012b855324f989` |
| 缺陷 | `67a3657a42012b855324f98a` |
| 运维 | `68366fca6075e634a28b17be` |

### Ship 工单优先级 (ticket_priorities)
| 等级 | ID |
|------|-----|
| P0 | `5cb9466afda1ce4ca0090005` |
| P1 | `5cb9466afda1ce4ca0090004` |
| P2 | `5cb9466afda1ce4ca0090003` |
| P3 | `5cb9466afda1ce4ca0090002` |
| P4 | `5cb9466afda1ce4ca0090001` |

### 产品管理 Ship
| 端点 | 方法 | 用途 |
|------|------|------|
| `/v1/ship/products` | POST/GET | 产品空间 |
| `/v1/ship/tickets` | POST/GET | 工单 (需 type_id + priority_id + product_id) |
| `/v1/ship/ideas` | POST/GET | 需求 (需 product_id) |
| `/v1/ship/ideas/{id}/transition_histories` | GET | 需求流转历史 |
| `/v1/ship/ticket_types` | GET | 工单类型 |
| `/v1/ship/ticket_priorities` | GET | 工单优先级 |

### 优先级 (important_levels)
| 等级 | ID |
|------|-----|
| P0 | `67f32d3e455dac23e649107b` |
| P1 | `67f32d3e455dac23e649107c` |
| P2 | `67f32d3e455dac23e649107d` |
| P3 | `67f32d3e455dac23e649107e` |
| P4 | `67f32d3e455dac23e649107f` |

### 用例状态 (case_states)
| 状态 | ID |
|------|-----|
| 设计 | `69fee13b6cc9f5d6d779c344` |
| 就绪 | `69fee13b6cc9f5d6d779c345` |
| 废弃 | `69fee13b6cc9f5d6d779c346` |

## 关联模块

| 端点 | 方法 | 用途 |
|------|------|------|
| `/v1/participants` | POST/GET/DELETE | 关注人 (需 principal_type + principal_id) |
| `/v1/workloads` | POST/GET/DELETE | 工时记录 (POST 需 principal_type+principal_id+duration+report_by_id+report_at) |
| `/v1/workload_types` | GET | 工时类型 (POST workloads 的 type 可选) |

## 产品管理 Ship

| 端点 | 方法 | 用途 |
|------|------|------|
| `/v1/ship/products` | POST/GET | 产品空间（创建后得到 product_id，工单/需求依赖此 ID） |
| `/v1/ship/tickets` | POST/GET | 工单 (需 product_id + type_id + priority_id) |
| `/v1/ship/ideas` | POST/GET | 需求 (需 product_id) |
| `/v1/ship/ideas/{id}/transition_histories` | GET | 需求流转历史 |
| `/v1/ship/ticket_types` | GET | 工单类型列表 |
| `/v1/ship/ticket_priorities` | GET | 工单优先级列表 |

## 用户与目录

| 端点 | 方法 | 用途 |
|------|------|------|
| `/v1/directory/users` | GET | 用户列表 |
| `/v1/directory/users/me` | GET | 当前用户 |
| `/v1/directory/groups` | POST/GET | 团队管理 |

## 常见错误码

| 错误码 | 含义 | 解决 |
|--------|------|------|
| `100008` | 必填字段缺失 | 检查 message 中指出的字段 |
| `100043` | property_key 不存在 | 移除 properties 字段 |
| `100319` | 父工作项类型不正确 | Bug不能直接挂Feature,必须Story→Bug; Story不能挂Story |
| `100336` | 项目标识已存在 | 使用已有项目ID, 跳过创建 |
| `100613` | 测试用例类型不存在/无权限 | GET case_types 获取环境特定ID,不要硬编码 |
| `1003104` | 项目中不存在该工作项类型 | 换用支持的 type_id |
| `100601` | 测试用例不存在/无权限 | 检查 library_id 或 case_id |
| `100605` | 创建执行用例失败 | 检查 run 的 library_id+case_id+plan_id |

## 已踩坑教训

### 通用铁律
1. **环境间 ID 不通用**: case_types, ticket_types, case_states, states, priorities 在不同 PingCode 实例中 ID 不同,必须 GET 动态获取。**严禁硬编码 state_id**（如 `"completed"` 无效）。
2. **完整五级层级**: 阶段(计划级,无parent) → Epic(顶层) → Feature(含parent_id) → Story(含parent_id) → Task/Bug(含parent_id)。不能跳过中间层。
3. **Bug 只能挂 Story 下**: 层级必须是 Story→Bug, Bug直接挂Feature回报 `100319: 父工作项的类型不正确`。
4. **Story 只能挂 Feature 下**: Story 直接挂 Epic 回报 `100319`。
5. **阶段是计划级工作项**: type_id 动态获取(daocloud-test: `67a3657a243894bea2d12580`)。阶段与 Epic 并列项目顶层，Epic 不通过 parent_id 挂阶段。
6. **所有工作项必须设时间**: start_at/end_at 不能为空,精确到天即可。
7. **所有工作项必须有负责人**: `GET /v1/directory/users` → 随机选 `assignee_id` → 随机 1-3 个 `participant_ids`。

### Wiki
8. **创建必须带 scope_type**: `scope_type: "organization"` 是必填字段，缺省返回 `100039`。
9. **identifier 不能重复**: 重复标识返回 500 内部错误。

### TestHub
10. **identifier 格式**: 必须大写字母开头，不含 `-` 或纯小写。如 `GX100TEST` ✓，`test-lib-001` ✗，`testlib001` ✗。
11. **test_library_id 不是 library_id**: 创建 case 时用 `test_library_id` 字段。

### 项目管理
12. **项目标识格式**: 避免下划线+长后缀。如 `GVRVERIFY` ✓，`GRAVITYXR_VERIFY` ✗ (回报 `100335`)。
13. **state_id 建议**: 环境间不通用且容易出错。不确定时不传 state_id，系统使用默认初始状态。时间戳体现历史感即可。
14. **Ship 工单创建**: 需要 `product_id` + `type_id` + `title` + `description` + `priority_id`。priority_id 用 ticket_priorities 的 ID（非工作项优先级的 ID）。
15. **Ship 需求创建**: 需要 `product_id` + `title` + `description`。不需要 priority_id。
16. **phase_id 不是 plan_id**: API 文档写 `plan_id` 但实际字段是 `phase_id`。创建 story/task/bug 时 `plan_id` 不生效，`phase_id` 对所有类型有效，且支持 PATCH 更新。
17. **created_by 只读**: 项目和工作项的创建人由 API token 身份决定，PATCH 无法修改。需要以特定身份创建时，必须使用该用户的 token。
18. **phase_id 继承覆盖**: 子工作项创建时即使传了正确的 phase_id，后端会用父工作项的 phase_id 覆盖。所有含 parent_id 的工作项创建后必须 PATCH `{phase_id}` 修正。
19. **交付物强制**: 混合/瀑布项目每个 Story/Task 必须创建交付物（`POST /v1/project/deliverables`），格式为具体可验证的产出物名称。
20. **内容填充不可省略**: Wiki 页面(content+format_type)和测试用例(steps数组)创建后必须填充实际内容，不能留空壳。
21. **Ship 产品前置**: 工单和需求依赖 product_id，必须先于工单/需求创建 Ship 产品空间。

### 工时登记（2026-06-25 实测）
22. **登记人字段是 `report_by_id`**: 企业/client_credentials 鉴权下 POST `/v1/workloads` 必填，缺失回报 `100396 "登记人不能为空"`。**不是** `reported_by`/`owner_id`/`member_id`/`user_id` 等（实测 20+ 候选全失败）。GET 工时对象里展开成 `report_by` 对象，但写入用 `report_by_id`。
23. **`report_at` 须对齐北京当日0点且不晚于今天**: 否则回报 `100810 "工时的登记日期不能在当天之后"`。对齐: `bjDay = ts => ts - ((ts + 8*3600) % 86400)`，再 `Math.min(bjDay(ts), bjDay(now))`。
24. **`duration` 单位是小时且 0<d≤24**: 超出回报 `100004 "duration不在[0,24]范围内"`。`type`(workload_type id) 可选。
25. **登记人取该工作项 assignee**: "谁干的活谁登工时"，多人环境更真实；assignee 为空时兜底随机用户池。

### 性能 / 限流（2026-06-25 实测）
26. **限流宽松，禁止纯串行创建**: 实测 GET 并发 40、POST 并发 15 均 **0×429**；单 POST ~440ms。慢的唯一原因是串行。同级无依赖对象**必须** `batchCreateParallel(concurrency=10)` 并发，无需 sleep。串行 138 工作项 ~1分多，层内并发 ~15-20s。
27. **PingCode 无批量创建端点**: API/UI 都逐条。提速只能靠**并发重叠逐条 POST**（按层同步、层内全并发），不存在 bulk-create。
28. **`batchCreateParallel` 结果保序**: results 与输入一一对齐（失败位 null），按 `defs[i] → results[i]` 接父子层级；createFn 第二参为 index。

### 工作项层级/阶段关系（2026-06-25 daocloud-test 实测，**因环境而异，必自检**）
29. **「什么挂什么」因环境而异**：Phase 4 前跑关系自检矩阵（建1阶段+各类型单条试探→读→删），按真实结果建，勿照搬上一环境。睿恩 `需求✗task`、daocloud-test `需求✓task`，同一规则两环境相反。
30. **需求不挂阶段**: `需求 parent_id=阶段` → `100319`。顶层需求用 `phase_id` 关联阶段，不用 parent_id。
31. **子需求挂需求 ✓**: `需求` 嵌 `需求`（parent_id），这是「多级需求」骨架的实现。
32. **任务挂需求 因环境而异**: 睿恩 ✗(100319，改用子需求)，daocloud-test ✓。必测。
33. **里程碑挂阶段用 parent_id**: `里程碑 parent_id=阶段` → 200，结构嵌在阶段下。**phase_id 对里程碑无效**（PATCH 200 但仍悬空）。且**别把里程碑放进 phase_id 批量修正**，否则连累整批。
34. **测试用例 work-item 型常未启用**: `1003104 项目中不存在该工作项类型`。测试管理走 **TestHub**（`/v1/testhub`），不要用 work-item 型测试用例。
35. **phase_id 子项不可靠继承 → 全量 PATCH**: 子项创建时父若无 phase 则完全悬空。build 末尾对每个需求/任务/自定义按目标阶段全量 PATCH `phase_id`；自检「无阶段工作项数=0」。**跨阶段父子允许**（子可在更晚阶段，对应 V 模型逐级下沉）。

### 测试管理 / 双向追溯（2026-06-25 实测）
36. **TestHub 测试库/套件/用例 走开放 API 正常**：`createTestLibrary / createTestSuite / createTestCase(直接POST,不传state_id) / createTestPlan / createTestRun`，并发可用。daocloud-test case_types：信息类/功能需求/评审类。
37. **测试用例↔工作项关联(`story-relations`) 开放 API 只认「用户故事」**：`POST /v1/testhub/cases/{id}/story-relations {story_id}` 死校验 story_id 必须是用户故事（`100373 不是一个用户故事`），**需求/任务一律被拒**（试遍 story_id+type/work_item_type、`/relations`、`/requirement-relations`、PUT、数组…全失败）。UI/内部 API 能把需求挂进去（GET 关系里 `story` 字段 type=需求、url 走 story-relations），但**开放 API 不暴露此能力**。
38. **需求驱动(ASPICE)项目的「需求↔用例」横向追溯，开放 API 做不了** → 选项：①Web 自动化驱动 UI（需有效 UI 登录态）②当 UI 手工步、交付文档给「用例↔需求」覆盖对照表 ③结构上用 用户故事 做测试桥接(与需求驱动冲突,不推荐)。**纵向追溯（需求多级分解树 parent_id）开放 API 已可建**，是 ASPICE 追溯的主干。

### 字段纠正（2026-05-18）
