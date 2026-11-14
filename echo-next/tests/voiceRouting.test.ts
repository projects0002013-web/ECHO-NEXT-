import { describe, expect, it } from "vitest";
import { resolveVoiceRoute } from "../src/services/voiceRouting";

const base = {
  isOnline: false,
  onlineProviderConfigured: false,
  language: "en",
  supertonicInstalled: true,
  kokoroInstalled: true,
  systemVoiceAvailable: true,
};

describe("resolveVoiceRoute", () => {
  it("uses online speech only when connection and provider are both available", () => {
    expect(resolveVoiceRoute({
      ...base,
      isOnline: true,
      onlineProviderConfigured: true,
    })).toMatchObject({ mode: "online", engine: "online", reason: "online-ready" });
  });

  it("never selects an unconfigured online provider", () => {
    expect(resolveVoiceRoute({
      ...base,
      isOnline: true,
      onlineProviderConfigured: false,
    })).toMatchObject({ mode: "offline", engine: "kokoro" });
  });

  it("uses Kokoro for English by default", () => {
    expect(resolveVoiceRoute(base)).toMatchObject({
      mode: "offline", engine: "kokoro", requiresModelDownload: false,
    });
  });

  it("asks for the model when the selected offline model is not installed", () => {
    expect(resolveVoiceRoute({ ...base, kokoroInstalled: false })).toMatchObject({
      mode: "offline", engine: "kokoro", requiresModelDownload: true,
      reason: "offline-model-not-installed",
    });
  });

  it("uses Supertonic for Russian when available", () => {
    expect(resolveVoiceRoute({ ...base, language: "ru-RU" })).toMatchObject({
      mode: "offline", engine: "supertonic",
    });
  });

  it("uses system speech for Kazakh rather than claiming neural support", () => {
    expect(resolveVoiceRoute({ ...base, language: "kk-KZ" })).toMatchObject({
      mode: "offline", engine: "system", reason: "offline-language-fallback",
    });
  });

  it("honors a supported offline preference", () => {
    expect(resolveVoiceRoute({
      ...base,
      language: "en",
      preferredOfflineEngine: "supertonic",
    })).toMatchObject({ mode: "offline", engine: "supertonic" });
  });

  it("normalizes language tags with underscores", () => {
    expect(resolveVoiceRoute({ ...base, language: "ru_RU" })).toMatchObject({
      engine: "supertonic",
    });
  });
});
