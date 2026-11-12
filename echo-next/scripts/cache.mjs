import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((f) => "/assets/" + f);
const hash = createHash("sha256")
  .update(assets.join())
  .digest("hex")
  .slice(0, 12);
let sw = await readFile("public/sw.js", "utf8");
sw = sw
  .replace("'echo-shell-v1'", JSON.stringify("echo-shell-" + hash))
  .replace(
    "['/','/icon.svg','/manifest.webmanifest']",
    JSON.stringify([
      "/",
      "/index.html",
      "/icon.svg",
      "/icon-192.png",
      "/icon-512.png",
      "/manifest.webmanifest",
      ...assets,
    ]),
  );
await writeFile("dist/sw.js", sw);
