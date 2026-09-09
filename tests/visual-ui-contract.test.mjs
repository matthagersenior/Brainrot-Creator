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

test('visual continuity adapter holds later scene requests for a downsized scene-one identity reference', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const adapter = await readFile(new URL('visual-continuity.js', root), 'utf8');
  assert.match(html, /visual-continuity\.js/);
  assert.match(adapter, /referenceDataURI/);
  assert.match(adapter, /makeReferenceDataURI/);
  assert.match(adapter, /anchorReferencePromise/);
  assert.match(adapter, /identity reference|reference image/i);
});
