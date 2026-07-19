// Built-in voice-character presets. Names describe the vibe, not a person —
// see the README for which vocal styles inspired each one.

#pragma once

namespace voxmorph {

struct Preset
{
    const char* name;
    float pitch;      // semitones
    float formant;    // semitones
    int   mode;       // 0 natural, 1 robot, 2 whisper
    float drive;      // 0..1
    float airDb;      // dB
    float warmthDb;   // dB
    float doubler;    // 0..1
    float mix;        // 0..1
};

// clang-format off
static constexpr Preset kPresets[] = {
    { "Init (Clean)",        0.0f,  0.0f, 0, 0.00f,  0.0f, 0.0f, 0.00f, 1.0f },
    { "Late Night R&B",      0.0f,  1.5f, 0, 0.08f,  5.0f, 0.0f, 0.40f, 1.0f },
    { "Silky Falsetto",      3.0f,  2.5f, 0, 0.05f,  6.0f, 0.0f, 0.50f, 1.0f },
    { "Indie Baritone",     -2.0f, -1.5f, 0, 0.15f, -1.0f, 4.0f, 0.15f, 1.0f },
    { "Cinematic Deep",     -5.0f, -3.5f, 0, 0.20f, -2.0f, 6.0f, 0.10f, 1.0f },
    { "Bright Pop Lead",     0.0f,  1.0f, 0, 0.10f,  4.0f, 0.0f, 0.60f, 1.0f },
    { "Radio DJ",           -1.0f, -2.0f, 0, 0.25f,  2.0f, 5.0f, 0.00f, 1.0f },
    { "Chipmunk",            7.0f,  6.0f, 0, 0.00f,  3.0f, 0.0f, 0.00f, 1.0f },
    { "Monster",            -8.0f, -5.0f, 0, 0.50f,  0.0f, 3.0f, 0.20f, 1.0f },
    { "Robot",               0.0f,  0.0f, 1, 0.30f,  2.0f, 0.0f, 0.20f, 1.0f },
    { "Whisper Ghost",       0.0f,  0.0f, 2, 0.00f,  4.0f, 0.0f, 0.50f, 1.0f },
};
// clang-format on

static constexpr int kNumPresets = (int) (sizeof(kPresets) / sizeof(kPresets[0]));

} // namespace voxmorph
