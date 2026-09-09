const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const text = String(payload?.text || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 3000) {
    return json({ error: 'NARRATION_MUST_BE_1_TO_3000_CHARS' }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'TTS_NOT_CONFIGURED' }, 503);
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: 'GEMINI_TTS_FAILED', detail: detail.slice(0, 400) }, 502);
  }

  const result = await response.json();
  const part = result?.candidates?.[0]?.content?.parts?.find(item => item?.inlineData?.data);
  const pcmBase64 = part?.inlineData?.data;
  if (!pcmBase64) return json({ error: 'GEMINI_TTS_EMPTY' }, 502);

  return json({
    pcmBase64,
    sampleRate: 24000,
    channels: 1,
    sampleWidth: 2,
    source: 'gemini-2.5-flash-preview-tts',
  });
}
