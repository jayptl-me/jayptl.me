'use strict';

/**
 * Asset publish policy.
 *
 * `assets/` used to be copied into dist wholesale, so every screenshot and
 * icon that happened to land there went public on the live domain. 161 of them
 * were referenced by nothing, three of them were admin screens holding other
 * people's phone numbers and business totals.
 *
 * Only what this file names is shipped. A new asset stays on disk until it is
 * added here, and tests/artifacts.test.mjs fails the build if any built page
 * references an asset this policy does not publish.
 */

// Whole directories: everything inside ships.
const ASSET_DIRS = ['fonts', 'resumes', 'data'];

// Loose files at the root of assets/.
const ASSET_FILES = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'logo-512.png',
  'logo-1024.png',
  'doodle-sprite.svg'
];

// Per-project imagery: these filenames only, at any depth under these
// directories. The same directories also hold review screenshots, which is why
// this is a filename list and not a directory list.
const ASSET_IMAGE_DIRS = ['case-studies', 'projects'];
const ASSET_IMAGE_FILES = [
  'hero.jpg',
  'card-cover.jpg',
  'cover-desktop.jpg',
  'cover-desktop-480.jpg',
  'cover-phone.jpg'
];

function ships(relPath) {
  const parts = String(relPath).split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return false;
  const head = parts[0];
  if (parts.length === 1) return ASSET_FILES.includes(head);
  if (ASSET_DIRS.includes(head)) return true;
  if (ASSET_IMAGE_DIRS.includes(head)) return ASSET_IMAGE_FILES.includes(parts[parts.length - 1]);
  return false;
}

module.exports = {
  ships,
  ASSET_DIRS,
  ASSET_FILES,
  ASSET_IMAGE_DIRS,
  ASSET_IMAGE_FILES
};
