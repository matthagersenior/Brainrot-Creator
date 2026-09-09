import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/story.js';

function successfulGeminiResponse() {
  const scenes = Array.from({ length: 8 }, (_, index) => ({
    text: `Scene ${index + 1} has enough harmless brainrot words for this provider contract test today.`,
    color: '#ff2ec4',
    burst: 'TEST ROT',
    subject: 'the same realistic frog',
    setting: 'an American DMV',
    action: 'waiting for a number to be called',
    camera: 'vertical handheld medium shot',
    mood: 'deadpan absurdity',
    visualPrompt: 'Photoreal frog waiting inside a DMV, vertical 9:16, no text.',
  }));
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      continuity: {
        subject: 'realistic frog',
        appearance: 'green skin and office tie',
        world: 'American DMV',
        props: 'paper ticket',
      },
      scenes,
    }) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function invalidJsonGeminiResponse() {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"scenes":[' }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function storyRequest() {
  return new Request('https://example.test/api/story', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'frog at the DMV', visualStyle: 'cursed-real' }),
  });
}

test('story endpoint prefers Gemini 3.1 Flash-Lite for fast structured stories', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return successfulGeminiResponse();
  };

  try {
    const response = await onRequestPost({ request: storyRequest(), env: { GEMINI_API_KEY: 'test-key' } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(requestedUrl, /models\/gemini-3\.1-flash-lite:generateContent$/);
    assert.equal(body.source, 'gemini-3.1-flash-lite');
    assert.equal(body.scenes.length, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story endpoint falls back to Gemini 3.6 Flash when Flash-Lite has a retryable provider failure', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (requestedUrls.length === 1) {
      return new Response(JSON.stringify({
        error: { code: 503, status: 'UNAVAILABLE', message: 'High demand' },
      }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    return successfulGeminiResponse();
  };

  try {
    const response = await onRequestPost({ request: storyRequest(), env: { GEMINI_API_KEY: 'test-key' } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      requestedUrls.map(url => new URL(url).pathname),
      [
        '/v1beta/models/gemini-3.1-flash-lite:generateContent',
        '/v1beta/models/gemini-3.6-flash:generateContent',
      ],
    );
    assert.equal(body.source, 'gemini-3.6-flash');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('story endpoint falls back when a model returns HTTP 200 with malformed JSON', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return requestedUrls.length === 1 ? invalidJsonGeminiResponse() : successfulGeminiResponse();
  };

  try {
    const response = await onRequestPost({ request: storyRequest(), env: { GEMINI_API_KEY: 'test-key' } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      requestedUrls.map(url => new URL(url).pathname),
      [
        '/v1beta/models/gemini-3.1-flash-lite:generateContent',
        '/v1beta/models/gemini-3.6-flash:generateContent',
      ],
    );
    assert.equal(body.source, 'gemini-3.6-flash');
    assert.equal(body.scenes.length, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
