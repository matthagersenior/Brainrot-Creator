const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const ALLOWED_MODELS = new Set(['flux', 'zimage']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanPrompt(value, max = 1800) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanModel(value) {
  const model = String(value || 'flux').trim().toLowerCase();
  return ALLOWED_MODELS.has(model) ? model : 'flux';
}

function cleanSeed(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(2_147_483_647, parsed)) : 1;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const visualPrompt = cleanPrompt(body?.visualPrompt);
  const model = cleanModel(body?.model);
  const seed = cleanSeed(body?.seed);
  if (!visualPrompt) return json({ error: 'VISUAL_PROMPT_REQUIRED' }, 400);

  const params = new URLSearchParams({
    model,
    width: '576',
    height: '1024',
    seed: String(seed),
    enhance: 'true',
    safe: 'true',
    private: 'true',
    nologo: 'true',
  });
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(visualPrompt)}?${params}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'image/jpeg,image/png,image/webp,image/*',
        'user-agent': 'ROT-MACHINE-Brainrot-Creator/1.0',
      },
    });
  } catch (error) {
    return json({ error: 'POLLINATIONS_FETCH_FAILED', detail: String(error?.message || error).slice(0, 240) }, 502);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: 'POLLINATIONS_FAILED', detail: detail.slice(0, 240) || `HTTP ${response.status}`, model }, 502);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    const detail = await response.text().catch(() => '');
    return json({ error: 'POLLINATIONS_NON_IMAGE', detail: detail.slice(0, 240), model }, 502);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 10_000) {
    return json({ error: 'POLLINATIONS_TINY_IMAGE', detail: `${bytes.length} bytes`, model }, 502);
  }

  return json({
    dataURI: `data:${contentType};base64,${bytesToBase64(bytes)}`,
    source: `Pollinations · ${model === 'flux' ? 'FLUX' : 'Z-Image'}`,
    model,
    seed,
    bytes: bytes.length,
  });
}
