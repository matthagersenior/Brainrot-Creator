import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Pages deploy relies on root Wrangler config discovery instead of --config', async () => {
  const workflow = await readFile(new URL('.github/workflows/static.yml', root), 'utf8');
  assert.match(workflow, /wrangler@4 pages deploy \.pages-dist/);
  assert.doesNotMatch(workflow, /pages deploy[\s\S]{0,240}--config(?:=|\s)/);
});
