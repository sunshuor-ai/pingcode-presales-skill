# PingCode Web 操作参考

## 能力说明

`pingcode_web.js` 基于 Puppeteer + Edge 实现 PingCode Web UI 的自动化操作，覆盖 API 无法完成的配置和交互。

## 已实现操作

| 函数 | 功能 | 使用场景 |
|------|------|---------|
| `login(page, env, user, pass)` | 自动登录(支持验证码→密码切换) | 所有操作的前提 |
| `goTo(page, env, path)` | 导航到指定页面 | 快速跳转 |
| `screenshot(page, name)` | 截图保存到 `screenshots/` | 交付演示、问题调试 |
| `clickText(page, text)` | 按文本内容点击按钮/链接 | 通用交互 |
| `fillField(page, placeholder, value)` | 按 placeholder 填表单 | 配置操作 |
| `selectDropdown(page, label, option)` | 选择下拉菜单 | 状态/类型变更 |
| `enableProjectLocalConfig(...)` | 开启项目本地化配置 | 自定义字段/工作流 |
| `setupDashboardWidget(...)` | 配置仪表盘部件 | 添加燃尽图等 |
| `createAutomationRule(...)` | 创建自动化规则 | Flow 规则配置 |
| `importWorkItems(...)` | 批量导入 Excel | 数据迁移 |
| `configureCustomFields(page, envUrl, projectId, opts)` | 创建项目自定义字段(单选/多选/单行/多行),支持行业模板 | Phase 4 自动配置 |
| `getFieldTemplate(industry)` | 根据行业返回字段模板配置 | Phase 3 方案设计 |
| `createCustomField(page, field)` | 在项目设置页创建单个自定义字段 | `configureCustomFields` 内部调用 |
| `configurePermissions(...)` | 配置权限 | 成员角色管理 |
| `createWorkItemTypesForClient(page, envUrl, {industry, devMode})` | **Phase 3.5**：按行业/研发模式自动创建全部匹配的自定义工作项类型及字段 | Phase 3.5 主入口 |
| `createWorkItemType(page, typeName, typeConfig)` | 在工作项配置页创建单个类型并配置字段 | `createWorkItemTypesForClient` 内部调用 |
| `gotoWorkItemTypeAdmin(page, envUrl)` | 导航到管理后台→产品→项目管理→工作项配置（URL直连+菜单双重兜底） | 内部调用 |
| `selectWorkItemTypes(industry, devMode)` | 按分层策略返回应创建的类型名列表 | 方案设计辅助 |

## API vs Web 分工

| 操作 | API | Web | 说明 |
|------|:---:|:---:|------|
| 创建项目 | ✓ | ✓ | API 更快 |
| 创建工作项 | ✓ | ✓ | API 批量更高效 |
| 创建 Wiki/测试库 | ✓ | ✓ | API 更高效 |
| **创建自定义工作项类型** | ✗ | ✓ | **Web 独占，Phase 3.5** |
| 自定义字段配置 | ✗ | ✓ | Web 独占 |
| 状态工作流配置 | ✗ | ✓ | Web 独占（流转图拖拽，暂不自动化） |
| 仪表盘部件管理 | ✗ | ✓ | Web 独占 |
| 自动化规则(FIow) | ✗ | ✓ | Web 独占 |
| 批量导入 Excel | ✓ | ✓ | 都有导入 API |
| 权限细粒度配置 | ✗ | ✓ | Web 独占 |
| 全局搜索验证 | ✗ | ✓ | 演示辅助 |
| 页面截图 | ✗ | ✓ | 交付演示 |
| 拖拽甘特图排期 | ✗ | ✓ | Web 独占 |

## 使用方式

```js
const { newPage, login, goTo, screenshot, close } = require('./pingcode_web.js');

const page = await newPage();
await login(page, '<租户>.pingcode.com', '<用户名占位符>', '<密码占位符>'); // 凭证走 env/表单,绝不入库
await goTo(page, 'daocloud-test.pingcode.com', 'pjm/projects');
await screenshot(page, 'projects.png');
await close();
```
