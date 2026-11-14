import type { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const AI_VOICES = [
  { id: "af_heart", label: "Heart · US English" },
  { id: "af_bella", label: "Bella · US English" },
  { id: "am_michael", label: "Michael · US English" },
  { id: "bm_george", label: "George · UK English" },
] as const;
export type AIVoice = (typeof AI_VOICES)[number]["id"];

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
    throw new Error("This AI model supports English, not Russian or Kazakh. Use system TTS for those languages.");
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
