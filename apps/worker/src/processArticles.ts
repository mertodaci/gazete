import { prisma, DEDUP_SIMILARITY_THRESHOLD } from "@gazete/db";
import { titleSimilarity } from "./similarity";
import { summarizeArticle } from "./summarize";
import { getEmbedding, cosineSimilarity } from "./embeddings";
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
    where: { storyArticles: { none: {} }, publishedAt: { gte: cutoff } }
  });

  for (const article of unprocessed) {
    try {
      // Cross-category on purpose: the same real-world event can be covered by
      // sources we've bucketed into different categories (a general feed and a
      // topic-specific one), and it's still one story regardless of who wrote
      // about it.
      const todaysStories = await prisma.story.findMany({
        where: { digestDate: { gte: istanbulToday() } }
      });

      // Word-overlap similarity alone missed same-event articles that
      // different outlets phrased very differently (e.g. one led with the
      // minister's name, another with "dev operasyon") — semantic similarity
      // via embeddings catches what token overlap can't. This costs one
      // Voyage call per article regardless of outcome (Voyage's embeddings
      // are priced far below Claude's per-token cost, effectively free at
      // this project's volume), unlike the free title-only check above.
      const embedding = await getEmbedding(article.title);
      const match = todaysStories.find(
        (story) =>
          titleSimilarity(story.canonicalTitle, article.title) >= SIMILARITY_THRESHOLD ||
          (embedding &&
            story.interestEmbedding.length > 0 &&
            cosineSimilarity(embedding, story.interestEmbedding) >= DEDUP_SIMILARITY_THRESHOLD)
      );

      if (match) {
        await prisma.storyArticle.create({ data: { storyId: match.id, articleId: article.id } });
        continue;
      }

      const result = await summarizeArticle(article.title, article.rawDescription);
      // Reuses the title embedding already computed above for the dedup
      // check — no second Voyage call needed just because this article
      // turned out not to be a duplicate. A failed embedding call just means
      // this story is never eligible for personalized ("Senin İçin")
      // matching or future semantic dedup — it must not block story
      // creation, which is why this isn't inside the same try/catch scope
      // as a hard requirement.
      await prisma.story.create({
        data: {
          category: result.category,
          canonicalTitle: article.title,
          aiSummaryTr: result.summary,
          isBreaking: result.isBreaking,
          interestEmbedding: embedding ?? [],
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
