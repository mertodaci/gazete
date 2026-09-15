import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

vi.mock("./summarize", () => ({
  summarizeArticle: vi.fn().mockResolvedValue({ summary: "Bu bir test özetidir.", category: "ekonomi", isBreaking: false })
}));
// Avoids a real Voyage call in tests — deterministic — while keeping the
// real cosineSimilarity so the semantic-dedup tests exercise real math.
vi.mock("./embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./embeddings")>();
  return { ...actual, getEmbedding: vi.fn() };
});

import { processNewArticles } from "./processArticles";
import { summarizeArticle } from "./summarize";
import { getEmbedding } from "./embeddings";

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
    vi.mocked(getEmbedding).mockClear();
    vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
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

  it("stores the computed interest embedding on a new story", async () => {
    const article = await makeArticle({}, "Embedding Testi Haberi");
    await processNewArticles();

    const story = await prisma.story.findFirst({ where: { canonicalTitle: article.title } });
    expect(story?.interestEmbedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("still creates the story with an empty embedding when the embedding call fails", async () => {
    vi.mocked(getEmbedding).mockResolvedValueOnce(null);
    const article = await makeArticle({}, "Embedding Hatası Haberi");
    await processNewArticles();

    const story = await prisma.story.findFirst({ where: { canonicalTitle: article.title } });
    expect(story?.interestEmbedding).toEqual([]);
  });

  it("merges two very differently-worded articles about the same event via semantic similarity", async () => {
    // Below the 0.5 Jaccard threshold on title words alone, but the same
    // real-world event — the case that motivated adding embedding-based
    // dedup (word overlap alone missed exactly this kind of pair).
    vi.mocked(getEmbedding).mockResolvedValue([1, 0]);
    await makeArticle({}, "Adalet Bakanı'ndan 41 şüpheliye gözaltı açıklaması");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    const second = await makeArticle({}, "Tarladan markete fiyat oyununa dev operasyon");
    await processNewArticles();

    const stories = await prisma.story.findMany({ include: { storyArticles: true } });
    expect(stories).toHaveLength(1);
    expect(stories[0].storyArticles.map((sa) => sa.articleId)).toContain(second.id);
    expect(summarizeArticle).not.toHaveBeenCalled();
  });

  it("keeps two unrelated articles as separate stories when neither title nor embedding match", async () => {
    vi.mocked(getEmbedding).mockImplementation(async (text: string) =>
      text.includes("Deprem") ? [1, 0] : [0, 1]
    );
    await makeArticle({}, "İzmir'de Deprem Oldu");
    await processNewArticles();
    vi.mocked(summarizeArticle).mockClear();

    await makeArticle({}, "Borsa Rekor Kırdı");
    await processNewArticles();

    const stories = await prisma.story.findMany();
    expect(stories).toHaveLength(2);
    expect(summarizeArticle).toHaveBeenCalledTimes(1);
  });
});
