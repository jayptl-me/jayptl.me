#!/usr/bin/env node
/**
 * One-time Google sign-in that prints a refresh token for GOOGLE_REFRESH_TOKEN.
 *
 * Run it on your own machine, never on the server:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-auth.mjs
 *
 * It opens a loopback server on 127.0.0.1, prints a Google consent URL,
 * and after you approve it exchanges the code for tokens. Your OAuth
 * client must be a "Desktop app" client, and the consent screen must be
 * published "In production" (Testing-mode refresh tokens expire in 7 days).
 */

import http from 'node:http';
import crypto from 'node:crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400).end('State mismatch, start again.');
    return;
  }
  const code = url.searchParams.get('code');
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    })
  });
  const data = await tokenRes.json();
  if (!data.refresh_token) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('No refresh token returned. Remove the app from your Google account access page and run this again.');
    console.error(data);
    server.close();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done. Go back to the terminal.');
  console.log('\nGOOGLE_REFRESH_TOKEN=' + data.refresh_token + '\n');
  console.log('Put it in your Render environment. Do not commit it.');
  server.close();
});

server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  console.log('Open this URL in your browser and approve:\n\n' + auth.toString() + '\n');
});
