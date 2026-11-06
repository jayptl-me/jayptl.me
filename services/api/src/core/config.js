'use strict';

/**
 * Configuration, from environment variables only. Every setting is
 * documented in README.md and .env.example. Secrets never have defaults.
 */

function list(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** A number setting; empty or nonsense means the default, never zero. */
function int(value, fallback) {
  if (value === undefined || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function loadConfig(env = process.env) {
  const config = {
    port: int(env.PORT, 8787),
    allowedOrigins: list(env.ALLOWED_ORIGIN, ['https://jayptl.me']),
    siteUrl: (env.SITE_URL || 'https://jayptl.me').replace(/\/+$/, ''),
    sitemapUrl: env.SITEMAP_URL || 'https://jayptl.me/sitemap.xml',
    extraPaths: list(env.EXTRA_PATHS, ['/']),
    // Where the visitor's address comes from, for rate limits only. See
    // core/client-ip.js. The safe default trusts nothing a visitor can write.
    clientIp: {
      trustEdge: env.TRUST_EDGE_IP === 'true',
      hops: Math.max(1, Math.floor(int(env.FORWARDED_HOPS, 1)))
    },

    redisUrl: env.REDIS_URL || '',
    tickSecret: env.TICK_SECRET || '',
    adminSecret: env.ADMIN_SECRET || '',
    tokenSecret: env.TOKEN_SECRET || '',

    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: env.GOOGLE_REFRESH_TOKEN || '',
      calendarId: env.GOOGLE_CALENDAR_ID || 'primary'
    },

    booking: {
      timeZone: env.BOOKING_TIMEZONE || 'Asia/Kolkata',
      // Local working windows per weekday (0 = Sunday), "HH:MM-HH:MM" pairs.
      hours: list(env.BOOKING_HOURS, ['10:00-13:00', '14:00-18:00']),
      days: list(env.BOOKING_DAYS, ['1', '2', '3', '4', '5']).map(Number),
      slotMinutes: int(env.BOOKING_SLOT_MINUTES, 15),
      bufferMinutes: int(env.BOOKING_BUFFER_MINUTES, 5),
      minNoticeMinutes: int(env.BOOKING_MIN_NOTICE_MINUTES, 120),
      horizonDays: int(env.BOOKING_HORIZON_DAYS, 14),
      maxPerDay: int(env.BOOKING_MAX_PER_DAY, 4),
      // New bookings accepted in any 24 hours, from everyone together. Each
      // one makes the calendar email someone, so this bounds what a script
      // could send through it.
      maxNewPerDay: int(env.BOOKING_MAX_NEW_PER_DAY, 12),
      meetLeadMinutes: int(env.MEET_LEAD_MINUTES, 15),
      keepDays: int(env.BOOKING_KEEP_DAYS, 30)
    },

    steam: {
      apiKey: env.STEAM_API_KEY || '',
      steamId: env.STEAM_ID || ''
    }
  };
  // A zero or negative slot length would make the slot loop never end.
  if (!(config.booking.slotMinutes >= 1)) throw new Error('BOOKING_SLOT_MINUTES must be 1 or more');
  return config;
}

/** Which features can run with the current settings. */
function features(config) {
  return {
    redis: Boolean(config.redisUrl),
    booking: Boolean(config.redisUrl && config.tokenSecret && config.google.clientId &&
      config.google.clientSecret && config.google.refreshToken),
    // The scheduler's key only runs the tick. Guest data (export) and the
    // admin page need ADMIN_SECRET, which never leaves the owner's hands.
    tick: Boolean(config.redisUrl && config.tickSecret),
    steam: Boolean(config.steam.apiKey && config.steam.steamId),
    admin: Boolean(config.redisUrl && config.adminSecret)
  };
}

module.exports = { loadConfig, features };
