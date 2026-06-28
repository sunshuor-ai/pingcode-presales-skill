# PingCode Web 操作参考(纯本地 Playwright)

> 2026-06-27 重写。旧 `pingcode_web.js`(puppeteer 启发式 clickText/fillField)与真实 ngx-tethys/Angular CDK **不对版,已弃用**。现用 `scripts/ui/` 一套**纯本地 Playwright + 本机 Edge**,补足 API 覆盖不了的边界。

## 能力 & 部署

- **栈**:Playwright,`channel:'msedge'` 直驱本机 Edge;**不上云、零数据出境**(仅 act 时发给 LLM 的少量 DOM;本套已固定选择器,基本不需要)。
- **登录态**:持久化 profile `~/.pingcode-presales-edge-profile`,**首次手工登一次**之后免登;缺失/过期则报错提示去登,**绝不脚本输账密**。
- **视口**:无头 1440×1400(高弹窗不被截断);有头观看时——建字段段可 `body.style.zoom=0.67` 缩进窗口,挂载段不缩放、屏外按钮用 `locator.click` 自动滚入。

## 脚本清单(`scripts/ui/`)

| 脚本 | 作用 |
|------|------|
| **`fields.js`** | **生产入口**:读行业 `types` 配置,跑完整流水(建类型→入流程→建字段→挂载) |
| `build_type.js` | 路径①建工作项类型(名称+图标+分组,计数差验证) |
| `add_type_to_flow.js` | **路径②**把类型加进「混合项目流程」(新类型必须先入流程才能配字段) |
| `build_attr.js` | 在「工作项属性」全局库建字段(简单/单选/多选[+自定义颜色 `--color=on`]/成员[+多成员 `--multi=on`]) |
| `attach_attr.js` | 把全局字段挂到类型(该类型「属性与视图」→添加属性→thy-select 搜+选+确定) |
| `batch_type_fields.js` | 提速版:单会话一次建+挂一个类型的所有字段(~1 分钟/类型) |
| `api_types.js` | API 查重(列工作项类型,认证带 `grant_type=client_credentials`) |
| `verify_attach.js` | 验证类型的「N 属性」计数 |
| `spike_connect.js` / `probe_*.js` | 连通性 spike / 各步只读探针(先 probe 再写) |

## 四段流水

```
build_type (建类型) → add_type_to_flow (入混合项目流程) → build_attr (全局建字段) → attach_attr (挂到类型)
```
类型定义/字段从 `references/verticals/<行业>.md` 的 `types` 块读取(name/group/fields[{name,kind,options}])。

## ngx-tethys 铁律(血泪,必读)

PingCode 后台 = ngx-tethys(thy-) + Angular CDK。

1. **只认真实鼠标/键盘**:`page.mouse.click(坐标)` / `page.keyboard.type`;`.fill()`、Playwright `.click()` 的可操作性判定、`evaluate(el=>el.focus())` 对下拉/搜索框/数据项输入框**统统不灵**(值进 DOM 但不绑进 Angular 表单)。
2. **类型是卡片网格不是下拉**:`getByText('单选',{exact:true})`(防误中「级联单选/多选」)。13 种:单/多行文本·单选·多选·数字·日期·成员·级联单/多选·进度·评分·链接·引用。
3. **数据项录入(单选/多选)**:点「添加数据项」→ 真实点 `input[placeholder="输入数据项"]` → 真实键盘输入 → **点弹窗空白处(标题"新建属性")失焦提交**。⚠️ **千万别按 Enter**——Enter 提交后留空行 → 确定报「数据项已存在」(单项也报)。⚠️ 别 `Ctrl+A/Delete`(焦点在带 chip 的下拉里会删掉已选 chip)。
4. **行级「配置」用 `evaluate el.click()`**:新建类型排在流程类型列表底部,`getBoundingClientRect`+`mouse.click` 坐标在屏外点空;`el.click()` 不靠坐标、不受行在第几屏影响。`scrollIntoView` 会滚乱后续坐标,别用。
5. **屏外按钮(右上"添加" x≈1749 / thy-select)**:`evaluate` 给目标 `setAttribute('data-auto',..)` 打标记 → `page.locator('[data-auto=..]').click()`(自动滚入,不靠坐标、缩放无关)。
6. **关键选择器**:属性名 `input[name="propertyName"]`、类型名 `input[name="workItemTypeName"]`;新建 `button:has-text("新建")`;确定 evaluate 找 `textContent.trim()==='确定'` 的按钮 `.click()`(绕过未收起的下拉浮层)。
7. **自定义颜色 / 多成员开关**:`thy-switch`,真实鼠标点,验证 `input.thy-switch-input.checked`。
8. **验证看「N 属性」计数差 / API**,**别信详情面板 innerText 文本检查**(分组/未渲染全,假阴性)。
9. **CDK overlay**:不在原 DOM 位置;选项浮层取最新 `.cdk-overlay-pane`,避开背景重名;多选下拉盖住确定→Esc 收面板(注意 Esc 会清 thy-select 已选,优先点弹窗空白)。

## 正确后台 URL

- 工作项类型/属性(全局):`/admin/product/pjm/configuration/work-item`(tab:工作项类型 / 工作项属性)
- 流程(混合项目流程,path②/挂字段入口):`/admin/product/pjm/configuration/templates`

## API vs Web 分工

| 操作 | API | Web | 说明 |
|------|:---:|:---:|------|
| 项目/工作项/Wiki/测试 批量创建 | ✓ | — | API 首选 |
| **自定义工作项类型** | ✗ | ✓ | Web 独占(path①) |
| **类型加入流程** | ✗ | ✓ | Web 独占(path②) |
| **字段属性 + 挂到类型** | ✗ | ✓ | Web 独占(全局建+挂载) |
| 需求↔用例横向追溯 | ✗(100373) | ✓ | 开放 API 只认用户故事,需 Web/UI |
| 状态工作流(拖拽) | ✗ | ✓ | 暂手工 |
| 仪表盘/自动化规则/权限 | ✗ | ✓ | Web 独占 |
| 页面截图(交付) | ✗ | ✓ | — |

> 完整配方与坑同步在 memory `pingcode-ui-automation-recipe`。
