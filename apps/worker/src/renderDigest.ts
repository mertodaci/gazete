import type { StoryWithSources } from "./digestQuery";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_LABELS: Record<string, string> = {
  gundem: "Gündem",
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

export function renderDigestHtml(stories: StoryWithSources[], preferencesToken: string, baseUrl: string): string {
  const storiesHtml = stories
    .map(
      (story) => `
        <div>
          <p><strong>[${CATEGORY_LABELS[story.category] ?? story.category}]</strong></p>
          <p>${escapeHtml(story.aiSummaryTr)}</p>
          <p>${story.sources
            .map((s) => `<a href="${s.url}">${escapeHtml(s.name)}</a>`)
            .join(" &middot; ")}</p>
        </div>
      `
    )
    .join("<hr />");

  return `
    <html>
      <body>
        <h1>Bugünkü Gazete'n</h1>
        ${storiesHtml || "<p>Bugün seçtiğin kategorilerde yeni haber yok.</p>"}
        <hr />
        <p>
          <a href="${baseUrl}/preferences?token=${preferencesToken}">Tercihlerini güncelle</a>
          &middot;
          <a href="${baseUrl}/unsubscribe?token=${preferencesToken}">Abonelikten çık</a>
        </p>
      </body>
    </html>
  `;
}
