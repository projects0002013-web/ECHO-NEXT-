# ECHO NEXT 1.1 — voice engine upgrade

This release candidate is prepared on `feature/echo-next-1.1-voice-engine`. It keeps all AAC data and schema 1 unchanged.

## Implemented

- Offers neural-voice setup on first use and takes the user to Voice Studio; it never starts a large download without an explicit action.
- Restores complete Kokoro and Supertonic installations from local storage on later launches and displays restoration progress.
- Reuses valid cached files. If an online integrity check finds one damaged asset, only that asset is removed and fetched again; offline restoration fails visibly instead of making a hidden request.
- Uses Supertonic for real Russian neural synthesis. English can use Kokoro or Supertonic. Belarusian is never sent through a Russian or English neural route.
- Keeps the device/system voice out of the primary Voice Studio picker. It remains an explicitly selected emergency accessibility option in Settings; automatic/neural mode no longer silently falls back to it.
- Keeps Fast (5 steps) as the default. Balanced uses 8 and Quality uses 12. ECHO stores only timings from completed, real generations on the current device and presents averages only after observations exist.
- Cancels superseded generation, serializes ONNX work, reuses voice styles, chunks long input and releases all four Supertonic inference sessions when Voice Studio is closed.
- Updates npm and Android versions to 1.1.0 (`versionCode 4`).

## Performance evidence

No neural weights could be downloaded in the managed validation environment because its network policy blocks Hugging Face. Therefore this release does **not** publish invented Fast/Balanced/Quality latency or memory numbers. The app now records real elapsed time, text length and output byte size after each successful local generation; it never turns mocked/unit timings into product claims.

Fast remains the default because it performs the fewest diffusion steps (5 versus 8/12), not because this environment measured audible quality on a target phone. Phone-specific latency, peak memory, pronunciation and quality still need a physical-device run with the real weights.

## Russian coverage

Routing, locale handling, long-input chunk bounds, cancellation and preference restoration are automated. Supertonic's published language list includes Russian. Audible pronunciation of numbers, punctuation and abbreviations is not established by these tests and must be evaluated with real speakers on target hardware.

## Belarusian model assessment

| Candidate | Belarusian | Download/size evidence | Local Android ARM64 fit | License evidence | Decision |
|---|---:|---|---|---|---|
| OmniVoice via `YauhenBichel/belarusian-tts` | Yes | Project reports about 1.2 GB | Python/PyTorch server; project reports about 60 s to create 2 s on a 16-thread CPU. No browser/Android adapter | Repository code is Apache-2.0; its FLEURS reference is CC-BY-4.0. Model redistribution still needs release review | Real language support, but too large and slow for this APK |
| Piper (`piper1-gpl`) | No released Belarusian checkpoint found | N/A: there is no candidate Belarusian model to size | Native/ONNX architecture is promising for ARM64 after a voice is trained | Engine is GPL-3.0; every future voice also needs its model-card/data license review | Best future compact architecture, not an integration today |
| XTTS-v2 / Coqui TTS | No; its published list has 16 languages including Russian, not Belarusian | No Belarusian model, so no applicable size | Python/PyTorch stack, not the current browser/WebView runtime | Coqui code and model terms require separate review; XTTS weights use the Coqui Public Model License | Rejected for Belarusian and current runtime |
| Meta MMS / fairseq | No `mms-tts-bel` checkpoint found | N/A | A hypothetical exported checkpoint would still need an Android runtime and benchmark | fairseq code is MIT; checkpoint/data terms would be model-specific | ASR/alignment language coverage must not be mistaken for Belarusian TTS |

No candidate meets all requirements today. ECHO keeps `be-BY` as an explicit emergency device-voice route and gives a clear unavailable-neural warning. It does not label Russian audio as Belarusian.

## Personal voice architecture

Personal cloning is not presented as implemented. Existing recordings are ordinary local clips. A safe future implementation is staged as:

1. Record or import an owner sample, decode it locally and reject clipping, silence and insufficient duration.
2. Capture explicit owner consent tied to a local profile; do not infer consent from owning the device.
3. Store the sample/profile locally with deletion and backup policy shown before creation.
4. Run a verified local speaker encoder and TTS adapter; never upload audio unless a separate cloud consent flow and protected backend are introduced.
5. Label generated output and allow profile/sample deletion that also clears derived embeddings.

OmniVoice and XTTS are currently too large and runtime-incompatible for a credible WebView implementation. The provider contract in `src/services/ai.ts` remains disabled until a licensed, measured ARM64 engine exists. ECHO does not disguise sample playback as cloning.

## Remaining limits

- Cache Storage remains subject to browser/Android eviction even after a persistence request.
- Supertonic's pinned weights are about 398 MiB plus voice styles and temporary working memory; the upstream repository is archived.
- No physical Android phone, audible neural output, TalkBack session, Bluetooth/audio focus, thermal behavior or OEM WebView was available in this validation environment.
- The APK is debug-signed for testing, not a production/store build.

