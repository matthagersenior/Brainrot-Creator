import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function workflowText() {
  return readFile(new URL('.github/workflows/static.yml', root), 'utf8');
}

test('Pages deploy relies on root Wrangler config discovery instead of --config', async () => {
  const workflow = await workflowText();
  assert.match(workflow, /wrangler@4 pages deploy \.pages-dist/);
  assert.doesNotMatch(workflow, /pages deploy[\s\S]{0,240}--config(?:=|\s)/);
});

test('production smoke test waits for the new Cloudflare alias content before API checks', async () => {
  const workflow = await workflowText();
  assert.match(workflow, /Waiting for Cloudflare production alias/);
  assert.match(workflow, /for attempt in \{1\.\.30\}/);
  assert.match(workflow, /grep -q 'visualStyleSelect'/);
  assert.match(workflow, /sleep 2/);
});
