// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// — React version
//
// External libraries — add these to your index.html <head>:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js" crossorigin="anonymous"></script>
//   <script src="https://cdn.jsdelivr.net/npm/midi-writer-js@3.1.1/build/index.browser.min.js" crossorigin="anonymous"></script>
// Then `window.Tone` and `window.MidiWriter` are available.
// (Or npm install tone midi-writer-js and import them directly.)
// ============================================================================

const DAILY_LIMIT = 10;

// ════════════════════════════════════════════════════════════════════════════
// PRICING PLANS
// To wire up real Stripe checkout: replace the `checkoutUrl` values below with
// the payment links you get from stripe.com → Products → "Get payment link"
// ════════════════════════════════════════════════════════════════════════════
const PRICING_PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: 12,
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
    badge: "🔥 Limited",
    checkoutUrl: null, // e.g. "https://buy.stripe.com/your-lifetime-link"
  },
];

const SYSTEM_PROMPT = `You are a professional music producer and chord progression generator. Respond ONLY with a JSON object, no markdown, no extra text:
{"title":"Evocative name","key":"C major","bpm":80,"timeSignature":"4/4","style":"lofi","chords":[{"name":"Cmaj7","duration":1,"notes":["C3","E4","G4","B4"],"function":"tonic","romanNumeral":"I"},{"name":"Am9","duration":1,"notes":["A2","C4","E4","G4","B4"],"function":"tonic","romanNumeral":"vi"},{"name":"Dm7","duration":1,"notes":["D3","F4","A4","C5"],"function":"subdominant","romanNumeral":"ii"},{"name":"G13","duration":1,"notes":["G2","B3","F4","A4","E5"],"function":"dominant","romanNumeral":"V"}],"vibe":"warm and nostalgic","genre":"lo-fi hip hop","theory":"Why this works."}

CRITICAL RULES FOR PROFESSIONAL SOUND:
- "style" must be ONE of: lofi, soul, cinematic, house, jazz, rnb, ambient, trap, pop. Pick the closest match to the user's request.
- Use RICH voicings, never plain triads. Add 7ths, 9ths, 11ths, 13ths. Spread notes across octaves (root low in C2-C3, color tones up in C4-C5). Example: instead of C-E-G use C3-E4-G4-B4.
- Put the root or 5th low (C2-G2 range) for warmth, stack color tones higher.
- Use inversions and voice-leading so adjacent chords share notes / move smoothly.
- Match BPM to mood (lofi 70-90, soul 75-100, cinematic 60-80, house 120-128, trap 130-150).
- Always 4 chords. Make them genuinely interesting, the kind a real producer would use, not a beginner.
- For ALL text fields (title, vibe, theory, description, anything textual): write SHORT and PLAIN. Max 2 sentences. Use real producer talk. NEVER use these words: dreamy, shimmer, warmth, characteristic, evocative, establishes, voice leading, chromatic, lush, nostalgic, atmospheric, ethereal, soulful, captivating, melancholic. Say what the chords do simply, like "Cm9 is home, Fm11 drops down a fifth, G7b9 builds back up." Casual lowercase fine.
- Titles must be 1-3 words, lowercase, no poetic stuff. Examples: "midnight drive", "rainy monday", "late jam". NOT "Whispers of the Heart" or "Ethereal Journey".
- Vibe field: 3-5 words max, plain. Example: "dark moody jazz" NOT "melancholic and introspective with jazzy tension".`;
// Groove engine. how each style performs its chords. Patterns are beat-fractions.
// Each "hit" = { t: time offset within the chord (0-1 of its duration), notes: 'all'|'low'|'high'|'roll', vel: 0-1, len: sustain mult }
const GROOVE_PATTERNS = {
  lofi: {
    swing: 0.12,
    humanize: 0.022,
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
  "lofi 80 bpm c minor",
  "big room edm drop 128",
  "90s rnb slow jam",
  " dark cinematic g minor",
  "chill study beat 75 bpm",
];

const FLOAT_NOTES = [
  {
    s: "♩",
    top: "8%",
    left: "5%",
    sz: 48,
    a: "floatNote1 9s ease-in-out infinite",
  },
  {
    s: "♪",
    top: "15%",
    left: "88%",
    sz: 36,
    a: "floatNote2 11s ease-in-out infinite 1.2s",
  },
  {
    s: "♫",
    top: "35%",
    left: "93%",
    sz: 52,
    a: "floatNote3 13s ease-in-out infinite 2.5s",
  },
  {
    s: "♬",
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
    s: "♪",
    top: "85%",
    left: "8%",
    sz: 40,
    a: "floatNote3 11.5s ease-in-out infinite 4.2s",
  },
  {
    s: "♫",
    top: "50%",
    left: "96%",
    sz: 28,
    a: "floatNote1 14s ease-in-out infinite .7s",
  },
  {
    s: "♬",
    top: "25%",
    left: "2%",
    sz: 56,
    a: "floatNote2 9.5s ease-in-out infinite 2.8s",
  },
  {
    s: "♩",
    top: "92%",
    left: "50%",
    sz: 34,
    a: "floatNote3 12.5s ease-in-out infinite 1.5s",
  },
  {
    s: "♪",
    top: "5%",
    left: "50%",
    sz: 30,
    a: "floatNote1 10.5s ease-in-out infinite 3.8s",
  },
  {
    s: "♬",
    top: "45%",
    left: "15%",
    sz: 38,
    a: "floatNote2 13.5s ease-in-out infinite 2.2s",
  },
  {
    s: "♫",
    top: "68%",
    left: "78%",
    sz: 42,
    a: "floatNote3 10.8s ease-in-out infinite 5.1s",
  },
  {
    s: "♩",
    top: "20%",
    left: "70%",
    sz: 30,
    a: "floatNote1 11.8s ease-in-out infinite 0.4s",
  },
  {
    s: "♪",
    top: "55%",
    left: "40%",
    sz: 26,
    a: "floatNote2 12.8s ease-in-out infinite 6s",
  },
  {
    s: "♬",
    top: "38%",
    left: "55%",
    sz: 34,
    a: "floatNote3 14.5s ease-in-out infinite 3.1s",
  },
];

// ── Themes ──────────────────────────────────────────────────────────────────
// Each theme defines the core palette. The app reads `theme` and threads these
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
    note: "#818cf8",
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

export default function ChordApp() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(EXAMPLE_PROGRESSION);
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
    "⏳ Loading real piano samples..."
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
  const [usageLeft, setUsageLeft] = useState(DAILY_LIMIT - getUsage());

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

  // ── Setup Tone.js instruments once ────────────────────────────────────────
  useEffect(() => {
    const Tone = window.Tone;
    if (!Tone) {
      setSampleStatus("⚠ Audio library failed to load — check connection");
      return;
    }

    const reverbNode = new Tone.Reverb({
      decay: 2.5,
      wet: 1,
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
          setSampleStatus("🎹 Piano samples ready");
          setTimeout(() => setSampleStatus(""), 2500);
        }, 100);
      },
    }).toDestination();

    const rhodes = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 3.5,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.5 },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.3,
        release: 1,
      },
    }).toDestination();
    rhodes.volume.value = -8;

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
          const rollSpread = isRoll ? i * (18 + Math.random() * 14) : 0;
         const humanDrift = isRoll ? (Math.random() - 0.5) * hum * 1000 : (chordHum || 0);
          const delay = Math.max(0, baseDelayMs + rollSpread + humanDrift);
          const vel = Math.min(
            1,
            Math.max(0.1, hit.vel * (0.85 + Math.random() * 0.3))
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
      notes.forEach((n, i) => {
        const vel = Math.min(1, 0.6 * (0.85 + Math.random() * 0.3));
        setTimeout(() => {
          try {
            sampler.triggerAttackRelease(n, durationSec, undefined, vel);
          } catch (e) {
            console.warn("Note failed:", n, e);
          }
        }, i * 16 + (Math.random() - 0.5) * 12);
      });
    },
    [reverb, getSampler]
  );

  // ── Generate progression ──────────────────────────────────────────────────
  const checkUsage = () => {
    const used = getUsage();
    if (used >= DAILY_LIMIT) return false;
    try {
      localStorage.setItem(todayKey(), used + 1);
    } catch {}
    setUsageLeft(DAILY_LIMIT - (used + 1));
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

    try {
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
      setIsExample(false);
      setLastPrompt(prompt);
      if (parsed.bpm) setBpm(parsed.bpm);
      setHistory((h) => [{ prompt, result: parsed }, ...h].slice(0, 5));
    } catch (e) {
      setError("Couldn't parse that — try a different description.");
    }
    setLoading(false);
  };

  // ── Exploration: fetch 4 alternate progressions for the same vibe ─────────
  const fetchVariations = async () => {
    if (!result || loadingVariations) return;
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
      const variationSystem = `You generate 4 ALTERNATIVE chord progressions for the same vibe. Return ONLY a JSON ARRAY of 4 objects, each in the same shape as before:
[{"title":"...","key":"...","bpm":...,"timeSignature":"4/4","style":"...","chords":[{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."},...4 chords each...],"vibe":"...","genre":"...","theory":"..."}, ... ×4]
Each variation MUST feel meaningfully different from the others — not just inversions. Vary modes, borrowed chords, substitutions, tritone subs, modal interchange. Keep the same vibe & tempo range. The user's current progression was: ${currentChords}. Make these new ones genuinely fresh alternatives. ${rejectedNote} Use rich voicings with 7ths/9ths/11ths, root low, color tones high.`;
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2500,
          system: variationSystem,
          messages: [{ role: "user", content: promptForAI }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) setVariations(parsed);
    } catch (e) {
      console.warn("Variation fetch failed:", e);
    }
    setLoadingVariations(false);
  };

  const applyVariation = (variation) => {
    setResult(variation);
    if (variation.bpm) setBpm(variation.bpm);
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
      const mutationSystem = `You generate 3 ALTERNATIVE single chords for one slot in a progression. Return ONLY a JSON ARRAY of 3 chord objects: [{"name":"...","duration":1,"notes":["..."],"function":"...","romanNumeral":"..."}, ×3]
Key: ${result.key}. Surrounding chords: ${context} — the [?] slot is what you're replacing. Original chord there was ${chord.name}. Give 3 genuinely different musical choices — try modal interchange, secondary dominants, tritone subs, chromatic neighbors. Use rich voicings. ${rejectedNote}`;
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          system: mutationSystem,
          messages: [{ role: "user", content: `Replace the [?] chord.` }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) setMutations(parsed);
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

  // ── Playback ──────────────────────────────────────────────────────────────
  const runProgression = async (loop) => {
    await ensureAudio();
    const beatDur = (60 / bpm) * 2;
    stopLoopRef.current = false;

    // Pick the groove pattern based on the AI-returned style
    const style = (result.style || "").toLowerCase();
    const groove = GROOVE_PATTERNS[style] || DEFAULT_GROOVE;

    do {
      for (let i = 0; i < result.chords.length; i++) {
        if (stopLoopRef.current) break;
        const chord = result.chords[i];
        setActiveChord(i);
        setHighlightedNotes(new Set(chord.notes));
        const chordDurSec = beatDur * (chord.duration || 1);
        // The groove engine schedules all the hits/rolls/dynamics itself
        performChord(chord.notes, chordDurSec, activeTone, groove);
        await new Promise((r) => setTimeout(r, chordDurSec * 1000));
      }
    } while (loop && !stopLoopRef.current);

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

        // Use the same groove engine for export so the WAV matches playback
        const style = (result.style || "").toLowerCase();
        const groove = GROOVE_PATTERNS[style] || DEFAULT_GROOVE;
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
              const isRoll = hit.notes === "roll";
              const noteDur = chordDurSec * hit.len * sustainMul;
              hitNotes.forEach((n, ni) => {
                const rollSpread = isRoll
                  ? ni * (0.018 + Math.random() * 0.014)
                  : 0;
                const humanDrift =
                  (Math.random() - 0.5) * (groove.humanize || 0.012);
                const vel = Math.min(
                  1,
                  Math.max(0.1, hit.vel * (0.85 + Math.random() * 0.3))
                );
                instr.triggerAttackRelease(
                  n,
                  noteDur,
                  Math.max(t, baseTime + rollSpread + humanDrift),
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
      `🎹 Check out this chord progression I made: "${result?.title}"`
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
    const groove = GROOVE_PATTERNS[style] || DEFAULT_GROOVE;
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
      <style>{CSS}</style>

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
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎹</div>
              <div style={S.kicker}>Welcome to</div>
              <h2 style={S.modalTitle}></h2>
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
                <br />✓ 10 generations per day
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
                 PRO — from $12/mo or $100 lifetime
              </div>
              <div style={S.featureList}>
                ✦ 8 & 16-bar progressions
                <br />
                ✦ All instrument tones (Rhodes, Pad, Pluck)
                <br />
                ✦ Unlimited generations
                <br />
                ✦ Bass line + melody layer
                <br />
                ✦ Save & revisit your projects
                <br />
                ✦ Export individual stems (chords, bass, melody)
                <br />
                ✦ Exclusive monthly MIDI packs
                <br />✦ Studio-quality WAV (24-bit, no watermark)
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
              <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
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
                ✦ Unlimited daily generations
                <br />
                ✦ Bass + melody layers
                <br />
                ✦ Save & revisit your projects
                <br />
                ✦ Export individual stems (chords, bass, melody)
                <br />
                ✦ Exclusive monthly MIDI packs
                <br />✦ 24-bit studio WAV exports
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
              <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
              <div style={{ ...S.kicker, color: "#f59e0b" }}>
                Daily limit reached
              </div>
              <h3 style={S.modalTitle}>
                You've used your 10 free generations today
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
              📋 Copy Link
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
            <div style={{ ...S.kicker, color: theme.accent }}>⚙ Settings</div>
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
          ⚙
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
            {usageLeft}/{DAILY_LIMIT} LEFT TODAY
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
             Pro
          </button>
        </div>

        <div style={S.engLabel}> ChordCraft </div>
        <h1 style={S.h1}>
          Describe a vibe.
          <br />
          <span style={{ color: "#818cf8", fontStyle: "Monosphere" }}>
            Hear the chords.
          </span>
        </h1>
        <p style={S.subtitle}>
        type a vibe. get chords you can drop into your beat..
          
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
                <span style={{ fontSize: 14 }}> </span>
                <span>
                  This is an{" "}
                  <strong style={{ color: theme.accent2 }}>example</strong>. 
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

            {/* Piano canvas */}
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
                      🎲
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
                    🎲 Alternatives for chord #{mutatingSlot + 1}
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
                🎛 Adjust before playing.
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
                    🎹 Piano
                  </button>
                  {[
                    { id: "rhodes", label: "🎸 Rhodes" },
                    { id: "pad", label: "🌊 Pad" },
                    { id: "pluck", label: "✨ Pluck" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      className="sound-btn pro-locked"
                      onClick={() =>
                        openProModal(
                          "Unlock the full sound palette",
                          "Rhodes, Pad, and Pluck tones are coming with Pro."
                        )
                      }
                    >
                      {t.label} <span style={{ opacity: 0.6 }}>🔒</span>
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
                🔗 Share
              </button>
              <button className="btn btn-record" onClick={exportAudio}>
                ⏺ Export Audio
              </button>
              <button className="btn btn-secondary" onClick={exportMidi}>
                🎵 Export MIDI
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
                   Explore  find unexpected directions
                </div>
                <button
                  onClick={fetchVariations}
                  disabled={loadingVariations}
                  style={{
                    ...S.exploreBtn,
                    opacity: loadingVariations ? 0.5 : 1,
                  }}
                >
                  {loadingVariations
                    ? "Generating..."
                    : variations.length
                    ? "🔄 More variations"
                    : "🎨 Show 4 variations"}
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
                    🎨 Show 4 variations
                  </strong>{" "}
                  to get fresh takes on this vibe. Or use 🎲 on a chord to swap
                  it for something unexpected. Hit ✕ on chords you don't want to
                  see again.
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
    fontFamily: 'Space Grotesk',sans-serif",
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
    fontFamily: "Georgia,serif",
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
  @keyframes floatNote1 { 0%{transform:translateY(0) rotate(-10deg);opacity:0} 25%{opacity:0.32} 50%{transform:translateY(-15px) rotate(0deg);opacity:0.45} 75%{opacity:0.32} 100%{transform:translateY(-30px) rotate(8deg);opacity:0} }
  @keyframes floatNote2 { 0%{transform:translateY(0) rotate(15deg);opacity:0} 30%{opacity:0.28} 50%{transform:translateY(-10px) rotate(5deg);opacity:0.4} 70%{opacity:0.28} 100%{transform:translateY(-20px) rotate(-5deg);opacity:0} }
  @keyframes floatNote3 { 0%{transform:translateY(0) rotate(-5deg);opacity:0} 35%{opacity:0.34} 50%{transform:translateY(-12px) rotate(3deg);opacity:0.5} 65%{opacity:0.34} 100%{transform:translateY(-25px) rotate(12deg);opacity:0} }
  @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes activeGlow { 0%,100%{box-shadow:0 0 12px rgba(99,102,241,0.4)} 50%{box-shadow:0 0 28px rgba(99,102,241,0.8)} }
  .note-spin { animation: pulse 1.5s ease-in-out infinite; }
  .fade-in { animation: fadeIn .4s ease; }
  .suggestion { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:20px; color:#94a3b8; padding:6px 14px; font-size:12px; cursor:pointer; font-family:Georgia,serif; transition:all .15s; }
  .suggestion:hover { background:rgba(99,102,241,.15); color:#c7d2fe; }
  .chord-card { border:1px solid; border-radius:12px; padding:20px 16px; text-align:center; transition:all .2s; cursor:pointer; }
  .chord-card:hover { background:rgba(255,255,255,.08) !important; transform:translateY(-2px); }
  .chord-card.active { transform:translateY(-4px); animation:activeGlow .8s ease-in-out infinite; }
  .sound-btn { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:20px; color:#94a3b8; padding:5px 14px; font-size:12px; cursor:pointer; font-family:Georgia,serif; transition:all .15s; }
  .sound-btn.active { background:rgba(99,102,241,.3); border-color:#6366f1; color:#c7d2fe; }
  .sound-btn:hover { background:rgba(99,102,241,.15); color:#c7d2fe; }
  .sound-btn.pro-locked { opacity:0.55; }
  .sound-btn.pro-locked:hover { background:rgba(167,139,250,0.12); color:#a78bfa; opacity:0.9; }
  .btn { border:none; border-radius:8px; font-size:14px; cursor:pointer; font-family:Georgia,serif; transition:all .2s; padding:12px 20px; }
  .btn-primary { background:rgba(99,102,241,.9); color:#fff; }
  .btn-primary:hover { background:#6366f1; }
  .btn-secondary { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#94a3b8; }
  .btn-secondary:hover { background:rgba(255,255,255,.1); color:#f1f5f9; }
  .btn-loop { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#94a3b8; }
  .btn-loop.looping { background:rgba(16,185,129,.2); border:1px solid #10b981; color:#6ee7b7; }
  .btn-share { background:rgba(129,140,248,.15); border:1px solid rgba(129,140,248,.4); color:#c7d2fe; }
  .btn-share:hover { background:rgba(129,140,248,.25); color:#fff; }
  .btn-record { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; }
  .btn-record:hover { background:rgba(239,68,68,.2); }
  .history-item { background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05); border-radius:8px; padding:12px 16px; color:#64748b; font-size:13px; cursor:pointer; text-align:left; display:flex; justify-content:space-between; font-family:Georgia,serif; transition:all .15s; width:100%; }
  .history-item:hover { background:rgba(255,255,255,.05); }
  textarea::placeholder { color:#475569; }
  @media(max-width:540px){
    .chord-grid-responsive { grid-template-columns:repeat(2,1fr) !important; }
    .info-grid-responsive { grid-template-columns:1fr !important; }
    .pricing-grid-responsive { grid-template-columns:1fr !important; }
  }
`;
