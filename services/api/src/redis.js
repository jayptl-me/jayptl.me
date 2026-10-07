'use strict';

/**
 * A small Redis client over one TCP or TLS connection, speaking the RESP2
 * wire format by hand, so the API needs no packages.
 *
 * - redis://  plain TCP, rediss:// TLS (Redis Cloud gives you either).
 * - Username and password from the URL are sent with AUTH on connect.
 * - One connection, reused; commands queue while it (re)connects, which
 *   keeps the free plan's 30-connection cap far away.
 * - Replies come back in order, so a FIFO of pending promises matches
 *   each reply to its command.
 *
 * Usage:
 *   const redis = createRedis(process.env.REDIS_URL);
 *   await redis.command(['SET', 'k', 'v']);
 *   await redis.pipeline([['INCR', 'a'], ['GET', 'b']]);
 */

const net = require('node:net');
const tls = require('node:tls');

const COMMAND_TIMEOUT_MS = 5000;
const MAX_BACKOFF_MS = 10000;
// While Redis is down, commands wait for the reconnect. Past this many,
// fail fast instead of holding memory for a queue that may never drain.
const MAX_WAITING = 500;

class RedisError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RedisError';
  }
}

/** Encode one command as a RESP array of bulk strings. */
function encode(args) {
  let out = `*${args.length}\r\n`;
  for (const a of args) {
    const s = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8');
    out += `$${s.length}\r\n`;
    out += s.toString('binary') + '\r\n';
  }
  return Buffer.from(out, 'binary');
}

/**
 * Streaming RESP parser. feed() appends bytes; next() returns one parsed
 * reply, or undefined if the buffer does not hold a complete one yet.
 */
class Parser {
  constructor() {
    this.buf = Buffer.alloc(0);
  }

  feed(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
  }

  next() {
    const res = this.read(0);
    if (!res) return undefined;
    this.buf = this.buf.subarray(res.end);
    return { value: res.value };
  }

  line(pos) {
    const i = this.buf.indexOf('\r\n', pos, 'binary');
    if (i === -1) return null;
    return { text: this.buf.toString('utf8', pos, i), end: i + 2 };
  }

  read(pos) {
    if (pos >= this.buf.length) return null;
    const type = String.fromCharCode(this.buf[pos]);
    const ln = this.line(pos + 1);
    if (!ln) return null;
    switch (type) {
      case '+':
        return { value: ln.text, end: ln.end };
      case '-':
        return { value: new RedisError(ln.text), end: ln.end };
      case ':':
        return { value: Number(ln.text), end: ln.end };
      case '$': {
        const len = Number(ln.text);
        if (len === -1) return { value: null, end: ln.end };
        if (this.buf.length < ln.end + len + 2) return null;
        return { value: this.buf.toString('utf8', ln.end, ln.end + len), end: ln.end + len + 2 };
      }
      case '*': {
        const count = Number(ln.text);
        if (count === -1) return { value: null, end: ln.end };
        const items = [];
        let at = ln.end;
        for (let i = 0; i < count; i++) {
          const item = this.read(at);
          if (!item) return null;
          items.push(item.value);
          at = item.end;
        }
        return { value: items, end: at };
      }
      default:
        throw new RedisError(`Unknown RESP type byte ${type}`);
    }
  }
}

function parseUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }
  return {
    tls: u.protocol === 'rediss:',
    host: u.hostname,
    port: Number(u.port || 6379),
    username: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0
  };
}

function createRedis(url, { log = () => {} } = {}) {
  const opts = parseUrl(url);
  let socket = null;
  let ready = false;
  let connecting = null;
  let closed = false;
  let backoff = 250;
  const parser = new Parser();
  const pending = []; // { resolve, reject, timer }
  const waiting = []; // buffered writes while not ready

  function failAll(err) {
    while (pending.length) {
      const p = pending.shift();
      clearTimeout(p.timer);
      p.reject(err);
    }
  }

  function onData(chunk) {
    parser.feed(chunk);
    for (;;) {
      let r;
      try {
        r = parser.next();
      } catch (e) {
        socket.destroy(e);
        return;
      }
      if (!r) return;
      const p = pending.shift();
      if (!p) continue;
      clearTimeout(p.timer);
      if (r.value instanceof RedisError) p.reject(r.value);
      else p.resolve(r.value);
    }
  }

  function send(args, { raw = false } = {}) {
    if (!ready && !raw && waiting.length >= MAX_WAITING) {
      return Promise.reject(new RedisError('Redis unavailable'));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RedisError(`Redis timeout on ${args[0]}`));
        // A lost reply desynchronizes the stream: start over cleanly.
        if (socket) socket.destroy();
      }, COMMAND_TIMEOUT_MS);
      const entry = { resolve, reject, timer };
      const bytes = encode(args);
      if (ready || raw) {
        pending.push(entry);
        socket.write(bytes);
      } else {
        waiting.push({ entry, bytes });
        connect();
      }
    });
  }

  function connect() {
    if (connecting || ready || closed) return connecting;
    connecting = new Promise((resolve) => {
      const onConnect = async () => {
        try {
          if (opts.password) {
            const authArgs = opts.username ? ['AUTH', opts.username, opts.password] : ['AUTH', opts.password];
            await send(authArgs, { raw: true });
          }
          if (opts.db) await send(['SELECT', opts.db], { raw: true });
          ready = true;
          backoff = 250;
          while (waiting.length) {
            const w = waiting.shift();
            pending.push(w.entry);
            socket.write(w.bytes);
          }
        } catch (e) {
          log('redis auth failed', e.message);
          socket.destroy(e);
        }
        connecting = null;
        resolve();
      };
      socket = opts.tls
        ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host }, onConnect)
        : net.connect({ host: opts.host, port: opts.port }, onConnect);
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 30000);
      socket.on('data', onData);
      socket.on('error', (e) => log('redis socket error', e.message));
      socket.on('close', () => {
        ready = false;
        connecting = null;
        parser.buf = Buffer.alloc(0);
        failAll(new RedisError('Redis connection closed'));
        if (closed) return;
        if (waiting.length) {
          const wait = backoff;
          backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
          setTimeout(connect, wait);
        }
      });
    });
    return connecting;
  }

  return {
    command(args) {
      return send(args);
    },
    async pipeline(list) {
      return Promise.all(list.map((args) => send(args)));
    },
    async quit() {
      closed = true;
      if (socket) socket.end();
    }
  };
}

module.exports = { createRedis, encode, Parser, RedisError, parseUrl };
