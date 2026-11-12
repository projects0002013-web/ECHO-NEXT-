# Personalized voice: integration decision

Status: no AI model/provider is installed or connected. No samples are uploaded. Recorded clips are ordinary playback; Android TTS is independent. `src/services/ai.ts` defines a provider contract with processing location, explicit consent, cancellation, progress and data deletion. Request validation is tested. A future integration still needs a provider adapter, consent UI, model verification, encrypted sample handling where appropriate, generation/cache persistence and deletion tests. The current UI correctly shows “Not configured”.

## Offline Android candidates reviewed on 2026-11-12

Primary sources reviewed:

- [sherpa-onnx project](https://github.com/k2-fsa/sherpa-onnx): Android targets, offline TTS and voice-cloning examples, including Pocket TTS. Its model/engine support is evidence of a possible integration path, not proof this application or a particular phone can run it.
- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts): upstream describes a CPU-oriented 100M parameter model, audio streaming, two CPU cores, and first-chunk latency around 200 ms measured in its own setup. Its approximately 6× real-time result is for a MacBook Air M4 and **must not be extrapolated to Android**. Upstream also lists smaller English models. Language and cloning capabilities must be checked for each selected variant.

A 100M parameter model requires roughly 400 MB for FP32 weights alone or 100 MB at INT8, before decoder weights, tensors, runtime and audio buffers. These are arithmetic lower bounds, not download sizes or measured peak RAM. Runtime support, quantization quality, model license, speaker/sample rights, Russian language support, thermal throttling and per-device latency remain unresolved.

Recommended next experiment: a separate arm64 Android spike using sherpa-onnx with a supported model. Download only after explicit model selection; verify hashes and licenses, store outside the APK, provide deletion, benchmark on physical low/mid/high-end devices (at least 4/6/8 GB RAM classes), record cold start, peak RSS, first audio latency, real-time factor for 20/100-word phrases, battery and 10-minute thermal behavior. Keep system TTS as the default and fallback. Do not bundle desktop Python/PyTorch/CUDA or untested large weights into the app.

No Android inference benchmark, personalized synthesis or Russian voice cloning has been verified in this task.
