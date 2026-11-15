'use strict';

/**
 * Page view keys:
 *   v:paths   hash   path -> reads
 *   v:total   string total reads
 *   v:site:<site>   hash   path -> reads another of our sites reported from
 *                          its server (POST /v1/hit/server), capped in size
 *   v:total:<site>  string total reads for that site (never added to v:total)
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

    /** null when the path is new and the site already holds maxPaths paths. */
    async siteHit(site, path, maxPaths) {
      const key = 'v:site:' + site;
      const [known, size] = await redis.pipeline([['HEXISTS', key, path], ['HLEN', key]]);
      if (!Number(known) && Number(size) >= maxPaths) return null;
      const [views, total] = await redis.pipeline([
        ['HINCRBY', key, path, 1],
        ['INCR', 'v:total:' + site]
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

    /** The backup: portfolio paths and total, and each reporting site apart. */
    async allViews(sites = []) {
      const cmds = [['HGETALL', 'v:paths'], ['GET', 'v:total']];
      sites.forEach((s) => cmds.push(['HGETALL', 'v:site:' + s], ['GET', 'v:total:' + s]));
      const res = await redis.pipeline(cmds);
      const nums = (raw) => {
        const map = hashToObject(raw) || {};
        Object.keys(map).forEach((k) => { map[k] = Number(map[k]); });
        return map;
      };
      const out = { paths: nums(res[0]), total: Number(res[1] || 0), sites: {} };
      sites.forEach((s, i) => {
        out.sites[s] = { paths: nums(res[2 + i * 2]), total: Number(res[3 + i * 2] || 0) };
      });
      return out;
    }
  };
}

module.exports = { createViewsStore };
