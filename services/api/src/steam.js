'use strict';

/**
 * Steam play activity through the official Steam Web API. Needs an API
 * key and a SteamID64, and the profile's game details set to public.
 *
 * Returns { game, now, at, recentMinutes } or null:
 * - in a game right now (GetPlayerSummaries gameextrainfo), or
 * - the most recently played game (GetOwnedGames rtime_last_played),
 *   with minutes played in the last two weeks (GetRecentlyPlayedGames).
 */

const { fetchWithTimeout } = require('./util');

const BASE = 'https://api.steampowered.com';

function createSteam(config, { fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  async function get(path, params) {
    const qs = new URLSearchParams({ key: config.apiKey, format: 'json', ...params });
    const res = await fetchWithTimeout(fetch, `${BASE}${path}?${qs}`, { headers: { Accept: 'application/json' } }, 8000);
    if (!res.ok) throw new Error(`Steam ${path} failed: ${res.status}`);
    return res.json();
  }

  return {
    async activity() {
      const [summary, owned, recent] = await Promise.all([
        get('/ISteamUser/GetPlayerSummaries/v2/', { steamids: config.steamId }),
        get('/IPlayerService/GetOwnedGames/v1/', {
          steamid: config.steamId, include_appinfo: 'true', include_played_free_games: 'true'
        }),
        get('/IPlayerService/GetRecentlyPlayedGames/v1/', { steamid: config.steamId, count: '10' })
      ]);
      const player = ((summary && summary.response && summary.response.players) || [])[0] || {};
      const recentGames = (recent && recent.response && recent.response.games) || [];
      const minutesFor = (appid) => {
        const g = recentGames.find((r) => String(r.appid) === String(appid));
        return g ? Number(g.playtime_2weeks) || 0 : 0;
      };
      if (player.gameextrainfo) {
        return {
          game: player.gameextrainfo,
          now: true,
          at: new Date(now()).toISOString(),
          recentMinutes: minutesFor(player.gameid)
        };
      }
      const games = (owned && owned.response && owned.response.games) || [];
      let last = null;
      for (const g of games) {
        if (g.rtime_last_played && (!last || g.rtime_last_played > last.rtime_last_played)) last = g;
      }
      if (!last) return null;
      return {
        game: last.name,
        now: false,
        at: new Date(last.rtime_last_played * 1000).toISOString(),
        recentMinutes: minutesFor(last.appid)
      };
    }
  };
}

module.exports = { createSteam };
