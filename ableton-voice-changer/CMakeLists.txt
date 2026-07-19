cmake_minimum_required(VERSION 3.22)

project(VoxMorph VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Fetch JUCE (https://juce.com). First configure needs internet access.
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        8.0.4
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

# CI builds disable the copy step (no DAW on the runner).
option(VOXMORPH_COPY_PLUGIN "Copy the plugin to the system plugin folder after build" ON)

set(VOXMORPH_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND VOXMORPH_FORMATS AU)
endif()

juce_add_plugin(VoxMorph
    COMPANY_NAME                "RealChordCraft"
    BUNDLE_ID                   com.realchordcraft.voxmorph
    PLUGIN_MANUFACTURER_CODE    Rccg
    PLUGIN_CODE                 Vxmp
    FORMATS                     ${VOXMORPH_FORMATS}
    PRODUCT_NAME                "VoxMorph"
    IS_SYNTH                    FALSE
    NEEDS_MIDI_INPUT            FALSE
    NEEDS_MIDI_OUTPUT           FALSE
    IS_MIDI_EFFECT              FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD     ${VOXMORPH_COPY_PLUGIN}
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT  "VoxMorph needs microphone access for standalone use."
    VST3_CATEGORIES             Fx "Pitch Shift"
    AU_MAIN_TYPE                kAudioUnitType_Effect
)

target_sources(VoxMorph PRIVATE
    plugin/PluginProcessor.cpp
    plugin/PluginEditor.cpp
)

target_include_directories(VoxMorph PRIVATE dsp)

target_compile_definitions(VoxMorph PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
)

target_link_libraries(VoxMorph
    PRIVATE
        juce::juce_audio_utils
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
