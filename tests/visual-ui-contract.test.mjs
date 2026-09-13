import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('creator exposes realistic visual styles and visual source status', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /id="visualStyleSelect"/);
  assert.match(html, /value="cursed-real"[^>]*selected/);
  assert.match(html, /value="photoreal"/);
  assert.match(html, /value="cinematic"/);
  assert.match(html, /value="cartoon"/);
  assert.match(html, /id="visualSource"/);
});

test('client requests scene images and renders image-backed frames', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  assert.match(app, /\/api\/visualize/);
  assert.match(app, /sceneImages/);
  assert.match(app, /drawImage/);
  assert.match(app, /visualStyleSelect/);
});

test('client drives playback through linked micro-shots while reusing the eight AI keyframes', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  assert.match(app, /buildMicroShotTimeline/);
  assert.match(app, /microTimeline/);
  assert.match(app, /microShotStateAtTime/);
  assert.match(app, /motion\.zoomStart/);
  assert.match(app, /transitionFromSceneIndex/);
});


test('creator labels the free multi-shot format and carries prior-beat continuity into later keyframe prompts', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(html, /id="sceneCount">32<\/b><span>linked shots<\/span>/);
  assert.match(html, /8 AI keyframes[^<]*32 linked/);
  assert.match(app, /Continue the immediately previous story beat/);
  assert.match(app, /sceneCountEl\.textContent = state\.microTimeline\.length/);
});


test('creator uses separate create, cooking, and result screens with final-player actions', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const css = await readFile(new URL('styles.css', root), 'utf8');

  assert.match(html, /id="createView"/);
  assert.match(html, /id="cookingView"/);
  assert.match(html, /id="resultView"/);
  assert.match(html, /id="loadingGallery"/);
  assert.match(html, /id="playPauseBtn"/);
  assert.match(html, /id="repeatBtn"/);
  assert.match(html, /id="nextTrendBtn"/);
  assert.match(html, /id="homeBtn"/);

  assert.match(app, /setView\(['"]cooking['"]\)/);
  assert.match(app, /setView\(['"]result['"]\)/);
  assert.match(app, /pausePlayback/);
  assert.match(app, /resumePlayback/);
  assert.match(app, /generateNextTrend/);
  assert.match(app, /loadingGallery/);

  assert.match(css, /\.app-view\[hidden\]/);
  assert.match(css, /100svh/);
  assert.match(css, /\.result-stage-shell/);
});


test('cooking screen uses story-blind chaos instead of revealing generated keyframes', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const html = await readFile(new URL('index.html', root), 'utf8');

  assert.match(app, /COOKING_CHAOS_LABELS/);
  assert.match(app, /startCookingChaos/);
  assert.match(app, /stopCookingChaos/);
  assert.match(app, /renderCookingChaos/);
  assert.doesNotMatch(app, /tile\.style\.backgroundImage\s*=\s*.*image\.src/);
  assert.match(html, /aria-label="Story-blind Brainrot cooking animation"/);
});


test('client sends story style and mood arc to TTS and labels story-matched voice mode', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(app, /visualStyle:\s*state\.visualStyle/);
  assert.match(app, /moods:\s*state\.story\.scenes\.map/);
  assert.match(app, /voiceMode/);
  assert.match(app, /story-matched/);
});

test('free-first fallback chain prioritizes quality providers before emergency Horde and keeps device speech last', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(html, /https:\/\/js\.puter\.com\/v2\//);
  assert.match(html, /id="resultVisualSource"/);
  assert.match(html, /id="resultVoiceSource"/);

  const sceneChain = app.slice(app.indexOf('async function requestSceneImage'), app.indexOf('function summarizeVisualSources'));
  const cloudflare = sceneChain.indexOf('/api/visualize');
  const pollinations = sceneChain.indexOf('requestPollinationsSceneImage');
  const puter = sceneChain.indexOf('requestPuterSceneImage');
  const horde = sceneChain.indexOf('requestHordeSceneImage');
  const flux = app.indexOf('black-forest-labs/flux-schnell');
  const leonardo = app.indexOf('leonardoai/lucid-origin');
  assert.ok(cloudflare >= 0 && pollinations > cloudflare && puter > pollinations && horde > puter);
  assert.ok(flux >= 0 && leonardo >= 0);
  assert.match(app, /replicate-image-generation/);
  assert.match(app, /Puter signed out/);
  assert.match(app, /txt2img/);
  assert.doesNotMatch(app, /gemini-[^'"]*image|nano banana/i);

  assert.match(app, /requestNarrationWithFallback/);
  assert.match(app, /txt2speech/);
  assert.match(app, /device speechSynthesis/);
  assert.match(app, /nearest generated imagery/);
});

test('quality-first image fallback uses Pollinations ahead of emergency Horde and rejects low-detail frames', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  const chain = app.slice(app.indexOf('async function requestSceneImage'), app.indexOf('function summarizeVisualSources'));
  const cloudflare = chain.indexOf('/api/visualize');
  const pollinations = chain.indexOf('requestPollinationsSceneImage');
  const puter = chain.indexOf('requestPuterSceneImage');
  const horde = chain.indexOf('requestHordeSceneImage');

  assert.ok(cloudflare >= 0 && pollinations > cloudflare && puter > pollinations && horde > puter);
  assert.match(app, /for \(const model of \['flux', 'zimage'\]\)/);
  assert.match(app, /inspectImageQuality/);
  assert.match(app, /rejected low-detail frame/);
  assert.match(app, /scheduled nearest-anchor reuse/);
  assert.match(app, /do not visualize abstract words or concepts/);
});
