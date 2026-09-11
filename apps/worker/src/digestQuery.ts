import { prisma } from "@gazete/db";

export interface StoryWithSources {
  id: string;
  category: string;
  canonicalTitle: string;
  aiSummaryTr: string;
  sources: { name: string; url: string }[];
}

export async function getStoriesForSubscriber(subscriberId: string, digestDate: Date): Promise<StoryWithSources[]> {
  const categories = await prisma.subscriberCategory.findMany({ where: { subscriberId } });
  if (categories.length === 0) return [];

  const stories = await prisma.story.findMany({
    where: {
      digestDate,
      category: { in: categories.map((c) => c.category) }
    },
    include: {
      storyArticles: { include: { article: { include: { source: true } } } }
    }
  });

  return stories
    .filter((story) => story.aiSummaryTr !== null)
    .map((story) => ({
      id: story.id,
      category: story.category,
      canonicalTitle: story.canonicalTitle,
      aiSummaryTr: story.aiSummaryTr as string,
      sources: story.storyArticles.map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
    }));
}
