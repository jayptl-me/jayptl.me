// Unit tests for RFC 9110 Accept parsing / negotiation (acceptmarkdown.com).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseAccept, negotiate, prefersJson } = require('../scripts/server.js');

const reps = [
  { contentType: 'text/html', file: 'a.html' },
  { contentType: 'text/markdown', file: 'a.md' }
];

test('parseAccept: splits ranges and reads q-values', () => {
  const ranges = parseAccept('text/html;q=0.9, text/markdown;q=0.5, */*;q=0.1');
  assert.deepEqual(
    ranges.map(r => [r.type + '/' + r.subtype, r.q]),
    [['text/html', 0.9], ['text/markdown', 0.5], ['*/*', 0.1]]
  );
});

test('parseAccept: missing q defaults to 1', () => {
  const [range] = parseAccept('text/markdown');
  assert.equal(range.q, 1);
});

test('parseAccept: empty or absent header yields no ranges', () => {
  assert.equal(parseAccept('').length, 0);
  assert.equal(parseAccept(undefined).length, 0);
});

test('negotiate: no Accept header serves the default representation', () => {
  assert.equal(negotiate(undefined, reps).contentType, 'text/html');
});

test('negotiate: Accept: text/markdown serves markdown', () => {
  assert.equal(negotiate('text/markdown', reps).contentType, 'text/markdown');
});

test('negotiate: browser Accept (with */*) serves HTML', () => {
  const browser = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
  assert.equal(negotiate(browser, reps).contentType, 'text/html');
});

test('negotiate: honors q-values when both types are acceptable', () => {
  assert.equal(negotiate('text/html;q=0.5, text/markdown;q=0.9', reps).contentType, 'text/markdown');
  assert.equal(negotiate('text/markdown;q=0.4, text/html;q=0.8', reps).contentType, 'text/html');
});

test('negotiate: q=0 explicitly excludes a representation', () => {
  assert.equal(negotiate('text/markdown, text/html;q=0', reps).contentType, 'text/markdown');
  assert.equal(negotiate('text/html, text/markdown;q=0', reps).contentType, 'text/html');
});

test('negotiate: wildcard-only Accept serves the default representation', () => {
  assert.equal(negotiate('*/*', reps).contentType, 'text/html');
});

test('negotiate: specificity breaks q ties (exact beats wildcard)', () => {
  // Both types ride the */* wildcard at q=0.6; only markdown has an exact
  // range, so the exact range wins the tie.
  assert.equal(negotiate('*/*;q=0.6, text/markdown;q=0.6', reps).contentType, 'text/markdown');
});

test('negotiate: returns null (406) when nothing satisfies the header', () => {
  assert.equal(negotiate('application/xml', reps), null);
  assert.equal(negotiate('text/html;q=0, text/markdown;q=0', reps), null);
});

test('prefersJson: true only when json outranks html', () => {
  assert.equal(prefersJson('application/json'), true);
  assert.equal(prefersJson(undefined), false);
  assert.equal(prefersJson('*/*'), false);
  assert.equal(prefersJson('text/html'), false);
  assert.equal(prefersJson('application/json;q=0.9, text/html;q=0.5'), true);
  assert.equal(prefersJson('application/json;q=0.5, text/html;q=0.9'), false);
});
