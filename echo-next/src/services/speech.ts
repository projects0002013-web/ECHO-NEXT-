import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Settings } from "../database/store";
import {
  hasLocalAIInstallConsent,
  isLocalAIReady,
  loadLocalAI,
  loadLocalAIPreferences,
  synthesizeLocalAI,
} from "./localAi";
import {
  isSupertonicModelCached,
  loadSupertonic,
  loadSupertonicPreferences,
  synthesizeSupertonic,
  SUPERTONIC_LANGUAGES,
  type SupertonicLanguage,
} from "./supertonic";
import { resolveVoiceRoute } from "./voiceRouting";

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
  if (normalized.toLowerCase() === "en") return "en-US";
  if (/^[a-z]{2,3}-[a-z0-9]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(normalized)) return normalized;
  return "en-US";
}

export interface SpeechEngine {
  voices(): Promise<Voice[]>;
  speak(text: string, settings: Settings, language?: string): Promise<void>;
  stop(): Promise<void>;
}

class BrowserSpeech implements SpeechEngine {
  async voices() {
    if (!("speechSynthesis" in globalThis)) return [];
    return speechSynthesis.getVoices().map((v) => ({
      id: v.voiceURI,
      name: v.name,
      language: v.lang,
      local: v.localService,
    }));
  }

  async speak(text: string, s: Settings, language = s.language) {
    if (!("speechSynthesis" in globalThis)) {
      throw new Error("Speech is unavailable in this browser. Try Android or a browser with text-to-speech support.");
    }
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
  speak(o: { text: string; language: string; voice: string; rate: number; pitch: number }): Promise<void>;
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

let activeAudio: HTMLAudioElement | undefined;
let stopActiveAudio: (() => void) | undefined;

function stopGeneratedAudio(): void {
  stopActiveAudio?.();
}

function playGeneratedAudio(blob: Blob): Promise<void> {
  stopGeneratedAudio();
  const url = URL.createObjectURL(blob);
  const player = new Audio(url);
  activeAudio = player;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("error", onError);
      player.pause();
      player.removeAttribute("src");
      player.load();
      URL.revokeObjectURL(url);
      if (activeAudio === player) activeAudio = undefined;
      if (stopActiveAudio === stop) stopActiveAudio = undefined;
      if (error) reject(error);
      else resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish(new Error("Generated speech audio could not be played on this device."));
    const stop = () => finish();

    stopActiveAudio = stop;
    player.addEventListener("ended", onEnded, { once: true });
    player.addEventListener("error", onError, { once: true });
    void player.play().catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error("Audio playback was blocked."));
    });
  });
}

class HybridSpeech implements SpeechEngine {
  constructor(private readonly system: SpeechEngine) {}

  voices() {
    return this.system.voices();
  }

  async speak(text: string, settings: Settings, language = settings.language) {
    const clean = text.trim();
    if (!clean) return;
    const locale = speechLocale(language);
    const languageCode = locale.split("-")[0].toLowerCase();
    const installedSystemVoices = await this.system.voices().catch(() => []);
    const systemVoiceAvailable =
      installedSystemVoices.length === 0 ||
      installedSystemVoices.some((voice) => voice.language.toLowerCase().split("-")[0] === languageCode);

    // No cloud provider is configured yet. Do not mistake a network connection
    // for an available online TTS service.
    const [supertonicInstalled] = await Promise.all([
      isSupertonicModelCached().catch(() => false),
    ]);
    const kokoroInstalled = isLocalAIReady() || hasLocalAIInstallConsent();
    const route = resolveVoiceRoute({
      isOnline: typeof navigator !== "undefined" && navigator.onLine,
      onlineProviderConfigured: false,
      language: languageCode,
      supertonicInstalled,
      kokoroInstalled,
      systemVoiceAvailable,
    });

    if (route.engine === "kokoro") {
      try {
        if (!isLocalAIReady()) await loadLocalAI();
        const { voice } = loadLocalAIPreferences();
        const audio = await synthesizeLocalAI(clean, voice);
        await playGeneratedAudio(audio);
        return;
      } catch {
        // A browser cache may have been cleared since installation. Preserve
        // communication by falling back to the device's speech engine.
      }
    }

    if (route.engine === "supertonic") {
      try {
        const supported = SUPERTONIC_LANGUAGES.some(([code]) => code === languageCode);
        if (!supported) throw new Error("Supertonic does not support this language.");
        const prefs = loadSupertonicPreferences(languageCode as SupertonicLanguage);
        await loadSupertonic();
        const audio = await synthesizeSupertonic(
          clean,
          prefs.voice,
          languageCode as SupertonicLanguage,
          settings.rate,
          prefs.steps,
          settings.adaptiveVoice === "smart",
        );
        await playGeneratedAudio(audio);
        return;
      } catch {
        // If a cached model cannot initialize on this device, use system TTS.
      }
    }

    await this.system.speak(clean, settings, language);
  }

  async stop() {
    stopGeneratedAudio();
    await this.system.stop();
  }
}

const systemSpeech: SpeechEngine =
  Capacitor.getPlatform() === "android" ? new AndroidSpeech() : new BrowserSpeech();

/**
 * Main ECHO speech entry point. It prefers already-installed offline neural
 * models and falls back to the system TTS whenever a model is missing or fails.
 * Online TTS will be added only after a real provider and secure backend exist.
 */
export const speech: SpeechEngine = new HybridSpeech(systemSpeech);
