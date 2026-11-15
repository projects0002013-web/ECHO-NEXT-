/** Detects local corruption, not authenticity. Legacy caches are baselined without deleting them. */
const HEADER = "x-echo-sha256";

export async function digestResponse(response: Response): Promise<string> {
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyCachedResponse(
  cache: Pick<Cache, "put">,
  key: RequestInfo | URL,
  response: Response,
): Promise<Response> {
  const actual = await digestResponse(response);
  const expected = response.headers.get(HEADER);
  if (expected && expected !== actual) {
    throw new Error(
      "Local model integrity check failed. Remove and reinstall this model.",
    );
  }
  if (!expected) await storeVerifiedResponse(cache, key, response, actual);
  return response;
}

export async function storeVerifiedResponse(
  cache: Pick<Cache, "put">,
  key: RequestInfo | URL,
  response: Response,
  digest?: string,
): Promise<void> {
  const headers = new Headers(response.headers);
  headers.set(HEADER, digest ?? (await digestResponse(response)));
  await cache.put(
    key,
    new Response(response.clone().body, { status: response.status, headers }),
  );
}

// Transformers swallows errors thrown by cache.match and then downloads again.
// A failed response body preserves the error until the loader reads the bytes.
export function failedModelResponse(error: unknown): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    }),
  );
}

export function verifiedModelCache(
  cache: Cache,
  localOnly: boolean,
  onWriteError: (error: unknown) => void,
) {
  return {
    async match(key: RequestInfo | URL) {
      try {
        const response = await cache.match(key);
        if (response) return await verifyCachedResponse(cache, key, response);
        // Transformers probes a local-path key before the canonical remote
        // URL. Let that probe miss so the cached URL key can still be found.
        if (localOnly && /^https?:\/\//u.test(String(key)))
          return failedModelResponse(
            new Error(
              "Model file missing locally. Use Load AI model to repair the installation online.",
            ),
          );
        return undefined;
      } catch (error) {
        return failedModelResponse(error);
      }
    },
    async put(key: RequestInfo | URL, response: Response) {
      try {
        await storeVerifiedResponse(cache, key, response);
      } catch (error) {
        onWriteError(error);
        throw error;
      }
    },
  };
}
