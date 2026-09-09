const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const STORY_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const RETRYABLE_PROVIDER_STATUS = new Set([404, 429, 500, 502, 503, 504]);
const MODEL_TIMEOUT_MS = 30_000;
const VISUAL_STYLES = {
  'cursed-real': 'cursed realistic live-action photography: believable physical materials, natural anatomy, practical lighting, subtly uncanny details, no cartoon, no anime',
  photoreal: 'photorealistic documentary photography: natural textures, plausible anatomy and scale, real-world lighting, no cartoon, no anime, no illustration',
  cinematic: 'cinematic live-action film stills: realistic production design, motivated lighting, shallow depth of field, restrained color grade, no cartoon or anime',
  cartoon: 'stylized brainrot cartoon: bold illustrated forms, expressive shapes, intentionally non-photorealistic',
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

function normalizeStyle(value) {
  const style = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VISUAL_STYLES, style) ? style : 'cursed-real';
}

function parseStoryCandidate(result) {
  const raw = result?.candidates?.[0]?.content?.parts?.find(part => typeof part?.text === 'string')?.text;
  if (!raw) return { ok: false, error: 'GEMINI_STORY_EMPTY' };

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/gi, '').trim());
  } catch {
    return { ok: false, error: 'GEMINI_STORY_INVALID_JSON' };
  }

  if (!Array.isArray(parsed?.scenes) || parsed.scenes.length < 1) {
    return { ok: false, error: 'GEMINI_STORY_INVALID_SHAPE' };
  }

  return { ok: true, parsed };
}

async function fetchModel(model, apiKey, requestBody) {
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

  const prompt = cleanPrompt(payload?.prompt);
  const visualStyle = normalizeStyle(payload?.visualStyle);
  if (!prompt || countWords(prompt) > 9) {
    return json({ error: 'PROMPT_MUST_BE_1_TO_9_WORDS' }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'AI_NOT_CONFIGURED' }, 503);
  }

  const systemPrompt = `Create a fictional, absurd, high-energy 60-second Brainrot short from this tiny prompt: "${prompt}".

The visual style is: ${VISUAL_STYLES[visualStyle]}.

Return JSON only with exactly this structure:
{
  "continuity": {
    "subject": "one concise recurring main-subject description",
    "appearance": "fixed appearance/material/wardrobe details that must persist",
    "world": "fixed recurring environment/world description",
    "props": "recurring props or visual motifs"
  },
  "scenes": [
    {
      "text": "spoken narration",
      "color": "#6f7f8f",
      "burst": "AURA LOSS",
      "subject": "what recurring subject is visible here",
      "setting": "specific visible location for this scene",
      "action": "literal visible action matching this scene's narration",
      "camera": "realistic camera framing and movement",
      "mood": "visual mood",
      "visualPrompt": "standalone text-to-image prompt for this exact scene"
    }
  ]
}

Rules:
- Exactly 8 scenes.
- Total spoken narration: 140 to 160 words.
- Each scene should be roughly 16 to 22 spoken words and flow into the next as one story.
- Hook immediately in scene 1, escalate through scenes 2-6, callback in scene 7, punchline/final verdict in scene 8.
- Every scene must depict the literal story beat being narrated. Do not generate unrelated generic meme imagery.
- Keep the same recurring subject, appearance, world, and recurring props visually consistent across all 8 scenes.
- visualPrompt must include vertical 9:16 social-video framing, the scene's subject, setting, action, camera, mood, continuity details, and the requested style.
- Unless the selected style is cartoon, explicitly avoid cartoon, anime, illustration, emoji, mascot, toy-like, and flat-vector aesthetics.
- visualPrompt must say there should be no text, subtitles, logos, watermarks, UI, or speech bubbles inside the generated image.
- Brainrot pacing: meme logic, fake lore, aura/rizz/side-quest energy, surprising escalation, quotable lines. Do not merely repeat slang.
- color must be a six-digit hex color used only for UI/caption accenting.
- burst must be 1 to 3 uppercase words tied to that scene.
- Keep it clearly fictional and comedic. Do not invent damaging factual claims about real people.
- No slurs, sexual content involving minors, graphic violence, self-harm encouragement, tragedy jokes, or instructions for wrongdoing.
- Never imitate or request a real person's voice.`;

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.9,
      maxOutputTokens: 3600,
    },
  });

  let lastError = { error: 'GEMINI_STORY_FAILED', detail: 'No Gemini story model was available.' };

  for (let index = 0; index < STORY_MODELS.length; index += 1) {
    const model = STORY_MODELS[index];
    const hasFallback = index < STORY_MODELS.length - 1;
    let response;

    try {
      response = await fetchModel(model, env.GEMINI_API_KEY, requestBody);
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      lastError = {
        error: timedOut ? 'GEMINI_STORY_TIMEOUT' : 'GEMINI_STORY_FAILED',
        detail: timedOut ? `${model} exceeded ${MODEL_TIMEOUT_MS / 1000}s.` : String(error?.message || error || 'Gemini request failed').slice(0, 400),
      };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      lastError = { error: 'GEMINI_STORY_FAILED', detail: detail.slice(0, 400) };
      if (hasFallback && RETRYABLE_PROVIDER_STATUS.has(response.status)) continue;
      return json(lastError, 502);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      lastError = { error: 'GEMINI_STORY_INVALID_PROVIDER_JSON' };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    const candidate = parseStoryCandidate(result);
    if (!candidate.ok) {
      lastError = { error: candidate.error };
      if (hasFallback) continue;
      return json(lastError, 502);
    }

    const continuity = candidate.parsed?.continuity && typeof candidate.parsed.continuity === 'object'
      ? candidate.parsed.continuity
      : {};
    return json({
      scenes: candidate.parsed.scenes.slice(0, 8),
      continuity,
      visualStyle,
      source: model,
    });
  }

  return json(lastError, 502);
}
