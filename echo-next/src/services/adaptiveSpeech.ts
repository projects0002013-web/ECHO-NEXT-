import type { Settings } from "../database/store";

/**
 * Conservative, deterministic pacing adaptation for system TTS.
 * This changes only the rate; it does not infer emotion or alter the speaker's identity.
 */
export function adaptiveSpeechSettings(text: string, settings: Settings): Settings {
  if (settings.adaptiveVoice !== "smart") return settings;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  let factor = 1;
  if (words >= 24 || trimmed.length >= 140) factor = 0.9;
  else if (words >= 12 || trimmed.length >= 70) factor = 0.95;
  else if (/[?…]$/u.test(trimmed)) factor = 0.97;
  else if (/!$/u.test(trimmed)) factor = 1.02;
  return { ...settings, rate: Math.max(0.5, Math.min(2, settings.rate * factor)) };
}
