import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Settings } from "../database/store";
export type Voice = {
  id: string;
  name: string;
  language: string;
  local: boolean;
};
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
    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === "ru" ? "ru-RU" : "en-US";
      u.rate = s.rate;
      u.pitch = s.pitch;
      const voice = speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === s.voice);
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
      language: language === "ru" ? "ru-RU" : "en-US",
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
