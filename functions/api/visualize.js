const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const OUTPUT_WIDTH = 576;
const OUTPUT_HEIGHT = 1024;
const MAX_REFERENCE_BASE64_CHARS = 1_500_000;
const STYLE_PROMPTS = {
  'cursed-real': 'cursed realistic live-action photography, believable physical materials, natural anatomy, practical lighting, subtle uncanny details, no cartoon, no anime, no flat illustration',
  photoreal: 'photorealistic documentary photography, natural textures, realistic anatomy and scale, real-world lighting, no cartoon, no anime, no illustration',
  cinematic: 'cinematic live-action film still, realistic production design, motivated lighting, shallow depth of field, natural textures, no cartoon, no anime',
  cartoon: 'stylized brainrot cartoon, illustrated, bold expressive shapes and color',
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

function referenceBlob(value) {
  const text = String(value || '');
  const match = text.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match || match[2].length > MAX_REFERENCE_BASE64_CHARS) return null;
  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new Blob([bytes], { type: match[1].toLowerCase() });
  } catch {
    return null;
  }
}

function buildMultipart(prompt, reference) {
  const form = new FormData();
  form.append('prompt', prompt.slice(0, 2048));
  form.append('width', String(OUTPUT_WIDTH));
  form.append('height', String(OUTPUT_HEIGHT));
  if (reference) form.append('input_image_0', reference, 'scene-reference.jpg');

  const serialized = new Response(form);
  return {
    body: serialized.body,
    contentType: serialized.headers.get('content-type'),
  };
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
  const reference = referenceBlob(payload?.referenceDataURI);

  if (!visualPrompt) return json({ error: 'VISUAL_PROMPT_REQUIRED' }, 400);
  if (!env?.AI?.run) return json({ error: 'VISUAL_AI_NOT_CONFIGURED' }, 503);

  const prompt = [
    STYLE_PROMPTS[style],
    reference
      ? 'Use input image 0 as the identity and appearance reference for the recurring main subject; preserve its recognizable identity, materials, wardrobe, proportions, and key visual traits while changing the pose, action, camera, and location as requested'
      : 'Establish a distinctive recurring main subject whose recognizable appearance can be preserved in later shots',
    visualPrompt,
    'true vertical 9:16 social-video frame',
    'show the described story action clearly and literally',
    'natural perspective and believable depth',
    'no text, no subtitles, no logos, no watermarks, no UI, no speech bubbles',
  ].join('. ');

  try {
    const multipart = buildMultipart(prompt, reference);
    const result = await env.AI.run(MODEL, { multipart });
    const image = typeof result?.image === 'string' ? result.image : '';
    if (!image) return json({ error: 'VISUAL_AI_EMPTY' }, 502);
    return json({
      dataURI: `data:image/jpeg;base64,${image}`,
      source: 'cloudflare-flux-2-klein-4b',
      seed,
      style,
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      referenceUsed: Boolean(reference),
    });
  } catch (error) {
    return json({
      error: 'VISUAL_AI_FAILED',
      detail: String(error?.message || error || 'Workers AI request failed').slice(0, 320),
    }, 502);
  }
}
