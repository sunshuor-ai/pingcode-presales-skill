const { test } = require('node:test');
const assert = require('node:assert');
const api = require('./pingcode_api.js');

test('batchCreateParallel 结果与输入一一对齐', async () => {
  const r = await api.batchCreateParallel([1, 2, 3, 4, 5], async x => x * 10, { concurrency: 2 });
  assert.deepStrictEqual(r.results, [10, 20, 30, 40, 50]);
  assert.strictEqual(r.ok, 5);
  assert.strictEqual(r.fail, 0);
});

test('batchCreateParallel 失败位为 null 且不错位', async () => {
  const r = await api.batchCreateParallel([1, 2, 3], async x => { if (x === 2) throw new Error('boom'); return x; }, { concurrency: 3 });
  assert.deepStrictEqual(r.results, [1, null, 3]);
  assert.strictEqual(r.ok, 2);
  assert.strictEqual(r.errors[0].index, 1);
  assert.match(r.errors[0].error, /boom/);
});

test('batchCreateParallel 并发不超过 concurrency', async () => {
  let inFlight = 0, maxInFlight = 0;
  await api.batchCreateParallel(Array.from({ length: 20 }, (_, i) => i), async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 10));
    inFlight--;
  }, { concurrency: 5 });
  assert.ok(maxInFlight <= 5, `maxInFlight ${maxInFlight} 应 ≤ 5`);
  assert.ok(maxInFlight >= 2, '应确实并发（>1）');
});

test('batchCreateParallel createFn 能拿到 index', async () => {
  const r = await api.batchCreateParallel(['a', 'b', 'c'], async (x, i) => `${i}:${x}`, { concurrency: 10 });
  assert.deepStrictEqual(r.results, ['0:a', '1:b', '2:c']);
});
