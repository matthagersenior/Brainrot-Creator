import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mobile layout fits the real device viewport and safe areas', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /env\(safe-area-inset-left\)/);
  assert.match(css, /env\(safe-area-inset-right\)/);
  assert.match(css, /--preview-fit-height:/);
  assert.match(css, /100svh/);
  assert.match(css, /\.stage-shell[^{]*\{[^}]*calc\(var\(--preview-fit-height\)\s*\*\s*9\s*\/\s*16\)/s);
});
