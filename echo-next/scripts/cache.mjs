import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.VITE_BASE_PATH || "/";
if (!/^\/(?:[\w-]+\/)*$/.test(base))
  throw new Error(
    "VITE_BASE_PATH must be an absolute directory path ending in /",
  );
const files = [
  "index.html",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
  ...(await readdir("dist/assets")).map((f) => "assets/" + f),
];
const hash = createHash("sha256").update(base);
for (const file of files) hash.update(await readFile("dist/" + file));
const prefix = "echo-shell-" + encodeURIComponent(base) + "-";
const config = {
  base,
  prefix,
  cache: prefix + hash.digest("hex").slice(0, 12),
  assets: [base, ...files.map((f) => base + f)],
};
await writeFile(
  "dist/sw.js",
  "const CONFIG = " +
    JSON.stringify(config) +
    ";\n" +
    (await readFile("public/sw.js", "utf8")),
);
