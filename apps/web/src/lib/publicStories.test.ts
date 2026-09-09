import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@gazete/db";
import { getTodaysStories } from "./publicStories";

function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("getTodaysStories", () => {
  beforeEach(async () => {
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("returns today's stories with their source names and links", async () => {
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

    const result = await getTodaysStories();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(story.id);
    expect(result[0].category).toBe("ekonomi");
    expect(result[0].aiSummaryTr).toBe("Özet metni.");
    expect(result[0].sources).toEqual([{ name: "AA", url: "https://example.com/story1" }]);
  });

  it("excludes stories still missing an AI summary", async () => {
    await prisma.story.create({
      data: { category: "spor", canonicalTitle: "İşlenmekte olan haber", digestDate: today() }
    });

    const result = await getTodaysStories();
    expect(result).toEqual([]);
  });

  it("returns an empty array when there are no stories today", async () => {
    const result = await getTodaysStories();
    expect(result).toEqual([]);
  });
});
