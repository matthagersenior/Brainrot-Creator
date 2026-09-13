import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/horde-image.js';

function req(body = {}) {
  return new Request('https://example.test/api/horde-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      visualPrompt: 'cinematic frog at a DMV, vertical 9:16',
      seed: 42,
      ...body,
    }),
  });
}

test('anonymous AI Horde fallback submits, polls, localizes, and returns an image', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.endsWith('/generate/async')) {
      return new Response(JSON.stringify({ id: 'job-1' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    if (u.endsWith('/generate/check/job-1')) {
      return new Response(JSON.stringify({ done: true, finished: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.endsWith('/generate/status/job-1')) {
      return new Response(JSON.stringify({ generations: [{ img: 'ZmFrZS13ZWJw', model: 'Test XL' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected URL ${u}`);
  };

  try {
    const response = await onRequestPost({
      request: req(),
      env: { HORDE_TIMEOUT_MS: '5000', HORDE_POLL_INTERVAL_MS: '250' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.dataURI, /^data:image\/webp;base64,/);
    assert.match(body.source, /AI Horde/);
    assert.equal(body.model, 'Test XL');

    const submit = calls.find(call => call.url.endsWith('/generate/async'));
    assert.equal(submit.init.headers.get('apikey'), '0000000000');
    const submittedBody = JSON.parse(submit.init.body);
    assert.equal(submittedBody.nsfw, false);
    assert.equal(submittedBody.params.width, 320);
    assert.equal(submittedBody.params.height, 576);
    assert.equal(submittedBody.params.steps, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('anonymous AI Horde fallback rejects empty prompts', async () => {
  const response = await onRequestPost({ request: req({ visualPrompt: '' }), env: {} });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'VISUAL_PROMPT_REQUIRED');
});


test('proven image broker route serves high-resolution Pollinations FLUX without creating a new Pages route', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.fetch = async url => {
    calledUrl = String(url);
    return new Response(new Uint8Array(12_000).fill(9), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  };

  try {
    const response = await onRequestPost({
      request: req({ provider: 'pollinations', model: 'flux' }),
      env: {},
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(calledUrl, /^https:\/\/image\.pollinations\.ai\/prompt\//);
    assert.match(calledUrl, /model=flux/);
    assert.match(calledUrl, /width=576/);
    assert.match(calledUrl, /height=1024/);
    assert.equal(body.source, 'Pollinations · FLUX');
    assert.match(body.dataURI, /^data:image\/jpeg;base64,/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
