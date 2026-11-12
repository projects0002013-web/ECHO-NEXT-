# Validation — 2026-11-12

Prepared and tested in the attached Linux cloud environment. These results describe this instance; no published snapshot or fresh-task restoration has been tested.

| Check | Result |
|---|---|
| `bash scripts/setup-cloud.sh` | Passed, including a repeat installation using `npm ci`, build, tests and Capacitor sync |
| Strict TypeScript and Vite production build | Passed; primary JavaScript approximately 346 kB / 103 kB gzip |
| `npm test` | 18 passed across database and service suites; 0 failed, 0 skipped |
| `npm run test:e2e` | 6 passed; 0 failed, 0 skipped |
| Development server functional smoke | Passed: application opened and composer accepted input |
| Android `assembleDebug` | Passed with JDK 21 and Android SDK 35; no AI model bundled |
| Android `lintDebug` | Passed with 0 errors and 13 warnings in the app report |
| `apksigner verify` | Passed for the final debug APK |
| Connected Android devices | ADB list was empty; no physical-device tests executed |

Browser scenarios cover phrase create/edit/delete, persistence after reload, favorites, category create/rename/delete, appearance and Russian language persistence, backup download and transactional restore, deletion, recorded clip capture/persistence, audio decoding into a playable media element, mobile widths, and production offline reload. Capture uses Chromium's synthetic microphone. Accessibility checks use axe WCAG A/AA tags on all five screens in light and dark themes and on a phrase dialog. They do not replace manual screen-reader or switch-control testing.

The 13 Android lint warnings concern generated resource configurations, unused Capacitor resources, splash density/duplication and a legacy backup-rule recommendation. Backup is explicitly disabled with `allowBackup=false` and `fullBackupContent=false`; API 31+ extraction rules exclude application data from cloud backup and device transfer. The lint warning is retained rather than suppressed. OEM backup behavior still needs device verification.

Final debug artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, approximately 4.3 MB. Package `app.echo.communication`, version `0.1.0`, minimum Android 8/API 26, target/compile API 35.

SHA-256: `8f7564c5458976a38dde2828db93a6db3ba55b7c489308ce181903f1553e8eb8`.

## Not verified or not implemented

- Real Android microphone capture, permission denial/regrant, audible native TTS, audio focus with other applications, Bluetooth/headset routing, background/resume and TalkBack on a physical device.
- Audible browser TTS quality; service initialization/settings/cancellation are tested with controlled browser-engine substitutes. Installed device engines determine voice/language availability.
- Personalized AI synthesis, model downloads, generated-audio cache, provider consent flow and inference performance. The provider contract and request validation exist; the UI is explicitly unavailable. See `AI-VOICE.md`.
- iOS build, release signing, store submission, encrypted application database and cloud sync.
- Manual accessibility audit and a broad Android/OEM compatibility matrix.

The prepared development environment supports web development, browser tests and real APK builds. The application is a functional foundation and requires the device/release work above before being treated as a production release.

## Reusable environment

The environment draft contains `install_script` invoking `scripts/setup-cloud.sh` and `start_skill` with activation, startup, readiness and verification instructions. No new secrets or outbound domains were needed for the working setup. Review and save the environment settings, then Publish to make its snapshot available to future tasks. Draft persistence does not publish or validate restoration. Repository changes are committed locally; they have not been pushed.
