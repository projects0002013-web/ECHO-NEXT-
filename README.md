# ECHO NEXT — доступное общение для каждого

**[Открыть ECHO NEXT → https://echo-next.pages.dev/](https://echo-next.pages.dev/)**

ECHO NEXT — бесплатное AAC-приложение (альтернативная и дополнительная коммуникация), которое помогает людям с трудностями устной речи выражать мысли и общаться. Подходит для использования в браузере, в том числе на телефоне.

### Возможности

- Карточки с фразами и озвучивание текста.
- Свои фразы и категории, избранное и история.
- Настройки размера текста, контраста и темы.
- Поддержка нескольких языков интерфейса.
- Локальное хранение данных и дополнительные офлайн-голоса после загрузки необходимых моделей.

**Сайт приложения:** https://echo-next.pages.dev/

**Исходный код:** https://github.com/projects0002013-web/ECHO-NEXT-

---

## Техническая документация

Modern AAC communication app with AI voice

The complete application lives in [`echo-next/`](echo-next/). Existing implementation and history are preserved.

ECHO is a local-first augmentative and alternative communication (AAC) app for browsers and Android, built with React, TypeScript, Vite, Tailwind CSS, IndexedDB and Capacitor. It includes five responsive screens, editable phrases and categories, favorites, history, system speech, voice recordings, backups, English/Russian/Belarusian UI, optional offline neural voices, themes and accessibility preferences. It runs in a browser without Android.

## Install and develop

Use Node.js 24 and npm:

```sh
cd echo-next
npm ci
npm run dev
npm run typecheck
npm test
npm run build
# Install Playwright's Chromium on a workstation/CI runner:
npx playwright install --with-deps chromium
CI=true npm run test:e2e
```

On the prepared cloud machine, browser tests use `/usr/bin/chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to override the browser path. Microphone access needs HTTPS or localhost. System voices depend on the device.

## Web deployment

[Deploy GitHub Pages](https://github.com/projects0002013-web/ECHO-NEXT-/actions/workflows/pages.yml) builds and tests the application on every push to `main`, then uploads `echo-next/dist` and deploys it using GitHub Pages. The root README is not the deployed application.

A repository administrator must set **Settings → Pages → Build and deployment → Source: GitHub Actions**. Ensure Actions are enabled and any `github-pages` environment approval rules are satisfied. Then run the Pages workflow or push to `main`.

Intended site: https://projects0002013-web.github.io/ECHO-NEXT-/ . This address is a deployment target; its existence is not a claim that deployment has succeeded. Check the workflow's deploy job and open the URL after it completes.

The workflow sets `VITE_BASE_PATH=/ECHO-NEXT-/`. HTML assets, PWA manifest, service worker registration, precache URLs and cache isolation support that prefix. Routes use fragments (for example `/ECHO-NEXT-/#library`), so reloads and shared links work on GitHub Pages without server rewrite rules. Local and Android builds use `/` by default. Do not set the Pages prefix for Capacitor builds.

To reproduce the Pages build locally:

```sh
cd echo-next
VITE_BASE_PATH=/ECHO-NEXT-/ npm run build
VITE_BASE_PATH=/ECHO-NEXT-/ npm run test:e2e
```

## Android APK from GitHub Actions

Open [CI and Android APK](https://github.com/projects0002013-web/ECHO-NEXT-/actions/workflows/ci.yml), select a successful run for the desired commit, and download **Artifacts → ECHO-debug-<full-commit-sha>**. Extract the ZIP to obtain `app-debug.apk`. Artifacts are retained for 30 days and require GitHub access to the repository. A workflow file alone does not establish that an APK artifact has been produced; confirm a successful `android` job and artifact listing.

The workflow installs Node dependencies, Temurin JDK 21, Android platform 35 and Build Tools 34/35, builds the web app, synchronizes Capacitor, runs `assembleDebug` and `lintDebug`, and uploads the actual APK with missing-file failures enabled. It runs automatically on `main` pushes and pull requests, and can be started manually through **Run workflow**. It does not use the cloud machine's absolute SDK/JDK paths.

The APK is a debug build for testing, not a signed store release. Release signing and Play Store publication are separate tasks. [Local Android instructions](echo-next/README.md#android-apk) remain available.

## CI and limitations

The CI workflow checks TypeScript, unit tests, browser scenarios and production builds for both `/` and `/ECHO-NEXT-/`, plus Android build and lint. Browser tests use synthetic microphone input and include light/dark accessibility, persistence, backup restore, offline loading and route history.

Personalized voice cloning is **not configured or implemented**. Recorded clips are ordinary playback, and system TTS remains independent. Kokoro generates English locally after an explicit model download. Supertonic 3 optionally generates its 31 published languages, including Russian, but does not support Belarusian. No samples are automatically uploaded. See [AI assessment](echo-next/docs/ADDITIONAL-TTS-MODELS.md). Physical Android recording, audible TTS, neural inference, audio routing, lifecycle and TalkBack still require device testing. iOS, cloud sync and release signing are not included.

See [application architecture and features](echo-next/README.md) and [original local validation report](echo-next/docs/VALIDATION.md). That report describes the initial implementation, not a verified GitHub Actions deployment.
