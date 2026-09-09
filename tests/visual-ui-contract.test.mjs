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

test('client generates scene one first and reuses a downsized reference for later scene continuity', async () => {
  const app = await readFile(new URL('app.mjs', root), 'utf8');
  assert.match(app, /referenceDataURI/);
  assert.match(app, /makeReferenceDataURI/);
  assert.match(app, /requestSceneImage\(scenes\[0\]/);
  assert.match(app, /input image|identity reference|reference/i);
});
