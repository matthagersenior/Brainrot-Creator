import {
  MAX_PROMPT_WORDS,
  TARGET_SECONDS,
  countWords,
  validatePrompt,
  buildFallbackStory,
  normalizeScenes,
  buildSceneTimeline,
  buildMicroShotTimeline,
  isSafeTrend,
  trendToPrompt,
  captionWindow,
  pacedWordIndex,
  timedWordIndex,
  createChaosMission,
  advanceChaosMission,
  storyWordCount,
  normalizeVisualStyle,
  getVisualStylePreset,
} from './app-core.mjs';

const VISUAL_FRAMES_PER_SCENE = 2;

const FALLBACK_TRENDS = [
  'Nintendo', 'Minecraft', 'Roblox', 'Fortnite', 'viral dance challenge', 'anime opening',
  'streamer speedrun', 'mystery mascot', 'football celebration', 'movie trailer reaction', 'AI pet', 'retro game remake',
];

const PUTER_IMAGE_MODELS = Object.freeze([
  Object.freeze({ provider: 'replicate-image-generation', model: 'black-forest-labs/flux-schnell', label: 'Puter · FLUX Schnell' }),
  Object.freeze({ provider: 'replicate-image-generation', model: 'leonardoai/lucid-origin', label: 'Puter · Leonardo Lucid Origin' }),
]);

const PUTER_TTS_FALLBACKS = Object.freeze([
  Object.freeze({ options: { provider: 'openai', model: 'tts-1-hd', voice: 'nova' }, label: 'Puter · OpenAI HD voice' }),
  Object.freeze({ options: { voice: 'Joanna', engine: 'neural' }, label: 'Puter · neural voice' }),
]);

const CHAOS_OBJECTS = Object.freeze([
  Object.freeze({ glyph: '🐸', points: 15, scale: 1.05 }),
  Object.freeze({ glyph: '🍌', points: 10, scale: 1.0 }),
  Object.freeze({ glyph: '🐟', points: 20, scale: 1.05 }),
  Object.freeze({ glyph: '🧻', points: 12, scale: 1.0 }),
  Object.freeze({ glyph: '🛒', points: 18, scale: 1.0 }),
  Object.freeze({ glyph: '👁️', points: 22, scale: .95 }),
  Object.freeze({ glyph: '📎', points: 14, scale: 1.0 }),
  Object.freeze({ glyph: '⚠️', points: 16, scale: .95 }),
  Object.freeze({ glyph: '🧃', points: 13, scale: 1.0 }),
  Object.freeze({ glyph: '🦆', points: 21, scale: 1.0 }),
  Object.freeze({ glyph: '🧦', points: 11, scale: 1.0 }),
  Object.freeze({ glyph: '🌀', points: 25, scale: .95 }),
]);

const CHAOS_COLORS = Object.freeze(['#ff2ec4', '#00e5ff', '#c6ff00', '#8c52ff', '#ffb020', '#ff5b21']);

const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');
const promptInput = document.getElementById('promptInput');
const wordMeter = document.getElementById('wordMeter');
const trendRail = document.getElementById('trendRail');
const trendSource = document.getElementById('trendSource');
const chaosSelect = document.getElementById('chaosSelect');
const visualStyleSelect = document.getElementById('visualStyleSelect');
const installBtn = document.getElementById('installBtn');
const installHint = document.getElementById('installHint');
const genBtn = document.getElementById('genBtn');
const quickBtn = document.getElementById('quickBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const storySourceEl = document.getElementById('storySource');
const voiceSourceEl = document.getElementById('voiceSource');
const visualSourceEl = document.getElementById('visualSource');
const trendSourcePill = document.getElementById('trendSourcePill');
const resultVisualSourceEl = document.getElementById('resultVisualSource');
const resultVoiceSourceEl = document.getElementById('resultVoiceSource');
const createView = document.getElementById('createView');
const cookingView = document.getElementById('cookingView');
const resultView = document.getElementById('resultView');
const loadingProgress = document.getElementById('loadingProgress');
const chaosCanvas = document.getElementById('chaosCanvas');
const chaosCtx = chaosCanvas?.getContext('2d');
const chaosScoreEl = document.getElementById('chaosScore');
const chaosComboEl = document.getElementById('chaosCombo');
const chaosProgressRing = document.getElementById('chaosProgressRing');
const chaosProgressText = document.getElementById('chaosProgressText');
const chaosMissionEl = document.getElementById('chaosMission');
const chaosMissionProgressEl = document.getElementById('chaosMissionProgress');
const chaosReady = document.getElementById('chaosReady');
const resultTitle = document.getElementById('resultTitle');
const resultStyle = document.getElementById('resultStyle');
const playPauseBtn = document.getElementById('playPauseBtn');
const repeatBtn = document.getElementById('repeatBtn');
const nextTrendBtn = document.getElementById('nextTrendBtn');
const homeBtn = document.getElementById('homeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadNote = document.getElementById('downloadNote');
const scriptWordsEl = document.getElementById('scriptWords');
const sceneCountEl = document.getElementById('sceneCount');
const videoLengthEl = document.getElementById('videoLength');

canvas.width = 720;
canvas.height = 1280;

let deferredInstallPrompt = null;

const state = {
  trends: [...FALLBACK_TRENDS],
  trendSource: 'built-in rotation',
  story: null,
  timeline: [],
  microTimeline: [],
  storySource: 'local fallback',
  voiceSource: 'AI voice pending',
  visualSource: 'AI imagery pending',
  visualGeneratedCount: 0,
  visualCoveredCount: 0,
  visualErrors: [],
  visualStyle: 'cursed-real',
  sceneImages: [],
  sceneFrames: [],
  audioBuffer: null,
  audioContext: null,
  audioSource: null,
  mediaDestination: null,
  recorder: null,
  recordStream: null,
  recordChunks: [],
  recording: false,
  recordingAborted: false,
  playing: false,
  paused: false,
  pauseStartedAt: 0,
  currentView: 'create',
  startedAt: 0,
  raf: 0,
  stopTimer: 0,
  speechWordIndex: null,
  narrationPlaybackRate: 1,
  narrationPlaybackSeconds: TARGET_SECONDS,
  wordTimings: [],
  timingSource: 'estimated',
  generateToken: 0,
  cookingRaf: 0,
  cookingLastFrameAt: 0,
  cookingStartedAt: 0,
  cookingNextSpawnAt: 0,
  cookingObjects: [],
  cookingParticles: [],
  cookingScore: 0,
  cookingCombo: 1,
  cookingLastHitAt: 0,
  cookingProgressTarget: 0,
  cookingProgressDisplay: 0,
  cookingReady: false,
  cookingMissionIndex: -1,
  cookingMission: null,
  cookingMissionCompletedAt: 0,
};

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator.standalone === true;
}

function refreshInstallUi(message = '') {
  if (!installBtn || !installHint) return;
  if (isStandaloneApp()) {
    installBtn.hidden = true;
    installHint.hidden = true;
    return;
  }
  installBtn.hidden = false;
  installHint.hidden = false;
  installBtn.textContent = deferredInstallPrompt ? 'INSTALL APP' : 'ADD TO DEVICE';
  installHint.textContent = message || (deferredInstallPrompt
    ? 'ROT MACHINE is ready to install as a standalone app.'
    : 'Use this button for install guidance, or your browser’s Install app / Add to Home Screen command.');
}

async function installApp() {
  if (isStandaloneApp()) {
    refreshInstallUi();
    return;
  }

  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    refreshInstallUi(choice?.outcome === 'accepted'
      ? 'Install accepted. ROT MACHINE will appear with your apps.'
      : 'Install dismissed. You can install later from the browser menu.');
    return;
  }

  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  refreshInstallUi(isiOS
    ? 'On iPhone/iPad: tap Share, then Add to Home Screen.'
    : 'Open your browser menu and choose Install app or Add to Home Screen.');
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refreshInstallUi('ROT MACHINE is ready to install as a standalone app.');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  refreshInstallUi('Installed. Launch ROT MACHINE from your app screen.');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      refreshInstallUi('The app is online, but offline install support could not start in this browser.');
    });
  }, { once: true });
}

function setView(view) {
  const views = { create: createView, cooking: cookingView, result: resultView };
  const next = views[view] || createView;
  Object.entries(views).forEach(([name, element]) => {
    element.hidden = element !== next;
    element.setAttribute('aria-hidden', element === next ? 'false' : 'true');
    if (element === next) state.currentView = name;
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function updateChaosHud() {
  if (chaosScoreEl) chaosScoreEl.textContent = String(state.cookingScore);
  if (chaosComboEl) chaosComboEl.textContent = `×${state.cookingCombo}`;
  const progress = Math.max(0, Math.min(1, state.cookingProgressDisplay));
  if (chaosProgressText) chaosProgressText.textContent = `${Math.round(progress * 100)}%`;
  if (chaosProgressRing) {
    const circumference = 113.1;
    chaosProgressRing.style.strokeDashoffset = String(circumference * (1 - progress));
  }

  const mission = state.cookingMission;
  if (chaosMissionEl && mission) {
    chaosMissionEl.textContent = mission.complete ? 'MISSION COMPLETE +250' : mission.label;
  }
  if (chaosMissionProgressEl && mission) {
    chaosMissionProgressEl.textContent = `${mission.progress}/${mission.target}`;
  }
}

function resetLoadingGallery() {
  state.cookingObjects = [];
  state.cookingParticles = [];
  state.cookingScore = 0;
  state.cookingCombo = 1;
  state.cookingLastHitAt = 0;
  state.cookingProgressTarget = 0.04;
  state.cookingProgressDisplay = 0;
  state.cookingReady = false;
  state.cookingMissionIndex += 1;
  state.cookingMission = createChaosMission(state.cookingMissionIndex);
  state.cookingMissionCompletedAt = 0;
  if (chaosReady) chaosReady.hidden = true;
  if (loadingProgress) loadingProgress.textContent = 'Preparing your video.';
  updateChaosHud();
}

function setCookingProgress(value) {
  state.cookingProgressTarget = Math.max(state.cookingProgressTarget, Math.min(1, Number(value) || 0));
}

function spawnChaosObject(now) {
  if (!chaosCanvas || state.cookingObjects.length >= 15) return;
  const spec = CHAOS_OBJECTS[Math.floor(Math.random() * CHAOS_OBJECTS.length)];
  const radius = randomRange(34, 55);
  const edge = Math.floor(Math.random() * 4);
  let x = randomRange(radius, chaosCanvas.width - radius);
  let y = randomRange(radius, chaosCanvas.height - radius);
  let vx = randomRange(-95, 95);
  let vy = randomRange(-95, 95);

  if (edge === 0) { y = -radius; vy = randomRange(75, 145); }
  if (edge === 1) { x = chaosCanvas.width + radius; vx = -randomRange(75, 145); }
  if (edge === 2) { y = chaosCanvas.height + radius; vy = -randomRange(75, 145); }
  if (edge === 3) { x = -radius; vx = randomRange(75, 145); }

  state.cookingObjects.push({
    ...spec,
    x,
    y,
    vx,
    vy,
    radius,
    rotation: randomRange(-Math.PI, Math.PI),
    spin: randomRange(-1.8, 1.8),
    wobble: randomRange(0, Math.PI * 2),
    color: CHAOS_COLORS[Math.floor(Math.random() * CHAOS_COLORS.length)],
  });
  state.cookingNextSpawnAt = now + randomRange(300, 620);
}

function burstChaos(object, x = object.x, y = object.y) {
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14 + randomRange(-.18, .18);
    const speed = randomRange(110, 310);
    state.cookingParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(.45, .85),
      age: 0,
      size: randomRange(4, 11),
      color: i % 3 === 0 ? '#ffffff' : object.color,
    });
  }
}

function handleChaosTap(event) {
  if (!chaosCanvas || state.currentView !== 'cooking' || state.cookingReady) return;
  const rect = chaosCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * chaosCanvas.width;
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * chaosCanvas.height;
  let hitIndex = -1;
  let hitDistance = Infinity;

  state.cookingObjects.forEach((object, index) => {
    const distance = Math.hypot(object.x - x, object.y - y);
    if (distance <= object.radius * 1.35 && distance < hitDistance) {
      hitIndex = index;
      hitDistance = distance;
    }
  });

  if (hitIndex < 0) {
    state.cookingCombo = 1;
    updateChaosHud();
    return;
  }

  const [object] = state.cookingObjects.splice(hitIndex, 1);
  const now = performance.now();
  state.cookingCombo = now - state.cookingLastHitAt < 1050
    ? Math.min(8, state.cookingCombo + 1)
    : 1;
  state.cookingLastHitAt = now;
  state.cookingScore += object.points * state.cookingCombo;
  const previousMission = state.cookingMission;
  state.cookingMission = advanceChaosMission(previousMission, { glyph: object.glyph, hit: true });
  if (state.cookingMission?.complete && !previousMission?.complete) {
    state.cookingScore += 250;
    state.cookingMissionCompletedAt = now;
  }
  burstChaos(object, x, y);
  if (navigator.vibrate) navigator.vibrate(8);
  updateChaosHud();
}

function drawChaosBackground(now) {
  if (!chaosCtx || !chaosCanvas) return;
  const t = now / 1000;
  const gradient = chaosCtx.createLinearGradient(0, 0, chaosCanvas.width, chaosCanvas.height);
  gradient.addColorStop(0, '#090b12');
  gradient.addColorStop(.52, '#111224');
  gradient.addColorStop(1, '#06070b');
  chaosCtx.fillStyle = gradient;
  chaosCtx.fillRect(0, 0, chaosCanvas.width, chaosCanvas.height);

  chaosCtx.save();
  chaosCtx.globalAlpha = .17;
  chaosCtx.strokeStyle = '#8c52ff';
  chaosCtx.lineWidth = 2;
  const grid = 72;
  const offsetX = (t * 26) % grid;
  const offsetY = (t * 18) % grid;
  for (let x = -grid + offsetX; x < chaosCanvas.width + grid; x += grid) {
    chaosCtx.beginPath();
    chaosCtx.moveTo(x, 0);
    chaosCtx.lineTo(x - 130, chaosCanvas.height);
    chaosCtx.stroke();
  }
  for (let y = -grid + offsetY; y < chaosCanvas.height + grid; y += grid) {
    chaosCtx.beginPath();
    chaosCtx.moveTo(0, y);
    chaosCtx.lineTo(chaosCanvas.width, y + 90);
    chaosCtx.stroke();
  }
  chaosCtx.restore();

  const pulseX = chaosCanvas.width * (.5 + Math.sin(t * .61) * .34);
  const pulseY = chaosCanvas.height * (.45 + Math.cos(t * .47) * .28);
  const pulse = chaosCtx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 360);
  pulse.addColorStop(0, 'rgba(0,229,255,.11)');
  pulse.addColorStop(.55, 'rgba(255,46,196,.045)');
  pulse.addColorStop(1, 'rgba(0,0,0,0)');
  chaosCtx.fillStyle = pulse;
  chaosCtx.fillRect(0, 0, chaosCanvas.width, chaosCanvas.height);
}

function drawChaosObject(object, now) {
  const bob = Math.sin(now / 260 + object.wobble) * 8;
  chaosCtx.save();
  chaosCtx.translate(object.x, object.y + bob);
  chaosCtx.rotate(object.rotation);
  chaosCtx.shadowBlur = 25;
  chaosCtx.shadowColor = object.color;
  chaosCtx.fillStyle = 'rgba(5,8,13,.72)';
  chaosCtx.beginPath();
  chaosCtx.arc(0, 0, object.radius * 1.05, 0, Math.PI * 2);
  chaosCtx.fill();
  chaosCtx.strokeStyle = object.color;
  chaosCtx.lineWidth = 4;
  chaosCtx.stroke();
  chaosCtx.shadowBlur = 0;
  chaosCtx.font = `${Math.round(object.radius * 1.18 * object.scale)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  chaosCtx.textAlign = 'center';
  chaosCtx.textBaseline = 'middle';
  chaosCtx.fillText(object.glyph, 0, 2);
  chaosCtx.restore();
}

function renderCookingChaos(now) {
  if (!chaosCtx || !chaosCanvas || !state.cookingRaf) return;
  const dt = Math.min(.034, Math.max(.001, (now - state.cookingLastFrameAt) / 1000 || .016));
  state.cookingLastFrameAt = now;
  const elapsed = Math.max(0, now - state.cookingStartedAt);
  const pseudoProgress = Math.min(.9, .04 + elapsed / 52000 * .86);
  const desired = Math.max(state.cookingProgressTarget, pseudoProgress);
  state.cookingProgressDisplay += (desired - state.cookingProgressDisplay) * Math.min(1, dt * 2.8);

  if (!state.cookingReady && now >= state.cookingNextSpawnAt) spawnChaosObject(now);
  if (!state.cookingReady && now - state.cookingLastHitAt > 1250 && state.cookingCombo > 1) {
    state.cookingCombo = Math.max(1, state.cookingCombo - 1);
  }
  if (
    !state.cookingReady
    && state.cookingMission?.complete
    && state.cookingMissionCompletedAt
    && now - state.cookingMissionCompletedAt > 850
  ) {
    state.cookingMissionIndex += 1;
    state.cookingMission = createChaosMission(state.cookingMissionIndex);
    state.cookingMissionCompletedAt = 0;
  }

  state.cookingObjects.forEach(object => {
    object.x += object.vx * dt;
    object.y += object.vy * dt;
    object.rotation += object.spin * dt;
    const pad = object.radius * 1.4;
    if (object.x < -pad && object.vx < 0) object.x = chaosCanvas.width + pad;
    if (object.x > chaosCanvas.width + pad && object.vx > 0) object.x = -pad;
    if (object.y < -pad && object.vy < 0) object.y = chaosCanvas.height + pad;
    if (object.y > chaosCanvas.height + pad && object.vy > 0) object.y = -pad;
  });

  state.cookingParticles.forEach(particle => {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 260 * dt;
    particle.vx *= .985;
  });
  state.cookingParticles = state.cookingParticles.filter(particle => particle.age < particle.life);

  drawChaosBackground(now);
  state.cookingObjects.forEach(object => drawChaosObject(object, now));
  state.cookingParticles.forEach(particle => {
    const alpha = Math.max(0, 1 - particle.age / particle.life);
    chaosCtx.save();
    chaosCtx.globalAlpha = alpha;
    chaosCtx.fillStyle = particle.color;
    chaosCtx.beginPath();
    chaosCtx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    chaosCtx.fill();
    chaosCtx.restore();
  });

  updateChaosHud();
  state.cookingRaf = requestAnimationFrame(renderCookingChaos);
}

function startCookingChaos() {
  stopCookingChaos();
  resetLoadingGallery();
  state.cookingStartedAt = performance.now();
  state.cookingLastFrameAt = state.cookingStartedAt;
  state.cookingNextSpawnAt = state.cookingStartedAt;
  state.cookingRaf = 1;
  for (let i = 0; i < 6; i += 1) spawnChaosObject(state.cookingStartedAt - i * 120);
  state.cookingRaf = requestAnimationFrame(renderCookingChaos);
}

function stopCookingChaos() {
  if (state.cookingRaf) cancelAnimationFrame(state.cookingRaf);
  state.cookingRaf = 0;
}

async function finishCookingChaos() {
  setCookingProgress(1);
  state.cookingProgressDisplay = 1;
  state.cookingReady = true;
  updateChaosHud();
  if (chaosReady) chaosReady.hidden = false;
  if (loadingProgress) loadingProgress.textContent = 'Ready.';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  await sleep(reduced ? 120 : 650);
}

function updateLoadingGallery(results, completed, total) {
  const ready = results.filter(Boolean).length;
  const fraction = total ? completed / total : 0;
  setCookingProgress(.22 + fraction * .6);
  if (loadingProgress) loadingProgress.textContent = `${ready} visual beats ready.`;
}

function nextTrendPrompt() {
  const current = state.story?.prompt || promptInput.value;
  const options = state.trends.filter(trend => !current.toLowerCase().includes(String(trend).toLowerCase()));
  const trend = options[0] || state.trends[0] || FALLBACK_TRENDS[0];
  return trendToPrompt(trend);
}

function generateNextTrend() {
  const prompt = nextTrendPrompt();
  promptInput.value = prompt;
  updateWordMeter();
  generate(prompt);
}

function setStatus(message, kind = 'ok') {
  statusText.textContent = message;
  statusDot.className = `status-dot${kind === 'busy' ? ' busy' : kind === 'warn' ? ' warn' : ''}`;
}

function setSources() {
  storySourceEl.textContent = state.storySource;
  voiceSourceEl.textContent = state.voiceSource;
  visualSourceEl.textContent = state.visualSource;
  trendSourcePill.textContent = state.trendSource;
  if (resultVisualSourceEl) resultVisualSourceEl.textContent = state.visualSource;
  if (resultVoiceSourceEl) resultVoiceSourceEl.textContent = state.voiceSource;
}

function setGenerating(busy) {
  genBtn.disabled = busy;
  quickBtn.disabled = busy;
  promptInput.disabled = busy;
  chaosSelect.disabled = busy;
  visualStyleSelect.disabled = busy;
}

function updateWordMeter() {
  const words = countWords(promptInput.value);
  wordMeter.textContent = `${words} / ${MAX_PROMPT_WORDS} words`;
  wordMeter.classList.toggle('over', words > MAX_PROMPT_WORDS);
  genBtn.disabled = words < 1 || words > MAX_PROMPT_WORDS;
}

function renderTrendChips() {
  trendRail.replaceChildren();
  state.trends.slice(0, 12).forEach((trend, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trend-chip';
    button.textContent = `${index < 3 ? '🔥 ' : ''}${trend}`;
    button.title = `Use ${trend}`;
    button.addEventListener('click', () => {
      promptInput.value = trendToPrompt(trend);
      updateWordMeter();
      promptInput.focus();
    });
    trendRail.appendChild(button);
  });
  trendSource.textContent = state.trendSource;
  setSources();
}

async function loadTrends() {
  try {
    const response = await fetch('/api/trends', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('trend endpoint unavailable');
    const data = await response.json();
    const safe = Array.isArray(data?.trends) ? data.trends.filter(isSafeTrend).filter(Boolean).slice(0, 16) : [];
    if (safe.length >= 3) {
      state.trends = safe;
      state.trendSource = data.source === 'google-trends-rss' ? 'Google Trends · live' : 'live rotation';
    }
  } catch {
    state.trends = [...FALLBACK_TRENDS];
    state.trendSource = 'built-in rotation';
  }
  renderTrendChips();
}

function rotateTrendRail() {
  const first = trendRail.firstElementChild;
  if (first) trendRail.appendChild(first);
}

function narrationText() {
  return state.story?.scenes?.map(scene => scene.text).join(' ') || '';
}

async function requestStory(prompt, visualStyle) {
  const response = await fetch('/api/story', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ prompt, visualStyle }),
  });
  if (!response.ok) throw new Error(`story ${response.status}`);
  const data = await response.json();
  return {
    scenes: normalizeScenes(data.scenes, prompt, visualStyle, data.continuity),
    continuity: data.continuity || {},
    visualStyle: normalizeVisualStyle(data.visualStyle || visualStyle),
    source: data.source || 'Gemini',
  };
}

function seedFromString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function loadImage(dataURI) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = dataURI;
  });
}

function sceneVisualPrompt(scene, sceneIndex) {
  return [
    scene.visualPrompt,
    sceneIndex > 0
      ? 'Continue the immediately previous story beat: preserve the same recurring subject identity, appearance, world, props, lighting logic, and screen direction while advancing only the described action.'
      : 'Establish the recurring subject, world, props, lighting logic, and screen direction clearly so following beats can continue from it.',
  ].join(' ');
}

function motionFramePrompt(scene, sceneIndex, frameIndex) {
  const moment = frameIndex === 0
    ? 'Capture the opening motion moment of this beat with a strong readable pose and clear direction of movement.'
    : 'Capture the same exact recurring character roughly one to two seconds later in the same beat: preserve face, body design, materials, signature prop, outfit, environment, and screen direction while visibly advancing the physical action, expression, and pose.';
  return [
    sceneVisualPrompt(scene, sceneIndex),
    moment,
    'This is one frame in a moving short, not a poster. Keep the composition compatible with the adjacent motion frame so a cross-dissolve and camera move feels like continuous video.',
  ].join(' ');
}

function buildQualityFallbackPrompt(scene, visualStyle) {
  const stylePrompt = getVisualStylePreset(visualStyle).prompt;
  return [
    stylePrompt,
    `one clear recurring protagonist: ${scene.subject}`,
    `literal physical location: ${scene.setting}`,
    `visible physical action: ${scene.action}`,
    `camera framing: ${scene.camera}`,
    'vertical 9:16 social-video frame',
    'the main subject must be clearly recognizable and occupy roughly 35 to 60 percent of the frame',
    'show people, objects, architecture, landscape, and physical action literally',
    'do not visualize abstract words or concepts such as aura, rizz, energy, gravity, loop, lore, or side quest as symbols, text, fog, blobs, or typography',
    'if signs, screens, labels, paperwork, or displays are visible, keep their writing blank, tiny, defocused, or unreadable',
    'no letters, words, captions, subtitles, logos, watermarks, UI, title cards, posters, or speech bubbles',
    'sharp focal subject, usable photographic detail, clear foreground and background separation',
  ].join('. ');
}

function blobToDataURI(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('blob decode failed'));
    reader.readAsDataURL(blob);
  });
}

function inspectImageQuality(image) {
  const sample = document.createElement('canvas');
  sample.width = 48;
  sample.height = 84;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return { ok: true, reason: 'quality sampler unavailable' };

  sampleCtx.drawImage(image, 0, 0, sample.width, sample.height);
  const { data } = sampleCtx.getImageData(0, 0, sample.width, sample.height);
  const luminance = new Float32Array(sample.width * sample.height);
  let mean = 0;
  let dark = 0;
  let bright = 0;
  let chromaTotal = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    luminance[p] = value;
    mean += value;
    chromaTotal += (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
    if (value < 18) dark += 1;
    if (value > 240) bright += 1;
  }

  mean /= luminance.length;
  let variance = 0;
  let edgeHits = 0;
  let edgeChecks = 0;
  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const index = y * sample.width + x;
      const value = luminance[index];
      variance += (value - mean) ** 2;
      if (x + 1 < sample.width) {
        edgeChecks += 1;
        if (Math.abs(value - luminance[index + 1]) > 18) edgeHits += 1;
      }
      if (y + 1 < sample.height) {
        edgeChecks += 1;
        if (Math.abs(value - luminance[index + sample.width]) > 18) edgeHits += 1;
      }
    }
  }

  const stddev = Math.sqrt(variance / luminance.length);
  const edgeDensity = edgeChecks ? edgeHits / edgeChecks : 0;
  const darkRatio = dark / luminance.length;
  const brightRatio = bright / luminance.length;
  const chromaMean = chromaTotal / luminance.length;
  const graphicTextLike = chromaMean < 0.09
    && (darkRatio + brightRatio) > 0.52
    && edgeDensity > 0.065;
  const ok = stddev >= 22
    && edgeDensity >= 0.025
    && darkRatio < 0.82
    && brightRatio < 0.82
    && !graphicTextLike;
  return {
    ok,
    reason: graphicTextLike
      ? `graphic/text-like frame, chroma ${chromaMean.toFixed(2)}, edges ${(edgeDensity * 100).toFixed(1)}%`
      : `detail std ${stddev.toFixed(1)}, edges ${(edgeDensity * 100).toFixed(1)}%`,
  };
}

async function loadQualityImage(dataURI, providerLabel) {
  const image = await loadImage(dataURI);
  const quality = inspectImageQuality(image);
  if (!quality.ok) throw new Error(`${providerLabel} rejected low-detail frame (${quality.reason})`);
  return image;
}

async function localizePuterImage(candidate) {
  const src = typeof candidate === 'string' ? candidate : candidate?.src;
  if (!src) throw new Error('Puter returned no image source');
  if (src.startsWith('data:')) return loadQualityImage(src, 'Puter');
  const response = await fetch(src, { mode: 'cors' });
  if (!response.ok) throw new Error(`Puter image download ${response.status}`);
  const blob = await response.blob();
  const dataURI = await blobToDataURI(blob);
  return loadQualityImage(dataURI, 'Puter');
}

async function requestPuterSceneImage(visualPrompt) {
  if (!window.puter?.ai?.txt2img) throw new Error('Puter runtime unavailable');
  if (window.puter?.auth?.isSignedIn && !window.puter.auth.isSignedIn()) {
    throw new Error('Puter signed out');
  }
  let lastError = new Error('No Puter image model was available.');
  for (const provider of PUTER_IMAGE_MODELS) {
    try {
      const candidate = await window.puter.ai.txt2img(visualPrompt, {
        provider: provider.provider,
        model: provider.model,
        ratio: { w: 9, h: 16 },
      });
      return { image: await localizePuterImage(candidate), source: provider.label };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || provider.label));
    }
  }
  throw lastError;
}

async function requestPollinationsSceneImage(visualPrompt, seed, model) {
  const response = await fetch('/api/horde-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ provider: 'pollinations', visualPrompt, seed, model }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.dataURI) {
    const detail = data?.detail || data?.error || `HTTP ${response.status}`;
    throw new Error(`Pollinations ${model} ${detail}`);
  }
  return {
    image: await loadQualityImage(data.dataURI, `Pollinations ${model}`),
    source: data.source || `Pollinations · ${model}`,
  };
}

async function requestHordeSceneImage(visualPrompt, seed) {
  const response = await fetch('/api/horde-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ provider: 'horde', visualPrompt, seed }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.detail || data?.error || `HTTP ${response.status}`;
    throw new Error(`AI Horde ${detail}`);
  }
  if (!data?.dataURI) throw new Error('AI Horde empty image');
  return {
    image: await loadQualityImage(data.dataURI, 'AI Horde'),
    source: data.source || 'AI Horde · anonymous community',
  };
}

async function requestSceneImage(scene, sceneIndex, visualStyle, prompt, frameIndex = 0) {
  const visualPrompt = motionFramePrompt(scene, sceneIndex, frameIndex);
  const sceneSeed = seedFromString(`${prompt}:${sceneIndex}:${frameIndex}:${scene.subject}:${scene.setting}`);
  const continuitySeed = seedFromString(`${prompt}:${scene.subject}:${visualStyle}:recurring-protagonist:${frameIndex}`);
  const failures = [];

  try {
    const response = await fetch('/api/visualize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ visualPrompt, style: visualStyle, seed: sceneSeed }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.dataURI) {
      return {
        image: await loadQualityImage(data.dataURI, 'Cloudflare'),
        source: data.source || 'Cloudflare Workers AI',
      };
    }
    failures.push(`Cloudflare ${response.status}`);
  } catch (error) {
    failures.push(String(error?.message || 'Cloudflare unavailable').slice(0, 100));
  }

  // In fallback mode, create four stronger anchor images and reuse them for
  // neighboring scenes. This preserves continuity and avoids eight low-quality
  // anonymous generations competing for free capacity.
  if (sceneIndex % 2 === 1) {
    throw new Error(`${failures.join(' → ')} → scheduled nearest-anchor reuse`);
  }

  const fallbackPrompt = buildQualityFallbackPrompt(scene, visualStyle);

  for (const model of ['flux', 'zimage']) {
    try {
      return await requestPollinationsSceneImage(fallbackPrompt, continuitySeed, model);
    } catch (error) {
      failures.push(String(error?.message || `Pollinations ${model} failed`).slice(0, 110));
    }
  }

  try {
    return await requestPuterSceneImage(fallbackPrompt);
  } catch (error) {
    failures.push(String(error?.message || 'Puter failed').slice(0, 100));
  }

  // Emergency-only. AI Horde is intentionally behind the quality providers.
  try {
    return await requestHordeSceneImage(fallbackPrompt, continuitySeed);
  } catch (error) {
    failures.push(String(error?.message || 'AI Horde failed').slice(0, 100));
  }

  throw new Error(failures.join(' → '));
}

function summarizeVisualSources(sources, reusedCount, errors = []) {
  const counts = new Map();
  sources.filter(Boolean).forEach(source => counts.set(source, (counts.get(source) || 0) + 1));
  const parts = [...counts.entries()].map(([source, count]) => `${source} ${count}`);
  if (reusedCount) parts.push(`reused ${reusedCount}`);
  if (parts.length) return parts.join(' · ');
  const reason = errors.find(Boolean);
  return reason ? `cinematic fallback · ${reason}` : 'cinematic fallback';
}

function nearestImageIndex(results, target) {
  let best = -1;
  let distance = Infinity;
  results.forEach((image, index) => {
    if (!image) return;
    const nextDistance = Math.abs(index - target);
    if (nextDistance < distance) {
      distance = nextDistance;
      best = index;
    }
  });
  return best;
}

async function generateSceneImages(token) {
  if (!state.story) return 0;
  const scenes = state.story.scenes;
  const frameResults = scenes.map(() => Array(VISUAL_FRAMES_PER_SCENE).fill(null));
  const frameSources = scenes.map(() => Array(VISUAL_FRAMES_PER_SCENE).fill(''));
  const frameErrors = scenes.map(() => Array(VISUAL_FRAMES_PER_SCENE).fill(''));
  const slots = scenes.flatMap((scene, sceneIndex) => (
    Array.from({ length: VISUAL_FRAMES_PER_SCENE }, (_, frameIndex) => ({ scene, sceneIndex, frameIndex }))
  ));
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < slots.length) {
      const slot = slots[cursor];
      cursor += 1;
      const { scene, sceneIndex, frameIndex } = slot;
      try {
        const result = await requestSceneImage(
          scene,
          sceneIndex,
          state.visualStyle,
          state.story.prompt,
          frameIndex,
        );
        if (token !== state.generateToken) return;
        frameResults[sceneIndex][frameIndex] = result.image;
        frameSources[sceneIndex][frameIndex] = result.source;
      } catch (error) {
        frameResults[sceneIndex][frameIndex] = null;
        frameErrors[sceneIndex][frameIndex] = String(error?.message || error || 'image fallback failed').slice(0, 220);
      }

      completed += 1;
      if (token === state.generateToken) {
        const readyFrames = frameResults.flat().filter(Boolean).length;
        state.sceneFrames = frameResults.map(pair => [...pair]);
        state.sceneImages = frameResults.map(pair => pair[0] || pair[1] || null);
        state.visualGeneratedCount = readyFrames;
        state.visualCoveredCount = state.sceneImages.filter(Boolean).length;
        state.visualErrors = frameErrors.flat().filter(Boolean);
        const flattenedSources = frameSources.flat();
        state.visualSource = readyFrames
          ? summarizeVisualSources(flattenedSources, 0, state.visualErrors)
          : completed < slots.length
            ? 'trying quality image fallback…'
            : summarizeVisualSources(flattenedSources, 0, state.visualErrors);
        updateLoadingGallery(frameResults.flat(), completed, slots.length);
        setSources();
        drawFrame(0);
        setStatus(`Generating motion frames… ${completed}/${slots.length}`, 'busy');
      }
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  if (token !== state.generateToken) return 0;

  const generatedFrames = frameResults.flat().filter(Boolean).length;
  let reusedCount = 0;

  for (let sceneIndex = 0; sceneIndex < frameResults.length; sceneIndex += 1) {
    const pair = frameResults[sceneIndex];
    if (!pair[0] && pair[1]) {
      pair[0] = pair[1];
      reusedCount += 1;
    }
    if (!pair[1] && pair[0]) {
      pair[1] = pair[0];
      reusedCount += 1;
    }
  }

  const baseFrames = frameResults.map(pair => pair[0] || null);
  if (baseFrames.some(Boolean)) {
    for (let sceneIndex = 0; sceneIndex < frameResults.length; sceneIndex += 1) {
      if (frameResults[sceneIndex][0]) continue;
      const nearest = nearestImageIndex(baseFrames, sceneIndex);
      if (nearest >= 0) {
        const sourcePair = frameResults[nearest];
        frameResults[sceneIndex][0] = sourcePair[0];
        frameResults[sceneIndex][1] = sourcePair[1] || sourcePair[0];
        reusedCount += 2;
      }
    }
  }

  state.sceneFrames = frameResults;
  state.sceneImages = frameResults.map(pair => pair[0] || pair[1] || null);
  state.visualGeneratedCount = generatedFrames;
  state.visualCoveredCount = state.sceneImages.filter(Boolean).length;
  state.visualErrors = frameErrors.flat().filter(Boolean);
  state.visualSource = summarizeVisualSources(frameSources.flat(), reusedCount, state.visualErrors);
  setSources();
  return generatedFrames;
}

function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error('WebAudio unavailable');
    state.audioContext = new AudioContextCtor();
  }
  return state.audioContext;
}

function decodePcm16(base64, sampleRate = 24000) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const evenLength = bytes.byteLength - (bytes.byteLength % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, evenLength);
  const sampleCount = evenLength / 2;
  const audioContext = ensureAudioContext();
  const buffer = audioContext.createBuffer(1, sampleCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;
  return buffer;
}

async function requestNarration(text) {
  const response = await fetch('/api/narrate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      text,
      visualStyle: state.visualStyle,
      moods: state.story.scenes.map(scene => scene.mood).filter(Boolean),
    }),
  });
  if (!response.ok) throw new Error(`narration ${response.status}`);
  const data = await response.json();
  if (!data?.pcmBase64) throw new Error('empty narration');
  return {
    buffer: decodePcm16(data.pcmBase64, Number(data.sampleRate) || 24000),
    source: data.source || 'Gemini TTS',
    voiceMode: data.voiceMode || 'narrator',
    narratorVoice: data.narratorVoice || '',
    characterVoice: data.characterVoice || '',
    wordTimings: Array.isArray(data.wordTimings) ? data.wordTimings : [],
    timingSource: data.timingSource || 'estimated',
  };
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function decodePuterSpeech(candidate) {
  const src = typeof candidate === 'string' ? candidate : candidate?.src || candidate?.currentSrc;
  if (!src) throw new Error('Puter TTS returned no audio source');
  const response = await fetch(src, { mode: 'cors' });
  if (!response.ok) throw new Error(`Puter TTS audio download ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const context = ensureAudioContext();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

async function requestPuterNarration(text) {
  if (!window.puter?.ai?.txt2speech) throw new Error('Puter TTS fallback unavailable');
  let lastError = new Error('No Puter TTS provider was available.');
  for (const provider of PUTER_TTS_FALLBACKS) {
    try {
      const candidate = await window.puter.ai.txt2speech(text, provider.options);
      return {
        buffer: await decodePuterSpeech(candidate),
        source: provider.label,
        voiceMode: 'narrator',
        narratorVoice: provider.options.voice || 'provider default',
        characterVoice: '',
        wordTimings: [],
        timingSource: 'estimated',
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || provider.label));
    }
  }
  throw lastError;
}

async function requestNarrationWithFallback(text) {
  try {
    return await requestNarration(text);
  } catch {
    await sleep(650);
    try {
      return await requestNarration(text);
    } catch {
      return requestPuterNarration(text);
    }
  }
}

function naturalNarrationTiming(buffer) {
  const duration = Math.max(1, Number(buffer?.duration) || TARGET_SECONDS);
  let rate = Math.max(0.94, Math.min(1.08, duration / 54.5));
  if (duration / rate > 58.5) rate = duration / 58.5;
  return {
    rate,
    seconds: Math.min(TARGET_SECONDS, duration / rate),
  };
}

function applyNarrationTiming(buffer) {
  const timing = naturalNarrationTiming(buffer);
  state.narrationPlaybackRate = timing.rate;
  state.narrationPlaybackSeconds = timing.seconds;
  if (!state.story) return;
  state.timeline = buildSceneTimeline(state.story.scenes, timing.seconds);
  state.microTimeline = buildMicroShotTimeline(state.timeline, state.visualStyle);
}

function canRecordNarratedVideo() {
  return Boolean(state.audioBuffer && canvas.captureStream && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));
}

function setWatchMode(enabled) {
  document.body.classList.toggle('watch-mode', Boolean(enabled));
}

function updatePlaybackControls() {
  const ready = Boolean(state.story);
  playPauseBtn.disabled = !ready || state.recording;
  repeatBtn.disabled = !ready || state.recording;
  nextTrendBtn.disabled = state.recording;
  homeBtn.disabled = state.recording;
  downloadBtn.disabled = !ready || state.playing || state.paused || !canRecordNarratedVideo();
  playPauseBtn.textContent = state.paused ? '▶ RESUME' : state.playing ? '❚❚ PAUSE' : '▶ PLAY';
  if (canRecordNarratedVideo()) {
    downloadNote.textContent = 'Download records the full 60-second 720×1280 canvas + AI narration as WebM on this device.';
  } else if (ready) {
    downloadNote.textContent = 'Preview works now. Narrated video export requires Gemini TTS plus browser MediaRecorder support.';
  } else {
    downloadNote.textContent = 'Your full-resolution canvas stays export quality while the preview scales to fit this screen.';
  }
}

async function generate(promptValue) {
  const validation = validatePrompt(promptValue);
  if (!validation.ok) {
    setStatus(validation.error, 'warn');
    return;
  }

  const token = ++state.generateToken;
  const visualStyle = normalizeVisualStyle(visualStyleSelect.value);
  stopPlayback(true);
  resetLoadingGallery();
  setView('cooking');
  startCookingChaos();
  setGenerating(true);
  state.audioBuffer = null;
  state.narrationPlaybackRate = 1;
  state.narrationPlaybackSeconds = TARGET_SECONDS;
  state.wordTimings = [];
  state.timingSource = 'estimated';
  state.story = null;
  state.timeline = [];
  state.microTimeline = [];
  state.sceneImages = [];
  state.sceneFrames = [];
  state.visualStyle = visualStyle;
  state.storySource = 'local fallback';
  state.voiceSource = 'AI voice pending';
  state.visualSource = 'Cloudflare → free AI fallbacks';
  state.visualGeneratedCount = 0;
  state.visualCoveredCount = 0;
  state.visualErrors = [];
  setSources();
  updatePlaybackControls();
  drawWelcome('PLANNING SHOTS...');
  setStatus(`Writing eight connected scenes in ${getVisualStylePreset(visualStyle).label} style…`, 'busy');

  let generated;
  try {
    generated = await requestStory(validation.prompt, visualStyle);
    state.storySource = generated.source;
  } catch {
    generated = buildFallbackStory(validation.prompt, visualStyle);
    state.storySource = 'local fallback';
  }

  if (token !== state.generateToken) return;
  setCookingProgress(.18);
  const continuity = generated.continuity || {};
  const scenes = normalizeScenes(generated.scenes, validation.prompt, visualStyle, continuity);
  state.story = { scenes, prompt: validation.prompt, continuity, visualStyle };
  state.timeline = buildSceneTimeline(scenes, TARGET_SECONDS);
  state.microTimeline = buildMicroShotTimeline(state.timeline, visualStyle);
  scriptWordsEl.textContent = storyWordCount(scenes);
  sceneCountEl.textContent = state.microTimeline.length;
  videoLengthEl.textContent = '60s';
  setSources();
  drawFrame(0);

  setStatus('Generating.', 'busy');
  setCookingProgress(.24);
  const visualPromise = generateSceneImages(token);
  const narrationPromise = requestNarrationWithFallback(narrationText()).then(narration => {
    if (token !== state.generateToken) return;
    state.audioBuffer = narration.buffer;
    state.wordTimings = narration.wordTimings || [];
    state.timingSource = narration.timingSource || 'estimated';
    applyNarrationTiming(narration.buffer);
    const syncLabel = state.wordTimings.length ? ' · word-synced' : '';
    state.voiceSource = narration.voiceMode === 'dual'
      ? `${narration.source} · story-matched · 2 voices${syncLabel}`
      : `${narration.source} · story-matched${syncLabel}`;
    setCookingProgress(.86);
    setSources();
  }).catch(() => {
    if (token !== state.generateToken) return;
    state.audioBuffer = null;
    state.narrationPlaybackRate = 1;
    state.narrationPlaybackSeconds = TARGET_SECONDS;
    state.wordTimings = [];
    state.timingSource = 'estimated';
    state.voiceSource = 'device speechSynthesis';
    setCookingProgress(.84);
    setSources();
  });

  const [visualResult] = await Promise.allSettled([visualPromise, narrationPromise]);
  if (token !== state.generateToken) return;
  const readyImages = visualResult.status === 'fulfilled' ? visualResult.value : 0;
  drawFrame(0);
  resultTitle.textContent = validation.prompt;
  resultStyle.textContent = getVisualStylePreset(visualStyle).label;
  setGenerating(false);
  updateWordMeter();
  await finishCookingChaos();
  stopCookingChaos();
  setView('result');
  updatePlaybackControls();
  const targetFrames = scenes.length * VISUAL_FRAMES_PER_SCENE;
  if (readyImages === targetFrames) {
    setStatus('Ready. 16 motion frames drive the 32 linked shots plus synchronized narration.', 'ok');
  } else if (readyImages > 0 && state.visualCoveredCount === scenes.length) {
    setStatus(`Ready. ${readyImages}/16 visual frames generated; missing motion moments reuse the nearest generated imagery so the full short keeps moving.`, 'ok');
  } else if (readyImages > 0) {
    setStatus(`Ready. ${readyImages}/16 visual frames are live; remaining beats use the cinematic motion fallback.`, 'warn');
  } else {
    setStatus('Ready. Image providers were unavailable, so the cinematic animated fallback is carrying the short.', 'warn');
  }
}

function pickMediaRecorderMime() {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function makeSafeFilename(prompt) {
  const slug = String(prompt || 'brainrot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'brainrot';
  return `brainrot-${slug}.webm`;
}

function beginRecorder(destination) {
  const videoStream = canvas.captureStream(30);
  const tracks = [...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()];
  state.recordStream = new MediaStream(tracks);
  const mimeType = pickMediaRecorderMime();
  state.recordChunks = [];
  state.recordingAborted = false;
  state.recorder = mimeType ? new MediaRecorder(state.recordStream, { mimeType, videoBitsPerSecond: 4_500_000 }) : new MediaRecorder(state.recordStream);
  state.recorder.addEventListener('dataavailable', event => { if (event.data?.size) state.recordChunks.push(event.data); });
  state.recorder.addEventListener('stop', () => {
    state.recordStream?.getTracks().forEach(track => track.stop());
    const aborted = state.recordingAborted;
    state.recording = false;
    updatePlaybackControls();
    if (aborted || !state.recordChunks.length) return;
    const blob = new Blob(state.recordChunks, { type: state.recorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = makeSafeFilename(state.story?.prompt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setStatus('Saved the full 60-second narrated story-synced video.', 'ok');
  });
  state.recorder.start(1000);
}

function wordIndexFromCharIndex(text, charIndex) {
  const prefix = text.slice(0, Math.max(0, charIndex));
  return prefix.trim() ? prefix.trim().split(/\s+/).length : 0;
}

function globalWordMap() {
  if (!state.story) return [];
  const map = [];
  state.story.scenes.forEach((scene, sceneIndex) => {
    scene.text.trim().split(/\s+/).forEach((word, localIndex) => map.push({ word, sceneIndex, localIndex }));
  });
  return map;
}

function startDeviceSpeech() {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    setStatus('This browser has no speech engine; visuals and subtitles will still play.', 'warn');
    return;
  }
  const text = narrationText();
  const utterance = new SpeechSynthesisUtterance(text);
  const deviceProfile = {
    'cursed-real': { rate: 0.97, pitch: 0.92 },
    photoreal: { rate: 1.0, pitch: 1.0 },
    cinematic: { rate: 0.95, pitch: 0.9 },
    cartoon: { rate: 1.04, pitch: 1.08 },
  }[state.visualStyle] || { rate: 1, pitch: 1 };
  const wordCount = countWords(text);
  const pacingRate = wordCount > 145 ? 1.03 : wordCount < 110 ? 0.96 : 1;
  utterance.rate = Math.max(0.88, Math.min(1.1, pacingRate * deviceProfile.rate));
  utterance.pitch = deviceProfile.pitch;
  utterance.volume = 1;
  utterance.addEventListener('boundary', event => {
    if (event.name === 'word') state.speechWordIndex = wordIndexFromCharIndex(text, event.charIndex);
  });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function play({ record = false } = {}) {
  if (state.paused && !record) {
    await resumePlayback();
    return;
  }
  if (!state.story || state.playing) return;
  if (record && !canRecordNarratedVideo()) {
    setStatus('Narrated recording is unavailable in this mode/browser. Preview still works.', 'warn');
    return;
  }
  stopPlayback(true);
  state.playing = true;
  state.paused = false;
  state.recording = record;
  state.speechWordIndex = null;
  state.startedAt = performance.now();
  setWatchMode(true);
  updatePlaybackControls();
  setStatus(record ? 'Recording the full story-synced minute locally…' : 'Now rotting…', 'busy');

  if (state.audioBuffer) {
    const audioContext = ensureAudioContext();
    await audioContext.resume();
    const source = audioContext.createBufferSource();
    source.buffer = state.audioBuffer;
    source.playbackRate.value = Math.max(0.01, state.narrationPlaybackRate || 1);
    source.connect(audioContext.destination);
    if (record) {
      state.mediaDestination = audioContext.createMediaStreamDestination();
      source.connect(state.mediaDestination);
      beginRecorder(state.mediaDestination);
    }
    state.audioSource = source;
    source.addEventListener('ended', () => {
      if (state.audioSource === source) state.audioSource = null;
    }, { once: true });
    source.start(0);
  } else {
    startDeviceSpeech();
  }
  state.raf = requestAnimationFrame(renderPlayback);
  state.stopTimer = window.setTimeout(finishPlayback, TARGET_SECONDS * 1000 + 120);
}

async function pausePlayback() {
  if (!state.playing || state.recording) return;
  state.playing = false;
  state.paused = true;
  state.pauseStartedAt = performance.now();
  setWatchMode(false);
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  if (state.stopTimer) clearTimeout(state.stopTimer);
  state.stopTimer = 0;
  if (state.audioBuffer && state.audioContext?.state === 'running') {
    await state.audioContext.suspend();
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
  updatePlaybackControls();
}

async function resumePlayback() {
  if (!state.paused || !state.story) return;
  const now = performance.now();
  state.startedAt += now - state.pauseStartedAt;
  state.pauseStartedAt = 0;
  state.paused = false;
  state.playing = true;
  setWatchMode(true);
  if (state.audioBuffer && state.audioContext?.state === 'suspended') {
    await state.audioContext.resume();
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
  const elapsed = Math.min(TARGET_SECONDS, Math.max(0, (now - state.startedAt) / 1000));
  state.raf = requestAnimationFrame(renderPlayback);
  state.stopTimer = window.setTimeout(finishPlayback, Math.max(0, TARGET_SECONDS - elapsed) * 1000 + 120);
  updatePlaybackControls();
}

function repeatPlayback() {
  stopPlayback(true);
  play({ record: false });
}

function finishPlayback() {
  if (!state.playing && !state.recording) return;
  state.playing = false;
  state.paused = false;
  state.pauseStartedAt = 0;
  setWatchMode(false);
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  if (state.stopTimer) clearTimeout(state.stopTimer);
  state.stopTimer = 0;
  state.audioSource = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  drawFrame(TARGET_SECONDS);
  if (state.recorder?.state === 'recording') state.recorder.stop();
  else state.recording = false;
  updatePlaybackControls();
  if (!state.recording) setStatus('Rot complete. Replay it or make another.', 'ok');
}

function stopPlayback(resetCanvas = false) {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  if (state.stopTimer) clearTimeout(state.stopTimer);
  state.stopTimer = 0;
  if (state.audioSource) {
    try { state.audioSource.stop(); } catch { /* already stopped */ }
  }
  state.audioSource = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (state.recorder?.state === 'recording') {
    state.recordingAborted = true;
    state.recorder.stop();
  }
  state.playing = false;
  state.paused = false;
  state.pauseStartedAt = 0;
  setWatchMode(false);
  state.recording = false;
  state.speechWordIndex = null;
  if (resetCanvas && state.story) drawFrame(0);
  updatePlaybackControls();
}

function renderPlayback(now) {
  if (!state.playing) return;
  const elapsed = Math.min(TARGET_SECONDS, Math.max(0, (now - state.startedAt) / 1000));
  drawFrame(elapsed);
  if (elapsed < TARGET_SECONDS) state.raf = requestAnimationFrame(renderPlayback);
}

function hexToRgb(hex) {
  const clean = String(hex || '#6f7f8f').replace('#', '');
  const number = Number.parseInt(clean, 16) || 0x6f7f8f;
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function chaosFactor() {
  return { chill: 0.55, cooked: 0.85, nuclear: 1.08 }[chaosSelect.value] || 0.85;
}

function microShotStateAtTime(seconds) {
  const timeline = state.microTimeline;
  if (!timeline.length) return null;
  let shot = timeline.find(item => seconds >= item.start && seconds < item.end);
  if (!shot) shot = timeline[timeline.length - 1];
  const progress = Math.max(0, Math.min(1, (seconds - shot.start) / Math.max(shot.duration, .001)));
  return { shot, progress };
}

function sceneStateAtTime(seconds) {
  const timeline = state.timeline;
  if (!timeline.length) return null;
  let sceneIndex = timeline.findIndex(scene => seconds >= scene.start && seconds < scene.end);
  if (sceneIndex < 0) sceneIndex = timeline.length - 1;
  const microState = microShotStateAtTime(seconds);
  const scene = timeline[sceneIndex];
  let words = scene.text.trim().split(/\s+/);
  const sceneProgress = (seconds - scene.start) / Math.max(scene.duration, .001);
  let localWordIndex = pacedWordIndex(words, sceneProgress);
  const map = globalWordMap();

  if (state.audioBuffer && state.wordTimings.length) {
    const spokenSeconds = seconds * Math.max(0.01, state.narrationPlaybackRate || 1);
    const globalIndex = timedWordIndex(state.wordTimings, spokenSeconds);
    const mapped = Number.isInteger(globalIndex) ? map[globalIndex] : null;
    if (mapped) {
      words = timeline[mapped.sceneIndex].text.trim().split(/\s+/);
      localWordIndex = mapped.localIndex;
    }
  } else if (!state.audioBuffer && Number.isInteger(state.speechWordIndex)) {
    const mapped = map[Math.min(map.length - 1, Math.max(0, state.speechWordIndex))];
    if (mapped) {
      words = timeline[mapped.sceneIndex].text.trim().split(/\s+/);
      localWordIndex = mapped.localIndex;
    }
  }
  return {
    scene,
    sceneIndex,
    words,
    localWordIndex,
    microShot: microState?.shot || null,
    microProgress: microState?.progress ?? 0,
  };
}

function roundedRect(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function easeMotion(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function drawImageCover(image, motion, progress) {
  const canvasRatio = canvas.width / canvas.height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if (imageRatio > canvasRatio) {
    sw = image.naturalHeight * canvasRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / canvasRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  const t = easeMotion(progress);
  const zoom = lerp(motion.zoomStart, motion.zoomEnd, t);
  const panX = lerp(motion.panXStart, motion.panXEnd, t);
  const panY = lerp(motion.panYStart, motion.panYEnd, t);
  const rotation = lerp(motion.rotationStart, motion.rotationEnd, t) * Math.PI / 180;
  const dw = canvas.width * zoom;
  const dh = canvas.height * zoom;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, sx, sy, sw, sh, -dw / 2 + panX, -dh / 2 + panY, dw, dh);
  ctx.restore();
}

function drawMotionPair(firstImage, secondImage, motion, sceneProgress) {
  if (!firstImage && !secondImage) return false;
  const first = firstImage || secondImage;
  const second = secondImage || firstImage;
  if (!first || !second) return false;

  const t = easeMotion(Math.max(0, Math.min(1, Number(sceneProgress) || 0)));
  const handoff = Math.max(0, Math.min(1, (t - 0.18) / 0.64));
  const firstMotion = {
    ...motion,
    zoomEnd: Math.max(motion.zoomEnd || 1, (motion.zoomStart || 1) + 0.055),
    panXEnd: (motion.panXEnd || 0) + 10,
    panYEnd: (motion.panYEnd || 0) - 5,
  };
  const secondMotion = {
    ...motion,
    zoomStart: Math.max(1.025, (motion.zoomStart || 1) + 0.02),
    zoomEnd: Math.max(1.07, (motion.zoomEnd || 1) + 0.055),
    panXStart: (motion.panXStart || 0) - 8,
    panXEnd: (motion.panXEnd || 0) + 6,
    panYStart: (motion.panYStart || 0) + 5,
    panYEnd: (motion.panYEnd || 0) - 6,
  };

  ctx.save();
  ctx.globalAlpha = 1 - handoff;
  drawImageCover(first, firstMotion, Math.min(1, t * 1.15));
  ctx.restore();

  if (handoff > 0.001) {
    ctx.save();
    ctx.globalAlpha = handoff;
    drawImageCover(second, secondMotion, Math.max(0, (t - 0.18) / 0.82));
    ctx.restore();
  }
  return true;
}


function drawSceneTransition(previousImage, previousMotion, image, motion, progress, sceneIndex) {
  const t = easeMotion(Math.max(0, Math.min(1, progress)));
  const mode = sceneIndex % 3;

  if (mode === 1) {
    if (t < 0.5) {
      ctx.save();
      drawImageCover(previousImage, previousMotion, 1);
      ctx.fillStyle = `rgba(0,0,0,${t * 2})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = (t - 0.5) * 2;
      drawImageCover(image, motion, t);
      ctx.restore();
    }
    return;
  }

  if (mode === 2) {
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(-56 * t, 0);
    drawImageCover(previousImage, previousMotion, 1);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(56 * (1 - t), 0);
    drawImageCover(image, motion, t);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.filter = `blur(${(t * 4).toFixed(2)}px)`;
  drawImageCover(previousImage, previousMotion, 1);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = t;
  ctx.filter = `blur(${((1 - t) * 4).toFixed(2)}px)`;
  drawImageCover(image, motion, t);
  ctx.restore();
}

function drawLinkedVisual(scene, sceneIndex, microShot, microProgress, sceneProgress) {
  const sourceImageIndex = microShot?.sourceImageIndex ?? sceneIndex;
  const pair = state.sceneFrames[sourceImageIndex] || [];
  const nearest = nearestImageIndex(state.sceneImages, sourceImageIndex);
  const fallbackImage = state.sceneImages[sourceImageIndex] || (nearest >= 0 ? state.sceneImages[nearest] : null);
  const firstImage = pair[0] || fallbackImage;
  const secondImage = pair[1] || firstImage;

  if (!firstImage || !microShot?.motion) {
    drawCinematicFallback(scene, sceneIndex, microShot ? microProgress : sceneProgress);
    return;
  }

  const transitionFromSceneIndex = microShot.transitionFromSceneIndex;
  const previousPair = Number.isInteger(transitionFromSceneIndex)
    ? (state.sceneFrames[transitionFromSceneIndex] || [])
    : [];
  const previousImage = previousPair[1]
    || previousPair[0]
    || (Number.isInteger(transitionFromSceneIndex) ? state.sceneImages[transitionFromSceneIndex] : null);
  const transitionWindow = 0.42;

  if (previousImage && microProgress < transitionWindow) {
    const previousShot = state.microTimeline
      .filter(item => item.sceneIndex === transitionFromSceneIndex)
      .slice(-1)[0];
    drawSceneTransition(
      previousImage,
      previousShot?.motion || microShot.motion,
      firstImage,
      microShot.motion,
      microProgress / transitionWindow,
      sceneIndex,
    );
    return;
  }

  if (!drawMotionPair(firstImage, secondImage, microShot.motion, sceneProgress)) {
    drawImageCover(firstImage, microShot.motion, microProgress);
  }
}

function drawCinematicFallback(scene, sceneIndex, progress) {
  const [r, g, b] = hexToRgb(scene.color);
  const mutedR = Math.round(34 + r * 0.18);
  const mutedG = Math.round(38 + g * 0.18);
  const mutedB = Math.round(44 + b * 0.18);
  const gradient = ctx.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, '#171b20');
  gradient.addColorStop(.52, `rgb(${mutedR}, ${mutedG}, ${mutedB})`);
  gradient.addColorStop(1, '#05070a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 1280);

  const lightX = 180 + ((sceneIndex * 83) % 360);
  const lightY = 300 + Math.sin(sceneIndex * 0.9) * 90;
  const light = ctx.createRadialGradient(lightX, lightY, 20, lightX, lightY, 430);
  light.addColorStop(0, 'rgba(255,255,255,.15)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 720, 960);

  const horizon = 650 + Math.sin(sceneIndex * .8) * 45;
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  for (let i = 0; i < 8; i += 1) {
    const width = 72 + ((sceneIndex * 29 + i * 41) % 150);
    const height = 120 + ((sceneIndex * 51 + i * 31) % 280);
    ctx.fillRect(i * 104 - 36 + progress * 10, horizon - height, width, height);
  }

  const drift = Math.sin(progress * Math.PI) * 12;
  ctx.fillStyle = 'rgba(4,6,8,.72)';
  ctx.beginPath();
  ctx.ellipse(360 + drift, 500, 88, 108, 0, 0, Math.PI * 2);
  ctx.fill();
  roundedRect(270 + drift, 585, 180, 330, 80);
  ctx.fill();

  ctx.globalAlpha = .12;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 14; i += 1) {
    const y = 80 + i * 83 + ((sceneIndex * 17) % 31);
    ctx.fillRect(0, y, 720, 1);
  }
  ctx.globalAlpha = 1;
}

function drawWrappedText(text, x, y, maxWidth, lineHeight, size, fill, weight = 800) {
  ctx.save();
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = fill;
  const words = String(text || '').split(/\s+/);
  let line = '';
  let yy = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  ctx.restore();
}

function drawCaption(words, activeIndex) {
  const { words: visibleWords, localActiveIndex } = captionWindow(words, activeIndex, 6);
  ctx.save();
  const fontSize = 55;
  ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`;
  ctx.textBaseline = 'middle';
  const maxWidth = 610;
  const gap = 15;
  const lines = [];
  let current = [];
  let currentWidth = 0;
  visibleWords.forEach((word, index) => {
    const width = ctx.measureText(word).width;
    const nextWidth = current.length ? currentWidth + gap + width : width;
    if (current.length && nextWidth > maxWidth) {
      lines.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push({ word, index, width });
    currentWidth = current.length === 1 ? width : currentWidth + gap + width;
  });
  if (current.length) lines.push(current);

  const baseY = 1010 - ((lines.length - 1) * 37);
  lines.forEach((line, lineIndex) => {
    const total = line.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, line.length - 1);
    let x = 360 - total / 2;
    line.forEach(item => {
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(0,0,0,.92)';
      ctx.strokeText(item.word, x, baseY + lineIndex * 69);
      ctx.fillStyle = item.index === localActiveIndex ? '#c6ff00' : '#ffffff';
      ctx.fillText(item.word, x, baseY + lineIndex * 69);
      x += item.width + gap;
    });
  });
  ctx.restore();
}

function drawFrame(seconds) {
  if (!state.story || !state.timeline.length) {
    drawWelcome();
    return;
  }
  const frame = sceneStateAtTime(Math.min(TARGET_SECONDS - 0.0001, Math.max(0, seconds)));
  if (!frame) return;
  const { scene, sceneIndex, words, localWordIndex, microShot, microProgress } = frame;
  const progress = Math.max(0, Math.min(1, (seconds - scene.start) / Math.max(scene.duration, .001)));

  ctx.save();
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, 720, 1280);
  drawLinkedVisual(scene, sceneIndex, microShot, microProgress, progress);

  const vignette = ctx.createRadialGradient(360, 540, 220, 360, 600, 760);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 720, 1280);

  const bottomFade = ctx.createLinearGradient(0, 760, 0, 1190);
  bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
  bottomFade.addColorStop(1, 'rgba(0,0,0,.86)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 720, 720, 500);

  const captionStillSpeaking = !state.audioBuffer || seconds <= state.narrationPlaybackSeconds + 0.35;
  if (captionStillSpeaking) drawCaption(words, localWordIndex);
  ctx.restore();

}

function drawWelcome(label = 'READY TO ROT') {
  ctx.fillStyle = '#080010';
  ctx.fillRect(0, 0, 720, 1280);
  const gradient = ctx.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, '#24132d');
  gradient.addColorStop(.45, '#101b22');
  gradient.addColorStop(1, '#080010');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.fillStyle = 'rgba(255,255,255,.055)';
  for (let i = 0; i < 9; i += 1) ctx.fillRect(70 + i * 72, 250 + (i % 3) * 35, 45, 470 - (i % 4) * 62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c6ff00';
  ctx.font = '900 68px Impact, Arial Black, sans-serif';
  ctx.fillText(label, 360, 255);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 78px Impact, Arial Black, sans-serif';
  ctx.fillText('STORY-SYNCED', 360, 735);
  ctx.fillStyle = '#00e5ff';
  ctx.fillText('ROT MACHINE', 360, 825);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '700 29px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('8 AI keyframes • 32 linked shots • 60 seconds', 360, 900);
  ctx.fillStyle = 'rgba(255,255,255,.48)';
  ctx.font = '650 23px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Each beat flows through four motion-linked shots.', 360, 952);
}

installBtn?.addEventListener('click', installApp);
refreshInstallUi();

chaosCanvas?.addEventListener('pointerdown', handleChaosTap);
canvas.addEventListener('pointerup', () => {
  if (state.currentView !== 'result' || state.recording) return;
  if (state.playing) pausePlayback();
  else if (state.paused) resumePlayback();
});
promptInput.addEventListener('input', updateWordMeter);
genBtn.addEventListener('click', () => generate(promptInput.value));
quickBtn.addEventListener('click', () => {
  const trend = state.trends[Math.floor(Math.random() * state.trends.length)] || FALLBACK_TRENDS[0];
  const prompt = trendToPrompt(trend);
  promptInput.value = prompt;
  updateWordMeter();
  generate(prompt);
});
playPauseBtn.addEventListener('click', () => {
  if (state.playing) pausePlayback();
  else play({ record: false });
});
repeatBtn.addEventListener('click', repeatPlayback);
downloadBtn.addEventListener('click', () => play({ record: true }));
nextTrendBtn.addEventListener('click', generateNextTrend);
homeBtn.addEventListener('click', () => {
  stopCookingChaos();
  stopPlayback(true);
  setView('create');
  promptInput.focus();
});
chaosSelect.addEventListener('change', () => { if (!state.playing && state.story) drawFrame(0); });
visualStyleSelect.addEventListener('change', () => {
  state.visualStyle = normalizeVisualStyle(visualStyleSelect.value);
  if (state.story) setStatus('Visual style changed. Generate again to rebuild all 32 linked shots in this style.', 'warn');
});

window.addEventListener('beforeunload', () => {
  stopCookingChaos();
  stopPlayback(false);
});
window.setInterval(rotateTrendRail, 12_000);

setView('create');
resetLoadingGallery();
updateWordMeter();
setSources();
updatePlaybackControls();
drawWelcome();
loadTrends();
