import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/narrate.js';

function narrationRequest(body = {}) {
  return new Request('https://example.test/api/narrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'The frog entered the DMV and the room went completely silent.',
      visualStyle: 'cinematic',
      moods: ['ominous', 'deadpan', 'triumphant'],
      ...body,
    }),
  });
}

function interactionTtsResponse() {
  return new Response(JSON.stringify({
    output_audio: {
      data: 'AAECAwQFBgcICQoLDA0ODw==',
      mime_type: 'audio/l16',
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function legacyTtsResponse() {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          inlineData: { data: 'ZmFrZS1wY20tYXVkaW8=' },
        }],
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('narration prefers Gemini 3.8 expressive TTS and keeps style directions out of spoken text', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedBody = null;

  globalThis.fetch = async (url, init = {}) => {
    requestedUrl = String(url);
    requestedBody = JSON.parse(String(init.body || '{}'));
    return interactionTtsResponse();
  };

  try {
    const response = await onRequestPost({
      request: narrationRequest(),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestedUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(requestedBody.model, 'gemini-3.8-flash-tts');
    assert.equal(requestedBody.response_format.mime_type, 'audio/l16');
    assert.equal(requestedBody.response_format.sample_rate, 24000);
    assert.equal(body.source, 'gemini-3.8-flash-tts');
    assert.equal(body.voiceMode, 'narrator');
    assert.equal(body.narratorVoice, 'Gacrux');

    const part = requestedBody.input[0].content[0];
    assert.equal(part.text, 'The frog entered the DMV and the room went completely silent.');
    assert.equal(part.annotations[0].type, 'speech_metadata');
    assert.match(part.annotations[0].style, /cinematic/i);
    assert.match(part.annotations[0].style, /ominous/i);
    assert.match(part.annotations[0].style, /deadpan/i);
    assert.match(part.annotations[0].style, /triumphant/i);
    assert.match(part.annotations[0].style, /inflection|human reactions/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('quoted dialogue receives a distinct second voice through structured speaker metadata', async () => {
  const originalFetch = globalThis.fetch;
  let requestedBody = null;

  globalThis.fetch = async (_url, init = {}) => {
    requestedBody = JSON.parse(String(init.body || '{}'));
    return interactionTtsResponse();
  };

  try {
    const response = await onRequestPost({
      request: narrationRequest({
        text: 'The clerk leaned closer. "Your aura expired yesterday." The whole DMV froze.',
        visualStyle: 'cursed-real',
        moods: ['uncanny', 'deadpan'],
      }),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.voiceMode, 'dual');
    assert.equal(body.narratorVoice, 'Charon');
    assert.equal(body.characterVoice, 'Enceladus');

    const parts = requestedBody.input[0].content;
    assert.deepEqual(parts.map(part => part.annotations[0].speaker), ['Narrator', 'Character', 'Narrator']);
    assert.equal(parts[1].text, 'Your aura expired yesterday.');
    assert.match(parts[1].annotations[0].style, /character/i);

    const speech = requestedBody.generation_config.speech_config;
    assert.equal(speech.mode, 'conversational');
    assert.deepEqual(speech.speakers, [
      { speaker: 'Narrator', voice: 'Charon' },
      { speaker: 'Character', voice: 'Enceladus' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('narration falls back to legacy Gemini TTS when 3.8 is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (requestedUrls.length === 1) {
      return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
    return legacyTtsResponse();
  };

  try {
    const response = await onRequestPost({
      request: narrationRequest({ visualStyle: 'cartoon' }),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      requestedUrls.map(url => new URL(url).pathname),
      [
        '/v1beta/interactions',
        '/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',
      ],
    );
    assert.equal(body.source, 'gemini-3.1-flash-tts-preview');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('finished AI narration is transcribed to word timestamps for exact caption highlighting', async () => {
  const originalFetch = globalThis.fetch;
  const aiCalls = [];

  globalThis.fetch = async () => interactionTtsResponse();

  const AI = {
    run: async (model, input) => {
      aiCalls.push({ model, input });
      return {
        text: 'The clerk blinked Absolutely not The frog entered the DMV',
        words: [
          { word: 'The', start: 0.01, end: 0.12 },
          { word: 'clerk', start: 0.13, end: 0.31 },
          { word: 'blinked', start: 0.32, end: 0.55 },
          { word: 'Absolutely', start: 0.56, end: 0.90 },
          { word: 'not', start: 0.91, end: 1.08 },
          { word: 'The', start: 1.20, end: 1.32 },
          { word: 'frog', start: 1.33, end: 1.50 },
        ],
      };
    },
  };

  try {
    const response = await onRequestPost({
      request: narrationRequest({
        text: 'The clerk blinked. "Absolutely not." The frog entered the DMV.',
        visualStyle: 'cartoon',
      }),
      env: { GEMINI_API_KEY: 'test-key', AI },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(aiCalls[0].model, '@cf/openai/whisper');
    assert.ok(Array.isArray(aiCalls[0].input.audio));
    assert.ok(aiCalls[0].input.audio.length > 44);
    assert.equal(body.timingSource, '@cf/openai/whisper');
    assert.equal(body.wordTimings[0].scriptIndex, 0);
    assert.equal(body.wordTimings[3].scriptIndex, 3);
    assert.equal(body.wordTimings[4].scriptIndex, 4);
    assert.equal(body.wordTimings[6].scriptIndex, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
