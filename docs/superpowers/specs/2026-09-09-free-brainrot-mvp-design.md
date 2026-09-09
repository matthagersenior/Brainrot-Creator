# Free Brainrot Creator MVP Design

## Goal
Build a free-first web app that turns a very short user prompt or a rotating trend prompt into an approximately 60-second vertical Brainrot video with an AI-written story, audible narration, synchronized subtitles, chaotic animated visuals, and a downloadable video when server-side Gemini TTS is configured.

## Product behavior
- Keep prompts intentionally constrained to at most 9 words.
- Offer a prominent QUICK ROT path that chooses from current trend-inspired prompts.
- Fetch current US Google Trends RSS data when available and filter obvious tragedy, violence, disaster, politics, and sensitive-topic terms before surfacing suggestions.
- Fall back to a curated local rotating prompt pack if trends are unavailable.
- Use Gemini 2.5 Flash for structured story generation when GEMINI_API_KEY is configured.
- Fall back to a deterministic local story generator when the AI endpoint is unavailable, so the app remains usable at $0 with no secrets.
- Use Gemini 2.5 Flash Preview TTS when GEMINI_API_KEY is configured. The API secret must remain server-side.
- Fall back to browser speechSynthesis for audible playback if TTS is unavailable.
- Render visuals, subtitles, scene bursts, progress, and effects into a single 9:16 canvas so the rendered video contains the same visuals the user previews.
- Normalize AI narration playback to 60 seconds by changing AudioBufferSource.playbackRate within a safe range.
- Record canvas video plus WebAudio narration into a downloadable WebM when MediaRecorder and server TTS are available.

## Architecture
Static client files remain deployable as a plain website. Cloudflare Pages Functions add optional free-tier enhancements without making the base app dependent on them.

### Client
- index.html: application shell and controls.
- styles.css: intentionally chaotic but usable responsive visual system.
- app-core.mjs: pure prompt, fallback story, timing, and trend-safety helpers.
- app.mjs: orchestration, API calls, canvas renderer, speech playback, and recording.

### Serverless functions
- functions/api/story.js: validates a short prompt and calls Gemini 2.5 Flash for strict JSON scenes; returns 503 when no key is configured so the browser can use the local fallback.
- functions/api/narrate.js: calls Gemini 2.5 Flash Preview TTS and returns raw 24 kHz mono 16-bit PCM as base64 JSON.
- functions/api/trends.js: fetches Google Trends RSS for the US, filters risky terms, and returns a short trend list; no API key required.

## Story contract
A story contains exactly 8 scenes. Each scene has:
- text: spoken line, approximately 16-22 words
- emoji: one representative emoji
- color: one hex color
- burst: 1-3 uppercase words

Target total narration is 140-160 words. The story must be absurd, high-energy, fictional, and non-defamatory. It may reference pop-culture topics but must not claim real misconduct, clone a real person's voice, include slurs, sexual content involving minors, or turn tragedy into a joke.

## Visual system
Every frame is drawn to a 720x1280 canvas. Each scene receives a color field, large animated emoji/shape subject, particles, camera punch-zooms, scanlines, and an on-screen burst. Captions are drawn in large high-contrast text near the lower third. The active word is highlighted using proportional word timing inside the scene.

## Free-first behavior
No paid provider is mandatory. With no secrets, the app still supports prompt generation, rotating fallback ideas, a full 60-second animated preview, browser narration, and synchronized captions. With a free-tier Gemini API key, the app upgrades to AI story generation and Gemini TTS and can export a video with recorded narration.

## Deployment
Designed for Cloudflare Pages with Pages Functions. Static hosting remains functional without Functions, but AI/TTS enhancements require GEMINI_API_KEY configured as a server-side environment secret.

## Testing
Node built-in tests cover prompt validation, fallback story shape, timing normalization, sensitive-trend filtering, and trend-to-prompt conversion. Manual browser QA covers generation, playback, 60-second timing, subtitle progression, TTS fallback, and downloadable recording.
