import { prisma, Category, MAX_BREAKING_STORIES, BREAKING_WINDOW_MS } from "@gazete/db";

export interface StoryWithSources {
  id: string;
  category: string;
  canonicalTitle: string;
  aiSummaryTr: string;
  isBreaking: boolean;
  sources: { name: string; url: string }[];
}

export async function subscriberSelectedCategories(subscriberId: string): Promise<Category[]> {
  const categories = await prisma.subscriberCategory.findMany({ where: { subscriberId } });
  return categories.map((c) => c.category);
}

export async function getStoriesForSubscriber(subscriberId: string, digestDate: Date): Promise<StoryWithSources[]> {
  const categories = await prisma.subscriberCategory.findMany({ where: { subscriberId } });
  if (categories.length === 0) return [];

  const realCategories = categories.map((c) => c.category).filter((c) => c !== Category.son_dakika);
  const wantsBreaking = categories.some((c) => c.category === Category.son_dakika);
  const breakingSince = new Date(Date.now() - BREAKING_WINDOW_MS);

  const orConditions = [
    ...(realCategories.length > 0 ? [{ category: { in: realCategories } }] : []),
    ...(wantsBreaking ? [{ isBreaking: true, createdAt: { gte: breakingSince } }] : [])
  ];
  if (orConditions.length === 0) return [];

  const stories = await prisma.story.findMany({
    where: { digestDate, OR: orConditions },
    include: {
      storyArticles: { include: { article: { include: { source: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });

  const mapped = stories
    .filter((story) => story.aiSummaryTr !== null)
    .map((story) => ({
      id: story.id,
      category: story.category,
      canonicalTitle: story.canonicalTitle,
      aiSummaryTr: story.aiSummaryTr as string,
      // Only true when it should render in *this subscriber's* Son Dakika
      // section: they opted into son_dakika, the AI flagged it, and it's
      // still within the 12h window. A story that only matched because it's
      // in one of the subscriber's real categories (not because they selected
      // son_dakika) must never surface a Son Dakika section for them, even if
      // it happens to be breaking for someone else.
      isBreaking: wantsBreaking && story.isBreaking && story.createdAt >= breakingSince,
      sources: story.storyArticles.map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
    }));

  // The hard volume cap, on top of the 12h window already applied in the OR
  // clause above — independent of how well the AI's prompt performs.
  const breaking = mapped.filter((s) => s.isBreaking).slice(0, MAX_BREAKING_STORIES);
  const nonBreaking = mapped.filter((s) => !s.isBreaking);
  return [...breaking, ...nonBreaking];
}
