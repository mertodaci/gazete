import { prisma } from "@gazete/db";
import { titleSimilarity } from "./similarity";
import { summarizeArticle } from "./summarize";
import { istanbulToday } from "./istanbulDate";

const SIMILARITY_THRESHOLD = 0.5;

// Only summarize reasonably fresh articles. Without this bound, the very first
// run after deploy would pick up the entire current contents of every seeded
// RSS feed (hundreds of articles), spend one Claude call on each, and dump them
// all into today's digest. 36h gives an article that failed on one pass a few
// more hourly passes to succeed before it ages out.
const MAX_ARTICLE_AGE_MS = 36 * 60 * 60 * 1000;

export async function processNewArticles(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_MS);
  const unprocessed = await prisma.article.findMany({
    where: { storyArticles: { none: {} }, publishedAt: { gte: cutoff } },
    include: { source: true }
  });

  for (const article of unprocessed) {
    try {
      const todaysStories = await prisma.story.findMany({
        where: { category: article.source.category, digestDate: { gte: istanbulToday() } }
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
          digestDate: istanbulToday(),
          storyArticles: { create: { articleId: article.id } }
        }
      });
    } catch (err) {
      // Leave the article unlinked to any Story so the next hourly pass picks it
      // up again (as long as it is still inside the recency window), rather than
      // aborting the whole batch and abandoning every remaining article.
      console.error(`Failed to process article ${article.id} (${article.url}):`, err);
    }
  }
}
