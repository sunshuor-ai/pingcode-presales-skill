/**
 * PingCode 标签生成器
 * ===================
 * 从客户行业+产品线推断业务贴合标签。
 * 使用: const tags = require('./pingcode_tags.js');
 *       const list = tags.generate({ industry: '汽车电子', products: ['ADAS', 'T-Box'] });
 */

// ============================================================
// 行业术语词典
// ============================================================
const INDUSTRY_TERMS = {
  '汽车电子': ['ADAS', 'T-Box', '智能座舱', '车载通信', 'OTA升级', 'AUTOSAR',
               '功能安全', 'ISO 26262', 'ASIL', 'CAN总线', '以太网', '域控制器',
               '传感器融合', 'V2X', 'MCU', 'SoC', 'AutoSAR CP', 'AutoSAR AP'],
  '半导体': ['晶圆', '封装', '测试', '光刻', '刻蚀', 'CVD', 'PVD', 'CMP',
             '良率', 'Defect', 'FDC', 'R2R', 'SPC', 'SECS/GEM', 'EAP',
             'MES', 'Wafer', 'Die', 'Bonding', '洁净室'],
  '电力': ['变电', '输电', '配电', '继电保护', 'SCADA', 'EMS', 'DMS',
           'IEC 61850', '智能电网', 'AMI', '同步相量', '故障录波',
           '行波测距', 'EMC', '绝缘', 'GIS', 'AIS', '二次设备'],
  '物联网': ['MQTT', 'CoAP', 'NB-IoT', 'LoRa', 'Zigbee', 'BLE',
             '边缘计算', '网关', '传感器', '数字孪生', 'OTA', '设备管理',
             '数据采集', '规则引擎', '时序数据库'],
  '机器学习': ['数据集', '标注', '训练', '推理', '模型部署', 'MLOps',
               '特征工程', 'A/B测试', '模型监控', '数据漂移', 'GPU集群',
               'ONNX', 'TensorRT', '量化', '蒸馏'],
};

const INDUSTRY_DEFAULT = ['需求分析', '架构设计', '详细设计', '编码实现',
                          '单元测试', '集成测试', '系统测试', '验收测试',
                          '配置管理', '持续集成', '持续部署'];

// ============================================================
// 标签生成
// ============================================================

/**
 * @param {Object} opts - { industry: string, products: string[], module?: string }
 * @returns {string[]} 标签列表 (8-15 个)
 */
function generate(opts = {}) {
  const { industry, products = [], module } = opts;
  const tags = new Set();

  // 1. 产品线直接作为标签
  for (const p of products) {
    tags.add(p);
  }

  // 2. 行业术语匹配
  const terms = [];
  for (const [key, list] of Object.entries(INDUSTRY_TERMS)) {
    if (industry && industry.includes(key)) {
      terms.push(...list);
    }
  }
  // 如果没匹配到行业，用通用术语
  if (terms.length === 0) {
    terms.push(...INDUSTRY_DEFAULT);
  }

  // 3. 从术语池随机抽取，补足到 8-12 个
  const shuffled = terms.sort(() => Math.random() - 0.5);
  const targetCount = 8 + Math.floor(Math.random() * 5); // 8-12
  for (const t of shuffled) {
    if (tags.size >= targetCount) break;
    tags.add(t);
  }

  // 4. 模块特定标签
  if (module === '产品管理') {
    tags.add('用户反馈');
  }
  if (module === '测试管理') {
    tags.add('回归测试');
    tags.add('自动化测试');
  }

  return [...tags].sort();
}

/**
 * 为每个工作项类型推荐标签
 * @param {Object} opts - 同 generate
 * @returns {Object} { epic: [...], feature: [...], story: [...], task: [...], bug: [...] }
 */
function generateByType(opts = {}) {
  const base = generate(opts);
  return {
    epic: base.slice(0, 3),
    feature: base.slice(0, 4),
    story: base.slice(0, 5),
    task: base.slice(2, 6),
    bug: ['P0', 'P1', 'P2', ...base.slice(-3)],
  };
}

module.exports = { generate, generateByType, INDUSTRY_TERMS };
