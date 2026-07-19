#pragma once

#include "PluginProcessor.h"

class VoxMorphAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit VoxMorphAudioProcessorEditor(VoxMorphAudioProcessor&);
    ~VoxMorphAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    struct Knob
    {
        juce::Slider slider;
        juce::Label label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attachment;
    };

    void addKnob(Knob& knob, const juce::String& paramID, const juce::String& text);
    void applyPreset(int index);

    VoxMorphAudioProcessor& processor;

    juce::Label titleLabel, subtitleLabel, modeLabel, presetLabel;
    juce::ComboBox presetBox, modeBox;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> modeAttachment;

    Knob pitchKnob, formantKnob, mixKnob, outputKnob;
    Knob driveKnob, warmthKnob, airKnob, doublerKnob;

    juce::LookAndFeel_V4 lookAndFeel;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VoxMorphAudioProcessorEditor)
};
