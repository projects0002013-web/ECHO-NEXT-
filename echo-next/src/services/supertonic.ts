export const SUPERTONIC_LANGUAGES = [
  ["en", "English"], ["ko", "Korean"], ["ja", "Japanese"], ["ar", "Arabic"],
  ["bg", "Bulgarian"], ["cs", "Czech"], ["da", "Danish"], ["de", "German"],
  ["el", "Greek"], ["es", "Spanish"], ["et", "Estonian"], ["fi", "Finnish"],
  ["fr", "French"], ["hi", "Hindi"], ["hr", "Croatian"], ["hu", "Hungarian"],
  ["id", "Indonesian"], ["it", "Italian"], ["lt", "Lithuanian"], ["lv", "Latvian"],
  ["nl", "Dutch"], ["pl", "Polish"], ["pt", "Portuguese"], ["ro", "Romanian"],
  ["ru", "Russian"], ["sk", "Slovak"], ["sl", "Slovenian"], ["sv", "Swedish"],
  ["tr", "Turkish"], ["uk", "Ukrainian"], ["vi", "Vietnamese"],
] as const;
export type SupertonicLanguage = (typeof SUPERTONIC_LANGUAGES)[number][0];
export const SUPERTONIC_VOICES = ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"] as const;
export type SupertonicVoice = (typeof SUPERTONIC_VOICES)[number];
export const SUPERTONIC_MODEL_SIZE_BYTES = 398 * 1024 * 1024;
const MODEL_REVISION = "aafc6e32416a594460b32413efc49d7fe4ce6d46";
const ROOT = `https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/${MODEL_REVISION}`;
const ONNX_DIR = `${ROOT}/onnx`;
const VOICE_DIR = `${ROOT}/voice_styles`;
type Runtime = {
  loadTextToSpeech: (path: string, options: Record<string, unknown>, progress?: (name: string, current: number, total: number) => void) => Promise<{ textToSpeech: any; cfgs: any }>;
  loadVoiceStyle: (paths: string[], verbose?: boolean) => Promise<any>;
  writeWavFile: (audio: number[], sampleRate: number) => ArrayBuffer;
};
let runtimePromise: Promise<Runtime> | undefined;
let enginePromise: Promise<{ tts: any; runtime: Runtime }> | undefined;

async function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    // @ts-ignore - vendored upstream JavaScript helper is intentionally kept as JS.
    runtimePromise = import("./vendor/supertonic-runtime.js") as Promise<Runtime>;
  }
  return runtimePromise;
}

export async function modelStorageEstimate(): Promise<{ available?: number; persistent: boolean }> {
  if (typeof navigator === "undefined" || !navigator.storage) return { persistent: false };
  let persistent = false;
  try { persistent = navigator.storage.persist ? await navigator.storage.persist() : false; } catch { /* browser may deny persistence */ }
  try {
    const estimate = await navigator.storage.estimate();
    const available = estimate.quota && estimate.usage !== undefined ? Math.max(0, estimate.quota - estimate.usage) : undefined;
    return { available, persistent };
  } catch {
    return { persistent };
  }
}

export async function loadSupertonic(
  onProgress?: (name: string, current: number, total: number) => void,
): Promise<{ tts: any; runtime: Runtime }> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const runtime = await getRuntime();
      let result: { textToSpeech: any; cfgs: any };
      try {
        result = await runtime.loadTextToSpeech(ONNX_DIR, {
          executionProviders: ["webgpu"],
          graphOptimizationLevel: "all",
        }, onProgress);
      } catch {
        result = await runtime.loadTextToSpeech(ONNX_DIR, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        }, onProgress);
      }
      // Cache every small preset style during the explicit model install so
      // any selected voice remains available after the device goes offline.
      await runtime.loadVoiceStyle(SUPERTONIC_VOICES.map((voice) => `${VOICE_DIR}/${voice}.json`));
      return { tts: result.textToSpeech, runtime };
    })().catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  }
  return enginePromise;
}

export function adaptiveSupertonicSpeed(text: string, baseSpeed: number, enabled: boolean): number {
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
  if (!clean || clean.length > 300) throw new Error("Enter 1–300 characters.");
  if (!SUPERTONIC_LANGUAGES.some(([code]) => code === language)) throw new Error("Unsupported Supertonic language.");
  if (!SUPERTONIC_VOICES.includes(voice)) throw new Error("Unknown Supertonic voice.");
  const { tts, runtime } = await loadSupertonic();
  const style = await runtime.loadVoiceStyle([`${VOICE_DIR}/${voice}.json`]);
  const effectiveSpeed = adaptiveSupertonicSpeed(clean, speed, adaptive);
  const { wav, duration } = await tts.call(clean, language, style, steps, effectiveSpeed, 0.3, onProgress);
  const samples = wav.slice(0, Math.floor(tts.sampleRate * duration[0]));
  const buffer = runtime.writeWavFile(samples, tts.sampleRate);
  if (!buffer.byteLength) throw new Error("Supertonic returned empty audio.");
  return new Blob([buffer], { type: "audio/wav" });
}

export async function isSupertonicModelCached(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open("echo-supertonic-3-v1");
  const required = ["duration_predictor.onnx", "text_encoder.onnx", "vector_estimator.onnx", "vocoder.onnx", "tts.json", "unicode_indexer.json"];
  const modelFiles = await Promise.all(required.map((file) => cache.match(`${ONNX_DIR}/${file}`)));
  const voiceFiles = await Promise.all(SUPERTONIC_VOICES.map((voice) => cache.match(`${VOICE_DIR}/${voice}.json`)));
  return modelFiles.every(Boolean) && voiceFiles.every(Boolean);
}

export async function removeSupertonicModel(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete("echo-supertonic-3-v1");
  enginePromise = undefined;
  runtimePromise = undefined;
}
