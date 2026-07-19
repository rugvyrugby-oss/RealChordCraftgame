# VoxMorph — Voice Character Transformer for Ableton Live

VoxMorph is a real-time voice changer audio plugin (VST3 / AU) you load as an
audio effect on a vocal track in Ableton Live. It reshapes the *character* of
your voice — pitch, formants (vocal-tract size), texture, and space — so you
can morph your vocal toward completely different vocal styles: airy late-night
R&B falsetto, deep indie baritone, cinematic trailer voice, robot, whisper,
and more.

## What it is — and what it is not

VoxMorph transforms **your** voice. It does **not** clone or imitate the voice
of a specific real person (The Weeknd, Gotye, or anyone else). Cloning a real
artist's voice requires AI models trained on their recordings, and doing that
without the artist's consent raises serious legal (right of publicity) and
ethical problems — and most distributors/labels will reject music made that
way. If you want genuine AI timbre transfer, use services where artists have
*licensed* their voices, or train a model on your own voice.

What VoxMorph gives you instead is the same toolkit real vocal chains use to
get *toward* those aesthetics with your own performance:

| Preset | Inspired by the vibe of... | What it does |
|---|---|---|
| Late Night R&B | dark, airy 80s-tinged R&B (Weeknd-esque production) | brighter formants, air boost, stereo doubler, light drive |
| Silky Falsetto | high, feathery pop-R&B falsetto | +3 st pitch, brighter formants, lush doubling |
| Indie Baritone | intimate indie/alt baritone (Gotye-esque verses) | darker formants, warmth, tape-ish drive |
| Cinematic Deep | movie-trailer / spoken-word gravitas | -5 st pitch, much bigger "vocal tract" |
| Bright Pop Lead | modern chart pop lead | presence, air, wide doubling |
| Radio DJ | late-night FM announcer | slight down-pitch, big warmth, compression-style drive |
| Chipmunk / Monster / Robot / Whisper Ghost | classic FX | the fun stuff |

The two knobs that matter most:

- **Pitch** — shifts the note you sing (formants stay put, so it still sounds
  like a human, not a chipmunk).
- **Formant** — shifts the resonances of your vocal tract without changing the
  note. Down = bigger/darker person, up = smaller/brighter person. This is the
  "whose voice is this?" knob.

## Signal path

```
input ──► STFT pitch/formant shifter ──► warmth shelf (250 Hz)
      ──► air shelf (9 kHz) ──► saturation ──► stereo doubler
      ──► dry/wet mix (latency-aligned) ──► output gain
```

The shifter is a phase vocoder with cepstral spectral-envelope separation:
each frame's spectral envelope (your formants) is estimated and re-applied
independently of the pitch-shifted excitation. FFT window is 1024 samples at
44.1/48 kHz (2048 above 50 kHz), 75% overlap. Latency is 768 samples
(~17 ms @ 44.1 kHz) and is reported to the host, so Ableton's automatic
plugin-delay compensation keeps everything aligned in playback.

Modes: **Natural** (phase-vocoder), **Robot** (zeroed phases → monotone
android), **Whisper** (randomized phases → breathy ghost).

## Getting the plugin

### Option A: download a prebuilt plugin (no compiler needed)

Every push that touches `ableton-voice-changer/` makes GitHub build the
plugin automatically for macOS and Windows:

1. On GitHub, open the repo's **Actions** tab → **Build VoxMorph plugin** →
   click the latest green run.
2. Under **Artifacts**, download **VoxMorph-macOS** or **VoxMorph-Windows**
   and unzip it.
3. Copy the plugin to your plugin folder:
   - **Windows**: copy the `VoxMorph.vst3` folder to
     `C:\Program Files\Common Files\VST3\`
   - **macOS**: copy `VoxMorph.vst3` to `~/Library/Audio/Plug-Ins/VST3/`
     (and/or `VoxMorph.component` to `~/Library/Audio/Plug-Ins/Components/`).
     Because the download isn't Apple-notarized, clear the quarantine flag
     once, in Terminal:
     `xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/VoxMorph.vst3`

### Option B: build it yourself

You need [CMake ≥ 3.22](https://cmake.org) and a C++17 compiler. The first
configure downloads [JUCE 8](https://juce.com) automatically (GPLv3 for
open-source projects like this one).

### macOS (Apple Silicon or Intel)

```bash
xcode-select --install        # once, if you don't have the command line tools
cd ableton-voice-changer
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

The build auto-copies **VoxMorph.vst3** to `~/Library/Audio/Plug-Ins/VST3/`
and **VoxMorph.component** (AU) to `~/Library/Audio/Plug-Ins/Components/`.

### Windows

Install Visual Studio 2022 (Community is fine, include "Desktop development
with C++") and CMake, then in a "x64 Native Tools" prompt:

```bat
cd ableton-voice-changer
cmake -B build
cmake --build build --config Release
```

If the post-build copy step needs admin rights, manually copy
`build\VoxMorph_artefacts\Release\VST3\VoxMorph.vst3` to
`C:\Program Files\Common Files\VST3\`.

### Linux

```bash
sudo apt install cmake g++ libasound2-dev libx11-dev libxext-dev \
    libxrandr-dev libxinerama-dev libxcursor-dev libfreetype6-dev \
    libfontconfig1-dev libcurl4-openssl-dev
cd ableton-voice-changer
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

## Using it in Ableton Live

1. Live 10.1 or newer (VST3 support). On macOS you can use the AU instead.
2. `Preferences → Plug-Ins` → turn on **Use VST3 Plug-In System Folders** →
   **Rescan**.
3. In the Browser under *Plug-Ins*, find **VoxMorph** and drag it onto your
   vocal track (audio effect, after your gate/EQ, before reverb/delay).
4. Pick a preset, then ride **Formant** and **Pitch** to taste.
5. For live monitoring: set your audio buffer to 128 samples or less
   (`Preferences → Audio`). VoxMorph itself adds ~17 ms (reported to Live, so
   recorded takes line up automatically).

### Getting closer to a specific style

- **Weeknd-ish**: sing in falsetto yourself, use *Late Night R&B* or *Silky
  Falsetto*, then add Ableton's own **Reverb** (large hall, ~20% wet) and a
  pitch-correction plugin (hard-tuned) in front of VoxMorph.
- **Gotye-ish**: *Indie Baritone*, sing softly and close to the mic, add
  short plate reverb and a touch of chorus.

## Running the DSP tests

The DSP core is dependency-free and unit-tested (FFT correctness, pitch-shift
accuracy, formant independence, stability at extreme settings):

```bash
cd ableton-voice-changer/tests
g++ -O2 -std=c++17 -I../dsp dsp_tests.cpp -o dsp_tests
./dsp_tests
```

## Project layout

```
ableton-voice-changer/
├── CMakeLists.txt        JUCE plugin build (VST3 + AU + Standalone)
├── dsp/VoxMorphDSP.h     dependency-free DSP core (FFT, shifter, FX chain)
├── plugin/               JUCE wrapper: processor, editor, presets
└── tests/dsp_tests.cpp   standalone test harness for the DSP core
```
