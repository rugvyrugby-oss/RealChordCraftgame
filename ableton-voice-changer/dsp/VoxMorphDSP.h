// VoxMorph DSP core — real-time voice transformation.
//
// Dependency-free C++17. Used both by the JUCE plugin (plugin/) and by the
// standalone test harness (tests/), so it must not include any JUCE headers.
//
// Signal path (mono analysis, stereo output):
//   input -> [STFT pitch/formant shifter] -> warmth shelf -> air shelf
//         -> saturation -> doubler (stereo) -> dry/wet mix -> output gain
//
// The shifter is a phase vocoder with cepstral spectral-envelope separation:
// the spectral envelope (vocal-tract resonances / formants) is estimated per
// frame and shifted independently of the pitch of the excitation, which is
// what changes the perceived "size" and character of a voice rather than
// just chipmunking it.

#pragma once

#include <algorithm>
#include <cmath>
#include <complex>
#include <cstdint>
#include <cstring>
#include <vector>

namespace voxmorph {

constexpr float kPi    = 3.14159265358979323846f;
constexpr float kTwoPi = 6.28318530717958647692f;

inline float principalArgument(float x)
{
    return x - kTwoPi * std::round(x / kTwoPi);
}

inline float semitonesToRatio(float semitones)
{
    return std::pow(2.0f, semitones / 12.0f);
}

inline float decibelsToGain(float dB)
{
    return std::pow(10.0f, dB / 20.0f);
}

//==============================================================================
// Iterative radix-2 complex FFT. Forward is unscaled, inverse scales by 1/N,
// so inverse(forward(x)) == x.
class FFT
{
public:
    explicit FFT(int order = 10) { setOrder(order); }

    void setOrder(int order)
    {
        order_ = order;
        size_  = 1 << order;
        bitrev_.resize((size_t) size_);
        for (int i = 0; i < size_; ++i)
        {
            int r = 0, v = i;
            for (int b = 0; b < order_; ++b) { r = (r << 1) | (v & 1); v >>= 1; }
            bitrev_[(size_t) i] = r;
        }
        twiddles_.resize((size_t) size_ / 2);
        for (int i = 0; i < size_ / 2; ++i)
        {
            const double a = -2.0 * 3.14159265358979323846 * i / size_;
            twiddles_[(size_t) i] = { (float) std::cos(a), (float) std::sin(a) };
        }
    }

    int size() const { return size_; }

    void forward(std::complex<float>* data) const { transform(data); }

    void inverse(std::complex<float>* data) const
    {
        for (int i = 0; i < size_; ++i) data[i] = std::conj(data[i]);
        transform(data);
        const float s = 1.0f / (float) size_;
        for (int i = 0; i < size_; ++i) data[i] = std::conj(data[i]) * s;
    }

private:
    void transform(std::complex<float>* d) const
    {
        for (int i = 0; i < size_; ++i)
        {
            const int j = bitrev_[(size_t) i];
            if (j > i) std::swap(d[i], d[j]);
        }
        for (int len = 2; len <= size_; len <<= 1)
        {
            const int half = len >> 1;
            const int step = size_ / len;
            for (int i = 0; i < size_; i += len)
                for (int j = 0; j < half; ++j)
                {
                    const auto w = twiddles_[(size_t) (j * step)];
                    const auto u = d[i + j];
                    const auto t = d[i + j + half] * w;
                    d[i + j]        = u + t;
                    d[i + j + half] = u - t;
                }
        }
    }

    int order_ = 0, size_ = 0;
    std::vector<std::complex<float>> twiddles_;
    std::vector<int> bitrev_;
};

//==============================================================================
// STFT pitch + formant shifter (phase vocoder, cepstral envelope separation).
class SpectralVoiceShifter
{
public:
    enum PhaseMode { Natural = 0, Robot = 1, Whisper = 2 };

    void prepare(double sampleRate)
    {
        sampleRate_ = sampleRate;
        // Larger window above ~50 kHz keeps the analysis window ~21 ms.
        fftOrder_ = sampleRate > 50000.0 ? 11 : 10;
        fftSize_  = 1 << fftOrder_;
        halfSize_ = fftSize_ / 2;
        hopSize_  = fftSize_ / 4;
        fft_.setOrder(fftOrder_);

        window_.resize((size_t) fftSize_);
        for (int n = 0; n < fftSize_; ++n)
            window_[(size_t) n] = 0.5f - 0.5f * std::cos(kTwoPi * (float) n / (float) fftSize_);

        // Hann analysis * Hann synthesis overlapped at fftSize/4 sums to 1.5.
        overlapGain_ = 1.0f / 1.5f;

        // Cepstral lifter cutoff ~1.2 ms: below the shortest plausible vocal
        // pitch period, so harmonics stay out of the envelope estimate.
        cepstralCutoff_ = std::max(16, std::min(halfSize_ - 1, (int) (sampleRate * 0.0012)));

        inFifo_.assign((size_t) fftSize_, 0.0f);
        outFifo_.assign((size_t) fftSize_, 0.0f);
        outputAccum_.assign((size_t) fftSize_, 0.0f);
        fftBuf_.assign((size_t) fftSize_, {});
        cepBuf_.assign((size_t) fftSize_, {});
        mag_.assign((size_t) (halfSize_ + 1), 0.0f);
        envLog_.assign((size_t) (halfSize_ + 1), 0.0f);
        excitation_.assign((size_t) (halfSize_ + 1), 0.0f);
        freqBin_.assign((size_t) (halfSize_ + 1), 0.0f);
        synthMag_.assign((size_t) (halfSize_ + 1), 0.0f);
        synthFreq_.assign((size_t) (halfSize_ + 1), 0.0f);
        lastPhase_.assign((size_t) (halfSize_ + 1), 0.0f);
        sumPhase_.assign((size_t) (halfSize_ + 1), 0.0);
        reset();
    }

    void reset()
    {
        std::fill(inFifo_.begin(), inFifo_.end(), 0.0f);
        std::fill(outFifo_.begin(), outFifo_.end(), 0.0f);
        std::fill(outputAccum_.begin(), outputAccum_.end(), 0.0f);
        std::fill(lastPhase_.begin(), lastPhase_.end(), 0.0f);
        std::fill(sumPhase_.begin(), sumPhase_.end(), 0.0);
        rover_ = latencySamples();
    }

    int latencySamples() const { return fftSize_ - hopSize_; }

    void setPitchSemitones(float st)   { pitchRatio_   = semitonesToRatio(st); }
    void setFormantSemitones(float st) { formantRatio_ = semitonesToRatio(st); }
    void setPhaseMode(int mode)        { phaseMode_    = mode; }

    // in and out may alias.
    void process(const float* in, float* out, int numSamples)
    {
        const int latency = latencySamples();
        for (int i = 0; i < numSamples; ++i)
        {
            inFifo_[(size_t) rover_] = in[i];
            out[i] = outFifo_[(size_t) (rover_ - latency)];
            ++rover_;
            if (rover_ >= fftSize_)
            {
                processFrame();
                rover_ = latency;
            }
        }
    }

private:
    void processFrame()
    {
        //--- Analysis -------------------------------------------------------
        for (int n = 0; n < fftSize_; ++n)
            fftBuf_[(size_t) n] = { inFifo_[(size_t) n] * window_[(size_t) n], 0.0f };
        fft_.forward(fftBuf_.data());

        for (int k = 0; k <= halfSize_; ++k)
            mag_[(size_t) k] = std::abs(fftBuf_[(size_t) k]);

        //--- Spectral envelope via cepstral smoothing ------------------------
        for (int k = 0; k < fftSize_; ++k)
        {
            const int idx = k <= halfSize_ ? k : fftSize_ - k;
            cepBuf_[(size_t) k] = { std::log(mag_[(size_t) idx] + 1.0e-6f), 0.0f };
        }
        fft_.inverse(cepBuf_.data());
        for (int q = cepstralCutoff_ + 1; q < fftSize_ - cepstralCutoff_; ++q)
            cepBuf_[(size_t) q] = {};
        fft_.forward(cepBuf_.data());
        for (int k = 0; k <= halfSize_; ++k)
            envLog_[(size_t) k] = cepBuf_[(size_t) k].real();

        //--- Whitened excitation + instantaneous frequency -------------------
        const float freqPerBin = kTwoPi * (float) hopSize_ / (float) fftSize_;
        for (int k = 0; k <= halfSize_; ++k)
        {
            excitation_[(size_t) k] = mag_[(size_t) k] * std::exp(-envLog_[(size_t) k]);

            const float phase    = std::arg(fftBuf_[(size_t) k]);
            const float expected = freqPerBin * (float) k;
            float delta = phase - lastPhase_[(size_t) k] - expected;
            lastPhase_[(size_t) k] = phase;
            delta = principalArgument(delta);
            freqBin_[(size_t) k] = (float) k + delta * (float) fftSize_ / (kTwoPi * (float) hopSize_);
        }

        //--- Pitch shift: remap whitened excitation bins ----------------------
        std::fill(synthMag_.begin(), synthMag_.end(), 0.0f);
        for (int k = 0; k <= halfSize_; ++k)
            synthFreq_[(size_t) k] = (float) k * pitchRatio_;
        for (int k = 0; k <= halfSize_; ++k)
        {
            const int idx = (int) ((float) k * pitchRatio_ + 0.5f);
            if (idx >= 0 && idx <= halfSize_)
            {
                synthMag_[(size_t) idx] += excitation_[(size_t) k];
                synthFreq_[(size_t) idx] = freqBin_[(size_t) k] * pitchRatio_;
            }
        }

        //--- Re-apply formant-shifted envelope + synthesis phases -------------
        for (int k = 0; k <= halfSize_; ++k)
        {
            const float srcPos = (float) k / formantRatio_;
            const int   i0     = std::min((int) srcPos, halfSize_);
            const int   i1     = std::min(i0 + 1, halfSize_);
            const float frac   = std::min(srcPos - (float) i0, 1.0f);
            const float envL   = envLog_[(size_t) i0] + frac * (envLog_[(size_t) i1] - envLog_[(size_t) i0]);

            const float m = synthMag_[(size_t) k] * std::exp(envL);

            float phase;
            if (phaseMode_ == Robot)
            {
                phase = 0.0f;
            }
            else if (phaseMode_ == Whisper)
            {
                phase = nextRandom() * kTwoPi - kPi;
            }
            else
            {
                sumPhase_[(size_t) k] += (double) (freqPerBin * synthFreq_[(size_t) k]);
                sumPhase_[(size_t) k] = (double) principalArgument((float) sumPhase_[(size_t) k]);
                phase = (float) sumPhase_[(size_t) k];
            }

            if (k == 0 || k == halfSize_)
                fftBuf_[(size_t) k] = { m, 0.0f };
            else
                fftBuf_[(size_t) k] = std::polar(m, phase);
        }
        for (int k = halfSize_ + 1; k < fftSize_; ++k)
            fftBuf_[(size_t) k] = std::conj(fftBuf_[(size_t) (fftSize_ - k)]);

        //--- Overlap-add ------------------------------------------------------
        fft_.inverse(fftBuf_.data());
        for (int n = 0; n < fftSize_; ++n)
            outputAccum_[(size_t) n] += fftBuf_[(size_t) n].real() * window_[(size_t) n] * overlapGain_;

        std::memcpy(outFifo_.data(), outputAccum_.data(), (size_t) hopSize_ * sizeof(float));
        std::memmove(outputAccum_.data(), outputAccum_.data() + hopSize_,
                     (size_t) (fftSize_ - hopSize_) * sizeof(float));
        std::memset(outputAccum_.data() + (fftSize_ - hopSize_), 0,
                    (size_t) hopSize_ * sizeof(float));
        std::memmove(inFifo_.data(), inFifo_.data() + hopSize_,
                     (size_t) (fftSize_ - hopSize_) * sizeof(float));
    }

    float nextRandom() // uniform [0, 1)
    {
        rngState_ ^= rngState_ << 13;
        rngState_ ^= rngState_ >> 17;
        rngState_ ^= rngState_ << 5;
        return (float) (rngState_ >> 8) * (1.0f / 16777216.0f);
    }

    double sampleRate_ = 44100.0;
    int fftOrder_ = 10, fftSize_ = 1024, halfSize_ = 512, hopSize_ = 256;
    int cepstralCutoff_ = 48;
    int rover_ = 0;
    float overlapGain_ = 1.0f / 1.5f;
    float pitchRatio_ = 1.0f, formantRatio_ = 1.0f;
    int phaseMode_ = Natural;
    uint32_t rngState_ = 0x1234567u;

    FFT fft_;
    std::vector<float> window_, inFifo_, outFifo_, outputAccum_;
    std::vector<std::complex<float>> fftBuf_, cepBuf_;
    std::vector<float> mag_, envLog_, excitation_, freqBin_, synthMag_, synthFreq_, lastPhase_;
    std::vector<double> sumPhase_;
};

//==============================================================================
// RBJ biquad shelves (transposed direct form II).
struct Biquad
{
    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f, a1 = 0.0f, a2 = 0.0f;
    float z1 = 0.0f, z2 = 0.0f;

    void reset() { z1 = z2 = 0.0f; }

    float process(float x)
    {
        const float y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        return y;
    }

    void setLowShelf(double fs, double f0, double gainDb)
    {
        const double A     = std::pow(10.0, gainDb / 40.0);
        const double w0    = 2.0 * 3.14159265358979323846 * f0 / fs;
        const double cosW  = std::cos(w0);
        const double alpha = std::sin(w0) / 2.0 * std::sqrt(2.0); // S = 1
        const double sqA2a = 2.0 * std::sqrt(A) * alpha;

        const double a0 = (A + 1.0) + (A - 1.0) * cosW + sqA2a;
        b0 = (float) (A * ((A + 1.0) - (A - 1.0) * cosW + sqA2a) / a0);
        b1 = (float) (2.0 * A * ((A - 1.0) - (A + 1.0) * cosW) / a0);
        b2 = (float) (A * ((A + 1.0) - (A - 1.0) * cosW - sqA2a) / a0);
        a1 = (float) (-2.0 * ((A - 1.0) + (A + 1.0) * cosW) / a0);
        a2 = (float) (((A + 1.0) + (A - 1.0) * cosW - sqA2a) / a0);
    }

    void setHighShelf(double fs, double f0, double gainDb)
    {
        const double A     = std::pow(10.0, gainDb / 40.0);
        const double w0    = 2.0 * 3.14159265358979323846 * f0 / fs;
        const double cosW  = std::cos(w0);
        const double alpha = std::sin(w0) / 2.0 * std::sqrt(2.0); // S = 1
        const double sqA2a = 2.0 * std::sqrt(A) * alpha;

        const double a0 = (A + 1.0) - (A - 1.0) * cosW + sqA2a;
        b0 = (float) (A * ((A + 1.0) + (A - 1.0) * cosW + sqA2a) / a0);
        b1 = (float) (-2.0 * A * ((A - 1.0) + (A + 1.0) * cosW) / a0);
        b2 = (float) (A * ((A + 1.0) + (A - 1.0) * cosW - sqA2a) / a0);
        a1 = (float) (2.0 * ((A - 1.0) - (A + 1.0) * cosW) / a0);
        a2 = (float) (((A + 1.0) - (A - 1.0) * cosW - sqA2a) / a0);
    }
};

//==============================================================================
// Modulated short-delay doubler tap.
struct DoublerTap
{
    void prepare(double fs, float baseMs, float depthMs, float lfoHz, float lfoPhase)
    {
        fs_ = fs;
        base_  = (float) (baseMs * 0.001 * fs);
        depth_ = (float) (depthMs * 0.001 * fs);
        phaseInc_ = (float) (lfoHz / fs);
        phase_ = lfoPhase;
        buffer_.assign(8192, 0.0f);
        writePos_ = 0;
    }

    void reset()
    {
        std::fill(buffer_.begin(), buffer_.end(), 0.0f);
    }

    // Push one input sample, return the modulated delayed sample.
    float process(float x)
    {
        buffer_[(size_t) writePos_] = x;
        const int size = (int) buffer_.size();

        phase_ += phaseInc_;
        if (phase_ >= 1.0f) phase_ -= 1.0f;
        const float delay = base_ + depth_ * std::sin(kTwoPi * phase_);

        float readPos = (float) writePos_ - delay;
        while (readPos < 0.0f) readPos += (float) size;
        const int   i0   = (int) readPos;
        const int   i1   = (i0 + 1) % size;
        const float frac = readPos - (float) i0;
        const float out  = buffer_[(size_t) i0] + frac * (buffer_[(size_t) i1] - buffer_[(size_t) i0]);

        writePos_ = (writePos_ + 1) % size;
        return out;
    }

    double fs_ = 44100.0;
    float base_ = 0.0f, depth_ = 0.0f, phase_ = 0.0f, phaseInc_ = 0.0f;
    int writePos_ = 0;
    std::vector<float> buffer_;
};

//==============================================================================
struct ChainParams
{
    float pitchSemitones   = 0.0f;   // -12 .. +12
    float formantSemitones = 0.0f;   // -12 .. +12
    int   mode             = 0;      // SpectralVoiceShifter::PhaseMode
    float drive            = 0.0f;   // 0 .. 1
    float airDb            = 0.0f;   // -12 .. +12, high shelf @ 9 kHz
    float warmthDb         = 0.0f;   // -12 .. +12, low shelf @ 250 Hz
    float doubler          = 0.0f;   // 0 .. 1
    float mix              = 1.0f;   // 0 .. 1
    float outputDb         = 0.0f;   // -24 .. +12
};

// Full voice-changer chain. Analyses a mono sum, outputs stereo (or mono if
// only one channel is supplied). The dry path is delayed to stay time-aligned
// with the shifter's latency.
class VoiceChangerChain
{
public:
    void prepare(double sampleRate, int maxBlockSize)
    {
        sampleRate_ = sampleRate;
        shifter_.prepare(sampleRate);

        const int latency = shifter_.latencySamples();
        dryDelaySize_ = 1;
        while (dryDelaySize_ < latency + 1) dryDelaySize_ <<= 1;
        dryDelayL_.assign((size_t) dryDelaySize_, 0.0f);
        dryDelayR_.assign((size_t) dryDelaySize_, 0.0f);
        dryWritePos_ = 0;

        monoBuf_.assign((size_t) maxBlockSize, 0.0f);
        wetBuf_.assign((size_t) maxBlockSize, 0.0f);

        tapL_.prepare(sampleRate, 17.0f, 1.6f, 0.71f, 0.00f);
        tapR_.prepare(sampleRate, 23.0f, 1.9f, 0.93f, 0.25f);

        smoothCoeff_ = 1.0f - std::exp(-1.0f / (0.020f * (float) sampleRate));
        reset();
        setParams(params_);
        // Snap smoothed values so the first block starts at the target state.
        mixSm_ = params_.mix;
        outGainSm_ = decibelsToGain(params_.outputDb);
        doublerSm_ = params_.doubler;
        driveSm_ = params_.drive;
    }

    void reset()
    {
        shifter_.reset();
        warmth_.reset();
        air_.reset();
        tapL_.reset();
        tapR_.reset();
        std::fill(dryDelayL_.begin(), dryDelayL_.end(), 0.0f);
        std::fill(dryDelayR_.begin(), dryDelayR_.end(), 0.0f);
        dryWritePos_ = 0;
    }

    int latencySamples() const { return shifter_.latencySamples(); }

    void setParams(const ChainParams& p)
    {
        shifter_.setPitchSemitones(p.pitchSemitones);
        shifter_.setFormantSemitones(p.formantSemitones);
        shifter_.setPhaseMode(p.mode);
        if (p.airDb != params_.airDb || firstUpdate_)
            air_.setHighShelf(sampleRate_, 9000.0, p.airDb);
        if (p.warmthDb != params_.warmthDb || firstUpdate_)
            warmth_.setLowShelf(sampleRate_, 250.0, p.warmthDb);
        params_ = p;
        firstUpdate_ = false;
    }

    // right may be nullptr for mono processing. Buffers are processed in place.
    void process(float* left, float* right, int numSamples)
    {
        const int latency = latencySamples();
        const int mask    = dryDelaySize_ - 1;

        for (int i = 0; i < numSamples; ++i)
            monoBuf_[(size_t) i] = right != nullptr ? 0.5f * (left[i] + right[i]) : left[i];

        shifter_.process(monoBuf_.data(), wetBuf_.data(), numSamples);

        const float targetOutGain = decibelsToGain(params_.outputDb);

        for (int i = 0; i < numSamples; ++i)
        {
            mixSm_     += smoothCoeff_ * (params_.mix - mixSm_);
            outGainSm_ += smoothCoeff_ * (targetOutGain - outGainSm_);
            doublerSm_ += smoothCoeff_ * (params_.doubler - doublerSm_);
            driveSm_   += smoothCoeff_ * (params_.drive - driveSm_);

            float wet = wetBuf_[(size_t) i];
            wet = warmth_.process(wet);
            wet = air_.process(wet);

            if (driveSm_ > 0.0005f)
            {
                const float shaped = std::tanh(wet * (1.0f + 6.0f * driveSm_));
                wet = wet + driveSm_ * (shaped - wet);
            }

            const float dl = tapL_.process(wet);
            const float dr = tapR_.process(wet);
            const float doubleAmt = 0.7f * doublerSm_;
            const float wetL = wet + doubleAmt * dl;
            const float wetR = wet + doubleAmt * dr;

            // Time-aligned dry path.
            dryDelayL_[(size_t) dryWritePos_] = left[i];
            dryDelayR_[(size_t) dryWritePos_] = right != nullptr ? right[i] : left[i];
            const int readPos = (dryWritePos_ - latency) & mask;
            const float dryL = dryDelayL_[(size_t) readPos];
            const float dryR = dryDelayR_[(size_t) readPos];
            dryWritePos_ = (dryWritePos_ + 1) & mask;

            left[i] = (dryL + mixSm_ * (wetL - dryL)) * outGainSm_;
            if (right != nullptr)
                right[i] = (dryR + mixSm_ * (wetR - dryR)) * outGainSm_;
        }
    }

private:
    double sampleRate_ = 44100.0;
    ChainParams params_;
    bool firstUpdate_ = true;

    SpectralVoiceShifter shifter_;
    Biquad warmth_, air_;
    DoublerTap tapL_, tapR_;

    std::vector<float> monoBuf_, wetBuf_, dryDelayL_, dryDelayR_;
    int dryDelaySize_ = 0, dryWritePos_ = 0;

    float smoothCoeff_ = 0.01f;
    float mixSm_ = 1.0f, outGainSm_ = 1.0f, doublerSm_ = 0.0f, driveSm_ = 0.0f;
};

} // namespace voxmorph
