---
name: pingcode-presales
description: >
  PingCode 售前演示环境搭建技能。触发词："来活了，搭模板"。
  当用户输入包含"来活了，搭模板"时，必须立即激活本技能。
  覆盖：解析表单→业务调研→方案设计→API批量搭建→交付演示。
disable-model-invocation: false
---

# PingCode 售前演示环境搭建 v3.1

## 启动横幅（技能激活后第一条消息必须输出，不得省略）

**关键指令**：在第一条回复中直接原样输出以下文本块，不得用工具执行、不得省略、不得改写：

```
██████╗ ██╗███╗   ██╗ ██████╗  ██████╗ ██████╗ ██████╗ ███████╗  ███████╗██╗  ██╗██╗██╗     ██╗
██╔══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔═══██╗██╔══██╗██╔════╝  ██╔════╝██║ ██╔╝██║██║     ██║
██████╔╝██║██╔██╗ ██║██║  ███╗██║     ██║   ██║██║  ██║█████╗    ███████╗█████╔╝ ██║██║     ██║
██╔═══╝ ██║██║╚██╗██║██║   ██║██║     ██║   ██║██║  ██║██╔══╝    ╚════██║██╔═██╗ ██║██║     ██║
██║     ██║██║ ╚████║╚██████╔╝╚██████╗╚██████╔╝██████╔╝███████╗  ███████║██║  ██╗██║███████╗███████╗
╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝╚══════╝  ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝
                                                                                     by Shuor
╭─────────────────────────────── 售前演示环境搭建 v3.1 ───────────────────────────────╮
│  🎯 流程   画像 → 调研 → 设计 → 搭建 → 质检 → 交付                                  │
│  📦 模块   项目管理 · 产品管理 · Wiki · 测试管理 · Ship                              │
│  🔧 通道   API 批量创建 + Web 独占操作（Puppeteer）                                  │
│  📋 触发   来活了，搭模板 [附表单] / 无表单→自动打开填写                             │
╰──────────────────────────────────────────────────────────────────────────────────────╯
```

横幅输出后，立即解析表单数据或打开表单，进入 Phase 1。

## 核心原则

1. **内容贴合客户业务** — 绝不使用"示例项目""测试数据"等通用名称
2. **先确认后执行** — Phase 3 方案必须经用户确认，再进入 Phase 4
3. **推荐 hybrid 项目** — 客户不确定类型时一律推混合项目（可关功能，不可反向）
4. **API 间隔 ≥200ms** — 使用已验证的字段名，详见 `references/api.md`；同级无依赖工作项用 `batchCreateParallel`（concurrency=5）并发创建
5. **每个事项必须完整** — 描述、子步骤、时间、层级，四者缺一不可
6. **Phase 5 强制自动质检** — Phase 4 完成后必须自动触发质检，未达标项自动修复，不通过不得交付

## 进度显示（每个阶段开始时必须执行，始终置顶）

**每进入一个新阶段，第一件事就是输出进度条**。进度条贯穿全流程，使用填充块 + 百分比，始终置顶在阶段输出上方。

### 主进度条（Phase 1~6）

```
╔══════════════════════════════════════════════════════════════╗
║  🚀 搭建进度  [████████████████░░░░░░░░░░░░░░░░]  50% (3/6)  ║
║  ✅ 画像  ✅ 调研  ⏳ 设计  ⬜ 搭建  ⬜ 质检  ⬜ 交付          ║
╚══════════════════════════════════════════════════════════════╝
```

**填充规则**：`█` = 已完成阶段，`░` = 未完成阶段。每完成 1/6 填充约 5 个方块。
- Phase 1: `███░░░░░░░░░░░░░░░░░░░░░░░░░░░░` 17% (1/6)
- Phase 2: `████████░░░░░░░░░░░░░░░░░░░░░░░░` 33% (2/6)
- Phase 3: `████████████████░░░░░░░░░░░░░░░░` 50% (3/6)
- Phase 4: `███████████████████████░░░░░░░░░` 67% (4/6)
- Phase 5: `███████████████████████████████░` 83% (5/6)
- Phase 6: `████████████████████████████████` 100% (6/6)

图标规则：`✅` 已完成 | `⏳` 进行中 | `⬜` 待开始

### Phase 4 子进度条

Phase 4 内部，每完成一个模块后输出子进度条替代主进度条：

```
║  📦 搭建子进度  [████████░░░░░░░░]  ✅项目 ✅工作项 ⏳Wiki ⬜Ship ⬜TestHub  ║
```

填充规则同上，每完成 1/5 约 5 格。子进度条仅 Phase 4 内部使用，Phase 4 结束后恢复主进度条。

### 输出示例（Phase 3 开头）

```
╔══════════════════════════════════════════════════════════════╗
║  🚀 搭建进度  [████████████████░░░░░░░░░░░░░░░░]  50% (3/6)  ║
║  ✅ 画像  ✅ 调研  ⏳ 设计  ⬜ 搭建  ⬜ 质检  ⬜ 交付          ║
╚══════════════════════════════════════════════════════════════╝

📌 Phase 3/6 — 方案设计
...
```

## 快速入口：表单模式

触发词 `来活了，搭模板` 附带结构化信息时，直接解析并进入 Phase 2：

```
来活了，搭模板

公司: {名称}
行业: {行业}
产品线:        ← 每行 "  - 产品名"
  - {产品1}
  - {产品2}
团队规模: {10-50/50-200/200-500/500+}
研发模式: {Scrum/Kanban/瀑布/混合}
搭建模块: {项目管理、产品管理、知识库、测试管理...}
特殊要求: {如"重点搭建30条用例、需瀑布+Scrum混合"}
环境地址: {https://xxx.pingcode.com}
client_id={id}
client_secret={secret}

=== 会议录音文字 ===
{粘贴初次方案交流的会议录音转写，可选}
=== 结束 ===
```

无结构化信息时，**立即用 Bash 打开表单**，同时告知用户填完后粘贴回来：

```bash
# Windows
start "" "~/.claude/skills/pingcode-presales/templates/form.html"
# Mac
open ~/.claude/skills/pingcode-presales/templates/form.html
```

打开后说："表单已在浏览器打开，填完点「复制」，把内容粘贴到这里就开始搭。"

---

## Phase 1: Discover（客户画像）

> **进度横幅**：
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [███░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  17% (1/6)  ║
> ║  ⏳ 画像  ⬜ 调研  ⬜ 设计  ⬜ 搭建  ⬜ 质检  ⬜ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 1/6 — 客户画像

无表单数据时，使用 AskUserQuestion 收集：

**必填**: 公司名、行业、产品线(2-5个)、团队规模
**选填**: 研发模式偏好、搭建模块、PingCode 环境 + API 凭证

→ `{公司名}_profile.md`

## Phase 2: Research（业务调研）

> **进度横幅**：
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [████████░░░░░░░░░░░░░░░░░░░░░░░░]  33% (2/6)  ║
> ║  ✅ 画像  ⏳ 调研  ⬜ 设计  ⬜ 搭建  ⬜ 质检  ⬜ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 2/6 — 业务调研

**有录音**: 优先提取客户痛点、技术栈、产品架构、功能需求。WebSearch 仅补充。
**无录音**: 并行 WebSearch ≥3 方向 — "{公司名} 产品 行业" / "{行业} 研发管理 最佳实践" / "{公司名} 招聘 技术栈"

**输出 1**: 核心技术栈、产品架构、行业标准/合规、主要客户。追加到画像文件。

**输出 2（必须）**: 生成 `{公司名}_vocab.json` 业务词典，Phase 3/4 所有命名从此词典取词：

```json
{
  "产品线": ["产品名1", "产品名2"],
  "团队角色": ["职位/角色名"],
  "行业术语": ["领域关键词", "技术术语", "标准规范名"],
  "痛点标签": ["客户痛点描述"],
  "客户名称": "{公司名}",
  "项目前缀": "{公司名缩写}"
}
```

**命名强制规则**：Phase 3/4 中所有工作项 title、Wiki 空间名、测试库名，必须包含词典中至少一个词。禁止出现"示例/通用/测试"等与词典无关的自造业务词。

### 信息充分度判断（必须执行，再进入 Phase 3）

调研完成后，对照以下问题自评：

| 问题 | 能回答 | 不确定 | 不知道 |
|------|:------:|:------:|:------:|
| 客户的核心产品是做什么的？ | | | |
| 他们的研发团队分哪几个角色？ | | | |
| 他们现在最大的研发管理痛点是什么？ | | | |
| 他们用什么技术栈/行业标准？ | | | |
| 他们的产品有哪些具体功能模块？ | | | |

**判断规则**：
- "不知道" ≥ 2 项 → **停止，主动向用户要补充材料**，说明缺哪些信息、建议提供什么（内部文档、上次演示反馈、产品介绍 PPT）
- "不确定" ≥ 3 项 → **在 Phase 3 蓝图中标注哪些内容是推测的**，让用户确认前知情
- 其余情况 → 正常进入 Phase 3

> 带着薄弱素材硬搭，输出只是"看起来有结构的通用模板"。主动暂停比搭完再返工代价小得多。

## Phase 3: Design（方案设计）

> **进度横幅**：
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [████████████████░░░░░░░░░░░░░░░░]  50% (3/6)  ║
> ║  ✅ 画像  ✅ 调研  ⏳ 设计  ⬜ 搭建  ⬜ 质检  ⬜ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 3/6 — 方案设计

### 3.1 项目规划

| 类型 | 适用 | 关键元素 |
|------|------|---------|
| hybrid | **默认推荐** | 阶段→Epic→Feature→Story→Task/Bug + Sprint + 甘特图 |
| waterfall | 硬件/合规 | 阶段 + 里程碑 + 甘特图基线(关键路径) |
| scrum | 纯软件/AI | Sprint + 燃尽图 + 故事点 |
| kanban | 运维/持续交付 | 泳道 + WIP + 看板自动化 |

每个项目 5-6 分组，每组 4-7 工作项。

**混合/瀑布项目需规划「阶段」**，默认参考 PMP 五大过程组，但根据客户实际灵活调整：

| 场景 | 阶段划分建议 |
|------|-------------|
| 完整研发流程（默认） | 启动 → 需求 → 设计 → 开发 → 测试 → 交付 |
| 简化流程 | 需求 → 任务（省去中间阶段） |
| 客户指定 | 读取 `特殊要求` 字段，按客户要求定制 |

> 具体用哪种，在 Phase 3 设计时根据客户规模和产品复杂度判断，或由 `特殊要求` 字段指定。

**混合/瀑布项目的工作项必须创建交付目标**：
- API: `POST /v1/project/deliverables`，字段: `name` + `project_id` + `work_item_id`
- 每个 Story 和 Task 必须关联一个交付物（独立对象，非 description 文本）
- 格式: 具体的、可验证的产出物（如"《系统需求规格书》v1.0——通过评审签字"）

### 3.2 工作项结构铁律（实战验证，必须遵守）

**（一）必须带描述和子步骤** — 不允许空壳：
- 标题: **不加编号前缀**，直接描述内容（如"国网华东——TIEE3000通信协议适配"，不用"TK-001 xxx"）
- 工作项: `description` ≥3 行（场景+技术要求+影响/建议）
- 测试用例: `precondition` + `steps[{description, expected_value}]` ≥3 步
- 产品需求: `description` ≥3 行（业务价值+技术方案+验收标准）
- 工单: `description` ≥3 行（客户信息+问题描述+期望解决方式）

**（二）必须有父子层级** — 双轨制，不允许平铺：
- **产品管理线**: 阶段 → 需求(含parent_id) → Task(含parent_id)
- **研发开发线**: 阶段(plan) → 史诗(顶层,plan关联) → Feature(含parent_id) → Story(含parent_id) → Task/Bug(含parent_id)
- 里程碑挂阶段下(含parent_id)
- Bug 必须挂 Story 下，不允许跳级
- 创建顺序: 阶段 → 里程碑(含parent) / 需求(含parent) / 史诗(plan=阶段) → Feature→Story→Task/Bug

**（三）必须有时间 + 预估工时** — 根据标题和描述智能推断：
- 时间: `Math.floor(new Date(年, 月-1, 日).getTime()/1000)`（只到天）
- 工时: `estimated_workload`（单位：小时），`remaining_workload` 初始与预估相同
- **必须理解标题语义**，根据工作量和复杂度推断合理的时间和工时，而非机械分配：

| 工作项类型 | 参考工时 | 参考周期 |
|-----------|---------|---------|
| Epic（月/季度级大需求） | 200-400h | 8-12 周 |
| Feature（周/月级功能） | 80-200h | 4-8 周 |
| Story（周级用户故事） | 20-80h | 1-4 周 |
| Task（天级任务，如"文档编写""环境搭建"） | 4-24h | 3天-2周 |
| Task（周级任务，如"算法开发""驱动移植"） | 24-80h | 2-4 周 |
| Bug（缺陷修复） | 2-16h | 1天-1周 |

- 推断逻辑: 从标题关键词判断复杂度（"开发/实现/移植" > "优化/改进" > "文档/配置"），从描述中提取具体量化目标校准工时
- 示例: "行波采集板卡FPGA固件开发" → 80h, 3周 / "EMC浪涌防护电路设计" → 40h, 2周 / "系统需求规格书编写" → 16h, 1周

**（四）必须跨模块关联** — 创建完成后建立链接：
- 工单 → 产品需求 / 产品需求 → 工作项 / 测试用例 → 工作项

**（五）内容贴合业务** — 含客户真实产品、场景、行业标准

### 3.3 Wiki 设计
3-5 个空间，按产品线或部门维度。每空间 3-5 页 Markdown。

### 3.4 测试库设计
2-3 个库，每库 2-3 套件，每套件 3-5 用例。含前置条件+步骤+预期+优先级。
生成 1 个测试计划 + 执行记录（pass/fail/blocked 混合）。

### 3.5 高级功能配置

#### 历史数据模拟
- 按比例分配工作项时间线: 完成(~35%) / 进行中(~15%) / 待开始(~50%)
- 自动生成 2 个历史 Sprint，已完成工作项关联对应 Sprint
- Bug 按收敛曲线分布: 早期集中发现 → 后期逐步修复
- 引擎: `pingcode_historical.js`

#### 工时登记（随机模拟）
- **范围**: 只登可执行层级 story/task/bug（阶段/里程碑/需求/史诗/特性不登）；start_at 晚于今天的跳过
- **量**: 单项总量 ≈ `estimated_workload × 随机(0.3~1.0)`；拆 1~3 条（受 总量/6 约束），单条 ≤8h、≥1h
- **日期**: 在 `[start, min(end, 今天)]` 均匀铺开 → 对齐北京当日0点 → 不晚于今天
- **登记人**: `report_by_id` = 该工作项负责人(assignee)，兜底随机用户池（谁干的活谁登工时，企业鉴权必填）
- **类型**: 按标题关键词映射 设计/测试/研发 → `workload_type` id
- 引擎: `pingcode_workload.js`（`--identifiers=A,B` 限定项目，`--dry` 预览）

#### 自定义字段
- Web 通道创建，每项目 4 个字段 (单选/多选/单行/多行)
- 根据行业自动匹配模板: 汽车电子/半导体/电力/物联网/通用
- 字段名和选项贴合客户业务场景

#### 标签
- 从行业+产品线推断业务术语词典
- 每项目 8-12 个标签，按工作项类型分配
- 生成器: `pingcode_tags.js`

### 3.6 确认
输出 `{公司名}_blueprint.md`，**必须** AskUserQuestion 确认后进入 Phase 3.7。

### 3.7 自定义工作项类型（Web，Phase 4 前强制执行）

> **Phase 4 前必须完成**：每轮搭建必须检查应建类型是否已存在，未建必须先建。不通过不进入 Phase 4。

**目的**：在管理后台为客户创建行业专属工作项类型并配置自定义字段，使 Phase 4 中可用这些类型的 `type_id` 创建工作项。

#### 类型分层策略

| Tier | 创建条件 | 类型 |
|------|---------|------|
| 1 通用 | 所有客户 | 工程变更申请 · 技术评审 |
| 2 硬件行业 | 行业含：汽车/半导体/电力/工业/机器人/硬件/嵌入式 | 风险项 · 合规检查项 |
| 3 敏捷软件 | 研发模式含：Scrum/敏捷/Kanban | 技术债务 · 研究任务 |

#### 各类型字段速查

| 类型 | 字段 | 类型 | 选项值 |
|------|------|------|------|
| 工程变更申请 | 变更类型 | 单选 | 设计变更·工艺变更·材料变更·软件变更 |
| | 变更原因 | 多行文本 | — |
| | 影响分析 | 多行文本 | — |
| | 目标版本 | 单行文本 | — |
| 技术评审 | 评审类型 | 单选 | 方案评审·代码评审·设计评审·验收评审 |
| | 评审结论 | 单选 | 通过·有条件通过·不通过 |
| | 问题清单 | 多行文本 | — |
| | 评审日期 | 日期 | — |
| 风险项 | 风险等级 | 单选 | 高·中·低 |
| | 风险类型 | 单选 | 技术风险·进度风险·资源风险·合规风险 |
| | 触发条件 | 多行文本 | — |
| | 应对措施 | 多行文本 | — |
| | 残余风险 | 单选 | 可接受·需监控·不可接受 |
| 合规检查项 | 适用标准 | 单行文本 | — |
| | 检查结论 | 单选 | 符合·轻微不符合·严重不符合 |
| | 不符合描述 | 多行文本 | — |
| | 整改期限 | 日期 | — |
| | 整改负责人 | 成员 | — |
| 技术债务 | 债务类型 | 单选 | 代码·架构·测试·文档 |
| | 偿还成本 | 单选 | S(半天内)·M(1-3天)·L(1周)·XL(1周以上) |
| | 影响范围 | 多行文本 | — |
| 研究任务 | 研究目标 | 多行文本 | — |
| | 时间盒 | 单选 | 0.5天·1天·2天·3天 |
| | 研究结论 | 多行文本 | — |

#### 完整操作路径（三步，强制执行）

**路径①：创建类型** — `/admin/product/pjm/configuration/work-item`

```
1. 点击「新建」按钮
2. 表单填写：
   - 名称*：输入类型名（如"工程变更申请"），≤32字符
   - 图标*：随机选一个图标（共30个，任选即可）
   - 分组*：点击下拉 → 键盘输入分组名 → Enter
     分组规则：需求类→"需求"，任务类→"任务"，事务类→"事务"
3. 点击「确定」
```

**路径②：加入混合项目流程** — `/admin/product/pjm/configuration/templates`

```
1. 点击「混合项目流程」行进入详情
2. 点击「添加」按钮 → 弹出"添加类型"弹窗
3. 下拉选择类型名 → 确定
4. 重复第2-3步，将所有新类型加入流程
```

**路径③：配置类型字段** — 混合项目流程详情页

```
1. 检查类型是否已在流程中（搜索框搜类型名），不在则先执行路径②
2. 点击目标类型的「配置」→ 展开子项（工作流/属性与视图/提醒/通知/权限）
3. 点击「属性与视图」行的「配置」→ 弹出属性与视图弹窗（CDK 第1层）
4. 点击弹窗中「添加」→ 弹出"添加属性"弹窗（CDK 第2层）
5. 点击「创建新属性」→ 弹出"新建属性"弹窗（CDK 第3层）
6. 填写：
   - 名称*：输入字段名，≤32字符
   - 类型*：点击选择（单行/多行/单选/多选/日期等13种）
     ⚠️ 单选 vs 级联单选：文字都含"单选"，必须用 exact match！
        正确：page.getByText('单选', { exact: true })
        错误：page.locator('text=单选') → 同时命中两个
   - 单选类型：选完后点「下一步」（非「确定」），进入数据项页
   - 数据项*（仅单选/多选）：点击「添加数据项」→ 弹出输入框 → 填值 → Enter
     逐个添加，每输完一个按 Enter 确认
7. 点击「确定」保存字段 → 回到第2层"添加属性"弹窗
8. 重复第4-7步，为当前类型添加所有字段
9. 全部字段加完后，逐层关闭弹窗（取消/×）
```

#### Playwright CDK 弹窗操作铁律（必读）

> **核心原则：禁止使用 ref！** PingCode Angular CDK 每次弹窗/切换都会重新生成 ref 编号，快照拿到的 `[ref=e681]` 点下去时大概率已失效。

| 不稳定 ❌ | 稳定 ✅ |
|-----------|--------|
| `click [ref=e761]` | `page.locator('button:has-text("确定")').last().click()` |
| `type [ref=e681]` | `page.locator('input[placeholder="输入名称"]').last().fill('xxx')` |
| `click [ref=e1376]` | `page.getByText('单选', { exact: true }).click()` |
| `click [ref=e344]` | `page.getByRole('row', { name: '混合项目流程' }).click()` |

**其他铁律**：
- **少拍全量快照**：能用 `run_code_unsafe` + 条件判断确认状态就不拍 50KB YAML。只在需要定位新元素时 snapshot
- **下拉菜单**：CDK overlay 不在原 DOM 位置。先 click 触发 → 等 overlay 出现 → 在 overlay 中 text-click 选项
- **类型存在性验证**：创建前先搜索确认类型是否已存在，不盲信"已创建"的说法
- **属性数量验证**：创建完成后检查属性数是否增加（新建类型从 ~7 起步），确认字段生效

#### 13种属性类型速查

| 类型 | 数据项 | 典型场景 | 选择器注意 |
|------|:--:|------|------|
| 单行文本 | ✗ | 目标版本、适用标准 | — |
| 多行文本 | ✗ | 变更原因、影响分析、问题清单 | — |
| **单选** | ✓ | 评审类型、评审结论、风险等级 | ⚠️ 必须 exact match，防误触级联单选 |
| 多选 | ✓ | 适用部门、影响模块 | ⚠️ 同理防级联多选 |
| 数字 | ✗ | 工时预估、优先级分值 | — |
| **日期** | ✗ | 评审日期、整改期限 | — |
| 成员 | ✗ | 整改负责人、审批人 | — |
| 级联单选 | ✓ | 产品→模块→功能 | 非特殊情况不用 |
| 级联多选 | ✓ | 多级分类 | 非特殊情况不用 |
| 进度 | ✗ | 完成百分比 | — |
| 评分 | ✗ | 满意度评分 | — |
| 链接 | ✗ | 参考文档URL | — |
| 引用 | ✗ | 关联工作项 | — |

#### 单选类型：两步流程（易错点）

```
Step 1: 填名 + 选"单选" + 可选配置 → 点「下一步」（不是「确定」！）
Step 2: 数据项页 → 点击「添加数据项」→ 弹出输入框 → 填值 → Enter
        → 重复添加直到全部选项输入完毕 → 点「确定」
```

#### 自动化执行

**首选**：调用 `web.createWorkItemTypesForClient(page, envUrl, { industry, devMode })` 自动走完路径①②③。

**备选**：若 puppeteer 不可用，用 Playwright 按路径①②③手动回放，类型定义从 `WORK_ITEM_TYPE_CONFIGS` 常量读取。

**注意**：
- **禁止用 ref**：一律用 text/role/placeholder 选择器，参见上方铁律表
- **单选 exact match**：`getByText('单选', { exact: true })`，踩过坑
- **单选有「下一步」**：不是直接出数据项，要先点下一步
- 弹窗三层叠加：属性与视图 → 添加属性 → 新建属性，每层单独操作
- 创建完成后记录返回的 `type_id`，Phase 4 中可用这些类型创建工作项
- 类型创建完后必须在混合项目流程中添加，否则项目中使用不到
- **属性数验证**：新建类型默认 ~7 属性，加完自定义字段后应有明显增长（如 7→11 加 4 字段）

### 3.8 Pre-flight（强制：每次 Phase 4 前必须执行）

**目的**：环境间 ID 差异巨大（case_types、ticket_priorities、ticket_types、states），禁止硬编码。每次搭建前拉一遍动态 ID。

**必须执行的探测**:
```
GET /v1/project/work_item_types  → 取 phase type_id (名称="阶段")
GET /v1/testhub/case_types        → 取 case type_id 列表
GET /v1/ship/ticket_types         → 取 ticket type_id 列表
GET /v1/ship/ticket_priorities    → 取 ticket priority_id 列表
GET /v1/directory/users           → 取用户池 (assignee/participant)
```

**必须验证的字段（创建前用单条测试验证）**:
```
测试用例: 用探测到的 type_id 发一条 → 确认 200 → DELETE
工单:     用探测到的 type_id + priority_id 发一条 → 确认 200
需求:     用 product_id 发一条 → 确认 200
```

**禁止行为**:
- 禁止用 `references/api.md` 里的 system ID 常量直接建 case/ticket/idea
- 禁止假设 work_item priority_id 可以用于 ticket priority_id
- 禁止假设上一个项目的 ID 在本项目可用
- 每轮新搭建必须重新探测，不可复用上一轮的探测结果

> **Why**: 连续 3 个项目都在测试用例/工单/需求创建阶段因 ID 不匹配反复失败，浪费大量时间。Pre-flight 一步到位解决。

### 3.9 Pre-flight 探测脚本模板（直接复制使用）

**用法**：`node pre-flight.js --client_id={表单 client_id} --client_secret={表单 client_secret}`

```javascript
// pre-flight.js — 每次 Phase 4 前运行，动态拉取所有环境 ID
// 凭证直接来自表单解析的 client_id / client_secret，无需手填 token

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.slice(2).split('='))
);

async function pf() {
  const authRes = await fetch(
    `https://open.pingcode.com/v1/auth/token?client_id=${args.client_id}&client_secret=${args.client_secret}`
  );
  const { access_token: TOKEN } = await authRes.json();
  if (!TOKEN) throw new Error('Token 获取失败，请检查 client_id / client_secret');

  const get = async (path) => {
    const r = await fetch('https://open.pingcode.com' + path, {
      headers: {'Authorization': 'Bearer ' + TOKEN}
    });
    return r.json();
  };

  // 1. 获取阶段 type_id
  const wits = await get('/v1/project/work_item_types');
  const phaseType = wits.find(w => w.name === '阶段');
  console.log('PHASE_TYPE:', phaseType?.id || 'NOT FOUND');

  // 2. 获取用例类型
  const caseTypes = await get('/v1/testhub/case_types');
  caseTypes.forEach(c => console.log('CASE_TYPE:', c.id, c.name));

  // 3. 获取工单类型
  const ticketTypes = await get('/v1/ship/ticket_types');
  ticketTypes.forEach(t => console.log('TICKET_TYPE:', t.id, t.name));

  // 4. 获取工单优先级
  const ticketPris = await get('/v1/ship/ticket_priorities');
  ticketPris.forEach(p => console.log('TICKET_PRIORITY:', p.id, p.name));

  // 5. 获取用户池
  const users = await get('/v1/directory/users');
  users.forEach(u => console.log('USER:', u.id, u.name, u.email));

  console.log('\n=== 复制以上输出，用于 build script ===');
}
pf().catch(e => console.error(e));
```

**输出用途**：将探测到的 ID 填入 build script 的常量区，避免硬编码。每次新搭建必须重新运行。

## Phase 4: Build（批量创建）

> **进度横幅**：
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [███████████████████████░░░░░░░░░]  67% (4/6)  ║
> ║  ✅ 画像  ✅ 调研  ✅ 设计  ⏳ 搭建  ⬜ 质检  ⬜ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 4/6 — 批量创建
> **子进度初始**：⏳ 项目 → ⬜ 工作项 → ⬜ Wiki → ⬜ Ship → ⬜ TestHub

### 4.0 Build Manifest（幂等性保障）

**Phase 4 开始前必须创建** `{公司名}_build_manifest.json`，记录所有计划对象及创建状态：

```json
{
  "client": "{公司名}",
  "items": [
    { "type": "project",   "name": "{项目名}", "id": null, "status": "PENDING" },
    { "type": "work_item", "name": "{工作项名}", "id": null, "status": "PENDING" },
    { "type": "wiki_page", "name": "{页面名}", "id": null, "status": "PENDING" }
  ]
}
```

**状态规则**：
- 每创建成功一个对象 → 立即将 `status` 更新为 `DONE`，记录返回的 `id`
- 创建失败 → 标记为 `FAILED`，记录错误信息
- **重新执行时**：跳过所有 `DONE` 的对象，只重试 `FAILED` 和 `PENDING`

> 这让每次搭建变成可恢复的事务。中途失败不再需要从头来，也不会产生重复数据。

---

按顺序执行: `Pre-flight探测 → 认证 → 项目 → 获取用户列表 → 创建阶段(PMP) → 里程碑(挂阶段) → 需求(产品线,挂阶段) → 史诗(phase_id关联阶段) → Feature→Story→Task/Bug(含随机负责人+关注人+描述+phase_id) → Sprint(含历史) → 工时登记(模拟,登记人=assignee) → 自定义字段(Web) → 标签 → Wiki → Ship产品空间 → 工单(需 product_id+type_id+priority_id) → 需求(需 product_id) → 测试库 → 套件 → 用例(用探测到的 type_id) → 计划 → 执行记录`

**构建顺序铁律**: 项目/工作项 → Wiki → Ship(产品+工单+需求) → TestHub。后三步依赖前一步的 ID，禁止跨模块并行。

**同级并发加速（推荐）**：在同一模块内，同一层级的无依赖对象用 `batchCreateParallel` 并发：
```javascript
// 同一 Phase 下的多个 Epic（互不依赖）→ 并发创建
const epics = await api.batchCreateParallel(epicDefs, def => api.createWorkItem(token, def, baseUrl));
// 所有项目下的 Wiki Space（互不依赖）→ 并发创建
const spaces = await api.batchCreateParallel(spaceDefs, def => api.createWikiSpace(token, def, baseUrl));
```
需要返回 ID 才能创建下级的对象（如 Feature 依赖 Epic ID），必须等上一级并发完成再串行下一级。

### 4.1 各对象必填字段速查矩阵

**所有对象创建前必须对照此表检查字段，禁止凭记忆**：

| 对象 | API 端点 | 必填字段 | 可选/建议字段 |
|------|---------|---------|-------------|
| 项目 | `POST /v1/project/projects` | name, type, identifier | description, member_ids, start_at, end_at, state:"normal" |
| 工作项(通用) | `POST /v1/project/work_items` | project_id, type_id, title | description ≥3行, parent_id, phase_id, start_at, end_at, assignee_id, participant_ids, estimated_workload, remaining_workload |
| 交付物 | `POST /v1/project/deliverables` | name, project_id, work_item_id | — |
| Wiki 空间 | `POST /v1/wiki/spaces` | name, identifier, scope_type:"organization" | visibility, description |
| Wiki 页面 | `POST /v1/wiki/pages` | space_id, name, content, format_type:"markdown" | parent_id, type:"document" |
| Ship 产品 | `POST /v1/ship/products` | name, identifier, scope_type:"organization" | visibility, description |
| Ship 工单 | `POST /v1/ship/tickets` | title, product_id, type_id, priority_id | description ≥3行 |
| Ship 需求 | `POST /v1/ship/ideas` | title, product_id | description ≥3行 |
| 测试库 | `POST /v1/testhub/libraries` | name, identifier | description |
| 测试套件 | `POST /v1/testhub/libraries/{id}/suites` | name | description |
| 测试用例 | `POST /v1/testhub/cases` | test_library_id, suite_id, title, type_id | precondition, steps[{description,expected_value}] ≥3步, important_level_id |
| 测试计划 | `POST /v1/testhub/libraries/{id}/plans` | name, assignee_id, start_at, end_at | description |
| 测试执行 | `POST /v1/testhub/runs` | plan_id, case_id, library_id, status | assignee_id, steps[{step_id,status,actual_value}] |

> **关键区分**：
> - `test_library_id`（用例库）≠ `library_id`（无此字段）
> - `phase_id`（阶段关联，所有工作项通用）≠ `plan_id`（文档用词，API 无效）
> - `identifier`：项目用短大写如 `GVRVERIFY`；测试库用大写开头如 `GX100TEST`
> - Ship 工单用 ticket_priorities 的 ID（`5cb946...`），不用 work_item 的 priority ID（`67f32d...`）

**必须遵守的规则**：
1. 认证是 `GET /v1/auth/token?...`（不是 POST）
2. 工作项按双轨层级创建:
   - 产品线: 阶段 → 需求(含parent_id=阶段) → 任务
   - 研发线: 阶段 → 史诗(顶层,plan关联) → 特性(含parent_id) → 用户故事(含parent_id) → 任务/缺陷(含parent_id)
3. **每个 Hybrid/瀑布项目必须先创建 PMP 阶段**（type_id=阶段，从 `GET /v1/project/work_item_types` 获取）。参考 PMP 五大过程组或客户业务灵活调整。每阶段下挂里程碑。史诗通过「所属计划」关联阶段（非 parent_id）。需求可挂阶段下作为子工作项。
4. **所有工作项必须随机分配负责人**：Phase 4 开始时 `GET /v1/directory/users` 获取用户列表 → 每个工作项创建时随机选 assignee_id → 随机添加 1-3 个 participant_ids。
5. **每个 Story 下至少挂 1 个 Task 或 Bug**，严禁 Story 无子工作项。Bug 必须挂 Story 下，不能跨级挂 Feature。
6. 时间用 `new Date(年, 月-1, 日)` 计算 Unix 秒，根据标题语义智能推断合理周期（非机械分配）
7. 每个工作项必须带 `description` ≥3 行 + `estimated_workload`（小时）+ `remaining_workload`（初始同预估）
8. 工作项 `type_id` 字符串: `"task"/"story"/"bug"/"epic"/"feature"`；阶段 type_id 通过 API 动态获取
9. 测试用例用 `test_library_id`（不是 `library_id`）
10. 测试计划 `assignee_id` + `start_at` 必填
11. Wiki 页面 `content` 和 `format_type: "markdown"` 必须同时存在
12. **环境间 ID 不通用**: case_types、ticket_types、states 必须 GET 动态获取，禁止硬编码
13. Sprint/Plan 的 `assignee_id` 必填
14. 混合/瀑布项目工作项必须关联交付目标: `POST /v1/project/deliverables { name, project_id, work_item_id }`
15. **Ship 工单**: 必须同时传 `product_id` + `type_id` + `priority_id`（priority_id 用 ticket_priorities 探测到的值，不是 work_item priority_id）
16. **Ship 需求**: 必须传 `product_id`，不需要 priority_id
17. **测试用例**: type_id 必须用 pre-flight 探测到的 case_type ID（daocloud-test 只有 3 种：信息类/功能需求/评审类）

### 防踩坑速查（实战血泪教训，每次 Phase 4 前必读）

| 坑 | 错误码 | 正确做法 |
|----|--------|---------|
| **Bug 直接挂 Feature** | `100319: 父工作项的类型不正确` | Bug 只能挂 Story 下。层级: Feature→Story→Bug |
| **Story 直接挂 Epic** | `100319` | Story 只能挂 Feature 下。层级: Epic→Feature→Story |
| **阶段(Epic父级)不可用** | `100319` | 阶段是计划级工作项，Epic 不通过 parent_id 挂阶段下，两者并列项目顶层 |
| **state_id 硬编码** | `100303: 'state'资源不存在` | state_id 环境特定，不通用。不确定时不传，默认初始状态即可 |
| **Wiki 缺 scope_type** | `100039: scope_type 是必填字段` | Wiki 创建必须带 `scope_type: "organization"` |
| **Wiki 返回 500** | `100000: 内部服务错误` | 可能标识已存在，检查 identifier 唯一性 |
| **TestHub 标识格式** | `100640: 'library'标识的格式不正确` | 必须大写字母开头，不含 `-` 或纯小写。如 `GX100TEST`，不是 `test-lib-001` |
| **项目标识格式** | `100335: 'project'标识的格式不正确` | 避免下划线+长后缀。用短大写如 `GVRVERIFY`，不是 `GRAVITYXR_VERIFY` |
| **测试用例 type_id 无效** | `100613: 测试用例类型不存在` | case_types 环境间差异大(daocloud-test仅3种)。必须 pre-flight GET |
| **工单 priority_id 无效** | `工单优先级不存在` | ticket priority_id 与 work_item priority_id 完全不同。必须 pre-flight GET `/v1/ship/ticket_priorities` |
| **工单缺 type_id** | `type_id 是必填字段` | Ship 工单必须同时传 product_id+type_id+priority_id |
| **需求缺 product_id** | `product_id 是必填字段` | Ship 需求必须传 product_id |
| **测试用例 suite 不匹配** | `100629: 测试用例和所属模块不匹配` | suite_id 必须属于当前 test_library_id |

详见 `references/api.md`

### 4.2 内容填充强制步骤

**Wiki 页面和测试用例不能空壳**。工作项创建完毕后，必须单独执行内容填充：

**Wiki 填充**：
- 每个空间 ≥ 2 页 Markdown 内容
- 页面 `content` + `format_type: "markdown"` 必须同时存在
- 内容贴合客户业务场景（技术文档模板、SOP、设计规范等）

**测试用例填充**：
- 每条用例 ≥ 3 步，每步含 `description` + `expected_value`
- 格式：`[{description: "操作xxx", expected_value: "预期xxx"}, ...]`
- 用例创建后关联到测试计划，生成执行记录（pass/fail/blocked 混合）

### 4.3 phase_id 继承问题 & 批量 PATCH 修复

**已知问题**：创建子工作项时即使传入正确的 `phase_id`，PingCode 后端也会用父工作项的 `phase_id` 覆盖。所有子工作项创建后必须 PATCH 修正。

**修复方式：批量 PATCH（一次发，不要逐条）**：

```javascript
// 收集所有需要修正的子工作项 → 批量一次 PATCH
const patchList = childItems.map(item => ({
  id: item.id,
  fields: { phase_id: correctPhaseId }
}));
await api.batchUpdateWorkItems(token, patchList, baseUrl);
```

- `batchUpdateWorkItems` 封装了 `PATCH /v1/project/work_items`，支持传数组批量更新
- 一个项目下所有子工作项的 phase_id 修复，**一次请求搞定**，不再逐条 PATCH
- **触发条件**：所有通过 `parent_id` 创建的工作项（Feature→Story→Task/Bug, Epic→Feature）。顶层 Epic 和直接挂阶段的需求不受影响。

## Phase 5: QA Review（自动质检与修复）

> **进度横幅**：
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [███████████████████████████████░]  83% (5/6)  ║
> ║  ✅ 画像  ✅ 调研  ✅ 设计  ✅ 搭建  ⏳ 质检  ⬜ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 5/6 — 自动质检
> **强制执行**：Phase 4 结束后立即自动触发，无需用户指令。质检未通过前不得进入 Phase 6。

### 5.0 自检脚本（优先执行）

**Phase 4 结束后，第一步必须运行自检脚本**，让机器先做全量客观检查，再由 Claude 处理内容质量问题：

```bash
node scripts/pingcode_check.js \
  --env=xxx.pingcode.com \
  --client_id=xxx \
  --client_secret=xxx

# 发现结构问题时，加 --fix 自动修复：
node scripts/pingcode_check.js --env=... --client_id=... --client_secret=... --fix

# 保存 JSON 报告供 Phase 6 附用：
node scripts/pingcode_check.js --env=... --client_id=... --client_secret=... --report={公司名}_qc.json
```

**脚本覆盖检查范围**：

| 检查类 | 内容 | 可自动修复 |
|--------|------|:--------:|
| A 数量达标 | 阶段数/Feature数/Story子项/描述比例/Wiki页面/测试用例/工单需求 | 部分 |
| B 结构合规 | Bug越级挂载/空Story/孤立工作项 | ✅ |
| C 内容质量 | 通用词/描述行数/Wiki字节数/用例步骤 | ✗（需 Claude 补写） |
| D 业务贴合度 | 随机抽检5条，含行业中文术语 | ✗（需 Claude 判断） |

**结果判定**：
- 脚本退出码 0 → 全部通过，继续 5.1 Claude 质检
- 脚本退出码 1 → 有 `fail` 项，必须先修复（运行 `--fix` 或手动处理）再继续
- 脚本退出码 2 → 脚本本身报错，检查网络/凭证后重试

### 5.1 质检标准矩阵

脚本运行完（或修复完）后，Claude 继续通过 API 查询验证以下内容（脚本无法自动修复的部分）：

**A. 数量达标**

| 模块 | 检查维度 | 最低标准 |
|------|---------|---------|
| 项目工作项 | PMP 阶段数（hybrid/waterfall） | ≥4 |
| | Feature 级工作项数（per 项目） | ≥4 |
| | Story 级工作项数（per Feature） | ≥1 |
| | Task/Bug 数（per Story） | ≥1 |
| | 有 description 工作项比例 | ≥90% |
| | 有 estimated_workload 工作项比例 | ≥90% |
| Wiki | 空间数 | ≥2 |
| | 每空间页面数 | ≥2 |
| TestHub | 测试库数 | ≥2 |
| | 每库套件数 | ≥2 |
| | 每套件用例数（含步骤） | ≥3 |
| Ship | 产品空间数 | ≥1 |
| | 工单数 | ≥3 |
| | 需求数 | ≥3 |

**B. 结构合规**

| 检查项 | 合规标准 | 修复方式 |
|-------|---------|---------|
| Bug 挂载层级 | Bug 只能挂 Story 下，禁止直接挂 Feature | 将越级 Bug 移入对应 Story |
| Story 有子工作项 | 每 Story ≥1 Task 或 Bug | 为空 Story 补建 Task |
| 子工作项 phase_id | 与所属阶段一致 | 批量 PATCH 修正 |
| 父子层级完整 | 不存在孤立的 Story/Task（无 parent_id） | 补建或关联父级工作项 |

**C. 内容质量**

| 检查项 | 通过条件 | 修复方式 |
|-------|---------|---------|
| 工作项名称 | 不含"示例/测试/test/demo/example"等通用词 | 替换为业务化名称 |
| description 内容 | 非空且 ≥3 行（场景+技术要求+影响） | 补写业务化描述 |
| Wiki 页面内容 | content 字节数 ≥500 | 填充行业相关技术文档 |
| 测试用例步骤 | steps ≥3 步，每步含 expected_value | 补写完整测试步骤 |

**D. 业务贴合度抽检**

从所有工作项中随机抽取 5 条，对每条自问：

> "如果客户在演示中看到这条内容，他会认为这是他们公司的真实工作数据吗？"

判断标准：
- ✅ **通过**：名称含客户产品线/行业术语，描述有具体业务场景
- ❌ **不通过**：名称泛化（如"功能开发""需求分析"），或描述像通用模板

**不通过时**：将该工作项的 title 和 description 按业务词典重写，然后重新抽检直到 5/5 通过。

### 5.2 质检与修复循环

```
最多执行 3 轮：
  1. GET 查询各模块实际状态（工作项列表、Wiki 页面、测试用例、工单/需求）
  2. 对照 5.1 矩阵，记录所有不合格项
  3. 按 B（结构）→ A（数量）→ C（内容）→ D（抽检）顺序执行自动修复
  4. 重新 GET 验证修复结果

  ↓ 全部通过 → 生成 QC 报告，进入 Phase 6
  ↓ 3 轮后仍有未修复项 → 在报告中列出残留问题，询问用户是否继续
```

### 5.3 QC 报告格式（追加到交付文档头部）

```markdown
## QC 质检报告

| 质检项 | 实际值 | 标准 | 状态 |
|-------|-------|------|------|
| PMP 阶段数 | {n} | ≥4 | ✅/❌ |
| Story 均有子工作项 | {n}/{total} | 100% | ✅/❌ |
| Bug 挂载合规 | {n}/{total} | 100% | ✅/❌ |
| 工作项有描述比例 | {n}% | ≥90% | ✅/❌ |
| Wiki 页面有内容 | {n}/{total} | 100% | ✅/❌ |
| 测试用例有步骤 | {n}/{total} | 100% | ✅/❌ |
| 工单/需求数量 | {n} | ≥3 | ✅/❌ |
| 业务贴合度抽检 | {n}/5 通过 | 5/5 | ✅/❌ |

**自动修复记录**：
- [修复] {问题描述} → {解决方式}

**质检结论**：通过 {n} 项 / 共 {n} 项，经 {n} 轮自动修复后达标
```

---

## Phase 6: Present（交付摘要）

> **进度横幅**：100% 触发彩蛋 🎉
> ```
> ╔══════════════════════════════════════════════════════════════╗
> ║  🚀 搭建进度  [████████████████████████████████]  100% (6/6) ║
> ║  ✅ 画像  ✅ 调研  ✅ 设计  ✅ 搭建  ✅ 质检  ⏳ 交付          ║
> ╚══════════════════════════════════════════════════════════════╝
> ```
> 📌 Phase 6/6 — 交付摘要
>
> 🎊 **100% 彩蛋**（进度条满时必须输出，动态填入实际数据）：
> ```
>   ✨ ───────────────────── ✨
>      ⏱️  省下 ~{N} 小时 → 够你摸三条鱼
>          🐟   🐟   🐟
>             🎣
>        🤖 {X} 工作项 · {Y} Wiki 页 · {Z} 测试用例
>        ☕  Skill 全自动代劳，你只负责喝咖啡
>   ✨ ───────────────────── ✨
> ```
> 
> **{N} 计算规则**：N = ⌈(工作项数×2 + Wiki页数×5 + 测试用例数×2) / 60⌉，加调研设计 4h 基数，向上取整。
> **示例**：102工作项 + 13Wiki + 20用例 → ≈ 6h 基础 + 4h 调研设计 = **~10h**

生成 `{公司名}_delivery.md`：项目全景 + 层级树 + Wiki 目录 + 测试覆盖 + 演示路径

---

## 参考资源

| 文件 | 内容 |
|------|------|
| `references/api.md` | 40+ 端点、字段陷阱、环境 ID 差异、踩坑教训 |
| `references/demo_guide.md` | 演示路径、客户应答、培训话术 |
| `references/web_ops.md` | Web 独占操作（自定义字段/工作流/仪表盘/自动化/权限） |
| `scripts/pingcode_api.js` | API 封装库（40+ 端点，含随机用户派发） |
| `scripts/pingcode_web.js` | Web 操作封装库（Puppeteer+Edge，登录+截图+配置） |
| `scripts/pingcode_historical.js` | 历史数据模拟引擎（比例分配+收敛曲线+Sprint历史） |
| `scripts/pingcode_workload.js` | 工时随机登记（登记人=assignee，日期对齐北京当日，report_by_id 必填） |
| `scripts/pingcode_tags.js` | 标签生成器（行业术语词典+类型分配） |
| `templates/` | client_profile / blueprint / delivery_summary / form.html 模板 |
| `templates/form.html` | 客户信息收集表单 |

## 双通道操作策略

| 场景 | 用 API | 用 Web |
|------|:------:|:------:|
| 批量创建项目/工作项/Wiki/测试 | ✓ 首选 | — |
| 自定义字段、状态工作流 | ✗ | ✓ 独占 |
| 仪表盘部件配置 | ✗ | ✓ 独占 |
| 自动化规则(FIow) | ✗ | ✓ 独占 |
| 权限细粒度配置 | ✗ | ✓ 独占 |
| 页面截图（交付用） | ✗ | ✓ |
| Web 登录: `pingcode_web.login(page, env, user, pass)` |

## 案例

| 客户 | 行业 | 产出 |
|------|------|------|
| 某汽车科技 | 汽车 ADAS/T-Box/座舱 | 3项目·64+40工作项·5Wiki·3测试库·29用例 |
| 某机器人公司 | 半导体封装装备 | 1测试库·4套件·30用例 |
| 某信息科技 | 电力/冶金/石化 | 1项目·24工作项·20工单·20需求·20用例 |
| 某XR芯片公司 | XR芯片/半导体 | 3项目·10阶段·60+工作项·4Wiki·3测试库·3工单 |
| 某智能硬件公司 | 智能硬件/车载音频 | 2项目·16工作项·12交付物·2Wiki·4页·2产品空间·5工单·5需求·2测试库·4套件·9用例 |
| 某特种机器人公司 | 特种机器人/巡检 | 2项目·14工作项·3Wiki·6页·2测试库·4套件·11用例 |
