'use strict';

/** fetch with a hard deadline, so a hung upstream never hangs a request. */
function fetchWithTimeout(fetchImpl, url, options = {}, ms = 8000) {
  return fetchImpl(url, { ...options, signal: AbortSignal.timeout(ms) });
}

module.exports = { fetchWithTimeout };
