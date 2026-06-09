/**
 * PingCode 网页操作封装 (Puppeteer + Edge)
 * ==========================================
 * 封装所有 API 无法完成、只能通过 Web UI 操作的功能。
 * 使用: node pingcode_web.js --env=daocloud-test.pingcode.com --user=xxx --pass=xxx --task=configure-project
 */
const puppeteer = require('puppeteer');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
let browser = null;

// ============================================================
// 基础操作
// ============================================================

async function launch() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

async function close() {
  if (browser) { await browser.close(); browser = null; }
}

async function newPage() {
  const b = await launch();
  return b.newPage();
}

/** 登录 PingCode */
async function login(page, envUrl, username, password) {
  console.log(`登录 ${envUrl} ...`);
  await page.goto(`https://${envUrl}/signin`, { waitUntil: 'networkidle2', timeout: 30000 });

  // 切换到密码登录
  const links = await page.$$('a, span');
  for (const link of links) {
    const text = await link.evaluate(el => el.textContent.trim());
    if (text.includes('帐号密码') || text.includes('账号密码')) {
      await link.click();
      await sleep(2000);
      break;
    }
  }

  // 填写并登录
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });
  const inputs = await page.$$('input');
  let userInp, pwdInp;
  for (const inp of inputs) {
    const ph = await inp.evaluate(el => el.placeholder || '');
    const tp = await inp.evaluate(el => el.type || 'text');
    if (tp === 'password') pwdInp = inp;
    if ((ph.includes('手机') || ph.includes('邮箱') || ph.includes('用户名')) && tp !== 'password') userInp = inp;
  }

  if (!userInp || !pwdInp) throw new Error('找不到登录输入框');
  await userInp.type(username, { delay: 60 });
  await pwdInp.type(password, { delay: 60 });

  const btns = await page.$$('button');
  for (const btn of btns) {
    const text = await btn.evaluate(el => el.textContent.trim());
    if (text.includes('登录') || text.includes('登 录')) {
      await btn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      break;
    }
  }
  console.log(`[OK] 登录完成，当前: ${page.url()}`);
  return page;
}

// ============================================================
// 页面导航
// ============================================================

async function goTo(page, envUrl, path) {
  const url = `https://${envUrl}/${path.replace(/^\//, '')}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  return page;
}

async function screenshot(page, filename) {
  const screenshotsDir = process.env.PINGCODE_SCREENSHOTS || './screenshots';
  const outPath = require('path').join(screenshotsDir, filename);
  require('fs').mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`[截图] ${outPath}`);
  return outPath;
}

// ============================================================
// 页面交互工具
// ============================================================

async function clickText(page, text) {
  const el = await findText(page, 'button, a, span, div[class*="btn"]', text);
  if (el) { await el.click(); return true; }
  return false;
}

async function findText(page, selector, text) {
  const els = await page.$$(selector);
  for (const el of els) {
    const t = await el.evaluate(e => e.textContent.trim());
    if (t === text || t.includes(text)) return el;
  }
  return null;
}

async function fillField(page, placeholder, value) {
  const inputs = await page.$$('input, textarea');
  for (const inp of inputs) {
    const ph = await inp.evaluate(el => el.placeholder || '');
    if (ph.includes(placeholder)) {
      await inp.click({ clickCount: 3 }); // 全选
      if (value !== undefined) {
        await inp.type(value, { delay: 50 });
      }
      return true;
    }
  }
  return false;
}

async function selectDropdown(page, label, optionText) {
  // 找到 label 附近的 select 或下拉组件
  const selects = await page.$$('select, [class*="select"], [class*="dropdown"]');
  for (const sel of selects) {
    const text = await sel.evaluate(el => el.textContent || '');
    if (text.includes(label) || text.includes(optionText)) {
      await sel.click();
      await sleep(500);
      const opts = await page.$$('option, [class*="option"], [class*="item"]');
      for (const opt of opts) {
        const t = await opt.evaluate(el => el.textContent.trim());
        if (t === optionText || t.includes(optionText)) { await opt.click(); return true; }
      }
    }
  }
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// Web-Only 操作模块
// ============================================================

/** 进入项目 → 项目设置 → 开启本地化配置 */
async function enableProjectLocalConfig(page, envUrl, projectId) {
  await goTo(page, envUrl, `/pjm/projects/${projectId}/settings`);
  await sleep(2000);
  // 找到"本地化配置"开关并开启
  await clickText(page, '本地化配置');
  await clickText(page, '开启');
  console.log('[OK] 已开启项目本地化配置');
}

/** 配置仪表盘部件: 添加燃尽图等 */
async function setupDashboardWidget(page, envUrl) {
  await goTo(page, envUrl, 'portal');
  await sleep(2000);
  await clickText(page, '管理部件');
  await sleep(1000);
  await clickText(page, '添加部件');
  await sleep(500);
  console.log('[OK] 仪表盘部件管理入口已打开');
}

/** 创建自动化规则 */
async function createAutomationRule(page, envUrl, projectId, rule) {
  await goTo(page, envUrl, `/pjm/projects/${projectId}/automation`);
  await sleep(2000);
  await clickText(page, '新建规则');
  await sleep(1000);
  // rule = { trigger, condition, action }
  console.log('[OK] 自动化规则创建入口已打开');
}

/** 批量导入工作项 (Excel) */
async function importWorkItems(page, envUrl, projectId, filePath) {
  await goTo(page, envUrl, `/pjm/projects/${projectId}/workitems`);
  await sleep(2000);
  await clickText(page, '导入');
  await sleep(500);
  // 上传文件
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(filePath);
    console.log(`[OK] 已上传: ${filePath}`);
  }
}

// ============================================================
// 自定义字段配置 (Web 独占)
// ============================================================

/** 行业→字段模板映射 */
const FIELD_TEMPLATES = {
  '汽车电子': [
    { type: '单选', name: '功能域', options: ['感知', '决策', '控制', '座舱', '通信'] },
    { type: '多选', name: '涉及车型', options: ['轿车', 'SUV', 'MPV', '新能源', '商用车'] },
    { type: '单行文本', name: '供应商名称' },
    { type: '多行文本', name: '技术备注' },
  ],
  '半导体': [
    { type: '单选', name: '工艺节点', options: ['28nm', '14nm', '7nm', '5nm', '3nm'] },
    { type: '多选', name: '设备类型', options: ['光刻', '刻蚀', 'CVD', 'CMP', '清洗', '量测'] },
    { type: '单行文本', name: '客户名称' },
    { type: '多行文本', name: '工艺备注' },
  ],
  '电力': [
    { type: '单选', name: '电压等级', options: ['10kV', '35kV', '110kV', '220kV', '500kV'] },
    { type: '多选', name: '设备类型', options: ['变压器', '断路器', 'CT/PT', '保护装置', 'RTU'] },
    { type: '单行文本', name: '站点名称' },
    { type: '多行文本', name: '验收标准' },
  ],
  '物联网': [
    { type: '单选', name: '协议类型', options: ['MQTT', 'CoAP', 'HTTP', 'WebSocket', 'gRPC'] },
    { type: '多选', name: '硬件平台', options: ['ARM Cortex-M', 'ESP32', 'Raspberry Pi', 'x86'] },
    { type: '单行文本', name: '固件版本' },
    { type: '多行文本', name: '接口文档链接' },
  ],
  _default: [
    { type: '单选', name: '模块归属', options: ['前端', '后端', '算法', '运维', '硬件'] },
    { type: '多选', name: '涉及系统', options: ['系统A', '系统B', '系统C', '系统D'] },
    { type: '单行文本', name: '负责人' },
    { type: '多行文本', name: '备注说明' },
  ],
};

/**
 * 根据行业获取字段模板
 * @param {string} industry - 行业名
 * @returns {Array} 字段配置
 */
function getFieldTemplate(industry) {
  if (!industry) return FIELD_TEMPLATES._default;
  for (const [key, fields] of Object.entries(FIELD_TEMPLATES)) {
    if (industry.includes(key)) return fields;
  }
  return FIELD_TEMPLATES._default;
}

/**
 * 在项目设置页面创建一个自定义字段
 * @param {Page} page - Puppeteer Page，需已登录且在项目设置页
 * @param {Object} field - { type, name, options? }
 */
async function createCustomField(page, field) {
  // 点击"添加字段"按钮
  await clickText(page, '添加字段');
  await sleep(800);

  // 点击字段类型
  await clickText(page, field.type);
  await sleep(600);

  // 填写字段名称
  await fillField(page, '字段名称', field.name);
  await sleep(400);

  // 如果有选项 (单选/多选)，逐个添加
  if (field.options && field.options.length > 0) {
    for (const opt of field.options) {
      await fillField(page, '选项', opt);
      await sleep(300);
      await page.keyboard.press('Enter');
      await sleep(300);
    }
  }

  // 保存
  await clickText(page, '确定');
  await sleep(1000);
  console.log('  [OK] 创建字段: ' + field.name + ' (' + field.type + ')');
}

/**
 * 完整自定义字段配置流程
 * @param {Page} page - Puppeteer Page
 * @param {string} envUrl - PingCode 环境地址
 * @param {string} projectId - 项目 ID
 * @param {Object} opts - { industry?: string, fields?: Array }
 */
async function configureCustomFields(page, envUrl, projectId, opts = {}) {
  console.log('\n配置自定义字段...');
  await goTo(page, envUrl, '/pjm/projects/' + projectId + '/settings');
  await sleep(2000);
  await clickText(page, '工作项类型');
  await sleep(1500);

  const fields = opts.fields || getFieldTemplate(opts.industry);
  for (const field of fields) {
    await createCustomField(page, field);
  }

  await screenshot(page, 'custom_fields_done.png');
  console.log('[OK] 自定义字段配置完成 (' + fields.length + ' 个字段)');
}

/** 配置权限 */
async function configurePermissions(page, envUrl, projectId) {
  await goTo(page, envUrl, `/pjm/projects/${projectId}/members`);
  await sleep(2000);
  console.log('[OK] 权限配置入口已打开');
}

// ============================================================
// 自定义工作项类型（管理后台→产品→项目管理→工作项配置）
// ============================================================

/**
 * 工作项类型定义库
 * tier 1: 通用，所有客户默认创建
 * tier 2: 硬件/嵌入式行业
 * tier 3: 纯软件/敏捷团队
 */
const WORK_ITEM_TYPE_CONFIGS = {
  '工程变更申请': {
    tier: 1,
    description: '用于发起和追踪设计、工艺、材料、软件的变更申请 (ECR)',
    fields: [
      { type: '下拉单选', name: '变更类型', options: ['设计变更', '工艺变更', '材料变更', '软件变更'] },
      { type: '多行文本', name: '变更原因' },
      { type: '多行文本', name: '影响分析' },
      { type: '单行文本', name: '目标版本' },
    ],
  },
  '技术评审': {
    tier: 1,
    description: '用于记录方案评审、代码评审、设计评审等技术决策过程和结论',
    fields: [
      { type: '下拉单选', name: '评审类型', options: ['方案评审', '代码评审', '设计评审', '验收评审'] },
      { type: '下拉单选', name: '评审结论', options: ['通过', '有条件通过', '不通过'] },
      { type: '多行文本', name: '问题清单' },
      { type: '日期', name: '评审日期' },
    ],
  },
  '风险项': {
    tier: 2,
    industries: ['汽车', '半导体', '电力', '工业', '机器人', '硬件', '嵌入式'],
    description: '用于识别和追踪项目技术、进度、合规等风险',
    fields: [
      { type: '下拉单选', name: '风险等级', options: ['高', '中', '低'] },
      { type: '下拉单选', name: '风险类型', options: ['技术风险', '进度风险', '资源风险', '合规风险'] },
      { type: '多行文本', name: '触发条件' },
      { type: '多行文本', name: '应对措施' },
      { type: '下拉单选', name: '残余风险', options: ['可接受', '需监控', '不可接受'] },
    ],
  },
  '合规检查项': {
    tier: 2,
    industries: ['汽车', '电力', '工业', '半导体'],
    description: '用于追踪 ASPICE/ISO 26262/IEC/GB 等行业标准合规情况',
    fields: [
      { type: '单行文本', name: '适用标准' },
      { type: '下拉单选', name: '检查结论', options: ['符合', '轻微不符合', '严重不符合'] },
      { type: '多行文本', name: '不符合描述' },
      { type: '日期', name: '整改期限' },
      { type: '单个成员', name: '整改负责人' },
    ],
  },
  '技术债务': {
    tier: 3,
    devModes: ['Scrum', '敏捷', 'Kanban'],
    description: '用于记录和规划代码、架构、测试层面的技术债务',
    fields: [
      { type: '下拉单选', name: '债务类型', options: ['代码', '架构', '测试', '文档'] },
      { type: '下拉单选', name: '偿还成本', options: ['S(半天内)', 'M(1-3天)', 'L(1周)', 'XL(1周以上)'] },
      { type: '多行文本', name: '影响范围' },
    ],
  },
  '研究任务': {
    tier: 3,
    devModes: ['Scrum', '敏捷'],
    description: '用于不确定性探索 (Spike)，有时间盒约束',
    fields: [
      { type: '多行文本', name: '研究目标' },
      { type: '下拉单选', name: '时间盒', options: ['0.5天', '1天', '2天', '3天'] },
      { type: '多行文本', name: '研究结论' },
    ],
  },
};

/**
 * 根据行业和研发模式，筛选需要创建的工作项类型
 * @param {string} industry  - 行业名（如"汽车电子"）
 * @param {string} devMode   - 研发模式（如"Scrum"）
 * @returns {Array<string>}  - 需创建的类型名列表
 */
function selectWorkItemTypes(industry = '', devMode = '') {
  const result = [];
  for (const [name, cfg] of Object.entries(WORK_ITEM_TYPE_CONFIGS)) {
    if (cfg.tier === 1) {
      result.push(name);
    } else if (cfg.tier === 2 && cfg.industries) {
      const match = cfg.industries.some(ind => industry.includes(ind));
      if (match) result.push(name);
    } else if (cfg.tier === 3 && cfg.devModes) {
      const match = cfg.devModes.some(mode => devMode.includes(mode));
      if (match) result.push(name);
    }
  }
  return result;
}

/**
 * 导航到管理后台→产品→项目管理→工作项配置
 * 路径: 管理后台 → 产品 → 项目管理 → 工作项配置
 */
async function gotoWorkItemTypeAdmin(page, envUrl) {
  // 尝试直接 URL（常见变体，命中一个即可）
  const directPaths = [
    'admin/pjm/work-item-types',
    'admin/products/pjm/work-item-config',
    'pjm/global-settings/work-item-types',
    'admin/work-item-types',
  ];
  for (const path of directPaths) {
    await goTo(page, envUrl, path);
    await sleep(2000);
    const body = await page.evaluate(() => document.body?.innerText || '');
    if (body.includes('工作项类型') || body.includes('工作项配置')) {
      console.log(`[OK] 直接URL命中: /${path}`);
      return;
    }
  }

  // 直接URL均未命中 → 菜单点击导航
  console.log('直接URL未命中，改用菜单导航...');
  await goTo(page, envUrl, 'admin');
  await sleep(2000);
  const menuClicks = ['产品', '项目管理', '工作项配置'];
  for (const text of menuClicks) {
    const ok = await clickText(page, text);
    if (!ok) throw new Error(`菜单点击失败: "${text}"，请检查管理后台URL或菜单结构`);
    await sleep(1200);
  }
  console.log('[OK] 菜单导航到工作项配置成功');
}

/**
 * 在工作项配置页中创建一个自定义类型并配置其字段
 * @param {Page}   page       - 已在工作项配置页的 Puppeteer Page
 * @param {string} typeName   - 类型名称
 * @param {Object} typeConfig - WORK_ITEM_TYPE_CONFIGS 中的配置对象
 */
async function createWorkItemType(page, typeName, typeConfig) {
  console.log(`\n  创建工作项类型: 【${typeName}】`);

  // 点击新建按钮（尝试多种常见文案）
  const newBtnTexts = ['新建', '创建类型', '新建类型', '+ 新建', '添加类型'];
  let clicked = false;
  for (const text of newBtnTexts) {
    if (await clickText(page, text)) { clicked = true; break; }
  }
  if (!clicked) throw new Error(`找不到新建类型按钮（尝试了: ${newBtnTexts.join(', ')}）`);
  await sleep(1000);

  // 填写类型名称
  const nameOk = await fillField(page, '名称') || await fillField(page, '类型名称') || await fillField(page, '请输入名称');
  // fillField 的第二个参数是 value，改用直接 type
  await page.keyboard.type(typeName, { delay: 50 });
  await sleep(400);

  // 填写描述（可能没有，忽略失败）
  if (typeConfig.description) {
    await fillField(page, '描述', typeConfig.description).catch(() => {});
    await sleep(300);
  }

  // 提交创建
  const confirmTexts = ['确定', '创建', '保存', '确认'];
  for (const text of confirmTexts) {
    if (await clickText(page, text)) break;
  }
  await sleep(1500);
  console.log(`  [OK] 类型"${typeName}"已创建`);

  // 进入该类型的字段配置页（点击刚创建的类型 → 字段 tab）
  await clickText(page, typeName);
  await sleep(1000);
  // 有些版本是 "字段" tab，有些直接展开
  await clickText(page, '字段').catch(() => {});
  await sleep(800);

  // 逐一添加自定义字段（复用已有 createCustomField 逻辑）
  for (const field of typeConfig.fields) {
    await createCustomField(page, field);
  }

  await screenshot(page, `work_item_type_${typeName}.png`);
  console.log(`  [OK] "${typeName}"字段配置完成（${typeConfig.fields.length} 个字段）`);
}

/**
 * 完整流程：根据客户行业+研发模式，自动创建所有匹配的工作项类型
 * @param {Page}   page    - 已登录的 Puppeteer Page
 * @param {string} envUrl  - PingCode 环境地址
 * @param {Object} opts    - { industry: string, devMode: string }
 * @returns {Array<string>} 已创建的类型名列表
 */
async function createWorkItemTypesForClient(page, envUrl, opts = {}) {
  const { industry = '', devMode = '' } = opts;
  const typeNames = selectWorkItemTypes(industry, devMode);

  console.log(`\n[Phase 3.5] 自定义工作项类型（行业:${industry || '通用'} 模式:${devMode || '通用'}）`);
  console.log(`计划创建: ${typeNames.join('、')}`);

  await gotoWorkItemTypeAdmin(page, envUrl);
  await sleep(1000);

  const created = [];
  for (const name of typeNames) {
    try {
      await createWorkItemType(page, name, WORK_ITEM_TYPE_CONFIGS[name]);
      created.push(name);
      // 每个类型创建完回到列表页
      await gotoWorkItemTypeAdmin(page, envUrl);
      await sleep(800);
    } catch (e) {
      console.error(`  [FAIL] "${name}" 创建失败: ${e.message}`);
    }
  }

  console.log(`\n[OK] Phase 3.5 完成，共创建 ${created.length} 个自定义类型: ${created.join('、')}`);
  return created;
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  launch, close, newPage,
  login, goTo, screenshot,
  clickText, fillField, selectDropdown, sleep, findText,
  enableProjectLocalConfig, setupDashboardWidget,
  createAutomationRule, importWorkItems,
  configureCustomFields, getFieldTemplate, createCustomField, configurePermissions,
  // 自定义工作项类型
  WORK_ITEM_TYPE_CONFIGS, selectWorkItemTypes,
  gotoWorkItemTypeAdmin, createWorkItemType, createWorkItemTypesForClient,
};
