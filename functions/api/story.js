const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const STORY_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const RETRYABLE_PROVIDER_STATUS = new Set([404, 429, 500, 502, 503, 504]);
const MODEL_TIMEOUT_MS = 30_000;
const VISUAL_STYLES = {
  'cursed-real': 'contemporary brainrot visual language: original surreal AI meme character, animal-object or mascot-object hybrid where appropriate, uncanny polished 3D-photoreal materials, exaggerated memorable silhouette, absurd prop fusion, practical lighting, short-form social-video energy, no copied named meme character',
  photoreal: 'photoreal brainrot meme world: original surreal hybrid protagonist, convincing real materials, uncanny coherent anatomy, bold absurd object fusion, repeatable silhouette, real-world lighting, no copied named meme character',
  cinematic: 'cinematic brainrot meme world: original surreal hybrid protagonist with a memorable mascot-like silhouette, absurd physical mashup rendered as premium live-action VFX, dramatic short-form framing, motivated lighting, shallow depth of field',
  cartoon: 'stylized contemporary brainrot cartoon: original absurd hybrid meme character, exaggerated silhouette and reactions, object-animal mashup, bold saturated color, chaotic short-form comedy energy',
};

const STRING_FIELD = { type: 'string' };
const STORY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    continuity: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: STRING_FIELD,
        appearance: STRING_FIELD,
        world: STRING_FIELD,
        props: STRING_FIELD,
      },
      required: ['subject', 'appearance', 'world', 'props'],
    },
    scenes: {
      type: 'array',
      minItems: 8,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: STRING_FIELD,
          color: STRING_FIELD,
          burst: STRING_FIELD,
          subject: STRING_FIELD,
          setting: STRING_FIELD,
          action: STRING_FIELD,
          camera: STRING_FIELD,
          mood: STRING_FIELD,
          visualPrompt: STRING_FIELD,
          visualBeats: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: STRING_FIELD,
          },
        },
        required: ['text', 'color', 'burst', 'subject', 'setting', 'action', 'camera', 'mood', 'visualPrompt', 'visualBeats'],
      },
    },
  },
  required: ['continuity', 'scenes'],
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanPrompt(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function safeStoryText(value, max = 360) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function countWords(value) {
  const text = String(value || '').trim();
  return text ? text.split(/\s+/).length : 0;
}

function normalizeStyle(value) {
  const style = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VISUAL_STYLES, style) ? style : 'cursed-real';
}

function parseJsonText(raw) {
  const cleaned = String(raw || '').replace(/```json|```/gi, '').trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function splitNarrationForVisuals(text) {
  const words = safeStoryText(text, 360).split(/\s+/).filter(Boolean);
  if (!words.length) return ['', ''];
  const midpoint = Math.max(1, Math.ceil(words.length / 2));
  return [
    words.slice(0, midpoint).join(' '),
    words.slice(midpoint).join(' ') || words.slice(0, midpoint).join(' '),
  ];
}

function repairVisualBeats(scene) {
  const provided = Array.isArray(scene?.visualBeats)
    ? scene.visualBeats.map(item => safeStoryText(item, 320)).filter(Boolean).slice(0, 2)
    : [];
  if (provided.length === 2) return provided;

  const [openingNarration, laterNarration] = splitNarrationForVisuals(scene?.text);
  const action = safeStoryText(scene?.action, 260) || 'the narrated physical action happens visibly';
  return [
    provided[0] || `Opening visible moment matching "${openingNarration}": ${action}`,
    provided[1] || `Later visible moment matching "${laterNarration}": show the physical consequence or continuation of ${action}`,
  ];
}

function repairStoryScenes(scenes) {
  return scenes.map(scene => ({
    ...scene,
    visualBeats: repairVisualBeats(scene),
  }));
}

function parseStoryCandidate(result) {
  const raw = result?.candidates?.[0]?.content?.parts?.find(part => typeof part?.text === 'string')?.text;
  if (!raw) return { ok: false, error: 'GEMINI_STORY_EMPTY' };

  const parsed = parseJsonText(raw);
  if (!parsed) return { ok: false, error: 'GEMINI_STORY_INVALID_JSON' };

  if (!Array.isArray(parsed?.scenes) || parsed.scenes.length !== 8) {
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
  if (!prompt || countWords(prompt) > 60) {
    return json({ error: 'PROMPT_MUST_BE_1_TO_60_WORDS' }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'AI_NOT_CONFIGURED' }, 503);
  }

  const systemPrompt = `Create a fictional, absurd, high-energy 60-second Brainrot short from this user prompt: "${prompt}". Treat specific details in the prompt as creative direction rather than compressing them into a generic meme.

The visual style is: ${VISUAL_STYLES[visualStyle]}.

Return JSON only with exactly the schema requested by the API.

Rules:
- Exactly 8 scenes.
- Total spoken narration: 118 to 132 words. Natural delivery matters more than filling every second.
- Each scene should be roughly 13 to 18 spoken words and flow into the next as one story.
- Write for spoken rhythm: vary sentence length, use clean punctuation, and leave room for micro-pauses between beats instead of cramming clauses together.
- Hook immediately in scene 1, escalate through scenes 2-6, callback in scene 7, punchline/final verdict in scene 8.
- Every scene must depict the literal story beat being narrated. Do not generate unrelated generic meme imagery.
- For every scene, return visualBeats with exactly two ordered visual moments. visualBeats[0] must literally depict the first half of that scene's narration; visualBeats[1] must literally depict the later half or visible consequence. Keep them in narration order.
- Each visual beat must name the concrete visible actor/object and physical action. If the narration says corn stalks dribble, the beat must visibly contain corn stalks physically bouncing a basketball; do not substitute a generic mascot pose.
- Build the short around one recurring meme-worthy AI character with a simple instantly recognizable design. Favor an original surreal hybrid or absurd mascot-like creature when the prompt allows it: fuse an animal, object, food, machine, clothing item, or everyday thing into one coherent character. Keep that character original rather than copying a named existing meme.
- Keep the same recurring subject, appearance, world, and recurring props visually consistent across all 8 scenes.
- Keep the recurring protagonist clearly visible and recognizable in at least 6 of the 8 scene prompts; avoid empty environments or abstract-only shots.
- visualPrompt must describe concrete visible people/creatures, objects, location, physical action, camera framing, and lighting. It must not ask the image model to depict abstract concepts such as aura, rizz, energy, gravity, loop, lore, side quest, confusion, or fear as text, symbols, fog, blobs, or graphics.
- If an abstract story idea matters, translate it into a visible physical event or character reaction instead.
- visualPrompt must include vertical 9:16 social-video framing, the scene's subject, setting, action, camera, mood, continuity details, and the requested style.
- Keep any signs, screens, paperwork, labels, posters, license plates, or displays blank, unreadable, defocused, or too small to read.
- Unless the selected style is cartoon, render the brainrot character with convincing materials, lighting, depth, and physical presence rather than flat-vector, emoji, or simple clip-art aesthetics. A mascot-like silhouette is welcome; cheap mascot rendering is not.
- visualPrompt must say there should be no text, subtitles, logos, watermarks, UI, or speech bubbles inside the generated image.
- Brainrot pacing: meme logic, fake lore, absurd hybrid-character behavior, escalating visual jokes, surprising physical transformations or props, quotable lines, and fast short-form readability. Do not merely repeat slang.
- Include 2 to 4 short direct quotes, written with standard double quotes, from the same recurring featured character across at least two scenes between scenes 2-7.
- Each direct quote should be 2 to 8 spoken words and feel natural to that story beat. The same recurring featured character must speak every quoted line so two-speaker TTS can give that character one consistent second voice while the narrator remains the first voice.
- color must be a six-digit hex color used only for UI/caption accenting.
- burst must be 1 to 3 uppercase words tied to that scene.
- Keep it clearly fictional and comedic. Do not invent damaging factual claims about real people.
- No slurs, sexual content involving minors, graphic violence, self-harm encouragement, tragedy jokes, or instructions for wrongdoing.
- Never imitate or request a real person's voice.`;

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: STORY_JSON_SCHEMA,
      temperature: 0.8,
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
      scenes: repairStoryScenes(candidate.parsed.scenes),
      continuity,
      visualStyle,
      source: model,
    });
  }

  return json(lastError, 502);
}
