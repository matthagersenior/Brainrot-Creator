import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/visualize.js';

function imageRequest(body = {}) {
  return new Request('https://example.test/api/visualize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      visualPrompt: 'A cursed realistic frog waiting inside an American DMV, vertical social video frame.',
      style: 'cursed-real',
      seed: 42,
      ...body,
    }),
  });
}

test('visualize endpoint uses Cloudflare FLUX and returns a data URI', async () => {
  let model = '';
  let input = null;
  const env = {
    AI: {
      async run(requestedModel, requestedInput) {
        model = requestedModel;
        input = requestedInput;
        return { image: 'ZmFrZS1qcGVnLWJ5dGVz' };
      },
    },
  };

  const response = await onRequestPost({ request: imageRequest(), env });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(model, '@cf/black-forest-labs/flux-1-schnell');
  assert.equal(Object.hasOwn(input, 'seed'), false, 'FLUX input must not include unsupported seed');
  assert.equal(body.seed, 42, 'seed may remain response metadata for client bookkeeping');
  assert.match(input.prompt, /realistic/i);
  assert.match(input.prompt, /vertical/i);
  assert.match(body.dataURI, /^data:image\/jpeg;base64,/);
  assert.equal(body.source, 'cloudflare-flux-1-schnell');
});

test('visualize endpoint fails safely when Workers AI binding is unavailable', async () => {
  const response = await onRequestPost({ request: imageRequest(), env: {} });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, 'VISUAL_AI_NOT_CONFIGURED');
});
