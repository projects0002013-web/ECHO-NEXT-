import { describe, expect, it } from "vitest";
import { assessVoiceSample } from "../src/services/voiceSample";

function signal(seconds: number, amplitude: number, clipped = false) {
  const sampleRate = 1000;
  const samples = new Float32Array(seconds * sampleRate);
  for (let index = 0; index < samples.length; index++)
    samples[index] =
      clipped && index % 10 === 0 ? 1 : Math.sin(index / 10) * amplitude;
  return { samples, sampleRate };
}

describe("personal voice sample quality gate", () => {
  it("accepts a usable local sample", () => {
    const { samples, sampleRate } = signal(5, 0.2);
    const result = assessVoiceSample([samples], sampleRate);
    expect(result.accepted).toBe(true);
    expect(result.durationSeconds).toBe(5);
    expect(result.rms).toBeGreaterThan(0.1);
  });

  it("rejects short, silent and clipped samples with clear reasons", () => {
    const quiet = assessVoiceSample([signal(2, 0).samples], 1000);
    expect(quiet.accepted).toBe(false);
    expect(quiet.problems).toEqual(
      expect.arrayContaining([
        "Record at least 3 seconds.",
        "The sample is silent or too quiet.",
      ]),
    );
    const clipped = assessVoiceSample([signal(5, 0.2, true).samples], 1000);
    expect(clipped.problems).toContain(
      "The sample is distorted or clipped. Record more quietly.",
    );
  });
});
