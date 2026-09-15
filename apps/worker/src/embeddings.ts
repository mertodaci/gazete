import { config } from "./config";

// Voyage AI has no official Node SDK — a plain REST call is the documented
// integration path, consistent with this project's other external-API
// modules (marketData.ts). Any failure (network, invalid key, quota) must
// degrade to "no embedding" rather than block story processing — a story
// without an embedding simply isn't eligible for personalized ("Senin İçin")
// matching that day.
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.voyageApiKey}`
      },
      body: JSON.stringify({ input: [text], model: "voyage-4-lite" })
    });
    if (!res.ok) return null;
    const json = await res.json();
    const embedding = json?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.some((n: unknown) => typeof n !== "number")) return null;
    return embedding;
  } catch {
    return null;
  }
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
