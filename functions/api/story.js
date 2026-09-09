const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanPrompt(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function countWords(value) {
  const text = String(value || '').trim();
  return text ? text.split(/\s+/).length : 0;
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const prompt = cleanPrompt(payload?.prompt);
  if (!prompt || countWords(prompt) > 9) {
    return json({ error: 'PROMPT_MUST_BE_1_TO_9_WORDS' }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'AI_NOT_CONFIGURED' }, 503);
  }

  const systemPrompt = `Create a fictional, absurd, high-energy Brainrot short from this very small prompt: "${prompt}".

Return JSON only with exactly this shape:
{"scenes":[{"text":"...","emoji":"💀","color":"#ff2ec4","burst":"AURA LOSS"}]}

Rules:
- Exactly 8 scenes.
- Total spoken narration across all scenes: 140 to 160 words.
- Each scene should be roughly 16 to 22 spoken words and flow into the next like one story.
- Hook immediately in scene 1, escalate absurdly through scenes 2-6, callback in scene 7, punchline/final verdict in scene 8.
- Brainrot pacing: meme logic, fake lore, aura/rizz/side-quest energy, surprising escalation, quotable lines. Do not merely repeat slang.
- Each emoji must visually match that scene.
- color must be a six-digit hex color.
- burst must be 1 to 3 uppercase words tied to that scene.
- Keep it clearly fictional and comedic. Do not invent damaging factual claims about real people.
- No slurs, sexual content involving minors, graphic violence, self-harm encouragement, tragedy jokes, or instructions for wrongdoing.
- Never imitate or request a real person's voice.`;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 1.15,
          maxOutputTokens: 2200,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: 'GEMINI_STORY_FAILED', detail: detail.slice(0, 400) }, 502);
  }

  const result = await response.json();
  const raw = result?.candidates?.[0]?.content?.parts?.find(part => typeof part?.text === 'string')?.text;
  if (!raw) return json({ error: 'GEMINI_STORY_EMPTY' }, 502);

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/gi, '').trim());
  } catch {
    return json({ error: 'GEMINI_STORY_INVALID_JSON' }, 502);
  }

  if (!Array.isArray(parsed?.scenes) || parsed.scenes.length < 1) {
    return json({ error: 'GEMINI_STORY_INVALID_SHAPE' }, 502);
  }

  return json({ scenes: parsed.scenes.slice(0, 8), source: 'gemini-3.6-flash' });
}
