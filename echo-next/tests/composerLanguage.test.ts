import { describe, expect, it } from "vitest";
import { resolveComposerSpeechLanguage as resolve } from "../src/services/composerLanguage";

describe("Communicate composer language selection", () => {
  it("routes Russian Cyrillic text to Supertonic even with English UI", () => {
    expect(resolve("привет", "en")).toBe("ru");
    expect(resolve("Мне нужна помощь.", "en")).toBe("ru");
  });
  it("recognizes Belarusian-specific letters and does not silently substitute Russian", () => {
    expect(resolve("Калі ласка, дапамажыце мне ўстаць", "en")).toBe("be");
    expect(resolve("Мне патрэбна дапамога", "en", "be")).toBe("be");
  });
  it("honors explicit user choice for ambiguous text", () => {
    expect(resolve("Добры дзень", "en", "be")).toBe("be");
    expect(resolve("Hello", "en", "ru")).toBe("ru");
  });
  it("keeps English and empty text appropriate to the interface language", () => {
    expect(resolve("Hello, world!", "ru")).toBe("en");
    expect(resolve("", "ru")).toBe("ru");
    expect(resolve("123", "be")).toBe("be");
  });
});
