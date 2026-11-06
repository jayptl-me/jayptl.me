// An in-memory store with the same command/pipeline shape as the real
// client, and a wire-format server around it for the client's own tests.
import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { encode, Parser, RedisError } = require('../../src/clients/redis.js');

export function fakeRedis() {
  const kv = new Map();     // string values
  const hashes = new Map(); // key -> Map
  const sets = new Map();   // key -> Set
  const zsets = new Map();  // key -> Map(member -> score)
  const bits = new Map();   // key -> Set of bit offsets
  const expiresAt = new Map(); // key -> absolute ms, from PEXPIREAT (recorded, not enforced)
  let calls = 0;            // round trips: one per command() or pipeline()

  const score = (v) => (v === '+inf' ? Infinity : v === '-inf' ? -Infinity : Number(v));

  function run(args) {
    const [cmd, ...a] = args.map(String);
    switch (cmd.toUpperCase()) {
      case 'PING': return 'PONG';
      case 'AUTH': return 'OK';
      case 'GET': return kv.has(a[0]) ? kv.get(a[0]) : null;
      case 'SET': {
        const nx = a.includes('NX');
        if (nx && kv.has(a[0])) return null;
        kv.set(a[0], a[1]);
        return 'OK';
      }
      case 'INCR': {
        const n = Number(kv.get(a[0]) || 0) + 1;
        kv.set(a[0], String(n));
        return n;
      }
      case 'DEL': {
        let n = 0;
        for (const k of a) {
          for (const m of [kv, hashes, sets, zsets, bits]) if (m.delete(k)) n = 1;
        }
        return n;
      }
      case 'EXPIRE': return 1;
      case 'PEXPIREAT': expiresAt.set(a[0], Number(a[1])); return 1;
      case 'HINCRBY': {
        const h = hashes.get(a[0]) || new Map();
        const n = Number(h.get(a[1]) || 0) + Number(a[2]);
        h.set(a[1], String(n));
        hashes.set(a[0], h);
        return n;
      }
      case 'HGET': return (hashes.get(a[0]) || new Map()).get(a[1]) ?? null;
      case 'HSET': {
        const h = hashes.get(a[0]) || new Map();
        for (let i = 1; i < a.length; i += 2) h.set(a[i], a[i + 1]);
        hashes.set(a[0], h);
        return 1;
      }
      case 'HGETALL': return [...(hashes.get(a[0]) || new Map())].flat();
      case 'SADD': {
        const s = sets.get(a[0]) || new Set();
        a.slice(1).forEach((m) => s.add(m));
        sets.set(a[0], s);
        return 1;
      }
      case 'SREM': (sets.get(a[0]) || new Set()).delete(a[1]); return 1;
      case 'SMEMBERS': return [...(sets.get(a[0]) || new Set())];
      case 'ZADD': {
        const z = zsets.get(a[0]) || new Map();
        z.set(a[2], Number(a[1]));
        zsets.set(a[0], z);
        return 1;
      }
      case 'ZREM': (zsets.get(a[0]) || new Map()).delete(a[1]); return 1;
      case 'ZREMRANGEBYSCORE': {
        const z = zsets.get(a[0]) || new Map();
        const lo = score(a[1]);
        const hi = score(a[2]);
        let n = 0;
        for (const [m, sc] of z) if (sc >= lo && sc <= hi) { z.delete(m); n++; }
        return n;
      }
      case 'ZRANGEBYSCORE': {
        const lo = score(a[1]);
        const hi = score(a[2]);
        return [...(zsets.get(a[0]) || new Map())]
          .filter(([, s]) => s >= lo && s <= hi)
          .sort((x, y) => x[1] - y[1])
          .map(([m]) => m);
      }
      case 'SETBIT': {
        const b = bits.get(a[0]) || new Set();
        const had = b.has(Number(a[1])) ? 1 : 0;
        if (a[2] === '1') b.add(Number(a[1])); else b.delete(Number(a[1]));
        bits.set(a[0], b);
        return had;
      }
      case 'BITCOUNT': {
        const b = bits.get(a[0]) || new Set();
        if (a.length === 1) return b.size;
        const from = Number(a[1]);
        const to = Number(a[2]);
        if (a[3] !== 'BIT') throw new Error('fake only supports BIT ranges');
        return [...b].filter((x) => x >= from && x <= to).length;
      }
      default:
        throw new RedisError(`ERR unknown command ${cmd}`);
    }
  }

  return {
    run,
    kv, hashes, sets, zsets, bits, expiresAt,
    get calls() { return calls; },
    async command(args) { calls++; return run(args); },
    async pipeline(list) { calls++; return list.map((args) => run(args)); }
  };
}

/** A RESP server around fakeRedis, to exercise the real client's wire code. */
export function respServer(fake = fakeRedis(), { stallFirst = false } = {}) {
  const sockets = new Set();
  let connections = 0;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    // stallFirst: the first connection accepts bytes and never answers,
    // like a store that hangs, so client timeouts can be tested.
    if (stallFirst && connections++ === 0) return;
    socket.on('close', () => sockets.delete(socket));
    const parser = new Parser();
    socket.on('data', (chunk) => {
      parser.feed(chunk);
      let r;
      while ((r = parser.next())) {
        let out;
        try {
          const v = fake.run(r.value);
          out = reply(v);
        } catch (e) {
          out = Buffer.from(`-${e.message}\r\n`);
        }
        socket.write(out);
      }
    });
  });
  function reply(v) {
    if (v === null) return Buffer.from('$-1\r\n');
    if (typeof v === 'number') return Buffer.from(`:${v}\r\n`);
    if (v === 'OK' || v === 'PONG') return Buffer.from(`+${v}\r\n`);
    if (Array.isArray(v)) return Buffer.concat([Buffer.from(`*${v.length}\r\n`), ...v.map(reply)]);
    return encode([v]).subarray(4); // "$len\r\nvalue\r\n" without the "*1\r\n" header
  }
  return {
    fake,
    listen: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { sockets.forEach((s) => s.destroy()); server.close(resolve); })
  };
}
