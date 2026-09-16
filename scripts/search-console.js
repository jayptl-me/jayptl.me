#!/usr/bin/env node

/**
 * Google Search Console & Site Verification CLI for jayptl.me
 * Uses the dedicated service account created in project jayptl-me ("who-am-i")
 *
 * Commands:
 *   bun scripts/search-console.js status
 *   bun scripts/search-console.js token [meta|file]
 *   bun scripts/search-console.js verify [meta|file]
 *   bun scripts/search-console.js inspect <url>
 *   bun scripts/search-console.js sitemaps
 *   bun scripts/search-console.js submit-sitemap [url]
 *   bun scripts/search-console.js analytics [days]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_PATH = process.env.GSC_KEY_PATH || path.join(process.env.HOME, '.config/gcloud/portfolio-search-console-key.json');

async function getAccessToken() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`Service account key not found at: ${KEY_PATH}`);
  }

  const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/siteverification',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const signature = sign.sign(key.private_key, 'base64url');
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to obtain Google access token: ${JSON.stringify(data)}`);
  }
  return { token: data.access_token, email: key.client_email };
}

async function listSites(token) {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function addSite(token, siteUrl) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function getVerificationToken(token, method = 'META', identifier = 'https://jayptl.me/') {
  const res = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verificationMethod: method.toUpperCase(),
      site: {
        type: 'SITE',
        identifier,
      },
    }),
  });
  return res.json();
}

async function verifySite(token, method = 'META', identifier = 'https://jayptl.me/') {
  const res = await fetch(`https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=${method.toUpperCase()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: {
        type: 'SITE',
        identifier,
      },
    }),
  });
  return res.json();
}

async function inspectUrl(token, inspectionUrl, siteUrl = 'sc-domain:jayptl.me') {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
    }),
  });
  return res.json();
}

async function listSitemaps(token, siteUrl = 'sc-domain:jayptl.me') {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function submitSitemap(token, feedpath = 'https://jayptl.me/sitemap.xml', siteUrl = 'sc-domain:jayptl.me') {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function deleteSitemap(token, feedpath, siteUrl = 'sc-domain:jayptl.me') {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function main() {
  const command = process.argv[2] || 'status';

  try {
    const { token, email } = await getAccessToken();

    if (command === 'status') {
      console.log(`\n🔑 Authenticated as: ${email}\n`);
      const sites = await listSites(token);
      if (!sites.siteEntry || sites.siteEntry.length === 0) {
        console.log('⚠️  No properties found in account. Registering defaults...');
        await addSite(token, 'https://jayptl.me/');
        await addSite(token, 'sc-domain:jayptl.me');
        console.log('Properties added: https://jayptl.me/ and sc-domain:jayptl.me');
      } else {
        console.log('✅ Connected Search Console properties:');
        for (const entry of sites.siteEntry) {
          const isVerified = entry.permissionLevel !== 'siteUnverifiedUser';
          const icon = isVerified ? '🟢' : '🟡';
          console.log(`   ${icon} ${entry.siteUrl} (Permission: ${entry.permissionLevel})`);
        }
      }
      console.log('\n💡 Tip: To grant full Owner permissions, either:');
      console.log('  1. In GSC UI (search.google.com): Add this service account as Owner in Settings -> Users.');
      console.log('  2. Or run: bun scripts/search-console.js verify meta (after deploying the meta tag).\n');
    } else if (command === 'token') {
      const method = (process.argv[3] || 'meta').toUpperCase();
      console.log(`\nFetching ${method} verification token for https://jayptl.me/...\n`);
      const result = await getVerificationToken(token, method);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'verify') {
      const method = (process.argv[3] || 'meta').toUpperCase();
      console.log(`\nVerifying https://jayptl.me/ via ${method}...\n`);
      const result = await verifySite(token, method);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'inspect') {
      const url = process.argv[3] || 'https://jayptl.me/';
      const siteUrl = process.argv[4] || 'sc-domain:jayptl.me';
      console.log(`\n🔍 Inspecting URL: ${url} (Site: ${siteUrl})...\n`);
      const result = await inspectUrl(token, url, siteUrl);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'sitemaps') {
      const siteUrl = process.argv[3] || 'sc-domain:jayptl.me';
      const sitemaps = await listSitemaps(token, siteUrl);
      console.log(JSON.stringify(sitemaps, null, 2));
    } else if (command === 'submit-sitemap') {
      const sitemapUrl = process.argv[3] || 'https://jayptl.me/sitemap.xml';
      const siteUrl = process.argv[4] || 'sc-domain:jayptl.me';
      console.log(`Submitting sitemap ${sitemapUrl} to ${siteUrl}...`);
      const status = await submitSitemap(token, sitemapUrl, siteUrl);
      console.log(`Response status: ${status} ${status === 204 ? '(Success)' : ''}`);
    } else if (command === 'delete-sitemap') {
      const sitemapUrl = process.argv[3];
      if (!sitemapUrl) {
        throw new Error('Please provide the sitemap URL to delete: bun scripts/search-console.js delete-sitemap <url> [siteUrl]');
      }
      const siteUrl = process.argv[4] || 'sc-domain:jayptl.me';
      console.log(`Deleting sitemap ${sitemapUrl} from ${siteUrl}...`);
      const status = await deleteSitemap(token, sitemapUrl, siteUrl);
      console.log(`Response status: ${status} ${status === 204 ? '(Success)' : ''}`);
    } else {
      console.log(`Unknown command: ${command}`);
      console.log('Available commands: status, token [meta|file], verify [meta|file], inspect <url>, sitemaps, submit-sitemap, delete-sitemap <url>');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
