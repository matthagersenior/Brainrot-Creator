const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const HORDE_BASE = 'https://aihorde.net/api/v2';
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const ANON_KEY = '0000000000';
const CLIENT_AGENT = 'brainrot-creator:1.0:github.com/matthagersenior/Brainrot-Creator';
const POLLINATIONS_MODELS = new Set(['flux', 'zimage']);

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

function safeSeed(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(Math.max(1, Math.min(2_147_483_647, parsed))) : '1';
}

function safeModel(value) {
  const model = String(value || 'flux').trim().toLowerCase();
  return POLLINATIONS_MODELS.has(model) ? model : 'flux';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function pollinationsGenerate(visualPrompt, seed, model) {
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
    return json({ error: 'POLLINATIONS_FETCH_FAILED', detail: String(error?.message || error).slice(0, 240), model }, 502);
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

async function hordeFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', ANON_KEY);
  headers.set('Client-Agent', CLIENT_AGENT);
  return fetch(`${HORDE_BASE}${path}`, { ...init, headers });
}

async function imageToDataURI(img) {
  if (!img) throw new Error('AI Horde returned no image');
  if (img.startsWith('data:')) return img;
  if (!/^https?:\/\//i.test(img)) return `data:image/webp;base64,${img}`;

  const response = await fetch(img, { headers: { accept: 'image/*' } });
  if (!response.ok) throw new Error(`AI Horde image fetch failed with HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/webp';
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${contentType};base64,${bytesToBase64(bytes)}`;
}

async function hordeGenerate(visualPrompt, seed, env) {
  const timeoutMs = Math.max(5_000, Number(env.HORDE_TIMEOUT_MS) || 42_000);
  const pollMs = Math.max(250, Number(env.HORDE_POLL_INTERVAL_MS) || 2_000);

  const submit = await hordeFetch('/generate/async', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: `${visualPrompt} ### text, captions, subtitles, logos, watermarks, UI, blurry, deformed`,
      params: {
        n: 1,
        width: 320,
        height: 576,
        steps: 6,
        cfg_scale: 6.5,
        sampler_name: 'k_euler_a',
        seed,
        karras: true,
      },
      nsfw: false,
      censor_nsfw: true,
      r2: true,
      shared: false,
      slow_workers: true,
      replacement_filter: true,
    }),
  });

  const submitBody = await submit.json().catch(() => ({}));
  if (!submit.ok || !submitBody?.id) {
    return json({
      error: 'HORDE_SUBMIT_FAILED',
      detail: submitBody?.message || submitBody?.error || `HTTP ${submit.status}`,
    }, 502);
  }

  const id = submitBody.id;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await delay(pollMs);
    const check = await hordeFetch(`/generate/check/${id}`);
    const status = await check.json().catch(() => ({}));
    if (!check.ok) continue;

    if (status?.faulted) {
      return json({ error: 'HORDE_GENERATION_FAULTED', detail: status?.message || 'generation faulted' }, 502);
    }

    if (status?.done || Number(status?.finished || 0) > 0) {
      const full = await hordeFetch(`/generate/status/${id}`);
      const fullBody = await full.json().catch(() => ({}));
      const generation = Array.isArray(fullBody?.generations) ? fullBody.generations[0] : null;
      if (!full.ok || !generation?.img) {
        return json({ error: 'HORDE_EMPTY', detail: 'generation completed without an image' }, 502);
      }

      try {
        return json({
          dataURI: await imageToDataURI(generation.img),
          source: `AI Horde · ${generation.model || 'anonymous community'}`,
          seed,
          model: generation.model || null,
        });
      } catch (error) {
        return json({ error: 'HORDE_IMAGE_FETCH_FAILED', detail: String(error?.message || error).slice(0, 240) }, 502);
      }
    }
  }

  hordeFetch(`/generate/status/${id}`, { method: 'DELETE' }).catch(() => {});
  return json({ error: 'HORDE_TIMEOUT', detail: 'anonymous community queue did not finish in time' }, 504);
}

export async function onRequestPost({ request, env = {} }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const visualPrompt = safeText(payload?.visualPrompt);
  const seed = safeSeed(payload?.seed);
  if (!visualPrompt) return json({ error: 'VISUAL_PROMPT_REQUIRED' }, 400);

  if (String(payload?.provider || '').toLowerCase() === 'pollinations') {
    return pollinationsGenerate(visualPrompt, seed, safeModel(payload?.model));
  }

  return hordeGenerate(visualPrompt, seed, env);
}
