import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("./summarize", () => ({ summarizeArticle: vi.fn().mockResolvedValue("Bu bir test özetidir.") }));

import { processNewArticles } from "./processArticles";
import { summarizeArticle } from "./summarize";

async function makeArticle(sourceOverrides: Partial<{ category: any }> = {}, title = "Test Başlık") {
  const source = await prisma.source.create({
    data: { name: "Src", rssUrl: `https://example.com/${Date.now()}-${Math.random()}`, category: sourceOverrides.category ?? "gundem" }
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
    expect(summarizeArticle).toHaveBeenCalledTimes(1);
  });

  it("attaches a similar same-day same-category article to the existing story without a second AI call", async () => {
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

  it("does not match across different categories even with an identical title", async () => {
    await makeArticle({ category: "gundem" }, "Aynı Başlık");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    await makeArticle({ category: "spor" }, "Aynı Başlık");
    await processNewArticles();

    const stories = await prisma.story.findMany();
    expect(stories).toHaveLength(2);
  });
});
