export const MAX_PROMPT_WORDS = 9;
export const TARGET_SECONDS = 60;
export const SCENE_COUNT = 8;

const PALETTE = ['#ff2ec4', '#00e5ff', '#c6ff00', '#ff4d1c', '#8c52ff', '#ff9f1c', '#24f28b', '#ff5e8a'];
const EMOJIS = ['💀', '🧠', '🚽', '🌀', '🐸', '🦈', '👽', '🦐'];
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

function hashString(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildFallbackStory(promptValue) {
  const prompt = cleanPrompt(promptValue) || 'mystery brainrot';
  const seed = hashString(prompt);
  const noun = prompt.replace(/[.!?]+$/g, '');
  const rows = [
    `Emergency broadcast: ${noun} just spawned with negative aura and absolutely nobody has the tutorial for this situation.`,
    `The group chat instantly declares it sigma, but one suspicious frog starts charging everybody a completely imaginary fanum tax.`,
    `Then the WiFi gains consciousness, whispers Ohio three times, and reroutes the entire operation through a haunted fast food drive thru.`,
    `Nobody questions it because a tiny shark in sunglasses is mewing aggressively while holding a clipboard marked extremely official business.`,
    `At this point the lore gets worse: ${noun} unlocks forbidden rizz and the background music legally becomes seventeen percent louder.`,
    `A random NPC screams plot twist, the floor becomes a loading screen, and every remaining brain cell submits a resignation letter.`,
    `Just when the aura meter hits zero, the frog returns with receipts and reveals this entire disaster was actually a side quest.`,
    `Final verdict: ${noun} survives, gains impossible lore, and gets permanently banned from normal conversations for being way too cooked.`,
  ];

  const scenes = rows.map((text, index) => ({
    text,
    emoji: EMOJIS[(seed + index) % EMOJIS.length],
    color: PALETTE[(seed + index * 3) % PALETTE.length],
    burst: ['AURA LOSS', 'FANUM TAX', 'OHIO WIFI', 'OFFICIAL LORE', 'RIZZ UNLOCKED', 'PLOT TWIST', 'SIDE QUEST', 'FULLY COOKED'][index],
  }));

  return { scenes, source: 'local' };
}

export function normalizeScenes(input, promptValue = 'brainrot') {
  const fallback = buildFallbackStory(promptValue).scenes;
  const provided = Array.isArray(input) ? input.slice(0, SCENE_COUNT) : [];
  const scenes = Array.from({ length: SCENE_COUNT }, (_, index) => {
    const candidate = provided[index] || fallback[index];
    const fallbackScene = fallback[index];
    const text = String(candidate?.text || fallbackScene.text)
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 360) || fallbackScene.text;
    const emoji = String(candidate?.emoji || fallbackScene.emoji).trim().slice(0, 8) || fallbackScene.emoji;
    return {
      text,
      emoji,
      color: safeColor(candidate?.color, fallbackScene.color),
      burst: safeBurst(candidate?.burst, fallbackScene.burst),
    };
  });
  return scenes;
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
