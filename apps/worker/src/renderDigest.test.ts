import { describe, expect, it } from "vitest";
import { renderDigestHtml } from "./renderDigest";
import type { StoryWithSources } from "./digestQuery";

describe("renderDigestHtml", () => {
  const stories: StoryWithSources[] = [
    {
      id: "1",
      category: "ekonomi",
      aiSummaryTr: "Merkez Bankası faizi sabit tuttu.",
      sources: [{ name: "AA", url: "https://example.com/a" }, { name: "NTV", url: "https://example.com/b" }]
    }
  ];

  it("includes each story's summary and every source link", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("Merkez Bankası faizi sabit tuttu.");
    expect(html).toContain("https://example.com/a");
    expect(html).toContain("https://example.com/b");
  });

  it("includes the preferences and unsubscribe links built from the token and base URL", () => {
    const html = renderDigestHtml(stories, "tok123", "https://gazete.example.com");
    expect(html).toContain("https://gazete.example.com/preferences?token=tok123");
    expect(html).toContain("https://gazete.example.com/unsubscribe?token=tok123");
  });

  it("escapes a quote in a source URL so it cannot break out of the href attribute", () => {
    const injected: StoryWithSources[] = [
      {
        id: "3",
        category: "gundem",
        aiSummaryTr: "Özet.",
        sources: [{ name: "Kötü Kaynak", url: 'https://example.com/a" onmouseover="alert(1)' }]
      }
    ];
    const html = renderDigestHtml(injected, "tok123", "https://gazete.example.com");

    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;");
    // The href attribute must be a single well-formed quoted value ending right
    // before the tag closes — nothing escaped out into attribute position.
    expect(html).toContain('<a href="https://example.com/a&quot; onmouseover=&quot;alert(1)">Kötü Kaynak</a>');
  });

  it("renders a non-http(s) source URL as plain text instead of a link", () => {
    const dangerous: StoryWithSources[] = [
      {
        id: "4",
        category: "gundem",
        aiSummaryTr: "Özet.",
        sources: [{ name: "Şüpheli", url: "javascript:alert(1)" }]
      }
    ];
    const html = renderDigestHtml(dangerous, "tok123", "https://gazete.example.com");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("Şüpheli");
  });

  it("escapes HTML in the summary to prevent injection", () => {
    const malicious: StoryWithSources[] = [
      { id: "2", category: "gundem", aiSummaryTr: "<script>alert(1)</script>", sources: [] }
    ];
    const html = renderDigestHtml(malicious, "tok123", "https://gazete.example.com");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
