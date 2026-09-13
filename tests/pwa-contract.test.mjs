import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('creator is installable as a branded standalone PWA with offline app shell', async () => {
  const [html, manifestText, worker, app] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('manifest.webmanifest', root), 'utf8'),
    readFile(new URL('sw.js', root), 'utf8'),
    readFile(new URL('app.mjs', root), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /id="installBtn"/);
  assert.match(html, /id="installHint"/);

  assert.equal(manifest.name, 'ROT MACHINE — Brainrot Creator');
  assert.equal(manifest.short_name, 'ROT MACHINE');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.orientation, 'portrait-primary');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.src.startsWith('./')));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.src.startsWith('./')));
  assert.ok(manifest.icons.some(icon => String(icon.purpose || '').includes('maskable')));

  assert.match(worker, /addEventListener\(['"]install['"]/);
  assert.match(worker, /addEventListener\(['"]fetch['"]/);
  assert.match(worker, /SCOPE_URL/);
  assert.match(worker, /OFFLINE_FALLBACK/);
  assert.match(app, /serviceWorker\.register/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /installBtn/);
});

test('PWA icon files exist as valid PNG assets at the declared sizes', async () => {
  const [icon192, icon512] = await Promise.all([
    readFile(new URL('icons/icon-192.png', root)),
    readFile(new URL('icons/icon-512.png', root)),
  ]);
  const signature = '89504e470d0a1a0a';

  assert.equal(icon192.subarray(0, 8).toString('hex'), signature);
  assert.equal(icon192.readUInt32BE(16), 192);
  assert.equal(icon192.readUInt32BE(20), 192);
  assert.equal(icon512.subarray(0, 8).toString('hex'), signature);
  assert.equal(icon512.readUInt32BE(16), 512);
  assert.equal(icon512.readUInt32BE(20), 512);
});

test('polished app shell exposes install affordance and automatic voice-cast status', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const css = await readFile(new URL('styles.css', root), 'utf8');

  assert.match(html, /INSTALL APP/);
  assert.match(html, /AUTO VOICE CAST/);
  assert.match(html, /up to 60 words/i);
  assert.match(css, /\.app-utility/);
  assert.match(css, /\.install-btn/);
  assert.match(css, /backdrop-filter/);
});

test('Cloudflare production bundle includes and verifies the PWA assets', async () => {
  const workflow = await readFile(new URL('.github/workflows/static.yml', root), 'utf8');
  assert.match(workflow, /manifest\.webmanifest sw\.js/);
  assert.match(workflow, /icons\/icon-192\.png icons\/icon-512\.png/);
  assert.match(workflow, /PWA manifest and service worker passed/);
  assert.match(workflow, /daily free allocation/);
  assert.match(workflow, /api\/pollinations-image/);
  assert.match(workflow, /fallback passed with a real Pollinations image payload/);
});
