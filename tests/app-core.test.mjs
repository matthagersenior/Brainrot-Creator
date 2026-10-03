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
import * as core from '../app-core.mjs';

test('countWords and validatePrompt allow rich prompts up to sixty words', () => {
  assert.equal(countWords('one two three'), 3);
  assert.equal(validatePrompt('one two three').ok, true);
  assert.equal(validatePrompt(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')).ok, true);
  assert.equal(validatePrompt(Array.from({ length: 61 }, (_, i) => `word${i}`).join(' ')).ok, false);
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

test('trendToPrompt stays concise even though manual prompts may be richer', () => {
  const prompt = trendToPrompt('Nintendo Ocarina of Time remake official trailer');
  assert.ok(countWords(prompt) <= 12);
  assert.ok(prompt.length > 0);
});


test('all visual styles expand eight story beats into thirty-two linked micro-shots without extra image keyframes', () => {
  const styles = ['cursed-real', 'photoreal', 'cinematic', 'cartoon'];

  for (const style of styles) {
    const story = buildFallbackStory('frog at the DMV', style);
    const sceneTimeline = buildSceneTimeline(story.scenes, 60);
    const shots = core.buildMicroShotTimeline(sceneTimeline, style);

    assert.equal(core.MICRO_SHOTS_PER_SCENE, 4);
    assert.equal(shots.length, 32);
    assert.equal(shots[0].start, 0);
    assert.equal(shots.at(-1).end, 60);

    for (let index = 1; index < shots.length; index += 1) {
      assert.equal(shots[index - 1].end, shots[index].start);
    }

    for (let sceneIndex = 0; sceneIndex < 8; sceneIndex += 1) {
      const group = shots.filter(shot => shot.sceneIndex === sceneIndex);
      assert.equal(group.length, 4);
      assert.deepEqual(group.map(shot => shot.shotIndex), [0, 1, 2, 3]);
      assert.deepEqual([...new Set(group.map(shot => shot.sourceImageIndex))], [sceneIndex]);
      assert.ok(group.every(shot => shot.visualStyle === style));
      assert.ok(group.every(shot => shot.motion && Number.isFinite(shot.motion.zoomStart)));
      assert.ok(group.every(shot => shot.motion && Number.isFinite(shot.motion.zoomEnd)));
    }
  }
});

test('linked micro-shots preserve beat-to-beat continuity and style-specific motion language', () => {
  const story = buildFallbackStory('frog at the DMV', 'cursed-real');
  const sceneTimeline = buildSceneTimeline(story.scenes, 60);
  const realistic = core.buildMicroShotTimeline(sceneTimeline, 'cursed-real');
  const cartoon = core.buildMicroShotTimeline(sceneTimeline, 'cartoon');

  assert.equal(realistic[4].sceneIndex, 1);
  assert.equal(realistic[4].transitionFromSceneIndex, 0);
  assert.equal(realistic[4].sourceImageIndex, 1);
  assert.equal(realistic[3].sourceImageIndex, 0);
  assert.notDeepEqual(realistic[0].motion, cartoon[0].motion);
  assert.ok(cartoon.some(shot => Math.abs(shot.motion.rotationEnd) > Math.abs(realistic[0].motion.rotationEnd)));
});


test('captions stay on phrase-sized chunks instead of sliding every spoken word', () => {
  const words = ['DMV', 'doors', 'close', 'behind', 'one', 'employee.', 'Then', 'silence.'];
  const early = core.captionWindow(words, 1, 6);
  const late = core.captionWindow(words, 4, 6);
  const next = core.captionWindow(words, 6, 6);

  assert.deepEqual(early.words, ['DMV', 'doors', 'close', 'behind', 'one', 'employee.']);
  assert.deepEqual(late.words, early.words);
  assert.deepEqual(next.words, ['Then', 'silence.']);
});

test('punctuation-aware subtitle timing leaves a readable beat at sentence endings', () => {
  const words = ['go.', 'next'];
  assert.equal(core.pacedWordIndex(words, 0.55), 0);
  assert.equal(core.pacedWordIndex(words, 0.99), 1);
});


test('timestamped narration selects the word actually being spoken', () => {
  const timings = [
    { word: 'The', start: 0.10, end: 0.28, scriptIndex: 0 },
    { word: 'frog', start: 0.31, end: 0.62, scriptIndex: 1 },
    { word: 'waits', start: 0.95, end: 1.24, scriptIndex: 2 },
  ];

  assert.equal(core.timedWordIndex(timings, 0.05), 0);
  assert.equal(core.timedWordIndex(timings, 0.20), 0);
  assert.equal(core.timedWordIndex(timings, 0.50), 1);
  assert.equal(core.timedWordIndex(timings, 0.80), 1);
  assert.equal(core.timedWordIndex(timings, 1.02), 2);
  assert.equal(core.timedWordIndex(timings, 4), 2);
  assert.equal(core.timedWordIndex([], 1), null);
});


test('loading-game missions turn tapping into small rotating objectives without blocking free play', () => {
  const collect = core.createChaosMission(0);
  assert.equal(collect.type, 'collect');
  assert.equal(collect.target, 3);
  assert.match(collect.label, /3/);

  let mission = core.advanceChaosMission(collect, { glyph: collect.glyph, hit: true });
  mission = core.advanceChaosMission(mission, { glyph: collect.glyph, hit: true });
  assert.equal(mission.progress, 2);
  assert.equal(mission.complete, false);

  mission = core.advanceChaosMission(mission, { glyph: collect.glyph, hit: true });
  assert.equal(mission.complete, true);

  const selective = core.createChaosMission(3);
  const wrong = core.advanceChaosMission(selective, { glyph: '🚫', hit: true });
  assert.equal(wrong.progress, 0);
  assert.equal(wrong.complete, false);
});


test('sparse narration timestamps interpolate instead of freezing the first highlighted word', () => {
  const timings = [
    { word: 'The', start: 0.10, end: 0.22, scriptIndex: 0 },
    { word: 'dribbling', start: 3.90, end: 4.20, scriptIndex: 5 },
  ];

  assert.equal(core.syncedWordIndex(timings, 0.12, 6, 4.4), 0);
  assert.ok(core.syncedWordIndex(timings, 1.8, 6, 4.4) >= 1);
  assert.ok(core.syncedWordIndex(timings, 3.2, 6, 4.4) >= 3);
  assert.equal(core.syncedWordIndex(timings, 4.1, 6, 4.4), 5);
});

test('caption timing continues through the script when transcription stops early', () => {
  const timings = [
    { word: 'The', start: 0.10, end: 0.22, scriptIndex: 0 },
    { word: 'corn', start: 0.24, end: 0.50, scriptIndex: 1 },
  ];

  const late = core.syncedWordIndex(timings, 3.5, 6, 4.5);
  assert.ok(late >= 3);
  assert.equal(core.syncedWordIndex(timings, 4.5, 6, 4.5), 5);
});
