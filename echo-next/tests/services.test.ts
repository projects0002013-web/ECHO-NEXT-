import { it, expect, vi, afterEach } from "vitest";
import { BrowserSpeech, speechLocale } from "../src/services/speech";
import { VoiceRecorder } from "../src/services/recorder";
import { initialState } from "../src/database/store";
import { validateVoiceRequest } from "../src/services/ai";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("maps Belarusian to the correct BCP-47 voice locale", () => {
  expect(speechLocale("be")).toBe("be-BY");
  expect(speechLocale("ru")).toBe("ru-RU");
  expect(speechLocale("en")).toBe("en-US");
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
