import Anthropic from "@anthropic-ai/sdk";
import { Category } from "@gazete/db";
import { config } from "./config";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

// The categories Claude is allowed to classify into. "gundem" is offered only
// as an explicit fallback for content that fits none of the real topics
// (general/crime/court/human-interest news) — it's never shown to users, but
// keeping it as a valid classification target lets that content still get
// marked "processed" via a normal Story row instead of needing separate
// discard/retry handling. "son_dakika" is deliberately excluded: it's a
// cross-cutting flag (isBreaking), never a Story's actual category.
const CLASSIFIABLE_CATEGORIES = [
  "ekonomi",
  "teknoloji",
  "spor",
  "dunya",
  "saglik",
  "kultur_sanat",
  "gundem"
] as const;

export interface SummaryResult {
  summary: string;
  category: Category;
  isBreaking: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripJsonFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1] : text;
}

function parseSummaryResult(rawText: string): SummaryResult {
  const parsed = JSON.parse(stripJsonFence(rawText));

  if (typeof parsed.summary !== "string" || parsed.summary.trim().length === 0) {
    throw new Error(`Invalid AI classification response (bad summary): ${rawText}`);
  }
  if (!CLASSIFIABLE_CATEGORIES.includes(parsed.category)) {
    throw new Error(`Invalid AI classification response (bad category): ${rawText}`);
  }
  if (typeof parsed.isBreaking !== "boolean") {
    throw new Error(`Invalid AI classification response (bad isBreaking): ${rawText}`);
  }

  return { summary: parsed.summary.trim(), category: parsed.category, isBreaking: parsed.isBreaking };
}

async function requestSummary(title: string, description: string | null): Promise<SummaryResult> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Aşağıdaki haberi analiz et ve SADECE aşağıdaki alanları içeren geçerli bir JSON nesnesi döndür. JSON dışında hiçbir açıklama, giriş cümlesi veya markdown kod bloğu ekleme.

Alanlar:
- "summary": Haberin 2-3 cümlelik tarafsız bir Türkçe özeti.
- "category": Haberin ait olduğu kategori. Şu değerlerden SADECE biri olmalı: "ekonomi", "teknoloji", "spor", "dunya", "saglik", "kultur_sanat". Bu kategorilerden hiçbiri gerçekten uymuyorsa (örneğin genel gündem, suç, mahkeme, magazin haberi ise) "gundem" değerini kullan.
- "isBreaking": Bu haber büyük, kesin ve yüksek etkili bir gelişme mi? SADECE şu türde haberler için true yaz: tanınmış bir kişinin ölümü, büyük bir doğal afet veya kaza, önemli bir piyasa şoku, üst düzey bir spor müsabakasında büyük bir sonuç, önemli bir savaş/politika gelişmesi. Rutin açıklamalar, ön izlemeler, olağan günlük gelişmeler için false yaz. Çoğu haber false olmalı.

Başlık: ${title}
Açıklama: ${description ?? "(yok)"}

Yanıtın SADECE şu formatta olsun, başka hiçbir şey yazma:
{"summary": "...", "category": "...", "isBreaking": false}`
      }
    ]
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Claude response contained no text block");
  }
  return parseSummaryResult(block.text.trim());
}

/**
 * Classifies and summarizes an article in one call, retrying transient
 * failures (network errors, or a malformed/non-JSON response) up to
 * MAX_ATTEMPTS times with exponential backoff (500ms, then 1500ms). If every
 * attempt fails the error is rethrown, and the caller leaves the article
 * unprocessed so the next cycle can retry it.
 */
export async function summarizeArticle(title: string, description: string | null): Promise<SummaryResult> {
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
