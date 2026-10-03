const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-tts';
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
    'Aim for roughly 52 to 56 seconds of spoken performance inside the 60-second short so the ending can breathe.',
    'Use human rhythm instead of constant cadence: tiny pauses after commas, clear sentence-ending pauses, and a slightly longer beat between story scenes.',
    'Do not rush the final words of a sentence, do not machine-gun lists, and do not stretch vowels just to hit a duration target.',
    'Preserve comedic timing with purposeful micro-pauses; natural delivery matters more than filling every second.',
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


function speakerTurns(text) {
  const normalized = String(text || '').replace(/[“”]/g, '"').trim();
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
  return parts.length ? parts : [{ speaker: 'Narrator', text: normalized }];
}

function buildInteractionRequest(text, visualStyle, moods) {
  const profile = VOICE_PROFILES[visualStyle];
  const turns = speakerTurns(text);
  const dual = turns.some(turn => turn.speaker === 'Character');
  const arc = moods.length
    ? 'Let the emotional arc naturally move through: ' + moods.join(' → ') + '.'
    : 'Let the emotional arc move from absurd curiosity to escalation to a clean final punchline.';

  const content = turns.map(turn => ({
    type: 'text',
    text: turn.text,
    annotations: [{
      type: 'speech_metadata',
      ...(dual ? { speaker: turn.speaker } : {}),
      style: (turn.speaker === 'Character'
        ? 'Distinct recurring character acting with a clearly different vocal identity, conversational reactions, playful attitude, and sharp comedic timing. '
        : profile.direction + ' Use varied inflection and natural human reactions rather than flat narration. ')
        + arc
        + ' Preserve natural micro-pauses and do not rush sentence endings.',
    }],
  }));

  return {
    dual,
    turns,
    body: {
      model: PRIMARY_TTS_MODEL,
      input: [{ type: 'user_input', content }],
      response_format: {
        type: 'audio',
        mime_type: 'audio/l16',
        sample_rate: 24000,
      },
      generation_config: {
        speech_config: dual
          ? {
              mode: 'conversational',
              speakers: [
                { speaker: 'Narrator', voice: profile.narrator },
                { speaker: 'Character', voice: profile.character },
              ],
            }
          : [{ voice: profile.narrator }],
      },
    },
  };
}

function extractInteractionAudio(result) {
  const convenience = result?.output_audio || result?.outputAudio;
  if (convenience?.data) return convenience.data;

  const audioParts = [];
  for (const step of Array.isArray(result?.steps) ? result.steps : []) {
    for (const part of Array.isArray(step?.content) ? step.content : []) {
      if (part?.type === 'audio' && part?.data) audioParts.push(part.data);
    }
  }
  return audioParts.at(-1) || '';
}

async function fetchGemini38(apiKey, requestBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error('Gemini 3.8 TTS ' + response.status + ': ' + detail.slice(0, 280));
    }

    const result = await response.json();
    const data = extractInteractionAudio(result);
    if (!data) throw new Error('Gemini 3.8 TTS returned no audio.');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pcmToWavBytes(pcmBytes, sampleRate = 24000) {
  const output = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(output.buffer);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      output[offset + index] = value.charCodeAt(index);
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, pcmBytes.length, true);
  output.set(pcmBytes, 44);
  return output;
}

function normalizeTimingWord(value) {
  return String(value || '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function alignWordTimings(text, providerWords) {
  const scriptWords = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!scriptWords.length || !Array.isArray(providerWords)) return [];
  const normalizedScript = scriptWords.map(normalizeTimingWord);
  const timings = [];
  let cursor = 0;

  for (const providerWord of providerWords) {
    const spoken = normalizeTimingWord(providerWord?.word ?? providerWord?.text);
    const start = Number(providerWord?.start);
    const end = Number(providerWord?.end);
    if (!spoken || !Number.isFinite(start) || !Number.isFinite(end)) continue;

    let found = -1;
    for (let index = cursor; index < Math.min(normalizedScript.length, cursor + 9); index += 1) {
      if (normalizedScript[index] === spoken) {
        found = index;
        break;
      }
    }
    if (found < 0) continue;

    timings.push({
      word: scriptWords[found],
      start: Math.max(0, start),
      end: Math.max(start, end),
      scriptIndex: found,
    });
    cursor = found + 1;
  }

  return timings;
}

async function transcribeWordTimings(env, pcmBase64, text) {
  if (!env?.AI?.run || !pcmBase64) return [];
  try {
    const wavBytes = pcmToWavBytes(decodeBase64Bytes(pcmBase64));
    const result = await env.AI.run('@cf/openai/whisper', {
      audio: [...wavBytes],
    });
    return alignWordTimings(text, result?.words);
  } catch {
    return [];
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

  const interaction = buildInteractionRequest(text, visualStyle, moods);
  const transcript = speakerTranscript(text);
  const voiceMode = interaction.dual ? 'dual' : 'narrator';
  const profile = VOICE_PROFILES[visualStyle];
  let pcmBase64 = '';
  let source = '';
  let lastError = null;

  try {
    pcmBase64 = await fetchGemini38(env.GEMINI_API_KEY, interaction.body);
    source = PRIMARY_TTS_MODEL;
  } catch (error) {
    lastError = error;
  }

  if (!pcmBase64) {
    const prompt = buildPerformancePrompt(text, visualStyle, moods, transcript);
    const requestBody = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: buildSpeechConfig(profile, Boolean(transcript)),
      },
    });

    for (let index = 0; index < TTS_MODELS.length; index += 1) {
      const model = TTS_MODELS[index];
      try {
        const response = await fetchTts(model, env.GEMINI_API_KEY, requestBody);
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          lastError = new Error(model + ' ' + response.status + ': ' + detail.slice(0, 280));
          continue;
        }

        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.find(item => item?.inlineData?.data);
        if (!part?.inlineData?.data) {
          lastError = new Error(model + ' returned no audio.');
          continue;
        }

        pcmBase64 = part.inlineData.data;
        source = model;
        break;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (!pcmBase64) {
    return json({
      error: 'GEMINI_TTS_FAILED',
      detail: String(lastError?.message || lastError || 'No Gemini TTS model was available.').slice(0, 400),
    }, 502);
  }

  const wordTimings = await transcribeWordTimings(env, pcmBase64, text);

  return json({
    pcmBase64,
    sampleRate: 24000,
    channels: 1,
    sampleWidth: 2,
    source,
    voiceMode,
    visualStyle,
    narratorVoice: profile.narrator,
    characterVoice: interaction.dual ? profile.character : null,
    wordTimings,
    timingSource: wordTimings.length ? '@cf/openai/whisper' : 'estimated',
  });
}
