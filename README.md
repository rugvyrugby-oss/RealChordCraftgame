# ChordCraft

Describe a vibe, hear the chords. AI-generated 4-chord progressions with real
piano playback (Tone.js + Salamander samples), a piano-roll view, per-chord
mutation, variations, and MIDI / WAV export.

## How it works

- `src/App.tsx` — the whole app: generation flow, playback engine, piano roll,
  exports, share links, theming.
- `netlify/functions/generate.js` — the only server piece. It owns the
  Anthropic API key, the model choice, and every prompt template. The browser
  sends structured parameters (`kind`, prompt text, bpm, key, skeleton, chord
  names); the function validates them, builds the request, and rate-limits
  per IP so the endpoint can't be used as an open API relay.

The client picks the key and a vetted chord skeleton, the model fills in
qualities and voicings, and the response is validated against the skeleton
(with one corrective retry) before it's shown.

## Running it

```
npm install
npm start          # CRA dev server (UI only — no generation)
netlify dev        # UI + the generate function
```

Set `ANTHROPIC_API_KEY` in the Netlify site settings (or a local `.env` for
`netlify dev`). Without it, generation returns an error; playback of the
built-in example still works.

## Deploy

Pushes to `main` deploy via Netlify (`netlify.toml`: CRA build + functions).
