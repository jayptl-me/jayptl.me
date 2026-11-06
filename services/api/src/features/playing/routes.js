'use strict';

/** GET /v1/playing: the newest of the game platform's answer and the manual entry. */

function createPlaying(ctx) {
  const { store, steam, on, log, need, limit } = ctx;

  async function current() {
    const manual = await store.manualPlaying();
    let fromSteam = null;
    if (on.steam) {
      const cached = await store.cachedSteam();
      if (cached !== undefined) {
        fromSteam = cached;
      } else {
        try {
          fromSteam = await steam.activity();
        } catch (e) {
          log('steam failed', e.message);
          fromSteam = null;
        }
        await store.cacheSteam(fromSteam);
      }
    }
    const pick = [fromSteam && { ...fromSteam, platform: 'Steam', source: 'steam' },
      manual && { ...manual, now: Boolean(manual.now), source: 'manual' }]
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return pick || null;
  }

  return {
    routes: {
      'GET /v1/playing': async (req) => {
        need('redis', 'Storage');
        limit(req, 'playing', 60, 60000);
        return (await current()) || {};
      }
    }
  };
}

module.exports = { createPlaying };
