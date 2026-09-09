# Brainrot Creator — ROT MACHINE

A free-first web app that turns a prompt of **9 words or fewer** into a vertical **60-second Brainrot short** with a generated story, narration, subtitles, and chaotic animated visuals.

## What works with no API key

- 9-word prompt limit
- Quick Rot random prompt generation
- rotating built-in trend-style prompt pack
- 8-scene local story fallback
- exact 60-second canvas playback
- large animated subtitles
- device `speechSynthesis` narration when the browser supports it
- responsive mobile-first UI

The app does not become unusable when an AI provider is missing or a quota is exhausted.

## Free-tier upgrades with Gemini

When `GEMINI_API_KEY` is configured, the app uses:

- `gemini-2.5-flash` for the 8-scene story
- `gemini-2.5-flash-preview-tts` for narration
- canvas + WebAudio + MediaRecorder to record a narrated `.webm` locally in the browser

The Gemini key is never sent to client JavaScript.

## Live trend rotation

`GET /api/trends` reads the public Google Trends Trending Now RSS feed for the United States. The endpoint removes obvious tragedy, violence, disaster, politics, self-harm, and other sensitive terms before suggestions reach the UI.

If Google Trends is unavailable, the app automatically returns to the built-in rotation.

## Automated Cloudflare deployment

The GitHub Actions workflow handles the Cloudflare setup after three repository secrets exist:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GEMINI_API_KEY`

On a push to `main`, the workflow:

1. runs syntax checks and unit tests;
2. keeps the GitHub Pages fallback deployment current;
3. checks whether Cloudflare credentials are configured;
4. creates the Cloudflare Pages project `brainrot-creator` automatically if it does not exist;
5. copies `GEMINI_API_KEY` into Cloudflare Pages' encrypted secret store;
6. deploys the static app and the root `functions/` directory through Wrangler.

If the Cloudflare credentials are not present yet, that deployment job reports a notice and exits successfully instead of breaking CI. If only the Gemini key is missing, Cloudflare still deploys and the application uses its local/device-voice fallback.

### Cloudflare token permission

The Cloudflare API token should be scoped to the account used for Brainrot Creator with **Account → Cloudflare Pages → Edit** permission.

## GitHub Pages fallback

GitHub Pages remains available as a static fallback. GitHub Pages does **not** execute Cloudflare Pages Functions, so that deployment automatically runs in the no-secret/local fallback mode.

## Development

No runtime npm packages are required.

```bash
npm run check
npm test
```

## Video rendering

The visible preview is a real `720x1280` Canvas render. Captions, progress, scene effects, particles, text bursts, and the main visual subject are drawn into the canvas rather than overlaid with HTML. When Gemini TTS and the browser recording APIs are available, the same canvas is captured at 30 fps and combined with the WebAudio narration stream.

Narration playback is normalized against the generated audio duration so the exported short targets exactly 60 seconds.

## Safety / parody behavior

Trend suggestions are conservatively filtered. Story prompting tells Gemini to keep real-person references fictional and non-defamatory, avoid tragedy jokes and slurs, and never imitate a real person's voice. Narration uses a generic Gemini voice rather than voice cloning.
