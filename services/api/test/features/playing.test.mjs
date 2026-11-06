// GET /v1/playing and the manual entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';
import { fakeSteam } from '../fakes/index.mjs';

test('now playing: newest of Steam and the manual entry wins, Steam is cached', async () => {
  const steam = fakeSteam({ game: 'Hades II', now: false, at: '2026-09-27T18:00:00.000Z', recentMinutes: 300 });
  const t = await boot({ steam, steamEnv: true });
  let r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Hades II');
  assert.equal(r.body.source, 'steam');
  assert.equal((await t.call('POST', '/v1/admin/playing', { body: { game: 'Fortnite' } })).status, 401);
  const set = await t.call('POST', '/v1/admin/playing', { token: 'admin-secret', body: { game: 'Fortnite', platform: 'Epic', now: true } });
  assert.equal(set.status, 200);
  r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Fortnite', 'manual entry is newer');
  assert.equal(steam.calls, 1, 'Steam answer cached for 5 minutes');
  await t.call('DELETE', '/v1/admin/playing', { token: 'admin-secret' });
  r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Hades II');
  await t.close();
});
