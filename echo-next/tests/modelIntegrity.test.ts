import { describe, expect, it } from "vitest";
import {
  digestResponse,
  storeVerifiedResponse,
  verifiedModelCache,
  verifyCachedResponse,
} from "../src/services/modelIntegrity";

function memoryCache() {
  const values = new Map<string, Response>();
  return {
    values,
    cache: {
      async match(key: RequestInfo | URL) {
        return values.get(String(key))?.clone();
      },
      async put(key: RequestInfo | URL, value: Response) {
        values.set(String(key), value.clone());
      },
    } as Pick<Cache, "match" | "put"> as Cache,
  };
}

describe("offline model cache integrity", () => {
  it("stores a digest and accepts the unchanged model bytes", async () => {
    const { cache, values } = memoryCache();
    await storeVerifiedResponse(cache, "model", new Response("weights"));
    const saved = values.get("model")!;
    expect(saved.headers.get("x-echo-sha256")).toBe(
      await digestResponse(new Response("weights")),
    );
    await expect(verifyCachedResponse(cache, "model", saved)).resolves.toBe(
      saved,
    );
  });

  it("rejects model bytes changed after installation", async () => {
    const { cache, values } = memoryCache();
    await storeVerifiedResponse(cache, "model", new Response("weights"));
    const digest = values.get("model")!.headers.get("x-echo-sha256")!;
    await expect(
      verifyCachedResponse(
        cache,
        "model",
        new Response("tampered", { headers: { "x-echo-sha256": digest } }),
      ),
    ).rejects.toThrow(/integrity/);
  });

  it("baselines legacy cache entries without discarding user downloads", async () => {
    const { cache, values } = memoryCache();
    await verifyCachedResponse(cache, "legacy", new Response("old weights"));
    expect(values.get("legacy")?.headers.has("x-echo-sha256")).toBe(true);
    expect(await values.get("legacy")?.text()).toBe("old weights");
  });

  it("fails an offline restore when an asset is missing instead of fetching it", async () => {
    const { cache } = memoryCache();
    const guarded = verifiedModelCache(cache, true, () => undefined);
    expect(await guarded.match("/models/local-probe")).toBeUndefined();
    const response = await guarded.match("https://models.example/missing");
    await expect(response!.arrayBuffer()).rejects.toThrow(/missing locally/);
  });

  it("allows the Transformers local probe before returning the cached URL", async () => {
    const { cache } = memoryCache();
    await storeVerifiedResponse(
      cache,
      "https://models.example/weights.onnx",
      new Response("cached weights"),
    );
    const guarded = verifiedModelCache(cache, true, () => undefined);
    expect(
      await guarded.match("/models/repository/weights.onnx"),
    ).toBeUndefined();
    const cached = await guarded.match("https://models.example/weights.onnx");
    expect(await cached?.text()).toBe("cached weights");
  });
});
