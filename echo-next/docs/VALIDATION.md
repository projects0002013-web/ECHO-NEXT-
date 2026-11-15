# Validation — 2026-11-15

These results describe commit-ready source in the managed Linux environment. They do not establish GitHub Actions, GitHub Pages, physical-device behavior or audible neural quality.

| Check | Result |
|---|---|
| Strict TypeScript | Passed |
| Unit tests | 62 passed across 5 files; 0 failed or skipped |
| Dependency audit | `npm audit --audit-level=moderate`: 0 vulnerabilities |
| Production build at `/` | Passed |
| Production build at `/ECHO-NEXT-/` | Passed |
| Playwright at `/` | 14 passed; 0 failed or skipped on the final full rerun |
| Playwright at `/ECHO-NEXT-/` | 14 passed; 0 failed or skipped |
| Android `assembleDebug` | Passed with JDK 21 and Android SDK 35 |
| Android `lintDebug` | Passed; 0 errors, 14 reported warnings |
| APK signature verification | Passed with the debug v2 signer |

The first root-path browser run had one transient failure: a newly saved phrase was absent after reload. The same complete phrase lifecycle then passed three consecutive isolated runs, and the final full 14-test root suite passed. This is recorded rather than hidden because persistence is a core function.

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`, 20,251,910 bytes. Package `app.echo.communication`, version name `1.0.1`, version code `3`, minimum API 26, target/compile API 35. SHA-256: `f721f522bacdd5a2734425962f252c69ef83111d9e29144d7ce5c8ac8ed0ac88`.

Automated browser scenarios cover responsive screens, phrase/category CRUD, IndexedDB persistence, settings, backup, synthetic microphone capture, routes, accessibility and production shell caching. Unit tests cover state validation, speech routing, language matching, preferences, model-cache inventory, integrity mismatch detection, local-only cache misses and long neural text chunks.

## Not verified

- Loading the real Kokoro or Supertonic weights in this environment, audible output, pronunciation, generation latency and peak memory. Hugging Face access is unavailable from the current network policy.
- Real Android microphone capture, permission denial/regrant, audible native/neural TTS, offline model restore, audio focus, Bluetooth/headset routing, lifecycle, TalkBack, thermal behavior and OEM compatibility. No Android device is connected.
- GitHub Actions execution, downloadable workflow APK and the deployed GitHub Pages URL. GitHub API and Pages access are unavailable from the current network policy.
- Production signing, Play Store submission, iOS, encrypted application storage and cloud sync.
