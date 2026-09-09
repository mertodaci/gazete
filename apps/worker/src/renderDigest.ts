import type { StoryWithSources } from "./digestQuery";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Source URLs come from an external RSS feed's <link> element — untrusted
// input. Only http(s) links are rendered as anchors; anything else (javascript:,
// data:, ...) falls back to plain text, and the value is HTML-escaped either way
// so a quote in the URL can't break out of the href attribute.
function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function renderSourceLink(source: { name: string; url: string }): string {
  const name = escapeHtml(source.name);
  return isSafeHttpUrl(source.url) ? `<a href="${escapeHtml(source.url)}">${name}</a>` : name;
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
          <p>${story.sources.map(renderSourceLink).join(" &middot; ")}</p>
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
