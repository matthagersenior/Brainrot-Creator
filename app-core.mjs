export const MAX_PROMPT_WORDS = 60;
export const MAX_PROMPT_CHARS = 500;
export const TREND_PROMPT_WORDS = 12;
export const TARGET_SECONDS = 60;
export const SCENE_COUNT = 8;

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
    prompt: 'contemporary brainrot visual language, original surreal AI meme character, animal-object or mascot-object hybrid when it fits the prompt, uncanny polished 3D-photoreal texture, exaggerated memorable silhouette, absurd prop mashup, short-form social-video energy, believable lighting, no copied named meme character, no anime, no flat vector art',
  }),
  photoreal: Object.freeze({
    label: 'PHOTOREAL',
    prompt: 'photoreal brainrot meme world, original surreal hybrid protagonist rendered with convincing real materials and lighting, uncanny but coherent anatomy, bold absurd object fusion, recognizable repeatable silhouette, documentary detail, short-form meme energy, no copied named meme character, no anime, no flat illustration',
  }),
  cinematic: Object.freeze({
    label: 'CINEMATIC',
    prompt: 'cinematic brainrot meme world, original surreal hybrid protagonist with a memorable mascot-like silhouette, absurd physical mashup rendered as premium live-action VFX, dramatic short-form framing, motivated lighting, shallow depth of field, natural textures, no copied named meme character, no anime',
  }),
  cartoon: Object.freeze({
    label: 'BRAINROT CARTOON',
    prompt: 'stylized contemporary brainrot cartoon, original absurd hybrid meme character, exaggerated silhouette and facial reaction, object-animal mashup, bold saturated color, chaotic short-form comedy energy, highly recognizable recurring design, no copied named meme character',
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
    .slice(0, MAX_PROMPT_CHARS);
}

export function validatePrompt(value = '') {
  const prompt = cleanPrompt(value);
  const words = countWords(prompt);
  if (!prompt) return { ok: false, prompt, words, error: 'Give the machine something to rot.' };
  if (words > MAX_PROMPT_WORDS) {
    return { ok: false, prompt, words, error: `Keep it to ${MAX_PROMPT_WORDS} words or fewer so the one-minute story stays focused.` };
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

function sceneVisualPrompt(scene, continuity, style, visualMoment = '') {
  const preset = getVisualStylePreset(style);
  return [
    preset.prompt,
    'vertical 9:16 social-video frame',
    `exact narrated line: "${scene.text}"`,
    `exact visible moment: ${visualMoment || scene.action}`,
    `recurring subject: ${continuity.subject}`,
    `continuity: ${continuity.appearance}`,
    `setting: ${scene.setting}`,
    `scene action: ${scene.action}`,
    `camera: ${scene.camera}`,
    `mood: ${scene.mood}`,
    'the picture must visibly prove the narrated action; prioritize literal story objects and actions over generic character posing',
    'show a clear recognizable focal subject performing the described physical action in the literal location; do not turn abstract concepts into text, symbols, fog, blobs, or graphics',
    'keep signs, screens, paperwork, labels, and displays blank, unreadable, defocused, or too small to read',
    'no text, captions, logos, watermarks, UI, title cards, posters, or speech bubbles inside the generated image',
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
      text: `Emergency broadcast: ${noun} reaches the DMV, and the whole waiting room quietly notices something is off.`,
      setting: 'a fluorescent-lit American DMV waiting room with plastic chairs and a numbered-ticket display',
      action: `${noun} enters the DMV while ordinary people turn and stare`,
      camera: 'handheld eye-level medium-wide shot with a slow push in',
      mood: 'deadpan realism with one unsettling absurd detail',
      burst: 'AURA DETECTED',
    },
    {
      text: `A suspicious frog checks the clipboard and says, "Aura audit started," while the clerk keeps stamping forms.`,
      setting: 'the same DMV service counter and waiting area',
      action: 'a realistic frog-like clerk marks aura scores on a clipboard while customers wait',
      camera: 'documentary over-the-shoulder shot, shallow depth of field',
      mood: 'mundane workplace realism colliding with impossible behavior',
      burst: 'AURA AUDIT',
    },
    {
      text: `Then the WiFi wakes up, every phone reconnects, and the ticket monitor starts calling impossible numbers.`,
      setting: 'the same DMV, now focused on ceiling access points, ticket monitor, and customers holding phones',
      action: 'phones simultaneously reconnect while the ticket display glitches in a physically believable room',
      camera: 'slow rack focus from a phone screen to the ticket monitor',
      mood: 'grounded technological horror played as comedy',
      burst: 'WIFI AWAKENS',
    },
    {
      text: `A tiny shark in sunglasses rolls in, inspecting licenses like the most confident supervisor alive.`,
      setting: 'the same DMV aisle between rows of plastic chairs',
      action: 'a small realistic shark-like creature in sunglasses pushes an office cart and inspects licenses',
      camera: 'low tracking shot following the cart through the waiting room',
      mood: 'absurd authority presented with serious documentary framing',
      burst: 'OFFICIAL BUSINESS',
    },
    {
      text: `${noun} steps under the fluorescent lights, finds forbidden confidence, and somehow becomes the room's main character.`,
      setting: 'the same DMV under harsh overhead fluorescent fixtures',
      action: `${noun} stands confidently while the entire room subtly reorients attention toward them`,
      camera: 'slow cinematic push-in with restrained lens flare and shallow depth of field',
      mood: 'unearned cinematic importance inside a painfully ordinary place',
      burst: 'RIZZ UNLOCKED',
    },
    {
      text: `The frog whispers, "Plot twist," and the entire line advances exactly one ridiculous inch.`,
      setting: 'the same DMV floor and queue ropes, with ordinary customers still present',
      action: 'a realistic illuminated loading-bar pattern appears across the floor while the queue inches forward',
      camera: 'top-down tilt into a wide reaction shot',
      mood: 'surreal event treated as a boring inconvenience',
      burst: 'PLOT TWIST',
    },
    {
      text: `The frog prints a receipt, says, "Side quest complete," and every exhausted customer accepts it.`,
      setting: 'the same DMV counter with receipt printer, paperwork, and tired customers',
      action: 'frog clerk holds long printed receipts while customers study them with resigned expressions',
      camera: 'close-up on receipts, then gentle handheld pullback to the group',
      mood: 'bureaucratic realism with absurd lore payoff',
      burst: 'SIDE QUEST',
    },
    {
      text: `Final verdict: ${noun} walks out victorious while the DMV doors close behind one completely defeated employee.`,
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
      visualBeats: [
        `opening visible instant of this action: ${row.action}`,
        `a clearly later visible consequence of the same action: ${row.action}`,
      ],
    };
    return {
      ...scene,
      visualPrompt: sceneVisualPrompt(scene, continuity, visualStyle, scene.visualBeats[0]),
    };
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
    const candidateBeats = Array.isArray(candidate?.visualBeats) ? candidate.visualBeats : [];
    const fallbackBeats = Array.isArray(fallbackScene?.visualBeats) ? fallbackScene.visualBeats : [];
    scene.visualBeats = [
      safeField(candidateBeats[0], fallbackBeats[0] || scene.action, 320),
      safeField(candidateBeats[1], fallbackBeats[1] || `visible continuation and consequence of: ${scene.action}`, 320),
    ];
    // Never trust a provider-authored image prompt over the actual narrated beat.
    // Rebuild the prompt deterministically from the normalized story fields.
    scene.visualPrompt = sceneVisualPrompt(
      scene,
      continuity,
      visualStyle,
      scene.visualBeats[0],
    );
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
  const words = `${cleaned} ${modifier}`.split(/\s+/).filter(Boolean).slice(0, TREND_PROMPT_WORDS);
  return words.join(' ');
}

export function captionWindow(words = [], activeIndex = 0, windowSize = 6) {
  if (!words.length) return { words: [], localActiveIndex: 0 };
  const safeActive = Math.max(0, Math.min(words.length - 1, activeIndex));
  const safeWindow = Math.max(3, windowSize);
  let start = 0;

  for (let index = 0; index < words.length; index += 1) {
    const count = index - start + 1;
    const punctuationBreak = count >= 3 && /[.!?,;:](?:["')\]]*)$/.test(String(words[index]));
    const sizeBreak = count >= safeWindow;
    const finalWord = index === words.length - 1;
    if (!punctuationBreak && !sizeBreak && !finalWord) continue;

    if (safeActive <= index) {
      const slice = words.slice(start, index + 1);
      return { words: slice, localActiveIndex: safeActive - start };
    }
    start = index + 1;
  }

  const fallbackStart = Math.max(0, words.length - safeWindow);
  return {
    words: words.slice(fallbackStart),
    localActiveIndex: safeActive - fallbackStart,
  };
}

export function pacedWordIndex(words = [], progress = 0) {
  if (!words.length) return 0;
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const weights = words.map(word => {
    const text = String(word || '');
    const letters = text.replace(/[^\p{L}\p{N}]/gu, '').length;
    let weight = 0.88 + Math.min(0.52, letters / 18);
    if (/[.!?](?:["')\]]*)$/.test(text)) weight += 1.35;
    else if (/[,;:](?:["')\]]*)$/.test(text)) weight += 0.62;
    return weight;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = clamped * total;
  let cursor = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index];
    if (target <= cursor) return index;
  }
  return words.length - 1;
}


export function timedWordIndex(timings = [], seconds = 0) {
  if (!Array.isArray(timings) || timings.length === 0) return null;
  const time = Math.max(0, Number(seconds) || 0);
  let active = timings[0];

  for (const timing of timings) {
    const start = Number(timing?.start);
    if (!Number.isFinite(start)) continue;
    if (start <= time) active = timing;
    else break;
  }

  const index = Number(active?.scriptIndex);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function syncedWordIndex(timings = [], seconds = 0, totalWords = 0, durationSeconds = 0) {
  const wordCount = Math.max(0, Number.parseInt(totalWords, 10) || 0);
  if (!wordCount) return null;

  const duration = Math.max(0, Number(durationSeconds) || 0);
  const time = Math.max(0, Number(seconds) || 0);
  const anchors = (Array.isArray(timings) ? timings : [])
    .map(timing => ({
      start: Number(timing?.start),
      scriptIndex: Number(timing?.scriptIndex),
    }))
    .filter(anchor => Number.isFinite(anchor.start)
      && Number.isInteger(anchor.scriptIndex)
      && anchor.scriptIndex >= 0
      && anchor.scriptIndex < wordCount)
    .sort((a, b) => a.start - b.start)
    .filter((anchor, index, list) => index === 0 || anchor.scriptIndex >= list[index - 1].scriptIndex);

  if (!anchors.length || duration <= 0) {
    return Math.min(wordCount - 1, Math.floor((Math.min(time, Math.max(duration, 1)) / Math.max(duration, 1)) * wordCount));
  }

  const interpolate = (fromTime, toTime, fromIndex, toIndex) => {
    if (toTime <= fromTime) return toIndex;
    const progress = Math.max(0, Math.min(1, (time - fromTime) / (toTime - fromTime)));
    return Math.max(0, Math.min(wordCount - 1, Math.round(fromIndex + (toIndex - fromIndex) * progress)));
  };

  const first = anchors[0];
  if (time <= first.start) {
    return interpolate(0, Math.max(first.start, 0.001), 0, first.scriptIndex);
  }

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index];
    const next = anchors[index + 1];
    if (time <= next.start) {
      return interpolate(current.start, next.start, current.scriptIndex, next.scriptIndex);
    }
  }

  const last = anchors[anchors.length - 1];
  return interpolate(last.start, Math.max(duration, last.start + 0.001), last.scriptIndex, wordCount - 1);
}

const CHAOS_MISSIONS = Object.freeze([
  Object.freeze({ type: 'collect', glyph: '🐸', target: 3, label: 'TAP 3 FROGS' }),
  Object.freeze({ type: 'streak', target: 5, label: 'HIT 5 IN A ROW' }),
  Object.freeze({ type: 'total', target: 10, label: 'POP 10 THINGS' }),
  Object.freeze({ type: 'selective', glyphs: Object.freeze(['🐸', '🍌', '🐟']), target: 6, label: 'ONLY 🐸 🍌 🐟 · HIT 6' }),
]);

export function createChaosMission(index = 0) {
  const safeIndex = Math.abs(Number.parseInt(index, 10) || 0) % CHAOS_MISSIONS.length;
  return {
    ...CHAOS_MISSIONS[safeIndex],
    index: safeIndex,
    progress: 0,
    complete: false,
  };
}

export function advanceChaosMission(mission, event = {}) {
  if (!mission || mission.complete || event.hit !== true) return mission;
  const next = { ...mission };
  const glyph = String(event.glyph || '');

  if (next.type === 'collect') {
    if (glyph === next.glyph) next.progress += 1;
  } else if (next.type === 'streak' || next.type === 'total') {
    next.progress += 1;
  } else if (next.type === 'selective') {
    if (Array.isArray(next.glyphs) && next.glyphs.includes(glyph)) next.progress += 1;
  }

  next.progress = Math.max(0, Math.min(next.target, next.progress));
  next.complete = next.progress >= next.target;
  return next;
}
