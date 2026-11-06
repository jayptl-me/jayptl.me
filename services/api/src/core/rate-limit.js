'use strict';

const MAX_LIMITER_KEYS = 50000;

/**
 * In-memory fixed-window rate limiter keyed by bucket and IP. Memory
 * only, so IPs are never written anywhere and vanish on restart.
 *
 * Past maxKeys the oldest windows are dropped first (a Map keeps the order
 * keys were added), so a flood of new addresses can never reset every
 * limit at once.
 */
function createLimiter(now = () => Date.now(), { maxKeys = MAX_LIMITER_KEYS } = {}) {
  const windows = new Map();
  let lastSweep = now();

  function sweep(t, force) {
    if (!force && t - lastSweep <= 60000) return;
    for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    // A flood of distinct addresses must not grow memory without bound:
    // drop the oldest tenth, so the next eviction is a while away.
    if (windows.size > maxKeys) {
      const keep = Math.floor(maxKeys * 0.9);
      for (const k of windows.keys()) {
        if (windows.size <= keep) break;
        windows.delete(k);
      }
    }
    lastSweep = t;
  }

  function current(id, t) {
    const w = windows.get(id);
    return w && w.resetAt > t ? w : null;
  }

  /** Count one request; true while the key is within its limit. */
  function allow(bucket, key, limit, windowMs) {
    const t = now();
    sweep(t, windows.size > maxKeys);
    const id = bucket + '|' + key;
    let w = current(id, t);
    if (!w) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(id, w);
    }
    w.count++;
    return w.count <= limit;
  }

  /** True when the key has already used up its limit (does not count). */
  allow.blocked = function blocked(bucket, key, limit) {
    const w = current(bucket + '|' + key, now());
    return Boolean(w && w.count >= limit);
  };

  return allow;
}

module.exports = { createLimiter, MAX_LIMITER_KEYS };
