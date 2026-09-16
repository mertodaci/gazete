const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestEmbedding(text: string): Promise<number[] | null> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`
    },
    body: JSON.stringify({ input: [text], model: "voyage-4-lite" })
  });
  if (res.status === 429) {
    throw new Error("Voyage rate limit (429)");
  }
  if (!res.ok) {
    console.error(`Voyage embedding request failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.some((n: unknown) => typeof n !== "number")) {
    console.error("Voyage embedding response had an unexpected shape:", JSON.stringify(json).slice(0, 200));
    return null;
  }
  return embedding;
}

// Mirrors apps/worker/src/embeddings.ts — Voyage AI has no official Node SDK,
// so a plain REST call is the documented integration path. Any failure
// (network, invalid key, quota) degrades to "no embedding" rather than
// blocking a subscribe/preferences submission — the rest of the form still
// saves, the subscriber's free-text interest just won't be matched against
// stories until a future update succeeds. A 429 is retried with backoff
// (1s, 3s) since it shares the same account-wide rate limit as the worker's
// hourly batch embedding calls and is usually transient.
export async function getEmbedding(text: string): Promise<number[] | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestEmbedding(text);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_BACKOFF_MS * 3 ** (attempt - 1);
        console.warn(`Embedding attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${delay}ms:`, err);
        await sleep(delay);
      } else {
        console.error(`Embedding failed after ${MAX_ATTEMPTS} attempts:`, err);
      }
    }
  }
  return null;
}
