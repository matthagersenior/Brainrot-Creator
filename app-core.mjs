export const MAX_PROMPT_WORDS = 9;
export const TARGET_SECONDS = 60;
export const SCENE_COUNT = 8;
export const MICRO_SHOTS_PER_SCENE = 4;
export const TOTAL_MICRO_SHOTS = SCENE_COUNT * MICRO_SHOTS_PER_SCENE;

const PALETTE = ['#d4845f', '#6688a8', '#9a7c63', '#5f7c6d', '#8b6d8f', '#b08b57', '#5f767d', '#8a665f'];
const MODIFIERS = [
  'at the DMV',
  'with zero aura',
  'in Ohio somehow',
  'during math class',
  'at 3AM',
  'but the WiFi is sentient',
  'inside the backrooms',
  'with maximum rizz',
];

export const VISUAL_STYLE_PRESETS = Object.freeze({
  'cursed-real': Object.freeze({
    label: 'CURSED REAL',
    prompt: 'cursed realistic photography, believable physical materials, natural anatomy, practical lighting, subtle uncanny details, social-video realism, no cartoon, no anime, no flat illustration',
  }),
  photoreal: Object.freeze({
    label: 'PHOTOREAL',
    prompt: 'photorealistic photography, natural skin and material texture, realistic lighting, plausible anatomy and scale, documentary detail, no cartoon, no anime, no illustration',
  }),
  cinematic: Object.freeze({
    label: 'CINEMATIC',
    prompt: 'cinematic live-action film still, realistic production design, motivated lighting, shallow depth of field, natural textures, restrained color grade, no cartoon, no anime',
  }),
  cartoon: Object.freeze({
    label: 'BRAINROT CARTOON',
    prompt: 'stylized brainrot cartoon, expressive shapes, bold color, exaggerated comic energy, intentionally illustrated rather than photorealistic',
  }),
});

export const MICRO_SHOTS_PER_SCENE = 4;

const MICRO_SHOT_MOTION_PRESETS = Object.freeze({
  'cursed-real': Object.freeze([
    Object.freeze({ zoomStart: 1.035, zoomEnd: 1.075, panXStart: -7, panXEnd: 8, panYStart: 4, panYEnd: -4, rotationStart: -0.08, rotationEnd: 0.10 }),
    Object.freeze({ zoomStart: 1.075, zoomEnd: 1.105, panXStart: 8, panXEnd: -5, panYStart: -3, panYEnd: 5, rotationStart: 0.10, rotationEnd: -0.06 }),
    Object.freeze({ zoomStart: 1.105, zoomEnd: 1.065, panXStart: -5, panXEnd: 6, panYStart: 5, panYEnd: 0, rotationStart: -0.06, rotationEnd: 0.07 }),
    Object.freeze({ zoomStart: 1.065, zoomEnd: 1.10, panXStart: 6, panXEnd: 0, panYStart: 0, panYEnd: -5, rotationStart: 0.07, rotationEnd: 0 }),
  ]),
  photoreal: Object.freeze([
    Object.freeze({ zoomStart: 1.025, zoomEnd: 1.06, panXStart: -4, panXEnd: 5, panYStart: 2, panYEnd: -2, rotationStart: -0.03, rotationEnd: 0.03 }),
    Object.freeze({ zoomStart: 1.06, zoomEnd: 1.085, panXStart: 5, panXEnd: 0, panYStart: -2, panYEnd: 3, rotationStart: 0.03, rotationEnd: 0 }),
    Object.freeze({ zoomStart: 1.085, zoomEnd: 1.05, panXStart: 0, panXEnd: -5, panYStart: 3, panYEnd: 0, rotationStart: 0, rotationEnd: -0.03 }),
    Object.freeze({ zoomStart: 1.05, zoomEnd: 1.085, panXStart: -5, panXEnd: 4, panYStart: 0, panYEnd: -3, rotationStart: -0.03, rotationEnd: 0.02 }),
  ]),
  cinematic: Object.freeze([
    Object.freeze({ zoomStart: 1.04, zoomEnd: 1.095, panXStart: -10, panXEnd: 8, panYStart: 5, panYEnd: -6, rotationStart: -0.18, rotationEnd: 0.12 }),
    Object.freeze({ zoomStart: 1.095, zoomEnd: 1.13, panXStart: 8, panXEnd: -8, panYStart: -6, panYEnd: 3, rotationStart: 0.12, rotationEnd: -0.10 }),
    Object.freeze({ zoomStart: 1.13, zoomEnd: 1.075, panXStart: -8, panXEnd: 10, panYStart: 3, panYEnd: 0, rotationStart: -0.10, rotationEnd: 0.15 }),
    Object.freeze({ zoomStart: 1.075, zoomEnd: 1.12, panXStart: 10, panXEnd: 0, panYStart: 0, panYEnd: -7, rotationStart: 0.15, rotationEnd: 0 }),
  ]),
  cartoon: Object.freeze([
    Object.freeze({ zoomStart: 1.055, zoomEnd: 1.15, panXStart: -18, panXEnd: 20, panYStart: 8, panYEnd: -10, rotationStart: -0.9, rotationEnd: 1.4 }),
    Object.freeze({ zoomStart: 1.15, zoomEnd: 1.09, panXStart: 20, panXEnd: -16, panYStart: -10, panYEnd: 12, rotationStart: 1.4, rotationEnd: -1.7 }),
    Object.freeze({ zoomStart: 1.09, zoomEnd: 1.18, panXStart: -16, panXEnd: 14, panYStart: 12, panYEnd: -5, rotationStart: -1.7, rotationEnd: 2.1 }),
    Object.freeze({ zoomStart: 1.18, zoomEnd: 1.10, panXStart: 14, panXEnd: 0, panYStart: -5, panYEnd: 0, rotationStart: 2.1, rotationEnd: -0.4 }),
  ]),
});

const BLOCKED_TREND_TERMS = [
  'shooting', 'shooter', 'murder', 'murdered', 'killed', 'death', 'dead', 'dies', 'died',
  'obituary', 'funeral', 'rape', 'assault', 'abuse', 'war', 'invasion', 'missile', 'bomb',
  'terror', 'terrorism', 'genocide', 'hostage', 'kidnap', 'missing person', 'earthquake',
  'hurricane', 'tornado', 'wildfire', 'flood', 'crash', 'accident', 'hospital', 'cancer',
  'suicide', 'overdose', 'election', 'president', 'senate', 'congress', 'governor',
  'prime minister', 'white house', 'supreme court', 'immigration raid', 'protest',
];

export function countWords(value = '') {
  const trimmed = String(value).trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function cleanPrompt(value = '') {
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function validatePrompt(value = '') {
  const prompt = cleanPrompt(value);
  const words = countWords(prompt);
  if (!prompt) return { ok: false, prompt, words, error: 'Give the machine something to rot.' };
  if (words > MAX_PROMPT_WORDS) {
    return { ok: false, prompt, words, error: `Keep it to ${MAX_PROMPT_WORDS} words or fewer.` };
  }
  return { ok: true, prompt, words, error: '' };
}

export function normalizeVisualStyle(value = 'cursed-real') {
  const key = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VISUAL_STYLE_PRESETS, key) ? key : 'cursed-real';
}

export function getVisualStylePreset(value = 'cursed-real') {
  return VISUAL_STYLE_PRESETS[normalizeVisualStyle(value)];
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function safeBurst(value, fallback) {
  const text = String(value || fallback || 'ROT')
    .replace(/[^a-z0-9!? ]/gi, '')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
  return text || 'ROT';
}

function safeField(value, fallback, max = 220) {
  return String(value || fallback || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || String(fallback || '').slice(0, max);
}

function hashString(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fallbackContinuity(prompt) {
  return {
    subject: `${prompt}, treated as one recurring believable live-action subject`,
    appearance: 'same recognizable subject, proportions, wardrobe/materials, and signature details in every scene',
    world: 'one coherent contemporary real-world environment that becomes increasingly absurd without changing visual identity',
    props: 'recurring everyday props introduced by the story remain visually consistent',
  };
}

function sceneVisualPrompt(scene, continuity, style) {
  const preset = getVisualStylePreset(style);
  return [
    preset.prompt,
    'vertical 9:16 social-video frame',
    `recurring subject: ${continuity.subject}`,
    `continuity: ${continuity.appearance}`,
    `setting: ${scene.setting}`,
    `action: ${scene.action}`,
    `camera: ${scene.camera}`,
    `mood: ${scene.mood}`,
    'show the described action clearly; no text, captions, logos, watermarks, UI, or speech bubbles inside the generated image',
  ].join('. ');
}

export function buildFallbackStory(promptValue, visualStyleValue = 'cursed-real') {
  const prompt = cleanPrompt(promptValue) || 'mystery brainrot';
  const visualStyle = normalizeVisualStyle(visualStyleValue);
  const seed = hashString(prompt);
  const noun = prompt.replace(/[.!?]+$/g, '');
  const continuity = fallbackContinuity(noun);
  const rows = [
    {
      text: `Emergency broadcast: ${noun} just arrived at the DMV with negative aura, and every person in line quietly notices something is wrong.`,
      setting: 'a fluorescent-lit American DMV waiting room with plastic chairs and a numbered-ticket display',
      action: `${noun} enters the DMV while ordinary people turn and stare`,
      camera: 'handheld eye-level medium-wide shot with a slow push in',
      mood: 'deadpan realism with one unsettling absurd detail',
      burst: 'AURA DETECTED',
    },
    {
      text: `A suspicious frog at the counter starts rating everybody's aura on a clipboard, while the clerk continues working like this is completely normal.`,
      setting: 'the same DMV service counter and waiting area',
      action: 'a realistic frog-like clerk marks aura scores on a clipboard while customers wait',
      camera: 'documentary over-the-shoulder shot, shallow depth of field',
      mood: 'mundane workplace realism colliding with impossible behavior',
      burst: 'AURA AUDIT',
    },
    {
      text: `Then the WiFi gains consciousness, the ticket monitor flashes nonsense, and every phone in the room reconnects to the same cursed network.`,
      setting: 'the same DMV, now focused on ceiling access points, ticket monitor, and customers holding phones',
      action: 'phones simultaneously reconnect while the ticket display glitches in a physically believable room',
      camera: 'slow rack focus from a phone screen to the ticket monitor',
      mood: 'grounded technological horror played as comedy',
      burst: 'WIFI AWAKENS',
    },
    {
      text: `Nobody leaves because a tiny shark in sunglasses rolls in with an official-looking cart and starts inspecting licenses with terrifying confidence.`,
      setting: 'the same DMV aisle between rows of plastic chairs',
      action: 'a small realistic shark-like creature in sunglasses pushes an office cart and inspects licenses',
      camera: 'low tracking shot following the cart through the waiting room',
      mood: 'absurd authority presented with serious documentary framing',
      burst: 'OFFICIAL BUSINESS',
    },
    {
      text: `At this point ${noun} unlocks forbidden rizz, stands under the worst fluorescent light imaginable, and somehow becomes the room's main character.`,
      setting: 'the same DMV under harsh overhead fluorescent fixtures',
      action: `${noun} stands confidently while the entire room subtly reorients attention toward them`,
      camera: 'slow cinematic push-in with restrained lens flare and shallow depth of field',
      mood: 'unearned cinematic importance inside a painfully ordinary place',
      burst: 'RIZZ UNLOCKED',
    },
    {
      text: `A random customer whispers plot twist, the floor display turns into a loading bar, and the line advances exactly one impossible inch.`,
      setting: 'the same DMV floor and queue ropes, with ordinary customers still present',
      action: 'a realistic illuminated loading-bar pattern appears across the floor while the queue inches forward',
      camera: 'top-down tilt into a wide reaction shot',
      mood: 'surreal event treated as a boring inconvenience',
      burst: 'PLOT TWIST',
    },
    {
      text: `The frog returns with printed receipts proving the entire disaster was a side quest, and every exhausted customer accepts this explanation immediately.`,
      setting: 'the same DMV counter with receipt printer, paperwork, and tired customers',
      action: 'frog clerk holds long printed receipts while customers study them with resigned expressions',
      camera: 'close-up on receipts, then gentle handheld pullback to the group',
      mood: 'bureaucratic realism with absurd lore payoff',
      burst: 'SIDE QUEST',
    },
    {
      text: `Final verdict: ${noun} survives, gains impossible lore, and walks out as the DMV doors close behind one completely defeated employee.`,
      setting: 'the DMV entrance at dusk, same visual world and recurring characters',
      action: `${noun} exits through automatic doors while the clerk watches from inside`,
      camera: 'cinematic rear three-quarter tracking shot ending on the closing doors',
      mood: 'triumphant but understated final shot with a deadpan punchline',
      burst: 'FULLY COOKED',
    },
  ];

  const scenes = rows.map((row, index) => {
    const scene = {
      text: row.text,
      color: PALETTE[(seed + index * 3) % PALETTE.length],
      burst: row.burst,
      subject: continuity.subject,
      setting: row.setting,
      action: row.action,
      camera: row.camera,
      mood: row.mood,
    };
    return { ...scene, visualPrompt: sceneVisualPrompt(scene, continuity, visualStyle) };
  });

  return { scenes, continuity, visualStyle, source: 'local' };
}

export function normalizeScenes(input, promptValue = 'brainrot', visualStyleValue = 'cursed-real', continuityValue = null) {
  const visualStyle = normalizeVisualStyle(visualStyleValue);
  const fallbackStory = buildFallbackStory(promptValue, visualStyle);
  const fallback = fallbackStory.scenes;
  const continuity = {
    ...fallbackStory.continuity,
    ...(continuityValue && typeof continuityValue === 'object' ? continuityValue : {}),
  };
  const provided = Array.isArray(input) ? input.slice(0, SCENE_COUNT) : [];

  return Array.from({ length: SCENE_COUNT }, (_, index) => {
    const candidate = provided[index] || fallback[index];
    const fallbackScene = fallback[index];
    const scene = {
      text: safeField(candidate?.text, fallbackScene.text, 360),
      color: safeColor(candidate?.color, fallbackScene.color),
      burst: safeBurst(candidate?.burst, fallbackScene.burst),
      subject: safeField(candidate?.subject, continuity.subject),
      setting: safeField(candidate?.setting, fallbackScene.setting),
      action: safeField(candidate?.action, fallbackScene.action),
      camera: safeField(candidate?.camera, fallbackScene.camera),
      mood: safeField(candidate?.mood, fallbackScene.mood),
    };
    scene.visualPrompt = safeField(
      candidate?.visualPrompt,
      sceneVisualPrompt(scene, continuity, visualStyle),
      1600,
    );
    if (!/vertical|9:16/i.test(scene.visualPrompt)) {
      scene.visualPrompt = `${scene.visualPrompt}. vertical 9:16 social-video frame`;
    }
    return scene;
  });
}

export function storyWordCount(scenes = []) {
  return scenes.reduce((sum, scene) => sum + countWords(scene?.text || ''), 0);
}

export function buildSceneTimeline(scenes = [], totalSeconds = TARGET_SECONDS) {
  if (!Array.isArray(scenes) || scenes.length === 0) return [];
  const weights = scenes.map(scene => Math.max(1, countWords(scene?.text || '')));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return scenes.map((scene, index) => {
    const start = cursor;
    const duration = index === scenes.length - 1
      ? totalSeconds - start
      : (weights[index] / totalWeight) * totalSeconds;
    cursor = index === scenes.length - 1 ? totalSeconds : start + duration;
    return { ...scene, start, end: cursor, duration: cursor - start };
  });
}


const MICRO_SHOT_MOTION = Object.freeze({
  'cursed-real': Object.freeze([
    Object.freeze({ zoomStart: 1.015, zoomEnd: 1.050, xStart: -10, xEnd: 8, yStart: 6, yEnd: -4, rotationStart: -0.08, rotationEnd: 0.06 }),
    Object.freeze({ zoomStart: 1.050, zoomEnd: 1.080, xStart: 8, xEnd: -6, yStart: -4, yEnd: 3, rotationStart: 0.06, rotationEnd: -0.05 }),
    Object.freeze({ zoomStart: 1.080, zoomEnd: 1.105, xStart: -6, xEnd: 5, yStart: 3, yEnd: -7, rotationStart: -0.05, rotationEnd: 0.04 }),
    Object.freeze({ zoomStart: 1.105, zoomEnd: 1.125, xStart: 5, xEnd: 0, yStart: -7, yEnd: 0, rotationStart: 0.04, rotationEnd: 0 }),
  ]),
  photoreal: Object.freeze([
    Object.freeze({ zoomStart: 1.010, zoomEnd: 1.040, xStart: -8, xEnd: 5, yStart: 4, yEnd: -3, rotationStart: -0.04, rotationEnd: 0.03 }),
    Object.freeze({ zoomStart: 1.040, zoomEnd: 1.065, xStart: 5, xEnd: -4, yStart: -3, yEnd: 2, rotationStart: 0.03, rotationEnd: -0.03 }),
    Object.freeze({ zoomStart: 1.065, zoomEnd: 1.085, xStart: -4, xEnd: 4, yStart: 2, yEnd: -5, rotationStart: -0.03, rotationEnd: 0.02 }),
    Object.freeze({ zoomStart: 1.085, zoomEnd: 1.100, xStart: 4, xEnd: 0, yStart: -5, yEnd: 0, rotationStart: 0.02, rotationEnd: 0 }),
  ]),
  cinematic: Object.freeze([
    Object.freeze({ zoomStart: 1.020, zoomEnd: 1.065, xStart: -16, xEnd: 10, yStart: 7, yEnd: -5, rotationStart: -0.10, rotationEnd: 0.08 }),
    Object.freeze({ zoomStart: 1.065, zoomEnd: 1.105, xStart: 10, xEnd: -9, yStart: -5, yEnd: 4, rotationStart: 0.08, rotationEnd: -0.07 }),
    Object.freeze({ zoomStart: 1.105, zoomEnd: 1.135, xStart: -9, xEnd: 7, yStart: 4, yEnd: -8, rotationStart: -0.07, rotationEnd: 0.06 }),
    Object.freeze({ zoomStart: 1.135, zoomEnd: 1.155, xStart: 7, xEnd: 0, yStart: -8, yEnd: 0, rotationStart: 0.06, rotationEnd: 0 }),
  ]),
  cartoon: Object.freeze([
    Object.freeze({ zoomStart: 1.025, zoomEnd: 1.090, xStart: -22, xEnd: 16, yStart: 10, yEnd: -8, rotationStart: -0.55, rotationEnd: 0.80 }),
    Object.freeze({ zoomStart: 1.090, zoomEnd: 1.145, xStart: 16, xEnd: -18, yStart: -8, yEnd: 9, rotationStart: 0.80, rotationEnd: -0.95 }),
    Object.freeze({ zoomStart: 1.145, zoomEnd: 1.185, xStart: -18, xEnd: 13, yStart: 9, yEnd: -12, rotationStart: -0.95, rotationEnd: 0.70 }),
    Object.freeze({ zoomStart: 1.185, zoomEnd: 1.205, xStart: 13, xEnd: 0, yStart: -12, yEnd: 0, rotationStart: 0.70, rotationEnd: 0 }),
  ]),
});

export function buildMicroShotTimeline(sceneTimeline = [], visualStyleValue = 'cursed-real') {
  if (!Array.isArray(sceneTimeline) || sceneTimeline.length === 0) return [];
  const visualStyle = normalizeVisualStyle(visualStyleValue);
  const motionSet = MICRO_SHOT_MOTION[visualStyle] || MICRO_SHOT_MOTION['cursed-real'];
  const shots = [];

  sceneTimeline.forEach((scene, sceneIndex) => {
    const sceneDuration = Math.max(0, Number(scene?.duration) || (Number(scene?.end) - Number(scene?.start)) || 0);
    const sceneStart = Number(scene?.start) || 0;
    const shotDuration = sceneDuration / MICRO_SHOTS_PER_SCENE;

    for (let shotIndex = 0; shotIndex < MICRO_SHOTS_PER_SCENE; shotIndex += 1) {
      const start = sceneStart + shotDuration * shotIndex;
      const end = shotIndex === MICRO_SHOTS_PER_SCENE - 1
        ? Number(scene?.end)
        : sceneStart + shotDuration * (shotIndex + 1);
      const previousGlobalShotIndex = shots.length ? shots.length - 1 : null;
      shots.push({
        sceneIndex,
        shotIndex,
        globalShotIndex: shots.length,
        sourceImageIndex: sceneIndex,
        transitionFromSceneIndex: shotIndex === 0 && sceneIndex > 0 ? sceneIndex - 1 : sceneIndex,
        transitionFromGlobalShotIndex: previousGlobalShotIndex,
        start,
        end,
        duration: end - start,
        visualStyle,
        phase: ['establish', 'push', 'reaction', 'handoff'][shotIndex],
        transitionBlend: shotIndex === 0 && sceneIndex > 0 ? 0.28 : 0,
        motion: { ...motionSet[shotIndex] },
      });
    }
  });

  return shots;
}

export function buildMicroShotTimeline(sceneTimeline = [], visualStyleValue = 'cursed-real') {
  if (!Array.isArray(sceneTimeline) || sceneTimeline.length === 0) return [];
  const visualStyle = normalizeVisualStyle(visualStyleValue);
  const motions = MICRO_SHOT_MOTION_PRESETS[visualStyle] || MICRO_SHOT_MOTION_PRESETS['cursed-real'];
  const shots = [];

  sceneTimeline.forEach((scene, sceneIndex) => {
    const sceneStart = Number(scene?.start) || 0;
    const sceneEnd = Number(scene?.end);
    const safeSceneEnd = Number.isFinite(sceneEnd) ? Math.max(sceneStart, sceneEnd) : sceneStart;
    const sceneDuration = safeSceneEnd - sceneStart;

    for (let shotIndex = 0; shotIndex < MICRO_SHOTS_PER_SCENE; shotIndex += 1) {
      const start = shotIndex === 0
        ? sceneStart
        : sceneStart + (sceneDuration * shotIndex) / MICRO_SHOTS_PER_SCENE;
      const end = shotIndex === MICRO_SHOTS_PER_SCENE - 1
        ? safeSceneEnd
        : sceneStart + (sceneDuration * (shotIndex + 1)) / MICRO_SHOTS_PER_SCENE;
      shots.push({
        ...scene,
        sceneIndex,
        shotIndex,
        sourceImageIndex: sceneIndex,
        visualStyle,
        start,
        end,
        duration: end - start,
        transitionFromSceneIndex: shotIndex === 0 && sceneIndex > 0 ? sceneIndex - 1 : null,
        motion: { ...motions[shotIndex % motions.length] },
      });
    }
  });

  return shots;
}

export function isSafeTrend(value = '') {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  return normalized.trim().length > 1 && !BLOCKED_TREND_TERMS.some(term => normalized.includes(term));
}

export function trendToPrompt(value = '') {
  const cleaned = String(value)
    .replace(/[<>]/g, '')
    .replace(/[^\p{L}\p{N}' -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'mystery meme with zero aura';

  const modifier = MODIFIERS[hashString(cleaned) % MODIFIERS.length];
  const words = `${cleaned} ${modifier}`.split(/\s+/).filter(Boolean).slice(0, MAX_PROMPT_WORDS);
  return words.join(' ');
}

export function captionWindow(words = [], activeIndex = 0, windowSize = 7) {
  if (!words.length) return { words: [], localActiveIndex: 0 };
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(words.length - windowSize, activeIndex - half));
  const slice = words.slice(start, start + windowSize);
  return { words: slice, localActiveIndex: activeIndex - start };
}
