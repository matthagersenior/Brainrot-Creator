# Brainrot Creator — ROT MACHINE

A free-first web app that turns a prompt of **9 words or fewer** into a vertical **60-second Brainrot short** with an AI-generated story, narration, subtitles, and story-synced visuals.

## Current visual pipeline

The renderer is scene-driven instead of effect-driven:

1. Gemini writes one connected 8-scene story.
2. The story response includes a continuity profile for the recurring subject/world.
3. Every scene gets its own subject, setting, action, camera, mood, and text-to-image prompt.
4. Cloudflare Workers AI tries to generate a scene image with FLUX.1 Schnell.
5. The browser animates each scene image with restrained push/pan motion and draws synchronized captions over it.
6. If image generation is unavailable for a scene, the canvas uses a story-matched cinematic fallback that shows that scene's planned setting/action instead of unrelated emoji graphics.

Visual modes:

- **Cursed Real** — default; realistic but subtly uncanny.
- **Photoreal** — grounded documentary/photo treatment.
- **Cinematic** — live-action film-still treatment.
- **Brainrot Cartoon** — keeps the intentionally illustrated option.

## What works with no provider access

- 9-word prompt limit
- Quick Rot random prompt generation
- rotating built-in trend-style prompt pack
- 8-scene local story fallback with continuity and visual shot plans
- exact 60-second canvas playback
- large synchronized subtitles
- cinematic story fallback for every scene
- device `speechSynthesis` narration when the browser supports it
- responsive mobile-first UI

The app does not become unusable when an AI provider is missing, overloaded, or a quota is exhausted.

## Gemini story + narration

When `GEMINI_API_KEY` is configured, the app uses:

- `gemini-3.6-flash` for the structured 8-scene story when available
- `gemini-3.1-flash-lite` as a free-tier story fallback on retryable provider capacity errors
- `gemini-2.5-flash-preview-tts` for narration
- Canvas + WebAudio + MediaRecorder to record a narrated `.webm` locally in the browser

The Gemini key is never sent to client JavaScript.

## Free-first scene images with Cloudflare Workers AI

The Cloudflare Pages project has an `AI` binding configured in `wrangler.jsonc`. `POST /api/visualize` uses:

- `@cf/black-forest-labs/flux-1-schnell`
- 4 diffusion steps
- deterministic per-scene seeds derived from the story
- visual prompts that explicitly preserve scene continuity and discourage text/watermarks inside the image

Cloudflare Workers AI currently includes a daily free allocation. If it is exhausted or model capacity is unavailable, the client automatically falls back per scene instead of failing the whole video.

## Live trend rotation

`GET /api/trends` reads the public Google Trends Trending Now RSS feed for the United States. The endpoint removes obvious tragedy, violence, disaster, politics, self-harm, and other sensitive terms before suggestions reach the UI.

If Google Trends is unavailable, the app automatically returns to the built-in rotation.

## Automated Cloudflare deployment

The GitHub Actions workflow handles the Cloudflare setup after these repository secrets exist:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GEMINI_API_KEY`

On a push to `main`, the workflow:

1. runs syntax checks and unit tests;
2. keeps the GitHub Pages fallback deployment current;
3. checks whether Cloudflare credentials are configured;
4. creates the Cloudflare Pages project `brainrot-creator` automatically if it does not exist;
5. copies `GEMINI_API_KEY` into Cloudflare Pages' encrypted secret store;
6. deploys the static app, root `functions/`, and the Workers AI binding through Wrangler;
7. smoke-tests the live page, trends, Gemini story, narration, and visual binding.

If the Cloudflare credentials are not present, the deployment job reports a notice instead of breaking CI. If Gemini is unavailable, the application still has local story/device-voice fallbacks. If Workers AI image generation is unavailable, the application still renders story-matched cinematic scenes.

### Cloudflare token permission

The deployment token is scoped to the account used for Brainrot Creator with **Account → Cloudflare Pages → Edit** permission. Runtime Workers AI calls use the Pages AI binding, not a browser-visible Cloudflare API token.

## GitHub Pages fallback

GitHub Pages remains available as a static fallback. GitHub Pages does **not** execute Cloudflare Pages Functions, so that deployment uses the local story, device voice, and cinematic visual fallback.

## Development

No runtime npm packages are required.

```bash
npm run check
npm test
```

## Video rendering

The visible preview is a real `720x1280` Canvas render. Scene images, camera motion, captions, scene labels, and progress are composited into the canvas rather than overlaid with HTML. When Gemini TTS and browser recording APIs are available, the same canvas is captured at 30 fps and combined with the WebAudio narration stream.

Narration playback is normalized against the generated audio duration so the exported short targets exactly 60 seconds.

## Safety / parody behavior

Trend suggestions are conservatively filtered. Story prompting keeps real-person references fictional and non-defamatory, avoids tragedy jokes and slurs, and never imitates a real person's voice. Generated visual prompts prohibit text/logos/watermarks inside generated frames and preserve continuity rather than requesting real-person likeness replication.
