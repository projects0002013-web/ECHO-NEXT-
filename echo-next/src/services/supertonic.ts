import { prepareCloudflareWasm } from "./cloudflareWasm";
export const SUPERTONIC_LANGUAGES = [
  ["en", "English"],
  ["ko", "Korean"],
  ["ja", "Japanese"],
  ["ar", "Arabic"],
  ["bg", "Bulgarian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["de", "German"],
  ["el", "Greek"],
  ["es", "Spanish"],
  ["et", "Estonian"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["hi", "Hindi"],
  ["hr", "Croatian"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["lt", "Lithuanian"],
  ["lv", "Latvian"],
  ["nl", "Dutch"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["sv", "Swedish"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["vi", "Vietnamese"],
] as const;
export type SupertonicLanguage = (typeof SUPERTONIC_LANGUAGES)[number][0];
export const SUPERTONIC_VOICES = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
] as const;
export type SupertonicVoice = (typeof SUPERTONIC_VOICES)[number];

export type SupertonicPreferences = {
  voice: SupertonicVoice;
  language: SupertonicLanguage;
  speed: number;
  steps: 5 | 8 | 12;
  adaptive: boolean;
};
const PREFERENCES_KEY = "echo-supertonic-preferences-v1";

export function loadSupertonicPreferences(
  defaultLanguage: SupertonicLanguage = "en",
): SupertonicPreferences {
  const defaults: SupertonicPreferences = {
    voice: "F1",
    language: defaultLanguage,
    speed: 1.1,
    steps: 5,
    adaptive: true,
  };
  try {
    const raw = globalThis.localStorage?.getItem(PREFERENCES_KEY);
    if (!raw) return defaults;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    const saved = value as Record<string, unknown>;
    return {
      voice: SUPERTONIC_VOICES.includes(saved.voice as SupertonicVoice)
        ? (saved.voice as SupertonicVoice)
        : defaults.voice,
      language: SUPERTONIC_LANGUAGES.some(([code]) => code === saved.language)
        ? (saved.language as SupertonicLanguage)
        : defaults.language,
      speed:
        typeof saved.speed === "number" && Number.isFinite(saved.speed)
          ? Math.max(0.7, Math.min(1.8, saved.speed))
          : defaults.speed,
      steps:
        saved.steps === 5 || saved.steps === 8 || saved.steps === 12
          ? saved.steps
          : defaults.steps,
      adaptive:
        typeof saved.adaptive === "boolean"
          ? saved.adaptive
          : defaults.adaptive,
    };
  } catch {
    return defaults;
  }
}

export function saveSupertonicPreferences(
  preferences: SupertonicPreferences,
): void {
  try {
    globalThis.localStorage?.setItem(
      PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Private browsing, disabled storage, or a full device must not break speech.
  }
}
export const SUPERTONIC_MODEL_SIZE_BYTES = 398 * 1024 * 1024;
const MODEL_REVISION = "aafc6e32416a594460b32413efc49d7fe4ce6d46";
const ROOT = `https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/${MODEL_REVISION}`;
const ONNX_DIR = `${ROOT}/onnx`;
const VOICE_DIR = `${ROOT}/voice_styles`;
type Runtime = {
  configureModelAccess: (options: {
    localOnly?: boolean;
    signal?: AbortSignal;
  }) => void;
  loadTextToSpeech: (
    path: string,
    options: Record<string, unknown>,
    progress?: (name: string, current: number, total: number) => void,
  ) => Promise<{ textToSpeech: any; cfgs: any }>;
  loadVoiceStyle: (paths: string[], verbose?: boolean) => Promise<any>;
  writeWavFile: (audio: number[], sampleRate: number) => ArrayBuffer;
};
let runtimePromise: Promise<Runtime> | undefined;
let downloadController = new AbortController();
let generationController = new AbortController();
let generationQueue: Promise<unknown> = Promise.resolve();
export function cancelSupertonicOperations() {
  downloadController.abort();
  generationController.abort();
}

/** Starts a latest-request-wins generation and exposes its cancellation signal. */
export function startSupertonicGeneration(): AbortSignal {
  generationController.abort();
  generationController = new AbortController();
  return generationController.signal;
}
let enginePromise: Promise<{ tts: any; runtime: Runtime }> | undefined;
const voiceStylePromises = new Map<SupertonicVoice, Promise<any>>();

function loadCachedVoiceStyle(
  runtime: Runtime,
  voice: SupertonicVoice,
): Promise<any> {
  let pending = voiceStylePromises.get(voice);
  if (!pending) {
    pending = runtime
      .loadVoiceStyle([`${VOICE_DIR}/${voice}.json`])
      .catch((error: unknown) => {
        voiceStylePromises.delete(voice);
        throw error;
      });
    voiceStylePromises.set(voice, pending);
  }
  return pending;
}

async function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    runtimePromise =
      import("./vendor/supertonic-runtime.js") as Promise<Runtime>;
  }
  return runtimePromise;
}

export async function modelStorageEstimate(): Promise<{
  available?: number;
  persistent: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.storage)
    return { persistent: false };
  let persistent = false;
  try {
    persistent = navigator.storage.persist
      ? await navigator.storage.persist()
      : false;
  } catch {
    /* browser may deny persistence */
  }
  try {
    const estimate = await navigator.storage.estimate();
    const available =
      estimate.quota && estimate.usage !== undefined
        ? Math.max(0, estimate.quota - estimate.usage)
        : undefined;
    return { available, persistent };
  } catch {
    return { persistent };
  }
}

export async function loadSupertonic(
  onProgress?: (name: string, current: number, total: number) => void,
  options: { localOnly?: boolean } = {},
): Promise<{ tts: any; runtime: Runtime }> {
  if (!enginePromise) {
    enginePromise = (async () => {
      downloadController = new AbortController();
      await prepareCloudflareWasm();
      const runtime = await getRuntime();
      runtime.configureModelAccess({
        ...options,
        signal: downloadController.signal,
      });
      let result: { textToSpeech: any; cfgs: any } | undefined;
      try {
        try {
          result = await runtime.loadTextToSpeech(
            ONNX_DIR,
            {
              executionProviders: ["webgpu"],
              graphOptimizationLevel: "all",
            },
            onProgress,
          );
        } catch {
          downloadController.signal.throwIfAborted();
          result = await runtime.loadTextToSpeech(
            ONNX_DIR,
            {
              executionProviders: ["wasm"],
              graphOptimizationLevel: "all",
            },
            onProgress,
          );
        }
        // Cache every small preset style during the explicit model install so
        // any selected voice remains available after the device goes offline.
        await Promise.all(
          SUPERTONIC_VOICES.map((voice) =>
            loadCachedVoiceStyle(runtime, voice),
          ),
        );
        const cacheStatus = await getSupertonicCacheStatus();
        if (!cacheStatus.complete) {
          throw new Error(
            `Supertonic loaded, but only ${cacheStatus.modelFilesCached}/${cacheStatus.modelFilesTotal} model files and ${cacheStatus.voiceStylesCached}/${cacheStatus.voiceStylesTotal} voice styles were saved locally. Check device storage and retry; cached files will be reused.`,
          );
        }
        return { tts: result.textToSpeech, runtime };
      } catch (error) {
        if (result) await releaseSupertonicSessions(result.textToSpeech);
        throw error;
      }
    })().catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  }
  return enginePromise;
}

export function adaptiveSupertonicSpeed(
  text: string,
  baseSpeed: number,
  enabled: boolean,
): number {
  if (!enabled) return baseSpeed;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  let factor = 1;
  if (words >= 24 || trimmed.length >= 140) factor = 0.9;
  else if (words >= 12 || trimmed.length >= 70) factor = 0.95;
  else if (/[?…]$/u.test(trimmed)) factor = 0.97;
  else if (/!$/u.test(trimmed)) factor = 1.02;
  return Math.max(0.7, Math.min(1.8, baseSpeed * factor));
}

export async function synthesizeSupertonic(
  text: string,
  voice: SupertonicVoice,
  language: SupertonicLanguage,
  speed: number,
  steps: number,
  adaptive: boolean,
  onProgress?: (step: number, total: number) => void,
): Promise<Blob> {
  const clean = text.trim();
  if (!clean || clean.length > 2000)
    throw new Error("Enter 1–2000 characters.");
  if (!SUPERTONIC_LANGUAGES.some(([code]) => code === language))
    throw new Error("Unsupported Supertonic language.");
  if (!SUPERTONIC_VOICES.includes(voice))
    throw new Error("Unknown Supertonic voice.");
  if (
    ![5, 8, 12].includes(steps) ||
    !Number.isFinite(speed) ||
    speed < 0.7 ||
    speed > 1.8
  )
    throw new Error("Invalid speech speed or quality mode.");
  const signal = startSupertonicGeneration();
  const generate = async () => {
    signal.throwIfAborted();
    const { tts, runtime } = await loadSupertonic(undefined, {
      localOnly: true,
    });
    signal.throwIfAborted();
    const style = await loadCachedVoiceStyle(runtime, voice);
    const effectiveSpeed = adaptiveSupertonicSpeed(clean, speed, adaptive);
    const { wav, duration } = await tts.call(
      clean,
      language,
      style,
      steps,
      effectiveSpeed,
      0.3,
      (step: number, total: number) => {
        signal.throwIfAborted();
        onProgress?.(step, total);
      },
    );
    signal.throwIfAborted();
    const sampleCount = validatedSupertonicSampleCount(
      wav.length,
      tts.sampleRate,
      duration?.[0],
    );
    const samples = wav.slice(0, sampleCount);
    const buffer = runtime.writeWavFile(samples, tts.sampleRate);
    if (buffer.byteLength <= 44)
      throw new Error("Supertonic returned empty audio.");
    return new Blob([buffer], { type: "audio/wav" });
  };
  const queued = generationQueue.catch(() => undefined).then(generate);
  generationQueue = queued;
  return queued;
}

export function validatedSupertonicSampleCount(
  availableSamples: number,
  sampleRate: number,
  durationSeconds: number,
): number {
  if (
    !Number.isFinite(availableSamples) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(durationSeconds) ||
    availableSamples <= 0 ||
    sampleRate <= 0 ||
    durationSeconds <= 0
  )
    throw new Error("Supertonic returned empty audio.");
  const sampleCount = Math.min(
    Math.floor(availableSamples),
    Math.floor(sampleRate * durationSeconds),
  );
  if (sampleCount <= 0) throw new Error("Supertonic returned empty audio.");
  return sampleCount;
}

const REQUIRED_ONNX_FILES = [
  "duration_predictor.onnx",
  "text_encoder.onnx",
  "vector_estimator.onnx",
  "vocoder.onnx",
  "tts.json",
  "unicode_indexer.json",
] as const;

export type SupertonicCacheStatus = {
  available: boolean;
  modelFilesCached: number;
  modelFilesTotal: number;
  voiceStylesCached: number;
  voiceStylesTotal: number;
  complete: boolean;
};

export async function getSupertonicCacheStatus(): Promise<SupertonicCacheStatus> {
  const empty: SupertonicCacheStatus = {
    available: false,
    modelFilesCached: 0,
    modelFilesTotal: REQUIRED_ONNX_FILES.length,
    voiceStylesCached: 0,
    voiceStylesTotal: SUPERTONIC_VOICES.length,
    complete: false,
  };
  if (typeof caches === "undefined") return empty;
  try {
    const cache = await caches.open("echo-supertonic-3-v1");
    const [modelFiles, voiceFiles] = await Promise.all([
      Promise.all(
        REQUIRED_ONNX_FILES.map((file) => cache.match(`${ONNX_DIR}/${file}`)),
      ),
      Promise.all(
        SUPERTONIC_VOICES.map((voice) =>
          cache.match(`${VOICE_DIR}/${voice}.json`),
        ),
      ),
    ]);
    const modelFilesCached = modelFiles.filter(Boolean).length;
    const voiceStylesCached = voiceFiles.filter(Boolean).length;
    return {
      available: true,
      modelFilesCached,
      modelFilesTotal: REQUIRED_ONNX_FILES.length,
      voiceStylesCached,
      voiceStylesTotal: SUPERTONIC_VOICES.length,
      complete:
        modelFilesCached === REQUIRED_ONNX_FILES.length &&
        voiceStylesCached === SUPERTONIC_VOICES.length,
    };
  } catch {
    return empty;
  }
}

export async function isSupertonicModelCached(): Promise<boolean> {
  return (await getSupertonicCacheStatus()).complete;
}

export async function releaseSupertonicSessions(tts: any): Promise<void> {
  for (const key of ["dpOrt", "textEncOrt", "vectorEstOrt", "vocoderOrt"])
    await tts?.[key]?.release?.();
}

/** Releases large ONNX sessions while leaving verified model files on device. */
export async function releaseSupertonicMemory(): Promise<void> {
  cancelSupertonicOperations();
  await generationQueue.catch(() => undefined);
  generationQueue = Promise.resolve();
  const pending = enginePromise;
  enginePromise = undefined;
  runtimePromise = undefined;
  voiceStylePromises.clear();
  const loaded = await pending?.catch(() => undefined);
  if (loaded) await releaseSupertonicSessions(loaded.tts);
}

export async function removeSupertonicModel(): Promise<void> {
  await releaseSupertonicMemory();
  if (typeof caches !== "undefined")
    await caches.delete("echo-supertonic-3-v1");
}
