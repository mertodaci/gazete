import { prisma } from "@gazete/db";
import { titleSimilarity } from "./similarity";
import { summarizeArticle } from "./summarize";

const SIMILARITY_THRESHOLD = 0.5;

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function processNewArticles(): Promise<void> {
  const unprocessed = await prisma.article.findMany({
    where: { storyArticles: { none: {} } },
    include: { source: true }
  });

  for (const article of unprocessed) {
    const todaysStories = await prisma.story.findMany({
      where: { category: article.source.category, digestDate: { gte: startOfToday() } }
    });

    const match = todaysStories.find(
      (story) => titleSimilarity(story.canonicalTitle, article.title) >= SIMILARITY_THRESHOLD
    );

    if (match) {
      await prisma.storyArticle.create({ data: { storyId: match.id, articleId: article.id } });
      continue;
    }

    const summary = await summarizeArticle(article.title, article.rawDescription);
    await prisma.story.create({
      data: {
        category: article.source.category,
        canonicalTitle: article.title,
        aiSummaryTr: summary,
        digestDate: startOfToday(),
        storyArticles: { create: { articleId: article.id } }
      }
    });
  }
}
