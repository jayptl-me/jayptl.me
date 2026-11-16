// The live host serves every file in dist. Config files meant for other hosts
// (.htaccess, _headers, _redirects, .nojekyll, CNAME) and build-info.json told
// any visitor how the site is built (16 Nov 2026: all five answered 200 on
// jayptl.me). The last step of deploy:prepare removes them, after the build,
// the minifier and validate have used them. Everything else must stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { prunePublic, NOT_PUBLIC } = require('../scripts/prune-public.js');

function fakeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-'));
  const keep = ['index.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'humans.txt', 'security.txt', 'pages/404.html'];
  for (const f of [...NOT_PUBLIC, ...keep]) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), 'x');
  }
  return { dir, keep };
}

test('prune: removes every host config file and build-info.json from dist', () => {
  const { dir } = fakeDist();
  prunePublic(dir);
  const left = NOT_PUBLIC.filter((f) => fs.existsSync(path.join(dir, f)));
  assert.ok(left.length === 0, `still published: ${left.join(', ')}`);
});

test('prune: keeps every page and public text file', () => {
  const { dir, keep } = fakeDist();
  prunePublic(dir);
  const gone = keep.filter((f) => !fs.existsSync(path.join(dir, f)));
  assert.ok(gone.length === 0, `removed by mistake: ${gone.join(', ')}`);
});

test('prune: the list names the five files that leaked plus build-info.json', () => {
  for (const f of ['.htaccess', '_headers', '_redirects', '.nojekyll', 'CNAME', 'build-info.json']) {
    assert.ok(NOT_PUBLIC.includes(f), `${f} missing from NOT_PUBLIC`);
  }
});

test('prune, negative control: a prune that removes nothing is caught', () => {
  const { dir } = fakeDist();
  const left = NOT_PUBLIC.filter((f) => fs.existsSync(path.join(dir, f)));
  assert.ok(left.length === NOT_PUBLIC.length, 'the check above would not have failed');
});

test('prune: deploy:prepare ends with the prune, and test:deploy tests the unpruned build', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(/node scripts\/prune-public\.js\s*$/.test(pkg.scripts['deploy:prepare']), 'deploy:prepare must end with the prune');
  assert.ok(!/prune-public/.test(pkg.scripts['test:deploy']), 'test:deploy must not prune before the tests read dist');
});
