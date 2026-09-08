import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "./index";

describe("prisma client", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects and can create + read a Source", async () => {
    const source = await prisma.source.create({
      data: {
        name: "Test Kaynak",
        rssUrl: "https://example.com/test-rss-" + Date.now(),
        category: "gundem"
      }
    });

    const found = await prisma.source.findUnique({ where: { id: source.id } });
    expect(found?.name).toBe("Test Kaynak");

    await prisma.source.delete({ where: { id: source.id } });
  });
});
