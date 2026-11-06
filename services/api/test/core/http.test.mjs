// JSON bodies: a body that parses but is not an object is a 400 bad_json,
// never a crash and never a route's own error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

for (const [path, token, good] of [
  ['/v1/hit', undefined, '{"path":"/about"}'],
  ['/v1/book', undefined, '{"name":"A"}'],
  ['/v1/cancel', undefined, '{"token":"x.y"}'],
  ['/v1/admin/playing', 'admin-secret', '{"game":"Chess"}']
]) {
  test(`${path} answers 400 bad_json to a JSON body that is not an object`, async () => {
    const t = await boot();
    for (const body of ['null', '[]', '"text"', '7']) {
      const r = await t.raw('POST', path, body, 'application/json', token);
      assert.equal(r.status, 400, `${path} with ${body}`);
      assert.equal(r.body.error, 'bad_json', `${path} with ${body}`);
    }
    // Negative control: an object reaches this route and gets the route's own answer.
    const ok = await t.raw('POST', path, good, 'application/json', token);
    assert.notEqual(ok.body.error, 'bad_json');
    await t.close();
  });
}
