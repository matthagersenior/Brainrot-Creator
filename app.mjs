import {
  TARGET_SECONDS,
  countWords,
  validatePrompt,
  buildFallbackStory,
  normalizeScenes,
  buildSceneTimeline,
  isSafeTrend,
  trendToPrompt,
  captionWindow,
  storyWordCount,
  normalizeVisualStyle,
  getVisualStylePreset,
} from './app-core.mjs';

const FALLBACK_TRENDS = [
  'Nintendo', 'Minecraft', 'Roblox', 'Fortnite', 'viral dance challenge', 'anime opening',
  'streamer speedrun', 'mystery mascot', 'football celebration', 'movie trailer reaction', 'AI pet', 'retro game remake',
];

const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');
const promptInput = document.getElementById('promptInput');
const wordMeter = document.getElementById('wordMeter');
const trendRail = document.getElementById('trendRail');
const trendSource = document.getElementById('trendSource');
const chaosSelect = document.getElementById('chaosSelect');
const visualStyleSelect = document.getElementById('visualStyleSelect');
const genBtn = document.getElementById('genBtn');
const quickBtn = document.getElementById('quickBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const storySourceEl = document.getElementById('storySource');
const voiceSourceEl = document.getElementById('voiceSource');
const visualSourceEl = document.getElementById('visualSource');
const trendSourcePill = document.getElementById('trendSourcePill');
const playBtn = document.getElementById('playBtn');
const replayBtn = document.getElementById('replayBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadNote = document.getElementById('downloadNote');
const scriptWordsEl = document.getElementById('scriptWords');
const sceneCountEl = document.getElementById('sceneCount');
const videoLengthEl = document.getElementById('videoLength');

canvas.width = 720;
canvas.height = 1280;

const state = {
  trends: [...FALLBACK_TRENDS],
  trendSource: 'built-in rotation',
  story: null,
  timeline: [],
  storySource: 'local fallback',
  voiceSource: 'device voice',
  visualSource: 'cinematic fallback',
  visualStyle: 'cursed-real',
  sceneImages: [],
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
  startedAt: 0,
  raf: 0,
  stopTimer: 0,
  speechWordIndex: null,
  generateToken: 0,
};

function setStatus(message, kind = 'ok') {
  statusText.textContent = message;
  statusDot.className = `status-dot${kind === 'busy' ? ' busy' : kind === 'warn' ? ' warn' : ''}`;
}

function setSources() {
  storySourceEl.textContent = state.storySource;
  voiceSourceEl.textContent = state.voiceSource;
  visualSourceEl.textContent = state.visualSource;
  trendSourcePill.textContent = state.trendSource;
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
  wordMeter.textContent = `${words} / 9 words`;
  wordMeter.classList.toggle('over', words > 9);
  genBtn.disabled = words < 1 || words > 9;
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

async function requestSceneImage(scene, sceneIndex, visualStyle, prompt) {
  const response = await fetch('/api/visualize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      visualPrompt: scene.visualPrompt,
      style: visualStyle,
      seed: seedFromString(`${prompt}:${sceneIndex}:${scene.subject}:${scene.setting}`),
    }),
  });
  if (!response.ok) throw new Error(`visualize ${response.status}`);
  const data = await response.json();
  if (!data?.dataURI) throw new Error('empty visual');
  return { image: await loadImage(data.dataURI), source: data.source || 'Workers AI' };
}

async function generateSceneImages(token) {
  if (!state.story) return 0;
  const scenes = state.story.scenes;
  const results = Array(scenes.length).fill(null);
  let cursor = 0;
  let completed = 0;
  let firstSource = '';

  async function worker() {
    while (cursor < scenes.length) {
      const index = cursor;
      cursor += 1;
      try {
        const result = await requestSceneImage(scenes[index], index, state.visualStyle, state.story.prompt);
        if (token !== state.generateToken) return;
        results[index] = result.image;
        firstSource ||= result.source;
      } catch {
        results[index] = null;
      }
      completed += 1;
      if (token === state.generateToken) {
        const ready = results.filter(Boolean).length;
        state.sceneImages = [...results];
        state.visualSource = ready ? `${firstSource || 'Workers AI'} · ${ready}/${scenes.length}` : 'cinematic fallback';
        setSources();
        drawFrame(0);
        setStatus(`Visualizing story scenes… ${completed}/${scenes.length}`, 'busy');
      }
    }
  }

  await Promise.all([worker(), worker()]);
  if (token !== state.generateToken) return 0;
  state.sceneImages = results;
  const ready = results.filter(Boolean).length;
  state.visualSource = ready ? `${firstSource || 'Workers AI'} · ${ready}/${scenes.length}` : 'cinematic fallback';
  setSources();
  return ready;
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
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`narration ${response.status}`);
  const data = await response.json();
  if (!data?.pcmBase64) throw new Error('empty narration');
  return { buffer: decodePcm16(data.pcmBase64, Number(data.sampleRate) || 24000), source: data.source || 'Gemini TTS' };
}

function canRecordNarratedVideo() {
  return Boolean(state.audioBuffer && canvas.captureStream && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext));
}

function updatePlaybackControls() {
  const ready = Boolean(state.story);
  playBtn.disabled = !ready || state.playing;
  replayBtn.disabled = !ready || state.playing;
  stopBtn.disabled = !state.playing;
  downloadBtn.disabled = !ready || state.playing || !canRecordNarratedVideo();
  if (canRecordNarratedVideo()) {
    downloadNote.textContent = 'VIDEO records the full 60-second story-synced canvas + AI narration as WebM on this device.';
  } else if (ready) {
    downloadNote.textContent = 'Preview works now. Narrated video export requires Gemini TTS plus browser MediaRecorder support.';
  } else {
    downloadNote.textContent = 'Generate a rot first. AI scene images are composited into the same canvas used for export.';
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
  setGenerating(true);
  state.audioBuffer = null;
  state.story = null;
  state.timeline = [];
  state.sceneImages = [];
  state.visualStyle = visualStyle;
  state.storySource = 'local fallback';
  state.voiceSource = 'device voice';
  state.visualSource = 'cinematic fallback';
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
  const continuity = generated.continuity || {};
  const scenes = normalizeScenes(generated.scenes, validation.prompt, visualStyle, continuity);
  state.story = { scenes, prompt: validation.prompt, continuity, visualStyle };
  state.timeline = buildSceneTimeline(scenes, TARGET_SECONDS);
  scriptWordsEl.textContent = storyWordCount(scenes);
  sceneCountEl.textContent = scenes.length;
  videoLengthEl.textContent = '60s';
  setSources();
  drawFrame(0);

  setStatus('Story cooked. Building scene imagery and narration in parallel…', 'busy');
  const visualPromise = generateSceneImages(token);
  const narrationPromise = requestNarration(narrationText()).then(narration => {
    if (token !== state.generateToken) return;
    state.audioBuffer = narration.buffer;
    state.voiceSource = narration.source;
    setSources();
  }).catch(() => {
    if (token !== state.generateToken) return;
    state.audioBuffer = null;
    state.voiceSource = 'device speechSynthesis';
    setSources();
  });

  const [visualResult] = await Promise.allSettled([visualPromise, narrationPromise]);
  if (token !== state.generateToken) return;
  const readyImages = visualResult.status === 'fulfilled' ? visualResult.value : 0;
  drawFrame(0);
  setGenerating(false);
  updateWordMeter();
  updatePlaybackControls();
  if (readyImages === scenes.length) {
    setStatus('Ready. All eight story beats have AI scene images plus narration.', 'ok');
  } else if (readyImages > 0) {
    setStatus(`Ready. ${readyImages}/8 scenes have AI images; the rest use the cinematic story fallback.`, 'ok');
  } else {
    setStatus('Ready. Image AI was unavailable, so every scene uses the story-matched cinematic fallback.', 'warn');
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
  utterance.rate = Math.max(0.72, Math.min(1.35, countWords(text) / 170));
  utterance.pitch = 1.04;
  utterance.volume = 1;
  utterance.addEventListener('boundary', event => {
    if (event.name === 'word') state.speechWordIndex = wordIndexFromCharIndex(text, event.charIndex);
  });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function play({ record = false } = {}) {
  if (!state.story || state.playing) return;
  if (record && !canRecordNarratedVideo()) {
    setStatus('Narrated recording is unavailable in this mode/browser. Preview still works.', 'warn');
    return;
  }
  stopPlayback(true);
  state.playing = true;
  state.recording = record;
  state.speechWordIndex = null;
  state.startedAt = performance.now();
  updatePlaybackControls();
  setStatus(record ? 'Recording the full story-synced minute locally…' : 'Now rotting…', 'busy');

  if (state.audioBuffer) {
    const audioContext = ensureAudioContext();
    await audioContext.resume();
    const source = audioContext.createBufferSource();
    source.buffer = state.audioBuffer;
    source.playbackRate.value = Math.max(0.01, state.audioBuffer.duration / TARGET_SECONDS);
    source.connect(audioContext.destination);
    if (record) {
      state.mediaDestination = audioContext.createMediaStreamDestination();
      source.connect(state.mediaDestination);
      beginRecorder(state.mediaDestination);
    }
    state.audioSource = source;
    source.addEventListener('ended', finishPlayback, { once: true });
    source.start(0);
  } else {
    startDeviceSpeech();
  }
  state.raf = requestAnimationFrame(renderPlayback);
  state.stopTimer = window.setTimeout(finishPlayback, TARGET_SECONDS * 1000 + 120);
}

function finishPlayback() {
  if (!state.playing && !state.recording) return;
  state.playing = false;
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

function sceneStateAtTime(seconds) {
  const timeline = state.timeline;
  if (!timeline.length) return null;
  let sceneIndex = timeline.findIndex(scene => seconds >= scene.start && seconds < scene.end);
  if (sceneIndex < 0) sceneIndex = timeline.length - 1;
  const scene = timeline[sceneIndex];
  const words = scene.text.trim().split(/\s+/);
  let localWordIndex = Math.min(words.length - 1, Math.floor(((seconds - scene.start) / Math.max(scene.duration, .001)) * words.length));
  if (!state.audioBuffer && Number.isInteger(state.speechWordIndex)) {
    const map = globalWordMap();
    const mapped = map[Math.min(map.length - 1, Math.max(0, state.speechWordIndex))];
    if (mapped) {
      sceneIndex = mapped.sceneIndex;
      localWordIndex = mapped.localIndex;
      return { scene: timeline[sceneIndex], sceneIndex, words: timeline[sceneIndex].text.trim().split(/\s+/), localWordIndex };
    }
  }
  return { scene, sceneIndex, words, localWordIndex };
}

function roundedRect(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawImageCover(image, progress, sceneIndex) {
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
  const zoom = 1.03 + progress * 0.07;
  const dw = canvas.width * zoom;
  const dh = canvas.height * zoom;
  const driftX = Math.sin(sceneIndex * 1.7 + progress * Math.PI) * 18;
  const driftY = Math.cos(sceneIndex * 1.2 + progress * Math.PI * .7) * 12;
  ctx.drawImage(image, sx, sy, sw, sh, (canvas.width - dw) / 2 + driftX, (canvas.height - dh) / 2 + driftY, dw, dh);
}

function drawCinematicFallback(scene, sceneIndex, progress) {
  const [r, g, b] = hexToRgb(scene.color);
  const gradient = ctx.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, `rgb(${Math.max(8, r - 55)}, ${Math.max(8, g - 55)}, ${Math.max(8, b - 55)})`);
  gradient.addColorStop(.48, `rgb(${Math.max(5, r - 95)}, ${Math.max(5, g - 95)}, ${Math.max(5, b - 95)})`);
  gradient.addColorStop(1, '#05070a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 1280);

  const horizon = 460 + Math.sin(sceneIndex * .8) * 55;
  ctx.globalAlpha = .34;
  ctx.fillStyle = `rgba(${r},${g},${b},.45)`;
  for (let i = 0; i < 7; i += 1) {
    const width = 90 + ((sceneIndex * 31 + i * 47) % 180);
    const height = 170 + ((sceneIndex * 63 + i * 29) % 330);
    ctx.fillRect(i * 118 - 45 + progress * 8, horizon - height, width, height);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(3,5,7,.78)';
  roundedRect(52, 185, 616, 530, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '800 19px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STORY SHOT', 82, 230);
  drawWrappedText(scene.setting, 82, 285, 556, 42, 31, '#ffffff', 800);
  ctx.fillStyle = 'rgba(255,255,255,.48)';
  ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('ACTION', 82, 475);
  drawWrappedText(scene.action, 82, 520, 556, 34, 22, 'rgba(255,255,255,.86)', 700);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '650 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(scene.camera, 82, 675);
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
  const { words: visibleWords, localActiveIndex } = captionWindow(words, activeIndex, 8);
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
  const { scene, sceneIndex, words, localWordIndex } = frame;
  const progress = Math.max(0, Math.min(1, (seconds - scene.start) / Math.max(scene.duration, .001)));
  const factor = chaosFactor();

  ctx.save();
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, 720, 1280);
  const image = state.sceneImages[sceneIndex];
  if (image) drawImageCover(image, progress, sceneIndex);
  else drawCinematicFallback(scene, sceneIndex, progress);

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

  const tinyShake = Math.sin(seconds * 17 + sceneIndex) * 1.8 * factor;
  ctx.translate(tinyShake, 0);
  ctx.fillStyle = 'rgba(0,0,0,.58)';
  roundedRect(28, 28, 664, 82, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '850 20px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCENE ${sceneIndex + 1}/8`, 54, 61);
  ctx.fillStyle = scene.color;
  ctx.font = '900 25px Impact, Arial Black, sans-serif';
  ctx.fillText(scene.burst, 54, 91);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.68)';
  ctx.font = '750 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${String(Math.floor(seconds)).padStart(2, '0')}s / 60s`, 666, 74);

  drawCaption(words, localWordIndex);
  ctx.restore();

  const totalProgress = Math.max(0, Math.min(1, seconds / TARGET_SECONDS));
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.fillRect(0, 1256, 720, 24);
  const progressGradient = ctx.createLinearGradient(0, 0, 720, 0);
  progressGradient.addColorStop(0, '#ff2ec4');
  progressGradient.addColorStop(.5, '#00e5ff');
  progressGradient.addColorStop(1, '#c6ff00');
  ctx.fillStyle = progressGradient;
  ctx.fillRect(0, 1256, 720 * totalProgress, 24);
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
  ctx.fillText('8 scenes • realistic image mode • 60 seconds', 360, 900);
  ctx.fillStyle = 'rgba(255,255,255,.48)';
  ctx.font = '650 23px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('The story plans the shots before the renderer moves.', 360, 952);
}

promptInput.addEventListener('input', updateWordMeter);
genBtn.addEventListener('click', () => generate(promptInput.value));
quickBtn.addEventListener('click', () => {
  const trend = state.trends[Math.floor(Math.random() * state.trends.length)] || FALLBACK_TRENDS[0];
  const prompt = trendToPrompt(trend);
  promptInput.value = prompt;
  updateWordMeter();
  generate(prompt);
});
playBtn.addEventListener('click', () => play({ record: false }));
replayBtn.addEventListener('click', () => play({ record: false }));
stopBtn.addEventListener('click', () => {
  stopPlayback(false);
  setStatus('Stopped. The brain cells have been temporarily preserved.', 'warn');
});
downloadBtn.addEventListener('click', () => play({ record: true }));
chaosSelect.addEventListener('change', () => { if (!state.playing && state.story) drawFrame(0); });
visualStyleSelect.addEventListener('change', () => {
  state.visualStyle = normalizeVisualStyle(visualStyleSelect.value);
  if (state.story) setStatus('Visual style changed. Generate again to rebuild all eight scene images in this style.', 'warn');
});

window.addEventListener('beforeunload', () => stopPlayback(false));
window.setInterval(rotateTrendRail, 12_000);

updateWordMeter();
setSources();
updatePlaybackControls();
drawWelcome();
loadTrends();
