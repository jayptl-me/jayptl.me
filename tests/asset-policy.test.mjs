// Unit tests for the asset publish policy in scripts/asset-policy.js. These
// run against the policy itself, not dist, so they hold even before a build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ships } = require('../scripts/asset-policy.js');

test('asset policy: whole directories that are meant to ship', () => {
  assert.ok(ships('fonts/space-grotesk-400.woff2'));
  assert.ok(ships('resumes/fde.pdf'));
  assert.ok(ships('resumes/resume.json'));
  assert.ok(ships('data/commits.json'));
});

test('asset policy: named root files ship, unnamed ones do not', () => {
  assert.ok(ships('favicon.ico'));
  assert.ok(ships('android-chrome-512x512.png'));
  assert.ok(ships('logo-1024.png'));
  assert.ok(ships('doodle-sprite.svg'));
  // icon-sprite.svg sits at the root of assets/ and no page references it.
  assert.equal(ships('icon-sprite.svg'), false);
});

test('asset policy: project imagery is per filename, not per folder', () => {
  assert.ok(ships('case-studies/aviz-health/hero.jpg'));
  assert.ok(ships('case-studies/aviz-health/cover-desktop-480.jpg'));
  assert.ok(ships('projects/thhiya/cover-phone.jpg'));
  // The same folders hold review screenshots that no page links.
  assert.equal(ships('case-studies/aviz-health/gallery/desktop-01.jpg'), false);
  assert.equal(ships('case-studies/aviz-health/08-admin-verify-partners.png'), false);
  assert.equal(ships('projects/whyknot/notes.txt'), false);
});

test('asset policy: a new folder stays unpublished until it is named', () => {
  // Negative control for the whole file. The old build copied assets/
  // wholesale, so anything dropped in went public without anyone deciding it.
  assert.equal(ships('screenshots/yesterday/desktop-01.png'), false);
  assert.equal(ships('icons/home.svg'), false);
  assert.equal(ships(''), false);
  assert.equal(ships('   '), false);
});
