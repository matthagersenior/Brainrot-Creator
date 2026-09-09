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

test('production smoke test requires a real FLUX image before slower Gemini checks', async () => {
  const workflow = await workflowText();
  const visualIndex = workflow.indexOf('visual_status=');
  const storyIndex = workflow.indexOf('story_status=');

  assert.ok(visualIndex > 0, 'visual smoke check should exist');
  assert.ok(storyIndex > visualIndex, 'visual check should run before story generation');
  assert.match(workflow, /if \[\[ "\$visual_status" != "200" \]\]; then/);
  assert.match(workflow, /Workers AI scene visual endpoint failed with HTTP/);
  assert.match(workflow, /data:image\/jpeg;base64,/);
  assert.doesNotMatch(workflow, /Workers AI binding is present but image generation is temporarily unavailable/);
});
