import { describe, expect, it } from "vitest";
import { renderDigestHtml } from "./renderDigest";
import type { StoryWithSources } from "./digestQuery";
import type { MarketSnapshot } from "./marketData";

const sampleSnapshot: MarketSnapshot = {
  bist100: { price: 14467.25, changePercent: 0.51 },
  gold: { price: 6824.86, changePercent: 1.31 },
  silver: { price: 100.77, changePercent: 1.54 },
  stocks: [{ symbol: "THYAO", price: 300.25, changePercent: 0.33 }]
};

describe("renderDigestHtml", () => {
  const stories: StoryWithSources[] = [
    {
      id: "1",
      category: "ekonomi",
      canonicalTitle: "Merkez Bankası faiz kararı",
      aiSummaryTr: "Merkez Bankası faizi sabit tuttu.",
      isBreaking: false,
      sources: [{ name: "AA", url: "https://example.com/a" }, { name: "NTV", url: "https://example.com/b" }]
    }
  ];

  it("includes each story's title, summary, and every source link", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("Merkez Bankası faiz kararı");
    expect(html).toContain("Merkez Bankası faizi sabit tuttu.");
    expect(html).toContain("https://example.com/a");
    expect(html).toContain("https://example.com/b");
  });

  it("includes the preferences and unsubscribe links built from the token and base URL", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("https://gazete.example.com/preferences?token=tok123");
    expect(html).toContain("https://gazete.example.com/unsubscribe?token=tok123");
  });

  it("caps a category at 6 stories and links to the rest on the site", () => {
    const many: StoryWithSources[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      category: "spor",
      canonicalTitle: `Haber ${i}`,
      aiSummaryTr: `Özet ${i}.`,
      isBreaking: false,
      sources: []
    }));
    const html = renderDigestHtml(many, "tok123", "https://gazete.example.com");

    expect(html).toContain("Haber 0");
    expect(html).toContain("Haber 5");
    expect(html).not.toContain("Haber 6");
    expect(html).not.toContain("Haber 7");
    expect(html).toContain("2 haber daha");
    expect(html).toContain("https://gazete.example.com#kategori-spor");
  });

  it("renders a Son Dakika section, before the real-category cards, when a story is breaking", () => {
    const withBreaking: StoryWithSources[] = [
      {
        id: "b1",
        category: "spor",
        canonicalTitle: "Büyük Final Sonucu",
        aiSummaryTr: "Şampiyon belli oldu.",
        isBreaking: true,
        sources: []
      },
      {
        id: "n1",
        category: "ekonomi",
        canonicalTitle: "Rutin Ekonomi Haberi",
        aiSummaryTr: "Sıradan bir gelişme.",
        isBreaking: false,
        sources: []
      }
    ];
    const html = renderDigestHtml(withBreaking, "tok123", "https://gazete.example.com");

    expect(html).toContain("Son Dakika");
    expect(html.indexOf("Son Dakika")).toBeLessThan(html.indexOf("Rutin Ekonomi Haberi"));
    // A breaking story renders in both its Son Dakika card and its own
    // category's card — not mutually exclusive.
    const occurrences = html.split("Büyük Final Sonucu").length - 1;
    expect(occurrences).toBe(2);
  });

  it("does not render a Son Dakika section when no story is breaking", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).not.toContain("Son Dakika");
  });

  it("escapes a quote in a source URL so it cannot break out of the href attribute", () => {
    const injected: StoryWithSources[] = [
      {
        id: "3",
        category: "spor",
        canonicalTitle: "Başlık",
        aiSummaryTr: "Özet.",
        isBreaking: false,
        sources: [{ name: "Kötü Kaynak", url: 'https://example.com/a" onmouseover="alert(1)' }]
      }
    ];
    const html = renderDigestHtml(injected, "tok123", "https://gazete.example.com");

    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;");
    // The href attribute must be a single well-formed quoted value ending right
    // before the tag closes — nothing escaped out into attribute position.
    expect(html).toContain(
      '<a href="https://example.com/a&quot; onmouseover=&quot;alert(1)" style="color:#5b6472;">Kötü Kaynak</a>'
    );
  });

  it("renders a non-http(s) source URL as plain text instead of a link", () => {
    const dangerous: StoryWithSources[] = [
      {
        id: "4",
        category: "spor",
        canonicalTitle: "Başlık",
        aiSummaryTr: "Özet.",
        isBreaking: false,
        sources: [{ name: "Şüpheli", url: "javascript:alert(1)" }]
      }
    ];
    const html = renderDigestHtml(dangerous, "tok123", "https://gazete.example.com");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("Şüpheli");
  });

  it("escapes HTML in the title and summary to prevent injection", () => {
    const malicious: StoryWithSources[] = [
      {
        id: "2",
        category: "spor",
        canonicalTitle: "<img src=x onerror=alert(1)>",
        aiSummaryTr: "<script>alert(1)</script>",
        isBreaking: false,
        sources: []
      }
    ];
    const html = renderDigestHtml(malicious, "tok123", "https://gazete.example.com");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("shows the closing-values table in the Ekonomi card for a subscriber who selected it", () => {
    const html = renderDigestHtml(
      stories,
      "tok123",
      "https://gazete.example.com",
      new Date(),
      sampleSnapshot,
      true
    );
    expect(html).toContain("SON KAPANIŞ");
    expect(html).toContain("BIST 100");
    expect(html).toContain("THYAO");
    expect(html).toContain("14.467,25");
  });

  it("still shows the Ekonomi card with just the table when the subscriber has no Ekonomi stories that day", () => {
    const sportOnly: StoryWithSources[] = [
      {
        id: "s1",
        category: "spor",
        canonicalTitle: "Maç Sonucu",
        aiSummaryTr: "Özet.",
        isBreaking: false,
        sources: []
      }
    ];
    const html = renderDigestHtml(
      sportOnly,
      "tok123",
      "https://gazete.example.com",
      new Date(),
      sampleSnapshot,
      true
    );
    expect(html).toContain("Ekonomi");
    expect(html).toContain("SON KAPANIŞ");
  });

  it("does not show the closing-values table for a subscriber who did not select Ekonomi", () => {
    const html = renderDigestHtml(
      stories,
      "tok123",
      "https://gazete.example.com",
      new Date(),
      sampleSnapshot,
      false
    );
    expect(html).not.toContain("SON KAPANIŞ");
  });

  it("does not show the closing-values table when the market snapshot is unavailable", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com", new Date(), null, true);
    expect(html).not.toContain("SON KAPANIŞ");
  });
});
