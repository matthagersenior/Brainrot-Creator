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
} from './app-core.mjs';

const FALLBACK_TRENDS = [
  'Nintendo',
  'Minecraft',
  'Roblox',
  'Fortnite',
  'viral dance challenge',
  'anime opening',
  'streamer speedrun',
  'mystery mascot',
  'football celebration',
  'movie trailer reaction',
  'AI pet',
  'retro game remake',
];

const canvas = document.getElementById('videoCanvas');
const ctx = canvas.getContext('2d');
const promptInput = document.getElementById('promptInput');
const wordMeter = document.getElementById('wordMeter');
const trendRail = document.getElementById('trendRail');
const trendSource = document.getElementById('trendSource');
const chaosSelect = document.getElementById('chaosSelect');
const genBtn = document.getElementById('genBtn');
const quickBtn = document.getElementById('quickBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const storySourceEl = document.getElementById('storySource');
const voiceSourceEl = document.getElementById('voiceSource');
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
  trendSourcePill.textContent = state.trendSource;
}

function setGenerating(busy) {
  genBtn.disabled = busy;
  quickBtn.disabled = busy;
  promptInput.disabled = busy;
  chaosSelect.disabled = busy;
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
    const safe = Array.isArray(data?.trends)
      ? data.trends.filter(isSafeTrend).filter(Boolean).slice(0, 16)
      : [];
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

async function requestStory(prompt) {
  const response = await fetch('/api/story', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error(`story ${response.status}`);
  const data = await response.json();
  return {
    scenes: normalizeScenes(data.scenes, prompt),
    source: data.source || 'Gemini',
  };
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
  for (let i = 0; i < sampleCount; i += 1) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }
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
  return {
    buffer: decodePcm16(data.pcmBase64, Number(data.sampleRate) || 24000),
    source: data.source || 'Gemini TTS',
  };
}

function canRecordNarratedVideo() {
  return Boolean(
    state.audioBuffer &&
    canvas.captureStream &&
    window.MediaRecorder &&
    (window.AudioContext || window.webkitAudioContext),
  );
}

function updatePlaybackControls() {
  const ready = Boolean(state.story);
  playBtn.disabled = !ready || state.playing;
  replayBtn.disabled = !ready || state.playing;
  stopBtn.disabled = !state.playing;
  downloadBtn.disabled = !ready || state.playing || !canRecordNarratedVideo();
  if (canRecordNarratedVideo()) {
    downloadNote.textContent = 'Download records the full 60-second canvas + AI narration as WebM. Nothing is uploaded for rendering.';
  } else if (ready) {
    downloadNote.textContent = 'Playback works with the free device voice. Narrated download unlocks when the Gemini TTS endpoint is configured and supported by this browser.';
  } else {
    downloadNote.textContent = 'Generate a rot first. Narrated export uses the same canvas you preview.';
  }
}

async function generate(promptValue) {
  const validation = validatePrompt(promptValue);
  if (!validation.ok) {
    setStatus(validation.error, 'warn');
    return;
  }

  const token = ++state.generateToken;
  stopPlayback(true);
  setGenerating(true);
  state.audioBuffer = null;
  state.story = null;
  state.timeline = [];
  state.storySource = 'local fallback';
  state.voiceSource = 'device voice';
  setSources();
  updatePlaybackControls();
  drawWelcome('FERMENTING...');
  setStatus('Writing eight scenes of concentrated nonsense…', 'busy');

  let generated;
  try {
    generated = await requestStory(validation.prompt);
    state.storySource = generated.source;
  } catch {
    generated = buildFallbackStory(validation.prompt);
    state.storySource = 'local fallback';
  }

  if (token !== state.generateToken) return;
  const scenes = normalizeScenes(generated.scenes, validation.prompt);
  state.story = { scenes, prompt: validation.prompt };
  state.timeline = buildSceneTimeline(scenes, TARGET_SECONDS);
  scriptWordsEl.textContent = storyWordCount(scenes);
  sceneCountEl.textContent = scenes.length;
  videoLengthEl.textContent = '60s';
  setSources();
  drawFrame(0);

  setStatus('Story cooked. Summoning the narrator…', 'busy');
  try {
    const narration = await requestNarration(narrationText());
    if (token !== state.generateToken) return;
    state.audioBuffer = narration.buffer;
    state.voiceSource = narration.source;
    setStatus('Ready. AI narration will be stretched or squeezed to exactly 60 seconds.', 'ok');
  } catch {
    state.audioBuffer = null;
    state.voiceSource = 'device speechSynthesis';
    setStatus('Ready in free fallback mode. Device voice will narrate the 60-second preview.', 'ok');
  }

  setSources();
  setGenerating(false);
  updateWordMeter();
  updatePlaybackControls();
}

function pickMediaRecorderMime() {
  const options = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function makeSafeFilename(prompt) {
  const slug = String(prompt || 'brainrot')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'brainrot';
  return `brainrot-${slug}.webm`;
}

function beginRecorder(destination) {
  const videoStream = canvas.captureStream(30);
  const tracks = [
    ...videoStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ];
  state.recordStream = new MediaStream(tracks);
  const mimeType = pickMediaRecorderMime();
  state.recordChunks = [];
  state.recordingAborted = false;
  state.recorder = mimeType
    ? new MediaRecorder(state.recordStream, { mimeType, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(state.recordStream);
  state.recorder.addEventListener('dataavailable', event => {
    if (event.data?.size) state.recordChunks.push(event.data);
  });
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
    setStatus('Saved the full 60-second narrated Brainrot video.', 'ok');
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
    scene.text.trim().split(/\s+/).forEach((word, localIndex) => {
      map.push({ word, sceneIndex, localIndex });
    });
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
  const words = countWords(text);
  utterance.rate = Math.max(0.72, Math.min(1.35, words / 170));
  utterance.pitch = 1.12;
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
  setStatus(record ? 'Recording the full minute locally on this device…' : 'Now rotting…', 'busy');

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
    try {
      state.audioSource.onended = null;
      state.audioSource.stop();
    } catch { /* source may already be stopped */ }
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
  const clean = String(hex || '#ff2ec4').replace('#', '');
  const number = Number.parseInt(clean, 16) || 0xff2ec4;
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function chaosFactor() {
  return { chill: 0.68, cooked: 1, nuclear: 1.38 }[chaosSelect.value] || 1;
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

function drawOutlinedText(text, x, y, fill, size, align = 'center', width = 16) {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px Impact, Arial Black, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = '#050009';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCaption(words, activeIndex) {
  const { words: visibleWords, localActiveIndex } = captionWindow(words, activeIndex, 8);
  ctx.save();
  const fontSize = 58;
  ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`;
  ctx.textBaseline = 'middle';
  const maxWidth = 610;
  const gap = 16;
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

  const baseY = 1015 - ((lines.length - 1) * 38);
  lines.forEach((line, lineIndex) => {
    const total = line.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, line.length - 1);
    let x = 360 - total / 2;
    line.forEach(item => {
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 15;
      ctx.strokeStyle = '#050009';
      ctx.strokeText(item.word, x, baseY + lineIndex * 72);
      ctx.fillStyle = item.index === localActiveIndex ? '#c6ff00' : '#ffffff';
      ctx.fillText(item.word, x, baseY + lineIndex * 72);
      x += item.width + gap;
    });
  });
  ctx.restore();
}

function drawScanlines(intensity) {
  ctx.save();
  ctx.globalAlpha = 0.07 * intensity;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < 1280; y += 9) ctx.fillRect(0, y, 720, 2);
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
  const factor = chaosFactor();
  const [r, g, b] = hexToRgb(scene.color);
  const sceneProgress = Math.max(0, Math.min(1, (seconds - scene.start) / Math.max(scene.duration, .001)));
  const pulse = 1 + Math.sin(seconds * 7.4) * 0.045 * factor;
  const shakeX = Math.sin(seconds * 23 + sceneIndex) * 7 * factor;
  const shakeY = Math.cos(seconds * 19 + sceneIndex * 2) * 6 * factor;

  ctx.save();
  ctx.fillStyle = '#050009';
  ctx.fillRect(0, 0, 720, 1280);
  ctx.translate(shakeX, shakeY);

  const gradient = ctx.createRadialGradient(360, 430, 40, 360, 520, 760);
  gradient.addColorStop(0, `rgba(${r},${g},${b},.83)`);
  gradient.addColorStop(.48, `rgba(${Math.max(0,r-55)},${Math.max(0,g-55)},${Math.max(0,b-55)},.75)`);
  gradient.addColorStop(1, '#07000d');
  ctx.fillStyle = gradient;
  ctx.fillRect(-30, -30, 780, 1340);

  ctx.globalAlpha = .18;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  for (let i = -3; i < 15; i += 1) {
    const y = ((i * 105 + seconds * 85 * factor) % 1500) - 100;
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.lineTo(760, y - 130);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 18; i += 1) {
    const angle = seconds * (.32 + (i % 4) * .05) * factor + i * .8;
    const radius = 130 + (i % 6) * 52;
    const x = 360 + Math.cos(angle) * radius;
    const y = 545 + Math.sin(angle * 1.2) * radius * .72;
    const size = 22 + (i % 5) * 8;
    ctx.globalAlpha = .18 + (i % 3) * .08;
    ctx.fillStyle = i % 2 ? '#ffffff' : scene.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(360, 545);
  ctx.rotate(Math.sin(seconds * 2.4 + sceneIndex) * .12 * factor);
  ctx.scale(pulse * (1 + sceneProgress * .05), pulse * (1 + sceneProgress * .05));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 28;
  ctx.font = '300px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.fillText(scene.emoji, 0, 0);
  ctx.restore();

  const burstSize = 70 + Math.sin(seconds * 9) * 4 * factor;
  drawOutlinedText(scene.burst, 360, 205, sceneIndex % 2 ? '#00e5ff' : '#c6ff00', burstSize, 'center', 18);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '800 23px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.78)';
  ctx.fillText(`SCENE ${sceneIndex + 1}/8  •  ${String(Math.floor(seconds)).padStart(2, '0')}s / 60s`, 360, 82);
  ctx.restore();

  drawCaption(words, localWordIndex);
  drawScanlines(factor);
  ctx.restore();

  const progress = Math.max(0, Math.min(1, seconds / TARGET_SECONDS));
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.fillRect(0, 1255, 720, 25);
  const progressGradient = ctx.createLinearGradient(0, 0, 720, 0);
  progressGradient.addColorStop(0, '#ff2ec4');
  progressGradient.addColorStop(.5, '#00e5ff');
  progressGradient.addColorStop(1, '#c6ff00');
  ctx.fillStyle = progressGradient;
  ctx.fillRect(0, 1255, 720 * progress, 25);
}

function drawWelcome(label = 'READY TO ROT') {
  ctx.fillStyle = '#080010';
  ctx.fillRect(0, 0, 720, 1280);
  const gradient = ctx.createRadialGradient(360, 430, 30, 360, 500, 750);
  gradient.addColorStop(0, 'rgba(255,46,196,.5)');
  gradient.addColorStop(.5, 'rgba(0,229,255,.15)');
  gradient.addColorStop(1, '#080010');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '290px Apple Color Emoji, Segoe UI Emoji, sans-serif';
  ctx.fillText('🧠', 360, 525);
  drawOutlinedText(label, 360, 230, '#c6ff00', 72, 'center', 18);
  drawOutlinedText('60 SECOND', 360, 875, '#ffffff', 72, 'center', 18);
  drawOutlinedText('ROT MACHINE', 360, 955, '#00e5ff', 76, 'center', 18);
  ctx.font = '700 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText('9 words in. One minute of nonsense out.', 360, 1050);
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
chaosSelect.addEventListener('change', () => {
  if (!state.playing && state.story) drawFrame(0);
});

window.addEventListener('beforeunload', () => stopPlayback(false));
window.setInterval(rotateTrendRail, 12_000);

updateWordMeter();
setSources();
updatePlaybackControls();
drawWelcome();
loadTrends();
