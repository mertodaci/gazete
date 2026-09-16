import Parser from "rss-parser";
import { prisma } from "@gazete/db";

function getParser() {
  // rss-parser's defaults are otherwise easy to trip on real feeds: no
  // redirects are followed (a feed that moved permanently just errors with
  // "Status code 301"), and its User-Agent literally identifies itself as
  // "rss-parser", which some sites' bot protection treats less favorably
  // than a browser-like one.
  return new Parser({
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    },
    maxRedirects: 5
  });
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
