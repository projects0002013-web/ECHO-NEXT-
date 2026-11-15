export type VoiceMode = "fast" | "balanced" | "quality";

export type VoiceMetric = {
  mode: VoiceMode;
  elapsedMs: number;
  textCharacters: number;
  audioBytes: number;
  recordedAt: number;
};

const KEY = "echo-supertonic-metrics-v1";
const LIMIT = 30;

export function modeForSteps(steps: number): VoiceMode {
  if (steps === 5) return "fast";
  if (steps === 8) return "balanced";
  return "quality";
}

export function loadVoiceMetrics(): VoiceMetric[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is VoiceMetric => {
        if (!item || typeof item !== "object") return false;
        const metric = item as Record<string, unknown>;
        return (
          ["fast", "balanced", "quality"].includes(String(metric.mode)) &&
          typeof metric.elapsedMs === "number" &&
          metric.elapsedMs > 0 &&
          typeof metric.textCharacters === "number" &&
          metric.textCharacters > 0 &&
          typeof metric.audioBytes === "number" &&
          metric.audioBytes > 0 &&
          typeof metric.recordedAt === "number"
        );
      })
      .slice(-LIMIT);
  } catch {
    return [];
  }
}

export function recordVoiceMetric(metric: VoiceMetric): VoiceMetric[] {
  const next = [...loadVoiceMetrics(), metric].slice(-LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Metrics are optional and never block communication.
  }
  return next;
}

export function summarizeVoiceMetrics(metrics: VoiceMetric[]) {
  return (["fast", "balanced", "quality"] as const).flatMap((mode) => {
    const samples = metrics.filter((metric) => metric.mode === mode);
    if (!samples.length) return [];
    return [
      {
        mode,
        samples: samples.length,
        averageMs: Math.round(
          samples.reduce((sum, metric) => sum + metric.elapsedMs, 0) /
            samples.length,
        ),
        charactersPerSecond: Number(
          (
            samples.reduce(
              (sum, metric) =>
                sum + metric.textCharacters / (metric.elapsedMs / 1000),
              0,
            ) / samples.length
          ).toFixed(1),
        ),
      },
    ];
  });
}
