'use strict';

/**
 * Page view keys:
 *   v:paths   hash   path -> reads
 *   v:total   string total reads
 */

const { hashToObject } = require('../../core/redis-shapes');

function createViewsStore(redis) {
  return {
    async hit(path) {
      const [views, total] = await redis.pipeline([
        ['HINCRBY', 'v:paths', path, 1],
        ['INCR', 'v:total']
      ]);
      return { views: Number(views), total: Number(total) };
    },

    async views(path) {
      const [views, total] = await redis.pipeline([
        ['HGET', 'v:paths', path],
        ['GET', 'v:total']
      ]);
      return { views: Number(views || 0), total: Number(total || 0) };
    },

    async allViews() {
      const [paths, total] = await redis.pipeline([['HGETALL', 'v:paths'], ['GET', 'v:total']]);
      const map = hashToObject(paths) || {};
      Object.keys(map).forEach((k) => { map[k] = Number(map[k]); });
      return { paths: map, total: Number(total || 0) };
    }
  };
}

module.exports = { createViewsStore };
