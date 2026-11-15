import { it, expect, vi, afterEach } from "vitest";
import {
  BrowserSpeech,
  HybridSpeech,
  NeuralVoiceUnavailableError,
  speechLocale,
} from "../src/services/speech";
import { VoiceRecorder } from "../src/services/recorder";
import { initialState } from "../src/database/store";
import { validateVoiceRequest } from "../src/services/ai";
import { adaptiveSpeechSettings } from "../src/services/adaptiveSpeech";
import {
  adaptiveSupertonicSpeed,
  cancelSupertonicOperations,
  getSupertonicCacheStatus,
  loadSupertonicPreferences,
  releaseSupertonicSessions,
  saveSupertonicPreferences,
  startSupertonicGeneration,
} from "../src/services/supertonic";
import {
  AI_VOICES,
  loadLocalAIPreferences,
  saveLocalAIPreferences,
  normalizeLocalAISpeed,
} from "../src/services/localAi";
import { chunkText } from "../src/services/vendor/supertonic-runtime.js";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("maps Belarusian to the correct BCP-47 voice locale", () => {
  expect(speechLocale("be")).toBe("be-BY");
  expect(speechLocale("ru")).toBe("ru-RU");
  expect(speechLocale("en")).toBe("en-US");
});

it("preserves explicit regional voice locales for preview playback", () => {
  expect(speechLocale("en-GB")).toBe("en-GB");
  expect(speechLocale("ru-RU")).toBe("ru-RU");
  expect(speechLocale("be-BY")).toBe("be-BY");
  expect(speechLocale("pt_BR")).toBe("pt-BR");
});
it("keeps the configured system speech rate when adaptive pacing is off", () => {
  const settings = {
    ...initialState().settings,
    rate: 1.2,
    adaptiveVoice: "off" as const,
  };
  expect(
    adaptiveSpeechSettings("A long sentence with many words.", settings).rate,
  ).toBe(1.2);
});
it("slows longer phrases conservatively when adaptive pacing is enabled", () => {
  const settings = {
    ...initialState().settings,
    rate: 1,
    adaptiveVoice: "smart" as const,
  };
  expect(
    adaptiveSpeechSettings(
      "This is a sentence with enough words to activate the adaptive pacing rule.",
      settings,
    ).rate,
  ).toBe(0.95);
});
it("adapts Supertonic speed within its supported range", () => {
  expect(
    adaptiveSupertonicSpeed(
      "A long sentence with many words that should be spoken more slowly.",
      1,
      true,
    ),
  ).toBe(0.95);
  expect(adaptiveSupertonicSpeed("Hello!", 1, true)).toBe(1.02);
  expect(adaptiveSupertonicSpeed("Hello.", 1, false)).toBe(1);
});
it("bounds long Supertonic sentences so ONNX input does not overflow", () => {
  const chunks = chunkText("слово ".repeat(150), 300);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.length <= 300)).toBe(true);
  expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(
    "слово ".repeat(150).trim(),
  );
});
it("persists Supertonic voice preferences across component restarts", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  const preferences = {
    voice: "M3" as const,
    language: "ru" as const,
    speed: 1.35,
    steps: 12 as const,
    adaptive: false,
  };
  saveSupertonicPreferences(preferences);
  expect(loadSupertonicPreferences()).toEqual(preferences);
});
it("recovers safely from invalid Supertonic preferences", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => "{invalid-json",
    setItem: vi.fn(),
  });
  expect(loadSupertonicPreferences("ru")).toEqual({
    voice: "F1",
    language: "ru",
    speed: 1.1,
    steps: 5,
    adaptive: true,
  });
});
it("clamps corrupted Supertonic speed and ignores unknown voices", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        voice: "unknown",
        language: "xx",
        speed: 99,
        steps: 9,
        adaptive: false,
      }),
    setItem: vi.fn(),
  });
  expect(loadSupertonicPreferences()).toEqual({
    voice: "F1",
    language: "en",
    speed: 1.8,
    steps: 5,
    adaptive: false,
  });
});
it("reports exactly which Supertonic assets survived an app restart", async () => {
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (url: string) =>
        url.includes("duration_predictor.onnx") || url.includes("/F1.json")
          ? new Response("cached")
          : undefined,
    }),
  });
  expect(await getSupertonicCacheStatus()).toEqual({
    available: true,
    modelFilesCached: 1,
    modelFilesTotal: 6,
    voiceStylesCached: 1,
    voiceStylesTotal: 10,
    complete: false,
  });
});
it("recognizes a complete Supertonic cache after an app restart", async () => {
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async () => new Response("cached"),
    }),
  });
  expect((await getSupertonicCacheStatus()).complete).toBe(true);
});
it("reports unavailable Cache Storage instead of pretending offline files exist", async () => {
  vi.stubGlobal("caches", undefined);
  expect(await getSupertonicCacheStatus()).toMatchObject({
    available: false,
    modelFilesCached: 0,
    voiceStylesCached: 0,
    complete: false,
  });
});
it("cancels an older Supertonic generation and the active operation", () => {
  const first = startSupertonicGeneration();
  const second = startSupertonicGeneration();
  expect(first.aborted).toBe(true);
  expect(second.aborted).toBe(false);
  // Starting a third request is the same cancellation path used by the UI.
  const third = startSupertonicGeneration();
  expect(second.aborted).toBe(true);
  expect(third.aborted).toBe(false);
  cancelSupertonicOperations();
  expect(third.aborted).toBe(true);
});
it("releases every Supertonic ONNX inference session", async () => {
  const releases = Array.from({ length: 4 }, () => vi.fn());
  await releaseSupertonicSessions({
    dpOrt: { release: releases[0] },
    textEncOrt: { release: releases[1] },
    vectorEstOrt: { release: releases[2] },
    vocoderOrt: { release: releases[3] },
  });
  for (const release of releases) expect(release).toHaveBeenCalledOnce();
});
it("clamps Kokoro speaking speed to the supported range", () => {
  expect(normalizeLocalAISpeed(0.1)).toBe(0.5);
  expect(normalizeLocalAISpeed(1.25)).toBe(1.25);
  expect(normalizeLocalAISpeed(3)).toBe(2);
  expect(normalizeLocalAISpeed(Number.NaN)).toBe(1);
});
it("exposes the full supported Kokoro preset voice list", () => {
  expect(AI_VOICES).toHaveLength(28);
  expect(AI_VOICES.map((voice) => voice.id)).toContain("bf_lily");
  expect(AI_VOICES.map((voice) => voice.id)).toContain("am_santa");
});
it("persists the selected Kokoro voice across app navigation and reload", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  saveLocalAIPreferences({ voice: "bf_emma" });
  expect(loadLocalAIPreferences()).toEqual({ voice: "bf_emma" });
});
it("recovers from corrupted Kokoro voice preferences", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => "{invalid-json",
    setItem: vi.fn(),
  });
  expect(loadLocalAIPreferences()).toEqual({ voice: "af_heart" });
});
it("reports an unavailable browser speech engine", async () => {
  const engine = new BrowserSpeech();
  expect(await engine.voices()).toEqual([]);
  await expect(engine.speak("Hello", initialState().settings)).rejects.toThrow(
    "unavailable",
  );
});
it("initializes voices, applies settings and cancels speech", async () => {
  const cancel = vi.fn();
  let utterance: any;
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [
      { voiceURI: "local", name: "Local", lang: "en-US", localService: true },
    ],
    cancel,
    speak: (u: any) => {
      utterance = u;
      u.onend();
    },
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  const engine = new BrowserSpeech();
  const settings = { ...initialState().settings, voice: "local", rate: 1.2 };
  expect((await engine.voices())[0].local).toBe(true);
  await engine.speak("Hello", settings);
  expect(utterance.rate).toBe(1.2);
  expect(utterance.voice.name).toBe("Local");
  await engine.stop();
  expect(cancel).toHaveBeenCalledTimes(2);
});
it("does not silently use an English browser voice for Belarusian", async () => {
  const speak = vi.fn();
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [
      { voiceURI: "en", name: "English", lang: "en-US", localService: true },
    ],
    cancel: vi.fn(),
    speak,
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  const engine = new BrowserSpeech();
  await expect(
    engine.speak("Добры дзень", initialState().settings, "be"),
  ).rejects.toThrow("be-BY");
  expect(speak).not.toHaveBeenCalled();
});
it("chooses an installed Belarusian browser voice when available", async () => {
  let utterance: any;
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [
      { voiceURI: "be", name: "Belarusian", lang: "be-BY", localService: true },
    ],
    cancel: vi.fn(),
    speak: (value: any) => {
      utterance = value;
      value.onend();
    },
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  const engine = new BrowserSpeech();
  await engine.speak("Добры дзень", initialState().settings, "be");
  expect(utterance.lang).toBe("be-BY");
  expect(utterance.voice.name).toBe("Belarusian");
});
it("never silently substitutes the system voice when neural speech is unavailable", async () => {
  const system = {
    voices: async () => [
      { id: "en", name: "English", language: "en-US", local: true },
    ],
    speak: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  vi.stubGlobal("caches", undefined);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const engine = new HybridSpeech(system);
  await expect(
    engine.speak("Hello", { ...initialState().settings, speechMode: "auto" }),
  ).rejects.toBeInstanceOf(NeuralVoiceUnavailableError);
  expect(system.speak).not.toHaveBeenCalled();
});
it("uses the device voice only after the user explicitly selects the emergency mode", async () => {
  const system = {
    voices: async () => [
      { id: "en", name: "English", language: "en-US", local: true },
    ],
    speak: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  vi.stubGlobal("caches", undefined);
  vi.stubGlobal("localStorage", { getItem: () => null });
  await new HybridSpeech(system).speak("Hello", {
    ...initialState().settings,
    speechMode: "system",
  });
  expect(system.speak).toHaveBeenCalledOnce();
});
it("handles microphone permission denial with a useful error", async () => {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    },
  });
  vi.stubGlobal("MediaRecorder", class {});
  await expect(new VoiceRecorder().start(() => {})).rejects.toThrow(
    "permission was denied",
  );
});
it("records a blob and releases every microphone track", async () => {
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: any;
      onstop: any;
      start() {
        this.state = "recording";
      }
      stop() {
        this.ondataavailable({ data: new Blob(["voice"]) });
        this.state = "inactive";
        this.onstop?.();
      }
    },
  );
  const r = new VoiceRecorder();
  await r.start(() => {});
  expect((await r.stop()).size).toBe(5);
  expect(stop).toHaveBeenCalledOnce();
});
it("releases microphone after cancellation and invokes time limit", async () => {
  vi.useFakeTimers();
  const stop = vi.fn(),
    limit = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      state = "recording";
      start() {}
      stop() {
        this.state = "inactive";
      }
    },
  );
  const r = new VoiceRecorder();
  await r.start(limit);
  vi.advanceTimersByTime(60000);
  expect(limit).toHaveBeenCalledOnce();
  r.cancel();
  expect(stop).toHaveBeenCalledOnce();
});
it("requires explicit consent and valid text for personalized synthesis", () => {
  expect(() => validateVoiceRequest("Hello", false)).toThrow("consent");
  expect(() => validateVoiceRequest("", true)).toThrow();
  expect(() => validateVoiceRequest("Hello", true)).not.toThrow();
});
