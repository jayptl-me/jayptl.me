'use strict';

/**
 * The whole store: each feature's own keys, joined into one object so
 * routes and tests share one shape. Each feature file lists its keys.
 */

const { createViewsStore } = require('../features/views/store');
const { createUptimeStore } = require('../features/uptime/store');
const { createBookingStore } = require('../features/booking/store');
const { createPlayingStore } = require('../features/playing/store');

function createStore(redis, { keepDays = 30 } = {}) {
  return {
    ping() {
      return redis.command(['PING']);
    },
    ...createViewsStore(redis),
    ...createUptimeStore(redis),
    ...createBookingStore(redis, { keepDays }),
    ...createPlayingStore(redis)
  };
}

module.exports = { createStore };
