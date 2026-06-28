# Web 层全量替换为 Stagehand(纯本地)— 设计

> 日期:2026-06-26 · 状态:待评审 · 触发:pingcode-presales 最明显短板 = UI 层操作

## 1. 背景与问题

`pingcode-presales` 的 API 层(`pingcode_api.js`)成熟可靠;**最脆的是 UI 层**(`scripts/pingcode_web.js`)。现有 UI 层是 puppeteer + Edge 的启发式盲点:

- `clickText` / `fillField` / `selectDropdown` 按"文本 includes / placeholder"匹配,**与 PingCode 后台真实的 ngx-tethys(thy-) + Angular CDK DOM 根本不对版**。
- `selectDropdown` 对 `thy-select` 无效(真实需 `mouse.click(坐标)` 打开、`.thy-option-item` 选)。
- `gotoWorkItemTypeAdmin` 内置 4 个 URL **全错**(正确:`/admin/product/pjm/configuration/work-item`、`…/templates`)。
- 路径③ 3 层 CDK 加字段、需求↔用例横向追溯,**至今降级留手工**。

真正打通的两次搭建(睿恩、金来奥)靠的是当场 probe(截图+DOM dump)再手写的一次性脚本,而这个"通用" `pingcode_web.js` 并非真正干活的那个。**短板本质 = 没有可靠、可复用的 UI 自动化,每个新租户都在手工重新推导。**

## 2. 目标 / 非目标

**北极星**:UI 自动化层存在的唯一理由 = **模拟补足 API 覆盖不了的边界**。凡 API 能做的,一律走 API;UI 层只补 API 做不到的那些操作,不多做。

**目标**

- 用 Stagehand(开源库,纯本地)全量替换 `pingcode_web.js`,使 §3 列出的"API 边界"可靠、可复跑、无人值守。
- 首要打通 Phase 3.7:按 type+字段清单**无人值守批量**创建自定义工作项类型及字段属性(当前唯一还在手工补的硬骨头)。
- 跑通后 codegen 固化成确定性回放脚本,同租户重跑不重付 LLM、结果一致。

**非目标(YAGNI)**

- 不替换 API 批量创建(Phase 4 主体仍走 API)。
- 不做状态工作流"流转图拖拽"自动化(交互成本高,维持手工)。
- 不引入 Browserbase 云、不开账号、不装其原装 skills(见 §5)。
- 仪表盘部件 / 自动化规则(Flow) / 权限细粒度:本次只搬成薄封装,不作为重点投入。

## 3. API 覆盖不了的边界清单(本层的全部职责面)

| 边界操作 | API | 现状 | 本次优先级 |
|---|:--:|---|:--:|
| **自定义工作项类型(路径①)** | ✗ | 手工/不稳 | **P0** |
| **类型字段属性(路径③ 3 层 CDK)** | ✗ | 手工 | **P0** |
| 类型入混合项目流程(路径②) | ✗ | 手工 | **P0** |
| 项目自定义字段(单/多选、单/多行) | ✗ | 半可用 | P1 |
| **需求↔用例横向追溯(story-relations)** | ✗(开放 API 死校验 100373) | 手工 | P1 |
| 仪表盘部件管理 | ✗ | 空壳 | P2 |
| 自动化规则(Flow) | ✗ | 空壳 | P2 |
| 权限细粒度配置 | ✗ | 空壳 | P2 |
| 状态工作流(拖拽流转图) | ✗ | 维持手工 | — |
| 页面截图(交付演示) | ✗ | 可用 | 保留 |

> P0 = 本次必须打通并过 E2E;P1 = 本次实现;P2 = 薄封装,尽力而为。

## 4. 边界:换什么、留什么

**换掉**:`scripts/pingcode_web.js` 整个 puppeteer 启发式层(含 4 个错 URL)。

**保留(搬成数据,不是代码)**:`WORK_ITEM_TYPE_CONFIGS`(6 类型)、`FIELD_TEMPLATES`、`selectWorkItemTypes / getFieldTemplate` 纯逻辑、`skill.md` 3.7 的正确 URL 与 CDK 铁律。血泪资产保留,只换执行机制(盲点选择器 → Stagehand + 精确 locator)。

**不动**:`pingcode_api.js`、Phase 4 API 主体、状态工作流拖拽(手工)。

## 5. 部署路线:纯本地 Stagehand(不上云)

- 用 `@browserbasehq/stagehand` **作为开源库**,`env: "LOCAL"`,底层 Playwright 用 `channel:'msedge'` 直连本机已装 Edge(与现有 `EDGE_PATH` 路子一致)。
- Stagehand 的 `act/observe` LLM 走用户自己的 **Anthropic(Claude)key**。
- **零数据出境**:不开 Browserbase 账号、不用 `browse` CLI、不用其远程会话/Search API。唯一离开本机的是 act/observe 发给 Claude 的少量 DOM 片段(与日常 agent 操作同性质)。
- 借该仓库的"打法"(probe = 截图+DOM dump、act-observe、codegen、失败自纠),但**不安装其原装 skills**(那些多为云设计)。autobrowse / browser-trace 的能力**本地用 Playwright 自实现**。

## 6. 模块结构(替代 pingcode_web.js)

`scripts/ui/` 一目录,小而专、各自可独立测:

| 文件 | 职责 | 驱动方式 |
|---|---|---|
| `session.js` | 启动本地 Edge 持久化 context + 初始化 Stagehand `page` | Stagehand(LOCAL)|
| `nav.js` | 导航到工作项配置页 / 混合流程详情(正确 URL 主、`act` 兜底) | Stagehand `act/observe` |
| `types.js` | 路径①建类型(名称+图标+分组),建后校验存在 | Stagehand `act` |
| `flow.js` | 路径②把类型加入混合项目流程 | Stagehand `act` |
| **`fields.js`** | **路径③ 3 层 CDK 加字段(单选 exact、下一步、数据项)** | **精确 Playwright locator(铁律)** |
| `relations.js` | 需求↔用例横向追溯(UI/内部接口路径) | Stagehand `act` + 精确 locator |
| `verify.js` | 属性数校验(7→11)、类型存在性 | Stagehand `observe` / Playwright |
| `probe.js` | 截图 + DOM dump(调试/未知 DOM 时先探后写) | Playwright |
| `data/` | `WORK_ITEM_TYPE_CONFIGS` / `FIELD_TEMPLATES`(从旧文件迁出) | 纯数据 |
| `replay/` | codegen 出的回放脚本缓存,按租户存 | 生成物 |

**公共入口签名不变**:`createWorkItemTypesForClient(page, envUrl, {industry, devMode})`——`skill.md` Phase 3.7 调用点几乎不改。

## 7. 认证(本地持久化 Edge profile)

- 用一个**专属 user-data-dir**(不碰用户日常 Edge profile,避免互相干扰)启动 Playwright/Edge。
- **首次手工登一次**目标租户 → 会话持久化到该 dir → 之后自动复用登录态。
- 登录态缺失/过期 → **明确报错并提示"先去该专属 Edge 登录",绝不盲目脚本输账密**(旧测试凭证曾被拒的教训;凭证一律占位符/env,不入库)。

## 8. 数据流 + 幂等

```
Phase 3.7 入口
  → session.js(本地 Edge 持久化会话)
  → nav 到工作项配置页
  → for 每个 selectWorkItemTypes() 的类型:
       types.js 建类型 → flow.js 入流程 → fields.js 逐字段(CDK) → verify 属性数
       → 写 {公司名}_build_manifest.json(DONE/FAILED + type_id)
  → 全部成功后 codegen 回放脚本入 replay/
```

复用现有 `{公司名}_build_manifest.json` 幂等机制:重跑跳过 DONE,只补 FAILED/PENDING。

## 9. 混合驱动取舍(核心)

| Phase 3.7 步骤 | 谁来驱动 | 为什么 |
|---|---|---|
| 进后台、找配置页、进混合流程详情 | Stagehand `act/observe` | 路径/菜单因租户漂移,语义导航最省心 |
| 路径①建类型(名称+图标+分组下拉) | Stagehand `act` + 校验 | 表单简单 |
| **路径③ 3 层 CDK 加字段** | **保留精确 Playwright locator** | `act` 在嵌套浮层会点错层,这里要确定性 |
| 失败重试 / 断点续跑 | 自纠循环 + manifest 幂等 | 几百次点击必有偶发失败 |
| 跑通后固化 | codegen 成回放脚本 | 同租户直接回放,不重付 LLM |

**CDK 铁律不变**:禁用 ref;单选 `getByText('单选',{exact:true})`;`.last()` 定位;单选先「下一步」再填数据项;overlay 内点选;建后验属性数递增。

## 10. 确定性与回放

首跑 Stagehand `act` 现场解析(付 LLM);跑通后 **codegen 固化成确定性 Playwright 调用**,按租户存 `replay/`。同租户重跑直接回放、不重付 LLM、结果一致——即"按一下,全部类型+字段长出来,且每次都一样"。

## 11. 错误处理与自纠(autobrowse 模式的安全边界)

借 autobrowse 的"自我改进/迭代重试"打法,但**严格区分两类步骤**——这是用它最容易栽的地方:

- **导航 / 恢复 / 读(可自由 self-improve)**:找配置页、等 overlay 出现、被租户 DOM 漂移挡住时换路径——这些是只读或幂等的,放手让自纠循环迭代到成功。
- **创建 / 写(禁止自由 self-improve,必须带幂等闸)**:建类型、加字段、建追溯关系会**改变真实状态**。自纠循环若误判成败再重试,会产生**重复类型 / 半成品字段**。所以写操作的每次重试前**必须先查存在性**(类型已建?字段已加?数据项够了?),只补缺失、不盲建;重试有上限;超限 → manifest 标 FAILED、继续其余,不中断整批。
- **未知/新 DOM**:先 `probe.js`(截图+DOM dump)再写,绝不盲写(方法论铁律)。
- **验证不靠"声称"**:建后用 `verify.js` 查属性数(7→11)/类型存在性,数对了才算成。

> 依据:在真实可变状态上跑回路,幂等是判据;只动自己建的、不确定就挂起。见用户「loop 工程 checklist」。

## 12. 测试与验收门

- **单测**:`selectWorkItemTypes` / `getFieldTemplate` 纯逻辑,沿用现有测试。
- **E2E/验收(spike 即验收)**:在 **daocloud-test(测试租户)** 跑「1 类型 + 1 单选字段(走完路径①②③ 3 层 CDK)」,断言属性数递增。这是 P0 的验收门。
- **P1 验收**:需求↔用例横向追溯在 daocloud-test 跑通 1 条关联并核验。

## 13. 迁移路径(不一刀切)

1. 新 `scripts/ui/` 与旧 `pingcode_web.js` **并存**。
2. 新模块在 daocloud-test 通过 §12 E2E 前**不切换**。
3. 通过后:`skill.md` 3.7 / `references/web_ops.md` 改指新模块,删 `pingcode_web.js`,更新启动横幅"通道"文案(Puppeteer → Stagehand 本地)。

## 14. 依赖与安装

- 新增:`@browserbasehq/stagehand`、`playwright`(用 `channel:'msedge'` 复用已装 Edge,免下载 chromium)。
- 移除:对 `puppeteer` 的 UI 层依赖(API 层不受影响)。
- 配置:一个 Anthropic key 供 Stagehand;专属 Edge user-data-dir 路径。
- **不需要**:Browserbase 账号 / API key / `browse` CLI。

## 15. 风险与未决

- **Stagehand 本地 + `channel:'msedge'` 的稳定性**未在本仓库实测 → 迁移第 1 步先做最小连通性 spike(启动→登录态→导航→截图)。
- **路径③ `act` 与精确 locator 混用的接缝**:需确认 Stagehand 暴露的底层 Playwright `page` 可直接 `locator()`(预期可,迁移首步验证)。
- **codegen 回放对租户 DOM 漂移的鲁棒性**:回放失败时应自动回退到 `act` 重解析并刷新缓存。
- 需求↔用例追溯走的是 UI/内部接口,**版本升级易变**,列为 P1 且容忍降级到"交付覆盖对照表"。
