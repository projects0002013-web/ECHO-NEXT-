# ECHO NEXT — additional local TTS models and Belarusian

## Current production path

- Kokoro 82M (ONNX, q8 WASM) remains the tested neural voice path. It currently supports English in this app.
- Russian, Kazakh and Belarusian phrases use the Android/browser system TTS adapter when the corresponding voice is installed on the device. Availability depends on the OS voice pack; the app must show the normal unsupported-language error rather than pretend a neural model supports the language.

## Candidate engine: Supertonic 3

Official project: https://github.com/supertone-inc/supertonic
Model: https://huggingface.co/Supertone/supertonic-3
Browser setup documentation: https://supertonictts.com/installation

Verified upstream information:
- ONNX model family with browser WASM/WebGPU examples.
- Approximately 99M parameters across public ONNX assets.
- 31 explicitly supported languages: English, Korean, Japanese, Arabic, Bulgarian, Czech, Danish, German, Greek, Spanish, Estonian, Finnish, French, Hindi, Croatian, Hungarian, Indonesian, Italian, Lithuanian, Latvian, Dutch, Polish, Portuguese, Romanian, Russian, Slovak, Slovenian, Swedish, Turkish, Ukrainian and Vietnamese.
- Belarusian is NOT in its published language list.
- Model weights use the OpenRAIL-M license; review the full terms before distribution.

Status: researched candidate, NOT yet wired into ECHO's model loader. Do not show it as an installed/working option until the ONNX runtime, model assets, offline cache, mobile memory use, license notice and actual audio output have been tested.

## Belarusian

The app now accepts `be` as an interface/phrase locale and requests the standard BCP-47 speech locale `be-BY` from the device's speech engine. This is a system-TTS route, not a claim that Kokoro or Supertonic currently generate Belarusian.

- On Android, install a Belarusian voice only if the device's installed TTS engine offers one.
- In a browser, availability depends on the browser/OS speech voice list.
- If no Belarusian system voice exists, the engine may reject the request; do not silently substitute Russian.
- The official RHVoice language list currently does not list Belarusian: https://rhvoice.org/languages/

## Future Belarusian neural model evaluation

A Belarusian-specific model must be evaluated separately for:
- a verified public model card and exact supported locale;
- model and tokenizer size suitable for Android;
- an offline-capable ONNX or compatible runtime;
- license compatibility for redistribution;
- correct Belarusian orthography, stress and pronunciation;
- real-device inference and audio-quality tests.

Do not bundle a multi-gigabyte model or an unclear/non-commercial license in the Android APK. Prefer opt-in downloads stored separately from the application package.
