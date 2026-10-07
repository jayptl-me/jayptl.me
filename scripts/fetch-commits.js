#!/usr/bin/env node

/**
 * Commit Field snapshot: saves the last 12 months of public GitHub
 * contributions for one account to assets/data/commits.json, so the site
 * never calls GitHub from the browser and the CSP stays 'self'.
 *
 * Reads the public contributions page (no token). Never fails a build:
 * on any network or parse problem it keeps the existing snapshot and
 * exits 0 with a warning.
 *
 * Usage: node scripts/fetch-commits.js [account]
 *
 * @author Jay Patel
 */

const fs = require('fs');
const path = require('path');

const ACCOUNT = process.argv[2] || 'jayptl-me';
const OUT = path.join(process.cwd(), 'assets', 'data', 'commits.json');
const URL_BASE = 'https://github.com/users/';
const TIMEOUT_MS = 15000;

function warn(msg) {
  console.log(`[WARN] commits: ${msg}, keeping the existing snapshot`);
}

/** Parse the contributions page into ordered { date, count, level } days. */
function parse(html) {
  const days = new Map();
  const cell = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="(contribution-day-component-\d+-\d+)"[^>]*data-level="(\d)"/g;
  let m;
  const byId = new Map();
  while ((m = cell.exec(html))) {
    byId.set(m[2], { date: m[1], level: Number(m[3]), count: 0 });
  }
  const tip = /<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g;
  while ((m = tip.exec(html))) {
    const day = byId.get(m[1]);
    if (!day) continue;
    const n = /^([\d,]+) contributions?/.exec(m[2].trim());
    day.count = n ? Number(n[1].replace(/,/g, '')) : 0;
  }
  byId.forEach((d) => days.set(d.date, d));
  return Array.from(days.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Longest and current run of days with at least one contribution. */
function streaks(days) {
  let longest = 0;
  let run = 0;
  days.forEach((d) => {
    run = d.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  });
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current++;
    else if (i === days.length - 1) continue; // today may not have a commit yet
    else break;
  }
  return { longest, current };
}

async function main() {
  let html;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(URL_BASE + encodeURIComponent(ACCOUNT) + '/contributions', {
      headers: { Accept: 'text/html', 'User-Agent': 'jayptl.me build' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return warn(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return warn(e.message);
  }

  const days = parse(html);
  if (days.length < 300) return warn(`only ${days.length} days parsed`);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const { longest, current } = streaks(days);

  const snapshot = {
    account: ACCOUNT,
    generatedAt: new Date().toISOString(),
    from: days[0].date,
    to: days[days.length - 1].date,
    total,
    longestStreak: longest,
    currentStreak: current,
    // One entry per day, oldest first: [count, level 0-4]
    days: days.map((d) => [d.count, d.level])
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snapshot) + '\n');
  console.log(`[OK] commits: ${total} contributions ${snapshot.from} to ${snapshot.to}, longest streak ${longest} days`);
}

if (require.main === module) {
  main();
}

module.exports = { parse, streaks };
