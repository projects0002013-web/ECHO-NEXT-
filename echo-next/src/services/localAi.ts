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
    const saved = JSON.parse(globalThis.localStorage?.getItem(PREFERENCES_KEY) || "null") as { voice?: unknown } | null;
    return { voice: AI_VOICES.some((item) => item.id === saved?.voice) ? saved!.voice as AIVoice : "af_heart" };
  } catch {
    return { voice: "af_heart" };
  }
}
export function saveLocalAIPreferences(preferences: { voice: AIVoice }): void {
  try {
    globalThis.localStorage?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be disabled or full; speech generation must remain available.
  }
}

type Model = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;
let modelPromise: Promise<Model> | undefined;

/** Explicitly lazy: model downloads only after the user clicks Load AI. */
export async function loadLocalAI(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = import("kokoro-js").then(({ KokoroTTS }) => KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
    })).catch((error: unknown) => {
      modelPromise = undefined; // Retry possible after interrupted download.
      throw error;
    });
  }
  return modelPromise;
}

export function validateAIText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 400)
    throw new Error("Enter 1–400 English characters.");
  if (/[\u0400-\u04FF\u0370-\u03FF]/u.test(text))
    throw new Error("This AI model supports English only. Use system TTS for Russian, Kazakh, or Belarusian.");
  return text;
}

/** True neural TTS — output is generated audio, never a stored recording. */
export async function synthesizeLocalAI(value: string, voice: AIVoice): Promise<Blob> {
  const text = validateAIText(value);
  if (!AI_VOICES.some((v) => v.id === voice))
    throw new Error("Unknown AI voice.");
  const model = await loadLocalAI();
  const audio = await model.generate(text, { voice });
  const blob = audio.toBlob();
  if (!blob.size) throw new Error("The AI model returned empty audio.");
  return blob;
}
