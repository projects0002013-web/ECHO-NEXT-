# Validation — 2026-11-15

These results describe commit-ready source in the managed Linux environment. They do not establish GitHub Actions, GitHub Pages, physical-device behavior or audible neural quality.

| Check                              | Result                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Strict TypeScript                  | Passed                                                 |
| Unit tests                         | 76 passed across 7 files; 0 failed or skipped          |
| Dependency audit                   | `npm audit --audit-level=moderate`: 0 vulnerabilities  |
| Production build at `/`            | Passed                                                 |
| Production build at `/ECHO-NEXT-/` | Passed                                                 |
| Playwright at `/`                  | 14 passed; 0 failed or skipped on the final full rerun |
| Playwright at `/ECHO-NEXT-/`       | 14 passed; 0 failed or skipped                         |
| Android `assembleDebug`            | Passed with JDK 21 and Android SDK 35                  |
| Android `lintDebug`                | Passed; 0 errors, 14 reported warnings                 |
| APK signature verification         | Passed with the debug v2 signer                        |

Both final browser suites passed without retries. They cover the ordinary root path and the GitHub Pages `/ECHO-NEXT-/` prefix separately.

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`, 20,258,437 bytes. Package `app.echo.communication`, version name `1.1.0`, version code `4`, minimum API 26, target/compile API 35. APK Signature Scheme v2 verification passed with the Android debug certificate. SHA-256: `6439dcbe400122bf97307267585b42b6cf3611d6da9dfc68b7ea1fe58fd884ab`.

Automated browser scenarios cover responsive screens, phrase/category CRUD, IndexedDB persistence, settings, high contrast, backup, synthetic microphone capture, consented sample import/quality checking, routes, accessibility and production shell caching. Unit tests cover state validation and legacy defaults, explicit neural fallback behavior, Russian and Belarusian routing, preferences, model-cache inventory, targeted integrity repair, local-only cache misses, long neural text chunks, empty-output rejection, real-metric persistence, cancellation, partial/full ONNX-session release and voice-sample quality thresholds.

## Not verified

- Loading the real Kokoro or Supertonic weights in this environment, audible output, pronunciation, generation latency and peak memory. Hugging Face access is unavailable from the current network policy.
- Real Android microphone capture, permission denial/regrant, audible native/neural TTS, offline model restore, audio focus, Bluetooth/headset routing, lifecycle, TalkBack, thermal behavior and OEM compatibility. No Android device is connected.
- GitHub Actions artifacts are commit-specific. PR run `43686280652` was independently read from the public GitHub run page and succeeded for the earlier `79e2ae8` head; completion commits require their own green run before merge.
- Production signing, Play Store submission, iOS, encrypted application storage and cloud sync.
