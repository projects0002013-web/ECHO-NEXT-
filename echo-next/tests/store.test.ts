import { describe, it, expect, beforeEach } from "vitest";
import {
  initialState,
  stateSchema,
  saveState,
  loadState,
  upsertPhrase,
  toggleFavorite,
  removeCategory,
  searchPhrases,
  parseBackup,
  restoreBackup,
  eraseData,
  getClips,
  putClip,
} from "../src/database/store";
beforeEach(async () => {
  await eraseData();
});
describe("local communication data", () => {
  it("persists a created phrase and an edit across database reads", async () => {
    let s = initialState();
    const phrase = {
      id: "custom",
      text: "Please wait.",
      categoryId: "c0",
      favorite: false,
      language: "en" as const,
      order: 20,
    };
    s = upsertPhrase(s, phrase);
    await saveState(s);
    expect(
      (await loadState()).phrases.find((p) => p.id === "custom")?.text,
    ).toBe("Please wait.");
    s = upsertPhrase(s, { ...phrase, text: "I need time." });
    await saveState(s);
    expect(
      (await loadState()).phrases.find((p) => p.id === "custom")?.text,
    ).toBe("I need time.");
  });
  it("deletes a phrase and toggles favorites", () => {
    let s = initialState();
    s = toggleFavorite(s, "p0-0");
    expect(s.phrases[0].favorite).toBe(false);
    s = { ...s, phrases: s.phrases.filter((p) => p.id !== "p0-0") };
    expect(searchPhrases(s, "Hello")).toHaveLength(0);
  });
  it("searches case insensitively and filters categories and favorites", () => {
    const s = initialState();
    expect(searchPhrases(s, "THANK")).toHaveLength(2);
    expect(searchPhrases(s, "", "c1").every((p) => p.categoryId === "c1")).toBe(
      true,
    );
    expect(searchPhrases(s, "", "", true)).toHaveLength(3);
    expect(searchPhrases(s, "помощь")).toHaveLength(1);
  });
  it("deletes category phrases without orphan records", () => {
    const s = removeCategory(initialState(), "c0");
    expect(s.categories.some((c) => c.id === "c0")).toBe(false);
    expect(s.phrases.some((p) => p.categoryId === "c0")).toBe(false);
  });
  it("accepts and persists Belarusian interface and phrase language", async () => {
    const s = initialState();
    s.settings.language = "be";
    s.phrases.push({
      id: "be-test",
      text: "Добры дзень.",
      categoryId: "c0",
      favorite: false,
      language: "be",
      order: 50,
    });
    await saveState(s);
    const restored = await loadState();
    expect(restored.settings.language).toBe("be");
    expect(restored.phrases.find((p) => p.id === "be-test")?.language).toBe("be");
  });
  it("defaults the new speech mode when reading legacy saved data", () => {
    const legacy = initialState();
    const legacySettings = { ...legacy.settings };
    Reflect.deleteProperty(legacySettings, "speechMode");
    const restored = stateSchema.parse({ ...legacy, settings: legacySettings });
    expect(restored.settings.speechMode).toBe("auto");
  });
  it("persists the selected speech engine mode", async () => {
    const s = initialState();
    s.settings.speechMode = "neural";
    await saveState(s);
    expect((await loadState()).settings.speechMode).toBe("neural");
  });
  it("persists theme and accessibility preferences", async () => {
    const s = initialState();
    s.settings.theme = "dark";
    s.settings.textSize = 22;
    await saveState(s);
    expect((await loadState()).settings).toMatchObject({
      theme: "dark",
      textSize: 22,
    });
  });
  it("restores a validated backup transactionally", async () => {
    const s = initialState();
    s.phrases[0].text = "Restored phrase";
    await restoreBackup(
      JSON.stringify({
        format: "echo-backup",
        state: s,
        clips: [
          {
            id: "clip",
            name: "My voice",
            type: "audio/mp4",
            data: "AQID",
            createdAt: 1,
          },
        ],
      }),
    );
    expect((await loadState()).phrases[0].text).toBe("Restored phrase");
    expect((await getClips())[0].blob.size).toBe(3);
  });
  it.each([
    "{}",
    '{"format":"echo-backup","state":{"version":2},"clips":[]}',
    "not json",
  ])("rejects invalid backup %s", (text) => {
    expect(() => parseBackup(text)).toThrow();
  });
  it("rejects orphans, duplicate ids and invalid settings before import", () => {
    const s = initialState();
    s.phrases[0].categoryId = "missing";
    expect(() =>
      parseBackup(
        JSON.stringify({ format: "echo-backup", state: s, clips: [] }),
      ),
    ).toThrow();
    s.phrases[0].categoryId = "c0";
    s.categories.push(s.categories[0]);
    expect(() =>
      parseBackup(
        JSON.stringify({ format: "echo-backup", state: s, clips: [] }),
      ),
    ).toThrow();
  });
  it("rejects oversized audio backups without replacing user data", async () => {
    const before = initialState();
    before.phrases[0].text = "Keep this phrase";
    await saveState(before);
    // 30 MiB decoded audio limit: 42 million base64 characters exceed it.
    const oversized = "A".repeat(42 * 1024 * 1024);
    const payload = JSON.stringify({
      format: "echo-backup",
      state: initialState(),
      clips: [{
        id: "oversized",
        name: "Too large",
        type: "audio/mp4",
        data: oversized,
        createdAt: 1,
      }],
    });
    await expect(restoreBackup(payload)).rejects.toThrow();
    expect((await loadState()).phrases[0].text).toBe("Keep this phrase");
    expect(await getClips()).toHaveLength(0);
  });
  it("keeps saved data intact after rejected import", async () => {
    await saveState(initialState());
    await expect(restoreBackup("{}")).rejects.toThrow();
    expect((await loadState()).phrases.length).toBeGreaterThan(0);
  });
  it("persists and erases recorded blobs", async () => {
    await putClip({
      id: "clip",
      name: "Hello",
      blob: new Blob(["hello"], { type: "audio/webm" }),
      createdAt: 1,
    });
    expect(await getClips()).toHaveLength(1);
    await eraseData();
    expect(await getClips()).toHaveLength(0);
  });
});
