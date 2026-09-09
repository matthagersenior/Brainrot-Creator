# Free Brainrot Creator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing single-file ROT MACHINE prototype into a free-first 60-second Brainrot video generator with trend rotation, optional Gemini story/TTS, canvas subtitles/effects, and downloadable WebM output.

**Architecture:** Keep the app static-first and move pure logic into a testable module. Cloudflare Pages Functions proxy Gemini and Google Trends so secrets never enter browser code. The client renders a single exportable 9:16 canvas and combines it with WebAudio narration when recording.

**Tech Stack:** HTML, CSS, ES modules, Canvas 2D, WebAudio, MediaRecorder, Cloudflare Pages Functions, Google Gemini REST API, Google Trends RSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-09-free-brainrot-mvp-design.md`

## Global Constraints
- Prompt limit: 9 words.
- Exactly 8 story scenes; target 140-160 spoken words.
- Video target: 60 seconds.
- No secret API keys in client code.
- App remains usable without any configured provider.
- Trend suggestions filter obvious sensitive/tragedy topics.

---

### Task 1: Pure generation core
**Files:** Create `app-core.mjs`; create `tests/app-core.test.mjs`; create `package.json`.

**Interfaces:** `countWords`, `validatePrompt`, `buildFallbackStory`, `buildSceneTimeline`, `isSafeTrend`, `trendToPrompt`.

- [ ] Write tests for prompt limit, 8-scene fallback shape, 60-second scene timeline, sensitive trend rejection, and 9-word trend prompts.
- [ ] Implement the minimal pure helpers.
- [ ] Run `npm test` and require all tests to pass.

### Task 2: Free-tier serverless APIs
**Files:** Create `functions/api/story.js`, `functions/api/narrate.js`, `functions/api/trends.js`.

**Interfaces:** `POST /api/story {prompt}` -> `{scenes, source}`; `POST /api/narrate {text}` -> `{pcmBase64,sampleRate,channels}`; `GET /api/trends` -> `{trends,source}`.

- [ ] Validate all inputs and cap prompt/narration sizes.
- [ ] Call stable `gemini-2.5-flash` for JSON story generation.
- [ ] Call `gemini-2.5-flash-preview-tts` for raw PCM narration.
- [ ] Fetch Google Trends RSS and apply a conservative sensitive-term filter.
- [ ] Return explicit non-200 provider errors so the client can fall back locally.

### Task 3: Exportable canvas client
**Files:** Replace `index.html`; create `styles.css`; create `app.mjs`.

**Interfaces:** Client calls the three `/api/*` endpoints and falls back to local core behavior when unavailable.

- [ ] Build constrained prompt controls, trend chips, QUICK ROT, chaos level, and status UI.
- [ ] Render every visual element and caption into one 720x1280 canvas.
- [ ] Decode Gemini PCM into WebAudio and normalize playback to exactly 60 seconds.
- [ ] Use browser speechSynthesis as the no-provider playback fallback.
- [ ] Record canvas + WebAudio narration with MediaRecorder and expose a download button.
- [ ] Disable narrated export with a clear explanation when only device speech is available.

### Task 4: Deployment/readme and verification
**Files:** Replace `README.md`; create `_headers`.

- [ ] Document Cloudflare Pages deployment and `GEMINI_API_KEY` configuration.
- [ ] Document zero-secret fallback behavior and free-tier caveats.
- [ ] Run core tests.
- [ ] Inspect branch diff for accidental client secrets and direct third-party AI calls.
- [ ] Verify the HTML imports existing files and every referenced API has a fallback.
