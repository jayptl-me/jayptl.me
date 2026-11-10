import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const optimizer = path.join(root, 'scripts', 'optimize.js');

// optimize.js resolves its work dir from process.cwd(), so a throwaway dist in a
// temp directory is enough to run it against a planted file without touching the
// real build output.
function runWith(file, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jps-opt-'));
  try {
    // optimize.js walks dist/css, dist/js and the dist html files, and a missing
    // directory is an ENOENT that aborts the whole run. Without these the control
    // case fails for the wrong reason and the guard looks broken when the fixture
    // is what is short.
    for (const d of ['css', 'js']) fs.mkdirSync(path.join(dir, 'dist', d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html><title>t</title>');
    const target = path.join(dir, 'dist', ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
    const run = spawnSync(process.execPath, [optimizer], {
      cwd: dir, encoding: 'utf8', timeout: 120000,
    });
    return { code: run.status, out: `${run.stdout || ''}${run.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('optimize: a stylesheet the minifier refuses fails the build', () => {
  const r = runWith('css/broken.css', '.a { color: red;\n}}\n');
  assert.notEqual(r.code, 0,
    'a file that was never minified must not leave the build reporting success');
  assert.match(r.out, /broken\.css/, 'and it must name the file it refused');
});

test('optimize: the same run on a valid stylesheet still succeeds', () => {
  const r = runWith('css/fine.css', '.a { color: red; }\n');
  assert.equal(r.code, 0, `a clean stylesheet must pass, output was:\n${r.out.slice(-800)}`);
});
