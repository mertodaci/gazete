// Mirrors apps/worker/src/embeddings.ts — Voyage AI has no official Node SDK,
// so a plain REST call is the documented integration path. Any failure
// (network, invalid key, quota) degrades to "no embedding" rather than
// blocking a subscribe/preferences submission — the rest of the form still
// saves, the subscriber's free-text interest just won't be matched against
// stories until a future update succeeds.
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.VOYAGE_API_KEY}`
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
