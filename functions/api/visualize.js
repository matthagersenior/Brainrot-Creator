const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const STYLE_PROMPTS = {
  'cursed-real': 'contemporary brainrot short-form meme aesthetic, original surreal AI hybrid character, absurd animal-object or mascot-object fusion, uncanny polished 3D-photoreal materials, memorable silhouette, expressive face or body language, practical lighting, no copied named meme character',
  photoreal: 'photoreal brainrot short-form meme aesthetic, original surreal hybrid protagonist, convincing real materials and uncanny coherent anatomy, absurd object fusion, repeatable silhouette, documentary detail, no copied named meme character',
  cinematic: 'cinematic brainrot short-form meme aesthetic, original surreal hybrid protagonist, premium live-action VFX look, memorable mascot-like silhouette, absurd physical mashup, motivated lighting, shallow depth of field, no copied named meme character',
  cartoon: 'stylized contemporary brainrot short-form meme aesthetic, original absurd hybrid character, exaggerated silhouette and reactions, object-animal mashup, bold saturated color and chaotic comedic energy',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeText(value, max = 1900) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeStyle(value) {
  const style = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(STYLE_PROMPTS, style) ? style : 'cursed-real';
}

function safeSeed(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return Math.floor(Math.random() * 2_000_000_000) + 1;
  return Math.max(1, Math.min(2_147_483_647, parsed));
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const visualPrompt = safeText(payload?.visualPrompt);
  const style = safeStyle(payload?.style);
  const seed = safeSeed(payload?.seed);

  if (!visualPrompt) return json({ error: 'VISUAL_PROMPT_REQUIRED' }, 400);
  if (!env?.AI?.run) return json({ error: 'VISUAL_AI_NOT_CONFIGURED' }, 503);

  const prompt = [
    STYLE_PROMPTS[style],
    visualPrompt,
    'vertical 9:16 social-video composition',
    'show the described story action clearly',
    'make the recurring character instantly readable at phone size with one strong silhouette, face, prop, and absurd visual hook',
    'no text, no subtitles, no logos, no watermarks, no UI, no speech bubbles',
  ].join('. ');

  try {
    const result = await env.AI.run(MODEL, {
      prompt: prompt.slice(0, 2048),
      steps: 4,
    });
    const image = typeof result?.image === 'string' ? result.image : '';
    if (!image) return json({ error: 'VISUAL_AI_EMPTY' }, 502);
    return json({
      dataURI: `data:image/jpeg;base64,${image}`,
      source: 'cloudflare-flux-1-schnell',
      seed,
      style,
    });
  } catch (error) {
    return json({
      error: 'VISUAL_AI_FAILED',
      detail: String(error?.message || error || 'Workers AI request failed').slice(0, 240),
    }, 502);
  }
}
