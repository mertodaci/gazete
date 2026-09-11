import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("./summarize", () => ({
  summarizeArticle: vi.fn().mockResolvedValue({ summary: "Bu bir test özetidir.", category: "ekonomi", isBreaking: false })
}));

import { processNewArticles } from "./processArticles";
import { summarizeArticle } from "./summarize";

async function makeArticle(sourceOverrides: Partial<{ category: any }> = {}, title = "Test Başlık") {
  const source = await prisma.source.create({
    data: { name: "Src", rssUrl: `https://example.com/${Date.now()}-${Math.random()}`, category: sourceOverrides.category ?? "ekonomi" }
  });
  return prisma.article.create({
    data: {
      sourceId: source.id,
      url: `https://example.com/${Date.now()}-${Math.random()}`,
      title,
      publishedAt: new Date()
    }
  });
}

describe("processNewArticles", () => {
  beforeEach(async () => {
    vi.mocked(summarizeArticle).mockClear();
    vi.mocked(summarizeArticle).mockResolvedValue({ summary: "Bu bir test özetidir.", category: "ekonomi", isBreaking: false });
    await prisma.storyArticle.deleteMany({});
    await prisma.story.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("creates a new story with an AI summary for an unmatched article", async () => {
    const article = await makeArticle({}, "Benzersiz Bir Haber Başlığı");

    await processNewArticles();

    const links = await prisma.storyArticle.findMany({ where: { articleId: article.id }, include: { story: true } });
    expect(links).toHaveLength(1);
    expect(links[0].story.aiSummaryTr).toBe("Bu bir test özetidir.");
    expect(links[0].story.category).toBe("ekonomi");
    expect(summarizeArticle).toHaveBeenCalledTimes(1);
  });

  it("attaches a similar same-day article to the existing story without a second AI call", async () => {
    await makeArticle({}, "Merkez Bankası faiz kararını açıkladı");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    const second = await makeArticle({}, "Merkez Bankası faiz kararını duyurdu");
    await processNewArticles();

    const stories = await prisma.story.findMany({ include: { storyArticles: true } });
    expect(stories).toHaveLength(1);
    expect(stories[0].storyArticles.map((sa) => sa.articleId)).toContain(second.id);
    expect(summarizeArticle).not.toHaveBeenCalled();
  });

  it("merges an identical title across different source categories into one story (cross-category dedup)", async () => {
    await makeArticle({ category: "ekonomi" }, "Aynı Başlık");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    await makeArticle({ category: "spor" }, "Aynı Başlık");
    await processNewArticles();

    const stories = await prisma.story.findMany();
    expect(stories).toHaveLength(1);
    // Category comes from the AI classification of whichever article created
    // the story first, not from either source's own category — the second,
    // matching article never triggers a second AI call.
    expect(summarizeArticle).not.toHaveBeenCalled();
  });

  it("falls back to the gundem category when the AI says no real topic fits", async () => {
    vi.mocked(summarizeArticle).mockResolvedValueOnce({
      summary: "Genel bir haber özeti.",
      category: "gundem",
      isBreaking: false
    });
    const article = await makeArticle({}, "Sınıflandırılamayan Haber");

    await processNewArticles();

    const story = await prisma.story.findFirst({ where: { canonicalTitle: article.title } });
    expect(story?.category).toBe("gundem");
  });

  it("persists isBreaking from the AI classification", async () => {
    vi.mocked(summarizeArticle).mockResolvedValueOnce({
      summary: "Büyük bir gelişme.",
      category: "dunya",
      isBreaking: true
    });
    const article = await makeArticle({}, "Son Dakika Haberi");

    await processNewArticles();

    const story = await prisma.story.findFirst({ where: { canonicalTitle: article.title } });
    expect(story?.isBreaking).toBe(true);
  });
});
