// The hand-written Redis client over a real socket: encoding, parsing,
// pipelining, errors, and AUTH on connect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { respServer } from './fakes.mjs';

const require = createRequire(import.meta.url);
const { createRedis, encode, Parser, parseUrl } = require('../src/redis.js');

test('encode and parse round-trip every reply type', () => {
  assert.equal(encode(['SET', 'k', 'héllo']).toString('utf8'), '*3\r\n$3\r\nSET\r\n$1\r\nk\r\n$6\r\nhéllo\r\n');
  const p = new Parser();
  p.feed(Buffer.from('+OK\r\n:42\r\n$-1\r\n*2\r\n$1\r\na\r\n$2\r\nb'));
  assert.equal(p.next().value, 'OK');
  assert.equal(p.next().value, 42);
  assert.equal(p.next().value, null);
  assert.equal(p.next(), undefined, 'incomplete array waits for more bytes');
  p.feed(Buffer.from('c\r\n-ERR nope\r\n'));
  assert.deepEqual(p.next().value, ['a', 'bc']);
  assert.match(p.next().value.message, /nope/);
});

test('parseUrl reads TLS, auth and db from the URL', () => {
  assert.deepEqual(parseUrl('rediss://default:p%40ss@redis-1.cloud:12345/2'), {
    tls: true, host: 'redis-1.cloud', port: 12345, username: 'default', password: 'p@ss', db: 2
  });
  assert.throws(() => parseUrl('http://x'));
});

test('client talks to a RESP server: commands, pipelines, errors', async () => {
  const srv = respServer();
  const port = await srv.listen();
  const redis = createRedis(`redis://default:secret@127.0.0.1:${port}`);
  assert.equal(await redis.command(['PING']), 'PONG');
  assert.equal(await redis.command(['SET', 'a', 'x'.repeat(5000)]), 'OK');
  assert.equal((await redis.command(['GET', 'a'])).length, 5000);
  assert.deepEqual(await redis.pipeline([['INCR', 'n'], ['INCR', 'n'], ['HSET', 'h', 'f', 'v'], ['HGETALL', 'h']]),
    [1, 2, 1, ['f', 'v']]);
  await assert.rejects(redis.command(['NOPE']), /unknown command/);
  assert.equal(await redis.command(['GET', 'missing']), null, 'still in sync after an error');
  await redis.quit();
  await srv.close();
});
