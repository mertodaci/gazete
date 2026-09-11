import type { StoryWithSources } from "./digestQuery";
import type { MarketSnapshot } from "./marketData";

export function escapeHtml(text: string): string {
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

export function renderSourceLink(source: { name: string; url: string }): string {
  const name = escapeHtml(source.name);
  return isSafeHttpUrl(source.url)
    ? `<a href="${escapeHtml(source.url)}" style="color:#5b6472;">${name}</a>`
    : name;
}

const CATEGORY_LABELS: Record<string, string> = {
  ekonomi: "Ekonomi",
  teknoloji: "Teknoloji",
  spor: "Spor",
  dunya: "Dünya'da neler oluyor?",
  saglik: "Sağlık",
  kultur_sanat: "Kültür-Sanat"
};

const CATEGORY_ORDER = ["ekonomi", "teknoloji", "spor", "dunya", "saglik", "kultur_sanat"];

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

// The brand's mark (two comma glyphs), rendered as an <img> pointing at a
// hosted SVG rather than inline <svg> markup — Gmail and several other
// mail clients strip inline SVG from HTML email as a sanitization step, but
// an externally-loaded image survives.
function logoMark(baseUrl: string, width: number, height: number): string {
  return `<img src="${baseUrl}/logo-mark.svg" width="${width}" height="${height}" alt="Türkiye'nin Gazetesi" style="display:block;border:0;">`;
}

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

const MARKET_NUMBER_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MARKET_PERCENT_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A static snapshot at send time — unlike the site's scrolling ticker, email
// clients can't reliably run CSS animations, so this is just one line.
function renderMarketRow(snapshot: MarketSnapshot | null): string {
  if (!snapshot) return "";
  const text = [
    `BIST 100 ${MARKET_NUMBER_FORMAT.format(snapshot.bist100.price)}`,
    `Gram Altın ${MARKET_NUMBER_FORMAT.format(snapshot.gold.price)} ₺`,
    `Gümüş ${MARKET_NUMBER_FORMAT.format(snapshot.silver.price)} ₺`
  ].join("  &middot;  ");
  return `<p style="margin:8px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#5b6472;">${text}</p>`;
}

// The Ekonomi card's closing-values table — shown to every subscriber who
// selected "Ekonomi", even on a day with no Ekonomi stories, since the
// market data itself doesn't depend on news volume. Sent once a day at
// 08:45, so "closing" here just means the last traded price on file.
function renderMarketTableRow(label: string, quote: { price: number; changePercent: number }): string {
  const isUp = quote.changePercent >= 0;
  const color = isUp ? "#2f8a3c" : "#c0392b";
  const arrow = isUp ? "▲" : "▼";
  return `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #edeff2;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1b2430;">${escapeHtml(
        label
      )}</td>
      <td style="padding:6px 0;border-bottom:1px solid #edeff2;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1b2430;text-align:right;white-space:nowrap;">${MARKET_NUMBER_FORMAT.format(
        quote.price
      )}</td>
      <td style="padding:6px 0 6px 12px;border-bottom:1px solid #edeff2;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:${color};text-align:right;white-space:nowrap;">${arrow} %${MARKET_PERCENT_FORMAT.format(
        Math.abs(quote.changePercent)
      )}</td>
    </tr>
  `;
}

function renderMarketTable(snapshot: MarketSnapshot): string {
  const rows = [
    renderMarketTableRow("BIST 100", snapshot.bist100),
    renderMarketTableRow("Gram Altın (₺)", snapshot.gold),
    renderMarketTableRow("Gümüş (₺)", snapshot.silver),
    ...snapshot.stocks.map((stock) => renderMarketTableRow(stock.symbol, stock))
  ].join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse;">
      <tr>
        <td colspan="3" style="padding:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.04em;color:#9aa4b2;">SON KAPANIŞ</td>
      </tr>
      ${rows}
    </table>
  `;
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
          <p style="margin:0;font-size:13px;color:#5b6472;">Bu alana reklam verebilirsiniz — <a href="mailto:info@turkiyeningazetesi.com" style="color:#4a3311;font-weight:600;">bize ulaşın</a></p>
        </td>
      </tr>
    </table>
  `;
}

// Mirrors the website's per-section cap (apps/web/src/app/NewsFeed.tsx) — a
// busy category can carry dozens of stories on an active day, which is what
// made the email feel unbounded and disorganized. The email can't offer an
// in-place "show more" like the site does, so the overflow links there instead.
const MAX_STORIES_PER_CATEGORY = 6;

function renderCategoryCard(
  items: StoryWithSources[],
  baseUrl: string,
  opts: { label: string; anchorId: string },
  extraHtml: string = ""
): string {
  const visible = items.slice(0, MAX_STORIES_PER_CATEGORY);
  const hiddenCount = items.length - visible.length;

  const storiesHtml = visible
    .map(
      (story) => `
        <div style="margin:0 0 18px;">
          <p style="margin:0 0 4px;font-weight:700;">${escapeHtml(story.canonicalTitle)}</p>
          <p style="margin:0 0 6px;">${escapeHtml(story.aiSummaryTr)}</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5b6472;">${story.sources
            .map(renderSourceLink)
            .join(" &middot; ")}</p>
        </div>
      `
    )
    .join("");

  const moreHtml =
    hiddenCount > 0
      ? `<p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;">
          <a href="${baseUrl}#${opts.anchorId}" style="color:#4a3311;font-weight:600;">${hiddenCount} haber daha — sitede gör</a>
        </p>`
      : "";

  return `
    <table role="presentation" width="${CARD_WIDTH}" cellpadding="0" cellspacing="0" style="max-width:${CARD_WIDTH}px;width:100%;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#1b2430;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
            <tr>
              <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:600;color:#1b2430;padding-right:8px;">${escapeHtml(
                opts.label
              )}</td>
              ${
                visible.length > 0
                  ? `<td>
                <span style="display:inline-block;background:#fbead0;color:#4a3311;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap;">${estimateReadingMinutes(
                  visible
                )} dk okuma</span>
              </td>`
                  : ""
              }
            </tr>
          </table>
          ${extraHtml}
          ${storiesHtml}
          ${moreHtml}
        </td>
      </tr>
    </table>
  `;
}

export function renderDigestHtml(
  stories: StoryWithSources[],
  preferencesToken: string,
  baseUrl: string,
  digestDate: Date = new Date(),
  marketSnapshot: MarketSnapshot | null = null,
  wantsEkonomi: boolean = false
): string {
  const breakingStories = stories.filter((s) => s.isBreaking);

  // The Ekonomi card stays visible for a subscriber who selected it even on
  // a day with zero Ekonomi stories, since it also carries the closing-values
  // table (which doesn't depend on news volume) — every other category still
  // needs at least one story to appear at all.
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: stories.filter((s) => s.category === category)
  })).filter(
    (group) => group.items.length > 0 || (group.category === "ekonomi" && wantsEkonomi && marketSnapshot !== null)
  );

  const breakingCardHtml =
    breakingStories.length > 0
      ? renderCategoryCard(breakingStories, baseUrl, { label: "Son Dakika", anchorId: "son-dakika" }) + spacer(16)
      : "";

  const cardsHtml =
    groups.length > 0
      ? groups
          .map(
            (group) =>
              renderCategoryCard(
                group.items,
                baseUrl,
                {
                  label: CATEGORY_LABELS[group.category] ?? group.category,
                  anchorId: `kategori-${group.category}`
                },
                group.category === "ekonomi" && wantsEkonomi && marketSnapshot
                  ? renderMarketTable(marketSnapshot)
                  : ""
              ) + spacer(16)
          )
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
                        <td>${logoMark(baseUrl, 52, 34)}</td>
                      </tr>
                    </table>
                    <p style="margin:0 0 6px;font-style:italic;font-weight:700;font-size:26px;">Türkiye'nin Gazetesi</p>
                    <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#5b6472;">${escapeHtml(
                      formatGreetingDate(digestDate)
                    )} sabahından herkese günaydın.</p>
                    ${renderMarketRow(marketSnapshot)}
                  </td>
                </tr>
              </table>

              ${spacer(16)}
              ${renderSponsorSlot()}
              ${spacer(16)}

              ${breakingCardHtml}
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
