'use strict';

const net = require('node:net');

/**
 * Client IP for rate limits only, never stored or logged.
 *
 * Only what a visitor cannot write may decide it:
 *
 * - X-Forwarded-For is APPENDED to by each proxy, so everything a visitor
 *   sends sits at the front of the list. The entry the host's own proxy
 *   added is counted from the right: FORWARDED_HOPS (default 1) is how
 *   many proxies in front of the service append to it. Too small a number
 *   gives a proxy's address (limits get stricter); it never gives the
 *   visitor a way around them.
 * - The edge network's connecting-IP header is honest only when every
 *   request passes through that edge and it overwrites the header. That
 *   holds behind our own proxied domain once the host's default address
 *   is switched off, so it is used only when TRUST_EDGE_IP=true.
 * - The true-client-ip header is never read: on a free edge plan nothing
 *   overwrites it, so a visitor can set it.
 *
 * An IPv6 address is keyed by its /64: one home network holds 2^64
 * addresses, and rotating among them must not reset any limit.
 */
const EDGE_HEADER = 'cf-connecting-ip';

function forwardedList(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** The limit key for an address: IPv4 as is, IPv6 as its /64. */
function limitKey(ip) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (net.isIP(ip) !== 6) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = left.concat(Array(8 - left.length - right.length).fill('0'), right);
  return full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

function clientIp(req, { trustEdge = false, hops = 1 } = {}) {
  if (trustEdge) {
    const edge = String(req.headers[EDGE_HEADER] || '').trim();
    if (edge && net.isIP(edge)) return limitKey(edge);
  }
  const list = forwardedList(req);
  const pick = list[list.length - hops];
  if (pick && net.isIP(pick)) return limitKey(pick);
  return limitKey(req.socket.remoteAddress || 'unknown');
}

module.exports = { clientIp, limitKey, forwardedList, EDGE_HEADER };
