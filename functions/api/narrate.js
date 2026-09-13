const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const TTS_MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const RETRYABLE_PROVIDER_STATUS = new Set([404, 429, 500, 502, 503, 504]);
const MODEL_TIMEOUT_MS = 45_000;

const VOICE_PROFILES = Object.freeze({
  'cursed-real': Object.freeze({
    narrator: 'Charon',
    character: 'Enceladus',
    direction: 'Deadpan documentary narrator with believable human timing, dry confidence, subtle unease, and restrained reactions as the absurdity escalates.',
  }),
  photoreal: Object.freeze({
    narrator: 'Iapetus',
    character: 'Aoede',
    direction: 'Natural social-documentary delivery: clear, conversational, grounded, responsive to the story emotion, and never announcer-like.',
  }),
  cinematic: Object.freeze({
    narrator: 'Gacrux',
    character: 'Achernar',
    direction: 'Cinematic storyteller with mature presence, controlled dramatic pacing, precise emphasis, and an emotional arc that rises with the scene stakes.',
  }),
  cartoon: Object.freeze({
    narrator: 'Puck',
    character: 'Fenrir',
    direction: 'Fast, lively animated-comedy narrator with elastic timing, punchy reactions, strong comedic emphasis, and clear intelligibility.',
  }),
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeText(value, max = 3000) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeStyle(value) {
  const style = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VOICE_PROFILES, style) ? style : 'cursed-real';
}

function safeMoods(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => safeText(item, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function speakerTranscript(text) {
  const normalized = String(text || '')
    .replace(/[“”]/g, '"')
    .trim();
  const quotePattern = /"([^"]{2,240})"/g;
  const parts = [];
  let cursor = 0;
  let match;

  while ((match = quotePattern.exec(normalized)) !== null) {
    const before = normalized.slice(cursor, match.index).trim();
    if (before) parts.push({ speaker: 'Narrator', text: before });
    const quote = match[1].trim();
    if (quote) parts.push({ speaker: 'Character', text: quote });
    cursor = match.index + match[0].length;
  }

  const after = normalized.slice(cursor).trim();
  if (after) parts.push({ speaker: 'Narrator', text: after });

  const hasCharacter = parts.some(part => part.speaker === 'Character');
  if (!hasCharacter) return null;

  return parts
    .map(part => `${part.speaker}: ${part.text}`)
    .join('\n');
}

function buildSpeechConfig(profile, dual) {
  if (!dual) {
    return {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: profile.narrator },
      },
    };
  }

  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        {
          speaker: 'Narrator',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: profile.narrator },
          },
        },
        {
          speaker: 'Character',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: profile.character },
          },
        },
      ],
    },
  };
}

function buildPerformancePrompt(text, visualStyle, moods, transcript) {
  const profile = VOICE_PROFILES[visualStyle];
  const moodArc = moods.length ? moods.join(' → ') : 'absurd, escalating, then a clean punchline';
  const exactScript = transcript || text;

  return [
    'Perform the exact script below. Do not add, remove, paraphrase, summarize, or repeat any spoken words.',
    `Overall performance direction: ${profile.direction}`,
    `Story mood arc: ${moodArc}.`,
    transcript
      ? 'There are exactly two performance roles. Narrator reads only Narrator lines. Character reads only Character lines. Do not speak the role labels.'
      : 'Use one narrator voice, but naturally change intensity and emotion as the story escalates.',
    'Keep the total performance tight enough for an approximately 60-second vertical short. Preserve comedic timing without long pauses.',
    '',
    'Exact script:',
    exactScript,
  ].join('\n');
}

async function fetchTts(model, apiKey, requestBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: requestBody,
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const text = safeText(payload?.text);
  const visualStyle = safeStyle(payload?.visualStyle);
  const moods = safeMoods(payload?.moods);
  if (!text || text.length > 3000) {
    return json({ error: 'NARRATION_MUST_BE_1_TO_3000_CHARS' }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'TTS_NOT_CONFIGURED' }, 503);
  }

  const transcript = speakerTranscript(text);
  const voiceMode = transcript ? 'dual' : 'narrator';
  const profile = VOICE_PROFILES[visualStyle];
  const prompt = buildPerformancePrompt(text, visualStyle, moods, transcript);
  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: buildSpeechConfig(profile, Boolean(transcript)),
    },
  });

  let lastError = { error: 'GEMINI_TTS_FAILED', detail: 'No Gemini TTS model was available.' };

  for (let index = 0; index < TTS_MODELS.length; index += 1) {
    const model = TTS_MODELS[index];
    const hasFallback = index < TTS_MODELS.length - 1;
    let response;

    try {
      response = await fetchTts(model, env.GEMINI_API_KEY, requestBody);
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      lastError = {
        error: timedOut ? 'GEMINI_TTS_TIMEOUT' : 'GEMINI_TTS_FAILED',
        detail: timedOut
          ? `${model} exceeded ${MODEL_TIMEOUT_MS / 1000}s.`
          : String(error?.message || error || 'Gemini TTS request failed').slice(0, 400),
      };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      lastError = { error: 'GEMINI_TTS_FAILED', detail: detail.slice(0, 400) };
      if (hasFallback && RETRYABLE_PROVIDER_STATUS.has(response.status)) continue;
      return json(lastError, 502);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      lastError = { error: 'GEMINI_TTS_INVALID_PROVIDER_JSON' };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    const part = result?.candidates?.[0]?.content?.parts?.find(item => item?.inlineData?.data);
    const pcmBase64 = part?.inlineData?.data;
    if (!pcmBase64) {
      lastError = { error: 'GEMINI_TTS_EMPTY' };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    return json({
      pcmBase64,
      sampleRate: 24000,
      channels: 1,
      sampleWidth: 2,
      source: model,
      voiceMode,
      visualStyle,
      narratorVoice: profile.narrator,
      characterVoice: transcript ? profile.character : null,
    });
  }

  return json(lastError, 502);
}
