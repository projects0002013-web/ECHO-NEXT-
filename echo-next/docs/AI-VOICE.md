# ECHO NEXT — AI speech (experimental)

## Implemented: local neural TTS (Kokoro)

The Voice Studio contains **real on-device neural speech synthesis** using [Kokoro JS](https://github.com/hexgrad/kokoro). This is not an API mock and not prerecorded phrase playback.

- Select **Voice Studio → Load AI model** (first use requires a download and free RAM).
- Enter a short **English** phrase (max 400 characters), select one of four model voices and choose **Generate speech**.
- Output is newly generated WAV audio; playback uses an accessible native audio player.
- The model is loaded only when requested via dynamic import and q8 WASM inference. Inference occurs on the user's device. Model weights are initially obtained from the public model host; phrases and personal recordings are not uploaded for inference.
- The exact download size, startup delay and repeat-use offline behavior vary by device and cache availability. Do not claim guaranteed offline inference without first downloading and testing the model.
- Web and Android performance differ; native Android WebView speech generation has **not been device-tested**. Low-memory devices can fail to load the model. System TTS continues functioning independently.

**Important:** these are stock AI voices, **not a clone of a user's personal voice**. Russian and Kazakh must use the existing system TTS until a verified multilingual neural model is integrated. Do not pretend recording and playback equals voice cloning.

## How to verify

1. Run `npm ci && npm run typecheck && npm test && npm run build`.
2. Open the app in a Chromium browser, go to Voice Studio, click Load AI model while online.
3. Generate `Hello, this is ECHO.` in two voices; listen for distinct newly produced audio. Confirm **no microphone permission** is needed.
4. Try empty text, >400 characters, and Cyrillic; each must fail without a network generation request.
5. Turn off the connection after first successful download and verify again, documenting whether local model artifacts remain cached. Never assume caching on every device.
6. Test regular system TTS and recording to confirm unchanged functionality.
7. Separately benchmark Android before declaring offline AI support on phones.

Automated CI covers input validation, TypeScript, the browser UI and existing AAC features. **It does not execute real multi-megabyte ONNX model inference or verify audible output.**

## Future: personal voice synthesis

`src/services/ai.ts` defines the contract for a future consent-based personal voice provider. To clone a personal voice, a real verified model and explicit authorization from the speaker are necessary. Never upload someone's recording without permission. Cloud voice services require a protected backend and must never embed secret API keys in this web app. Personal voice cloning is **not implemented**.

## Previously investigated Android candidates

The project also reviewed [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) and [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for mobile inference. They need independent ARM64 benchmarks, licensing review, and explicit consent for samples before use. Existing system TTS remains the reliable fallback.
