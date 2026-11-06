'use strict';

/** Paths that may be counted: the live sitemap, refreshed every 6 hours. */

const { fetchWithTimeout } = require('../../core/fetch');

const SITEMAP_TTL_MS = 6 * 3600 * 1000;
// After a failed fetch, wait this long before the next try, so a site
// outage never turns every page view into an outbound request.
const SITEMAP_RETRY_MS = 5 * 60 * 1000;

function createSitemap({ config, fetch, now, log }) {
  let sitemap = { paths: new Set(config.extraPaths), at: 0, loading: null };
  let failedAt = -Infinity;

  async function allowedPaths() {
    if (now() - sitemap.at < SITEMAP_TTL_MS) return sitemap.paths;
    if (!sitemap.loading && now() - failedAt < SITEMAP_RETRY_MS) return sitemap.paths;
    if (!sitemap.loading) {
      sitemap.loading = (async () => {
        try {
          const res = await fetchWithTimeout(fetch, config.sitemapUrl, { headers: { Accept: 'application/xml' } }, 8000);
          if (!res.ok) throw new Error('sitemap answered ' + res.status);
          const xml = await res.text();
          const set = new Set(config.extraPaths);
          for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
            try {
              const p = new URL(m[1]).pathname.replace(/\/+$/, '') || '/';
              set.add(p);
            } catch (e) { /* skip bad loc */ }
          }
          if (set.size <= config.extraPaths.length) throw new Error('sitemap had no pages');
          sitemap = { paths: set, at: now(), loading: null };
        } catch (e) {
          failedAt = now();
          log('sitemap fetch failed', e.message);
        }
        sitemap.loading = null;
      })();
    }
    await sitemap.loading;
    return sitemap.paths;
  }

  return { allowedPaths };
}

module.exports = { createSitemap, SITEMAP_TTL_MS, SITEMAP_RETRY_MS };
