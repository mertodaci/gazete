import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestSummary(title: string, description: string | null): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Aşağıdaki haberi 2-3 cümlelik tarafsız bir Türkçe özet haline getir. Sadece özeti yaz, başka açıklama ekleme.\n\nBaşlık: ${title}\nAçıklama: ${description ?? "(yok)"}`
      }
    ]
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : title;
}

/**
 * Summarizes an article, retrying transient Claude API failures up to
 * MAX_ATTEMPTS times with exponential backoff (500ms, then 1500ms). If every
 * attempt fails the error is rethrown, and the caller leaves the article
 * unsummarized so the next cycle can retry it.
 */
export async function summarizeArticle(title: string, description: string | null): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestSummary(title, description);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_BACKOFF_MS * 3 ** (attempt - 1);
        console.warn(`Summarize attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${delay}ms:`, err);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
