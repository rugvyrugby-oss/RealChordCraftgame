// Serverless proxy to the Anthropic API.
//
// SECURITY MODEL: the browser never chooses the model, system prompt, or
// token budget. It sends only structured musical parameters — a request
// "kind" plus prompt text, bpm, key, skeleton, chord names — and this
// function builds the full API request from its own templates. Anything
// malformed is rejected with a 400. Combined with per-IP rate limiting,
// this stops the endpoint from being usable as an open relay for the API
// key: a caller can only spend quota on fixed-shape, capped chord requests.
//
// The music tables below (pitch classes, key spelling, roman-numeral
// offsets) are duplicated from src/App.tsx, which still needs them to
// validate responses. If you change one side, change the other.

const MODEL = "claude-sonnet-4-5";

const MAX_TOKENS = { generate: 1000, variations: 2500, mutation: 800 };

// ── Rate limiting ───────────────────────────────────────────────────────────
// In-memory, per warm function container — best-effort, not bulletproof
// (each cold start begins fresh), but it turns "free API relay" into
// "12 chord progressions a minute", which is no longer worth abusing.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const rateHits = new Map();
const rateLimited = (ip) => {
  const now = Date.now();
  const hits = (rateHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  if (rateHits.size > 5000) rateHits.clear(); // bound memory; reset is harmless
  rateHits.set(ip, hits);
  return hits.length > RATE_MAX;
};

// ── Music tables (client twin: src/App.tsx) ─────────────────────────────────
const PITCH_CLASS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SHARP_KEYS = new Set(["G major", "D major", "A major", "E major", "E minor", "B minor", "F# minor", "C# minor"]);
const RN_OFFSETS = { I: 0, i: 0, bII: 1, ii: 2, bIII: 3, iii: 4, IV: 5, iv: 5, V: 7, v: 7, bVI: 8, vi: 9, bVII: 10 };

const skeletonRoots = (key, skeleton) => {
  const tonic = PITCH_CLASS[key.split(" ")[0]];
  const names = SHARP_KEYS.has(key) ? SHARP_NAMES : FLAT_NAMES;
  return skeleton.map((tok) => names[(tonic + RN_OFFSETS[tok]) % 12]);
};

const RN_QUALITY = {
  minor: {
    i: "m7 / m9 / m11",
    bII: "maj7, or a dominant 7 when used as the final tritone-sub return",
    bIII: "maj7 / maj9",
    iv: "m7 / m9 / m11",
    IV: "7 or 9 (dorian color)",
    v: "m7",
    V: "7 or 9 — NO altered tensions (no b9, #9, b13); keep the dominant clean",
    bVI: "maj7 / maj9",
    bVII: "7 / 9",
    ii: "m7b5 (half-diminished) or m7",
  },
  major: {
    I: "maj7 / maj9 / 6-9",
    ii: "m7 / m9",
    iii: "m7",
    IV: "maj7 / maj9",
    V: "7 / 9 / 13",
    vi: "m7 / m9",
    bVI: "maj7 (borrowed)",
    bVII: "7 / 9 (borrowed)",
    bII: "7 (tritone sub)",
  },
};

// ── Prompt templates ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional music producer and chord progression generator. Respond ONLY with a JSON object, no markdown, no extra text:
{"title":"night drive","key":"Eb major","bpm":80,"timeSignature":"4/4","style":"lofi","chords":[{"name":"Ebmaj9","duration":1,"notes":["Eb2","G4","Bb4","D5"],"function":"tonic","romanNumeral":"I"},{"name":"Cm11","duration":1,"notes":["C2","Eb4","G4","Bb4","F5"],"function":"submediant","romanNumeral":"vi"},{"name":"Abmaj7","duration":1,"notes":["Ab2","C4","Eb4","G4"],"function":"subdominant","romanNumeral":"IV"},{"name":"Bb13","duration":1,"notes":["Bb2","D4","Ab4","C5","G5"],"function":"dominant","romanNumeral":"V"}],"vibe":"chill late night","genre":"lo-fi hip hop","theory":"Ebmaj9 is home, Cm11 keeps it floating, Bb13 pulls back to the top."}
CRITICAL RULES FOR PROFESSIONAL SOUND:
- "style" must be ONE of: lofi, soul, cinematic, house, jazz, rnb, ambient, trap, Middle eastern, pop. Pick the closest match to the user's request.
- Use RICH voicings, never plain triads. Add 7ths, 9ths, 11ths, 13ths. Spread notes across octaves (root low in C2-C3, color tones up in C4-C5). Example: instead of C-E-G use C3-E4-G4-B4.
- Put the root or 5th low (C2-G2 range) for warmth, stack color tones higher.
- VOICE LEADING IS CRITICAL: each chord's upper notes (the color tones above the bass) must connect smoothly to the next chord's upper notes. Keep common tones in the SAME octave/position between adjacent chords, and move other voices by the smallest possible step. The top notes across all 4 chords should form a smooth melodic line, not jump around. Before finalizing, check: does the top voice move mostly by step or common tone? If it leaps around, revoice it.
- The exact target BPM is dictated by the user for every request via the "Tempo target" block in the user message. Set "bpm" to that exact number, and use the accompanying tempo guidance to shape voicing density, chord duration, style choice, and top-voice motion. Do NOT invent a BPM from the style — style follows tempo here, not the other way round.
- Always 4 chords. Make them genuinely interesting, the kind a real producer would use, not a beginner. NEVER use I-vi-IV-V or I-V-vi-IV — these are overused and boring. Use unexpected chord relationships, modal interchange, secondary dominants, or borrowed chords.
- For ALL text fields (title, vibe, theory, description, anything textual): write SHORT and PLAIN. Max 2 sentences. Use real producer talk. NEVER use these words: dreamy, shimmer, warmth, characteristic, evocative, establishes, voice leading, chromatic, lush, nostalgic, atmospheric, ethereal, soulful, captivating, melancholic. Say what the chords do simply, like "Cm9 is home, Fm11 drops down a fifth, G7 builds back up." Casual lowercase fine.
- Titles must be 1-3 words, lowercase, no poetic stuff. Examples: "midnight drive", "rainy monday", "late jam". NOT "Whispers of the Heart" or "Ethereal Journey".
- Vibe field: 3-5 words max, plain. Example: "dark moody jazz" NOT "melancholic and introspective with jazzy tension".
- SOUND QUALITY: every voicing must sound full and intentional, like a real producer played it. STRICT VOICING RULES: (1) Root note ONLY in C2-G2 range — this is your bass note, nothing else goes this low. (2) Leave a gap — no notes in C3-B3 range. (3) Stack the color tones (3rd, 7th, 9th, 11th) in C4-C5 range only. (4) Max 5 notes per chord. (5) ONLY use notes that actually belong to the chord — no wrong notes ever. Example Am9: A2 [gap] C4 E4 G4 B4. Example Dm9: D2 [gap] F4 A4 C5 E5. Example G13: G2 [gap] F4 A4 B4 E5. If you can't fit the voicing cleanly, simplify the chord — a clean Am7 beats a muddy Am11.
- STRUCTURE IS PROVIDED, NOT INVENTED: every user message contains a REQUIRED SKELETON block naming the key, the four roman numerals, and the exact bass root of each chord. Follow it exactly — the "romanNumeral" field must match the skeleton token (you may append the quality: V7, bVImaj7, iim7b5, etc.) and each chord's lowest note must be the given root. Structure is fixed; your creativity goes into chord qualities, extensions, voicings, register, and the text fields. If any other rule in this prompt seems to conflict with the skeleton, THE SKELETON WINS.
- WHAT EACH SLOT MEANS (use this to shape voicing energy, not to change the chords):
  Chord 1 = HOME: settled, roomy voicing. function "tonic".
  Chord 2 = MOVE: leaves home, slightly brighter or darker. function per its numeral.
  Chord 3 = BUILD: tension chord, tighter voicing. function "subdominant" or "dominant".
  Chord 4 = RETURN: pulls back to chord 1 across the loop. function "dominant" (or "subdominant" for modal returns like bVII/bVI).
- VOICE LEADING ON THE LOOP: the smooth-top-voice rule applies between chord 4 and chord 1 as well. Chord 4's top notes must connect to chord 1's top notes by common tone or step, same as any other adjacent pair. This is the difference between a progression that loops forever and one that jars every 4 bars.
- Every generation should feel like a completely different songwriter wrote it: vary the qualities (m9 vs m11 vs m7), the register of the color tones, which voice is on top, and the rhythm feel — the same skeleton can sound like a hundred different songs.
- Musicality is more important than complexity.
- BPM is fixed by the user request; the key is fixed by the REQUIRED SKELETON block. Do not vary either.
- For lofi specifically: try minor keys (Cm, Dm, Bm, F#m), not just major. Minor lofi hits harder emotionally.
- A "chill lofi" prompt should NOT produce I-IV-V in any key. Use ii-V, bVII, bVI, or modal approaches instead.
- NOTE SPELLING: spell every note and chord root according to the key signature — flats in flat keys (Ab9 with Ab-C-Eb-Gb-Bb in C minor), sharps in sharp keys. NEVER use B#, E#, Cb, Fb, or double accidentals. List each chord's notes from lowest to highest.
- NEVER use altered tensions (#11, b9, #9, b13, #5) unless the user explicitly asks for jazz. They sound like wrong notes to most listeners. Extensions stop at 7, 9, 11, 13 in their plain form.
- A simple B9 is often better than a forced Bmaj7#11.
- "rainy tokyo" / "tokyo night" / "city rain" / "neon streets" => MELANCHOLIC + DREAMY. Minor key with major 7th color, BPM 70-85, lofi or ambient style. Use minor 9ths, major 7ths, sus chords. Spacious, wet, reflective. Think city lights through rain. `;

// Tempo bands: concrete, musically-actionable instructions per BPM range,
// picked from where real records actually sit.
const bpmDirective = (bpm) => {
  if (bpm < 65) {
    return {
      band: "very slow / rubato-cinematic",
      styles: "cinematic, ambient",
      duration: "hold each chord for 2 bars (set duration: 2 on every chord)",
      voicing: "wide orchestral spread. Root C2-G2, big hollow gap, cluster of color tones in C4-C6. Use maj7, add9, 11, sus2, m(add9). 4-5 notes.",
      motion: "top voice is nearly static or moves by step. No leaps.",
      approach: "prefer PEDAL TONE, MODAL, or DESCENDING BASS. Skip CYCLE OF 4THS — too many key centers for this pace.",
    };
  }
  if (bpm < 78) {
    return {
      band: "slow (lofi ballad / slow soul / cinematic)",
      styles: "lofi, cinematic, soul, ambient",
      duration: "one chord per bar (duration: 1). Every chord breathes.",
      voicing: "rich extended jazz voicings — m9, m11, maj7#5, 13. Root low (C2-G2), gap, upper cluster C4-C5. 4-5 notes.",
      motion: "smooth stepwise top-voice line with held common tones.",
      approach: "DESCENDING BASS, MODAL, or BORROWED CHORD. Skip CHROMATIC APPROACH — too busy at this pace.",
    };
  }
  if (bpm < 95) {
    return {
      band: "chill-mid (lofi hip hop / soul / R&B / slow pop)",
      styles: "lofi, soul, rnb, jazz",
      duration: "one chord per bar (duration: 1).",
      voicing: "colored 7ths and 9ths, occasional 11th. Root low, gap, cluster in C4-C5. 4-5 notes.",
      motion: "clear singable top-voice melody, tight voice leading.",
      approach: "any of the 8 approaches fits — pick one you didn't just use.",
    };
  }
  if (bpm < 115) {
    return {
      band: "mid-groove (pop / neo-soul / boom-bap)",
      styles: "pop, soul, rnb",
      duration: "one chord per bar (duration: 1).",
      voicing: "mostly 7ths and select 9ths. Drop the 11ths and 13ths — they get busy at this tempo. 4 notes is usually enough. Root low, gap, upper triad C4-C5.",
      motion: "top voice can carry a real 2-3 note hook across the four chords.",
      approach: "SECONDARY DOMINANT, DECEPTIVE RESOLUTION, or CYCLE OF 4THS give this tempo its lift.",
    };
  }
  if (bpm < 135) {
    return {
      band: "upbeat (house / disco / dance-pop)",
      styles: "house, pop",
      duration: "mix rhythms: give 2 of the 4 chords duration 0.5 to create a stab-and-hold feel; leave the other 2 at duration 1.",
      voicing: "clean and forward. Root in G2-G3 (deeper turns to mud on club systems), gap, tight upper cluster in C4-C5. 3-4 notes max. m7, maj7, 7sus4, add9 only — NO 11ths, NO 13ths, NO altered tensions.",
      motion: "repeat one top note across chords as a driving anchor (classic house move).",
      approach: "MODAL (Dorian, Mixolydian, Lydian) or PEDAL TONE. Skip DESCENDING BASS — it drags the bounce.",
    };
  }
  if (bpm < 160) {
    return {
      band: "fast (trap / uptempo hip hop / techno)",
      styles: "trap, house",
      duration: "vary between duration 0.5 and 1 across the 4 chords for rhythmic bite.",
      voicing: "sparse and hard-hitting. Root and 5th in G2-G3 (leave the sub range for the 808), gap, m3 + optional b7 up top. 2-3 notes per chord. Minor triads, m7, or bare power tones. NO 9ths, NO 11ths — they blur past this tempo.",
      motion: "top voice is a rhythmic anchor, not a melody. Repeat notes across chords for tension.",
      approach: "MODAL (Phrygian or natural minor), PEDAL TONE, or CHROMATIC APPROACH. Half-step drops love this tempo.",
    };
  }
  return {
    band: "very fast (dnb / hardcore / uptempo techno)",
    styles: "trap, house, ambient (as a long pad only)",
    duration: "hold each chord for 2 bars (duration: 2) — supplying atmosphere over a fast drum feel, not stabbing.",
    voicing: "one dark minor triad plus optional b7. Root in G2-G3, gap, m3 + 5 + optional b7 in C4-C5. 3 notes max. Dark and spacious.",
    motion: "static or gradual — this is a texture, not a melody.",
    approach: "PEDAL TONE or MODAL (Phrygian, Aeolian). No secondary dominants, no cycle of 4ths.",
  };
};

const bpmBlock = (bpm) => {
  const g = bpmDirective(bpm);
  return `

Tempo target: ${bpm} BPM — ${g.band}.
- Set "bpm": ${bpm} exactly. Do not shift it.
- Style must be one of: ${g.styles}. Pick whichever best fits the user's vibe.
- Chord duration: ${g.duration}
- Voicing rules for this tempo: ${g.voicing}
- Top-voice motion: ${g.motion}
- Texture flavor for this tempo (the REQUIRED SKELETON controls the actual chords): ${g.approach}
If the user's text vibe seems to clash with the tempo (e.g. "chill lofi" at 140 BPM, or "hard trap" at 60 BPM), the tempo wins — reinterpret the vibe through this tempo's lens rather than defaulting to the vibe's usual BPM.`;
};

// ── Input validation ────────────────────────────────────────────────────────
class BadRequest extends Error {}

const cleanStr = (v, max, name, { required = false } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new BadRequest(`Missing "${name}"`);
    return "";
  }
  if (typeof v !== "string") throw new BadRequest(`"${name}" must be a string`);
  // Strip control chars (keep newlines/tabs), cap length.
  return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, max);
};

const cleanBpm = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 40 || n > 200)
    throw new BadRequest('"bpm" must be a number between 40 and 200');
  return n;
};

const cleanKey = (v) => {
  const m = /^([A-G][b#]?) (major|minor)$/.exec(typeof v === "string" ? v : "");
  if (!m || PITCH_CLASS[m[1]] === undefined)
    throw new BadRequest('"key" must look like "Eb major" or "F# minor"');
  return { key: m[0], tonality: m[2] };
};

const cleanSkeleton = (v, name) => {
  if (!Array.isArray(v) || v.length !== 4 || v.some((t) => RN_OFFSETS[t] === undefined))
    throw new BadRequest(`"${name}" must be 4 roman numerals like ["i","bVI","iv","V"]`);
  return v;
};

const cleanChordNames = (v, name, { min = 0, max = 24 } = {}) => {
  if (!Array.isArray(v)) {
    if (min === 0 && (v === undefined || v === null)) return [];
    throw new BadRequest(`"${name}" must be an array`);
  }
  if (v.length < min || v.length > max)
    throw new BadRequest(`"${name}" must have ${min}-${max} entries`);
  return v.map((c, i) => cleanStr(c, 32, `${name}[${i}]`, { required: true }));
};

// ── Request builders (one per kind) ─────────────────────────────────────────
const buildGenerate = (body) => {
  const prompt = cleanStr(body.prompt, 600, "prompt", { required: true });
  const bpm = cleanBpm(body.bpm);
  const { key, tonality } = cleanKey(body.key);
  const skeleton = cleanSkeleton(body.skeleton, "skeleton");
  const feedback = cleanStr(body.feedback, 800, "feedback");
  const roots = skeletonRoots(key, skeleton);
  const slotLines = skeleton
    .map(
      (tok, i) =>
        `  Chord ${i + 1}: romanNumeral "${tok}" — root MUST be ${roots[i]} (lowest note ${roots[i]}2). Typical quality: ${RN_QUALITY[tonality][tok] || "your choice"}.`
    )
    .join("\n");
  const feedbackBlock = feedback
    ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED for these violations: ${feedback}. Regenerate and follow the skeleton EXACTLY this time.`
    : "";
  const message = `${prompt}${bpmBlock(bpm)}

REQUIRED SKELETON (non-negotiable — structure is fixed, do not substitute):
- key MUST be exactly "${key}". Set the "key" field to this string.
- The progression is ${skeleton.join(" → ")} in ${key}, so the four bass roots are ${roots.join(", ")} in that exact order.
${slotLines}
- You choose the chord qualities/extensions (guided by the tempo block above) and the voicings. You do NOT choose the roots or their order.
- This skeleton overrides any structural suggestion elsewhere, including the tempo block's texture flavor.${feedbackBlock}

Random variation seed: ${Date.now()}`;
  return { system: SYSTEM_PROMPT, message };
};

const buildVariations = (body) => {
  const prompt = cleanStr(body.prompt, 600, "prompt", { required: true });
  const bpm = cleanBpm(body.bpm);
  const { key } = cleanKey(body.key);
  const currentChords = cleanStr(body.currentChords, 240, "currentChords");
  const rejected = cleanChordNames(body.rejected, "rejected");
  if (!Array.isArray(body.skeletons) || body.skeletons.length < 1 || body.skeletons.length > 4)
    throw new BadRequest('"skeletons" must be 1-4 skeletons');
  const skeletons = body.skeletons.map((s) => cleanSkeleton(s, "skeletons[]"));
  const roots = skeletons.map((s) => skeletonRoots(key, s));
  const skeletonLines = skeletons
    .map(
      (s, i) =>
        `   Variation ${i + 1}: ${s.join(" → ")} — bass roots MUST be ${roots[i].join(", ")} in that order.`
    )
    .join("\n");
  const rejectedNote = rejected.length
    ? `Avoid these chord names entirely: ${rejected.join(", ")}.`
    : "";
  const system = `You generate 4 ALTERNATIVE chord progressions for the same vibe. Return ONLY a JSON ARRAY of 4 objects, each in the same shape as before:
[{"title":"...","key":"...","bpm":...,"timeSignature":"4/4","style":"...","chords":[{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."},...4 chords each...],"vibe":"...","genre":"...","theory":"..."}, ... ×4]

HARD REQUIREMENTS (a variation that breaks any of these is unusable — do not return it):

1. KEY LOCK. Every variation stays in ${key}. Same tonal center, same "key" field value. Do NOT drift into a new key.

2. REQUIRED SKELETONS — each variation uses its assigned structure exactly (romanNumeral fields must match these tokens; you may append qualities like 7/9/maj7):
${skeletonLines}
   You choose the chord qualities, extensions, and voicings. You do NOT choose the roots or their order.

3. VOICE LEADING inside AND across the loop. Adjacent chords' upper voices must connect by common tone or single step. Chord 4's upper voices must connect back to chord 1's upper voices the same way. Top voice across all 4 chords should be a smooth line, not leaps.

4. TEXTURE VARIETY — beyond the different skeletons, make the four variations differ in feel: different extensions (m9 vs m11 vs plain m7), different top notes, different registers for the color tones.

5. TEMPO. All variations honour the tempo target block below — same voicing density, chord duration, and style rules for the current BPM.

The user's current progression (do NOT reproduce it — these are alternatives): ${currentChords}. ${rejectedNote}`;
  return { system, message: `${prompt}${bpmBlock(bpm)}` };
};

const buildMutation = (body) => {
  const bpm = cleanBpm(body.bpm);
  const { key } = cleanKey(body.key);
  const chordNames = cleanChordNames(body.chordNames, "chordNames", { min: 2, max: 8 });
  const slotIdx = Math.round(Number(body.slotIdx));
  if (!Number.isFinite(slotIdx) || slotIdx < 0 || slotIdx >= chordNames.length)
    throw new BadRequest('"slotIdx" out of range');
  const rejected = cleanChordNames(body.rejected, "rejected");
  const original = chordNames[slotIdx];
  const first = chordNames[0];
  const context = chordNames.map((c, i) => (i === slotIdx ? "[?]" : c)).join(" - ");
  const rejectedNote = rejected.length ? `Avoid: ${rejected.join(", ")}.` : "";
  const mutGuide = bpmDirective(bpm);
  const slotRole =
    slotIdx === 0
      ? 'HOME (tonic-family: I/Imaj7/Imaj9 in major, i/im7/im9 in minor). function="tonic". Do NOT return a ii, iii, IV, V, or vii° — that would break the progression\'s opening.'
      : slotIdx === chordNames.length - 1
      ? `RETURN — chord 1 of the loop is ${first}, so your replacement must lead cleanly back into it: either V/V7 resolving down a 5th, a plagal/modal chord (IV, iv, bVII, bVI) landing on it by step or common tone, or a chord sharing ≥ 2 pitch classes with it. Its function should be "dominant" or "subdominant". Never a hanging ii or iii.`
      : slotIdx === 1
      ? "MOVE (leaves home but stays in key: IV, ii, iii, vi, bVII, bVI). Do not duplicate chord 1's root."
      : "BUILD (pre-dominant or dominant tension pulling into chord 4: ii, IV, iv, V7/x, bVII).";
  const system = `You generate 3 ALTERNATIVE single chords for one slot in a progression. Return ONLY a JSON ARRAY of 3 chord objects: [{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."}, ×3]
Key: ${key} (stay in this key — no modulations). Tempo: ${bpm} BPM (${mutGuide.band}). Surrounding chords: ${context} — the [?] slot is what you're replacing. Original chord there was ${original}.
SLOT ROLE (mandatory): this slot's job in the progression is ${slotRole}
VOICE LEADING: the replacement must connect to its neighbors by common tone or single step in the upper voices — no leaps. Check both ${slotIdx > 0 ? `chord ${slotIdx} → your chord` : "wraparound: chord 4 → your chord (loop point)"} and ${slotIdx < chordNames.length - 1 ? `your chord → chord ${slotIdx + 2}` : `your chord → chord 1 (loop point: ${first})`}.
Give 3 genuinely different musical choices — try modal interchange, secondary dominants, tritone subs, chromatic neighbors, but each must still satisfy the slot role and voice leading above. Voicing for this tempo: ${mutGuide.voicing} Duration: ${mutGuide.duration.includes("2 bars") ? "2" : mutGuide.duration.includes("0.5") ? "match surrounding chords" : "1"}. ${rejectedNote}`;
  return { system, message: "Replace the [?] chord." };
};

const BUILDERS = {
  generate: buildGenerate,
  variations: buildVariations,
  mutation: buildMutation,
};

// ── Handler ─────────────────────────────────────────────────────────────────
const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  // Same-origin app — no CORS headers on purpose, so other sites can't
  // spend this key from their visitors' browsers.
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, {
      error: "The server is missing its ANTHROPIC_API_KEY — set it in the Netlify site settings.",
    });
  }

  if ((event.body || "").length > 20_000) return json(413, { error: "Request too large" });

  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    "unknown";
  if (rateLimited(ip)) {
    return json(429, { error: "Slow down a little — try again in a minute." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const build = BUILDERS[body && body.kind];
  if (!build) return json(400, { error: 'Unknown request "kind"' });

  let req;
  try {
    req = build(body);
  } catch (e) {
    if (e instanceof BadRequest) return json(400, { error: e.message });
    throw e;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS[body.kind],
        temperature: 1,
        system: req.system,
        messages: [{ role: "user", content: req.message }],
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      // Surface a real error — never a fake progression dressed up as success.
      console.log("Anthropic error:", res.status, text.substring(0, 300));
      return json(502, {
        error: "The music engine is unavailable right now — try again in a moment.",
      });
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text,
    };
  } catch (e) {
    console.log("Upstream call failed:", e.message);
    return json(502, {
      error: "Couldn't reach the music engine — try again in a moment.",
    });
  }
};
