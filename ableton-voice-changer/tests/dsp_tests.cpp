// Standalone tests for the VoxMorph DSP core.
// Build:  g++ -O2 -std=c++17 -I../dsp dsp_tests.cpp -o dsp_tests && ./dsp_tests

#include "VoxMorphDSP.h"

#include <cstdio>
#include <random>
#include <string>
#include <vector>

using namespace voxmorph;

static int failures = 0;

static void check(bool ok, const std::string& name, const std::string& detail = {})
{
    std::printf("%s %s%s%s\n", ok ? "PASS" : "FAIL", name.c_str(),
                detail.empty() ? "" : " — ", detail.c_str());
    if (!ok) ++failures;
}

//------------------------------------------------------------------------------
// Measure the dominant frequency of a signal segment with a Hann-windowed FFT
// and parabolic peak interpolation.
static float dominantFrequencyInBand(const std::vector<float>& x, int start, int len,
                                     double fs, double fLo, double fHi)
{
    int order = 1;
    while ((1 << order) < len) ++order;
    const int n = 1 << order;

    FFT fft(order);
    std::vector<std::complex<float>> buf((size_t) n);
    for (int i = 0; i < n; ++i)
    {
        const float w = 0.5f - 0.5f * std::cos(kTwoPi * (float) i / (float) n);
        const float v = i < len ? x[(size_t) (start + i)] : 0.0f;
        buf[(size_t) i] = { v * w, 0.0f };
    }
    fft.forward(buf.data());

    const int kLo = std::max(1, (int) (fLo * n / fs));
    const int kHi = std::min(n / 2 - 1, (int) (fHi * n / fs));
    int   peak    = kLo;
    float peakMag = 0.0f;
    for (int k = kLo; k <= kHi; ++k)
    {
        const float m = std::abs(buf[(size_t) k]);
        if (m > peakMag) { peakMag = m; peak = k; }
    }
    // Parabolic interpolation on log magnitude.
    const float m0 = std::log(std::abs(buf[(size_t) (peak - 1)]) + 1e-12f);
    const float m1 = std::log(std::abs(buf[(size_t) peak]) + 1e-12f);
    const float m2 = std::log(std::abs(buf[(size_t) (peak + 1)]) + 1e-12f);
    const float denom = m0 - 2.0f * m1 + m2;
    const float d = std::abs(denom) > 1e-9f ? 0.5f * (m0 - m2) / denom : 0.0f;
    return ((float) peak + d) * (float) fs / (float) n;
}

static float dominantFrequency(const std::vector<float>& x, int start, int len, double fs)
{
    return dominantFrequencyInBand(x, start, len, fs, 0.0, fs / 2.0);
}

static float rms(const std::vector<float>& x, int start, int len)
{
    double acc = 0.0;
    for (int i = start; i < start + len; ++i) acc += (double) x[(size_t) i] * x[(size_t) i];
    return (float) std::sqrt(acc / len);
}

static bool allFinite(const std::vector<float>& x)
{
    for (float v : x)
        if (!std::isfinite(v)) return false;
    return true;
}

static std::vector<float> makeSine(double freq, double fs, int len, float amp = 0.5f)
{
    std::vector<float> v((size_t) len);
    for (int i = 0; i < len; ++i)
        v[(size_t) i] = amp * std::sin(kTwoPi * (float) (freq * i / fs));
    return v;
}

// A crude vowel-like source: sawtooth at f0 (rich harmonics, like glottal pulses).
static std::vector<float> makeSaw(double f0, double fs, int len, float amp = 0.4f)
{
    std::vector<float> v((size_t) len);
    double phase = 0.0;
    for (int i = 0; i < len; ++i)
    {
        v[(size_t) i] = amp * (float) (2.0 * phase - 1.0);
        phase += f0 / fs;
        if (phase >= 1.0) phase -= 1.0;
    }
    return v;
}

static std::vector<float> runShifter(const std::vector<float>& in, double fs,
                                     float pitchSt, float formantSt, int mode = 0)
{
    SpectralVoiceShifter s;
    s.prepare(fs);
    s.setPitchSemitones(pitchSt);
    s.setFormantSemitones(formantSt);
    s.setPhaseMode(mode);

    std::vector<float> out(in.size(), 0.0f);
    const int block = 480; // deliberately not a power of two
    for (size_t pos = 0; pos < in.size(); pos += (size_t) block)
    {
        const int n = (int) std::min((size_t) block, in.size() - pos);
        s.process(in.data() + pos, out.data() + pos, n);
    }
    return out;
}

//------------------------------------------------------------------------------
int main()
{
    const double fs = 48000.0;

    //--- FFT vs naive DFT -----------------------------------------------------
    {
        const int order = 6, n = 1 << order;
        FFT fft(order);
        std::mt19937 rng(42);
        std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

        std::vector<std::complex<float>> x((size_t) n), fast((size_t) n);
        for (auto& v : x) v = { dist(rng), dist(rng) };
        fast = x;
        fft.forward(fast.data());

        float maxErr = 0.0f;
        for (int k = 0; k < n; ++k)
        {
            std::complex<double> acc;
            for (int t = 0; t < n; ++t)
            {
                const double a = -2.0 * 3.14159265358979323846 * k * t / n;
                acc += std::complex<double>(x[(size_t) t]) * std::complex<double>(std::cos(a), std::sin(a));
            }
            maxErr = std::max(maxErr, std::abs(fast[(size_t) k] - std::complex<float>(acc)));
        }
        check(maxErr < 1e-3f, "FFT matches naive DFT", "max err " + std::to_string(maxErr));

        auto rt = x;
        fft.forward(rt.data());
        fft.inverse(rt.data());
        float rtErr = 0.0f;
        for (int i = 0; i < n; ++i) rtErr = std::max(rtErr, std::abs(rt[(size_t) i] - x[(size_t) i]));
        check(rtErr < 1e-4f, "FFT round-trip is identity", "max err " + std::to_string(rtErr));
    }

    const int len   = 1 << 16;      // ~1.4 s @ 48 kHz
    const int skip  = 1 << 14;      // discard latency + settle time
    const int mlen  = 1 << 14;      // measurement window

    //--- Passthrough (pitch 0, formant 0) --------------------------------------
    {
        auto in  = makeSine(440.0, fs, len);
        auto out = runShifter(in, fs, 0.0f, 0.0f);
        const float f    = dominantFrequency(out, skip, mlen, fs);
        const float gain = rms(out, skip, mlen) / rms(in, skip, mlen);
        check(allFinite(out), "Passthrough: output finite");
        check(std::abs(f - 440.0f) < 3.0f, "Passthrough: frequency preserved",
              std::to_string(f) + " Hz");
        check(gain > 0.8f && gain < 1.25f, "Passthrough: level preserved",
              "gain " + std::to_string(gain));
    }

    //--- Pitch shift +12 st (formant moves with pitch => plain resample-style) ----
    // A pure sine's spectral envelope IS its peak, so formant preservation
    // (formant = 0) would deliberately attenuate an octave-up sine. Shift the
    // envelope along with the pitch to test the pitch machinery in isolation.
    {
        auto in  = makeSine(440.0, fs, len);
        auto out = runShifter(in, fs, 12.0f, 12.0f);
        const float f = dominantFrequency(out, skip, mlen, fs);
        check(std::abs(f - 880.0f) < 8.0f, "Pitch +12 st: 440 Hz -> ~880 Hz",
              std::to_string(f) + " Hz");
    }

    //--- Voice-like pitch shift +5 st with formant preservation --------------------
    // Sawtooth at 150 Hz stands in for a voiced vowel. With the envelope held in
    // place (formant = 0), the fundamental must still move to 150 * 2^(5/12).
    {
        auto in  = makeSaw(150.0, fs, len);
        auto out = runShifter(in, fs, 5.0f, 0.0f);
        const float expected = 150.0f * semitonesToRatio(5.0f); // ~200.2 Hz
        const float f = dominantFrequencyInBand(out, skip, mlen, fs, 120.0, 320.0);
        check(std::abs(f - expected) < 8.0f,
              "Pitch +5 st, formants held: f0 150 Hz -> ~200 Hz",
              std::to_string(f) + " Hz (expected " + std::to_string(expected) + ")");
    }

    //--- Pitch shift -7 st -------------------------------------------------------
    {
        auto in  = makeSine(440.0, fs, len);
        auto out = runShifter(in, fs, -7.0f, 0.0f);
        const float expected = 440.0f * semitonesToRatio(-7.0f); // ~293.7 Hz
        const float f = dominantFrequency(out, skip, mlen, fs);
        check(std::abs(f - expected) < 6.0f, "Pitch -7 st: 440 Hz -> ~293.7 Hz",
              std::to_string(f) + " Hz");
    }

    //--- Formant shift leaves pitch unchanged -------------------------------------
    {
        auto in  = makeSaw(150.0, fs, len); // voice-like harmonic series
        auto out = runShifter(in, fs, 0.0f, 5.0f);
        const float f = dominantFrequency(out, skip, mlen, fs);
        check(allFinite(out), "Formant +5 st: output finite");
        // Dominant harmonic may move (envelope tilts), so verify periodicity via
        // the fundamental: the measured peak must sit on a 150 Hz harmonic.
        const float harmonic = f / 150.0f;
        const float offGrid  = std::abs(harmonic - std::round(harmonic));
        check(offGrid < 0.08f, "Formant +5 st: harmonics stay on 150 Hz grid",
              "peak " + std::to_string(f) + " Hz, harmonic " + std::to_string(harmonic));
        check(rms(out, skip, mlen) > 0.01f, "Formant +5 st: output not silent",
              "rms " + std::to_string(rms(out, skip, mlen)));
    }

    //--- Robot / whisper modes stay bounded ---------------------------------------
    {
        auto in = makeSaw(200.0, fs, len);
        for (int mode = 1; mode <= 2; ++mode)
        {
            auto out = runShifter(in, fs, 0.0f, 0.0f, mode);
            float peak = 0.0f;
            for (float v : out) peak = std::max(peak, std::abs(v));
            const std::string name = mode == 1 ? "Robot" : "Whisper";
            check(allFinite(out) && peak < 4.0f, name + " mode: finite and bounded",
                  "peak " + std::to_string(peak));
        }
    }

    //--- Full chain: neutral params ≈ passthrough ----------------------------------
    {
        VoiceChangerChain chain;
        chain.prepare(fs, 512);
        ChainParams p; // defaults: everything neutral, mix 1
        chain.setParams(p);

        auto inL = makeSine(440.0, fs, len);
        auto inR = inL;
        for (size_t pos = 0; pos < inL.size(); pos += 512)
        {
            const int n = (int) std::min((size_t) 512, inL.size() - pos);
            chain.process(inL.data() + pos, inR.data() + pos, n);
        }
        const float f = dominantFrequency(inL, skip, mlen, fs);
        check(allFinite(inL) && allFinite(inR), "Chain neutral: output finite");
        check(std::abs(f - 440.0f) < 3.0f, "Chain neutral: frequency preserved",
              std::to_string(f) + " Hz");
    }

    //--- Full chain: extreme settings stay bounded ----------------------------------
    {
        VoiceChangerChain chain;
        chain.prepare(fs, 512);
        ChainParams p;
        p.pitchSemitones   = -12.0f;
        p.formantSemitones = 12.0f;
        p.drive            = 1.0f;
        p.airDb            = 12.0f;
        p.warmthDb         = 12.0f;
        p.doubler          = 1.0f;
        p.mix              = 1.0f;
        p.outputDb         = 6.0f;
        chain.setParams(p);

        auto inL = makeSaw(180.0, fs, len);
        auto inR = inL;
        for (size_t pos = 0; pos < inL.size(); pos += 512)
        {
            const int n = (int) std::min((size_t) 512, inL.size() - pos);
            chain.process(inL.data() + pos, inR.data() + pos, n);
        }
        float peak = 0.0f;
        for (float v : inL) peak = std::max(peak, std::abs(v));
        check(allFinite(inL) && allFinite(inR), "Chain extreme: output finite");
        check(peak < 16.0f, "Chain extreme: bounded", "peak " + std::to_string(peak));
    }

    //--- Mono processing path ---------------------------------------------------------
    {
        VoiceChangerChain chain;
        chain.prepare(fs, 512);
        ChainParams p;
        p.pitchSemitones = 4.0f;
        chain.setParams(p);

        auto in = makeSine(300.0, fs, len);
        for (size_t pos = 0; pos < in.size(); pos += 512)
        {
            const int n = (int) std::min((size_t) 512, in.size() - pos);
            chain.process(in.data() + pos, nullptr, n);
        }
        const float expected = 300.0f * semitonesToRatio(4.0f);
        const float f = dominantFrequency(in, skip, mlen, fs);
        check(allFinite(in), "Chain mono: output finite");
        check(std::abs(f - expected) < 6.0f, "Chain mono: pitch +4 st applied",
              std::to_string(f) + " Hz (expected " + std::to_string(expected) + ")");
    }

    std::printf("\n%s (%d failure%s)\n", failures == 0 ? "ALL TESTS PASSED" : "TESTS FAILED",
                failures, failures == 1 ? "" : "s");
    return failures == 0 ? 0 : 1;
}
