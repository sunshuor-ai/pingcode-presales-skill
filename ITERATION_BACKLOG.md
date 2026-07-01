# pingcode-presales 迭代 Backlog

> 收集于 2026-06-30。状态：已记录，未实现。每条动手前走 `brainstorming` 对齐设计，再用 `writing-skills` 改。
> 三维标注：**改哪儿** / **类型** / **要不要先设计**。

---

## #1 自定义类型/字段：建完要「API 自动批量赋值」并归位

- **问题**：Phase 3.7 已能用 UI（本地 Playwright）建自定义工作项类型（工程变更申请/技术评审/风险项…）和字段属性，但 Phase 4 用 API 建工作项时**没给这些自定义字段填值**→ 演示时一堆带自定义字段却全空的工作项，等于白建。且赋值这步既缺失、也没放对位置。
- **要的**：建完类型/字段后，用 API **自动批量给自定义字段赋值**，并插到流程合适位置。
- **位置（待确认）**：赋值同时依赖「字段定义 ID（3.7 UI 建完才有）」+「工作项 ID（Phase 4 建完才有）」→ 只能放在 Phase 4 建完工作项之后，新增子步骤（如 `4.4 自定义字段批量赋值`），紧跟现有 `4.3 phase_id 批量 PATCH`。逻辑链：GET 字段定义（字段名→field_id、选项→option_id）→ 按工作项标题/描述语义推断填值 → 批量 PATCH。
- **改哪儿**：SKILL.md 流程（新增 4.x）+ references/api.md（补字段值写入端点）+ 新增 scripts/pingcode_custom_fields.js（大概率）
- **类型**：新增能力（补流程缺口）
- **先设计**：是
- **待验证未知**：PingCode 开放 API 能否给工作项写**自定义属性值**？（API 建不了字段定义，但写已存在字段的值是另一回事，多半经 `PATCH /v1/project/work_items` 带属性值或专门 property-value 端点）。实现前发一条真实请求探通 + 确认传参格式。

## #2 批量建完的容器对象，自动把 Admin 账号加为管理员

- **问题**：项目/测试库(TestHub)/产品(Ship)/知识空间(Wiki) 都用 OAuth 凭证经 API 建，创建者是 OAuth 应用非真人 → 演示用 Admin 账号默认不是成员/管理员，每次得手动进后台逐个加。
- **要的**：批量建完后**自动把当前环境 Admin 账号加为每个对象的管理员**。
- **决策已定**：Admin 账号识别 = **自动发现为主**（`GET /v1/directory/users` 筛组织管理员/owner）**+ 表单可选字段兜底**（填了用填的）。
- **改哪儿**：每模块创建步骤后补「加管理员」动作（Phase 4 内，同级可并发）+ references/api.md（补各对象成员/管理员端点）+ scripts/pingcode_api.js（封装 addMember/addAdmin）
- **类型**：新增能力（消灭重复手工），横切作用于每个容器对象
- **先设计**：是
- **待验证未知**：四类对象「加管理员」端点各不同、「管理员」role 值每模块可能不一样（项目/TestHub 库/Ship 产品/Wiki 空间，四套接口四种 role），需实测确认。

## #3 适配 Codex（不只 Claude Code）

- **问题**：Skill 实际是 Claude Code 优先写的。metadata 虽称「Claude Code + Codex 通用」、正文有 `~/.codex/skills/` 路径与跨平台开表单命令，但更像「声称兼容」，未必真在 Codex 跑通。
- **要的**：很多客户用 Codex，需让整套 Skill 在 **Codex 上真正跑通**。
- **改哪儿**：主要 SKILL.md（工具引用、激活/调用方式、AskUserQuestion 等 CC 专有工具）；scripts/ 那批 Node + 本地 Playwright **大概率可移植**（靠 node 跑、与 agent 无关），重灾区是编排指令层。
- **类型**：平台适配（横切/兼容性）
- **先设计**：是（架构问题：一份 Skill 两平台不分叉）
- **推荐架构**：**单一真相源 + 平台映射薄层**（工具名/激活方式/开表单命令/交互方式收进映射表或 shim），不维护两份文件。参照 superpowers 自己的 `references/codex-tools.md`。
- **待验证未知**：① Codex 的 skill 发现/激活机制；② 工具名映射（Bash/Read/Write/Edit/WebSearch…），尤其 **AskUserQuestion 是 CC 专有**，Phase 1/3.6 交互确认在 Codex 无对应，需换纯文本问答；③ 当前「声称兼容」部分先审一遍真伪。
- **待定（设计问题）**：Codex 上要**完整功能对等**（含 UI 自动化 Playwright 在 Codex 客户机跑）还是**核心搭建链路先对等**（API 批量建+质检+交付），UI 自定义类型作为「已知差异」后补？倾向后者（分两步），未拍板。

---

## 建议执行顺序（待用户拍板）

1. **#2 + #1 一起做**：两者都是「Phase 4 之后的 API 后处理」，同一处落点（pingcode_api.js + api.md + Phase 4 流程），一次设计、一并实现最省。#2 风险最低、每次搭建都痛（手动加管理员），#1 紧随补「空字段」缺口。
2. **#3 Codex 适配放最后**：工程量最大且架构性；先让功能集稳定再移植，避免「移植一个还在动的目标」反复返工。#1/#2 改动主要在可移植的 Node 脚本里，不会给 Codex 移植添太多负担。
