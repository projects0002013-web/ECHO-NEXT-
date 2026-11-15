import * as ort from "onnxruntime-web";

// Cloudflare Pages has a 25 MiB per-file limit. Keep the ONNX Runtime binary
// as one gzip asset rather than serving gzip bytes with a .wasm extension.
// WebAssembly is installed in memory before either neural engine initializes.
// The same asset is cached by ECHO's service worker for offline use.
let setupPromise: Promise<void> | undefined;

export async function prepareCloudflareWasm(): Promise<void> {
  if (import.meta.env.MODE !== "cloudflare") return;
  if (!setupPromise) {
    setupPromise = (async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}ort-runtime.wasm.gz`,
        { credentials: "same-origin" },
      );
      if (!response.ok) {
        throw new Error(`Offline voice engine file unavailable: HTTP ${response.status}`);
      }
      const downloaded = await response.arrayBuffer();
      const bytes = new Uint8Array(downloaded);
      // Some CDNs automatically decompress files during HTTP transport.
      const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
      const binary = compressed
        ? await new Response(
            new Blob([downloaded])
              .stream()
              .pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer()
        : downloaded;
      const header = new Uint8Array(binary, 0, 4);
      if (
        header.length !== 4 ||
        header[0] !== 0x00 ||
        header[1] !== 0x61 ||
        header[2] !== 0x73 ||
        header[3] !== 0x6d
      ) {
        throw new Error("Invalid offline voice engine binary.");
      }
      ort.env.wasm.wasmBinary = new Uint8Array(binary);
    })().catch((error: unknown) => {
      setupPromise = undefined;
      throw error;
    });
  }
  return setupPromise;
}
