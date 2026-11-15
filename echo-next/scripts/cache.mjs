import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const base = process.env.VITE_BASE_PATH || "/";
if (!/^\/(?:[\w-]+\/)*$/.test(base))
  throw new Error(
    "VITE_BASE_PATH must be an absolute directory path ending in /",
  );
// Cloudflare Pages rejects individual files larger than 25 MiB. The ONNX
// Runtime WASM binary compresses well with gzip, so store the same .wasm URL
// as gzip bytes and let Pages decode it using the generated _headers file.
// Keep the normal build untouched for GitHub Pages and native Android builds.
const cloudflare = process.argv.includes("--cloudflare");
if (cloudflare) {
  const assetDir = "dist/assets";
  const wasmFiles = (await readdir(assetDir)).filter((name) => name.endsWith(".wasm"));
  if (wasmFiles.length !== 1) {
    throw new Error(`Expected one deduplicated ONNX WASM file, got ${wasmFiles.length}`);
  }
  const input = `${assetDir}/${wasmFiles[0]}`;
  const raw = await readFile(input);
  const zipped = gzipSync(raw, { level: 9 });
  if (zipped.byteLength > 25 * 1024 * 1024) {
    throw new Error("Cloudflare's ONNX runtime asset exceeds 25 MiB after gzip");
  }
  await writeFile("dist/ort-runtime.wasm.gz", zipped);
  await unlink(input);
  await writeFile(
    "dist/_headers",
    "/ort-runtime.wasm.gz\n  Content-Type: application/gzip\n  Cache-Control: public, max-age=31536000, immutable\n",
  );
}
const files = [
  "index.html",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
  ...(cloudflare ? ["ort-runtime.wasm.gz"] : []),
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
