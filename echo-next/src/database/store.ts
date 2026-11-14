import { openDB } from "idb";
import { z } from "zod";
export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  language: z.enum(["en", "ru", "be"]),
  rate: z.number().min(0.5).max(2),
  pitch: z.number().min(0.5).max(2),
  voice: z.string().max(500),
  textSize: z.number().min(14).max(24),
  cardSize: z.enum(["comfortable", "compact"]),
  reducedMotion: z.boolean(),
});
const categorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
});
const phraseSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(2000),
  categoryId: z.string().max(100),
  favorite: z.boolean(),
  language: z.enum(["en", "ru", "be"]),
  order: z.number().int().nonnegative(),
});
const profileSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  voice: z.string(),
  rate: z.number().min(0.5).max(2),
  pitch: z.number().min(0.5).max(2),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(categorySchema).max(100),
    phrases: z.array(phraseSchema).max(5000),
    history: z
      .array(
        z.object({
          id: z.string(),
          text: z.string().max(2000),
          at: z.number(),
        }),
      )
      .max(100),
    settings: settingsSchema,
    profiles: z.array(profileSchema).max(50),
  })
  .superRefine((s, c) => {
    for (const items of [s.categories, s.phrases, s.profiles, s.history])
      if (new Set(items.map((x) => x.id)).size !== items.length)
        c.addIssue({ code: "custom", message: "Duplicate identifiers" });
    if (s.phrases.some((p) => !s.categories.some((x) => x.id === p.categoryId)))
      c.addIssue({ code: "custom", message: "Unknown category" });
  });
export type State = z.infer<typeof stateSchema>;
export type Phrase = State["phrases"][number];
export type Settings = State["settings"];
export type Clip = { id: string; name: string; blob: Blob; createdAt: number };
export function initialState(): State {
  const groups = [
    [
      "Everyday",
      "Hello, how are you?",
      "Thank you.",
      "Yes, please.",
      "No, thank you.",
      "Please give me a moment.",
      "I use this app to communicate.",
    ],
    [
      "Needs",
      "I would like some water.",
      "I need a break.",
      "Could you help me, please?",
      "I need to use the bathroom.",
    ],
    [
      "Connection",
      "It’s good to see you.",
      "I have something to say.",
      "Could you speak a little slower?",
    ],
    [
      "Health",
      "I am in pain.",
      "Please call someone I trust.",
      "I need medical help.",
    ],
  ];
  return {
    version: 1,
    categories: groups.map((g, i) => ({ id: `c${i}`, name: g[0] })),
    phrases: groups
      .flatMap((g, i) =>
        g.slice(1).map((text, j) => ({
          id: `p${i}-${j}`,
          text,
          categoryId: `c${i}`,
          favorite: i === 0 && j < 3,
          language: "en" as "en" | "ru" | "be",
          order: j,
        })),
      )
      .concat([
        {
          id: "ru-1",
          text: "Пожалуйста, дайте мне немного времени.",
          categoryId: "c0",
          favorite: false,
          language: "ru",
          order: 6,
        },
        {
          id: "ru-2",
          text: "Мне нужна помощь.",
          categoryId: "c1",
          favorite: false,
          language: "ru",
          order: 4,
        },
      ]),
    history: [],
    settings: {
      theme: "light",
      language: "en",
      rate: 1,
      pitch: 1,
      voice: "",
      textSize: 16,
      cardSize: "comfortable",
      reducedMotion: false,
    },
    profiles: [],
  };
}
const db = () =>
  openDB("echo-next", 1, {
    upgrade(db) {
      db.createObjectStore("state");
      db.createObjectStore("clips", { keyPath: "id" });
    },
  });
export async function loadState(): Promise<State> {
  const d = await db();
  const value = await d.get("state", "current");
  return value ? stateSchema.parse(value) : initialState();
}
export async function saveState(s: State) {
  const d = await db();
  await d.put("state", stateSchema.parse(s), "current");
}
export async function getClips(): Promise<Clip[]> {
  return (await db()).getAll("clips");
}
export async function putClip(clip: Clip) {
  await (await db()).put("clips", clip);
}
export async function deleteClip(id: string) {
  await (await db()).delete("clips", id);
}
export function searchPhrases(
  s: State,
  query: string,
  category = "",
  favorite = false,
) {
  return s.phrases
    .filter(
      (p) =>
        (!category || p.categoryId === category) &&
        (!favorite || p.favorite) &&
        p.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.order - b.order);
}
export function removeCategory(s: State, id: string): State {
  return {
    ...s,
    categories: s.categories.filter((c) => c.id !== id),
    phrases: s.phrases.filter((p) => p.categoryId !== id),
  };
}
export function upsertPhrase(s: State, p: Phrase): State {
  return stateSchema.parse({
    ...s,
    phrases: [...s.phrases.filter((x) => x.id !== p.id), p],
  });
}
export function toggleFavorite(s: State, id: string): State {
  return {
    ...s,
    phrases: s.phrases.map((p) =>
      p.id === id ? { ...p, favorite: !p.favorite } : p,
    ),
  };
}
const backupSchema = z
  .object({
    format: z.literal("echo-backup"),
    state: stateSchema,
    clips: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().max(100),
          type: z.enum([
            "audio/webm",
            "audio/webm;codecs=opus",
            "audio/mp4",
            "audio/ogg",
            "audio/ogg;codecs=opus",
            "audio/wav",
          ]),
          data: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
          createdAt: z.number(),
        }),
      )
      .max(100),
  })
  .superRefine((backup, context) => {
    if (new Set(backup.clips.map((c) => c.id)).size !== backup.clips.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate recording identifiers",
      });
    // Check the decoded size before atob() allocates any audio buffers.
    // Imports must respect the same 30 MiB storage budget as recordings.
    const decodedSize = (data: string) =>
      Math.floor((data.length * 3) / 4) -
      (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
    const totalBytes = backup.clips.reduce(
      (total, clip) => total + decodedSize(clip.data),
      0,
    );
    if (totalBytes > 30 * 1024 * 1024)
      context.addIssue({
        code: "custom",
        message: "Recording backup exceeds the 30 MiB audio limit",
      });
  });
export async function exportBackup(s: State) {
  const clips = await getClips();
  const encoded = await Promise.all(
    clips.map(async (c) => ({
      ...c,
      blob: undefined,
      type: c.blob.type,
      data: await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(c.blob);
      }),
    })),
  );
  return JSON.stringify(
    { format: "echo-backup", state: s, clips: encoded },
    null,
    2,
  );
}
export function parseBackup(text: string) {
  if (text.length > 50 * 1024 * 1024) throw new Error("Backup exceeds 50 MB");
  return backupSchema.parse(JSON.parse(text));
}
export async function restoreBackup(text: string) {
  const parsed = parseBackup(text);
  const clips = parsed.clips.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    blob: new Blob([Uint8Array.from(atob(c.data), (v) => v.charCodeAt(0))], {
      type: c.type,
    }),
  }));
  const d = await db();
  const tx = d.transaction(["state", "clips"], "readwrite");
  await tx.objectStore("clips").clear();
  for (const c of clips) await tx.objectStore("clips").put(c);
  await tx.objectStore("state").put(parsed.state, "current");
  await tx.done;
  return parsed.state;
}
export async function eraseData() {
  const d = await db();
  const tx = d.transaction(["state", "clips"], "readwrite");
  await tx.objectStore("state").clear();
  await tx.objectStore("clips").clear();
  await tx.done;
}
