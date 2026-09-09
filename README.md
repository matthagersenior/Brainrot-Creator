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

Set one server-side Cloudflare Pages environment secret:

```text
GEMINI_API_KEY=your_google_ai_studio_key
```

With that secret configured, the app uses:

- `gemini-2.5-flash` for the 8-scene story
- `gemini-2.5-flash-preview-tts` for narration
- canvas + WebAudio + MediaRecorder to record a narrated `.webm` locally in the browser

The Gemini key is never sent to client JavaScript.

## Live trend rotation

`GET /api/trends` reads the public Google Trends Trending Now RSS feed for the United States. The endpoint removes obvious tragedy, violence, disaster, politics, self-harm, and other sensitive terms before suggestions reach the UI.

If Google Trends is unavailable, the app automatically returns to the built-in rotation.

## Cloudflare Pages deployment

1. Import this GitHub repository into Cloudflare Pages.
2. Use the repository root as the project root.
3. No framework preset or build command is required.
4. Add `GEMINI_API_KEY` under the Pages project environment variables/secrets if AI story + AI narration are desired.
5. Deploy.

The `functions/api` directory is automatically treated as Cloudflare Pages Functions.

## GitHub Pages fallback

The included GitHub Actions workflow can still deploy the static application to GitHub Pages. GitHub Pages does **not** execute Cloudflare Pages Functions, so that deployment automatically runs in the no-secret/local fallback mode.

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
