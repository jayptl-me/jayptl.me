'use strict';

/**
 * Now playing keys:
 *   play:manual  string JSON { game, platform, at } set from /admin
 *   play:steam   string JSON cache of the game platform answer, 5 minutes
 */

function createPlayingStore(redis) {
  return {
    async manualPlaying() {
      const raw = await redis.command(['GET', 'play:manual']);
      try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },

    async setManualPlaying(entry) {
      if (!entry) return redis.command(['DEL', 'play:manual']);
      return redis.command(['SET', 'play:manual', JSON.stringify(entry)]);
    },

    async cachedSteam() {
      const raw = await redis.command(['GET', 'play:steam']);
      try { return raw ? JSON.parse(raw) : undefined; } catch (e) { return undefined; }
    },

    async cacheSteam(value) {
      return redis.command(['SET', 'play:steam', JSON.stringify(value), 'EX', 300]);
    }
  };
}

module.exports = { createPlayingStore };
