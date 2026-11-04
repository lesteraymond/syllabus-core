'use strict';
const dns = require('node:dns');
const https = require('node:https');
const http = require('node:http');
const net = require('node:net');
const reserved6 = new net.BlockList();
reserved6.addSubnet('2001::', 23, 'ipv6');
reserved6.addSubnet('2001:db8::', 32, 'ipv6');
reserved6.addSubnet('2002::', 16, 'ipv6');
reserved6.addSubnet('3fff::', 20, 'ipv6');

// Resolve at connection time and reject the entire answer if any address is private.
// Redirects are deliberately not followed: the configured policy penalizes them.
function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Only global-unicast IPv6; IPv4-mapped, loopback, ULA, link local and multicast fail.
  return net.isIP(address) === 6 && /^[23]/i.test(address) && !reserved6.check(address, 'ipv6');
}
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return callback(new Error('Non-public address refused'));
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}
// What a page is about, for the advisory "does this reference fit the learning plan" judgement: its title and the opening text,
// with scripts, styles and markup removed. Bounded, and never shown as HTML anywhere.
const PAGE_BYTES = 200000;
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const plain = text => text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m]).replace(/\s+/g, ' ').trim();
function pageSummary(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const body = html.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return { title: plain(title).slice(0, 200), text: plain(body).slice(0, 1500) };
}
// How a status line counts. A redirect is penalized (the address has moved), except from a DOI resolver: a DOI is a permanent identifier
// whose whole job is to redirect to the publisher, so a working DOI always answers 3xx. A DOI that does not exist still answers 404.
const DOI_HOSTS = new Set(['doi.org', 'www.doi.org', 'dx.doi.org']);
function verdictOf(hostname, code) {
  if (code === 200) return 'ok';
  if (code >= 300 && code < 400) return DOI_HOSTS.has(String(hostname).toLowerCase()) ? 'ok' : 'redirected';
  return code === 404 || code === 410 ? 'broken' : 'unverifiable';
}
function checkUrl(raw, { timeoutMs = 8000 } = {}) {
  return new Promise(finish => {
    let settled = false;
    const resolve = result => { if (!settled) { settled = true; finish(result); } };
    let url;
    let seen = null; // the verdict from the status line; a stalled or failed body read afterwards must not change it
    try {
      url = new URL(raw);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        (url.port && !['80', '443'].includes(url.port)) ||
        (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !publicAddress(url.hostname.replace(/^\[|\]$/g, '')))) throw Error('Unsafe URL refused');
    } catch (error) { return resolve({ url: raw, status: 'unverifiable', reason: error.message }); }
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      lookup: safeLookup, agent: false, headers: { 'User-Agent': 'SyllabusLinkChecker/1.0' },
    }, response => {
      const code = response.statusCode;
      const result = { url: raw, httpStatus: code, status: verdictOf(url.hostname, code), reason: `HTTP ${code}` };
      seen = result;
      if (code !== 200 || !/text\/html/i.test(String(response.headers['content-type'] || ''))) { response.destroy(); return resolve(result); }
      // Read a bounded amount of an HTML page for its summary; the status above is already decided and is not changed by the read.
      const chunks = [];
      let size = 0;
      const done = () => { resolve({ ...result, page: pageSummary(Buffer.concat(chunks).toString('utf8')) }); response.destroy(); };
      response.on('data', chunk => { chunks.push(chunk); size += chunk.length; if (size >= PAGE_BYTES) done(); });
      response.on('end', done);
      response.on('close', done);
      response.on('error', () => resolve(result));
    });
    const timer = setTimeout(() => request.destroy(new Error('Link check timed out')), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', error => resolve(seen || { url: raw, status: error.code === 'ENOTFOUND' ? 'broken' : 'unverifiable', reason: error.message }));
  });
}
function urlsOf(content) {
  return [...new Set(Object.values(content.refs || {}).flatMap(group => (group.items || []).flatMap(item =>
    [...String(item.t || '').matchAll(/https?:\/\/[^\s<>"\]]+/gi)].map(m => m[0].replace(/[.,;)]*$/, '')))))];
}
async function checkLinks(content, checker = checkUrl) {
  const urls = urlsOf(content);
  const results = [];
  // Bounded concurrency and count; a truncated check cannot enable submission.
  for (let i = 0; i < Math.min(urls.length, 60); i += 4) results.push(...await Promise.all(urls.slice(i, Math.min(i + 4, 60)).map(url => checker(url))));
  if (urls.length > 60) results.push({ status: 'unverifiable', reason: 'More than 60 unique reference URLs; reduce the list or review the remaining URLs.' });
  return results;
}
module.exports = { publicAddress, checkUrl, checkLinks, urlsOf, pageSummary, verdictOf };
