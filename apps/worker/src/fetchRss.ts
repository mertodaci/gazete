import Parser from "rss-parser";
import { prisma } from "@gazete/db";

function getParser() {
  return new Parser();
}

export async function fetchAllSources(): Promise<{ sourceId: string; sourceName: string; error: string }[]> {
  const sources = await prisma.source.findMany({ where: { active: true } });
  const errors: { sourceId: string; sourceName: string; error: string }[] = [];

  for (const source of sources) {
    try {
      const feed = await getParser().parseURL(source.rssUrl);

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        const alreadyExists = await prisma.article.findUnique({ where: { url: item.link } });
        if (alreadyExists) continue;

        await prisma.article.create({
          data: {
            sourceId: source.id,
            url: item.link,
            title: item.title,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
            rawDescription: item.contentSnippet ?? null
          }
        });
      }
    } catch (err) {
      errors.push({ sourceId: source.id, sourceName: source.name, error: (err as Error).message });
    }
  }

  return errors;
}
