import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet as monetizationConfig } from '../functions/api/monetization-config.js';
import { onRequestPost as createCheckout } from '../functions/api/create-checkout.js';
import { onRequestGet as verifyCheckout } from '../functions/api/verify-checkout.js';

test('monetization config exposes launch pricing without leaking secrets', async () => {
  const response = await monetizationConfig({ env: {} });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.checkoutAvailable, false);
  assert.equal(data.freeDailyLimit, 3);
  assert.equal(data.offers.creator_monthly.amount, 5.99);
  assert.equal(data.offers.pack_5.amount, 1.99);
});

test('checkout endpoints fail closed until Stripe is configured', async () => {
  const request = new Request('https://example.com/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offer: 'creator_monthly', deviceId: 'brc-12345678' }),
  });
  const checkout = await createCheckout({ request, env: {} });
  assert.equal(checkout.status, 503);

  const verify = await verifyCheckout({
    request: new Request('https://example.com/api/verify-checkout?session_id=cs_test_123&device_id=brc-12345678'),
    env: {},
  });
  assert.equal(verify.status, 503);
});

test('app shell wires monetization before the main app and records watermark support', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(index.indexOf('./monetization.mjs') < index.indexOf('./app.mjs'));
  assert.match(app, /BrainrotMonetization\?\.drawWatermark/);
  assert.match(worker, /monetization\.mjs/);
  assert.match(worker, /monetization-core\.mjs/);
});
