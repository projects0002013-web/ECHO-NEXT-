# ECHO NEXT 1.0.1

Release candidate prepared from `main` commit `6588434b92100ee5fb1aacecd47bec1cb2051017`.

## Changes

- Restores installed Kokoro and Supertonic models only from local cache. Missing offline assets produce a repair message instead of silently starting another download.
- Records SHA-256 metadata when neural assets are cached and rejects bytes that later differ. A pre-1.0.1 cache receives a local baseline on first read so existing downloads are preserved.
- Preloads and validates all 28 Kokoro voice styles during an explicit online installation; the selected voice and engine preferences survive restart.
- Adds Supertonic Fast, Balanced and Quality modes, serialized inference, cancellation, cached style reuse, text up to 2,000 characters, bounded long-sentence chunks and elapsed-time reporting.
- Keeps Russian on Supertonic's real `ru` route. Belarusian remains `be-BY` system TTS because neither bundled neural engine publishes Belarusian support.
- Updates npm and Android versions to 1.0.1 (`versionCode 3`).

## Compatibility and limits

- The optional Supertonic download is about 398 MiB and can exceed memory or storage limits on low-end phones. Its upstream project is archived.
- Cache Storage can be evicted by the browser or Android WebView. The UI requests persistent storage where supported, but the operating system retains final control.
- Local hashes detect corruption after installation. They are not publisher signatures; provenance still relies on HTTPS and pinned model revisions.
- Real neural inference, pronunciation, latency, peak memory, microphone behavior, TalkBack and offline restart still need testing on physical target phones. No credible before/after inference timing is reported without running the actual weights.
- Personalized voice cloning, iOS, release signing, Play Store publication and cloud sync are not included.

## APK

The build produces `android/app/build/outputs/apk/debug/app-debug.apk`. It is a debug-signed test APK, not a production release. GitHub Actions uploads the same path as an artifact after a successful Android job.
