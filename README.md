# PingCode 售前演示环境搭建 Skill v3.1

> 一句话：说"来活了，搭模板"，自动从零搭建 PingCode 售前演示环境。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-required-orange)](https://claude.ai/code)

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/shuo/pingcode-presales-skill.git ~/.claude/skills/pingcode-presales/

# 2. 安装依赖（可选，API 脚本零依赖；Web 操作需要）
cd ~/.claude/skills/pingcode-presales/scripts && npm install

# 3. 重启 Claude Code，然后输入：
来活了，搭模板
```

或一键安装：
```bash
# Windows
.\install.ps1

# Mac / Linux
bash install.sh
```

## 前置依赖

| 依赖 | 说明 |
|------|------|
| [Claude Code](https://claude.ai/code) | 必须 |
| [superpowers 插件](https://superpowers.anthropic.com) | 必须（skill 运行框架） |
| Node.js v18+ | API 脚本零 npm 依赖，直接用内置 fetch |
| PingCode 站点 | 可用的 PingCode 环境地址 |
| API 凭证 | `client_id` + `client_secret`（管理后台 → 开发者中心 → 创建应用） |

## 使用方式

### 方式一：填表单（推荐）

浏览器打开 `templates/form.html`，填写客户信息后复制输出内容，粘贴到 Claude Code。

### 方式二：直接输入

```
来活了，搭模板

公司: 某某科技有限公司
行业: 汽车电子
产品线:
  - ADAS
  - T-Box
团队规模: 50-200
研发模式: Scrum
搭建模块: 项目管理、知识库、测试管理
环境地址: https://xxx.pingcode.com
client_id=xxx
client_secret=xxx
```

Claude 自动完成六阶段：画像 → 调研 → 设计 → 搭建 → 质检 → 交付。

## 功能

- 🎯 **六阶段全自动**：客户画像 → 业务调研 → 方案设计 → API 批量搭建 → 自动质检 → 交付摘要
- 📦 **五大模块**：项目管理 · 产品管理 · Wiki · 测试管理 · Ship
- 🎨 **蓝紫渐变 Banner**：PINGCODE + SKILL ASCII 艺术字（true color ANSI）
- 📊 **实时进度条**：每阶段显示完成进度，Phase 4 显示模块级子进度
- 🔧 **双通道**：API 批量创建（项目/工作项/Wiki/测试）+ Web 独占操作（自定义字段/工作流/仪表盘）
- ✅ **自动质检**：搭建后自动检查数量/结构/内容/业务贴合度，不达标自动修复
- 🏷️ **自定义工作项类型**：自动创建行业专属类型（工程变更申请/技术评审/风险项等）+ 配置字段
- 💾 **幂等 Build Manifest**：中途失败可恢复，不重复创建

## 新特性（v3.1）

- **渐变色 Banner**：PINGCODE + SKILL 拼接 ASCII 艺术字，蓝紫自上而下渐变（true color ANSI），by Shuor
- **CDK 弹窗操作铁律**：完全不用 ref，用 text/role 选择器，单选 exact match 防误触级联单选
- **单选两步流程**：选「单选」后必须先点「下一步」再填数据项（血泪教训）
- **类型存在性验证**：创建前先搜索确认，不盲信"已创建"
- **Playwright 选择器对照表**：稳定 text/role 选择器替代不稳定 ref

## 文件结构

```
pingcode-presales/
├── skill.md                     ← 主规则（Claude 执行指南，1400+ 行）
├── README.md                    ← 本文件
├── install.ps1                  ← Windows 一键安装脚本
├── install.sh                   ← Mac/Linux 一键安装脚本
├── .gitignore
├── scripts/
│   ├── pingcode_api.js          ← API 封装（40+ 端点，零依赖）
│   ├── pingcode_check.js        ← 搭建后自检 + 自动修复脚本
│   ├── pingcode_web.js          ← Web 操作（自定义字段/截图/流程配置）
│   ├── pingcode_historical.js   ← 历史数据模拟引擎
│   └── pingcode_tags.js         ← 业务标签生成器
├── references/
│   ├── api.md                   ← 40+ 端点 + 字段陷阱 + 踩坑记录
│   ├── demo_guide.md            ← 演示路径 + 客户应答话术
│   └── web_ops.md               ← Web 独占操作手册
└── templates/
    ├── form.html                ← 客户信息采集表单（浏览器打开）
    ├── client_profile.md        ← 客户画像模板
    ├── project_blueprint.md     ← 方案设计模板
    └── delivery_summary.md      ← 交付摘要模板
```

## 实战案例

| 客户 | 行业 | 产出 |
|------|------|------|
| 弗浪科技 | 汽车 ADAS/T-Box/座舱 | 3项目·64+40工作项·5Wiki·3测试库·29用例 |
| 铭赛机器人 | 半导体封装装备 | 1测试库·4套件·30用例 |
| 海能信息科技 | 电力/冶金/石化 | 1项目·24工作项·20工单·20需求·20用例 |
| 万有引力 GravityXR | XR芯片/半导体 | 3项目·10阶段·60+工作项·4Wiki·3测试库·3工单 |
| 炉石信息科技 | 智能硬件/车载音频 | 2项目·16工作项·12交付物·2Wiki·2产品空间·5工单·2测试库·9用例 |
| 景曜科技 | 特种机器人/巡检 | 2项目·14工作项·3Wiki·6页·2测试库·4套件·11用例 |

## 常见问题

**Q: API 凭证哪里拿？**
A: PingCode 管理后台 → 开发者中心 → 创建应用 → 复制 client_id 和 client_secret。

**Q: Web 操作（自定义字段/截图）报错？**
A: 需要 `npm install puppeteer`。80% 的搭建用 API 就够了，Web 操作是可选的。

**Q: 环境地址填什么？**
A: 你们 PingCode 站点的完整 URL，例如 `https://your-company.pingcode.com`。

**Q: 能同时搭多个客户吗？**
A: 可以，开两个 Claude Code 终端分别跑。每个 Skill 实例独立工作。

## License

MIT © Shuor
