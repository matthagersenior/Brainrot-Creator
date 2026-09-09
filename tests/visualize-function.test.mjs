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

async function captureMultipart(requestedInput) {
  assert.ok(requestedInput?.multipart?.body, 'FLUX.2 request must use multipart body');
  assert.match(requestedInput.multipart.contentType || '', /^multipart\/form-data;/);
  return new Response(requestedInput.multipart.body, {
    headers: { 'content-type': requestedInput.multipart.contentType },
  }).formData();
}

test('visualize endpoint uses FLUX.2 Klein with true vertical dimensions', async () => {
  let model = '';
  let form = null;
  const env = {
    AI: {
      async run(requestedModel, requestedInput) {
        model = requestedModel;
        form = await captureMultipart(requestedInput);
        return { image: 'ZmFrZS1qcGVnLWJ5dGVz' };
      },
    },
  };

  const response = await onRequestPost({ request: imageRequest(), env });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(model, '@cf/black-forest-labs/flux-2-klein-4b');
  assert.equal(form.get('width'), '576');
  assert.equal(form.get('height'), '1024');
  assert.match(String(form.get('prompt')), /realistic/i);
  assert.match(String(form.get('prompt')), /vertical/i);
  assert.match(body.dataURI, /^data:image\/jpeg;base64,/);
  assert.equal(body.source, 'cloudflare-flux-2-klein-4b');
});

test('visualize endpoint sends an optional scene-one reference image for identity continuity', async () => {
  let form = null;
  const env = {
    AI: {
      async run(_model, requestedInput) {
        form = await captureMultipart(requestedInput);
        return { image: 'ZmFrZS1yZWZlcmVuY2UtaW1hZ2U=' };
      },
    },
  };

  const referenceDataURI = 'data:image/jpeg;base64,ZmFrZS1zbWFsbC1yZWZlcmVuY2U=';
  const response = await onRequestPost({
    request: imageRequest({ referenceDataURI }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(form.get('input_image_0'), 'reference image must be included in multipart input');
  assert.match(String(form.get('prompt')), /reference/i);
  assert.equal(body.referenceUsed, true);
});

test('visualize endpoint fails safely when Workers AI binding is unavailable', async () => {
  const response = await onRequestPost({ request: imageRequest(), env: {} });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, 'VISUAL_AI_NOT_CONFIGURED');
});
