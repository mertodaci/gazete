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

  it("escapes HTML in the summary to prevent injection", () => {
    const malicious: StoryWithSources[] = [
      { id: "2", category: "gundem", aiSummaryTr: "<script>alert(1)</script>", sources: [] }
    ];
    const html = renderDigestHtml(malicious, "tok123", "https://gazete.example.com");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
