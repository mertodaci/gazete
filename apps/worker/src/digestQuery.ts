import {
  prisma,
  Category,
  MAX_BREAKING_STORIES,
  BREAKING_WINDOW_MS,
  MAX_INTEREST_STORIES,
  INTEREST_SIMILARITY_THRESHOLD
} from "@gazete/db";
import { cosineSimilarity } from "./embeddings";

export interface StoryWithSources {
  id: string;
  category: string;
  canonicalTitle: string;
  aiSummaryTr: string;
  isBreaking: boolean;
  isPersonalized: boolean;
  sources: { name: string; url: string }[];
}

export async function subscriberSelectedCategories(subscriberId: string): Promise<Category[]> {
  const categories = await prisma.subscriberCategory.findMany({ where: { subscriberId } });
  return categories.map((c) => c.category);
}

export async function getStoriesForSubscriber(subscriberId: string, digestDate: Date): Promise<StoryWithSources[]> {
  const [categories, subscriber] = await Promise.all([
    prisma.subscriberCategory.findMany({ where: { subscriberId } }),
    prisma.subscriber.findUnique({ where: { id: subscriberId } })
  ]);
  if (categories.length === 0 || !subscriber) return [];

  const realCategories: Category[] = categories.map((c) => c.category).filter((c) => c !== Category.son_dakika);
  const wantsBreaking = categories.some((c) => c.category === Category.son_dakika);
  const breakingSince = new Date(Date.now() - BREAKING_WINDOW_MS);
  const interestEmbedding = subscriber.interestEmbedding;
  const hasInterest = interestEmbedding.length > 0;

  // Personalized ("Senin İçin") matching has to search every one of today's
  // stories regardless of category — including the invisible "gundem"
  // fallback, since that's exactly where a niche interest ("İzmir haberleri")
  // is likely to land. So when a subscriber has an interest embedding, fetch
  // all of today's stories unconditionally rather than only the categories
  // they picked; category/breaking membership is then just one more computed
  // property per story rather than a DB-level filter.
  const orConditions = [
    ...(realCategories.length > 0 ? [{ category: { in: realCategories } }] : []),
    ...(wantsBreaking ? [{ isBreaking: true, createdAt: { gte: breakingSince } }] : [])
  ];
  if (orConditions.length === 0 && !hasInterest) return [];

  const stories = await prisma.story.findMany({
    where: hasInterest ? { digestDate } : { digestDate, OR: orConditions },
    include: {
      storyArticles: { include: { article: { include: { source: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });

  const mapped = stories
    .filter((story) => story.aiSummaryTr !== null)
    .map((story) => {
      const matchesFixedSelection =
        realCategories.includes(story.category) ||
        (wantsBreaking && story.isBreaking && story.createdAt >= breakingSince);
      // Only surfaced as personalized when it wasn't already going to show up
      // via a category or Son Dakika the subscriber picked — otherwise every
      // Ekonomi story would double up in both that card and "Senin İçin".
      const isPersonalized =
        hasInterest &&
        !matchesFixedSelection &&
        story.interestEmbedding.length > 0 &&
        cosineSimilarity(interestEmbedding, story.interestEmbedding) >= INTEREST_SIMILARITY_THRESHOLD;

      return {
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
        isPersonalized,
        matchesFixedSelection,
        sources: story.storyArticles.map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
      };
    })
    // A story that matches neither the fixed selection nor the interest
    // embedding only appeared because hasInterest forced an unfiltered query
    // — drop it here rather than growing the DB query back into per-case
    // conditionals.
    .filter((s) => s.matchesFixedSelection || s.isPersonalized);

  // The hard volume caps, on top of the 12h window / similarity threshold
  // already applied above — independent of how well the AI/embedding
  // performs.
  const breaking = mapped.filter((s) => s.isBreaking).slice(0, MAX_BREAKING_STORIES);
  const personalized = mapped.filter((s) => s.isPersonalized).slice(0, MAX_INTEREST_STORIES);
  const rest = mapped.filter((s) => !s.isBreaking && !s.isPersonalized);
  return [...breaking, ...personalized, ...rest].map(({ matchesFixedSelection: _drop, ...story }) => story);
}
