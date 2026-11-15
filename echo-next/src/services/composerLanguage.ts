/** Decide the speech language for composer text without changing the interface locale.
 * Users may explicitly override auto-detection, especially for Belarusian. */
export type ComposerLanguage = "en" | "ru" | "be";
export type ComposerLanguageChoice = ComposerLanguage | "auto";

export function resolveComposerSpeechLanguage(
  text: string,
  interfaceLanguage: ComposerLanguage,
  choice: ComposerLanguageChoice = "auto",
): ComposerLanguage {
  if (choice !== "auto") return choice;
  if (/[іўІЎ]/u.test(text)) return "be";
  // These Cyrillic letters distinguish Russian from standard Belarusian orthography.
  if (/[иёъщИЁЪЩ]/u.test(text)) return "ru";
  if (/[а-яА-Я]/u.test(text)) return interfaceLanguage === "be" ? "be" : "ru";
  if (/[a-zA-Z]/u.test(text)) return "en";
  return interfaceLanguage;
}
