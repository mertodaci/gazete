import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@gazete/db";

const parseURLMock = vi.fn();
vi.mock("rss-parser", () => ({
  default: vi.fn().mockImplementation(() => ({ parseURL: parseURLMock }))
}));

import { fetchAllSources } from "./fetchRss";

describe("fetchAllSources", () => {
  beforeEach(async () => {
    parseURLMock.mockReset();
    await prisma.storyArticle.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.source.deleteMany({});
  });

  it("stores new articles from an active source", async () => {
    const source = await prisma.source.create({
      data: { name: "Test", rssUrl: "https://example.com/rss", category: "gundem" }
    });
    parseURLMock.mockResolvedValue({
      items: [
        { link: "https://example.com/a1", title: "Haber 1", isoDate: "2026-09-08T06:00:00Z", contentSnippet: "özet" }
      ]
    });

    const errors = await fetchAllSources();
    expect(errors).toEqual([]);

    const articles = await prisma.article.findMany({ where: { sourceId: source.id } });
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Haber 1");
  });

  it("skips articles whose URL already exists", async () => {
    const source = await prisma.source.create({
      data: { name: "Test", rssUrl: "https://example.com/rss2", category: "gundem" }
    });
    await prisma.article.create({
      data: { sourceId: source.id, url: "https://example.com/a1", title: "Eski", publishedAt: new Date() }
    });
    parseURLMock.mockResolvedValue({
      items: [{ link: "https://example.com/a1", title: "Haber 1", isoDate: "2026-09-08T06:00:00Z" }]
    });

    await fetchAllSources();
    const articles = await prisma.article.findMany({ where: { sourceId: source.id } });
    expect(articles).toHaveLength(1);
  });

  it("skips inactive sources", async () => {
    await prisma.source.create({
      data: { name: "Inactive", rssUrl: "https://example.com/rss3", category: "gundem", active: false }
    });

    await fetchAllSources();
    expect(parseURLMock).not.toHaveBeenCalled();
  });

  it("returns an error for a source instead of throwing, and still processes others", async () => {
    const bad = await prisma.source.create({
      data: { name: "Bad", rssUrl: "https://example.com/bad", category: "gundem" }
    });
    const good = await prisma.source.create({
      data: { name: "Good", rssUrl: "https://example.com/good", category: "spor" }
    });
    parseURLMock.mockImplementation(async (url: string) => {
      if (url === bad.rssUrl) throw new Error("timeout");
      return { items: [{ link: "https://example.com/g1", title: "Spor Haberi", isoDate: "2026-09-08T06:00:00Z" }] };
    });

    const errors = await fetchAllSources();
    expect(errors).toHaveLength(1);
    expect(errors[0].sourceId).toBe(bad.id);

    const goodArticles = await prisma.article.findMany({ where: { sourceId: good.id } });
    expect(goodArticles).toHaveLength(1);
  });
});
