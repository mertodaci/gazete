import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { generateTestToken } from "./testUtils";
import { istanbulToday } from "./istanbulDate";
import { getStoriesForSubscriber, subscriberSelectedCategories } from "./digestQuery";

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

  it("gives a son_dakika subscriber breaking stories regardless of category", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "breaking@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    const breaking = await prisma.story.create({
      data: { category: "spor", canonicalTitle: "Büyük Sonuç", aiSummaryTr: "Özet.", isBreaking: true, digestDate: today() }
    });
    await prisma.story.create({
      data: { category: "spor", canonicalTitle: "Rutin Haber", aiSummaryTr: "Özet.", isBreaking: false, digestDate: today() }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result.map((s) => s.id)).toEqual([breaking.id]);
    expect(result[0].isBreaking).toBe(true);
  });

  it("subscriberSelectedCategories returns the subscriber's chosen categories", async () => {
    const subscriber = await prisma.subscriber.create({
      data: {
        email: "categories@example.com",
        preferencesToken: generateTestToken(),
        categories: { create: [{ category: "ekonomi" }, { category: "spor" }] }
      }
    });

    const categories = await subscriberSelectedCategories(subscriber.id);
    expect(categories.sort()).toEqual(["ekonomi", "spor"]);
  });

  it("does not flag a story as breaking for a subscriber who did not select son_dakika", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "not-breaking@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "spor" }] } }
    });
    await prisma.story.create({
      data: { category: "spor", canonicalTitle: "Büyük Sonuç", aiSummaryTr: "Özet.", isBreaking: true, digestDate: today() }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toHaveLength(1);
    expect(result[0].isBreaking).toBe(false);
  });

  it("excludes a breaking story older than 12 hours from Son Dakika, but a son_dakika subscriber alone doesn't see it at all", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "stale@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    await prisma.story.create({
      data: {
        category: "spor",
        canonicalTitle: "Eski Son Dakika",
        aiSummaryTr: "Özet.",
        isBreaking: true,
        digestDate: today(),
        createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000)
      }
    });

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toEqual([]);
  });

  it("caps breaking stories at MAX_BREAKING_STORIES, most recent first", async () => {
    const subscriber = await prisma.subscriber.create({
      data: { email: "many-breaking@example.com", preferencesToken: generateTestToken(), categories: { create: [{ category: "son_dakika" }] } }
    });
    for (let i = 0; i < 7; i++) {
      await prisma.story.create({
        data: {
          category: "spor",
          canonicalTitle: `Son Dakika ${i}`,
          aiSummaryTr: "Özet.",
          isBreaking: true,
          digestDate: today(),
          createdAt: new Date(Date.now() - i * 60 * 1000)
        }
      });
    }

    const result = await getStoriesForSubscriber(subscriber.id, today());
    expect(result).toHaveLength(5);
    expect(result.map((s) => s.canonicalTitle)).toEqual([
      "Son Dakika 0",
      "Son Dakika 1",
      "Son Dakika 2",
      "Son Dakika 3",
      "Son Dakika 4"
    ]);
  });
});
