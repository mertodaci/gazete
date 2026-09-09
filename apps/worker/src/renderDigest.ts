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
  return isSafeHttpUrl(source.url)
    ? `<a href="${escapeHtml(source.url)}" style="color:#5b6472;">${name}</a>`
    : name;
}

const CATEGORY_LABELS: Record<string, string> = {
  gundem: "Gündem",
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya'da neler oluyor?",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

const CATEGORY_ORDER = ["gundem", "ekonomi", "teknoloji", "spor", "dunya", "saglik", "kultur_sanat"];

// Rough adult silent-reading speed in Turkish; only meant to give subscribers
// a sense of how much is in a category before they open it, not a precise figure.
const WORDS_PER_MINUTE = 200;

function estimateReadingMinutes(stories: StoryWithSources[]): number {
  const wordCount = stories.reduce(
    (sum, story) => sum + story.aiSummaryTr.trim().split(/\s+/).filter(Boolean).length,
    0
  );
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

// A stylized opening-quote mark (two comma glyphs) — the brand's mark, paired
// with the wordmark wherever "Türkiye'nin Gazetesi" appears. Colors are
// hardcoded rather than pulled from CSS custom properties because most email
// clients (Outlook desktop in particular) don't resolve them.
const LOGO_MARK = `<svg width="26" height="17" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye'nin Gazetesi">
  <path d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z" fill="#c9862c"/>
  <path d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z" fill="#c9862c" transform="translate(11,0)"/>
</svg>`;

const CARD_WIDTH = 600;

// A blank spacer row between stacked card tables — the email-safe way to add
// vertical gaps in HTML mail, since margin on table cells is unreliable in
// Outlook's rendering engine.
function spacer(height: number): string {
  return `<table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;
}

// A single native ad slot, placed after the first category card — early
// enough for advertiser visibility, but only after the reader has already
// reached real editorial content. Visually distinct (dashed border, muted
// background, "REKLAM" label) so it never reads as an actual news item.
function renderAdSlot(): string {
  return `
    <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#f4f1ea;border:1px dashed #d7dbe1;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.04em;color:#5b6472;">REKLAM</p>
          <p style="margin:0;font-size:14px;color:#5b6472;">Bu alana reklam verebilirsiniz — <a href="mailto:reklam@turkiyeningazetesi.com" style="color:#4a3311;font-weight:600;">bize ulaşın</a></p>
        </td>
      </tr>
    </table>
  `;
}

function renderCategoryCard(category: string, items: StoryWithSources[]): string {
  const storiesHtml = items
    .map(
      (story) => `
        <div style="margin:0 0 18px;">
          <p style="margin:0 0 6px;">${escapeHtml(story.aiSummaryTr)}</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5b6472;">${story.sources
            .map(renderSourceLink)
            .join(" &middot; ")}</p>
        </div>
      `
    )
    .join("");

  return `
    <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#1b2430;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
            <tr>
              <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:600;color:#1b2430;padding-right:8px;">${escapeHtml(
                CATEGORY_LABELS[category] ?? category
              )}</td>
              <td>
                <span style="display:inline-block;background:#fbead0;color:#4a3311;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap;">${estimateReadingMinutes(
                  items
                )} dk okuma</span>
              </td>
            </tr>
          </table>
          ${storiesHtml}
        </td>
      </tr>
    </table>
  `;
}

export function renderDigestHtml(stories: StoryWithSources[], preferencesToken: string, baseUrl: string): string {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: stories.filter((s) => s.category === category)
  })).filter((group) => group.items.length > 0);

  const cardsHtml =
    groups.length > 0
      ? groups
          .map((group, index) => {
            const card = renderCategoryCard(group.category, group.items) + spacer(16);
            // The ad slot sits right after the first card — early enough to be
            // seen, but only once the reader has reached real content.
            return index === 0 ? card + renderAdSlot() + spacer(16) : card;
          })
          .join("")
      : `
        <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#ffffff;border-radius:12px;">
          <tr>
            <td style="padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1b2430;">
              Bugün seçtiğin kategorilerde yeni haber yok.
            </td>
          </tr>
        </table>
        ${spacer(16)}
      `;

  return `
    <html>
      <body style="margin:0;padding:0;background:#edeff2;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edeff2;">
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;">
                <tr>
                  <td style="padding:8px 8px 16px;font-family:Georgia,'Times New Roman',serif;color:#1b2430;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:8px;vertical-align:middle;">${LOGO_MARK}</td>
                        <td style="font-style:italic;font-weight:700;font-size:20px;vertical-align:middle;">Türkiye'nin Gazetesi</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${cardsHtml}

              <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;">
                <tr>
                  <td style="padding:4px 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#5b6472;">
                    <a href="${baseUrl}/preferences?token=${preferencesToken}" style="color:#5b6472;">Tercihlerini güncelle</a>
                    &middot;
                    <a href="${baseUrl}/unsubscribe?token=${preferencesToken}" style="color:#5b6472;">Abonelikten çık</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
