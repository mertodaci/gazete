import { config } from "./config";

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
      authorization: `Bearer ${config.voyageApiKey}`
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

// Voyage AI has no official Node SDK — a plain REST call is the documented
// integration path, consistent with this project's other external-API
// modules (marketData.ts). Any failure (network, invalid key, quota) must
// degrade to "no embedding" rather than block story processing — a story
// without an embedding simply isn't eligible for personalized ("Senin İçin")
// matching or semantic dedup that day. A 429 specifically is retried with
// backoff (1s, 3s) since it's usually transient (a burst of articles in one
// hourly batch); every other failure mode returns null immediately.
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

// Both inputs come from the same embedding model, so they're always the same
// dimensionality — no length check needed.
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
