import { SUPERTONIC_LANGUAGES as SUPPORTED_SUPERTONIC_LANGUAGES } from "./supertonic";

/**
 * Central policy for choosing ECHO's speech route.
 *
 * This module is deliberately pure: it never downloads a model or contacts a
 * provider. The caller supplies verified availability and owns fallbacks.
 */
export type SpeechEngine = "online" | "supertonic" | "kokoro" | "system";

export type VoiceRouteInput = {
  isOnline: boolean;
  onlineProviderConfigured: boolean;
  language: string;
  supertonicInstalled: boolean;
  kokoroInstalled: boolean;
  systemVoiceAvailable: boolean;
  preferredOfflineEngine?: "supertonic" | "kokoro" | "system";
  modePreference?: "auto" | "system" | "neural";
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
  recommendedDownload?: "supertonic" | "kokoro";
};

const SUPERTONIC_LANGUAGES = new Set<string>(
  SUPPORTED_SUPERTONIC_LANGUAGES.map(([code]) => code),
);

function primaryLanguage(language: string): string {
  return language.trim().replaceAll("_", "-").split("-")[0].toLowerCase();
}

function offlineReason(input: VoiceRouteInput): VoiceRoute["reason"] {
  return input.isOnline ? "online-provider-unavailable" : "offline-no-connection";
}

function systemFallback(
  input: VoiceRouteInput,
  recommendedDownload?: "supertonic" | "kokoro",
): VoiceRoute {
  return {
    mode: "offline",
    engine: "system",
    reason: input.systemVoiceAvailable
      ? recommendedDownload ? "offline-model-not-installed" : offlineReason(input)
      : "offline-language-fallback",
    requiresModelDownload: Boolean(recommendedDownload),
    ...(recommendedDownload ? { recommendedDownload } : {}),
  };
}

/**
 * Prefer a ready local neural model. If none is installed, keep communication
 * working with system TTS and tell the UI which optional model can be added.
 * Online speech is selected only when both connectivity and a real provider
 * are available.
 */
export function resolveVoiceRoute(input: VoiceRouteInput): VoiceRoute {
  if ((input.modePreference ?? "auto") === "auto" && input.isOnline && input.onlineProviderConfigured) {
    return {
      mode: "online",
      engine: "online",
      reason: "online-ready",
      requiresModelDownload: false,
    };
  }

  const language = primaryLanguage(input.language);
  const preferred = input.preferredOfflineEngine;

  if (preferred === "system") {
    return systemFallback(input);
  }

  if (preferred === "kokoro" && language === "en") {
    if (input.kokoroInstalled) {
      return { mode: "offline", engine: "kokoro", reason: "offline-preferred-engine", requiresModelDownload: false };
    }
    if (input.supertonicInstalled && SUPERTONIC_LANGUAGES.has(language)) {
      return { mode: "offline", engine: "supertonic", reason: "offline-preferred-engine", requiresModelDownload: false };
    }
    return systemFallback(input, "kokoro");
  }

  if (preferred === "supertonic" && SUPERTONIC_LANGUAGES.has(language)) {
    if (input.supertonicInstalled) {
      return { mode: "offline", engine: "supertonic", reason: "offline-preferred-engine", requiresModelDownload: false };
    }
    if (language === "en" && input.kokoroInstalled) {
      return { mode: "offline", engine: "kokoro", reason: "offline-preferred-engine", requiresModelDownload: false };
    }
    return systemFallback(input, "supertonic");
  }

  if (language === "en" && input.kokoroInstalled) {
    return { mode: "offline", engine: "kokoro", reason: "offline-preferred-engine", requiresModelDownload: false };
  }

  if (SUPERTONIC_LANGUAGES.has(language) && input.supertonicInstalled) {
    return { mode: "offline", engine: "supertonic", reason: "offline-preferred-engine", requiresModelDownload: false };
  }

  if (language === "en") return systemFallback(input, "kokoro");
  if (SUPERTONIC_LANGUAGES.has(language)) return systemFallback(input, "supertonic");
  return systemFallback(input);
}
