# 设计：自定义字段语义填值 + 自动加管理员

- **日期**：2026-06-30
- **状态**：已评审通过（待用户过目 spec → 转 writing-plans）
- **覆盖 backlog**：`ITERATION_BACKLOG.md` 的 #1（自定义字段 API 批量赋值）+ #2（自动加 Admin 为管理员）
- **探测环境**：daocloud-test.pingcode.com（API host `https://open.pingcode.com`，client_credentials）

> 本 spec 的所有 API 事实均来自对 daocloud-test 的真实探测（probe_discover/probe2-5），不是推断。

---

## 1. 目标 / 非目标

**目标**
- #1：搭建完成后，让**自定义类型**工作项（工程变更申请/技术评审/风险项/技术债务/研究任务…）的**自定义字段带上语义贴合的值**，消灭"带字段却全空"的演示尴尬。
- #2：批量建完后，把**当前环境 Admin 账号自动加为管理员**到这轮新建的 项目 / 知识空间(Wiki) / 产品(Ship) / 测试库(TestHub)，省掉每次手动后台加人。

**非目标**
- 不填标准类型（story/task/bug/epic/feature）的系统属性（risk/effort/business_value 等）。
- 不改动环境里**既有**对象（只作用于本轮 `build_manifest` 新建的对象）。
- 不在 API 侧创建字段**定义**（仍由 3.7 的本地 Playwright 建），本设计只**写值**。

---

## 2. 已验证的 API 事实（ground truth）

### 2.1 自定义字段（#1）
- **属性表**：`GET /v1/project/work_item_properties`（分页，本环境 total=177）。每条：
  - `id` = **property_key**（slug，如 `biangengleixing`、`fengxiandengji`、`chufatiaojian`）
  - `name`（中文显示名，如「变更类型」）
  - `type` ∈ `select | multi_select | cascade_select | text | textarea | number | date | member | members | rate | link | progress | system`
  - `options`（仅 select 系）：`[{ _id, text }]`
  - ⚠️ 该端点返回**全组织所有属性**，`?work_item_type_id=` 过滤**无效**（实测仍返回全部）→ 不能靠它做类型→字段映射。
- **类型→适用字段**：只能靠"建一条该类型工作项 → `GET /v1/project/work_items/{id}` → 读 `.properties` 的 key 集合"得知（自校正）。`.properties` 同时含若干系统 key（如 `entry_status/operation_time/backlog_from/backlog_type`）+ 该类型的自定义 key，需与属性表求交剔除系统项。
- **写值**：`PATCH /v1/project/work_items/{id}` body `{ "properties": { "<key>": <value> } }` → 200，readback 持久化。**实测通过**：
  - `select` → 值 = 选项的 `_id`（字符串）。例：`{"biangengleixing":"6a282d1b1c7734aaadb61e65"}` ✅
  - `textarea`/`text` → 字符串。例：`{"chufatiaojian":"探测填值-触发条件"}` ✅
  - `multi_select` → `[ _id, … ]`（标准格式，同机制）
  - `date` → unix 秒；`number` → 数字；`member` → `user_id`；`members` → `[user_id]`（标准格式）
- ⚠️ **选项 id 因环境而异，必须 live 读**：本环境「变更类型」选项是 `日常变更/临时变更`，与 SKILL.md 3.7 表里硬编码的 `设计/工艺/材料/软件` 完全不同。任何硬编码选项都是错的。
- 错误参考：`100043 property_key 不存在`（key 不属于该工作项类型时）。

### 2.2 成员 / 管理员（#2）
- 四模块都有 `/members` 端点（GET 实测有数据）：
  - 项目：`/v1/project/projects/{id}/members`
  - Wiki：`/v1/wiki/spaces/{id}/members`
  - Ship：`/v1/ship/products/{id}/members`
  - TestHub：`/v1/testhub/libraries/{id}/members`
- 成员对象含 `role`：`{ id, name }`。**「管理员」role id = `100000000000000000000001`，四模块统一**（实测 project/wiki/ship/testhub 的 owner 成员 role 均为此）。
- **加成员带角色**：`POST /v1/project/projects/{id}/members` body `{ "user_id": "...", "role_id": "100000000000000000000001" }` → 200，readback role.name=「管理员」✅；移除：`DELETE …/members/{memberResourceId}`（member 资源 id == user id，实测）✅。
- **Admin 识别**：`/v1/directory/users/me` 在 client_credentials 下无效（`100003`，应用≠用户）；`/v1/directory/users` **不暴露 is_admin/owner/role 任何标志**。唯一可靠信号 = **扫已有对象成员里 role=「管理员」的人**（本环境恒为 owner 孙硕 `manager3477` / `4eb9500a4a9c4d14988dc2f302352cac`）。

---

## 3. #1 设计 —— 自定义字段语义填值

### 3.1 模型↔脚本分工（决策 A）
- **模型（Phase 4 生成）**：自定义类型工作项额外产出 `properties`，**按字段名 + 人类可读值**：select 写选项**文字**（如「高风险」），text/textarea 写串，date 写日期，member 写**显示名**（脚本配成 user_id，缺省回落该工作项 assignee）。模型**不碰 key、不碰 option `_id`**，只做语义判断。
- **脚本 `pingcode_custom_fields.js`**：把字段名→live key、选项文字→live `_id` 解析掉，按 type 格式化，批量 PATCH 写入。

### 3.2 类型→字段发现（决策 A）
建该类型**第一条**工作项后 `GET …/work_items/{id}` 回读 `.properties` 的 key 集合，与属性表（`work_item_properties`）求交得自定义字段清单（剔除系统 key），**按 typeId 缓存**，无额外造删。

### 3.3 模块接口（`pingcode_custom_fields.js`）
```
resolvePropertyCatalog(token, baseUrl)
  → Map<key, {name, type, options:[{_id,text}]}>   // 全局属性表，一次拉取缓存

discoverTypeFields(token, sampleWorkItemId, catalog)
  → [{key, name, type, options}]                   // 读回 .properties ∩ catalog，剔系统 key

formatValue(field, humanValue, ctx)
  → 合法 API 值                                     // select: text→_id; multi: [text]→[_id];
                                                    // text/textarea: 原样; date: →unix; number: 数字;
                                                    // member: 显示名→user_id(缺省回落 ctx.assignee);
                                                    // members: [显示名]→[user_id];
                                                    // 不合法选项→最近似/合法默认 + warn（绝不发非法 _id）

applyPropertyValues(token, items, catalog, baseUrl)
  → 批量 PATCH {properties}，与 phase_id 修复同批；返回逐条结果(失败位 null)
```

### 3.4 数据流 & 落点
1. **Pre-flight (3.8/3.9)**：调 `resolvePropertyCatalog` 拿全局属性表（name↔key↔options），缓存暴露给生成层与写入层。**类型→适用字段的发现不在此做**——pre-flight 时工作项还没建（见 §3.2，发现依赖回读已建工作项）。
2. **Phase 4 生成**：自定义类型工作项的 blueprint 带 `properties`（**字段名**键、人读值）。模型只需知道字段名（来自蓝图 / 3.7 字段设计），**无需 live key/`_id`**。
3. **Phase 4.4（新增，紧跟 4.3 phase_id 批量 PATCH）**：4.3 本就要回读每条工作项修 phase_id——**顺带** `discoverTypeFields`（该条 `.properties` keys ∩ catalog，按 typeId 缓存）得适用字段；再把模型给的每个 (字段名, 人读值) 解析 name→key、校验 key 适用、`formatValue` → **properties 与 phase_id 并进同一条 PATCH body** → 批量发。
4. **Phase 5 质检**：新增检查项「自定义类型工作项的自定义字段填充率」（目标 ≥90%）。

### 3.5 容错
- 选项文字对不上 live options → 取最近似/合法默认值并 warn，**绝不发非法 `_id`**。
- key 不在该条 `.properties` → 跳过（防 `100043`）。
- 类型无自定义字段 / 非自定义类型 → no-op。

---

## 4. #2 设计 —— 自动加管理员

### 4.1 模块接口（`pingcode_admin.js`，或并入 `pingcode_api.js`）
```
ADMIN_ROLE = "100000000000000000000001"            // 常量；防御性可 live 重取

resolveAdminUserId(token, baseUrl, {formAdmin?})
  → user_id | null
    // formAdmin(名/邮箱/手机) 给了 → /directory/users 配 → user_id
    // 否则扫若干已有项目 members，统计 role=ADMIN_ROLE 最频用户 → user_id
    // 都没有 → null

resolveAdminRoleId(token, baseUrl)
  → role_id                                        // 从某已有成员 role.name=="管理员" 现取，回落常量

addAdmin(token, module, containerId, userId, roleId, baseUrl)
  → ok                                             // module→端点映射；POST {user_id, role_id}
                                                    // 幂等：已是成员视作成功
```
端点映射：`project→/v1/project/projects/{id}/members`、`wiki→/v1/wiki/spaces/{id}/members`、`ship→/v1/ship/products/{id}/members`、`testhub→/v1/testhub/libraries/{id}/members`。

### 4.2 数据流 & 落点（决策 X）
- **Phase 4 末尾一次性 sweep**：读 `build_manifest` 捞出本轮新建的 project/wiki/ship/testhub → `resolveAdminUserId` 一次 + `resolveAdminRoleId` 一次 → **并发** `addAdmin` 逐容器。幂等、可重跑。
- Pre-flight 可顺带预解析 admin user_id + role_id 备用。

### 4.3 容错
- admin 没找到且表单没填 → 整步跳过，Phase 5/6 明确告警（「未能自动识别管理员，已跳过，请手动或在表单指定」）。
- 单容器 add 失败 → 记录续跑，不拖垮搭建。
- 已是成员 → 幂等成功。

---

## 5. 幂等 / Manifest
- 两特性均 **manifest 驱动**：properties 写入与 admin sweep 都从 `build_manifest` 取本轮对象，重跑跳过已完成项。
- properties 写入在 manifest 对应工作项记 `props_done`；admin add 在容器项记 `admin_done`。

---

## 6. 文件级改动清单
- **`SKILL.md`**：3.8 Pre-flight 增「属性目录 + 类型→字段」解析；Phase 4 生成约定 `properties`（name 键人读值）；**新增 4.4 自定义字段批量赋值**、**4.5 管理员 sweep**；Phase 5 增「自定义字段填充率」检查；3.7 表里硬编码选项标注「仅示例，运行时以 live options 为准」。
- **`references/api.md`**：补 `work_item_properties` 端点 + properties 写值格式表 + 四模块 members 端点 + `ADMIN_ROLE` + 相关错误码/坑。
- **`scripts/pingcode_custom_fields.js`**（新）：§3.3 接口。
- **`scripts/pingcode_admin.js`**（新，或并入 `pingcode_api.js`）：§4.1 接口。
- **`scripts/pingcode_api.js`**：`addProjectMember` 增 `role_id` 入参；补 wiki/ship/testhub 的 `addMember`、各 `listMembers`。
- **`scripts/pingcode_check.js`**：Phase 5 增填充率检查项。

## 7. 测试（TDD）
- **单测**：name→key / 选项文字→`_id` 解析；`formatValue` 各 type；非法值回落；admin 计票取最频；端点映射；幂等（重复 add / 重复 PATCH）。
- **真实 E2E**（打 daocloud-test，build-and-delete）：建自定义类型工作项→填值→readback 校验→删；建/选一容器→加管理员→readback role 校验→还原。
- 验证口径：自定义类型工作项「有自定义值的比例」；新建容器「管理员命中数」。

## 8. 延后 / 关联
- 其余 property type（multi_select/date/member/members/number）格式按标准实现，靠 create→readback→patch 自校正，首次实现时各跑一条 E2E 落实。
- 关联 backlog #3（Codex 适配）：本设计的两个新脚本是纯 Node、与 agent 无关，天然可移植；SKILL.md 新增段落写成工具中立，给 #3 减负。
