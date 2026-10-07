'use strict';

/**
 * Entry point: wire real Redis, Google and Steam into the app and listen.
 *   node src/server.js
 */

const http = require('node:http');
const { loadConfig, features } = require('./config');
const { createRedis } = require('./redis');
const { createStore } = require('./store');
const { createGoogle } = require('./google');
const { createSteam } = require('./steam');
const { createApp } = require('./app');

function log(...args) {
  // Only operational messages; request bodies, IPs and guest data are never logged.
  console.log(new Date().toISOString(), ...args);
}

const config = loadConfig();
const on = features(config);
const redis = on.redis ? createRedis(config.redisUrl, { log }) : null;

const unavailable = new Proxy({}, {
  get() {
    return () => Promise.reject(Object.assign(new Error('not configured'), { status: 503, code: 'not_configured' }));
  }
});

const app = createApp({
  config,
  store: redis ? createStore(redis) : unavailable,
  google: on.booking ? createGoogle(config.google) : unavailable,
  steam: on.steam ? createSteam(config.steam) : unavailable,
  log
});

const server = http.createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 15000;
// Bound header size and per-socket request count against slow or abusive
// clients; bodies are capped at 8 KB in readJson.
server.maxHeadersCount = 100;
server.maxRequestsPerSocket = 1000;

server.listen(config.port, () => {
  log(`jayptl-api listening on :${config.port}`, JSON.stringify(on));
});

function shutdown() {
  server.close(() => {
    if (redis) redis.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// A promise nobody awaited should be seen, not crash a healthy server.
process.on('unhandledRejection', (reason) => {
  log('unhandled rejection', reason && reason.message ? reason.message : String(reason));
});

// After an uncaught throw the process state is unknown: log it, exit,
// and let the host restart a clean process.
process.on('uncaughtException', (err) => {
  log('uncaught exception', err && err.stack ? err.stack : String(err));
  process.exit(1);
});
