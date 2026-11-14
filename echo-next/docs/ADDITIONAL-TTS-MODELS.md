# ECHO NEXT — local TTS engines and language support

## Engines now present in the application

### Kokoro 82M (existing)
- ONNX model through `kokoro-js`, quantized q8/WASM.
- Four preset voice choices currently exposed by ECHO.
- In this integration, English only.
- Lazy model loading; existing offline behavior was verified by the project owner on their Android device.

### Supertonic 3 (new optional engine)
- Integrated through the upstream browser ONNX Runtime Web helper.
- Model revision pinned to `aafc6e32416a594460b32413efc49d7fe4ce6d46`.
- ONNX weights total about 398 MB; preset voice styles are about 2.92 MB.
- Ten presets: F1–F5 and M1–M5.
- 31 supported languages, including English, Russian and Ukrainian. Belarusian is not included.
- WebGPU is attempted first; WASM is used as a fallback.
- Assets are downloaded only after the user explicitly clicks the download/load button. The runtime caches successful CORS responses in Cache Storage so later launches can reuse them offline, subject to browser storage quota/eviction.
- Android WebView and low-memory phones require physical-device testing. Do not claim every phone can load the 398 MB model.
- The original upstream Supertonic source repository was archived on 2026-09-09; this integration pins a specific model revision and should be treated as an optional, unsupported upstream engine.

## Belarusian support

- Interface and phrase locale: `be`.
- System speech locale: `be-BY`.
- Browser and Android adapters now require a matching installed Belarusian voice when voice metadata is available. They must not deliberately select an English or Russian voice for Belarusian.
- Actual Belarusian system voice availability depends on the device's installed TTS engine and language packs.
- Neither Kokoro nor Supertonic 3 has Belarusian in the published supported-language list.

### Belarusian neural model research

The public `YauhenBichel/belarusian-tts` project currently wraps OmniVoice behind a local Python HTTP server. Its model downloads are about 1.2 GB and its README reports roughly one minute to synthesize two seconds of audio on a 16-thread CPU. This is not an appropriate default for a small offline Android app and is NOT integrated into ECHO.
- Project: https://github.com/YauhenBichel/belarusian-tts
- The same project describes a smaller Piper voice as future work, not a released ready-to-use model.
- No Belarusian Piper voice was listed in the Piper voice catalogue inspected during this work.
- Do not add a fake Belarusian neural model or silently substitute Russian. Keep the `be-BY` system-voice route until a compact, licensed, mobile-tested Belarusian model is available.

## Adaptive delivery

ECHO now offers a conservative “Adaptive pacing” option for system TTS and Supertonic. It adjusts speech rate based on sentence length and punctuation. It does not infer emotion, change a person's identity, or create a voice clone. The user can switch it off and retain the manually selected speed.

## Model storage and privacy

- No model weights are committed to Git or bundled into the APK.
- Supertonic's first download is approximately 400 MB and is user-initiated.
- Cache Storage persistence is best-effort; browser or Android WebView storage can be evicted. A fresh offline test after app restart is still required on each target device.
- Text and generated audio are processed locally by these engines. The model files themselves are downloaded from Hugging Face on first load.
- If storage is insufficient or model loading fails, existing system TTS and Kokoro remain available.

## Licensing and provenance

- Supertonic source helper: MIT, copyright Supertone Inc.; see `THIRD-PARTY-NOTICES.md`.
- Supertonic 3 weights: OpenRAIL-M; read the full model license before redistribution or product release.
- Kokoro and other dependencies retain their own upstream licenses. Review each model's model card separately before commercial distribution.
