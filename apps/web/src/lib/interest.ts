import { MAX_INTEREST_TEXT_LENGTH } from "@gazete/db";
import { isInterestTextAllowed } from "./moderation";
import { getEmbedding } from "./embeddings";

export interface InterestResult {
  interestText: string | null;
  interestEmbedding: number[];
  // True when the submitted text was dropped (too long, or failed
  // moderation) — the rest of a subscribe/preferences submission still
  // succeeds; only the free-text interest itself is discarded.
  rejected: boolean;
}

// End-to-end handling of one optional free-text interest submission: trim,
// enforce the length cap, run moderation, then compute an embedding. Never
// throws — every failure path (too long, moderation rejection, embedding
// outage) resolves to a value the caller can act on directly.
export async function processInterestText(raw: string | undefined): Promise<InterestResult> {
  const trimmed = raw?.trim();
  if (!trimmed) return { interestText: null, interestEmbedding: [], rejected: false };
  if (trimmed.length > MAX_INTEREST_TEXT_LENGTH) {
    return { interestText: null, interestEmbedding: [], rejected: true };
  }

  const allowed = await isInterestTextAllowed(trimmed);
  if (!allowed) return { interestText: null, interestEmbedding: [], rejected: true };

  // A Voyage outage here doesn't reject the text — it's already moderated
  // and safe to store, it just won't match anything until a future digest
  // run or preference update succeeds in computing its embedding.
  const embedding = await getEmbedding(trimmed);
  return { interestText: trimmed, interestEmbedding: embedding ?? [], rejected: false };
}
