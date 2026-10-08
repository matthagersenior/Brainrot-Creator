import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = name => readFile(new URL(name, root), 'utf8');

test('monetization styles load through the approved local stylesheet instead of blocked inline CSS', async () => {
  const [script, css, headers] = await Promise.all([
    source('monetization.mjs'),
    source('styles.css'),
    source('_headers'),
  ]);
  assert.match(headers, /style-src 'self'/);
  assert.doesNotMatch(script, /document\.createElement\(['"]style['"]\)/);
  assert.match(css, /\.money-dialog\s*\{/);
  assert.match(css, /\.money-dialog::backdrop/);
  assert.match(css, /\.money-packs\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /max-height:\s*min\(760px, calc\(100dvh - 24px\)\)/);
});

test('GET MORE click cannot print [object PointerEvent] in the purchase dialog', async () => {
  const script = await source('monetization.mjs');
  assert.match(script, /button\.addEventListener\('click',\s*\(\)\s*=>\s*openDialog\(\)\)/);
  assert.doesNotMatch(script, /button\.addEventListener\('click',\s*openDialog\)/);
  assert.match(script, /typeof message === 'string' \? message : ''/);
  assert.match(script, /dialog && !dialog\.open/);
  assert.match(script, /aria-labelledby/);
});

test('purchase return and recovery keep entitlement verification recoverable', async () => {
  const script = await source('monetization.mjs');
  assert.match(script, /brainrot\.monetization\.pending-checkout\.v1/);
  assert.match(script, /async function verifyPendingPurchase\(\)/);
  assert.match(script, /savePending\(sessionId\)/);
  assert.match(script, /clearPending\(\)/);
  assert.match(script, /result\.kind === 'creator' && !result\.active/);
  assert.match(script, /session_id.*device_id|device_id: deviceId/);
  assert.match(script, /billing\.grantIds\.includes\(result\.grantId\)/);
  assert.match(script, /checkoutBusy = true/);
  assert.match(script, /checkoutUrl\.hostname !== 'checkout\.stripe\.com'/);
});

test('index has no escaped script delimiter and new app shell cache refreshes purchases UI', async () => {
  const [html, sw] = await Promise.all([source('index.html'), source('sw.js')]);
  assert.doesNotMatch(html, /<\/script>\\n\s*<script/);
  assert.match(html, /<script type="module" src="\.\/monetization\.mjs"><\/script>\n\s*<script type="module" src="\.\/app\.mjs">/);
  assert.match(sw, /rot-machine-shell-v15/);
});
