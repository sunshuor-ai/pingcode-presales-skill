'use strict';

function resolveOptionId(field, text) {
  const opts = field.options || [];
  const t = String(text);
  const exact = opts.find(o => o.text === t);
  if (exact) return exact._id;
  const loose = opts.find(o => o.text.includes(t) || t.includes(o.text));
  return loose ? loose._id : null;
}

function formatValue(field, humanValue, ctx = {}) {
  switch (field.type) {
    case 'select': {
      const id = resolveOptionId(field, humanValue);
      if (id) return { value: id };
      const fb = (field.options || [])[0];
      return fb ? { value: fb._id, warn: `option "${humanValue}" not in ${field.name}; fell back to "${fb.text}"` }
                : { value: undefined, warn: `no options for ${field.name}` };
    }
    case 'multi_select': {
      const arr = Array.isArray(humanValue) ? humanValue : [humanValue];
      const ids = arr.map(v => resolveOptionId(field, v)).filter(Boolean);
      return ids.length ? { value: ids } : { value: undefined, warn: `no valid options for ${field.name}` };
    }
    case 'text': case 'textarea': case 'link':
      return { value: String(humanValue) };
    case 'number': case 'rate': case 'progress': {
      const n = Number(humanValue);
      return Number.isFinite(n) ? { value: n } : { value: undefined, warn: `non-numeric for ${field.name}` };
    }
    case 'date': {
      let sec = null;
      if (typeof humanValue === 'number') sec = humanValue > 1e12 ? Math.floor(humanValue/1000) : humanValue;
      else { const ms = Date.parse(humanValue); sec = Number.isNaN(ms) ? null : Math.floor(ms/1000); }
      return sec ? { value: sec } : { value: undefined, warn: `bad date for ${field.name}` };
    }
    case 'member': {
      const uid = ctx.resolveUser ? ctx.resolveUser(humanValue) : null;
      const val = uid || ctx.assignee || undefined;
      return val ? { value: val } : { value: undefined, warn: `no user for ${field.name}` };
    }
    case 'members': {
      const arr = Array.isArray(humanValue) ? humanValue : [humanValue];
      const ids = arr.map(v => ctx.resolveUser ? ctx.resolveUser(v) : null).filter(Boolean);
      if (ids.length) return { value: ids };
      return ctx.assignee ? { value: [ctx.assignee] } : { value: undefined };
    }
    default:
      return { value: undefined, warn: `unsupported type ${field.type} for ${field.name}` };
  }
}

function discoverTypeFields(item, catalog) {
  const keys = Object.keys((item && item.properties) || {});
  return keys.filter(k => catalog.has(k)).map(k => ({ key: k, ...catalog.get(k) }));
}

function buildPropertiesPatch(typeFields, emittedProps, ctx = {}) {
  const byName = new Map(typeFields.map(f => [f.name, f]));
  const props = {}; const warnings = [];
  for (const [name, human] of Object.entries(emittedProps || {})) {
    const field = byName.get(name);
    if (!field) { warnings.push(`field "${name}" not applicable to type; skipped`); continue; }
    const { value, warn } = formatValue(field, human, ctx);
    if (warn) warnings.push(warn);
    if (value !== undefined) props[field.key] = value;
  }
  return { props, warnings };
}

module.exports = { resolveOptionId, formatValue, discoverTypeFields, buildPropertiesPatch };
