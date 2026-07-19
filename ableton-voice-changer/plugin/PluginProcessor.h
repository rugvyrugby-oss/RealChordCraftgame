#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "VoxMorphDSP.h"

class VoxMorphAudioProcessor : public juce::AudioProcessor
{
public:
    VoxMorphAudioProcessor();

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "VoxMorph"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.1; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    voxmorph::VoiceChangerChain chain;

    std::atomic<float>* pitchParam    = nullptr;
    std::atomic<float>* formantParam  = nullptr;
    std::atomic<float>* modeParam     = nullptr;
    std::atomic<float>* driveParam    = nullptr;
    std::atomic<float>* airParam      = nullptr;
    std::atomic<float>* warmthParam   = nullptr;
    std::atomic<float>* doublerParam  = nullptr;
    std::atomic<float>* mixParam      = nullptr;
    std::atomic<float>* outputParam   = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VoxMorphAudioProcessor)
};
