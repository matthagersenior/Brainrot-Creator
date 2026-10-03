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


test('creator keeps the multi-shot engine but strips explanatory copy from the visible prompt screen', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const css = await readFile(new URL('styles.css', root), 'utf8');

  assert.match(html, /id="sceneCount">32<\/span>/);
  assert.match(html, /id="promptInput"[^>]*rows="8"/);
  assert.match(html, /placeholder="What should happen\?"/);
  assert.doesNotMatch(html, /FREE MULTI-SHOT FORMAT|A richer prompt in|Describe the idea, characters, setting/i);
  assert.match(css, /\.creator-hidden-metrics/);
  assert.match(css, /min-height:\s*clamp\(190px,\s*30svh,\s*310px\)/);
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
  assert.match(html, /id="chaosCanvas"/);
  assert.match(html, /id="chaosProgressRing"/);
  assert.match(html, /id="playPauseBtn"/);
  assert.match(html, /id="repeatBtn"/);
  assert.match(html, /id="nextTrendBtn"/);
  assert.match(html, /id="homeBtn"/);

  assert.match(app, /setView\(['"]cooking['"]\)/);
  assert.match(app, /setView\(['"]result['"]\)/);
  assert.match(app, /pausePlayback/);
  assert.match(app, /resumePlayback/);
  assert.match(app, /generateNextTrend/);
  assert.match(app, /handleChaosTap/);
  assert.match(app, /finishCookingChaos/);

  assert.match(css, /\.app-view\[hidden\]/);
  assert.match(css, /100svh/);
  assert.match(css, /\.result-stage-shell/);
});


test('cooking screen is an interactive story-blind mini-game instead of generation status cards', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const html = await readFile(new URL('index.html', root), 'utf8');
  const css = await readFile(new URL('styles.css', root), 'utf8');

  assert.match(app, /CHAOS_OBJECTS/);
  assert.match(app, /startCookingChaos/);
  assert.match(app, /stopCookingChaos/);
  assert.match(app, /renderCookingChaos/);
  assert.match(app, /handleChaosTap/);
  assert.match(app, /cookingScore/);
  assert.match(app, /cookingCombo/);
  assert.match(app, /finishCookingChaos/);
  assert.match(html, /id="chaosCanvas"/);
  assert.match(html, /Tap everything\./);
  assert.match(html, /KEEP THE COMBO ALIVE/);
  assert.doesNotMatch(html, /keyframes processed|Building your one-minute disaster/i);
  assert.match(css, /\.chaos-game-shell/);
  assert.match(css, /touch-action:\s*none/);
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
  assert.match(app, /graphic\/text-like frame/);
  assert.match(app, /scheduled nearest-anchor reuse/);
  assert.match(app, /do not visualize abstract words or concepts/);
});


test('playback keeps voice cadence natural and uses film-style transitions instead of colored story cards', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(app, /naturalNarrationTiming/);
  assert.match(app, /narrationPlaybackRate/);
  assert.doesNotMatch(app, /audioBuffer\.duration\s*\/\s*TARGET_SECONDS/);
  assert.match(app, /drawSceneTransition/);
  assert.match(app, /transitionWindow\s*=\s*0\.42/);
  assert.match(app, /blur\(/);
  assert.doesNotMatch(app, /STORY SHOT/);
});


test('rendered video keeps scene and shot metadata off the image', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const drawFrame = app.slice(app.indexOf('function drawFrame'), app.indexOf('function drawWelcome'));

  assert.doesNotMatch(drawFrame, /SCENE\s*\$\{/);
  assert.doesNotMatch(drawFrame, /SHOT\s*\$\{/);
  assert.doesNotMatch(drawFrame, /scene\.burst/);
  assert.doesNotMatch(drawFrame, /s \/ 60s/);
  assert.doesNotMatch(drawFrame, /totalProgress|progressGradient/);
});


test('playback enters distraction-free watch mode and removes the corner canvas badge', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  const css = await readFile(new URL('styles.css', root), 'utf8');

  assert.doesNotMatch(html, /canvas-badge/);
  assert.match(app, /watch-mode/);
  assert.match(app, /videoCanvas.*addEventListener|canvas\.addEventListener/);
  assert.match(css, /body\.watch-mode/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /100dvh/);
  assert.match(css, /\.watch-mode[\s\S]*\.result-controls[\s\S]*display:\s*none/);
});


test('video-first visuals animate between two generated anchors per scene without losing the existing motion fallback', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(app, /VISUAL_FRAMES_PER_SCENE\s*=\s*2/);
  assert.match(app, /sceneFrames/);
  assert.match(app, /frameIndex/);
  assert.match(app, /motionFramePrompt/);
  assert.match(app, /drawMotionPair/);
  assert.match(app, /sceneProgress/);
  assert.match(app, /16 motion frames|16 visual frames/i);
  assert.match(app, /state\.sceneImages/);
});


test('default generated visuals use a recognizable contemporary brainrot meme language rather than generic realism', async () => {
  const core = await readFile(new URL('app-core.mjs', root), 'utf8');
  const story = await readFile(new URL('functions/api/story.js', root), 'utf8');
  const visual = await readFile(new URL('functions/api/visualize.js', root), 'utf8');

  assert.match(core, /surreal AI meme|brainrot/i);
  assert.match(core, /hybrid|mashup/i);
  assert.match(story, /recurring meme-worthy AI character|surreal hybrid/i);
  assert.doesNotMatch(story, /avoid[^\n]*mascot/i);
  assert.match(visual, /short-form meme|brainrot/i);
});


test('video-first pipeline generates real scene clips and falls back to motion frames per scene', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  assert.match(app, /puter\.ai\.txt2vid/);
  assert.match(app, /sceneVideos/);
  assert.match(app, /requestPuterSceneVideo/);
  assert.match(app, /generateSceneVideos/);
  assert.match(app, /seedance-2-0-mini/);
  assert.match(app, /input_reference/);
  assert.match(app, /last_frame/);
  assert.match(app, /generate_audio:\s*false/);
  assert.match(app, /drawSceneVideo/);
  assert.match(app, /pauseSceneVideos/);
  assert.match(app, /video[^\n]*fallback|motion-frame fallback/i);
});

test('real scene video stays compatible with the existing narrated canvas export', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');

  const drawFrame = app.slice(app.indexOf('function drawFrame'), app.indexOf('function drawWelcome'));
  assert.match(drawFrame, /drawLinkedVisual/);
  assert.match(app, /canvas\.captureStream/);
  assert.match(app, /syncSceneVideo/);
  assert.match(app, /video\.playbackRate/);
});


test('result screen shows the rot and actions without exposing implementation details', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const resultMarkup = html.slice(html.indexOf('id="resultView"'), html.indexOf('<footer', html.indexOf('id="resultView"')));

  assert.doesNotMatch(resultMarkup, /resultVisualSource|resultVoiceSource|downloadNote/);
  assert.doesNotMatch(resultMarkup, /Visuals:|Voice:|Cloudflare|Gemini|motion-frame|720×1280|WebM/i);
});


test('creator screen does not expose free-first implementation strategy', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const creatorMarkup = html.slice(html.indexOf('id="createView"'), html.indexOf('id="cookingView"'));

  assert.doesNotMatch(creatorMarkup, /\$0-FIRST|FREE[- ]?FIRST|free-badge/i);
});
