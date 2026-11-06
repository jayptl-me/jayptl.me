'use strict';

/** Small helpers for reading store replies. */

const DAY_MS = 86400000;

function hashToObject(arr) {
  if (!arr || !arr.length) return null;
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

module.exports = { hashToObject, DAY_MS };
