/**
 * vertical_template.js — 行业模板 YAML types 块 解析 + 校验
 * 用法(CLI): node vertical_template.js [汽车电子 | 路径.md ...]   无参则校验 references/verticals/*.md
 */
const yaml = require('js-yaml');
const fs = require('fs');

const VALID_KINDS = ['单行文本','多行文本','单选','多选','数字','日期','成员','级联单选','级联多选','进度','评分','链接','引用'];
const VALID_GROUPS = ['需求','任务','事务'];
const OPTION_KINDS = ['单选','多选','级联单选','级联多选'];

// 取出含 "types:" 的第一个 ```yaml 围栏块内容；无则 null
function extractTypesBlock(mdText) {
  const re = /```ya?ml\s*\n([\s\S]*?)\n```/g;
  let m;
  while ((m = re.exec(mdText)) !== null) {
    if (/(^|\n)\s*types\s*:/.test(m[1])) return m[1];
  }
  return null;
}

function parseVertical(mdText) {
  const block = extractTypesBlock(mdText);
  if (!block) return { types: [] };
  const obj = yaml.load(block) || {};
  if (!Array.isArray(obj.types)) obj.types = [];
  return obj;
}

// 返回错误字符串数组；空数组=通过
function validateVertical(parsed) {
  const errors = [];
  const types = (parsed && Array.isArray(parsed.types)) ? parsed.types : [];
  types.forEach((t, i) => {
    const label = t && t.name ? t.name : `类型#${i + 1}`;
    if (!t || !t.name) errors.push(`${label}: 缺 name`);
    if (t && t.group && !VALID_GROUPS.includes(t.group)) {
      errors.push(`${label}: group "${t.group}" 非法（需 ${VALID_GROUPS.join('/')}）`);
    }
    const fields = (t && Array.isArray(t.fields)) ? t.fields : [];
    fields.forEach((f, j) => {
      const flabel = `${label}.${f && f.name ? f.name : `字段#${j + 1}`}`;
      if (!f || !f.name) errors.push(`${flabel}: 字段缺 name`);
      if (!f || !VALID_KINDS.includes(f.kind)) errors.push(`${flabel}: kind "${f && f.kind}" 非法（需 13 种属性类型之一）`);
      if (f && OPTION_KINDS.includes(f.kind) && (!Array.isArray(f.options) || f.options.length === 0)) {
        errors.push(`${flabel}: ${f.kind} 缺 options`);
      }
    });
  });
  return errors;
}

function validateFile(filePath) {
  return validateVertical(parseVertical(fs.readFileSync(filePath, 'utf8')));
}

module.exports = { extractTypesBlock, parseVertical, validateVertical, validateFile, VALID_KINDS, VALID_GROUPS, OPTION_KINDS };

if (require.main === module) {
  const path = require('path');
  const vdir = path.join(__dirname, '..', 'references', 'verticals');
  let files = process.argv.slice(2).map(a => {
    if (fs.existsSync(a)) return a;
    const cand = path.join(vdir, a.endsWith('.md') ? a : a + '.md');
    return fs.existsSync(cand) ? cand : a;
  });
  if (files.length === 0) {
    files = fs.existsSync(vdir)
      ? fs.readdirSync(vdir).filter(f => f.endsWith('.md') && !f.startsWith('_')).map(f => path.join(vdir, f))
      : [];
  }
  let bad = 0;
  for (const f of files) {
    const errs = validateFile(f);
    if (errs.length) { bad++; console.log(`❌ ${path.basename(f)}`); errs.forEach(e => console.log('   - ' + e)); }
    else console.log(`✅ ${path.basename(f)}`);
  }
  process.exit(bad ? 1 : 0);
}
