import { prisma, Category, MAX_BREAKING_STORIES, BREAKING_WINDOW_MS } from "@gazete/db";

export interface PublicStory {
  id: string;
  category: Category;
  canonicalTitle: string;
  aiSummaryTr: string;
  isBreaking: boolean;
  publishedAt: Date;
  sources: { name: string; url: string }[];
}

// Source links come from external RSS feeds — only ever render http(s) links,
// never a javascript: or other dangerous scheme a compromised/malicious feed
// could supply.
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// Every story ever published, most recent first — not scoped to today, so
// the homepage doubles as an archive. Each category section on the site
// already caps how many render at once and offers "daha fazla göster" to
// reveal the rest, so the ever-growing history stays browsable rather than
// dumping everything into view at once.
export async function getAllStories(): Promise<PublicStory[]> {
  const breakingSince = new Date(Date.now() - BREAKING_WINDOW_MS);

  const stories = await prisma.story.findMany({
    where: { aiSummaryTr: { not: null } },
    include: { storyArticles: { include: { article: { include: { source: true } } } } },
    orderBy: { createdAt: "desc" }
  });

  const mapped = stories.map((story) => ({
    id: story.id,
    category: story.category,
    canonicalTitle: story.canonicalTitle,
    aiSummaryTr: story.aiSummaryTr as string,
    isBreaking: story.isBreaking && story.createdAt >= breakingSince,
    // Earliest linked article's publish time — when this story was first
    // reported, not when our pipeline happened to process it.
    publishedAt: story.storyArticles.reduce(
      (earliest, sa) => (sa.article.publishedAt < earliest ? sa.article.publishedAt : earliest),
      story.storyArticles[0]?.article.publishedAt ?? story.createdAt
    ),
    sources: story.storyArticles
      .filter((sa) => isSafeHttpUrl(sa.article.url))
      .map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
  }));

  // Public homepage has no subscription concept, so unlike the digest email
  // there's no "did they opt into son_dakika" gate — this cap is purely a
  // safety valve against an over-eager AI day.
  const breaking = mapped.filter((s) => s.isBreaking).slice(0, MAX_BREAKING_STORIES);
  const nonBreaking = mapped.filter((s) => !s.isBreaking);
  return [...breaking, ...nonBreaking];
}
