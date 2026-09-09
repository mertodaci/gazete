import { prisma, Category } from "@gazete/db";

// Mirrors apps/worker/src/istanbulDate.ts: Turkey is a fixed UTC+3, no DST,
// so "today" for a public-facing story list must match the same calendar
// day the worker stamps onto each Story's digestDate.
function istanbulToday(): Date {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export interface PublicStory {
  id: string;
  category: Category;
  aiSummaryTr: string;
  sources: { name: string; url: string }[];
}

// Source links come from external RSS feeds — only ever render http(s) links,
// never a javascript: or other dangerous scheme a compromised/malicious feed
// could supply.
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function getTodaysStories(): Promise<PublicStory[]> {
  const stories = await prisma.story.findMany({
    where: { digestDate: istanbulToday(), aiSummaryTr: { not: null } },
    include: { storyArticles: { include: { article: { include: { source: true } } } } },
    orderBy: { createdAt: "desc" }
  });

  return stories.map((story) => ({
    id: story.id,
    category: story.category,
    aiSummaryTr: story.aiSummaryTr as string,
    sources: story.storyArticles
      .filter((sa) => isSafeHttpUrl(sa.article.url))
      .map((sa) => ({ name: sa.article.source.name, url: sa.article.url }))
  }));
}
