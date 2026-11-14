import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Settings } from "../database/store";
export type Voice = {
  id: string;
  name: string;
  language: string;
  local: boolean;
};
export function speechLocale(language: string): string {
  const normalized = language.trim().replace("_", "-");
  if (normalized.toLowerCase() === "ru") return "ru-RU";
  if (normalized.toLowerCase() === "be") return "be-BY";
  if (/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(normalized)) return normalized;
  return "en-US";
}
export interface SpeechEngine {
  voices(): Promise<Voice[]>;
  speak(text: string, settings: Settings, language?: string): Promise<void>;
  stop(): Promise<void>;
}
export class BrowserSpeech implements SpeechEngine {
  async voices() {
    if (!("speechSynthesis" in globalThis)) return [];
    return speechSynthesis
      .getVoices()
      .map((v) => ({
        id: v.voiceURI,
        name: v.name,
        language: v.lang,
        local: v.localService,
      }));
  }
  async speak(text: string, s: Settings, language = s.language) {
    if (!("speechSynthesis" in globalThis))
      throw new Error(
        "Speech is unavailable in this browser. Try Android or a browser with text-to-speech support.",
      );
    speechSynthesis.cancel();
    const requestedLocale = speechLocale(language);
    const requestedLanguage = requestedLocale.split("-")[0].toLowerCase();
    const availableVoices = speechSynthesis.getVoices();
    const matchingVoices = availableVoices.filter(
      (v) => v.lang.toLowerCase().split("-")[0] === requestedLanguage,
    );
    if (availableVoices.length > 0 && matchingVoices.length === 0) {
      throw new Error(`No installed speech voice for ${requestedLocale}. Install that language pack or choose another language.`);
    }
    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = requestedLocale;
      u.rate = s.rate;
      u.pitch = s.pitch;
      const selectedVoice = matchingVoices.find((v) => v.voiceURI === s.voice);
      const voice = selectedVoice ?? matchingVoices.find((v) => v.localService) ?? matchingVoices[0];
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = (e) =>
        e.error === "canceled" || e.error === "interrupted"
          ? resolve()
          : reject(new Error(`Speech: ${e.error}`));
      speechSynthesis.speak(u);
    });
  }
  async stop() {
    if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
  }
}
interface NativeSpeech {
  getVoices(): Promise<{ voices: Voice[] }>;
  speak(o: {
    text: string;
    language: string;
    voice: string;
    rate: number;
    pitch: number;
  }): Promise<void>;
  stop(): Promise<void>;
}
const native = registerPlugin<NativeSpeech>("EchoSpeech");
class AndroidSpeech implements SpeechEngine {
  async voices() {
    return (await native.getVoices()).voices;
  }
  speak(text: string, s: Settings, language = s.language) {
    return native.speak({
      text,
      language: speechLocale(language),
      voice: s.voice,
      rate: s.rate,
      pitch: s.pitch,
    });
  }
  stop() {
    return native.stop();
  }
}
export const speech: SpeechEngine =
  Capacitor.getPlatform() === "android"
    ? new AndroidSpeech()
    : new BrowserSpeech();
