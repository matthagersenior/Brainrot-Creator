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
