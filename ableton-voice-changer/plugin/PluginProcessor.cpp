#include "PluginProcessor.h"

#include "PluginEditor.h"

namespace
{
juce::NormalisableRange<float> semitoneRange()
{
    return { -12.0f, 12.0f, 0.01f };
}
} // namespace

VoxMorphAudioProcessor::VoxMorphAudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withInput("Input", juce::AudioChannelSet::stereo(), true)
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "PARAMS", createParameterLayout())
{
    pitchParam   = apvts.getRawParameterValue("pitch");
    formantParam = apvts.getRawParameterValue("formant");
    modeParam    = apvts.getRawParameterValue("mode");
    driveParam   = apvts.getRawParameterValue("drive");
    airParam     = apvts.getRawParameterValue("air");
    warmthParam  = apvts.getRawParameterValue("warmth");
    doublerParam = apvts.getRawParameterValue("doubler");
    mixParam     = apvts.getRawParameterValue("mix");
    outputParam  = apvts.getRawParameterValue("output");
}

juce::AudioProcessorValueTreeState::ParameterLayout VoxMorphAudioProcessor::createParameterLayout()
{
    using P = juce::AudioParameterFloat;
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    layout.add(std::make_unique<P>(juce::ParameterID { "pitch", 1 }, "Pitch",
                                   semitoneRange(), 0.0f,
                                   juce::AudioParameterFloatAttributes().withLabel("st")));
    layout.add(std::make_unique<P>(juce::ParameterID { "formant", 1 }, "Formant",
                                   semitoneRange(), 0.0f,
                                   juce::AudioParameterFloatAttributes().withLabel("st")));
    layout.add(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID { "mode", 1 }, "Mode",
        juce::StringArray { "Natural", "Robot", "Whisper" }, 0));
    layout.add(std::make_unique<P>(juce::ParameterID { "drive", 1 }, "Drive",
                                   juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    layout.add(std::make_unique<P>(juce::ParameterID { "air", 1 }, "Air",
                                   juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f,
                                   juce::AudioParameterFloatAttributes().withLabel("dB")));
    layout.add(std::make_unique<P>(juce::ParameterID { "warmth", 1 }, "Warmth",
                                   juce::NormalisableRange<float>(-12.0f, 12.0f, 0.1f), 0.0f,
                                   juce::AudioParameterFloatAttributes().withLabel("dB")));
    layout.add(std::make_unique<P>(juce::ParameterID { "doubler", 1 }, "Doubler",
                                   juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 0.0f));
    layout.add(std::make_unique<P>(juce::ParameterID { "mix", 1 }, "Mix",
                                   juce::NormalisableRange<float>(0.0f, 1.0f, 0.001f), 1.0f));
    layout.add(std::make_unique<P>(juce::ParameterID { "output", 1 }, "Output",
                                   juce::NormalisableRange<float>(-24.0f, 12.0f, 0.1f), 0.0f,
                                   juce::AudioParameterFloatAttributes().withLabel("dB")));
    return layout;
}

void VoxMorphAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    chain.prepare(sampleRate, samplesPerBlock);
    setLatencySamples(chain.latencySamples());
}

bool VoxMorphAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto in  = layouts.getMainInputChannelSet();
    const auto out = layouts.getMainOutputChannelSet();
    if (in != out)
        return false;
    return in == juce::AudioChannelSet::mono() || in == juce::AudioChannelSet::stereo();
}

void VoxMorphAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    voxmorph::ChainParams p;
    p.pitchSemitones   = pitchParam->load();
    p.formantSemitones = formantParam->load();
    p.mode             = (int) modeParam->load();
    p.drive            = driveParam->load();
    p.airDb            = airParam->load();
    p.warmthDb         = warmthParam->load();
    p.doubler          = doublerParam->load();
    p.mix              = mixParam->load();
    p.outputDb         = outputParam->load();
    chain.setParams(p);

    float* left  = buffer.getWritePointer(0);
    float* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;
    chain.process(left, right, buffer.getNumSamples());
}

juce::AudioProcessorEditor* VoxMorphAudioProcessor::createEditor()
{
    return new VoxMorphAudioProcessorEditor(*this);
}

void VoxMorphAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary(*xml, destData);
}

void VoxMorphAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary(data, sizeInBytes))
        if (xml->hasTagName(apvts.state.getType()))
            apvts.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VoxMorphAudioProcessor();
}
