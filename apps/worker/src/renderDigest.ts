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
function logoMark(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye'nin Gazetesi">
  <path d="M2 12C2 6 6 2 11 1L12 3.2C8.5 4.3 6.5 6.7 6.3 9.5C7 9.1 7.8 9 8.6 9.2C10.3 9.6 11.3 11 11 12.7C10.7 14.4 9.1 15.5 7.3 15.2C4.6 14.7 2.3 14.3 2 12Z" fill="#c9862c"/>
  <path d="M13 12C13 6 17 2 22 1L23 3.2C19.5 4.3 17.5 6.7 17.3 9.5C18 9.1 18.8 9 19.6 9.2C21.3 9.6 22.3 11 22 12.7C21.7 14.4 20.1 15.5 18.3 15.2C15.6 14.7 13.3 14.3 13 12Z" fill="#c9862c"/>
</svg>`;
}

const LOGO_MARK = logoMark(26, 17);
const LOGO_MARK_LARGE = logoMark(52, 34);

const CARD_WIDTH = 600;

const TURKISH_DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  weekday: "long",
  timeZone: "UTC"
});

function formatGreetingDate(digestDate: Date): string {
  return TURKISH_DATE_FORMAT.format(digestDate);
}

// A blank spacer row between stacked card tables — the email-safe way to add
// vertical gaps in HTML mail, since margin on table cells is unreliable in
// Outlook's rendering engine.
function spacer(height: number): string {
  return `<table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;
}

// The sponsor credit line under the masthead — a single "presented by" slot
// instead of a mid-scroll interruption. Visually distinct from a real news
// card (own tinted background, "İLE BİRLİKTE" eyebrow) so it never reads as
// editorial content.
function renderSponsorSlot(): string {
  return `
    <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:14px 24px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.06em;color:#9aa4b2;">İLE BİRLİKTE</p>
          <p style="margin:0;font-size:13px;color:#5b6472;">Bu alana reklam verebilirsiniz — <a href="mailto:reklam@turkiyeningazetesi.com" style="color:#4a3311;font-weight:600;">bize ulaşın</a></p>
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

export function renderDigestHtml(
  stories: StoryWithSources[],
  preferencesToken: string,
  baseUrl: string,
  digestDate: Date = new Date()
): string {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: stories.filter((s) => s.category === category)
  })).filter((group) => group.items.length > 0);

  const cardsHtml =
    groups.length > 0
      ? groups.map((group) => renderCategoryCard(group.category, group.items) + spacer(16)).join("")
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

              <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#1b2430;border-radius:12px 12px 0 0;">
                <tr>
                  <td style="padding:10px 24px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9aa4b2;">
                    ${escapeHtml(formatGreetingDate(digestDate))} &middot;
                    <a href="${baseUrl}" style="color:#e8a33d;">Tarayıcıda oku</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#fbead0;border-radius:0 0 12px 12px;">
                <tr>
                  <td style="padding:36px 24px;text-align:center;font-family:Georgia,'Times New Roman',serif;color:#1b2430;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 10px;">
                      <tr>
                        <td>${LOGO_MARK_LARGE}</td>
                      </tr>
                    </table>
                    <p style="margin:0 0 6px;font-style:italic;font-weight:700;font-size:26px;">Türkiye'nin Gazetesi</p>
                    <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5b6472;">${escapeHtml(
                      formatGreetingDate(digestDate)
                    )} sabahından herkese günaydın.</p>
                  </td>
                </tr>
              </table>

              ${spacer(16)}
              ${renderSponsorSlot()}
              ${spacer(16)}

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
