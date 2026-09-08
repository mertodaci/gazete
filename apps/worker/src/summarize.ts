import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

export async function summarizeArticle(title: string, description: string | null): Promise<string> {
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
