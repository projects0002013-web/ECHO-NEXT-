import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  // Kokoro/Transformers and Supertonic must share the app-level ONNX Runtime.
  // Without deduplication Vite bundles two incompatible runtime copies and
  // emits duplicate ~20–30 MiB WASM assets.
  resolve: {
    dedupe: ["onnxruntime-web"],
  },
  test: {
    include: ["tests/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
