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

function successfulTtsResponse() {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            data: 'ZmFrZS1wY20tYXVkaW8=',
          },
        }],
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('narration uses Gemini 3.1 Flash TTS and directs the narrator from story style and mood', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedBody = null;

  globalThis.fetch = async (url, init = {}) => {
    requestedUrl = String(url);
    requestedBody = JSON.parse(String(init.body || '{}'));
    return successfulTtsResponse();
  };

  try {
    const response = await onRequestPost({
      request: narrationRequest(),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(requestedUrl, /gemini-3\.1-flash-tts-preview:generateContent$/);
    assert.equal(body.source, 'gemini-3.1-flash-tts-preview');
    assert.equal(body.voiceMode, 'narrator');
    assert.equal(body.visualStyle, 'cinematic');

    const prompt = requestedBody.contents[0].parts[0].text;
    assert.match(prompt, /cinematic/i);
    assert.match(prompt, /ominous/i);
    assert.match(prompt, /deadpan/i);
    assert.match(prompt, /triumphant/i);
    assert.match(prompt, /exact script/i);

    const voiceName = requestedBody.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
    assert.equal(voiceName, 'Gacrux');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('quoted dialogue automatically uses a second character voice while preserving narrator voice', async () => {
  const originalFetch = globalThis.fetch;
  let requestedBody = null;

  globalThis.fetch = async (_url, init = {}) => {
    requestedBody = JSON.parse(String(init.body || '{}'));
    return successfulTtsResponse();
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

    const speech = requestedBody.generationConfig.speechConfig;
    assert.ok(speech.multiSpeakerVoiceConfig);
    assert.equal(speech.voiceConfig, undefined);

    const speakers = speech.multiSpeakerVoiceConfig.speakerVoiceConfigs;
    assert.deepEqual(speakers.map(item => item.speaker), ['Narrator', 'Character']);
    assert.equal(speakers[0].voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
    assert.equal(speakers[1].voiceConfig.prebuiltVoiceConfig.voiceName, 'Enceladus');

    const prompt = requestedBody.contents[0].parts[0].text;
    assert.match(prompt, /Narrator:/);
    assert.match(prompt, /Character: Your aura expired yesterday\./);
    assert.match(prompt, /The whole DMV froze\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('narration falls back to Gemini 2.5 Flash TTS on retryable 3.1 provider failure', async () => {
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
    return successfulTtsResponse();
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
        '/v1beta/models/gemini-3.1-flash-tts-preview:generateContent',
        '/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
      ],
    );
    assert.equal(body.source, 'gemini-2.5-flash-preview-tts');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
