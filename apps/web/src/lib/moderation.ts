import Anthropic from "@anthropic-ai/sdk";

// Category taxonomy mirrors OpenAI's Moderation API (a well-established,
// industry-standard set) rather than an ad-hoc list — see
// https://developers.openai.com/api/reference/go/resources/moderations.
// This gate runs once, when a subscriber sets or updates their free-text
// interest — never per-digest — so its cost is negligible regardless of
// subscriber count.
const MODERATION_PROMPT = (text: string) => `Aşağıdaki metni bir haber bülteni aboneliğinin "ilgi alanı" alanına biri
göndermek istiyor. Metni şu kategorilere göre denetle: taciz/tehdit, nefret
söylemi (özellikle şiddet içeren), yasa dışı faaliyet (özellikle şiddet
içeren), kendine zarar verme (özendirme/niyet/talimat), cinsel içerik
(özellikle reşit olmayanlarla ilgili), şiddet (özellikle grafik şiddet),
gerçek ve isimlendirilmiş özel bir şahsı hedef alma/taciz etme amacı.

Metin bu kategorilerden HİÇBİRİNE girmiyorsa ve sıradan bir ilgi alanı
tanımıysa (örn. "yapay zeka, deprem, İzmir haberleri") izin ver.

SADECE aşağıdaki formatta, başka hiçbir şey yazmadan geçerli bir JSON nesnesi
döndür: {"allowed": true} veya {"allowed": false}

Metin: ${text}`;

function parseAllowed(rawText: string): boolean {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const parsed = JSON.parse(fenced ? fenced[1] : rawText);
  if (typeof parsed.allowed !== "boolean") {
    throw new Error(`Invalid moderation response: ${rawText}`);
  }
  return parsed.allowed;
}

// Fails closed: any error (network, malformed response, API outage) rejects
// the text rather than risking unmoderated content ever being stored or
// echoed back into a branded email — this is the industry-standard default
// for safety-critical classification, and the feature is purely additive
// (the rest of a subscribe/preferences submission still succeeds without it).
export async function isInterestTextAllowed(text: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: MODERATION_PROMPT(text) }]
    });
    const block = message.content[0];
    if (block.type !== "text") return false;
    return parseAllowed(block.text.trim());
  } catch {
    return false;
  }
}
