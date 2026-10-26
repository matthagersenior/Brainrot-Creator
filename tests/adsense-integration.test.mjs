import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/_middleware.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const publisher = 'ca-pub-6958734306376288';

test('page includes both publisher verification and Auto ads loader', async () => {
  const html = await load('index.html');
  assert.ok(html.includes('name="google-adsense-account" content="' + publisher + '"'));
  assert.ok(html.includes('src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + publisher + '"'));
  assert.ok(html.indexOf('adsbygoogle.js') < html.indexOf('</head>'));
});

test('Cloudflare build packages ads.txt and smoke-tests its delivery', async () => {
  const workflow = await load('.github/workflows/static.yml');
  const ads = await load('ads.txt');
  assert.equal(ads.trim(), 'google.com, pub-6958734306376288, DIRECT, f08c47fec0942fa0');
  assert.ok(workflow.includes('sw.js ads.txt _headers .pages-dist/'));
  assert.ok(workflow.includes('AdSense integration, live ads.txt, and per-response nonce CSP passed'));
});

test('HTML edge response has fresh CSP nonce matching all scripts', async () => {
  const html = await load('index.html');
  const makeResponse = () => new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "script-src 'self'",
  } });
  const request = new Request('https://brainrot-creator.pages.dev/');
  const first = await onRequest({ request, next: async () => makeResponse() });
  const firstHtml = await first.text();
  const nonce = firstHtml.match(/<script nonce="([^"]+)" async src="https:\/\/pagead2/);
  assert.ok(nonce, 'AdSense loader should have a nonce');
  assert.ok(first.headers.get('content-security-policy').includes("script-src 'nonce-" + nonce[1] + "' 'strict-dynamic'"));
  assert.ok(firstHtml.includes('<script nonce="' + nonce[1] + '" type="module" src="./app.mjs"'));
  assert.ok(firstHtml.includes('<script nonce="' + nonce[1] + '" src="https://js.puter.com/v2/"'));
  assert.ok(first.headers.get('content-security-policy').includes("frame-src https:"));
  assert.ok(first.headers.get('content-security-policy').includes("object-src 'none'"));
  const second = await onRequest({ request, next: async () => makeResponse() });
  assert.notEqual(second.headers.get('content-security-policy'), first.headers.get('content-security-policy'));
});

test('API responses bypass HTML nonce injection', async () => {
  const original = new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
  const result = await onRequest({
    request: new Request('https://brainrot-creator.pages.dev/api/story'),
    next: async () => original,
  });
  assert.strictEqual(result, original);
});
