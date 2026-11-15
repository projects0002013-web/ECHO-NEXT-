import {
  verifyCachedResponse,
  storeVerifiedResponse,
  verifiedModelCache,
} from "./modelIntegrity";
import type { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const AI_VOICES = [
  { id: "af_heart", label: "Heart · US English · Female" },
  { id: "af_alloy", label: "Alloy · US English · Female" },
  { id: "af_aoede", label: "Aoede · US English · Female" },
  { id: "af_bella", label: "Bella · US English · Female" },
  { id: "af_jessica", label: "Jessica · US English · Female" },
  { id: "af_kore", label: "Kore · US English · Female" },
  { id: "af_nicole", label: "Nicole · US English · Female" },
  { id: "af_nova", label: "Nova · US English · Female" },
  { id: "af_river", label: "River · US English · Female" },
  { id: "af_sarah", label: "Sarah · US English · Female" },
  { id: "af_sky", label: "Sky · US English · Female" },
  { id: "am_adam", label: "Adam · US English · Male" },
  { id: "am_echo", label: "Echo · US English · Male" },
  { id: "am_eric", label: "Eric · US English · Male" },
  { id: "am_fenrir", label: "Fenrir · US English · Male" },
  { id: "am_liam", label: "Liam · US English · Male" },
  { id: "am_michael", label: "Michael · US English · Male" },
  { id: "am_onyx", label: "Onyx · US English · Male" },
  { id: "am_puck", label: "Puck · US English · Male" },
  { id: "am_santa", label: "Santa · US English · Male" },
  { id: "bf_alice", label: "Alice · UK English · Female" },
  { id: "bf_emma", label: "Emma · UK English · Female" },
  { id: "bf_isabella", label: "Isabella · UK English · Female" },
  { id: "bf_lily", label: "Lily · UK English · Female" },
  { id: "bm_daniel", label: "Daniel · UK English · Male" },
  { id: "bm_fable", label: "Fable · UK English · Male" },
  { id: "bm_george", label: "George · UK English · Male" },
  { id: "bm_lewis", label: "Lewis · UK English · Male" },
] as const;
export type AIVoice = (typeof AI_VOICES)[number]["id"];

const PREFERENCES_KEY = "echo-kokoro-preferences-v1";
export function loadLocalAIPreferences(): { voice: AIVoice } {
  try {
    const saved = JSON.parse(
      globalThis.localStorage?.getItem(PREFERENCES_KEY) || "null",
    ) as { voice?: unknown } | null;
    return {
      voice: AI_VOICES.some((item) => item.id === saved?.voice)
        ? (saved!.voice as AIVoice)
        : "af_heart",
    };
  } catch {
    return { voice: "af_heart" };
  }
}
export function saveLocalAIPreferences(preferences: { voice: AIVoice }): void {
  try {
    globalThis.localStorage?.setItem(
      PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Storage can be disabled or full; speech generation must remain available.
  }
}

type Model = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;
let modelPromise: Promise<Model> | undefined;
let modelReady = false;
const INSTALL_KEY = "echo-kokoro-installed-v1";

/** True only after the user explicitly loaded the model successfully once. */
export function hasLocalAIInstallConsent(): boolean {
  try {
    return globalThis.localStorage?.getItem(INSTALL_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when Kokoro is loaded in this page session. */
export function isLocalAIReady(): boolean {
  return modelReady;
}

/** Explicitly lazy: model downloads only after the user clicks Load AI. */
export async function loadLocalAI(
  options: {
    localOnly?: boolean;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<Model> {
  if (!modelPromise) {
    modelPromise = import("kokoro-js")
      .then(async ({ KokoroTTS }) => {
        const { env } = await import("@huggingface/transformers");
        if (typeof caches === "undefined")
          throw new Error("Local model storage is unavailable.");
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useCustomCache = true;
        let writeError: unknown;
        env.customCache = verifiedModelCache(
          await caches.open("transformers-cache"),
          !!options.localOnly,
          (error) => {
            writeError = error;
          },
        );
        // kokoro-js fetches styles separately from Transformers. Preload them only
        // on explicit installation; restoration validates the selected saved style.
        const voices = options.localOnly
          ? [loadLocalAIPreferences().voice]
          : AI_VOICES.map((v) => v.id);
        for (const voice of voices)
          await ensureKokoroVoice(voice, !!options.localOnly);
        const model = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: "q8",
          device: "wasm",
          progress_callback: (progress) => {
            if (progress.status === "progress")
              options.onProgress?.(progress.progress);
          },
        });
        if (writeError) {
          await model.model.dispose();
          throw writeError;
        }
        modelReady = true;
        try {
          globalThis.localStorage?.setItem(INSTALL_KEY, "1");
        } catch {
          /* model still works this session */
        }
        return model;
      })
      .catch((error: unknown) => {
        modelPromise = undefined; // Retry possible after interrupted download.
        modelReady = false;
        throw error;
      });
  }
  return modelPromise;
}

export function normalizeLocalAISpeed(speed: number): number {
  return Number.isFinite(speed) ? Math.max(0.5, Math.min(2, speed)) : 1;
}

export function validateAIText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 400)
    throw new Error("Enter 1–400 English characters.");
  if (/[\u0400-\u04FF\u0370-\u03FF]/u.test(text))
    throw new Error(
      "This AI model supports English only. Use system TTS for Russian, Kazakh, or Belarusian.",
    );
  return text;
}

/** True neural TTS — output is generated audio, never a stored recording. */
export async function synthesizeLocalAI(
  value: string,
  voice: AIVoice,
  speed = 1,
): Promise<Blob> {
  const text = validateAIText(value);
  if (!AI_VOICES.some((v) => v.id === voice))
    throw new Error("Unknown AI voice.");
  const model = await loadLocalAI({ localOnly: true });
  await ensureKokoroVoice(voice, true);
  const audio = await model.generate(text, {
    voice,
    speed: normalizeLocalAISpeed(speed),
  });
  const blob = audio.toBlob();
  if (!blob.size) throw new Error("The AI model returned empty audio.");
  return blob;
}

/** Prevent kokoro-js from downloading an uncached style during speech. */
export async function ensureKokoroVoice(
  voice: AIVoice,
  localOnly: boolean,
): Promise<void> {
  const key = `https://huggingface.co/${MODEL_ID}/resolve/main/voices/${voice}.bin`;
  const cache = await caches.open("kokoro-voices");
  const cached = await cache.match(key);
  if (cached) {
    await verifyCachedResponse(cache, key, cached);
    return;
  }
  if (localOnly)
    throw new Error(
      "This voice is not saved locally. Use Load AI model while online.",
    );
  const response = await fetch(key, { credentials: "omit" });
  if (!response.ok)
    throw new Error(`Voice download failed: ${response.status}`);
  await storeVerifiedResponse(cache, key, response);
}
