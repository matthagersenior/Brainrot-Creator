import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/story.js';

test('story endpoint uses Gemini 3.6 Flash for new API users', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    const scenes = Array.from({ length: 8 }, (_, index) => ({
      text: `Scene ${index + 1} has enough harmless brainrot words for this provider contract test today.`,
      emoji: '🧠',
      color: '#ff2ec4',
      burst: 'TEST ROT',
    }));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ scenes }) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const request = new Request('https://example.test/api/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'frog at the DMV' }),
    });

    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: 'test-key' } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(requestedUrl, /models\/gemini-3\.6-flash:generateContent$/);
    assert.equal(body.source, 'gemini-3.6-flash');
    assert.equal(body.scenes.length, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
