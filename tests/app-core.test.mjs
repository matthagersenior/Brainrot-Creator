import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  validatePrompt,
  buildFallbackStory,
  buildSceneTimeline,
  isSafeTrend,
  trendToPrompt,
  normalizeScenes,
  normalizeVisualStyle,
  getVisualStylePreset,
} from '../app-core.mjs';

test('countWords and validatePrompt enforce nine-word limit', () => {
  assert.equal(countWords('one two three'), 3);
  assert.equal(validatePrompt('one two three').ok, true);
  assert.equal(validatePrompt('one two three four five six seven eight nine ten').ok, false);
});

test('fallback story always has eight valid story-driven visual scenes', () => {
  const story = buildFallbackStory('Nintendo at the DMV', 'cursed-real');
  assert.equal(story.scenes.length, 8);
  assert.ok(story.continuity?.subject);
  assert.equal(story.visualStyle, 'cursed-real');
  for (const scene of story.scenes) {
    assert.ok(scene.text.length > 0);
    assert.match(scene.color, /^#[0-9a-f]{6}$/i);
    assert.ok(scene.burst);
    assert.ok(scene.subject);
    assert.ok(scene.setting);
    assert.ok(scene.action);
    assert.ok(scene.camera);
    assert.ok(scene.mood);
    assert.match(scene.visualPrompt, /vertical/i);
  }
});

test('normalizeScenes repairs malformed provider scenes to eight story-driven scenes', () => {
  const scenes = normalizeScenes([{ text: 'hello world', color: 'bad', burst: 'hello' }], 'test', 'photoreal');
  assert.equal(scenes.length, 8);
  assert.match(scenes[0].color, /^#[0-9a-f]{6}$/i);
  assert.equal(scenes[0].burst, 'HELLO');
  assert.ok(scenes[0].subject);
  assert.ok(scenes[0].setting);
  assert.ok(scenes[0].action);
  assert.ok(scenes[0].camera);
  assert.ok(scenes[0].mood);
  assert.match(scenes[0].visualPrompt, /photo|real|cinematic/i);
});

test('visual style presets default to cursed-real and distinguish realism modes', () => {
  assert.equal(normalizeVisualStyle(), 'cursed-real');
  assert.equal(normalizeVisualStyle('unknown'), 'cursed-real');
  assert.equal(normalizeVisualStyle('photoreal'), 'photoreal');
  assert.match(getVisualStylePreset('cursed-real').prompt, /real/i);
  assert.match(getVisualStylePreset('photoreal').prompt, /photo/i);
  assert.match(getVisualStylePreset('cinematic').prompt, /cinematic/i);
  assert.match(getVisualStylePreset('cartoon').prompt, /cartoon/i);
});

test('timeline fills exactly sixty seconds with no gaps', () => {
  const story = buildFallbackStory('sigma frog at school');
  const timeline = buildSceneTimeline(story.scenes, 60);
  assert.equal(timeline.length, 8);
  assert.equal(timeline[0].start, 0);
  assert.equal(timeline.at(-1).end, 60);
  for (let i = 1; i < timeline.length; i += 1) {
    assert.equal(timeline[i - 1].end, timeline[i].start);
  }
});

test('sensitive trends are rejected conservatively', () => {
  assert.equal(isSafeTrend('Nintendo announces new Zelda game'), true);
  assert.equal(isSafeTrend('school shooting updates'), false);
  assert.equal(isSafeTrend('celebrity death investigation'), false);
  assert.equal(isSafeTrend('presidential election results'), false);
});

test('trendToPrompt stays within nine words', () => {
  const prompt = trendToPrompt('Nintendo Ocarina of Time remake official trailer');
  assert.ok(countWords(prompt) <= 9);
  assert.ok(prompt.length > 0);
});
