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

  it("keeps online speech disabled in offline-neural mode even when a provider exists", () => {
    expect(resolveVoiceRoute({
      ...base,
      isOnline: true,
      onlineProviderConfigured: true,
      modePreference: "neural",
    })).toMatchObject({ mode: "offline", engine: "kokoro" });
  });

  it("keeps online speech disabled in system-only mode", () => {
    expect(resolveVoiceRoute({
      ...base,
      isOnline: true,
      onlineProviderConfigured: true,
      modePreference: "system",
      preferredOfflineEngine: "system",
    })).toMatchObject({ mode: "offline", engine: "system" });
  });

  it("never selects an unconfigured online provider", () => {
    expect(resolveVoiceRoute({
      ...base,
      isOnline: true,
      onlineProviderConfigured: false,
    })).toMatchObject({ mode: "offline", engine: "kokoro" });
  });

  it("uses installed Kokoro for English by default", () => {
    expect(resolveVoiceRoute(base)).toMatchObject({
      mode: "offline", engine: "kokoro", requiresModelDownload: false,
    });
  });

  it("falls back to system speech when no English neural model is installed", () => {
    expect(resolveVoiceRoute({
      ...base,
      kokoroInstalled: false,
      supertonicInstalled: false,
    })).toMatchObject({
      mode: "offline", engine: "system", requiresModelDownload: false,
      recommendedDownload: "kokoro",
    });
  });

  it("uses installed Supertonic for Russian", () => {
    expect(resolveVoiceRoute({ ...base, language: "ru-RU" })).toMatchObject({
      mode: "offline", engine: "supertonic",
    });
  });

  it("falls back to system speech for Russian when Supertonic is not installed", () => {
    expect(resolveVoiceRoute({
      ...base, language: "ru-RU", supertonicInstalled: false,
    })).toMatchObject({
      mode: "offline", engine: "system", recommendedDownload: "supertonic",
    });
  });

  it("uses system speech for Kazakh rather than claiming neural support", () => {
    expect(resolveVoiceRoute({ ...base, language: "kk-KZ" })).toMatchObject({
      mode: "offline", engine: "system", reason: "offline-language-fallback",
    });
  });

  it("honors an installed offline preference", () => {
    expect(resolveVoiceRoute({
      ...base,
      language: "en",
      preferredOfflineEngine: "supertonic",
    })).toMatchObject({ mode: "offline", engine: "supertonic" });
  });

  it("falls back to Kokoro if preferred Supertonic is not installed for English", () => {
    expect(resolveVoiceRoute({
      ...base,
      language: "en",
      preferredOfflineEngine: "supertonic",
      supertonicInstalled: false,
      kokoroInstalled: true,
    })).toMatchObject({ mode: "offline", engine: "kokoro" });
  });

  it("respects system-only mode even if the device reports no matching voice", () => {
    expect(resolveVoiceRoute({
      ...base,
      preferredOfflineEngine: "system",
      systemVoiceAvailable: false,
    })).toMatchObject({ mode: "offline", engine: "system" });
  });

  it("normalizes language tags with underscores", () => {
    expect(resolveVoiceRoute({ ...base, language: "ru_RU" })).toMatchObject({
      engine: "supertonic",
    });
  });
});
