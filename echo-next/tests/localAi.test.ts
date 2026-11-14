import { describe, expect, it } from "vitest";
import { AI_VOICES, validateAIText } from "../src/services/localAi";

describe("local neural speech input", () => {
  it("normalizes valid English text without contacting a model", () => {
    expect(validateAIText("  Hello ECHO.  ")).toBe("Hello ECHO.");
  });
  it("rejects empty or oversized requests before loading model", () => {
    expect(() => validateAIText(" ")).toThrow();
    expect(() => validateAIText("a".repeat(401))).toThrow();
  });
  it("rejects unsupported Cyrillic instead of mispronouncing it", () => {
    expect(() => validateAIText("Привет")).toThrow(/English/);
    expect(() => validateAIText("Сәлем")).toThrow(/English/);
  });
  it("exposes a small fixed set of recognized AI voices", () => {
    expect(AI_VOICES.length).toBeGreaterThan(1);
    expect(new Set(AI_VOICES.map((voice) => voice.id)).size).toBe(AI_VOICES.length);
  });
});
