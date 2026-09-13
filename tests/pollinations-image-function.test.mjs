import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/pollinations-image.js';

function request(body = {}) {
  return new Request('https://example.test/api/pollinations-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      visualPrompt: 'photorealistic protagonist lost in an Ohio cornfield at dusk, no text',
      seed: 1234,
      model: 'flux',
      ...body,
    }),
  });
}

test('Pollinations fallback requests a high-resolution anonymous FLUX frame and returns data URI', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.fetch = async url => {
    calledUrl = String(url);
    return new Response(new Uint8Array(12_000).fill(7), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  };

  try {
    const response = await onRequestPost({ request: request() });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(calledUrl, /^https:\/\/image\.pollinations\.ai\/prompt\//);
    assert.match(calledUrl, /model=flux/);
    assert.match(calledUrl, /width=576/);
    assert.match(calledUrl, /height=1024/);
    assert.match(calledUrl, /enhance=true/);
    assert.match(body.dataURI, /^data:image\/jpeg;base64,/);
    assert.equal(body.source, 'Pollinations · FLUX');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pollinations fallback permits Z-Image as second quality provider and rejects empty prompts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /model=zimage/);
    return new Response(new Uint8Array(12_000).fill(8), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    });
  };
  try {
    const ok = await onRequestPost({ request: request({ model: 'zimage' }) });
    assert.equal(ok.status, 200);
    const bad = await onRequestPost({ request: request({ visualPrompt: '' }) });
    assert.equal(bad.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
