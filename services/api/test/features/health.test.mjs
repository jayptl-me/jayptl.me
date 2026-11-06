// GET /v1/health.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

test('health answers without touching storage', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  await t.close();
});
