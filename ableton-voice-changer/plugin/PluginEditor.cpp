#include "PluginEditor.h"

#include "Presets.h"

namespace
{
const juce::Colour kBackgroundTop { 0xff181624 };
const juce::Colour kBackgroundBottom { 0xff0f0e17 };
const juce::Colour kAccent { 0xff8be0c9 };
const juce::Colour kAccentDim { 0xff4a7a6d };
const juce::Colour kText { 0xffe8e6f0 };
const juce::Colour kTextDim { 0xff8d8a9e };
} // namespace

VoxMorphAudioProcessorEditor::VoxMorphAudioProcessorEditor(VoxMorphAudioProcessor& p)
    : AudioProcessorEditor(&p), processor(p)
{
    lookAndFeel.setColour(juce::Slider::rotarySliderFillColourId, kAccent);
    lookAndFeel.setColour(juce::Slider::rotarySliderOutlineColourId, juce::Colour(0xff2c2a3c));
    lookAndFeel.setColour(juce::Slider::thumbColourId, kAccent);
    lookAndFeel.setColour(juce::Slider::textBoxTextColourId, kText);
    lookAndFeel.setColour(juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    lookAndFeel.setColour(juce::ComboBox::backgroundColourId, juce::Colour(0xff232134));
    lookAndFeel.setColour(juce::ComboBox::textColourId, kText);
    lookAndFeel.setColour(juce::ComboBox::outlineColourId, kAccentDim);
    lookAndFeel.setColour(juce::ComboBox::arrowColourId, kAccent);
    lookAndFeel.setColour(juce::PopupMenu::backgroundColourId, juce::Colour(0xff232134));
    lookAndFeel.setColour(juce::PopupMenu::textColourId, kText);
    lookAndFeel.setColour(juce::PopupMenu::highlightedBackgroundColourId, kAccentDim);
    setLookAndFeel(&lookAndFeel);

    titleLabel.setText("VOXMORPH", juce::dontSendNotification);
    titleLabel.setFont(juce::FontOptions(26.0f, juce::Font::bold));
    titleLabel.setColour(juce::Label::textColourId, kAccent);
    addAndMakeVisible(titleLabel);

    subtitleLabel.setText("voice character transformer", juce::dontSendNotification);
    subtitleLabel.setFont(juce::FontOptions(13.0f));
    subtitleLabel.setColour(juce::Label::textColourId, kTextDim);
    addAndMakeVisible(subtitleLabel);

    presetLabel.setText("PRESET", juce::dontSendNotification);
    presetLabel.setFont(juce::FontOptions(11.0f, juce::Font::bold));
    presetLabel.setColour(juce::Label::textColourId, kTextDim);
    addAndMakeVisible(presetLabel);

    for (int i = 0; i < voxmorph::kNumPresets; ++i)
        presetBox.addItem(voxmorph::kPresets[i].name, i + 1);
    presetBox.setTextWhenNothingSelected("Choose a preset...");
    presetBox.onChange = [this]
    {
        const int idx = presetBox.getSelectedId() - 1;
        if (idx >= 0)
            applyPreset(idx);
    };
    addAndMakeVisible(presetBox);

    modeLabel.setText("MODE", juce::dontSendNotification);
    modeLabel.setFont(juce::FontOptions(11.0f, juce::Font::bold));
    modeLabel.setColour(juce::Label::textColourId, kTextDim);
    addAndMakeVisible(modeLabel);

    modeBox.addItemList({ "Natural", "Robot", "Whisper" }, 1);
    addAndMakeVisible(modeBox);
    modeAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(
        processor.apvts, "mode", modeBox);

    addKnob(pitchKnob, "pitch", "PITCH");
    addKnob(formantKnob, "formant", "FORMANT");
    addKnob(mixKnob, "mix", "MIX");
    addKnob(outputKnob, "output", "OUTPUT");
    addKnob(driveKnob, "drive", "DRIVE");
    addKnob(warmthKnob, "warmth", "WARMTH");
    addKnob(airKnob, "air", "AIR");
    addKnob(doublerKnob, "doubler", "DOUBLER");

    setSize(660, 420);
}

VoxMorphAudioProcessorEditor::~VoxMorphAudioProcessorEditor()
{
    setLookAndFeel(nullptr);
}

void VoxMorphAudioProcessorEditor::addKnob(Knob& knob, const juce::String& paramID,
                                           const juce::String& text)
{
    knob.slider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    knob.slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 74, 18);
    addAndMakeVisible(knob.slider);

    knob.label.setText(text, juce::dontSendNotification);
    knob.label.setFont(juce::FontOptions(12.0f, juce::Font::bold));
    knob.label.setColour(juce::Label::textColourId, kTextDim);
    knob.label.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(knob.label);

    knob.attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        processor.apvts, paramID, knob.slider);
}

void VoxMorphAudioProcessorEditor::applyPreset(int index)
{
    const auto& preset = voxmorph::kPresets[index];

    auto setParam = [this](const juce::String& id, float value)
    {
        if (auto* param = processor.apvts.getParameter(id))
            param->setValueNotifyingHost(param->convertTo0to1(value));
    };

    setParam("pitch", preset.pitch);
    setParam("formant", preset.formant);
    setParam("mode", (float) preset.mode);
    setParam("drive", preset.drive);
    setParam("air", preset.airDb);
    setParam("warmth", preset.warmthDb);
    setParam("doubler", preset.doubler);
    setParam("mix", preset.mix);
}

void VoxMorphAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.setGradientFill(juce::ColourGradient(kBackgroundTop, 0.0f, 0.0f,
                                           kBackgroundBottom, 0.0f, (float) getHeight(), false));
    g.fillAll();

    g.setColour(juce::Colour(0xff2c2a3c));
    g.drawHorizontalLine(64, 16.0f, (float) getWidth() - 16.0f);
}

void VoxMorphAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(16);

    auto header = area.removeFromTop(48);
    titleLabel.setBounds(header.removeFromLeft(160));
    subtitleLabel.setBounds(header.removeFromLeft(200).withTrimmedTop(14));
    auto presetArea = header.removeFromRight(220);
    presetLabel.setBounds(presetArea.removeFromTop(14));
    presetBox.setBounds(presetArea.removeFromTop(28));

    area.removeFromTop(14);

    auto layoutRow = [](juce::Rectangle<int> row, Knob* knobs[4])
    {
        const int w = row.getWidth() / 4;
        for (int i = 0; i < 4; ++i)
        {
            auto cell = row.removeFromLeft(w).reduced(6, 0);
            knobs[i]->label.setBounds(cell.removeFromTop(16));
            knobs[i]->slider.setBounds(cell);
        }
    };

    Knob* row1[4] = { &pitchKnob, &formantKnob, &mixKnob, &outputKnob };
    Knob* row2[4] = { &driveKnob, &warmthKnob, &airKnob, &doublerKnob };
    layoutRow(area.removeFromTop(140), row1);
    layoutRow(area.removeFromTop(140), row2);

    auto footer = area.removeFromTop(34);
    modeLabel.setBounds(footer.removeFromLeft(46).withTrimmedTop(8));
    modeBox.setBounds(footer.removeFromLeft(140).withTrimmedTop(4).withHeight(26));
}
