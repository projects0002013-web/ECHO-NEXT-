/**
 * Central policy for choosing ECHO's speech route.
 *
 * This module does not perform network requests or synthesize audio. It makes
 * the routing decision so the UI can call the selected engine and report
 * unavailable models honestly.
 */
export type SpeechEngine = "online" | "supertonic" | "kokoro" | "system";

export type VoiceRouteInput = {
  isOnline: boolean;
  onlineProviderConfigured: boolean;
  language: string;
  /** Whether the user has installed the model assets on this device. */
  supertonicInstalled: boolean;
  kokoroInstalled: boolean;
  systemVoiceAvailable: boolean;
  preferredOfflineEngine?: "supertonic" | "kokoro" | "system";
};

export type VoiceRoute = {
  mode: "online" | "offline";
  engine: SpeechEngine;
  reason:
    | "online-ready"
    | "offline-no-connection"
    | "online-provider-unavailable"
    | "offline-preferred-engine"
    | "offline-model-not-installed"
    | "offline-language-fallback";
  requiresModelDownload: boolean;
};

const SUPERTONIC_LANGUAGES = new Set([
  "en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et",
  "fi", "fr", "hi", "hr", "hu", "id", "it", "lt", "lv", "nl", "pl",
  "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "vi",
]);

function primaryLanguage(language: string): string {
  return language.trim().replaceAll("_", "-").split("-")[0].toLowerCase();
}

/**
 * Online speech is selected only when both connectivity and a real provider
 * are available. Otherwise the result is always an offline-capable engine.
 */
export function resolveVoiceRoute(input: VoiceRouteInput): VoiceRoute {
  if (input.isOnline && input.onlineProviderConfigured) {
    return {
      mode: "online",
      engine: "online",
      reason: "online-ready",
      requiresModelDownload: false,
    };
  }

  const language = primaryLanguage(input.language);
  const preferred = input.preferredOfflineEngine;

  if (preferred === "system" && input.systemVoiceAvailable) {
    return {
      mode: "offline", engine: "system",
      reason: input.isOnline ? "online-provider-unavailable" : "offline-no-connection",
      requiresModelDownload: false,
    };
  }

  if (
    (preferred === "kokoro" || (!preferred && language === "en")) &&
    language === "en"
  ) {
    return {
      mode: "offline", engine: "kokoro",
      reason: input.kokoroInstalled ? "offline-preferred-engine" : "offline-model-not-installed",
      requiresModelDownload: !input.kokoroInstalled,
    };
  }

  if (SUPERTONIC_LANGUAGES.has(language)) {
    return {
      mode: "offline", engine: "supertonic",
      reason: input.supertonicInstalled ? "offline-preferred-engine" : "offline-model-not-installed",
      requiresModelDownload: !input.supertonicInstalled,
    };
  }

  if (input.systemVoiceAvailable) {
    return {
      mode: "offline", engine: "system",
      reason: "offline-language-fallback",
      requiresModelDownload: false,
    };
  }

  // Return the system engine as a clear unavailable fallback. The caller must
  // check the installed voice list and show an actionable message if absent.
  return {
    mode: "offline", engine: "system",
    reason: "offline-language-fallback",
    requiresModelDownload: false,
  };
}
