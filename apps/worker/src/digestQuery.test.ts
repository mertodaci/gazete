import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateTestToken } from "./testUtils";
import { istanbulToday } from "./istanbulDate";
import { getStoriesForSubscriber } from "./digestQuery";

// Mirrors the Istanbul-aware date logic the code under test uses (istanbulDate.ts).
const today = istanbulToday;

describe("getStoriesForSubscriber", () => {
  beforeEach(async () => {
    await prisma.digestSend.deleteMany({});
    await prisma.subscriberCategory.deleteMany({});
    await prisma.subscriber.deleteMany({});
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("returns only today's stories in the subscriber's chosen categories, with source links", async () => {
    const subscriber = await prisma.subscriber.create({
      data: {
        email: "digest@example.com",
        preferencesToken: generateTestToken(),
        categories: { create: [{ category: "ekonomi" }] }
      }
    });

    const source = await prisma.source.create({
      data: { name: "AA", rssUrl: "https://example.com/rss-" + Date.now(), category: "ekonomi" }
    });
    const article = await prisma.article.create({
      data: { sourceId: source.id, url: "https://example.com/story1", title: "Faiz kararı", publishedAt: new Date() }
    });
    const story = await prisma.story.create({
      data: {
        category: "ekonomi",
        canonicalTitle: "Faiz kararı",
        aiSummaryTr: "Özet metni.",
        digestDate: today(),
        storyArticles: { create: { articleId: article.id } }
      }
    });

    await prisma.story.create({
      data: { category: "spor", canonicalTitle: "Maç sonucu", aiSummaryTr: "Spor özeti.", digestDate: today() }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(story.id);
    expect(result[0].sources).toEqual([{ name: "AA", url: "https://example.com/story1" }]);
  });

  it("returns an empty array when there are no matching stories", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "empty@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "spor" }] } }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toEqual([]);
  });
});
