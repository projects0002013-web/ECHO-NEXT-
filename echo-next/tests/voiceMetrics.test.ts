import { describe, expect, it, vi } from "vitest";
import {
  loadVoiceMetrics,
  modeForSteps,
  recordVoiceMetric,
  summarizeVoiceMetrics,
} from "../src/services/voiceMetrics";

describe("real voice performance observations", () => {
  it("maps the published quality modes to inference steps", () => {
    expect(modeForSteps(5)).toBe("fast");
    expect(modeForSteps(8)).toBe("balanced");
    expect(modeForSteps(12)).toBe("quality");
  });

  it("persists at most thirty completed observations", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    for (let index = 0; index < 35; index++) {
      recordVoiceMetric({
        mode: "fast",
        elapsedMs: 1000,
        textCharacters: 20,
        audioBytes: 100,
        recordedAt: index,
      });
    }
    expect(loadVoiceMetrics()).toHaveLength(30);
  });

  it("summarizes measured values without inventing missing modes", () => {
    expect(
      summarizeVoiceMetrics([
        {
          mode: "fast",
          elapsedMs: 1000,
          textCharacters: 20,
          audioBytes: 10,
          recordedAt: 1,
        },
        {
          mode: "fast",
          elapsedMs: 2000,
          textCharacters: 20,
          audioBytes: 10,
          recordedAt: 2,
        },
      ]),
    ).toEqual([
      { mode: "fast", samples: 2, averageMs: 1500, charactersPerSecond: 15 },
    ]);
  });
});
