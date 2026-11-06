// Secret checks take the same path whatever the length of the guess.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const crypto = require('node:crypto');
const { bearerOk } = require('../../src/core/auth.js');

const req = (value) => ({ headers: { authorization: value } });

test('a guess of the wrong length still runs the constant-time compare', () => {
  const real = crypto.timingSafeEqual;
  let compares = 0;
  crypto.timingSafeEqual = (a, b) => { compares++; return real(a, b); };
  try {
    assert.equal(bearerOk(req('Bearer x'), 'a-much-longer-secret-value'), false);
    assert.equal(bearerOk(req(''), 'a-much-longer-secret-value'), false);
    assert.equal(compares, 2, 'length alone never short-cuts the check');
    // Negative control: the right secret still passes, a near miss fails.
    assert.equal(bearerOk(req('Bearer a-much-longer-secret-value'), 'a-much-longer-secret-value'), true);
    assert.equal(bearerOk(req('Bearer a-much-longer-secret-valuE'), 'a-much-longer-secret-value'), false);
  } finally {
    crypto.timingSafeEqual = real;
  }
});
