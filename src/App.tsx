// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Terms from "./Terms";
// ============================================================================
// — React version
//
// External libraries — add these to your index.html <head>:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js" crossorigin="anonymous"></script>
//   <script src="https://cdn.jsdelivr.net/npm/midi-writer-js@3.1.1/build/index.browser.min.js" crossorigin="anonymous"></script>
// Then `window.Tone` and `window.MidiWriter` are available.
// (Or npm install tone midi-writer-js and import them directly.)
// ============================================================================

const FREE_DAILY_LIMIT = 5;
const PRO_DAILY_LIMIT = 120;

// ════════════════════════════════════════════════════════════════════════════
// PRICING PLANS
// To wire up real Stripe checkout: replace the `checkoutUrl` values below with
// the payment links you get from stripe.com → Products → "Get payment link"
// ════════════════════════════════════════════════════════════════════════════
const PRICING_PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: 10,
    period: "/mo",
    cta: "Start Monthly",
    note: null,
    checkoutUrl: null, // e.g. "https://buy.stripe.com/your-monthly-link"
  },
  {
    id: "annual",
    label: "Annual",
    price: 79,
    period: "/yr",
    cta: "Start Annual",
    note: "Save 45% and 2 months free",
    highlighted: true, // shows the "Best value" badge
    checkoutUrl: null, // e.g. "https://buy.stripe.com/your-annual-link"
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: 100,
    period: "once",
    cta: "Get Lifetime",
    note: "Pay once. Yours forever.",
    badge: "Limited",
    checkoutUrl: null, // e.g. "https://buy.stripe.com/your-lifetime-link"
  },
];

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
const GROOVE_PATTERNS = {
  lofi: {
    swing: 0.12,
    humanize: 0.023,
    hits: [
      { t: 0.0, notes: "low", vel: 0.62, len: 1.0 },
      { t: 0.5, notes: "roll", vel: 0.5, len: 0.55 },
      { t: 0.75, notes: "high", vel: 0.4, len: 0.4 },
    ],
  },
  soul: {
    swing: 0.08,
    humanize: 0.020,
    hits: [
      { t: 0.0, notes: "roll", vel: 0.68, len: 0.5 },
      { t: 0.375, notes: "high", vel: 0.45, len: 0.3 },
      { t: 0.5, notes: "low", vel: 0.58, len: 0.5 },
      { t: 0.75, notes: "high", vel: 0.5, len: 0.35 },
    ],
  },
  rnb: {
    swing: 0.1,
    humanize: 0.020,
    hits: [
      { t: 0.0, notes: "roll", vel: 0.66, len: 0.7 },
      { t: 0.5, notes: "high", vel: 0.44, len: 0.4 },
      { t: 0.875, notes: "low", vel: 0.5, len: 0.3 },
    ],
  },
  jazz: {
    swing: 0.16,
    humanize: 0.026,
    hits: [
      { t: 0.0, notes: "roll", vel: 0.6, len: 0.6 },
      { t: 0.66, notes: "high", vel: 0.42, len: 0.45 },
    ],
  },
  cinematic: {
    swing: 0,
    humanize: 0.01,
    hits: [{ t: 0.0, notes: "roll", vel: 0.55, len: 1.6 }],
  },
  ambient: {
    swing: 0,
    humanize: 0.008,
    hits: [{ t: 0.0, notes: "roll", vel: 0.45, len: 2.0 }],
  },
  house: {
    swing: 0,
    humanize: 0.006,
    hits: [
      { t: 0.0, notes: "all", vel: 0.6, len: 0.22 },
      { t: 0.25, notes: "all", vel: 0.5, len: 0.22 },
      { t: 0.5, notes: "all", vel: 0.6, len: 0.22 },
      { t: 0.75, notes: "all", vel: 0.5, len: 0.22 },
    ],
  },
  trap: {
    swing: 0,
    humanize: 0.012,
    hits: [
      { t: 0.0, notes: "low", vel: 0.7, len: 0.5 },
      { t: 0.5, notes: "roll", vel: 0.55, len: 0.4 },
      { t: 0.75, notes: "high", vel: 0.45, len: 0.25 },
    ],
  },
  pop: {
    swing: 0.04,
    humanize: 0.014,
    hits: [
      { t: 0.0, notes: "roll", vel: 0.66, len: 0.9 },
      { t: 0.5, notes: "all", vel: 0.5, len: 0.5 },
    ],
  },
};
const DEFAULT_GROOVE = GROOVE_PATTERNS.pop;

// Every chord is struck ONCE, in full, at the top of its slot and sustained
// for its whole duration. The style grooves above split chords into
// low/roll/high partial hits (lofi's downbeat played only the bass note,
// with the full chord not arriving until halfway through the bar) — users
// heard that as "the chords never play fully". The humanized micro-spread
// in performChord supplies the played-by-a-hand feel; the ARPEGGIATE slider
// supplies note spreading when wanted. Style still shapes swing/humanize.
const blockGroove = (style) => {
  const base = GROOVE_PATTERNS[style] || DEFAULT_GROOVE;
  return {
    swing: base.swing,
    humanize: base.humanize,
    hits: [{ t: 0.0, notes: "all", vel: 0.66, len: 0.95 }],
  };
};

// Translate the user's BPM slider into concrete, musically-actionable
// instructions the model can act on. This is what makes changing the tempo
// produce genuinely different progressions rather than the same voicings
// played faster: at slow tempos the ear has time for 11ths and 13ths, at fast
// tempos those same tones turn muddy and clash with the drum feel, so the
// harmony has to thin out. Bands are picked from where real records actually
// sit — not arbitrary cutoffs.
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

// Pools the client picks from to force real variety, since the model on its
// own will settle into a single "safe" answer for a given prompt (e.g. "lofi
// chords" → F#m always). We pick a key and an approach here and hand them to
// the model as non-negotiable, excluding whatever was used in the last 2-3
// generations from the history so consecutive results can't repeat.
const KEY_POOL_MAJOR = [
  "C major", "G major", "D major", "A major", "E major",
  "F major", "Bb major", "Eb major", "Ab major", "Db major",
];
const KEY_POOL_MINOR = [
  "A minor", "E minor", "D minor", "G minor", "C minor",
  "B minor", "F# minor", "C# minor", "Bb minor", "F minor",
];
// Curated 4-chord skeletons. Every one already satisfies the arc
// (home → move → build → return), has four distinct roots, and loops
// cleanly back to chord 1. The client picks one and the model only fills
// in qualities/extensions/voicings — it no longer designs the structure,
// because letting it do that produced contradictory results (secondary
// dominants at slot 3 dragging weak chords into slot 4, bVII placed
// before iv, duplicate roots, etc).
const PROGRESSION_SKELETONS = {
  minor: [
    ["i", "bVI", "iv", "V"],
    ["i", "bVII", "bVI", "V"],
    ["i", "iv", "bVI", "bVII"],
    ["i", "bIII", "iv", "V"],
    ["i", "iv", "ii", "V"],
    ["i", "v", "bVI", "bVII"],
    ["i", "IV", "bIII", "bVII"],
    ["i", "bVI", "bIII", "bVII"],
  ],
  major: [
    ["I", "IV", "ii", "V"],
    ["I", "vi", "ii", "V"],
    ["I", "bVII", "IV", "V"],
    ["I", "iii", "IV", "V"],
    ["I", "ii", "IV", "V"],
    ["I", "IV", "vi", "V"],
    ["I", "bVI", "bVII", "V"],
    ["I", "iii", "ii", "V"],
  ],
};

// Typical chord qualities per roman numeral, passed to the model as
// guidance (it may choose among them, tempo rules permitting).
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

// Music math for computing the required bass root of each skeleton slot,
// so we can hand the model concrete note names and verify its response.
const PITCH_CLASS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SHARP_KEYS = new Set(["G major", "D major", "A major", "E major", "E minor", "B minor", "F# minor", "C# minor"]);
// Semitone offsets from the tonic for each roman numeral used in the skeletons.
const RN_OFFSETS = { I: 0, i: 0, bII: 1, ii: 2, bIII: 3, iii: 4, IV: 5, iv: 5, V: 7, v: 7, bVI: 8, vi: 9, bVII: 10 };

const skeletonRoots = (key, skeleton) => {
  const tonic = PITCH_CLASS[key.split(" ")[0]];
  const names = SHARP_KEYS.has(key) ? SHARP_NAMES : FLAT_NAMES;
  return skeleton.map((tok) => names[(tonic + RN_OFFSETS[tok]) % 12]);
};

// Check the model's response against the skeleton: 4 chords, each with a
// bass note whose pitch class matches the required root. Returns a list
// of human-readable problems (empty = valid).
const validateProgression = (p, skeleton, expectedRoots) => {
  const problems = [];
  if (!p || !Array.isArray(p.chords) || p.chords.length !== 4) {
    problems.push("response must contain exactly 4 chords");
    return problems;
  }
  p.chords.forEach((c, i) => {
    const m = /^([A-G][b#]?)/.exec((c.notes && c.notes[0]) || "");
    const got = m ? PITCH_CLASS[m[1]] : -1;
    if (got !== PITCH_CLASS[expectedRoots[i]]) {
      problems.push(
        `chord ${i + 1} must be built on root ${expectedRoots[i]} (skeleton slot ${skeleton[i]}), but its bass note is ${m ? m[1] : "missing"}`
      );
    }
  });
  return problems;
};

// ── Note-spelling normalization ─────────────────────────────────────────────
// The model sometimes returns enharmonically "correct" but musically wrong
// spellings — G#9 with B# in C minor instead of Ab9 with C. Rather than trust
// prompt rules, we respell every returned note and chord root into the key's
// preferred accidentals (flats in flat keys, sharps in sharp keys), collapse
// phantom names like B#4 → C5, and sort each chord's notes low-to-high (the
// playback engine treats the first note as the bass and the last as the
// melody voice).
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC_OFFSET = { "#": 1, "##": 2, b: -1, bb: -2 };
const parseNoteMidi = (n) => {
  const m = /^([A-G])(bb|##|b|#)?(-?\d)$/.exec((n || "").trim());
  if (!m) return null;
  const acc = m[2] ? ACC_OFFSET[m[2]] : 0;
  return LETTER_PC[m[1]] + acc + (parseInt(m[3], 10) + 1) * 12;
};
const midiToName = (midi, useFlats) =>
  (useFlats ? FLAT_NAMES : SHARP_NAMES)[((midi % 12) + 12) % 12] +
  (Math.floor(midi / 12) - 1);
const keyUsesFlats = (key) => !SHARP_KEYS.has(key || "");

const normalizeChordSpelling = (c, useFlats) => {
  if (!c) return c;
  if (Array.isArray(c.notes)) {
    const midis = c.notes
      .map(parseNoteMidi)
      .filter((m) => m !== null)
      .sort((a, b) => a - b);
    if (midis.length) c.notes = midis.map((m) => midiToName(m, useFlats));
  }
  if (typeof c.name === "string") {
    const nm = /^([A-G])(bb|##|b|#)?(.*)$/.exec(c.name.trim());
    if (nm) {
      const acc = nm[2] ? ACC_OFFSET[nm[2]] : 0;
      const pc = (((LETTER_PC[nm[1]] + acc) % 12) + 12) % 12;
      c.name = (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc] + (nm[3] || "");
    }
  }
  return c;
};

const normalizeProgression = (p) => {
  if (!p || !Array.isArray(p.chords)) return p;
  const useFlats = keyUsesFlats(p.key);
  p.chords.forEach((c) => normalizeChordSpelling(c, useFlats));
  return p;
};

// Prompts that suggest minor tonality vs major. Cheap keyword lookahead — if
// the user's prompt says "dark", "sad", "melancholy" etc, we bias key selection
// toward minor pool; "happy", "bright", "uplifting" toward major. Anything
// else = 50/50.
const MINOR_HINT_RE = /\b(sad|dark|melancholy|melancholic|moody|somber|dramatic|cinematic|lofi|trap|rainy|night|midnight|noir|broken)\b/i;
const MAJOR_HINT_RE = /\b(happy|bright|uplifting|joyful|sunny|summer|pop|beach|celebrate|hopeful)\b/i;

// Remember the last few skeletons in localStorage so variety survives page
// reloads — an in-memory variable resets every refresh, which let the same
// structure come up twice in a row.
const SKELETON_MEMORY_KEY = "chordcraft_recent_skeletons";
const getRecentSkeletons = () => {
  try {
    return JSON.parse(localStorage.getItem(SKELETON_MEMORY_KEY) || "[]");
  } catch {
    return [];
  }
};
const rememberSkeleton = (id) => {
  try {
    const recent = [id, ...getRecentSkeletons().filter((s) => s !== id)].slice(0, 3);
    localStorage.setItem(SKELETON_MEMORY_KEY, JSON.stringify(recent));
  } catch {}
};

const pickForcedContext = (userPrompt, recentKeys) => {
  const wantMinor = MINOR_HINT_RE.test(userPrompt);
  const wantMajor = MAJOR_HINT_RE.test(userPrompt);
  const pool = wantMinor && !wantMajor
    ? KEY_POOL_MINOR
    : wantMajor && !wantMinor
    ? KEY_POOL_MAJOR
    : Math.random() < 0.5 ? KEY_POOL_MAJOR : KEY_POOL_MINOR;
  const avail = pool.filter((k) => !recentKeys.includes(k));
  const keyList = avail.length ? avail : pool;
  const key = keyList[Math.floor(Math.random() * keyList.length)];
  const tonality = pool === KEY_POOL_MINOR ? "minor" : "major";
  const skels = PROGRESSION_SKELETONS[tonality];
  const recentSkels = getRecentSkeletons();
  const freshSkels = skels.filter((s) => !recentSkels.includes(s.join("-")));
  const pickFrom = freshSkels.length ? freshSkels : skels;
  const skeleton = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  rememberSkeleton(skeleton.join("-"));
  return { key, tonality, skeleton };
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

const functionColors = {
  tonic: { hex: "#7dd3c0", rgb: "125,211,192" },
  subdominant: { hex: "#a78bfa", rgb: "167,139,250" },
  dominant: { hex: "#f59e0b", rgb: "245,158,11" },
  other: { hex: "#94a3b8", rgb: "148,163,184" },
};

const WHITE_NOTES = [
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "B3",
  "C4",
  "D4",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5",
];
const BLACK_POSITIONS = {
  0: "C#3",
  1: "D#3",
  3: "F#3",
  4: "G#3",
  5: "A#3",
  7: "C#4",
  8: "D#4",
  10: "F#4",
  11: "G#4",
  12: "A#4",
};

const SUGGESTIONS = [
  "lofi 80 bpm c minor chord progression",
  "big room edm drop 128",
  "90s rnb slow jam",
  "dark cinematic g minor",
  "chill study beat 75 bpm",
];

const FLOAT_NOTES = [
  {
    s: "♪",
    top: "15%",
    left: "88%",
    sz: 36,
    a: "floatNote2 11s ease-in-out infinite 1.2s",
  },
  {
    s: "♫",
    top: "60%",
    left: "3%",
    sz: 44,
    a: "floatNote1 12s ease-in-out infinite 3.5s",
  },
  {
    s: "♩",
    top: "75%",
    left: "91%",
    sz: 32,
    a: "floatNote2 10s ease-in-out infinite 1.8s",
  },
  {
    s: "♬",
    top: "25%",
    left: "5%",
    sz: 40,
    a: "floatNote3 13s ease-in-out infinite 2.8s",
  },
];
// ── Themes ──────────────────────────────────────────────────────────────────
// Each theme defines the core palette. The app reads "theme" and threads these
// colors into the dynamic styles.
const THEMES = {
  midnight: {
    name: "Midnight",
    swatch: "#6366f1",
    bg: "#000000",
    ambient:
      "radial-gradient(ellipse 60% 40% at 15% 10%, rgba(50,15,100,0.04) 0%, transparent 50%), radial-gradient(ellipse 45% 35% at 85% 85%, rgba(8,50,75,0.035) 0%, transparent 50%)",
    accent: "#6366f1",
    accent2: "#a78bfa",
    accentSoft: "rgba(99,102,241,0.15)",
    text: "#e2e8f0",
    textBright: "#f1f5f9",
    textDim: "#64748b",
    panel: "rgba(255,255,255,0.03)",
    panelBorder: "rgba(255,255,255,0.08)",
    note: "#71717a",
  },
  velvet: {
    name: "Velvet",
    swatch: "#e0729c",
    bg: "#0f0508",
    ambient:
      "radial-gradient(ellipse 65% 45% at 20% 12%, rgba(190,40,90,0.07) 0%, transparent 52%), radial-gradient(ellipse 50% 40% at 82% 84%, rgba(120,30,80,0.06) 0%, transparent 52%)",
    accent: "#e0729c",
    accent2: "#f0a8c0",
    accentSoft: "rgba(224,114,156,0.15)",
    text: "#f0e0e6",
    textBright: "#fdf2f6",
    textDim: "#9a7080",
    panel: "rgba(255,255,255,0.035)",
    panelBorder: "rgba(240,168,192,0.12)",
    note: "#e896b4",
  },
  forest: {
    name: "Forest",
    swatch: "#34d399",
    bg: "#03100b",
    ambient:
      "radial-gradient(ellipse 65% 45% at 18% 12%, rgba(20,120,70,0.07) 0%, transparent 52%), radial-gradient(ellipse 50% 40% at 84% 86%, rgba(15,90,90,0.06) 0%, transparent 52%)",
    accent: "#34d399",
    accent2: "#6ee7b7",
    accentSoft: "rgba(52,211,153,0.13)",
    text: "#dcefe4",
    textBright: "#f0fdf6",
    textDim: "#6b8c7c",
    panel: "rgba(255,255,255,0.03)",
    panelBorder: "rgba(110,231,183,0.12)",
    note: "#6ee7b7",
  },
  sunset: {
    name: "Sunset",
    swatch: "#fb923c",
    bg: "#120803",
    ambient:
      "radial-gradient(ellipse 65% 45% at 18% 12%, rgba(200,90,30,0.08) 0%, transparent 52%), radial-gradient(ellipse 52% 40% at 84% 84%, rgba(170,50,60,0.06) 0%, transparent 52%)",
    accent: "#fb923c",
    accent2: "#fdba74",
    accentSoft: "rgba(251,146,60,0.14)",
    text: "#f5e6da",
    textBright: "#fff6ee",
    textDim: "#9a7a64",
    panel: "rgba(255,255,255,0.035)",
    panelBorder: "rgba(253,186,116,0.13)",
    note: "#fdba74",
  },
  mono: {
    name: "Mono",
    swatch: "#a3a3a3",
    bg: "#0a0a0a",
    ambient:
      "radial-gradient(ellipse 60% 40% at 15% 10%, rgba(120,120,120,0.05) 0%, transparent 50%), radial-gradient(ellipse 45% 35% at 85% 85%, rgba(80,80,80,0.04) 0%, transparent 50%)",
    accent: "#d4d4d4",
    accent2: "#fafafa",
    accentSoft: "rgba(212,212,212,0.12)",
    text: "#d4d4d4",
    textBright: "#fafafa",
    textDim: "#737373",
    panel: "rgba(255,255,255,0.04)",
    panelBorder: "rgba(255,255,255,0.1)",
    note: "#a3a3a3",
  },
};

// ── localStorage helpers ────────────────────────────────────────────────────
const todayKey = () => {
  const d = new Date();
  return `usage_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const getUsage = () => {
  try {
    return parseInt(localStorage.getItem(todayKey()) || "0", 10);
  } catch {
    return 0;
  }
};

// ════════════════════════════════════════════════════════════════════════════
// EXAMPLE PROGRESSION  shown on first load so the app looks alive to newcomers.
// To REMOVE this feature entirely:
//   1. Delete this EXAMPLE_PROGRESSION constant
//   2. Change `useState(EXAMPLE_PROGRESSION)` back to `useState(null)` for `result`
//   3. Delete the `isExample` state + the example banner JSX (search "isExample")
// ════════════════════════════════════════════════════════════════════════════
const EXAMPLE_PROGRESSION = {
  title: "Late Night Drive",
  key: "C major",
  bpm: 78,
  timeSignature: "4/4",
  style: "lofi",
  vibe: "warm, hazy, and nostalgic",
  genre: "lo-fi hip hop",
  theory:
    "A classic ii-V-I-vi turnaround dressed in extended jazz voicings. The Dm9 and G13 create gentle tension that resolves into the warm Cmaj7, while the Am11 keeps it from feeling too resolved — perfect for a loop.",
  chords: [
    {
      name: "Dm9",
      duration: 1,
      notes: ["D2", "F3", "A3", "C4", "E4"],
      function: "subdominant",
      romanNumeral: "ii",
    },
    {
      name: "G13",
      duration: 1,
      notes: ["G2", "B3", "F4", "A4", "E5"],
      function: "dominant",
      romanNumeral: "V",
    },
    {
      name: "Cmaj7",
      duration: 1,
      notes: ["C3", "E4", "G4", "B4"],
      function: "tonic",
      romanNumeral: "I",
    },
    {
      name: "Am11",
      duration: 1,
      notes: ["A2", "G3", "C4", "E4", "D5"],
      function: "tonic",
      romanNumeral: "vi",
    },
  ],
};

// ── Inline SVG icons (feather-style, stroke follows text color) ─────────────
// Replaces the emoji that used to live in buttons/labels — emoji render
// differently on every OS and made the UI look unpolished.
const ICONS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  play: '<polygon points="5 3 19 12 5 21"/>',
};

function Icon({ name, size = 14, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: "-2px", flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}

// ── Piano roll sub-component ─────────────────────────────────────────────────
// Timeline view of the whole progression: pitch on the vertical axis, time on
// the horizontal. Every note of every chord is drawn as a bar (colored by the
// chord's harmonic function, same coding as the chord cards), and a playhead
// sweeps across during playback. The playhead is driven by timingRef — a ref
// runProgression stamps at the start of each chord — and writes straight to
// the DOM node from requestAnimationFrame so it never forces React re-renders.
const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

function PianoRoll({ chords, activeChord, isPlaying, timingRef, theme }) {
  const playheadRef = useRef(null);

  const totalDur = chords.reduce((a, c) => a + (c.duration || 1), 0) || 1;
  const notes = [];
  let lo = 127,
    hi = 0,
    cursor = 0;
  const chordStarts = [];
  chords.forEach((c, ci) => {
    chordStarts.push(cursor);
    const dur = c.duration || 1;
    (c.notes || []).forEach((n) => {
      const midi = parseNoteMidi(n);
      if (midi === null) return;
      lo = Math.min(lo, midi);
      hi = Math.max(hi, midi);
      notes.push({ midi, start: cursor, dur, chord: ci });
    });
    cursor += dur;
  });
  if (!notes.length) return null;
  lo -= 1;
  hi += 1;

  const W = 720;
  const KEYS_W = 44;
  const HEADER_H = 18;
  const rowH = Math.max(10, Math.min(16, Math.floor(320 / (hi - lo + 1))));
  const H = (hi - lo + 1) * rowH;
  const innerW = W - KEYS_W;
  const xOf = (beats) => KEYS_W + (beats / totalDur) * innerW;
  const yOf = (midi) => (hi - midi) * rowH;

  useEffect(() => {
    const ph = playheadRef.current;
    if (!ph) return;
    if (!isPlaying) {
      ph.setAttribute("transform", "translate(-10,0)");
      return;
    }
    let raf = 0;
    const tick = () => {
      const tm = timingRef.current;
      if (tm && chords[tm.index]) {
        const frac = Math.min(
          1,
          (performance.now() - tm.startedAt) / tm.durMs
        );
        const beats =
          chordStarts[tm.index] + frac * (chords[tm.index].duration || 1);
        ph.setAttribute("transform", `translate(${xOf(beats)},0)`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, chords]);

  const rows = [];
  for (let m = lo; m <= hi; m++) rows.push(m);

  // DAW-style beat grid: each chord slot subdivides into quarter-bar beats.
  const beatLines = [];
  chords.forEach((c, ci) => {
    const dur = c.duration || 1;
    for (let k = 1; k < dur * 4; k++)
      beatLines.push(chordStarts[ci] + k * 0.25);
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H + HEADER_H}`}
      width="100%"
      style={{ display: "block" }}
      aria-label="Piano roll of the progression"
    >
      {/* Chord name header */}
      {chords.map((c, ci) => (
        <text
          key={`h${ci}`}
          x={xOf(chordStarts[ci]) + 5}
          y={12}
          fontSize="10"
          fontFamily="monospace"
          letterSpacing="1"
          fill={activeChord === ci ? theme.textBright : theme.textDim}
        >
          {c.name}
        </text>
      ))}
      <g transform={`translate(0,${HEADER_H})`}>
        {/* Note-area backdrop */}
        <rect
          x={KEYS_W}
          y={0}
          width={innerW}
          height={H}
          fill="rgba(255,255,255,0.015)"
        />
        {/* Pitch lanes: black-key rows darker, thin separators, octave lines */}
        {rows.map((m) => (
          <g key={m}>
            {BLACK_KEY_PCS.has(m % 12) && (
              <rect
                x={KEYS_W}
                y={yOf(m)}
                width={innerW}
                height={rowH}
                fill="rgba(0,0,0,0.28)"
              />
            )}
            <line
              x1={KEYS_W}
              x2={W}
              y1={yOf(m)}
              y2={yOf(m)}
              stroke="rgba(255,255,255,0.03)"
            />
            {m % 12 === 0 && (
              <line
                x1={KEYS_W}
                x2={W}
                y1={yOf(m) + rowH}
                y2={yOf(m) + rowH}
                stroke="rgba(255,255,255,0.09)"
              />
            )}
          </g>
        ))}
        {/* Beat grid + chord boundaries */}
        {beatLines.map((b, i) => (
          <line
            key={`b${i}`}
            x1={xOf(b)}
            x2={xOf(b)}
            y1={0}
            y2={H}
            stroke="rgba(255,255,255,0.035)"
          />
        ))}
        {chordStarts.map((s, ci) => (
          <line
            key={`g${ci}`}
            x1={xOf(s)}
            x2={xOf(s)}
            y1={0}
            y2={H}
            stroke="rgba(255,255,255,0.10)"
          />
        ))}
        {/* Piano-key gutter */}
        {rows.map((m) => {
          const isBlack = BLACK_KEY_PCS.has(m % 12);
          return (
            <g key={`k${m}`}>
              <rect
                x={0}
                y={yOf(m)}
                width={KEYS_W}
                height={rowH}
                fill={isBlack ? "#14141c" : "#e7e9ee"}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="0.5"
              />
              {m % 12 === 0 && (
                <text
                  x={KEYS_W - 4}
                  y={yOf(m) + rowH - 2}
                  fontSize={Math.min(9, rowH - 1)}
                  fontFamily="monospace"
                  textAnchor="end"
                  fill="#3a3f4a"
                >
                  C{m / 12 - 1}
                </text>
              )}
            </g>
          );
        })}
        {/* Note blocks — solid MIDI-clip style with a border */}
        {notes.map((n, i) => {
          const col =
            (functionColors[chords[n.chord].function] || functionColors.other)
              .hex;
          const active = activeChord === n.chord;
          const dimmed = activeChord !== -1 && !active;
          return (
            <rect
              key={i}
              x={xOf(n.start) + 1}
              y={yOf(n.midi) + 0.5}
              width={xOf(n.start + n.dur) - xOf(n.start) - 2}
              height={rowH - 1}
              rx={1}
              fill={col}
              stroke={active ? "#ffffff" : "rgba(0,0,0,0.55)"}
              strokeWidth={active ? 1.25 : 1}
              opacity={dimmed ? 0.35 : active ? 1 : 0.9}
            />
          );
        })}
      </g>
      {/* Playhead: marker triangle + line, moved as one group */}
      <g ref={playheadRef} transform="translate(-10,0)">
        <polygon
          points={`-4,${HEADER_H - 7} 4,${HEADER_H - 7} 0,${HEADER_H}`}
          fill={theme.accent2}
        />
        <line
          x1={0}
          x2={0}
          y1={HEADER_H}
          y2={HEADER_H + H}
          stroke={theme.accent2}
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

export default function ChordApp() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(EXAMPLE_PROGRESSION);
  const [savedProjects, setSavedProjects] = useState([]);
  const [isExample, setIsExample] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [activeChord, setActiveChord] = useState(-1);
  const [history, setHistory] = useState([]);
  // ── Exploration state (Variations / Mutate / Rejected) ──
  const [variations, setVariations] = useState([]); // alternative takes on the current vibe
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [rejected, setRejected] = useState([]); // chord names the user has nope'd
  const [mutatingSlot, setMutatingSlot] = useState(-1); // which chord slot is being mutated (-1 = none)
  const [mutations, setMutations] = useState([]); // alternative chords for the slot
  const [loadingMutations, setLoadingMutations] = useState(false);
  const [lastPrompt, setLastPrompt] = useState(""); // remember original prompt for variation API
  const [activeTone, setActiveTone] = useState("piano");
  const [bpm, setBpm] = useState(80);
  const [reverb, setReverb] = useState(15);
  const [decay, setDecay] = useState(50);
  const [arpeggiate, setArpeggiate] = useState(0); // 0 = block chords, 100 = full arpeggio
  const [highlightedNotes, setHighlightedNotes] = useState(new Set());
  const [sampleStatus, setSampleStatus] = useState(
    "Loading real piano samples…"
  );
  const [samplesReady, setSamplesReady] = useState(false);

  // Modals
  const [showWelcome, setShowWelcome] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [proHeadline, setProHeadline] = useState("Unlock everything");
  const [proSubhead, setProSubhead] = useState(
    "Pro launches soon. Be the first to know."
  );
  const [shareUrl, setShareUrl] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [usageLeft, setUsageLeft] = useState(FREE_DAILY_LIMIT - getUsage());

  // Settings (persisted to localStorage)
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem("theme") || "midnight";
    } catch {
      return "midnight";
    }
  });
  const [showFloatingNotes, setShowFloatingNotes] = useState(() => {
    try {
      return localStorage.getItem("floatingNotes") !== "off";
    } catch {
      return true;
    }
  });
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return localStorage.getItem("reduceMotion") === "on";
    } catch {
      return false;
    }
  });
  const theme = THEMES[themeId] || THEMES.midnight;

  // Refs for audio + canvas + loop control
  const canvasRef = useRef(null);
  const samplersRef = useRef({});
  const reverbRef = useRef(null);
  const toneStartedRef = useRef(false);
  const stopLoopRef = useRef(false);
  // Piano-roll playhead timing: stamped at the start of every chord so the
  // roll can interpolate the playhead position without owning any state.
  const rollTimingRef = useRef(null);
  // Vinyl crackle bed for lofi/ambient playback (created lazily, playback-only)
  const crackleRef = useRef(null);

  // ── Setup Tone.js instruments once ────────────────────────────────────────
  useEffect(() => {
    const Tone = window.Tone;
    if (!Tone) {
      setSampleStatus("Audio library failed to load — check your connection");
      return;
    }

    const reverbNode = new Tone.Reverb({
      decay: 2.5,
      wet: 0.25,
      preDelay: 0.01,
    }).toDestination();
    reverbRef.current = reverbNode;

    const piano = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      release: 1.2,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setTimeout(() => {
          setSamplesReady(true);
          setSampleStatus("Piano samples ready");
          setTimeout(() => setSampleStatus(""), 2500);
        }, 100);
      },
    }).toDestination();

const rhodes = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 12,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 1.2, sustain: 0.15, release: 1.8 },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.05,
        release: 0.6,
      },
    }).toDestination();
    rhodes.volume.value = -9;

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.7, release: 2.5 },
    }).toDestination();
    pad.volume.value = -10;

    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.8 },
    }).toDestination();
    pluck.volume.value = -6;

    samplersRef.current = { piano, rhodes, pad, pluck };

    return () => {
      [piano, rhodes, pad, pluck, reverbNode].forEach((n) => {
        try {
          n.dispose();
        } catch {}
      });
    };
  }, []);

  // ── Welcome modal on first visit ──────────────────────────────────────────
  // Disabled for now — app opens straight to the main page.
  // To re-enable later, uncomment the effect below.
  // useEffect(() => {
  //   let show = false;
  //   try { show = !localStorage.getItem("welcome_shown_v1"); }
  //   catch { show = true; }
  //   if (show) {
  //     const t = setTimeout(() => setShowWelcome(true), 600);
  //     return () => clearTimeout(t);
  //   }
  // }, []);

  // ── Load shared progression from URL hash ─────────────────────────────────
  useEffect(() => {
    const loadFromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#p=")) return;
      try {
        let b64 = hash.slice(3).replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const json = decodeURIComponent(escape(atob(b64)));
        const p = JSON.parse(json);
        setResult({
          title: p.t,
          key: p.k,
          bpm: p.b,
          timeSignature: p.ts,
          genre: p.g,
          vibe: p.v,
          theory: p.th,
          chords: p.c.map((c) => ({
            name: c.n,
            duration: c.d,
            notes: c.no,
            function: c.f,
            romanNumeral: c.r,
          })),
        });
        if (p.b) setBpm(p.b);
        if (p.tn) setActiveTone(p.tn);
        if (typeof p.rv === "number") setReverb(p.rv);
        if (typeof p.sn === "number") setDecay(p.sn);
      } catch (e) {
        console.warn("Failed to load shared progression:", e);
      }
    };
    loadFromHash();
    window.addEventListener("hashchange", loadFromHash);
    return () => window.removeEventListener("hashchange", loadFromHash);
  }, []);

  // ── Piano canvas drawing ──────────────────────────────────────────────────
  const drawPiano = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    const ww = W / WHITE_NOTES.length;
    ctx.clearRect(0, 0, W, H);

    WHITE_NOTES.forEach((note, i) => {
      const lit = highlightedNotes.has(note);
      ctx.fillStyle = lit ? "#818cf8" : "#f1f5f9";
      ctx.strokeStyle = "#1e1e2e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(i * ww + 1, 0, ww - 2, H - 2, [0, 0, 4, 4]);
      ctx.fill();
      ctx.stroke();
      if (lit) {
        ctx.fillStyle = "rgba(99,102,241,0.25)";
        ctx.fillRect(i * ww + 1, H * 0.65, ww - 2, H * 0.35 - 2);
      }
      if (note.startsWith("C") && !note.includes("#")) {
        ctx.fillStyle = lit ? "#fff" : "#64748b";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(note, i * ww + ww / 2, H - 7);
      }
    });

    const bh = H * 0.62,
      bw = ww * 0.58;
    Object.entries(BLACK_POSITIONS).forEach(([idx, note]) => {
      const i = parseInt(idx);
      const lit = highlightedNotes.has(note);
      const x = (i + 1) * ww - bw / 2;
      ctx.fillStyle = lit ? "#6366f1" : "#0f0f1a";
      ctx.beginPath();
      ctx.roundRect(x, 0, bw, bh, [0, 0, 3, 3]);
      ctx.fill();
      if (lit) {
        ctx.fillStyle = "rgba(165,180,252,0.4)";
        ctx.fillRect(x + 2, bh * 0.65, bw - 4, bh * 0.35);
      }
    });
  }, [highlightedNotes]);

  useEffect(() => {
    drawPiano();
  }, [drawPiano]);

  // ── Audio helpers ─────────────────────────────────────────────────────────
  const ensureAudio = useCallback(async () => {
    const Tone = window.Tone;
    if (!Tone) {
      console.warn("Tone.js not available — audio cannot play.");
      return;
    }
    // Tone.start() MUST run from a user gesture (click) — this unlocks the browser's audio.
    if (!toneStartedRef.current) {
      try {
        await Tone.start();
        if (reverbRef.current) await reverbRef.current.generate();
        toneStartedRef.current = true;
      } catch (e) {
        console.warn("Tone.start() failed:", e);
      }
    }
    // Wait for piano samples, but NEVER hang forever — race against a 4s timeout.
    // If samples aren't ready in time, getSampler() falls back to the rhodes synth.
    if (activeTone === "piano") {
      try {
        await Promise.race([
          Tone.loaded(),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch (e) {
        console.warn("Tone.loaded() issue:", e);
      }
    }
  }, [activeTone]);

  // Get the active sampler, with piano fallback to rhodes if not loaded
  const getSampler = useCallback((tone) => {
    let useTone = tone;
    const samplers = samplersRef.current;
    if (tone === "piano") {
      const p = samplers.piano;
      if (!p || !p.loaded) {
        console.info("Piano samples not ready — using Rhodes synth instead.");
        useTone = "rhodes";
      }
    }
    const s = samplers[useTone] || samplers.rhodes;
    if (!s) console.warn("No sampler available — instruments not initialized.");
    return s;
  }, []);

  // Split a chord's notes into low (root/bass) and high (color tones)
  const splitVoicing = (notes) => {
    if (!notes || notes.length === 0) return { low: [], high: [], all: [] };
    const sorted = [...notes];
    const splitIdx = Math.max(1, Math.floor(sorted.length / 2.5));
    return {
      low: sorted.slice(0, splitIdx),
      high: sorted.slice(splitIdx),
      all: sorted,
    };
  };

  // Play one chord with a full groove pattern. Returns nothing — it schedules itself.
  // chordDurSec = how long this chord occupies in the bar.
  const performChord = useCallback(
    (notes, chordDurSec, tone, groove) => {
      const Tone = window.Tone;
      if (!Tone) {
        console.warn("performChord: Tone not available");
        return;
      }
      const sampler = getSampler(tone);
      if (!sampler) {
        console.warn("performChord: no sampler");
        return;
      }

      // Reverb routing — only attempt if the reverb is fully generated.
      // If anything fails, we just play dry (the sampler is already .toDestination()).
      const reverbAmount = (reverb / 100) * 0.5;
      if (reverbRef.current && reverbRef.current.loaded !== false) {
        try {
          reverbRef.current.wet.value = reverbAmount;
          if (reverbAmount > 0.01) {
            try {
              sampler.disconnect(reverbRef.current);
            } catch {}
            try {
              sampler.connect(reverbRef.current);
            } catch {}
          }
        } catch (e) {
          /* dry fallback */
        }
      }

      // ── ARPEGGIO MODE ──
      // When arpeggiate > 0, replace the groove's hits with an arpeggiated pattern.
      // At 100% it's a pure 1/8th-note arpeggio. At lower values it blends with the original groove.
      const arpAmount = arpeggiate / 100;
      let activeGroove = groove;
      if (arpAmount > 0.02) {
        const sorted = [...notes];
        // Build an ascending arpeggio across the chord's notes, then add a descending tail at high values
        const arpHits = [];
        const steps = sorted.length;
        // Each note gets its own slot, evenly distributed across the chord duration
        sorted.forEach((_, i) => {
          arpHits.push({
            t: (i / steps) * (1 - 0.05), // leave a small gap at the end
            notes: "arp", // special marker handled below
            arpIdx: i,
            vel: 0.55 + (i === 0 ? 0.1 : 0), // first note slightly louder
            len: (1 / steps) * 1.4,
          });
        });
        activeGroove = {
          swing: groove.swing * (1 - arpAmount * 0.7),
          humanize: (groove.humanize || 0.012) * (1 - arpAmount * 0.5),
          hits: arpHits,
          _arpNotes: sorted,
        };
        // At partial arp values, blend in the original groove's "low" hit so the bass note stays grounded
        if (arpAmount < 0.7 && groove.hits[0]) {
          activeGroove.hits.unshift({
            t: 0,
            notes: "low",
            vel: groove.hits[0].vel * (1 - arpAmount),
            len: groove.hits[0].len,
          });
        }
      }

      const voicing = splitVoicing(notes);
      const sustainMul = (decay / 100) * 1.0 + 0.5;
      const hum = activeGroove.humanize || 0.012;
      let firedCount = 0;

      activeGroove.hits.forEach((hit) => {
        let hitTime = hit.t;
        const isOffbeat = hit.t % 0.5 > 0.001 && hit.t % 0.5 < 0.499;
        if (isOffbeat && activeGroove.swing)
          hitTime += activeGroove.swing * 0.25;
        const baseDelayMs = hitTime * chordDurSec * 1000;
        let hitNotes;
        if (hit.notes === "arp")
          hitNotes = [activeGroove._arpNotes[hit.arpIdx]];
        else if (hit.notes === "low") hitNotes = voicing.low;
        else if (hit.notes === "high") hitNotes = voicing.high;
        else hitNotes = voicing.all;
        const isRoll = hit.notes === "roll";
        const noteDur = chordDurSec * hit.len * sustainMul;
        const chordHum = (Math.random() - 0.5) * hum * 1000;
        hitNotes.forEach((n, i) => {
          // Humanized block chord: the notes land together to the ear, but
          // like a real hand — bass touches first, the rest fall inside a
          // ~10ms window (too tight to hear as a strum, loose enough to feel
          // played). The top note gets a little extra weight so the melody
          // voice sings; inner voices sit slightly softer. The ARPEGGIATE
          // slider remains the control for audible note spreading.
          const isBass = i === 0;
          const isTop = i === hitNotes.length - 1 && hitNotes.length > 1;
          const handSpread = isBass ? 0 : 3 + Math.random() * 8;
          const delay = Math.max(0, baseDelayMs + (chordHum || 0) + handSpread);
          const voiceBalance = isTop ? 1.06 : isBass ? 1.0 : 0.92;
          const vel = Math.min(
            1,
            Math.max(0.1, hit.vel * voiceBalance * (0.9 + Math.random() * 0.18))
          );
          firedCount++;
          setTimeout(() => {
            try {
              sampler.triggerAttackRelease(n, noteDur, undefined, vel);
            } catch (e) {
              console.warn("triggerAttackRelease failed for", n, e);
            }
          }, delay);
        });
      });
      console.log(
        `▶ performChord: scheduled ${firedCount} notes for chord [${notes.join(
          ","
        )}] with tone=${tone} arp=${arpeggiate}`
      );
    },
    [reverb, decay, getSampler, arpeggiate]
  );

  // Simple single-chord preview (used by tap-to-preview) — gentle roll
  const playChordTone = useCallback(
    (notes, durationSec, tone) => {
      const Tone = window.Tone;
      if (!Tone) return;
      const sampler = getSampler(tone);
      if (!sampler) return;
      const reverbAmount = (reverb / 100) * 0.5;
      if (reverbRef.current) reverbRef.current.wet.value = reverbAmount;
      try {
        sampler.disconnect(reverbRef.current);
      } catch {}
      if (reverbAmount > 0.01 && reverbRef.current) {
        try {
          sampler.connect(reverbRef.current);
        } catch {}
      }
      // Tap-preview: same humanized block feel as full playback — bass lands
      // first, others inside a ~10ms window, top note slightly louder.
      notes.forEach((n, i) => {
        const isBass = i === 0;
        const isTop = i === notes.length - 1 && notes.length > 1;
        const handSpread = isBass ? 0 : 3 + Math.random() * 8;
        const voiceBalance = isTop ? 1.06 : isBass ? 1.0 : 0.92;
        const vel = Math.min(1, 0.6 * voiceBalance * (0.9 + Math.random() * 0.18));
        setTimeout(() => {
          try {
            sampler.triggerAttackRelease(n, durationSec, undefined, vel);
          } catch (e) {
            console.warn("Note failed:", n, e);
          }
        }, handSpread);
      });
    },
    [reverb, getSampler]
  );

  // ── Generate progression ──────────────────────────────────────────────────
  const SAVE_KEY = "chordcraft_saved";
  const getSaved = () => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "[]"); }
    catch { return []; }
  };
  const saveProject = () => {
    if (!result) return;
    const saved = getSaved();
    const limit = isPro ? Infinity : 3;
    if (saved.length >= limit) {
      openProModal("Save more projects", "Free users can save 3. Go Pro for unlimited saves.");
      return;
    }
    const project = { id: Date.now(), name: result.title || "untitled", data: result };
    const updated = [project, ...saved];
    localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);
  };
  const loadProject = (p) => { setResult(p.data); };
  const deleteProject = (id) => {
    const updated = getSaved().filter((p) => p.id !== id);
    localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);
  };
  const checkUsage = () => {
    const used = getUsage();
    const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    if (used >= limit) return false;
    try {
      localStorage.setItem(todayKey(), used + 1);
    } catch {}
    setUsageLeft(limit - (used + 1));
    return true;
  };

  const generate = async () => {
    if (!prompt.trim() || isPlaying || loading) return;
    if (!checkUsage()) {
      setShowLimit(true);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveChord(-1);
    // Reset exploration when generating a fresh take
    setVariations([]);
    setRejected([]);
    setMutatingSlot(-1);
    setMutations([]);

    // The client owns the structure: pick a fresh key and a vetted 4-chord
    // skeleton (already arc-correct and loop-correct), compute the exact
    // bass roots, and hand them to the model as hard constraints. The model
    // only chooses qualities, extensions, and voicings. The response is then
    // validated against those roots and retried once if it doesn't comply —
    // prompt rules alone proved too easy for the model to break.
    const recentKeys = history.slice(0, 3).map((h) => h.result && h.result.key).filter(Boolean);
    if (result && result.key) recentKeys.push(result.key);
    const forced = pickForcedContext(prompt, recentKeys);
    const roots = skeletonRoots(forced.key, forced.skeleton);
    const slotLines = forced.skeleton
      .map(
        (tok, i) =>
          `  Chord ${i + 1}: romanNumeral "${tok}" — root MUST be ${roots[i]} (lowest note ${roots[i]}2). Typical quality: ${RN_QUALITY[forced.tonality][tok]}.`
      )
      .join("\n");

    const buildMessage = (feedback) => `${prompt}${bpmBlock(bpm)}

REQUIRED SKELETON (non-negotiable — structure is fixed, do not substitute):
- key MUST be exactly "${forced.key}". Set the "key" field to this string.
- The progression is ${forced.skeleton.join(" → ")} in ${forced.key}, so the four bass roots are ${roots.join(", ")} in that exact order.
${slotLines}
- You choose the chord qualities/extensions (guided by the tempo block above) and the voicings. You do NOT choose the roots or their order.
- This skeleton overrides any structural suggestion elsewhere, including the tempo block's texture flavor.${feedback}

Random variation seed: ${Date.now()}`;

    const callModel = async (content) => {
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          temperature: 1,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      return normalizeProgression(
        JSON.parse(text.replace(/```json|```/g, "").trim())
      );
    };

    try {
      let parsed = await callModel(buildMessage(""));
      let problems = validateProgression(parsed, forced.skeleton, roots);
      if (problems.length) {
        // One corrective retry: tell the model exactly what it got wrong.
        try {
          const retry = await callModel(
            buildMessage(
              `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED for these violations: ${problems.join("; ")}. Regenerate and follow the skeleton EXACTLY this time.`
            )
          );
          const retryProblems = validateProgression(retry, forced.skeleton, roots);
          if (retryProblems.length < problems.length) {
            parsed = retry;
            problems = retryProblems;
          }
        } catch {
          /* keep the first attempt if the retry itself fails */
        }
      }
      // The user's slider is the source of truth for BPM, and the forced key
      // is the source of truth for the key label — stamp both onto the result
      // so display, playback, export, and share all match.
      parsed.bpm = bpm;
      parsed.key = forced.key;
      setResult(parsed);
      setIsExample(false);
      setLastPrompt(prompt);
      setHistory((h) => [{ prompt, result: parsed }, ...h].slice(0, 5));
    } catch (e) {
      setError("Couldn't parse that — try a different description.");
    }
    setLoading(false);
  };

  // ── Exploration: fetch 4 alternate progressions for the same vibe ─────────
  const fetchVariations = async () => {
    if (!result || loadingVariations) return
    setLoadingVariations(true);
    try {
      const promptForAI =
        lastPrompt ||
        `${result.vibe || ""} ${result.genre || ""}`.trim() ||
        result.title;
      const currentChords = result.chords.map((c) => c.name).join(" - ");
      const rejectedNote = rejected.length
        ? `Avoid these chord names entirely: ${rejected.join(", ")}.`
        : "";
      // Assign each variation its own vetted skeleton in the current key so
      // the four alternatives are structurally distinct by construction.
      const varTonality = /minor/i.test(result.key || "") ? "minor" : "major";
      const varTonic = PITCH_CLASS[(result.key || "").split(" ")[0]];
      const varSkels = [...PROGRESSION_SKELETONS[varTonality]]
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
      const varRoots = varTonic === undefined
        ? null
        : varSkels.map((s) => skeletonRoots(result.key, s));
      const skeletonLines = varSkels
        .map(
          (s, i) =>
            `   Variation ${i + 1}: ${s.join(" → ")}${varRoots ? ` — bass roots MUST be ${varRoots[i].join(", ")} in that order` : ""}.`
        )
        .join("\n");
      const variationSystem = `You generate 4 ALTERNATIVE chord progressions for the same vibe. Return ONLY a JSON ARRAY of 4 objects, each in the same shape as before:
[{"title":"...","key":"...","bpm":...,"timeSignature":"4/4","style":"...","chords":[{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."},...4 chords each...],"vibe":"...","genre":"...","theory":"..."}, ... ×4]

HARD REQUIREMENTS (a variation that breaks any of these is unusable — do not return it):

1. KEY LOCK. Every variation stays in ${result.key}. Same tonal center, same "key" field value. Do NOT drift into a new key.

2. REQUIRED SKELETONS — each variation uses its assigned structure exactly (romanNumeral fields must match these tokens; you may append qualities like 7/9/maj7):
${skeletonLines}
   You choose the chord qualities, extensions, and voicings. You do NOT choose the roots or their order.

3. VOICE LEADING inside AND across the loop. Adjacent chords' upper voices must connect by common tone or single step. Chord 4's upper voices must connect back to chord 1's upper voices the same way. Top voice across all 4 chords should be a smooth line, not leaps.

4. TEXTURE VARIETY — beyond the different skeletons, make the four variations differ in feel: different extensions (m9 vs m11 vs plain m7), different top notes, different registers for the color tones.

5. TEMPO. All variations honour the tempo target block below — same voicing density, chord duration, and style rules for the current BPM.

The user's current progression (do NOT reproduce it — these are alternatives): ${currentChords}. ${rejectedNote}`;
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2500,
          temperature: 1,
          system: variationSystem,
          messages: [{ role: "user", content: `${promptForAI}${bpmBlock(bpm)}` }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) {
        // Force each variation onto the user's chosen tempo so the slider
        // stays authoritative, and respell notes into the key's accidentals.
        parsed.forEach((v) => { if (v) { v.bpm = bpm; normalizeProgression(v); } });
        // Drop variations that ignored their assigned skeleton; if the model
        // botched all of them, show everything rather than nothing.
        const valid = varRoots
          ? parsed.filter(
              (v, i) =>
                v &&
                varSkels[i] &&
                validateProgression(v, varSkels[i], varRoots[i]).length === 0
            )
          : parsed;
        setVariations(valid.length ? valid : parsed);
      }
    } catch (e) {
      console.warn("Variation fetch failed:", e);
    }
    setLoadingVariations(false);
  };

  const applyVariation = (variation) => {
    // Variations are already generated at the user's current BPM, and the
    // slider is the source of truth — don't let a returned bpm overwrite it.
    setResult({ ...variation, bpm });
    setVariations([]);
    setMutatingSlot(-1);
    setMutations([]);
  };

  const rejectChord = (chordName) => {
    setRejected((r) => (r.includes(chordName) ? r : [...r, chordName]));
  };
  const unrejectChord = (chordName) => {
    setRejected((r) => r.filter((c) => c !== chordName));
  };

  // ── Exploration: mutate a single chord slot ────────────────────────────────
  const fetchMutations = async (slotIdx) => {
    if (!result || loadingMutations) return;
    setMutatingSlot(slotIdx);
    setLoadingMutations(true);
    setMutations([]);
    try {
      const chord = result.chords[slotIdx];
      const context = result.chords
        .map((c, i) => (i === slotIdx ? "[?]" : c.name))
        .join(" - ");
      const rejectedNote = rejected.length
        ? `Avoid: ${rejected.join(", ")}.`
        : "";
      const mutGuide = bpmDirective(bpm);
      const slotRole = slotIdx === 0
        ? "HOME (tonic-family: I/Imaj7/Imaj9 in major, i/im7/im9 in minor). function=\"tonic\". Do NOT return a ii, iii, IV, V, or vii° — that would break the progression's opening."
        : slotIdx === result.chords.length - 1
        ? `RETURN — chord 1 of the loop is ${result.chords[0].name}, so your replacement must lead cleanly back into it: either V/V7 resolving down a 5th, a plagal/modal chord (IV, iv, bVII, bVI) landing on it by step or common tone, or a chord sharing ≥ 2 pitch classes with it. Its function should be "dominant" or "subdominant". Never a hanging ii or iii.`
        : slotIdx === 1
        ? "MOVE (leaves home but stays in key: IV, ii, iii, vi, bVII, bVI). Do not duplicate chord 1's root."
        : "BUILD (pre-dominant or dominant tension pulling into chord 4: ii, IV, iv, V7/x, bVII).";
      const mutationSystem = `You generate 3 ALTERNATIVE single chords for one slot in a progression. Return ONLY a JSON ARRAY of 3 chord objects: [{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."}, ×3]
Key: ${result.key} (stay in this key — no modulations). Tempo: ${bpm} BPM (${mutGuide.band}). Surrounding chords: ${context} — the [?] slot is what you're replacing. Original chord there was ${chord.name}.
SLOT ROLE (mandatory): this slot's job in the progression is ${slotRole}
VOICE LEADING: the replacement must connect to its neighbors by common tone or single step in the upper voices — no leaps. Check both ${slotIdx > 0 ? `chord ${slotIdx} → your chord` : "wraparound: chord 4 → your chord (loop point)"} and ${slotIdx < result.chords.length - 1 ? `your chord → chord ${slotIdx + 2}` : `your chord → chord 1 (loop point: ${result.chords[0].name})`}.
Give 3 genuinely different musical choices — try modal interchange, secondary dominants, tritone subs, chromatic neighbors, but each must still satisfy the slot role and voice leading above. Voicing for this tempo: ${mutGuide.voicing} Duration: ${mutGuide.duration.includes("2 bars") ? "2" : mutGuide.duration.includes("0.5") ? "match surrounding chords" : "1"}. ${rejectedNote}`;
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          temperature: 1,
          system: mutationSystem,
          messages: [{ role: "user", content: `Replace the [?] chord.` }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) {
        const useFlats = keyUsesFlats(result.key);
        parsed.forEach((c) => normalizeChordSpelling(c, useFlats));
        setMutations(parsed);
      }
    } catch (e) {
      console.warn("Mutation fetch failed:", e);
    }
    setLoadingMutations(false);
  };

  const applyMutation = (newChord) => {
    if (mutatingSlot < 0 || !result) return;
    const newChords = [...result.chords];
    newChords[mutatingSlot] = newChord;
    setResult({ ...result, chords: newChords });
    setMutatingSlot(-1);
    setMutations([]);
  };

  // ── Vinyl crackle (lofi/ambient playback only) ───────────────────────────
  // A whisper of high-passed pink noise plus sparse random pops. Kept very
  // quiet — it should be felt, not noticed. Never runs for previews or in
  // the WAV export, so exported audio stays clean.
  const startCrackle = useCallback(() => {
    const Tone = window.Tone;
    if (!Tone || crackleRef.current) return;
    try {
      const gain = new Tone.Gain(0).toDestination();
      const hp = new Tone.Filter(2200, "highpass").connect(gain);
      const noise = new Tone.Noise("pink");
      noise.volume.value = -34;
      noise.connect(hp);
      noise.start();
      gain.gain.rampTo(0.5, 0.4);
      const pop = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
      }).connect(gain);
      pop.volume.value = -18;
      let cancelled = false;
      let timer = null;
      const schedulePop = () => {
        if (cancelled) return;
        timer = setTimeout(() => {
          try {
            pop.triggerAttackRelease(0.02);
          } catch {}
          schedulePop();
        }, 150 + Math.random() * 1200);
      };
      schedulePop();
      crackleRef.current = {
        gain,
        noise,
        pop,
        hp,
        stop: () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
        },
      };
    } catch {}
  }, []);

  const stopCrackle = useCallback(() => {
    const c = crackleRef.current;
    if (!c) return;
    crackleRef.current = null;
    try {
      c.stop();
      c.gain.gain.rampTo(0, 0.3);
    } catch {}
    setTimeout(() => {
      [c.noise, c.pop, c.hp, c.gain].forEach((n) => {
        try {
          n.dispose();
        } catch {}
      });
    }, 500);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────
  const runProgression = async (loop) => {
    await ensureAudio();
    const beatDur = (60 / bpm) * 2;
    stopLoopRef.current = false;

    // Full chord on every strike; style only shapes swing/humanize feel
    const style = (result.style || "").toLowerCase();
    const groove = blockGroove(style);
    if (style === "lofi" || style === "ambient") startCrackle();

    do {
      for (let i = 0; i < result.chords.length; i++) {
        if (stopLoopRef.current) break;
        const chord = result.chords[i];
        setActiveChord(i);
        setHighlightedNotes(new Set(chord.notes));
        const chordDurSec = beatDur * (chord.duration || 1);
        rollTimingRef.current = {
          index: i,
          startedAt: performance.now(),
          durMs: chordDurSec * 1000,
        };
        // The groove engine schedules all the hits/rolls/dynamics itself
        performChord(chord.notes, chordDurSec, activeTone, groove);
        await new Promise((r) => setTimeout(r, chordDurSec * 1000));
      }
    } while (loop && !stopLoopRef.current);

    stopCrackle();
    rollTimingRef.current = null;
    setActiveChord(-1);
    setHighlightedNotes(new Set());
    setIsPlaying(false);
    setLooping(false);
  };

  const handlePlay = async () => {
    console.log(
      "▶ handlePlay clicked. result:",
      !!result,
      "isPlaying:",
      isPlaying
    );
    if (!result) {
      console.warn("No result to play");
      return;
    }
    if (isPlaying) {
      stopLoopRef.current = true;
      return;
    }
    setLooping(false);
    setIsPlaying(true);
    await runProgression(false);
  };

  const handleLoop = async () => {
    if (!result) return;
    if (isPlaying) {
      stopLoopRef.current = true;
      return;
    }
    setLooping(true);
    setIsPlaying(true);
    await runProgression(true);
  };

  // ── WAV encoder ───────────────────────────────────────────────────────────
  const bufferToWav = (buffer) => {
    const nCh = buffer.numberOfChannels,
      sr = buffer.sampleRate,
      len = buffer.length;
    const ab = new ArrayBuffer(44 + len * nCh * 2);
    const v = new DataView(ab);
    const ws = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    ws(0, "RIFF");
    v.setUint32(4, 36 + len * nCh * 2, true);
    ws(8, "WAVE");
    ws(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, nCh, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * nCh * 2, true);
    v.setUint16(32, nCh * 2, true);
    v.setUint16(34, 16, true);
    ws(36, "data");
    v.setUint32(40, len * nCh * 2, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < nCh; c++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return ab;
  };

  const exportAudio = async () => {
    const Tone = window.Tone;
    if (!result || !Tone) return;
    if (activeTone === "piano" && !samplesReady) {
      alert("Piano samples still loading — wait a few seconds and try again.");
      return;
    }
    try {
      await ensureAudio();
      const beatDur = 60 / bpm;
      const loops = 2;
      const totalSec =
        result.chords.reduce((a, c) => a + (c.duration || 1), 0) *
          beatDur *
          loops +
        4;
      const rw = (reverb / 100) * 0.5;

      const buffer = await Tone.Offline(async () => {
        const offReverb = new Tone.Reverb({
          decay: 4,
          wet: rw,
        }).toDestination();
        await offReverb.generate();
        let instr;
        if (activeTone === "piano") {
          instr = new Tone.Sampler({
            urls: {
              A1: "A1.mp3",
              C2: "C2.mp3",
              "D#2": "Ds2.mp3",
              "F#2": "Fs2.mp3",
              A2: "A2.mp3",
              C3: "C3.mp3",
              "D#3": "Ds3.mp3",
              "F#3": "Fs3.mp3",
              A3: "A3.mp3",
              C4: "C4.mp3",
              "D#4": "Ds4.mp3",
              "F#4": "Fs4.mp3",
              A4: "A4.mp3",
              C5: "C5.mp3",
              "D#5": "Ds5.mp3",
              "F#5": "Fs5.mp3",
              A5: "A5.mp3",
              C6: "C6.mp3",
            },
            release: 1.2,
            baseUrl: "https://tonejs.github.io/audio/salamander/",
          }).connect(offReverb);
        } else if (activeTone === "rhodes") {
          instr = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1,
            modulationIndex: 3.5,
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.5 },
          }).connect(offReverb);
          instr.volume.value = -8;
        } else if (activeTone === "pad") {
          instr = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.4, decay: 0.5, sustain: 0.7, release: 2.5 },
          }).connect(offReverb);
          instr.volume.value = -10;
        } else {
          instr = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: {
              attack: 0.001,
              decay: 0.15,
              sustain: 0.1,
              release: 0.8,
            },
          }).connect(offReverb);
          instr.volume.value = -6;
        }
        await Tone.loaded();

        // Use the same block-chord engine for export so the WAV matches playback
        const style = (result.style || "").toLowerCase();
        const groove = blockGroove(style);
        const sustainMul = (decay / 100) * 1.0 + 0.5;

        const splitV = (notes) => {
          if (!notes || notes.length === 0)
            return { low: [], high: [], all: [] };
          const sorted = [...notes];
          const splitIdx = Math.max(1, Math.floor(sorted.length / 2.5));
          return {
            low: sorted.slice(0, splitIdx),
            high: sorted.slice(splitIdx),
            all: sorted,
          };
        };

        let t = 0.2;
        for (let loop = 0; loop < loops; loop++) {
          result.chords.forEach((chord) => {
            const chordDurSec = beatDur * (chord.duration || 1);
            const voicing = splitV(chord.notes);
            groove.hits.forEach((hit) => {
              let hitTime = hit.t;
              const isOffbeat = hit.t % 0.5 > 0.001 && hit.t % 0.5 < 0.499;
              if (isOffbeat && groove.swing) hitTime += groove.swing * 0.25;
              const baseTime = t + hitTime * chordDurSec;
              let hitNotes;
              if (hit.notes === "low") hitNotes = voicing.low;
              else if (hit.notes === "high") hitNotes = voicing.high;
              else hitNotes = voicing.all;
              const noteDur = chordDurSec * hit.len * sustainMul;
              // Match performChord's humanized block: chord-level drift plus
              // a ~10ms hand spread (bass first) and voice-balanced velocity.
              const chordDrift =
                (Math.random() - 0.5) * (groove.humanize || 0.012);
              hitNotes.forEach((n, ni) => {
                const isBass = ni === 0;
                const isTop = ni === hitNotes.length - 1 && hitNotes.length > 1;
                const handSpread = isBass ? 0 : 0.003 + Math.random() * 0.008;
                const voiceBalance = isTop ? 1.06 : isBass ? 1.0 : 0.92;
                const vel = Math.min(
                  1,
                  Math.max(0.1, hit.vel * voiceBalance * (0.9 + Math.random() * 0.18))
                );
                instr.triggerAttackRelease(
                  n,
                  noteDur,
                  Math.max(t, baseTime + chordDrift + handSpread),
                  vel
                );
              });
            });
            t += chordDurSec;
          });
        }
      }, totalSec);

      const audioBuffer = buffer.get ? buffer.get() : buffer;
      const wav = bufferToWav(audioBuffer);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(result.title || "chord_progression").replace(
        /\s+/g,
        "_"
      )}.wav`;
      a.click();
    } catch (e) {
      console.error("Export error:", e);
      alert("Audio export failed. Check console for details.");
    }
  };

  // ── MIDI export ───────────────────────────────────────────────────────────
  const exportMidi = () => {
    const MidiWriter = window.MidiWriter;
    if (!result) return;
    if (!MidiWriter) {
      alert("MIDI library failed to load. Check your internet connection.");
      return;
    }
    try {
      const track = new MidiWriter.Track();
      track.setTempo(bpm);
      track.addTrackName(result.title || "Chord Progression");
      const TICKS_PER_BEAT = 128;
      result.chords.forEach((chord) => {
        const ticks = Math.round((chord.duration || 1) * TICKS_PER_BEAT);
        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: chord.notes,
            duration: "T" + ticks,
            velocity: 75,
          })
        );
      });
      const write = new MidiWriter.Writer([track]);
      const a = document.createElement("a");
      a.href = write.dataUri();
      a.download = `${(result.title || "progression").replace(
        /\s+/g,
        "_"
      )}.mid`;
      a.click();
    } catch (e) {
      console.error("MIDI export failed:", e);
      alert("Failed to export MIDI: " + e.message);
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const buildShareUrl = () => {
    if (!result) return null;
    const payload = {
      t: result.title,
      k: result.key,
      b: bpm,
      ts: result.timeSignature,
      g: result.genre,
      v: result.vibe,
      th: result.theory,
      c: result.chords.map((c) => ({
        n: c.name,
        d: c.duration,
        no: c.notes,
        f: c.function,
        r: c.romanNumeral,
      })),
      tn: activeTone,
      rv: reverb,
      sn: decay,
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const base = window.location.href.split("#")[0].split("?")[0];
    return `${base}#p=${b64}`;
  };

  const openShare = () => {
    const url = buildShareUrl();
    if (!url) return;
    setShareUrl(url);
    setShowShare(true);
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const shareToPlatform = (platform) => {
    const url = encodeURIComponent(shareUrl);
    const title = encodeURIComponent(
      `Check out this chord progression I made: "${result?.title}"`
    );
    let shareURL = "";
    if (platform === "twitter")
      shareURL = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
    else if (platform === "facebook")
      shareURL = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    else if (platform === "reddit")
      shareURL = `https://reddit.com/submit?url=${url}&title=${title}`;
    window.open(shareURL, "_blank", "width=600,height=500");
  };

  // ── Settings handlers (persist to localStorage) ───────────────────────────
  const changeTheme = (id) => {
    setThemeId(id);
    try {
      localStorage.setItem("theme", id);
    } catch {}
  };
  const toggleFloatingNotes = () => {
    setShowFloatingNotes((v) => {
      const next = !v;
      try {
        localStorage.setItem("floatingNotes", next ? "on" : "off");
      } catch {}
      return next;
    });
  };
  const toggleReduceMotion = () => {
    setReduceMotion((v) => {
      const next = !v;
      try {
        localStorage.setItem("reduceMotion", next ? "on" : "off");
      } catch {}
      return next;
    });
  };

  // ── Pro modal opener ──────────────────────────────────────────────────────
  const openProModal = (headline, subhead) => {
    if (headline) setProHeadline(headline);
    if (subhead) setProSubhead(subhead);
    setShowPro(true);
  };

  const dismissWelcome = () => {
    try {
      localStorage.setItem("welcome_shown_v1", "1");
    } catch {}
    setShowWelcome(false);
  };

  const previewChord = async (chord) => {
    if (isPlaying) return;
    await ensureAudio();
    const dm = (decay / 100) * 1.2 + 0.6;
    setHighlightedNotes(new Set(chord.notes));
    playChordTone(chord.notes, 2 * dm, activeTone);
    setTimeout(() => setHighlightedNotes(new Set()), 2000);
  };

  // Quick preview of a full 4-chord variation (used in Variations panel)
  const previewProgression = async (progression) => {
    if (isPlaying || !progression?.chords) return;
    await ensureAudio();
    const previewBpm = progression.bpm || bpm;
    const beatDur = 60 / previewBpm;
    const style = (progression.style || "").toLowerCase();
    const groove = blockGroove(style);
    for (let i = 0; i < progression.chords.length; i++) {
      const c = progression.chords[i];
      setHighlightedNotes(new Set(c.notes));
      performChord(c.notes, beatDur * (c.duration || 1), activeTone, groove);
      await new Promise((r) =>
        setTimeout(r, beatDur * (c.duration || 1) * 1000)
      );
    }
    setHighlightedNotes(new Set());
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  // Theme-driven overrides applied on top of the base style objects
  const themedBody = { ...S.body, background: theme.bg, color: theme.text };
  const themedAmbient = { ...S.ambient, background: theme.ambient };

  return (
    <div style={themedBody}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Ambient + floating notes */}
      <div style={themedAmbient} />
      {showFloatingNotes && (
        <div style={S.notesBg}>
          {FLOAT_NOTES.map((n, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: n.top,
                left: n.left,
                fontSize: n.sz,
                color: theme.note,
                userSelect: "none",
                animation: reduceMotion ? "none" : n.a,
                opacity: reduceMotion ? 0.18 : undefined,
              }}
            >
              {n.s}
            </div>
          ))}
        </div>
      )}

      {/* ── Welcome Modal ── */}
      {showWelcome && (
        <div
          style={S.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && dismissWelcome()}
        >
          <div
            style={{
              ...S.modalBox,
              maxWidth: 520,
              borderColor: "rgba(99,102,241,0.4)",
            }}
          >
            <button style={S.modalClose} onClick={dismissWelcome}>
              ×
            </button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <Icon name="music" size={44} style={{ color: "#818cf8" }} />
              </div>
              <div style={S.kicker}>Welcome to</div>
              <h2 style={S.modalTitle}>ChordCraft</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
                Describe any feeling — get a real piano progression instantly.
                Free forever.
              </p>
            </div>
            <div style={S.featureBox}>
              <div style={S.featureLabel}>FREE PLAN INCLUDES</div>
              <div style={S.featureList}>
                ✓ 4-chord AI progressions
                <br />
                ✓ Real grand piano playback
                <br />
                ✓ Loop + share + MIDI export
                <br />✓ {FREE_DAILY_LIMIT} generations per day
              </div>
            </div>
            <div
              style={{
                ...S.featureBox,
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(167,139,250,0.08) 100%)",
                borderColor: "rgba(99,102,241,0.3)",
              }}
            >
              <div style={{ ...S.featureLabel, color: "#a78bfa" }}>
                PRO — from $10/mo or $100 lifetime
              </div>
              <div style={S.featureList}>
                ✦ 8 & 16-bar progressions
                <br />
                ✦ All instrument tones (Rhodes, Pad, Pluck)
                <br />
                ✦ Unlimited generations
                <br />
                ✦ Save & revisit your projects
                <br />
                ✦ Export individual stems — chords, bass, melody (coming soon)
                <br />✦ Studio-quality 24-bit WAV, no watermark (coming soon)
              </div>
            </div>
            <EmailCapture source="welcome" accent="#6366f1" />
            <button style={S.ghostBtn} onClick={dismissWelcome}>
              Start exploring →
            </button>
          </div>
        </div>
      )}

      {/* ── Pro Modal ── */}
      {showPro && (
        <div
          style={S.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowPro(false)}
        >
          <div
            style={{
              ...S.modalBox,
              maxWidth: 560,
              borderColor: "rgba(167,139,250,0.4)",
            }}
          >
            <button style={S.modalClose} onClick={() => setShowPro(false)}>
              ×
            </button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ marginBottom: 8 }}>
                <Icon name="zap" size={34} style={{ color: "#a78bfa" }} />
              </div>
              <div style={{ ...S.kicker, color: "#a78bfa" }}>
                Upgrade to Pro
              </div>
              <h3 style={S.modalTitle}>{proHeadline}</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                {proSubhead}
              </p>
            </div>

            {/* What's included */}
            <div
              style={{
                ...S.featureBox,
                background: "rgba(167,139,250,0.06)",
                borderColor: "rgba(167,139,250,0.2)",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  ...S.featureLabel,
                  color: "#a78bfa",
                  marginBottom: 10,
                }}
              >
                EVERYTHING IN PRO
              </div>
              <div style={S.featureList}>
                ✦ All 4 instrument tones unlocked
                <br />
                ✦ 8-bar & 16-bar progressions
                <br />
                ✦ {PRO_DAILY_LIMIT} daily generations
                <br />
                ✦ Save & revisit your projects
                <br />
                ✦ Export individual stems — chords, bass, melody (coming soon)
                <br />✦ 24-bit studio WAV exports (coming soon)
              </div>
            </div>

            {/* Pricing plans */}
            <div
              style={{
                ...S.featureLabel,
                color: "#a78bfa",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              CHOOSE YOUR PLAN
            </div>
            <div style={S.pricingGrid} className="pricing-grid-responsive">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id} style={{
                    ...S.priceCard,
                    border: plan.highlighted
                      ? "2px solid #a78bfa"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: plan.highlighted
                      ? "linear-gradient(180deg, rgba(167,139,250,0.12) 0%, rgba(99,102,241,0.06) 100%)"
                      : "rgba(255,255,255,0.03)",
                    position: "relative",
                  }}
                >
                  {plan.highlighted && (
                    <div style={S.bestValueBadge}>BEST VALUE</div>
                  )}
                  {plan.badge && (
                    <div
                      style={{
                        ...S.bestValueBadge,
                        background: "#f59e0b",
                        color: "#0a0a0f",
                      }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div style={S.priceLabel}>{plan.label}</div>
                  <div style={S.priceAmount}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#94a3b8",
                        verticalAlign: "top",
                        marginRight: 2,
                      }}
                    >
                      $
                    </span>
                    {plan.price}
                    <span
                      style={{
                        fontSize: 13,
                        color: "#94a3b8",
                        fontWeight: 400,
                        marginLeft: 4,
                      }}
                    >
                      {plan.period}
                    </span>
                  </div>
                  {plan.note && <div style={S.priceNote}>{plan.note}</div>}
                  <button
                    style={{
                      ...S.priceCta,
                      background: plan.highlighted
                        ? "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)"
                        : "rgba(99,102,241,0.85)",
                    }}
                    onClick={() => {
                      if (plan.checkoutUrl) {
                        window.open(plan.checkoutUrl, "_blank");
                      } else {
                        // No Stripe link yet — fall back to email signup
                        alert(
                          "Checkout launching soon! Drop your email below and we'll notify you the moment Pro goes live."
                        );
                      }
                    }}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#475569",
                textAlign: "center",
                marginTop: 16,
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              Secure checkout via Stripe · Cancel anytime · 7-day money-back
              guarantee
            </div>

            <EmailCapture
              source="pro_modal"
              accent="linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)"
            />
          </div>
        </div>
      )}

      {/* ── Daily Limit Modal ── */}
      {showLimit && (
        <div
          style={S.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowLimit(false)}
        >
          <div
            style={{
              ...S.modalBox,
              maxWidth: 440,
              borderColor: "rgba(245,158,11,0.4)",
            }}
          >
            <button style={S.modalClose} onClick={() => setShowLimit(false)}>
              ×
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 10 }}>
                <Icon name="clock" size={34} style={{ color: "#f59e0b" }} />
              </div>
              <div style={{ ...S.kicker, color: "#f59e0b" }}>
                Daily limit reached
              </div>
              <h3 style={S.modalTitle}>
                You've used your {FREE_DAILY_LIMIT} free generations today
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginBottom: 22,
                }}
              >
                Come back tomorrow, or upgrade to Pro for unlimited generations.
              </p>
              <button
                style={{
                  ...S.primaryBtn,
                  width: "100%",
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)",
                }}
                onClick={() => {
                  setShowLimit(false);
                  openProModal(
                    "Unlimited generations",
                    "Pro gives you unlimited daily generations and more."
                  );
                }}
              >
                Get notified about Pro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {showShare && (
        <div
          style={S.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowShare(false)}
        >
          <div
            style={{
              ...S.modalBox,
              maxWidth: 480,
              borderColor: "rgba(99,102,241,0.3)",
            }}
          >
            <button style={S.modalClose} onClick={() => setShowShare(false)}>
              ×
            </button>
            <div style={S.kicker}>Share Progression</div>
            <h3 style={{ ...S.modalTitle, marginBottom: 20 }}>
              "{result?.title}"
            </h3>
            <div style={S.urlBox}>{shareUrl}</div>
            <button
              style={{ ...S.primaryBtn, width: "100%", marginBottom: 12 }}
              onClick={copyShareUrl}
            >
              <Icon name="copy" size={13} /> Copy Link
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
              }}
            >
              <button
                style={S.platformBtn}
                onClick={() => shareToPlatform("twitter")}
              >
                𝕏 Twitter
              </button>
              <button
                style={S.platformBtn}
                onClick={() => shareToPlatform("facebook")}
              >
                f Facebook
              </button>
              <button
                style={S.platformBtn}
                onClick={() => shareToPlatform("reddit")}
              >
                ↗ Reddit
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#475569",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Anyone with this link can hear your progression
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div
          style={S.modalOverlay}
          onClick={(e) =>
            e.target === e.currentTarget && setShowSettings(false)
          }
        >
          <div
            style={{
              ...S.modalBox,
              maxWidth: 460,
              borderColor: theme.panelBorder,
            }}
          >
            <button style={S.modalClose} onClick={() => setShowSettings(false)}>
              ×
            </button>
            <div style={{ ...S.kicker, color: theme.accent }}>
              <Icon name="gear" size={11} /> Settings
            </div>
            <h3 style={{ ...S.modalTitle, marginBottom: 24 }}>
              Customize your engine
            </h3>

            {/* Theme picker */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  ...S.featureLabel,
                  color: theme.accent,
                  marginBottom: 12,
                }}
              >
                THEME
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5,1fr)",
                  gap: 8,
                }}
              >
                {Object.entries(THEMES).map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => changeTheme(id)}
                    title={t.name}
                    style={{
                      background: t.bg,
                      border:
                        themeId === id
                          ? `2px solid ${t.swatch}`
                          : "2px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "12px 4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accent2} 100%)`,
                        boxShadow:
                          themeId === id ? `0 0 10px ${t.swatch}` : "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "monospace",
                        letterSpacing: 0.5,
                        color: themeId === id ? t.accent2 : "#64748b",
                      }}
                    >
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div
              style={{
                ...S.featureLabel,
                color: theme.accent,
                marginBottom: 12,
              }}
            >
              DISPLAY
            </div>
            <SettingsToggle
              label="Floating notes"
              desc="Animated music notes in the background"
              on={showFloatingNotes}
              onToggle={toggleFloatingNotes}
              accent={theme.accent}
            />
            <SettingsToggle
              label="Reduce motion"
              desc="Minimize animations for a calmer, faster feel"
              on={reduceMotion}
              onToggle={toggleReduceMotion}
              accent={theme.accent}
            />

            <div
              style={{
                fontSize: 11,
                color: "#475569",
                marginTop: 20,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Settings are saved to this device automatically.
            </div>
          </div>
        </div>
      )}

      {/* ── Main App ── */}
      <div style={S.app}>
        {/* Settings button — top left, on its own */}
        <button
          style={S.settingsBtn}
          onClick={() => setShowSettings(true)}
          title="Settings"
          aria-label="Settings"
        >
          <Icon name="gear" size={16} />
        </button>

        {/* Top bar */}
        <div style={S.topBar}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              letterSpacing: 2,
              color: usageLeft <= 3 ? "#f59e0b" : "#64748b",
            }}
          >
            {usageLeft}/{FREE_DAILY_LIMIT} LEFT TODAY
          </div>
          <button
            style={S.proBtn}
            onClick={() =>
              openProModal(
                "Unlock everything",
                "Pro launches soon. Be the first to know."
              )
            }
          >
            <Icon name="zap" size={13} /> Pro
          </button>
        </div>

        <div style={S.engLabel}>ChordCraft</div>
        <h1 style={S.h1}>
          Describe a vibe.
          <br />
          <span style={{ color: "#818cf8" }}>Hear the chords.</span>
        </h1>
        <p style={S.subtitle}>
          Type a vibe. Get chords you can drop straight into your beat.
        </p>
        {sampleStatus && (
          <div
            style={{
              ...S.sampleStatus,
              color: samplesReady ? "#10b981" : "#475569",
            }}
          >
            {sampleStatus}
          </div>
        )}

        {/* Input */}
        <div style={S.inputWrap}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                generate();
              }
            }}
            placeholder="e.g. sad 80 bpm chord for a rainy night..."
            rows={2}
            style={S.textarea}
          />
          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            style={{
              ...S.generateBtn,
              background: loading ? "rgba(99,102,241,.3)" : "#6366f1",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "→"}
          </button>
        </div>

        {/* Suggestions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 36,
          }}
        >
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion" onClick={() => setPrompt(s)}>
              {s}
            </button>
          ))}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading && (
          <div
            style={{ textAlign: "center", padding: "60px 0", color: "#6366f1" }}
          >
            <div
              className="note-spin"
              style={{ fontSize: 36, marginBottom: 16 }}
            >
              ♩
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                fontFamily: "monospace",
                letterSpacing: 2,
              }}
            >
              COMPOSING...
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="fade-in">
            {/* Example banner — shown until the user generates their own */}
            {isExample && (
              <div style={S.exampleBanner}>
                <Icon name="headphones" size={15} style={{ color: theme.accent2 }} />
                <span>
                  This is an{" "}
                  <strong style={{ color: theme.accent2 }}>example</strong> —
                  hit{" "}
                  <strong style={{ color: theme.textBright }}>▶ Play</strong> to
                  hear it, or describe your own vibe above.
                </span>
              </div>
            )}
            <div style={S.resultLabel}>
              {isExample ? "Example Progression" : "Generated Progression"}
            </div>
            <div style={S.resultTitle}>{result.title}</div>
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 24,
                alignItems: "center",
              }}
            >
              {[
                `♩ ${result.bpm} BPM`,
                result.key,
                result.timeSignature,
                result.genre,
              ].map((t, i) => (
                <span key={i} style={S.metaTag}>
                  {t}
                </span>
              ))}
              {result.style && (
                <span style={S.grooveBadge}>♫ {result.style} groove</span>
              )}
            </div>

            {/* Piano roll — the whole progression on a timeline */}
            <div style={S.pianoWrap}>
              <PianoRoll
                chords={result.chords}
                activeChord={activeChord}
                isPlaying={isPlaying}
                timingRef={rollTimingRef}
                theme={theme}
              />
            </div>

            {/* Piano keyboard — live keys as they sound */}
            <div style={S.pianoWrap}>
              <canvas
                ref={canvasRef}
                width={720}
                height={120}
                style={{ display: "block", margin: "0 auto" }}
              />
            </div>

            {/* Chord grid */}
            <div style={S.chordGrid} className="chord-grid-responsive">
              {result.chords.map((chord, i) => {
                const col =
                  functionColors[chord.function] || functionColors.other;
                const isActive = activeChord === i;
                const isMutating = mutatingSlot === i;
                return (
                  <div
                    key={i}
                    className={isActive ? "chord-card active" : "chord-card"}
                    style={{
                      background: isActive
                        ? `rgba(${col.rgb},.18)`
                        : "rgba(255,255,255,.04)",
                      borderColor: isMutating
                        ? theme.accent2
                        : isActive
                        ? col.hex
                        : "rgba(255,255,255,.08)",
                      position: "relative",
                    }}
                  >
                    {/* Mini action buttons in top corners */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchMutations(i);
                      }}
                      title="Try alternatives for this chord"
                      style={S.chordActionBtn}
                    >
                      <Icon name="shuffle" size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectChord(chord.name);
                      }}
                      title={`Reject "${chord.name}" (won't be suggested again)`}
                      style={{ ...S.chordActionBtn, right: 6, left: "auto" }}
                    >
                      ✕
                    </button>

                    <div
                      onClick={() => previewChord(chord)}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          letterSpacing: 2,
                          marginBottom: 8,
                          color: col.hex,
                        }}
                      >
                        {chord.romanNumeral}
                      </div>
                      <div
                        style={{
                          fontSize: "1.6rem",
                          color: "#f1f5f9",
                          marginBottom: 6,
                        }}
                      >
                        {chord.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#475569",
                          fontFamily: "monospace",
                        }}
                      >
                        {chord.function}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#334155",
                          marginTop: 6,
                          fontFamily: "monospace",
                        }}
                      >
                        {(chord.notes || []).join(" ")}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#1e293b",
                          marginTop: 4,
                          fontFamily: "monospace",
                        }}
                      >
                        tap to preview
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mutation panel — alternates for the selected chord slot */}
            {mutatingSlot >= 0 && (
              <div style={S.explorePanel}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      ...S.vcLabel,
                      marginBottom: 0,
                      color: theme.accent2,
                    }}
                  >
                    <Icon name="shuffle" size={11} /> Alternatives for chord #
                    {mutatingSlot + 1}
                  </div>
                  <button
                    onClick={() => {
                      setMutatingSlot(-1);
                      setMutations([]);
                    }}
                    style={S.tinyCloseBtn}
                  >
                    ×
                  </button>
                </div>
                {loadingMutations && (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 13,
                      padding: "12px 0",
                      textAlign: "center",
                    }}
                  >
                    Generating alternatives...
                  </div>
                )}
                {!loadingMutations && mutations.length > 0 && (
                  <div style={S.mutationsGrid}>
                    {mutations.map((m, idx) => (
                      <div key={idx} style={S.mutationCard}>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: theme.accent,
                            marginBottom: 4,
                          }}
                        >
                          {m.romanNumeral}
                        </div>
                        <div
                          style={{
                            fontSize: "1.2rem",
                            color: "#f1f5f9",
                            marginBottom: 8,
                          }}
                        >
                          {m.name}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={async () => {
                              await ensureAudio();
                              playChordTone(m.notes, 1.5, activeTone);
                            }}
                            style={S.miniBtn}
                          >
                            ▶
                          </button>
                          <button
                            onClick={() => applyMutation(m)}
                            style={{
                              ...S.miniBtn,
                              background: theme.accent,
                              color: "#fff",
                            }}
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vibe Controls */}
            <div style={S.vibeControls}>
              <div style={S.vcLabel}>
                <Icon name="sliders" size={11} /> Sound controls
              </div>
              <SliderRow
                label="TEMPO"
                value={bpm}
                min={40}
                max={200}
                onChange={setBpm}
                display={`${bpm} bpm`}
              />
              <SliderRow
                label="REVERB"
                value={reverb}
                min={0}
                max={100}
                onChange={setReverb}
                display={`${reverb}%`}
              />
              <SliderRow
                label="SUSTAIN"
                value={decay}
                min={10}
                max={100}
                onChange={setDecay}
                display={`${decay}%`}
              />
              <SliderRow
                label="ARPEGGIATE"
                value={arpeggiate}
                min={0}
                max={100}
                onChange={setArpeggiate}
                display={arpeggiate === 0 ? "off" : `${arpeggiate}%`}
              />
              <div style={S.vcRow}>
                <span style={S.vcName}>TONE</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className={
                      activeTone === "piano" ? "sound-btn active" : "sound-btn"
                    }
                    onClick={() => setActiveTone("piano")}
                  >
                    Piano
                  </button>
                  {[
                    { id: "rhodes", label: "Rhodes" },
                    { id: "pad", label: "Pad" },
                    { id: "pluck", label: "Pluck" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      className={
                        activeTone === t.id
                          ? "sound-btn active"
                          : isPro
                          ? "sound-btn"
                          : "sound-btn pro-locked"
                      }
                      onClick={() =>
                        isPro
                          ? setActiveTone(t.id)
                          : openProModal(
                              "Unlock the full sound palette",
                              "Rhodes, Pad, and Pluck tones are coming with Pro."
                            )
                      }
                    >
                      {t.label}{" "}
                      {!isPro && (
                        <Icon name="lock" size={10} style={{ opacity: 0.6 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 24,
                flexWrap: "wrap",
              }}
            >
              <button className="btn btn-primary" onClick={handlePlay}>
                {isPlaying ? "⏹ Stop" : "▶ Play"}
              </button>
              <button
                className={looping ? "btn btn-loop looping" : "btn btn-loop"}
                onClick={handleLoop}
              >
                {looping ? "⏹ Stop Loop" : "⟳ Loop"}
              </button>
              <button className="btn btn-share" onClick={openShare}>
                <Icon name="link" size={13} /> Share
              </button>
              <button className="btn btn-save" onClick={saveProject}>
                <Icon name="save" size={13} /> Save
              </button>
              <button className="btn btn-record" onClick={exportAudio}>
                <Icon name="download" size={13} /> Export Audio
              </button>
              <button className="btn btn-secondary" onClick={exportMidi}>
                <Icon name="music" size={13} /> Export MIDI
              </button>
            </div>

            {/* Info cards */}
            <div style={S.infoGrid} className="info-grid-responsive">
              <div style={S.infoCard}>
                <div style={S.infoCardLabel}>Vibe</div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 14,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                  }}
                >
                  "{result.vibe}"
                </div>
              </div>
              <div style={S.infoCard}>
                <div style={S.infoCardLabel}>Chord Sequence</div>
                <div
                  style={{
                    color: "#f1f5f9",
                    fontSize: 18,
                    letterSpacing: 4,
                    fontFamily: "monospace",
                  }}
                >
                  {result.chords.map((c) => c.romanNumeral).join(" – ")}
                </div>
              </div>
            </div>
            <div style={{ ...S.infoCard, marginBottom: 16 }}>
              <div style={S.infoCardLabel}>Music Theory</div>
              <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
                {result.theory}
              </div>
            </div>

            {/* ── EXPLORE PANEL — Variations & Rejected ── */}
            <div style={{ ...S.explorePanel, marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    ...S.vcLabel,
                    marginBottom: 0,
                    color: theme.accent2,
                  }}
                >
                  Variations
                </div>
                <button
                  onClick={fetchVariations}
                  disabled={loadingVariations}
                  style={{
                    ...S.exploreBtn,
                    opacity: loadingVariations ? 0.5 : 1,
                  }}
                >
                  {loadingVariations ? (
                    "Generating…"
                  ) : variations.length ? (
                    <>
                      <Icon name="refresh" size={12} /> More variations
                    </>
                  ) : (
                    <>
                      <Icon name="shuffle" size={12} /> Show 4 variations
                    </>
                  )}
                </button>
              </div>

              {/* Rejected chords pills */}
              {rejected.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      letterSpacing: 2,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    NO-GO LIST · tap to un-reject
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {rejected.map((c) => (
                      <button
                        key={c}
                        onClick={() => unrejectChord(c)}
                        style={S.rejectedPill}
                      >
                        {c} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Variations grid */}
              {variations.length > 0 && (
                <div style={S.variationsGrid}>
                  {variations.map((v, idx) => (
                    <div key={idx} style={S.variationCard}>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          letterSpacing: 2,
                          color: theme.accent,
                          marginBottom: 4,
                        }}
                      >
                        VARIATION {idx + 1}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          color: "#f1f5f9",
                          fontStyle: "italic",
                          marginBottom: 6,
                        }}
                      >
                        {v.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#94a3b8",
                          fontFamily: "monospace",
                          marginBottom: 10,
                          letterSpacing: 1,
                        }}
                      >
                        {v.chords.map((c) => c.name).join(" – ")}
                      </div>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        <button
                          onClick={() => previewProgression(v)}
                          style={S.miniBtn}
                        >
                          ▶ Preview
                        </button>
                        <button
                          onClick={() => applyVariation(v)}
                          style={{
                            ...S.miniBtn,
                            background: theme.accent,
                            color: "#fff",
                          }}
                        >
                          Use this
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!variations.length && !loadingVariations && (
                <div
                  style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}
                >
                  Tap{" "}
                  <strong style={{ color: theme.accent2 }}>
                    Show 4 variations
                  </strong>{" "}
                  to get fresh takes on this vibe, use the shuffle button on a
                  chord to swap it for something unexpected, and hit ✕ on
                  chords you don't want to see again.
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div style={{ marginTop: 48 }}>
            <div style={S.historyLabel}>Recent Searches</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  className="history-item"
                  onClick={() => {
                    setResult(h.result);
                    setIsExample(false);
                    setPrompt(h.prompt);
                    if (h.result.bpm) setBpm(h.result.bpm);
                  }}
                >
                  <span>{h.prompt}</span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      letterSpacing: 2,
                      fontSize: 11,
                    }}
                  >
                    {h.result.chords.map((c) => c.name).join(" – ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* ── WHAT YOU GET ── */}
        <div style={S.wyg}>
          <div style={{ ...S.wygHeading, color: theme.textBright }}>
            What You Get
          </div>
          <div style={S.wygGrid} className="info-grid-responsive wyg-grid-responsive">
            {[
              { icon: "sliders", title: "Emotion-Based Chords", body: "Describe a vibe and get chords that match the mood." },
              { icon: "play", title: "Real Playback", body: "Hear the progression instantly before using it." },
              { icon: "download", title: "Export Ready", body: "Export MIDI/audio so you can drop it into your beat." },
            ].map((card) => (
              <div key={card.title} style={{ ...S.wygCard, borderColor: theme.panelBorder }}>
                <div style={{ ...S.wygIcon, color: theme.accent }}>
                  <Icon name={card.icon} size={22} />
                </div>
                <div style={{ ...S.wygCardTitle, color: theme.textBright }}>{card.title}</div>
                <div style={S.wygCardBody}>{card.body}</div>
              </div>
            ))}
          </div>
        </div>
        {/* ── WHY CreateyourCords ── */}
        <div style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "monospace", color: theme.accent, marginBottom: 10 }}>
            Why ChordCraft
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5, marginBottom: 48, fontFamily: "Georgia,serif", color: theme.textBright, maxWidth: 420, lineHeight: 1.15 }}>
            Built for how producers actually work.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 40 }} className="wyg-grid-responsive">
            {[
              { num: "01", title: "No login. Just open it and go.", body: "No account, no install, no \"start your free trial.\" You get 5 progressions a day for free, no strings." },
              { num: "02", title: "You describe the feeling. It finds the chords.", body: "Most tools make you know the theory first. Type \"dark 90s RnB\" and ChordCraft works out the rest." },
              { num: "03", title: "You actually learn why it works.", body: "Every progression comes with a music theory note explaining what's happening so you're not just copying chords, you're understanding them." },
            ].map((card) => (
              <div key={card.num} style={{ paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                <div style={{ fontSize: 13, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16, color: theme.accent }}>{card.num}</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, letterSpacing: -0.2, color: theme.textBright }}>{card.title}</div>
                <div style={{ fontSize: 14, color: "#8b97ab", lineHeight: 1.65, maxWidth: 240 }}>{card.body}</div>
              </div>
            ))}
          </div>
        </div>
        {/* ── WHY I MADE THIS ── */}
        <div style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontFamily: "monospace", color: theme.accent, marginBottom: 16 }}>
            Why I made this
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.7, color: theme.textBright, maxWidth: 600, fontFamily: "Georgia,serif" }}>
            More people are making music than ever, but a lot of them don't know music theory, and get stuck on what to actually play. I wanted to fix that, so ChordCraft is here to make writing music easier: describe a vibe, get chords that fit. No theory required.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slider sub-component ─────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, onChange, display }) {
  return (
    <div style={S.vcRow}>
      <span style={S.vcName}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{
          flex: 1,
          minWidth: 100,
          accentColor: "#6366f1",
          cursor: "pointer",
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: "#94a3b8",
          fontFamily: "monospace",
          width: 48,
          textAlign: "right",
        }}
      >
        {display}
      </span>
    </div>
  );
}

// ── Settings toggle sub-component ────────────────────────────────────────────
function SettingsToggle({ label, desc, on, onToggle, accent }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: "#f1f5f9" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          flexShrink: 0,
          background: on ? accent : "rgba(255,255,255,0.12)",
          position: "relative",
          transition: "background .2s",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: on ? 20 : 2,
            transition: "left .2s",
          }}
        />
      </div>
    </div>
  );
}

// ── Email capture sub-component ──────────────────────────────────────────────
function EmailCapture({ source, accent }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("#475569");
  const [btnText, setBtnText] = useState("Notify Me");

  const submit = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setStatus("Please enter a valid email");
      setStatusColor("#f87171");
      return;
    }
    try {
      const existing = JSON.parse(localStorage.getItem("emails") || "[]");
      if (!existing.some((e) => e.email === email)) {
        existing.push({ email, source, ts: Date.now() });
        localStorage.setItem("emails", JSON.stringify(existing));
      }
    } catch {}
    setStatus("✓ You're on the list! We'll be in touch.");
    setStatusColor("#10b981");
    setEmail("");
    setBtnText("✓ Subscribed");
    setTimeout(() => {
      setBtnText("Notify Me");
      setStatus("");
    }, 3000);
  };

  return (
    <div style={{ textAlign: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
        Get notified when Pro launches + new features drop
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@example.com"
          style={S.emailInput}
        />
        <button onClick={submit} style={{ ...S.emailBtn, background: accent }}>
          {btnText}
        </button>
      </div>
      <div
        style={{
          fontSize: 11,
          color: statusColor,
          marginTop: 8,
          minHeight: 14,
        }}
      >
        {status}
      </div>
    </div>
  );
}

// ── Inline styles object ─────────────────────────────────────────────────────
const S = {
  body: {
    minHeight: "100vh",
    background: "#000",
    fontFamily: "'Space Grotesk',sans-serif",
    color: "#e2e8f0",
    overflowX: "hidden",
    position: "relative",
  },
  ambient: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 60% 40% at 15% 10%, rgba(50,15,100,0.04) 0%, transparent 50%), radial-gradient(ellipse 45% 35% at 85% 85%, rgba(8,50,75,0.035) 0%, transparent 50%)",
  },
  notesBg: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    overflow: "hidden",
  },
  app: {
    position: "relative",
    zIndex: 1,
    maxWidth: 800,
    margin: "0 auto",
    padding: "48px 24px 100px",
  },
  topBar: {
    position: "absolute",
    top: 20,
    right: 24,
    display: "flex",
    gap: 10,
    alignItems: "center",
    zIndex: 5,
  },
  proBtn: {
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(167,139,250,0.25) 100%)",
    border: "1px solid rgba(167,139,250,0.5)",
    borderRadius: 24,
    color: "#e0e7ff",
    padding: "10px 22px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    boxShadow: "0 2px 12px rgba(167,139,250,0.2)",
  },
  settingsBtn: {
    position: "absolute",
    top: 20,
    left: 24,
    zIndex: 5,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "50%",
    width: 38,
    height: 38,
    color: "#94a3b8",
    fontSize: 17,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  },
  engLabel: {
    fontSize: 11,
    letterSpacing: 6,
    color: "#6366f1",
    textTransform: "uppercase",
    marginBottom: 16,
    fontFamily: "monospace",
    textAlign: "center",
  },
  h1: {
    fontSize: "clamp(1.8rem,5vw,3.2rem)",
    fontWeight: 400,
    lineHeight: 1.1,
    color: "#f1f5f9",
    letterSpacing: "-0.02em",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
    textAlign: "center",
    marginBottom: 8,
  },
  sampleStatus: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 2,
    marginBottom: 24,
    transition: "color .3s",
  },
  inputWrap: { position: "relative", marginBottom: 14 },
  textarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "18px 110px 18px 20px",
    color: "#f1f5f9",
    fontSize: 16,
    fontFamily: "'Space Grotesk',sans-serif",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  generateBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "10px 18px",
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  errorBox: {
    background: "rgba(239,68,68,.1)",
    border: "1px solid rgba(239,68,68,.2)",
    borderRadius: 10,
    padding: "14px 18px",
    color: "#fca5a5",
    marginBottom: 24,
    fontSize: 14,
  },
  resultLabel: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 4,
    color: "#6366f1",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  exampleBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(167,139,250,0.08)",
    border: "1px solid rgba(167,139,250,0.22)",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 20,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  resultTitle: {
    fontSize: "1.8rem",
    fontWeight: 400,
    color: "#f1f5f9",
    fontStyle: "italic",
    marginBottom: 8,
  },
  metaTag: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  grooveBadge: {
    fontSize: 11,
    color: "#a78bfa",
    fontFamily: "monospace",
    letterSpacing: 1,
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 12,
    padding: "3px 10px",
    textTransform: "capitalize",
  },
  pianoWrap: {
    marginBottom: 24,
    overflowX: "auto",
    background: "rgba(255,255,255,.02)",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 12,
    padding: 16,
  },
  chordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 12,
    marginBottom: 24,
  },
  vibeControls: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 20,
  },
  vcLabel: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 3,
    color: "#6366f1",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  vcRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  vcName: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    width: 76,
    flexShrink: 0,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  infoCard: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 10,
    padding: "18px 20px",
  },
  wyg: {
    marginTop: 88,
    paddingTop: 32,
    borderTop: "1px solid rgba(255,255,255,.07)",
  },
  wygKicker: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontFamily: "monospace",
    marginBottom: 10,
  },
  wygHeading: {
    fontSize: 34,
    fontWeight: 600,
    letterSpacing: -0.5,
    marginBottom: 36,
    fontFamily: "Georgia,serif",
    maxWidth: 420,
    lineHeight: 1.15,
  },
  wygGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 40,
  },
  wygItem: {
    paddingTop: 18,
    borderTop: "1px solid rgba(255,255,255,.1)",
  },
  wygNum: {
    fontSize: 13,
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 16,
    opacity: 0.9,
  },
  wygCard: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid",
    borderRadius: 12,
    padding: "22px 20px",
  },
  wygIcon: {
    marginBottom: 14,
  },
  wygCardTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  wygCardBody: {
    fontSize: 14,
    color: "#8b97ab",
    lineHeight: 1.65,
    maxWidth: 240,
  },
  chordActionBtn: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8",
    fontSize: 11,
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    zIndex: 2,
  },
  explorePanel: {
    background:
      "linear-gradient(135deg, rgba(167,139,250,0.06) 0%, rgba(99,102,241,0.03) 100%)",
    border: "1px solid rgba(167,139,250,0.18)",
    borderRadius: 12,
    padding: "18px 20px",
    marginBottom: 20,
  },
  exploreBtn: {
    background:
      "linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(99,102,241,0.25) 100%)",
    border: "1px solid rgba(167,139,250,0.4)",
    borderRadius: 20,
    color: "#e0e7ff",
    padding: "8px 16px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    whiteSpace: "nowrap",
  },
  rejectedPill: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 14,
    color: "#fca5a5",
    padding: "4px 10px",
    fontSize: 11,
    fontFamily: "monospace",
    cursor: "pointer",
  },
  variationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  variationCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "14px 14px 12px",
  },
  mutationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  mutationCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "12px 10px",
    textAlign: "center",
  },
  miniBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    color: "#cbd5e1",
    padding: "5px 10px",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    flex: 1,
  },
  tinyCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  infoCardLabel: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 3,
    color: "#6366f1",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  historyLabel: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 4,
    color: "#334155",
    textTransform: "uppercase",
    marginBottom: 14,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    background: "linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)",
    border: "1px solid",
    borderRadius: 16,
    padding: "36px 32px",
    width: "100%",
    position: "relative",
    boxShadow: "0 0 60px rgba(99,102,241,0.15)",
  },
  modalClose: {
    position: "absolute",
    top: 12,
    right: 16,
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 24,
    cursor: "pointer",
  },
  modalTitle: {
    fontSize: "1.4rem",
    fontWeight: 400,
    color: "#f1f5f9",
    fontStyle: "italic",
    marginBottom: 10,
  },
  kicker: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 4,
    color: "#6366f1",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  featureBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 20,
  },
  featureLabel: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 3,
    color: "#6366f1",
    marginBottom: 12,
  },
  featureList: { color: "#cbd5e1", fontSize: 13, lineHeight: 1.9 },
  ghostBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#94a3b8",
    padding: 12,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
  },
  primaryBtn: {
    background: "rgba(99,102,241,0.9)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: 14,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
  },
  platformBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#94a3b8",
    padding: 10,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
  },
  urlBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    wordBreak: "break-all",
    fontFamily: "monospace",
    fontSize: 12,
    color: "#94a3b8",
    maxHeight: 120,
    overflowY: "auto",
  },
  emailInput: {
    flex: 1,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#f1f5f9",
    fontSize: 14,
    fontFamily: "'Space Grotesk',sans-serif",
    outline: "none",
  },
  emailBtn: {
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "12px 18px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    whiteSpace: "nowrap",
  },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 4,
  },
  priceCard: {
    borderRadius: 12,
    padding: "20px 14px 16px",
    textAlign: "center",
    transition: "all .2s",
  },
  bestValueBadge: {
    position: "absolute",
    top: -10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#a78bfa",
    color: "#0a0a0f",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    padding: "3px 10px",
    borderRadius: 10,
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 2,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 600,
    color: "#f1f5f9",
    lineHeight: 1,
    marginBottom: 8,
  },
  priceNote: {
    fontSize: 11,
    color: "#a78bfa",
    marginBottom: 14,
    lineHeight: 1.4,
    minHeight: 28,
  },
  priceCta: {
    width: "100%",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "10px 8px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Space Grotesk',sans-serif",
    transition: "filter .15s",
  },
};

// ── Global CSS (animations + class-based hover states) ───────────────────────
  const CSS = `
html,
body,
#root {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background: #03030a;
}

body {
  overflow-x: hidden;
}

@keyframes floatNote1 { 0%{transform:translateY(0) rotate(-10deg);opacity:0} 25%{opacity:0.32} 50%{transform:translateY(-15px) rotate(0deg);opacity:0.45} 75%{opacity:0.32} 100%{transform:translateY(-30px) rotate(8deg);opacity:0} }
@keyframes floatNote2 { 0%{transform:translateY(0) rotate(15deg);opacity:0} 30%{opacity:0.28} 50%{transform:translateY(-10px) rotate(5deg);opacity:0.4} 70%{opacity:0.28} 100%{transform:translateY(-20px) rotate(-5deg);opacity:0} }
@keyframes floatNote3 { 0%{transform:translateY(0) rotate(-5deg);opacity:0} 35%{opacity:0.34} 50%{transform:translateY(-12px) rotate(3deg);opacity:0.5} 65%{opacity:0.34} 100%{transform:translateY(-25px) rotate(12deg);opacity:0} }
@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
@keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes activeGlow { 0%,100%{box-shadow:0 0 12px rgba(99,102,241,0.4)} 50%{box-shadow:0 0 28px rgba(99,102,241,0.8)} }
.note-spin { animation: pulse 1.5s ease-in-out infinite; }
.fade-in { animation: fadeIn .4s ease; }
.suggestion { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:20px; color:#94a3b8; padding:6px 14px; font-size:12px; cursor:pointer; font-family:'Space Grotesk',sans-serif; transition:all .15s; }
.suggestion:hover { background:rgba(99,102,241,.15); color:#c7d2fe; }
.chord-card { border:1px solid; border-radius:12px; padding:20px 16px; text-align:center; transition:all .2s; cursor:pointer; }
.chord-card:hover { background:rgba(255,255,255,.08) !important; transform:translateY(-2px); }
.chord-card.active { transform:translateY(-4px); animation:activeGlow .8s ease-in-out infinite; }
.sound-btn { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:20px; color:#94a3b8; padding:5px 14px; font-size:12px; cursor:pointer; font-family:'Space Grotesk',sans-serif; transition:all .15s; }
.sound-btn.active { background:rgba(99,102,241,.3); border-color:#6366f1; color:#c7d2fe; }
.sound-btn:hover { background:rgba(99,102,241,.15); color:#c7d2fe; }
.sound-btn.pro-locked { opacity:0.55; }
.sound-btn.pro-locked:hover { background:rgba(167,139,250,0.12); color:#a78bfa; opacity:0.9; }
.btn { border:none; border-radius:8px; font-size:14px; cursor:pointer; font-family:'Space Grotesk',sans-serif; transition:all .2s; padding:12px 20px; }
.btn-primary { background:rgba(99,102,241,.9); color:#fff; }
.btn-primary:hover { background:#6366f1; }
.btn-secondary { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#94a3b8; }
.btn-secondary:hover { background:rgba(255,255,255,.1); color:#f1f5f9; }
.btn-loop { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#94a3b8; }
.btn-loop.looping { background:rgba(16,185,129,.2); border:1px solid #10b981; color:#6ee7b7; }
.btn-share { background:rgba(129,140,248,.15); border:1px solid rgba(129,140,248,.4); color:#c7d2fe; }
.btn-share:hover { background:rgba(129,140,248,.25); color:#fff; }
.btn-save { background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.3); color:#6ee7b7; }
.btn-save:hover { background:rgba(16,185,129,.2); }
.btn-record { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; }
.btn-record:hover { background:rgba(239,68,68,.2); }
.history-item { background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05); border-radius:8px; padding:12px 16px; color:#64748b; font-size:13px; cursor:pointer; text-align:left; display:flex; justify-content:space-between; font-family:'Space Grotesk',sans-serif; transition:all .15s; width:100%; }
.history-item:hover { background:rgba(255,255,255,.05); }
textarea::placeholder { color:#475569; }
@media(max-width:540px){
  .chord-grid-responsive { grid-template-columns:repeat(2,1fr) !important; }
  .info-grid-responsive { grid-template-columns:1fr !important; }
  .wyg-grid-responsive { grid-template-columns:1fr !important; }
  .pricing-grid-responsive { grid-template-columns:1fr !important; }
}
`;
